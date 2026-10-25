"""
Engine 8: The Blueprint Architect (Multimodal Blueprint Vision Engine)
Part of OneCheck 8-Engine ML & Forensics Architecture (SIH 2025)
Analyzes architectural blueprints (naksha) to extract room labels, dimensions, and carpet areas.
Uses Gemini Vision API with deterministic offline Computer Vision fallback.
"""
import os
import re
import json
from typing import Dict, Any, List, Optional
import numpy as np
from PIL import Image

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


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
        claimed_computer_lab_sqm: float = 640.0
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
                print(f"[BlueprintEngine] Gemini failed ({e}); using offline OCR parse")

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
            model='gemini-2.5-flash',
            contents=[img, prompt]
        )
        text = response.text.strip()
        # Clean markdown formatting if present
        clean_json_str = re.sub(r'^```json\s*|\s*```$', '', text, flags=re.MULTILINE).strip()
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
            gray = pil_image.convert("L")
            if gray.width < 1200:
                scale = 1200 / gray.width
                gray = gray.resize((int(gray.width * scale), int(gray.height * scale)), Image.Resampling.LANCZOS)
            return np.array(gray)

    def _analyze_offline_heuristic(self, file_path: str, claimed_lab_sqm: float) -> Dict[str, Any]:
        """
        Offline mode: REAL Tesseract OCR of the drawing, then parse "ROOM LABEL" lines
        followed by "Area: X sq.m" / "Dimensions: A x B" / "N Workstations" lines.
        Works only for labelled drawings; returns NO_ROOMS_FOUND (never invented numbers)
        when nothing parsable is on the page.
        """
        try:
            import pytesseract
            if file_path.lower().endswith(".pdf"):
                from pdf2image import convert_from_path
                img = convert_from_path(file_path, first_page=1, last_page=1)[0]
            else:
                img = Image.open(file_path)
            text = pytesseract.image_to_string(self.preprocess_image(img), config="--psm 3")
        except Exception as e:
            return {"status": "ERROR", "verdict": "MANUAL_REVIEW_REQUIRED",
                    "engine_method": "Tesseract OCR layout parse (offline)",
                    "message": f"Could not OCR blueprint: {e}"}

        rooms = self._parse_rooms(text)
        arch = re.search(r'(CA\s*/\s*\d{4}\s*/\s*\d+)', text, re.I)
        parsed = {"rooms": rooms, "architect_registration": arch.group(1).replace(" ", "") if arch else None}
        return self._format_blueprint_output(parsed, claimed_lab_sqm, method="Tesseract OCR layout parse (offline)")

    AREA_RE = re.compile(r'(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m(?:eters?)?|sqm)', re.I)
    DIM_RE = re.compile(r'(\d+(?:\.\d+)?)\s*m?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*m', re.I)
    SEAT_RE = re.compile(r'(\d+)\s*(?:work\s*stations?|seats?)', re.I)

    def _parse_rooms(self, text: str) -> List[Dict[str, Any]]:
        rooms: List[Dict[str, Any]] = []
        current: Optional[Dict[str, Any]] = None
        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                continue
            area = self.AREA_RE.search(line)
            dim = self.DIM_RE.search(line)
            seat = self.SEAT_RE.search(line)
            is_room_line = bool(re.search(r'[A-Za-z]{3,}', line) and
                               re.search(r'room|lab|office|server|class|library|hall|workshop|centre|center', line, re.I))

            if is_room_line:
                # If this line is a new room header
                current = {"label": line.title()}
                if area:
                    current["area_sqm"] = float(area.group(1))
                if dim:
                    current["dimensions_meters"] = f"{dim.group(1)}m x {dim.group(2)}m"
                if seat:
                    current["seating_workstations"] = int(seat.group(1))
                rooms.append(current)
            elif current is not None:
                # Supplementary attributes on subsequent lines for the current room
                if area and "area_sqm" not in current:
                    current["area_sqm"] = float(area.group(1))
                if dim and "dimensions_meters" not in current:
                    current["dimensions_meters"] = f"{dim.group(1)}m x {dim.group(2)}m"
                if seat and "seating_workstations" not in current:
                    current["seating_workstations"] = int(seat.group(1))

        return [r for r in rooms if "area_sqm" in r]

    def _format_blueprint_output(self, parsed: Dict[str, Any], claimed_lab_sqm: float, method: str) -> Dict[str, Any]:
        rooms = parsed.get("rooms", [])
        base = {"status": "SUCCESS", "engine_method": method}

        if not rooms:
            return {**base, "status": "NO_ROOMS_FOUND", "verdict": "MANUAL_REVIEW_REQUIRED",
                    "message": "No labelled rooms with areas could be read from this file. "
                               "Is it a floor plan? Use a Gemini key or review manually.",
                    "analysis": {"claimed_lab_area_sqm": claimed_lab_sqm, "detected_rooms": []}}

        lab = next((r for r in rooms if re.search(r'computer|lab', r.get("label", ""), re.I)), None)
        if lab is None:
            return {**base, "verdict": "MANUAL_REVIEW_REQUIRED",
                    "message": "Rooms were read, but none is labelled as a computer/laboratory space.",
                    "analysis": {"claimed_lab_area_sqm": claimed_lab_sqm, "detected_rooms": rooms}}

        extracted = float(lab["area_sqm"])
        notes = []
        dims = re.match(r'([\d.]+)m x ([\d.]+)m', lab.get("dimensions_meters", "") or "")
        if dims:
            product = float(dims.group(1)) * float(dims.group(2))
            if abs(product - extracted) > 0.05 * extracted:
                notes.append(f"Labelled area {extracted} does not match dimensions product {round(product, 1)}.")

        deficit = round(claimed_lab_sqm - extracted, 2)
        shortfall = deficit > 0
        pct = round(deficit / claimed_lab_sqm * 100.0, 1) if claimed_lab_sqm else 0.0
        return {
            **base,
            "verdict": "MISMATCH_DETECTED" if shortfall else "VERIFIED",
            "analysis": {
                "claimed_lab_area_sqm": claimed_lab_sqm,
                "extracted_blueprint_lab_area_sqm": extracted,
                "matched_room": lab.get("label"),
                "deficit_sqm": deficit if shortfall else 0.0,
                "shortfall_percentage": pct if shortfall else 0.0,
                "clause_reference": "APH 2025-26 Section 4.1 (Mandatory Instructional Laboratory Norms)",
                "architect_registration": parsed.get("architect_registration"),
                "consistency_notes": notes,
                "detected_rooms": rooms,
            },
            "alert": (f"CRITICAL: Form claimed {claimed_lab_sqm} sq.m lab, but blueprint certifies only "
                      f"{extracted} sq.m (Shortfall: {deficit} sq.m / -{pct}%)") if shortfall else None,
        }
