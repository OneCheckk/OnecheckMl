"""
OneCheck ML Service — Engine 2: Error Level Analysis (ELA) Tamper Heatmap
========================================================================
Nickname:   "The Tamper Heatmap"
Purpose:    Detect localized digital image tampering (pasted stamps, altered text,
            forged signatures, spliced seals) on certificates and infrastructure photos.
Latency:    ~160 ms (NumPy array operations + PIL in-memory JPEG cycle)
RAM:        < 30 MB per analysis (CPU-only, zero GPU required)

Technical Approach
------------------
JPEG compression is lossy and operates on 8x8 pixel discrete cosine transform (DCT)
blocks. When an image is saved as a JPEG at a specific quality (e.g. 85%), all blocks
reach a uniform compression error equilibrium.

If an attacker pastes an external element (a signature, a high-resolution seal, or
modified numerical digits) and re-saves the image:
1. The untouched background re-compresses with minimal error (already quantized).
2. The newly introduced foreign elements compress with a 5x-10x higher error delta
   because their high frequencies have not yet been quantized at this compression level.

Algorithm:
1. Open original image and convert to RGB.
2. In-memory re-compression at target quality (default 90%).
3. Compute pixel-wise absolute difference: diff = |original - recompressed|.
4. Amplify difference 10x for visual inspection heatmap.
5. Statistical thresholding & connected-component bounding box detection via SciPy.
6. Return standardized risk score, tampered bounding boxes, and base64 heatmap PNG.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image
from scipy import ndimage

logger = logging.getLogger(__name__)

# Minimum pixel area for a high-error blob to be flagged as a tampered region
_MIN_REGION_PIXELS = 40
# Maximum number of bounding box regions returned to avoid JSON bloat
_MAX_REGIONS_RETURNED = 12


def generate_ela_heatmap(
    image_bytes: bytes,
    quality: int = 90,
    amplification: float = 10.0,
) -> Dict[str, Any]:
    """
    Execute Error Level Analysis on image bytes.

    Parameters
    ----------
    image_bytes : bytes
        Raw binary bytes of the uploaded image (JPEG, PNG, WebP, etc.).
    quality : int, optional
        JPEG re-compression quality level, between 50 and 100 (default 90).
    amplification : float, optional
        Multiplier for visual heatmap brightness (default 10.0).

    Returns
    -------
    dict
        Structured result matching both OneCheck schemas and Node.js backend contract:
        - suspicion_score (0.0 to 100.0)
        - is_tampered (bool)
        - tampered_regions (list of dicts: x, y, width, height, confidence)
        - heatmap_base64 (str, PNG base64)
        - score (0.0 to 1.0, Node.js backend alias)
        - suspected (bool, Node.js backend alias)
        - regions (list of dicts, Node.js backend alias)
        - method_version ("ela-v1")
    """
    # 1. Validate input bytes
    if not image_bytes:
        raise ValueError("Empty image byte stream received.")

    try:
        original = Image.open(io.BytesIO(image_bytes))
        original_format = original.format or "UNKNOWN"
        # Convert any color model (RGBA, Grayscale, CMYK, Palette) to standard RGB
        original = original.convert("RGB")
    except Exception as exc:
        raise ValueError(f"Failed to decode image content: {exc}") from exc

    width, height = original.size
    if width < 16 or height < 16:
        raise ValueError(f"Image dimensions ({width}x{height}) are too small for ELA analysis.")

    # 2. In-memory JPEG recompression at target quality
    buf = io.BytesIO()
    original.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    recompressed = Image.open(buf).convert("RGB")

    # 3. Calculate absolute difference matrix
    orig_arr = np.array(original, dtype=np.float32)
    recomp_arr = np.array(recompressed, dtype=np.float32)
    diff = np.abs(orig_arr - recomp_arr)

    # 4. Generate amplified visual heatmap
    ela_amplified = (diff * amplification).clip(0, 255).astype(np.uint8)

    # 5. Statistical analysis across channels
    # gray_diff measures mean luminance error per pixel
    gray_diff = np.mean(diff, axis=2)
    mean_val = float(np.mean(gray_diff))
    std_val = float(np.std(gray_diff))
    max_val = float(np.max(gray_diff))

    # Adaptive threshold: 96th percentile or mean + 2.5 standard deviations
    percentile_96 = float(np.percentile(gray_diff, 96))
    adaptive_threshold = max(percentile_96, mean_val + 2.2 * std_val, 10.0)

    # 6. Connected Component Analysis for high-delta anomalies
    suspicious_mask = gray_diff > adaptive_threshold
    tampered_regions: List[Dict[str, Any]] = []

    if suspicious_mask.any():
        # Morphological dilation merges adjacent high-delta strokes (e.g. stamp ink, signature lines)
        dilated_mask = ndimage.binary_dilation(suspicious_mask, iterations=3)
        labeled, num_features = ndimage.label(dilated_mask)
        # Sort features by pixel count descending to focus on the largest clusters
        sizes = ndimage.sum(dilated_mask, labeled, range(1, num_features + 1))
        # Ensure sizes is an array
        sizes = np.atleast_1d(sizes)
        sorted_indices = np.argsort(-sizes)

        for rank, idx in enumerate(sorted_indices):
            feature_id = int(idx + 1)
            pixel_count = float(sizes[idx])
            if pixel_count < _MIN_REGION_PIXELS:
                continue

            r = np.where(labeled == feature_id)
            min_y, max_y = int(r[0].min()), int(r[0].max())
            min_x, max_x = int(r[1].min()), int(r[1].max())

            region_mean_delta = float(gray_diff[labeled == feature_id].mean())
            # Confidence is normalized relative to adaptive threshold
            confidence = min(0.99, round(region_mean_delta / (adaptive_threshold + 1e-4) * 0.7, 2))

            tampered_regions.append({
                "x": min_x,
                "y": min_y,
                "width": max_x - min_x + 1,
                "height": max_y - min_y + 1,
                "confidence": confidence,
            })

            if len(tampered_regions) >= _MAX_REGIONS_RETURNED:
                break

    # 7. Compute normalized suspicion score (0.0 to 100.0)
    # Background baseline noise for a uniform JPEG is typically mean_val < 3.0
    # Spliced regions elevate both mean error, variance, and cluster presence
    base_score = min(50.0, mean_val * 6.5)
    variance_penalty = min(25.0, std_val * 3.5)
    region_penalty = min(25.0, len(tampered_regions) * 8.0)

    suspicion_score = min(100.0, round(base_score + variance_penalty + region_penalty, 1))
    
    # Tampering verdict: high suspicion score AND significant localized anomalies
    is_tampered = bool(suspicion_score >= 40.0 and len(tampered_regions) > 0)

    # 8. Render amplified heatmap to PNG base64
    heatmap_buf = io.BytesIO()
    Image.fromarray(ela_amplified).save(heatmap_buf, format="PNG")
    heatmap_base64 = base64.b64encode(heatmap_buf.getvalue()).decode("ascii")

    normalized_score = round(suspicion_score / 100.0, 4)

    return {
        "suspicion_score": suspicion_score,
        "is_tampered": is_tampered,
        "tampered_regions": tampered_regions,
        "heatmap_base64": heatmap_base64,
        # Node.js verificationClient contract aliases
        "score": normalized_score,
        "suspected": is_tampered,
        "regions": tampered_regions,
        "method_version": "ela-v1",
        "methodVersion": "ela-v1",
    }


# =============================================================================
#  Standalone self-test
# =============================================================================

if __name__ == "__main__":
    import json
    import sys

    # Ensure UTF-8 output on Windows consoles if supported
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    print("\n" + "=" * 70)
    print("  OneCheck - Engine 2: ELA Tamper Heatmap - Self-Test Suite")
    print("=" * 70)

    # -- Test 1: Clean uniform JPEG (consistently compressed) ----------------
    # Create a uniform gradient background and save once as JPEG (quality 75)
    img_clean = Image.new("RGB", (300, 200), color=(240, 240, 245))
    clean_buf = io.BytesIO()
    img_clean.save(clean_buf, format="JPEG", quality=75)
    clean_bytes = clean_buf.getvalue()

    result_clean = generate_ela_heatmap(clean_bytes)
    print("\n[OK] Test 1 - Clean Uniform JPEG:")
    print(f"   Suspicion Score: {result_clean['suspicion_score']}")
    print(f"   Is Tampered:     {result_clean['is_tampered']}")
    print(f"   Regions Count:   {len(result_clean['tampered_regions'])}")
    assert result_clean["is_tampered"] is False, "Expected clean image not flagged as tampered"
    assert result_clean["suspected"] is False
    assert len(result_clean["tampered_regions"]) == 0
    print("   -> PASSED")

    # -- Test 2: Spliced / Tampered Image -----------------------------------
    # Take the clean JPEG and splice an uncompressed high-frequency stamp block onto it
    tampered_img = Image.open(io.BytesIO(clean_bytes)).convert("RGB")
    tampered_arr = np.array(tampered_img)
    # Paste a high-contrast high-frequency pattern into region [50:110, 80:160]
    for y in range(50, 110):
        for x in range(80, 160):
            if (x // 4 + y // 4) % 2 == 0:
                tampered_arr[y, x] = [10, 10, 180]   # dark blue ink stamp
            else:
                tampered_arr[y, x] = [210, 20, 20]   # red seal ink

    spliced_buf = io.BytesIO()
    # Save as PNG to preserve pristine uncompressed splice edge
    Image.fromarray(tampered_arr).save(spliced_buf, format="PNG")
    spliced_bytes = spliced_buf.getvalue()

    result_spliced = generate_ela_heatmap(spliced_bytes)
    print("\n[ALERT] Test 2 - Spliced Tampered Image:")
    print(f"   Suspicion Score: {result_spliced['suspicion_score']}")
    print(f"   Is Tampered:     {result_spliced['is_tampered']}")
    print(f"   Regions Count:   {len(result_spliced['tampered_regions'])}")
    print(f"   First Region:    {result_spliced['tampered_regions'][0] if result_spliced['tampered_regions'] else None}")
    assert result_spliced["is_tampered"] is True, "Expected tampered image to be flagged"
    assert result_spliced["suspected"] is True
    assert len(result_spliced["tampered_regions"]) > 0, "Expected at least 1 tampered region"
    # Verify bounding box encompasses the spliced region [80..160, 50..110]
    reg = result_spliced["tampered_regions"][0]
    assert reg["x"] <= 85 and (reg["x"] + reg["width"]) >= 150
    assert reg["y"] <= 55 and (reg["y"] + reg["height"]) >= 105
    print("   -> PASSED (Tampered bounding box accurately localized)")

    # -- Test 3: Heatmap Base64 Validation -----------------------------------
    print("\n[OK] Test 3 - Heatmap Base64 Validation:")
    assert len(result_spliced["heatmap_base64"]) > 100
    # Ensure it decodes to a valid PNG
    decoded_png = base64.b64decode(result_spliced["heatmap_base64"])
    assert decoded_png[:8] == b"\x89PNG\r\n\x1a\n", "Heatmap must be a valid PNG"
    print("   -> PASSED (Heatmap is valid PNG base64)")

    # -- Test 4: Corrupted / Empty Input Guard -------------------------------
    print("\n[GUARD] Test 4 - Error Guards:")
    try:
        generate_ela_heatmap(b"")
        print("   -> FAILED (should have raised ValueError on empty bytes)")
        sys.exit(1)
    except ValueError as exc:
        print(f"   -> PASSED empty input guard ({exc})")

    try:
        generate_ela_heatmap(b"not an image binary header")
        print("   -> FAILED (should have raised ValueError on invalid bytes)")
        sys.exit(1)
    except ValueError as exc:
        print(f"   -> PASSED invalid image guard ({exc})")

    print("\n" + "=" * 70)
    print("  All 4 Engine 2 (ELA) self-tests PASSED [OK]")
    print("=" * 70 + "\n")
