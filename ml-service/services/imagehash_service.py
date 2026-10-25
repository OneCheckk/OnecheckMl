"""
OneCheck ML Service — Engine 3: Perceptual Image Hashing
=========================================================
Nickname:   "The Visual Plagiarism Detector"
Purpose:    Detect recycled, stolen, or duplicate infrastructure photographs
            (computer labs, libraries, fire equipment) uploaded across multiple
            AICTE approval applications — even if cropped, resized, recompressed,
            or lightly filtered.
Latency:    ~12 ms  (DCT hashing, pure CPU, NumPy array ops)
RAM:        < 5 MB per analysis

Technical Approach
------------------
Human perception evaluates images holistically. Classical pixel-level matching
(MD5 / SHA256) fails when an image is re-saved at different JPEG quality, cropped
by a few pixels, or passed through Instagram-style filters.

Perceptual hashing converts an image to a compact 64-bit integer fingerprint
that is robust to these benign transformations but still distinct across
fundamentally different images.

Algorithm (pHash / DCT Hash):
1. Resize image to 32x32 px (fast, structure-preserving).
2. Convert to grayscale.
3. Compute 2D Discrete Cosine Transform (DCT).
4. Extract upper-left 8x8 low-frequency coefficients.
5. Threshold each coefficient against the DCT median → 64-bit binary hash.
6. Two images that are visually identical/similar will differ by ≤ 10 bits
   (Hamming distance ≤ 10) even after moderate transformations.

Additional hash types for cross-verification:
- dHash (Difference Hash): detects gradient patterns — more sensitive to scale changes.
- aHash (Average Hash): extremely fast but less robust; good for quick pre-filter.
- wHash (Wavelet Hash): Haar wavelet decomposition — most robust for heavy JPEG artefacts.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Any, Dict, Optional

import imagehash
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Default Hamming distance threshold for declaring a duplicate match
# 64-bit hash: distance 0 = identical, distance 64 = completely different
# Industry standard: ≤ 10 bits → duplicate/recycled photo
_DEFAULT_THRESHOLD = 10
_HASH_BITS = 64


def compute_perceptual_hashes(image_bytes: bytes) -> Dict[str, Any]:
    """
    Compute all four perceptual hash variants for an uploaded image.

    Parameters
    ----------
    image_bytes : bytes
        Raw binary content of the uploaded image (JPEG, PNG, WebP, TIFF, etc.).

    Returns
    -------
    dict
        {
            "phash":        str,   # 64-bit DCT hash (hex)
            "dhash":        str,   # 64-bit Difference hash (hex)
            "ahash":        str,   # 64-bit Average hash (hex)
            "whash":        str,   # 64-bit Wavelet hash (hex)
            "imageHash":    str,   # Node.js verificationClient alias (= dhash)
            "methodVersion": "dhash-v1"   # Node.js verificationClient contract field
        }

    Raises
    ------
    ValueError
        If the byte stream is empty or not a recognizable image format.
    """
    _validate_image_bytes(image_bytes)

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise ValueError(f"Cannot decode image: {exc}") from exc

    try:
        ph = str(imagehash.phash(img))
        dh = str(imagehash.dhash(img))
        ah = str(imagehash.average_hash(img))
        wh = str(imagehash.whash(img))
    except Exception as exc:
        raise RuntimeError(f"Perceptual hash computation failed: {exc}") from exc

    logger.debug(
        "Hashes computed — phash=%s dhash=%s ahash=%s whash=%s", ph, dh, ah, wh
    )

    return {
        "phash":         ph,
        "dhash":         dh,
        "ahash":         ah,
        "whash":         wh,
        # Node.js verificationClient.service.js contract:
        # computePerceptualHash() → { imageHash, methodVersion }
        "imageHash":     dh,
        "methodVersion": "dhash-v1",
    }


def compare_hashes(
    hash1: str,
    hash2: str,
    threshold: int = _DEFAULT_THRESHOLD,
) -> Dict[str, Any]:
    """
    Compare two perceptual hash strings and compute Hamming distance.

    Parameters
    ----------
    hash1 : str
        Hex-string perceptual hash (e.g. from a reference database).
    hash2 : str
        Hex-string perceptual hash of the uploaded image.
    threshold : int, optional
        Hamming distance threshold for duplicate detection (default 10).
        Set lower (e.g. 5) for strict matching, higher (e.g. 15) for loose.

    Returns
    -------
    dict
        {
            "hash1":            str,
            "hash2":            str,
            "hamming_distance": int,      # 0 = identical, 64 = completely different
            "similarity_pct":   float,    # 0.0 to 100.0
            "is_match":         bool,     # True if distance <= threshold
            "verdict":          str,      # "DUPLICATE" | "SIMILAR" | "DIFFERENT"
            "threshold_used":   int
        }

    Raises
    ------
    ValueError
        If hash strings are malformed or of incompatible lengths.
    """
    hash1 = hash1.strip().lower()
    hash2 = hash2.strip().lower()

    if not hash1 or not hash2:
        raise ValueError("Both hash strings must be non-empty.")

    # Compute Hamming distance: XOR the two integers, count set bits
    try:
        distance = bin(int(hash1, 16) ^ int(hash2, 16)).count("1")
    except ValueError as exc:
        raise ValueError(
            f"Invalid hash string(s) — must be lowercase hex digits. Got: {hash1!r}, {hash2!r}"
        ) from exc

    # Normalize to [0.0, 100.0] similarity percentage
    # For 64-bit hashes: similarity = (1 - distance / 64) * 100
    hash_bits = max(len(hash1), len(hash2)) * 4   # hex chars → bits
    similarity_pct = round((1.0 - (distance / hash_bits)) * 100.0, 2)
    is_match = distance <= threshold

    if distance == 0:
        verdict = "EXACT_DUPLICATE"
    elif is_match:
        verdict = "DUPLICATE"
    elif distance <= threshold * 2:
        verdict = "SIMILAR"
    else:
        verdict = "DIFFERENT"

    logger.debug(
        "Hash compare — distance=%d similarity=%.2f%% verdict=%s",
        distance, similarity_pct, verdict,
    )

    return {
        "hash1":            hash1,
        "hash2":            hash2,
        "hamming_distance": distance,
        "similarity_pct":   similarity_pct,
        "is_match":         is_match,
        "verdict":          verdict,
        "threshold_used":   threshold,
    }


# =============================================================================
#  Internal helpers
# =============================================================================

def _validate_image_bytes(image_bytes: bytes) -> None:
    """Raise ValueError for empty or clearly non-image payloads."""
    if not image_bytes:
        raise ValueError("Empty byte stream — no image content received.")
    # Quick magic-byte check for common image formats
    magic = image_bytes[:8]
    known_signatures = [
        b"\xff\xd8\xff",            # JPEG
        b"\x89PNG\r\n\x1a\n",       # PNG
        b"RIFF",                     # WebP (RIFF….WEBP)
        b"II*\x00", b"MM\x00*",     # TIFF (little/big endian)
        b"GIF8",                     # GIF
        b"\x00\x00\x01\x00",        # ICO
        b"BM",                       # BMP
    ]
    if not any(magic.startswith(sig) for sig in known_signatures):
        # Fallback: try Pillow — it handles many exotic formats
        try:
            Image.open(io.BytesIO(image_bytes)).verify()
        except Exception:
            raise ValueError(
                f"Input does not appear to be a valid image. "
                f"Magic bytes: {magic!r}"
            )


# =============================================================================
#  Standalone self-test
# =============================================================================

if __name__ == "__main__":
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)

    print("\n" + "=" * 70)
    print("  OneCheck - Engine 3: Perceptual Image Hashing - Self-Test Suite")
    print("=" * 70)

    # ── Helpers ──────────────────────────────────────────────────────────────
    from PIL import ImageDraw

    def make_jpeg(color: tuple, size: tuple = (300, 300), quality: int = 85) -> bytes:
        buf = io.BytesIO()
        Image.new("RGB", size, color=color).save(buf, format="JPEG", quality=quality)
        return buf.getvalue()

    def make_featured_jpeg(pattern: str, size: tuple = (300, 300), quality: int = 85) -> bytes:
        im = Image.new("RGB", size, color=(245, 245, 245))
        draw = ImageDraw.Draw(im)
        if pattern == "circle":
            draw.ellipse([40, 40, size[0] - 40, size[1] - 40], fill=(20, 60, 220), outline=(0, 0, 0))
            draw.rectangle([80, 80, size[0] - 80, size[1] - 80], fill=(220, 40, 40))
        elif pattern == "stripes":
            for y in range(0, size[1], 25):
                draw.rectangle([0, y, size[0], y + 12], fill=(20, 180, 50))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=quality)
        return buf.getvalue()

    # -- Test 1: Basic hash computation on a clean image --------------------
    img_bytes = make_jpeg((180, 200, 220), size=(400, 300))
    result = compute_perceptual_hashes(img_bytes)
    print("\n[OK] Test 1 - Hash Computation:")
    print(f"   phash:   {result['phash']}")
    print(f"   dhash:   {result['dhash']}")
    print(f"   ahash:   {result['ahash']}")
    print(f"   whash:   {result['whash']}")
    print(f"   imageHash (Node.js contract): {result['imageHash']}")
    print(f"   methodVersion:               {result['methodVersion']}")
    assert len(result["phash"]) == 16, f"Expected 16-char hex, got {len(result['phash'])}"
    assert result["imageHash"] == result["dhash"], "imageHash must match dhash"
    assert result["methodVersion"] == "dhash-v1"
    print("   -> PASSED")

    # -- Test 2: Exact duplicate detection ----------------------------------
    cmp = compare_hashes(result["phash"], result["phash"])
    print("\n[OK] Test 2 - Exact Duplicate Detection:")
    print(f"   Hamming Distance:  {cmp['hamming_distance']}")
    print(f"   Similarity:        {cmp['similarity_pct']}%")
    print(f"   Verdict:           {cmp['verdict']}")
    assert cmp["hamming_distance"] == 0
    assert cmp["similarity_pct"] == 100.0
    assert cmp["verdict"] == "EXACT_DUPLICATE"
    assert cmp["is_match"] is True
    print("   -> PASSED")

    # -- Test 3: Slightly resized version → should still match (duplicate) --
    img_original_bytes = make_featured_jpeg("circle", size=(400, 300), quality=90)
    img_resized_bytes = make_featured_jpeg("circle", size=(410, 308), quality=85)
    hashes_orig = compute_perceptual_hashes(img_original_bytes)
    hashes_resized = compute_perceptual_hashes(img_resized_bytes)
    cmp_resize = compare_hashes(hashes_orig["phash"], hashes_resized["phash"])
    print("\n[OK] Test 3 - Resized Same Image (Should Match):")
    print(f"   Hamming Distance:  {cmp_resize['hamming_distance']}")
    print(f"   Similarity:        {cmp_resize['similarity_pct']}%")
    print(f"   Verdict:           {cmp_resize['verdict']}")
    assert cmp_resize["is_match"] is True, (
        f"Same image at different size should match (distance={cmp_resize['hamming_distance']})"
    )
    print("   -> PASSED (Robust to resize)")

    # -- Test 4: Completely different images → should NOT match --------------
    img_a_bytes = make_featured_jpeg("circle", size=(300, 300), quality=85)
    img_b_bytes = make_featured_jpeg("stripes", size=(300, 300), quality=85)
    hashes_a = compute_perceptual_hashes(img_a_bytes)
    hashes_b = compute_perceptual_hashes(img_b_bytes)
    cmp_diff = compare_hashes(hashes_a["phash"], hashes_b["phash"])
    print("\n[ALERT] Test 4 - Different Images (Should NOT Match):")
    print(f"   Hamming Distance:  {cmp_diff['hamming_distance']}")
    print(f"   Similarity:        {cmp_diff['similarity_pct']}%")
    print(f"   Verdict:           {cmp_diff['verdict']}")
    assert cmp_diff["is_match"] is False, (
        f"Completely different images must not match (distance={cmp_diff['hamming_distance']})"
    )
    print("   -> PASSED (Different images correctly rejected)")

    # -- Test 5: Error guard — empty input ----------------------------------
    print("\n[GUARD] Test 5 - Empty Input Rejection:")
    try:
        compute_perceptual_hashes(b"")
        print("   -> FAILED (should have raised ValueError)")
        sys.exit(1)
    except ValueError as exc:
        print(f"   -> PASSED (ValueError: {exc})")

    # -- Test 6: Error guard — non-image input ------------------------------
    print("\n[GUARD] Test 6 - Non-Image Input Rejection:")
    try:
        compute_perceptual_hashes(b"This is definitely not an image file at all.")
        print("   -> FAILED (should have raised ValueError)")
        sys.exit(1)
    except ValueError as exc:
        print(f"   -> PASSED (ValueError: {exc})")

    # -- Test 7: compare_hashes malformed input -----------------------------
    print("\n[GUARD] Test 7 - Malformed Hash Comparison:")
    try:
        compare_hashes("not-a-valid-hex", "0000000000000000")
        print("   -> FAILED (should have raised ValueError)")
        sys.exit(1)
    except ValueError as exc:
        print(f"   -> PASSED (ValueError: {exc})")

    # -- Test 8: Node.js verificationClient contract fields -----------------
    print("\n[OK] Test 8 - Node.js Backend Contract Compliance:")
    assert "imageHash" in result, "imageHash field missing"
    assert "methodVersion" in result, "methodVersion field missing"
    assert result["methodVersion"] == "dhash-v1"
    print(f"   imageHash:     {result['imageHash']}")
    print(f"   methodVersion: {result['methodVersion']}")
    print("   -> PASSED")

    print("\n" + "=" * 70)
    print("  All 8 Engine 3 (Perceptual Hash) self-tests PASSED [OK]")
    print("=" * 70 + "\n")
