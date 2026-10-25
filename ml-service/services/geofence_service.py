"""
OneCheck ML Service — Engine 4: 500m Geo-Fence EXIF Spatial Engine
===================================================================
Nickname:   "Satellite Pin Tracker"
Purpose:    Verify that infrastructure photos (laboratories, libraries,
            fire equipment, barrier-free ramps) uploaded for AICTE approval
            were genuinely captured within the registered campus premises
            (≤ 500m radius). Detect off-campus photos, rented commercial
            properties in another city, or downloaded stock photos.
Latency:    ~2–5 ms (pure CPU spherical trigonometry, microsecond math)
RAM:        < 2 MB per analysis

Technical Approach
------------------
1. EXIF Tag Parsing:
   - Extract EXIF tag 0x8825 (GPSInfo) using Pillow IFD parser.
   - Parse GPSLatitude, GPSLatitudeRef ('N' / 'S'), GPSLongitude,
     GPSLongitudeRef ('E' / 'W'), GPSAltitude, and timestamps.
   - Convert DMS rational triples (degrees, minutes, seconds) to signed
     decimal degrees with 6 decimal places of precision (~0.1m precision).
2. Haversine Great-Circle Geodesic Formula:
   - Earth radius R = 6,371,000 meters.
   - d = 2R * asin(sqrt(sin²(Δφ/2) + cos(φ1)*cos(φ2)*sin²(Δλ/2)))
   - Computes surface distance without external geocoding API round-trips.
3. Decision Boundary:
   - distance ≤ 500.0m → PASS (on-campus, genuine infrastructure)
   - distance > 500.0m → FAIL (fraud violation, e.g. Apex Institute 24km away)
   - No GPS metadata   → NO_GPS_DATA (audit alert: camera location was disabled)
"""

from __future__ import annotations

import base64
import datetime
import io
import logging
import math
from typing import Any, Dict, Optional, Tuple

from PIL import ExifTags, Image

try:
    from models.enums import GeofenceStatus
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from models.enums import GeofenceStatus

logger = logging.getLogger(__name__)

# Standard AICTE campus boundary radius in meters
DEFAULT_GEOFENCE_RADIUS_METERS: float = 500.0
EARTH_RADIUS_METERS: float = 6371000.0


def _dms_to_decimal(dms: Any, ref: Optional[str]) -> Optional[float]:
    """
    Convert degrees, minutes, seconds tuple/list to signed decimal degrees.
    Handles floats, ints, Fraction/IFDRational tuples from Pillow.
    """
    if dms is None:
        return None

    try:
        if isinstance(dms, (int, float)):
            dec = float(dms)
        elif len(dms) == 3:
            deg = float(dms[0])
            minute = float(dms[1])
            sec = float(dms[2])
            dec = deg + (minute / 60.0) + (sec / 3600.0)
        elif len(dms) == 2:
            deg = float(dms[0])
            minute = float(dms[1])
            dec = deg + (minute / 60.0)
        elif len(dms) == 1:
            dec = float(dms[0])
        else:
            return None

        if ref and str(ref).strip().upper() in ("S", "W"):
            dec = -abs(dec)
        elif ref and str(ref).strip().upper() in ("N", "E"):
            dec = abs(dec)

        return round(dec, 7)
    except Exception as exc:
        logger.debug("Failed to convert DMS %r with ref %r to decimal: %s", dms, ref, exc)
        return None


def calculate_haversine_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """
    Compute great-circle distance between two GPS coordinates in meters
    using the Haversine formula on a spherical Earth (R = 6,371,000 m).
    Pure CPU arithmetic — zero network or binary library overhead.
    """
    # Guard against invalid lat/lon
    if not (-90.0 <= lat1 <= 90.0 and -90.0 <= lat2 <= 90.0):
        raise ValueError(f"Latitude out of bounds [-90, 90]: lat1={lat1}, lat2={lat2}")
    if not (-180.0 <= lon1 <= 180.0 and -180.0 <= lon2 <= 180.0):
        raise ValueError(f"Longitude out of bounds [-180, 180]: lon1={lon1}, lon2={lon2}")

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    # Clamp 'a' to [0, 1] to prevent domain errors with math.sqrt due to floating-point drift
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(EARTH_RADIUS_METERS * c, 2)


