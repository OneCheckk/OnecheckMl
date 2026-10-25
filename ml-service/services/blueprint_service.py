"""
Engine 8: The Blueprint Architect (Multimodal Blueprint Vision Engine)
Part of OneCheck 8-Engine ML & Forensics Architecture (AICTE SIH 2025)

Analyzes architectural blueprints (naksha) to extract room labels, dimensions, and carpet areas.
Uses Gemini Vision API with deterministic offline Computer Vision fallback.
"""

import os
import re
import json
import shutil
from typing import Dict, Any, List, Optional
import numpy as np
from PIL import Image

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

_KNOWN_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Users\krish\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
]


class BlueprintEngine:
    """
    Solves the problem where traditional OCR fails on architectural CAD drawings/blueprints.
    Extracts structured room dimensions, square meters, and checks AICTE instructional norms.
    """

    def __init__(self, gemini_api_key: Optional[str] = None):
        self.api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        self.client = None
        if HAS_GENAI and self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception:
                self.client = None

    def analyze_blueprint(
        self,
        file_path: str,
        claimed_computer_lab_sqm: float = 640.0,
    ) -> Dict[str, Any]:
        """
        Analyzes blueprint image/PDF to extract instructional rooms and compare against claimed areas.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # If Gemini Client is configured, call Gemini 1.5/2.0 Flash Vision
        if self.client:
            try:
                return self._analyze_with_gemini(file_path, claimed_computer_lab_sqm)
            except Exception as e:
                pass

        # Offline Deterministic Heuristic Vision Mode
        return self._analyze_offline_heuristic(file_path, claimed_computer_lab_sqm)

    def _analyze_with_gemini(self, file_path: str, claimed_lab_sqm: float) -> Dict[str, Any]:
        prompt = """
        You are a specialized AICTE Civil Engineering Architectural Blueprint Auditor.
        Analyze this technical education building floor plan image.
        Extract all rooms, laboratories, and instructional spaces.
        Return ONLY a clean JSON object with this exact structure:
        {
          "rooms": [
            {
              "room_number": "101",
              "label": "Central Computer Center",
              "dimensions_meters": "20.5m x 20.0m",
              "area_sqm": 410.0
            }
          ],
          "total_instructional_area_sqm": 410.0,
          "architect_registration": "CA/2018/74199"
        }
        """
        img = Image.open(file_path)
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[img, prompt],
        )
        text = response.text.strip()
        clean_json_str = re.sub(r"^```json\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
        parsed = json.loads(clean_json_str)

        return self._format_blueprint_output(parsed, claimed_lab_sqm, method="Gemini 2.5 Flash Vision")

    @staticmethod
    def preprocess_image(pil_image: Image.Image) -> np.ndarray:
        """Grayscale -> upscale small scans -> Otsu threshold (with OpenCV if present, else PIL)."""
        try:
            import cv2
            arr = np.array(pil_image.convert("RGB"))
            gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
            if gray.shape[1] < 1200:
                scale = 1200 / gray.shape[1]
                gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21) if gray.size < 4_000_000 else gray
            _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            return thresh
        except ImportError:
            # Pure PIL fallback: grayscale + auto-contrast + point threshold
            from PIL import ImageOps
            gray = ImageOps.grayscale(pil_image)
            if gray.width < 1200:
                scale = 1200 / gray.width
                gray = gray.resize((int(gray.width * scale), int(gray.height * scale)), Image.Resampling.BICUBIC)
            return np.array(gray.point(lambda p: 255 if p > 140 else 0, mode="1"))

    def _analyze_offline_heuristic(self, file_path: str, claimed_lab_sqm: float) -> Dict[str, Any]:
        """
        Deterministic offline Computer Vision parsing when Gemini API is unavailable or disabled.
        Uses Tesseract OCR layout analysis to extract room legends and area dimensions.
        """
        try:
            import pytesseract

            if not shutil.which("tesseract"):
                for p in _KNOWN_TESSERACT_PATHS:
                    if os.path.exists(p):
                        pytesseract.pytesseract.tesseract_cmd = p
                        break

            if file_path.lower().endswith(".pdf"):
                from pdf2image import convert_from_path
                img = convert_from_path(file_path, first_page=1, last_page=1)[0]
            else:
                img = Image.open(file_path)

            # Try direct OCR first (preserves clean line flow and room associations)
            text = pytesseract.image_to_string(img)
            rooms = self._parse_rooms(text)
            if not rooms:
                text = pytesseract.image_to_string(self.preprocess_image(img), config="--psm 3")
                rooms = self._parse_rooms(text)
        except Exception as e:
            return {
                "status": "ERROR",
                "verdict": "MANUAL_REVIEW_REQUIRED",
                "engine_method": "Tesseract OCR layout parse (offline)",
                "message": f"Could not OCR blueprint: {e}",
            }

        arch = re.search(r"(CA\s*/\s*\d{4}\s*/\s*\d+)", text, re.I)
        parsed = {
            "rooms": rooms,
            "architect_registration": arch.group(1).replace(" ", "") if arch else None,
        }
        return self._format_blueprint_output(parsed, claimed_lab_sqm, method="Tesseract OCR layout parse (offline)")

    @staticmethod
    def _parse_rooms(ocr_text: str) -> List[Dict[str, Any]]:
        """
        Heuristic regex parser for CAD floor plan schedules.
        Matches lines like:
           - "Room 101 - Central Computer Lab - 20.5m x 20.0m (410 sq.m)"
           - "Lab 2: 15.0 x 10.0 = 150 sqm"
           - "Computer Center : 410.0 sq.m"
        """
        rooms = []
        lines = [line.strip() for line in ocr_text.split("\n") if line.strip()]

        area_pattern = re.compile(
            r"(\b\d{1,4}(?:\.\d+)?)\s*(?:sq\.?\s*m(?:eter)?s?|sqm|m\^?2|m2)\b",
            re.IGNORECASE,
        )
        dim_pattern = re.compile(
            r"(\d{1,3}(?:\.\d+)?)\s*[m\s]*[xX*]\s*(\d{1,3}(?:\.\d+)?)\s*m?",
            re.IGNORECASE,
        )

        for line in lines:
            area_match = area_pattern.search(line)
            dim_match = dim_pattern.search(line)

            if area_match:
                area_sqm = float(area_match.group(1))
            elif dim_match:
                w, h = float(dim_match.group(1)), float(dim_match.group(2))
                area_sqm = round(w * h, 2)
            else:
                continue

            # Skip trivially small (e.g. toilet 4 sq.m) or absurdly large numbers
            if area_sqm < 10.0 or area_sqm > 5000.0:
                continue

            # Identify if this room is instructional / lab
            is_lab = bool(
                re.search(
                    r"(lab|computer|instruction|classroom|seminar|drawing|workshop|library)",
                    line,
                    re.IGNORECASE,
                )
            )

            clean_label = re.sub(
                r"(\b\d{1,4}(?:\.\d+)?\s*(?:sq\.?\s*m|sqm|m2))|(\d+\.?\d*\s*[xX]\s*\d+\.?\d*)",
                "",
                line,
            ).strip(" -:|,")
            clean_label = clean_label if len(clean_label) > 3 else "Instructional Space"

            rooms.append({
                "label": clean_label,
                "area_sqm": area_sqm,
                "is_instructional": is_lab,
                "dimensions": dim_match.group(0) if dim_match else None,
                "raw_text": line,
            })

        return rooms

    def _format_blueprint_output(
        self,
        parsed_data: Dict[str, Any],
        claimed_lab_sqm: float,
        method: str,
    ) -> Dict[str, Any]:
        rooms = parsed_data.get("rooms", [])

        # Sum computer lab areas
        lab_rooms = [
            r for r in rooms
            if any(term in r.get("label", "").lower() for term in ["computer", "lab", "it center"])
        ]

        if lab_rooms:
            extracted_lab_sqm = sum(r.get("area_sqm", 0.0) for r in lab_rooms)
        else:
            extracted_lab_sqm = sum(r.get("area_sqm", 0.0) for r in rooms)

        discrepancy_sqm = claimed_lab_sqm - extracted_lab_sqm
        # AICTE allows max 5% measurement tolerance on blueprint cadastrals
        tolerance_sqm = 0.05 * claimed_lab_sqm
        has_deficit = discrepancy_sqm > tolerance_sqm

        if has_deficit:
            verdict = "MISMATCH_DETECTED"
            message = (
                f"INSTRUCTIONAL AREA DEFICIT: Claimed {claimed_lab_sqm} sq.m in application, "
                f"but extracted only {extracted_lab_sqm} sq.m from blueprint CAD drawings. "
                f"Deficit of {round(discrepancy_sqm, 2)} sq.m violates AICTE APH 2025-26 Norms."
            )
        else:
            verdict = "VERIFIED"
            message = (
                f"Floor area verified: Extracted {extracted_lab_sqm} sq.m meets or exceeds "
                f"claimed capacity of {claimed_lab_sqm} sq.m."
            )

        return {
            "status": "SUCCESS",
            "verdict": verdict,
            "engine_method": method,
            "claimed_lab_sqm": claimed_lab_sqm,
            "extracted_lab_sqm": extracted_lab_sqm,
            "deficit_sqm": max(0.0, round(discrepancy_sqm, 2)),
            "tolerance_sqm": round(tolerance_sqm, 2),
            "total_instructional_rooms_found": len(rooms),
            "rooms": rooms,
            "architect_registration": parsed_data.get("architect_registration"),
            "message": message,
        }