def extract_exif_metadata(image_bytes: bytes) -> Dict[str, Any]:
    """
    Extract EXIF tags, GPS metadata, camera hardware details, and capture timestamps
    from image byte stream using Pillow.
    """
    if not image_bytes:
        raise ValueError("Empty byte stream — no image content provided.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            exif_obj = img.getexif()
    except Exception as exc:
        raise ValueError(f"Input is not a valid or readable image: {exc}") from exc

    if not exif_obj:
        return {
            "has_exif": False,
            "has_gps": False,
            "gps_latitude": None,
            "gps_longitude": None,
            "gps_altitude": None,
            "captured_at": None,
            "camera_make": None,
            "camera_model": None,
            "software": None,
            "raw_gps": {},
            "warning": "No EXIF metadata block found (likely stripped by web upload or chat app).",
        }

    # Extract standard tags (Make, Model, Software, DateTime)
    camera_make = exif_obj.get(ExifTags.Base.Make)
    camera_model = exif_obj.get(ExifTags.Base.Model)
    software = exif_obj.get(ExifTags.Base.Software)
    captured_at = exif_obj.get(ExifTags.Base.DateTimeOriginal) or exif_obj.get(ExifTags.Base.DateTime)

    if camera_make:
        camera_make = str(camera_make).strip()
    if camera_model:
        camera_model = str(camera_model).strip()
    if software:
        software = str(software).strip()
    if captured_at:
        captured_at = str(captured_at).strip()

    # Extract GPS Info IFD (Tag 0x8825)
    gps_ifd = {}
    try:
        if hasattr(ExifTags, "IFD") and hasattr(ExifTags.IFD, "GPSInfo"):
            gps_ifd = exif_obj.get_ifd(ExifTags.IFD.GPSInfo)
    except Exception as exc:
        logger.debug("get_ifd(GPSInfo) failed: %s", exc)

    # Fallback for older PIL or images where GPSInfo is directly in getexif()
    if not gps_ifd:
        raw_gps_val = exif_obj.get(0x8825)
        if isinstance(raw_gps_val, dict):
            gps_ifd = raw_gps_val

    # Map tag IDs to tag names
    mapped_gps: Dict[str, Any] = {}
    for tag_id, val in gps_ifd.items():
        name = ExifTags.GPSTAGS.get(tag_id, str(tag_id))
        mapped_gps[name] = val

    lat_dms = mapped_gps.get("GPSLatitude")
    lat_ref = mapped_gps.get("GPSLatitudeRef")
    lon_dms = mapped_gps.get("GPSLongitude")
    lon_ref = mapped_gps.get("GPSLongitudeRef")
    altitude = mapped_gps.get("GPSAltitude")

    decimal_lat = _dms_to_decimal(lat_dms, lat_ref)
    decimal_lon = _dms_to_decimal(lon_dms, lon_ref)

    decimal_alt = None
    if altitude is not None:
        try:
            decimal_alt = round(float(altitude), 1)
        except Exception:
            pass

    has_gps = decimal_lat is not None and decimal_lon is not None

    # Construct ISO capture date if GPSDateStamp + GPSTimeStamp exist
    if not captured_at and "GPSDateStamp" in mapped_gps and "GPSTimeStamp" in mapped_gps:
        try:
            date_str = str(mapped_gps["GPSDateStamp"]).replace(":", "-")
            h, m, s = mapped_gps["GPSTimeStamp"]
            captured_at = f"{date_str}T{int(h):02d}:{int(m):02d}:{int(s):02d}Z"
        except Exception:
            pass

    return {
        "has_exif": True,
        "has_gps": has_gps,
        "gps_latitude": decimal_lat,
        "gps_longitude": decimal_lon,
        "gps_altitude": decimal_alt,
        "captured_at": captured_at,
        "camera_make": camera_make,
        "camera_model": camera_model,
        "software": software,
        "raw_gps": {k: str(v) for k, v in mapped_gps.items()},
        "warning": None if has_gps else "Image contains EXIF tags but lacks GPS coordinate info.",
    }


def verify_geofence(
    image_bytes: Optional[bytes] = None,
    photo_latitude: Optional[float] = None,
    photo_longitude: Optional[float] = None,
    campus_latitude: float = 0.0,
    campus_longitude: float = 0.0,
    radius_meters: float = DEFAULT_GEOFENCE_RADIUS_METERS,
) -> Dict[str, Any]:
    """
    Verify whether an infrastructure photo was captured within the campus boundary.
    Coordinates can be provided directly or extracted from raw image_bytes.

    Returns dict matching GeofenceVerifyResponse schema.
    """
    captured_at: Optional[str] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    metadata_warning: Optional[str] = None

    # 1. If image bytes provided, extract EXIF first
    if image_bytes is not None and len(image_bytes) > 0:
        meta = extract_exif_metadata(image_bytes)
        captured_at = meta.get("captured_at")
        camera_make = meta.get("camera_make")
        camera_model = meta.get("camera_model")
        metadata_warning = meta.get("warning")

        # Prefer extracted coordinates if not explicitly passed
        if photo_latitude is None:
            photo_latitude = meta.get("gps_latitude")
        if photo_longitude is None:
            photo_longitude = meta.get("gps_longitude")

    # 2. Case: No GPS coordinates available
    if photo_latitude is None or photo_longitude is None:
        logger.info("Geofence evaluation: NO_GPS_DATA")
        return {
            "geofence_status": GeofenceStatus.NO_GPS_DATA.value,
            "status": GeofenceStatus.NO_GPS_DATA.value,
            "distance_from_campus": None,
            "distance_meters": None,
            "is_within_campus": False,
            "radius_meters": radius_meters,
            "photo_latitude": None,
            "photo_longitude": None,
            "campus_latitude": campus_latitude,
            "campus_longitude": campus_longitude,
            "captured_at": captured_at,
            "camera_make": camera_make,
            "camera_model": camera_model,
            "verdict_message": (
                "Photo lacks embedded GPS metadata. Unable to verify on-campus presence. "
                "AICTE mandates original geotagged camera photos with location services enabled."
            ),
            "flag_level": "MEDIUM",
            "method_version": "exif-haversine-v1",
        }

    # 3. Compute Haversine distance
    distance_meters = calculate_haversine_distance(
        lat1=photo_latitude,
        lon1=photo_longitude,
        lat2=campus_latitude,
        lon2=campus_longitude,
    )

    is_within = distance_meters <= radius_meters

    if is_within:
        status_val = GeofenceStatus.PASS.value
        flag = "NONE"
        verdict = (
            f"Photo verified on-campus: captured {distance_meters:.1f}m from registered campus center "
            f"(allowed radius: {radius_meters:.0f}m)."
        )
    else:
        status_val = GeofenceStatus.FAIL.value
        flag = "HIGH"
        dist_km = distance_meters / 1000.0
        verdict = (
            f"GEO-FENCE FRAUD ALERT: Photo was taken {dist_km:.2f} km ({distance_meters:.0f}m) away from "
            f"the approved AICTE campus coordinates (allowed radius: {radius_meters:.0f}m). "
            f"Photo location rejected as OFF_CAMPUS_GEO_VIOLATION."
        )

    logger.info(
        "Geofence evaluation: status=%s, distance=%.1fm, radius=%.0fm, is_within=%s",
        status_val,
        distance_meters,
        radius_meters,
        is_within,
    )

    return {
        "geofence_status": status_val,
        "status": status_val,
        "distance_from_campus": distance_meters,
        "distance_meters": distance_meters,
        "is_within_campus": is_within,
        "radius_meters": radius_meters,
        "photo_latitude": photo_latitude,
        "photo_longitude": photo_longitude,
        "campus_latitude": campus_latitude,
        "campus_longitude": campus_longitude,
        "captured_at": captured_at,
        "camera_make": camera_make,
        "camera_model": camera_model,
        "verdict_message": verdict,
        "flag_level": flag,
        "method_version": "exif-haversine-v1",
    }


# =============================================================================
#  Self-Test Suite
# =============================================================================
if __name__ == "__main__":
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    print("\n" + "=" * 70)
    print("  OneCheck - Engine 4: 500m Geo-Fence EXIF Spatial Engine - Self-Tests")
    print("=" * 70)

    # Helper: create in-memory JPEG with custom EXIF GPS data
    def make_test_photo(
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        date_str: str = "2026:03:15 10:30:00",
        make: str = "Samsung",
        model: str = "Galaxy S23",
    ) -> bytes:
        img = Image.new("RGB", (200, 200), color=(100, 150, 200))
        exif = img.getexif()
        exif[ExifTags.Base.Make] = make
        exif[ExifTags.Base.Model] = model
        exif[ExifTags.Base.DateTimeOriginal] = date_str

        if lat is not None and lon is not None:
            gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
            lat_ref = "N" if lat >= 0 else "S"
            lon_ref = "E" if lon >= 0 else "W"
            abs_lat = abs(lat)
            abs_lon = abs(lon)
            gps_ifd[1] = lat_ref
            gps_ifd[2] = (int(abs_lat), int((abs_lat % 1) * 60), round(((abs_lat % 1) * 60 % 1) * 60, 4))
            gps_ifd[3] = lon_ref
            gps_ifd[4] = (int(abs_lon), int((abs_lon % 1) * 60), round(((abs_lon % 1) * 60 % 1) * 60, 4))

        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif)
        return buf.getvalue()

    # -- Test 1: EXIF GPS Extraction -----------------------------------------
    sample_bytes = make_test_photo(lat=28.4595, lon=77.0266)
    meta = extract_exif_metadata(sample_bytes)
    print("\n[OK] Test 1 - EXIF Extraction:")
    print(f"   Has EXIF:     {meta['has_exif']}")
    print(f"   Has GPS:      {meta['has_gps']}")
    print(f"   Latitude:     {meta['gps_latitude']}")
    print(f"   Longitude:    {meta['gps_longitude']}")
    print(f"   Camera:       {meta['camera_make']} {meta['camera_model']}")
    print(f"   Captured At:  {meta['captured_at']}")
    assert meta["has_gps"] is True
    assert abs(meta["gps_latitude"] - 28.4595) < 0.001
    assert abs(meta["gps_longitude"] - 77.0266) < 0.001
    print("   -> PASSED")

    # -- Test 2: On-Campus Photo (PASS, distance < 500m) ---------------------
    # Photo is ~45m from campus center
    campus_lat, campus_lon = 28.4595, 77.0266
    on_campus_bytes = make_test_photo(lat=28.4598, lon=77.0269)
    res_on = verify_geofence(
        image_bytes=on_campus_bytes,
        campus_latitude=campus_lat,
        campus_longitude=campus_lon,
    )
    print("\n[OK] Test 2 - On-Campus Photo (PASS):")
    print(f"   Status:    {res_on['geofence_status']}")
    print(f"   Distance:  {res_on['distance_from_campus']:.1f} m")
    print(f"   Verdict:   {res_on['verdict_message']}")
    assert res_on["geofence_status"] == "PASS"
    assert res_on["is_within_campus"] is True
    assert res_on["distance_from_campus"] < 500.0
    print("   -> PASSED")

    # -- Test 3: Off-Campus Photo — Apex Institute Benchmark Case ------------
    # Photo taken in Central Delhi (28.6139, 77.2090), Campus is in Gurugram (28.4595, 77.0266)
    apex_bytes = make_test_photo(lat=28.6139, lon=77.2090)
    res_apex = verify_geofence(
        image_bytes=apex_bytes,
        campus_latitude=campus_lat,
        campus_longitude=campus_lon,
    )
    print("\n[ALERT] Test 3 - Apex Institute Fraud Benchmark (FAIL):")
    print(f"   Status:    {res_apex['geofence_status']}")
    print(f"   Distance:  {res_apex['distance_from_campus'] / 1000.0:.2f} km")
    print(f"   Verdict:   {res_apex['verdict_message']}")
    assert res_apex["geofence_status"] == "FAIL"
    assert res_apex["is_within_campus"] is False
    assert res_apex["distance_from_campus"] > 20000.0   # > 20 km away
    assert res_apex["flag_level"] == "HIGH"
    print("   -> PASSED (Off-campus photo correctly flagged as fraud)")

    # -- Test 4: Photo with NO GPS (Stripped or Stock Image) -----------------
    no_gps_bytes = make_test_photo(lat=None, lon=None)
    res_no_gps = verify_geofence(
        image_bytes=no_gps_bytes,
        campus_latitude=campus_lat,
        campus_longitude=campus_lon,
    )
    print("\n[GUARD] Test 4 - Photo without GPS Data (NO_GPS_DATA):")
    print(f"   Status:    {res_no_gps['geofence_status']}")
    print(f"   Distance:  {res_no_gps['distance_from_campus']}")
    print(f"   Verdict:   {res_no_gps['verdict_message']}")
    assert res_no_gps["geofence_status"] == "NO_GPS_DATA"
    assert res_no_gps["is_within_campus"] is False
    assert res_no_gps["distance_from_campus"] is None
    print("   -> PASSED (Correctly labeled NO_GPS_DATA)")

    # -- Test 5: Direct Coordinate Input (No Image Bytes) -------------------
    res_direct = verify_geofence(
        photo_latitude=28.4596,
        photo_longitude=77.0267,
        campus_latitude=campus_lat,
        campus_longitude=campus_lon,
        radius_meters=500.0,
    )
    print("\n[OK] Test 5 - Direct Coordinate Input:")
    print(f"   Status:    {res_direct['geofence_status']}")
    print(f"   Distance:  {res_direct['distance_from_campus']:.1f} m")
    assert res_direct["geofence_status"] == "PASS"
    print("   -> PASSED")

    # -- Test 6: Haversine Microsecond Benchmark ----------------------------
    import time
    t0 = time.perf_counter()
    for _ in range(1000):
        calculate_haversine_distance(28.4595, 77.0266, 28.6139, 77.2090)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    print(f"\n[BENCHMARK] Test 6 - Haversine 1,000 iterations: {elapsed_ms:.2f} ms ({elapsed_ms/1000.0*1000:.3f} us/call)")
    assert elapsed_ms < 50.0  # Must be under 50ms for 1000 calls (< 0.05ms per call)
    print("   -> PASSED (Sub-millisecond latency confirmed)")

    print("\n" + "=" * 70)
    print("  All 6 Engine 4 (Geo-Fence EXIF) self-tests PASSED [OK]")
    print("=" * 70 + "\n")
