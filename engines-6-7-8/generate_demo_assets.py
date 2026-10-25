"""
OneCheck — Demo Assets Generator for Apex Institute of Technology
Generates synthetic, realistic test files for Scrutiny Engines 6, 7 & 8:
1. Architectural Floor Plan Blueprint (Computer lab area: 410.0 sq.m vs claimed 640.0 sq.m)
2. Fire Safety NOC (with dates: Issue 16/05/2022, Expiry 15/05/2025)
3. JSON Application Payload, AICTE Database Record, and Faculty Rosters
"""
import os
import json
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_assets")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def get_default_font(size=18):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        return ImageFont.load_default()


def get_bold_font(size=22):
    try:
        return ImageFont.truetype("arialbd.ttf", size)
    except Exception:
        return ImageFont.load_default()


# 1. GENERATE FLOOR PLAN BLUEPRINT (Engine 8: 410 sqm vs 640 sqm claimed)
def create_floor_plan():
    width, height = 900, 700
    img = Image.new('RGB', (width, height), color=(14, 43, 92))
    draw = ImageDraw.Draw(img)

    f_title = get_bold_font(22)
    f_body = get_bold_font(18)
    f_dim = get_default_font(15)

    for x in range(0, width, 40):
        draw.line([(x, 0), (x, height)], fill=(24, 63, 128), width=1)
    for y in range(0, height, 40):
        draw.line([(0, y), (width, y)], fill=(24, 63, 128), width=1)

    draw.rectangle([(30, 30), (width - 30, height - 30)], outline=(255, 255, 255), width=3)
    draw.text((width // 2, 60), "APEX INSTITUTE OF TECHNOLOGY - ACADEMIC BLOCK A", font=f_title, fill=(255, 255, 255), anchor="mm")
    draw.text((width // 2, 90), "FIRST FLOOR INSTRUCTIONAL CAD LAYOUT (REV 03)", font=f_dim, fill=(147, 197, 253), anchor="mm")

    # CENTRAL COMPUTER LAB - 1 (The Planted Trap: 410.0 sq.m)
    draw.rectangle([(60, 140), (520, 500)], outline=(59, 130, 246), width=3, fill=(15, 34, 73))
    draw.text((290, 220), "CENTRAL COMPUTER LAB - 1", font=f_body, fill=(255, 255, 255), anchor="mm")
    draw.text((290, 260), "Dimensions: 20.5m x 20.0m", font=f_dim, fill=(191, 219, 254), anchor="mm")
    draw.text((290, 300), "Floor Area: 410.0 sq.m", font=f_body, fill=(254, 240, 138), anchor="mm")
    draw.text((290, 340), "Seating: 150 Workstations (LAN + UPS)", font=f_dim, fill=(191, 219, 254), anchor="mm")

    # SERVER ROOM
    draw.rectangle([(540, 140), (840, 300)], outline=(59, 130, 246), width=2, fill=(15, 34, 73))
    draw.text((690, 200), "SERVER & HPC CLUSTER ROOM", font=f_body, fill=(255, 255, 255), anchor="mm")
    draw.text((690, 240), "Area: 80.0 sq.m", font=f_dim, fill=(191, 219, 254), anchor="mm")

    # HOD OFFICE
    draw.rectangle([(540, 320), (840, 500)], outline=(59, 130, 246), width=2, fill=(15, 34, 73))
    draw.text((690, 390), "CSE HOD & FACULTY CABIN", font=f_body, fill=(255, 255, 255), anchor="mm")
    draw.text((690, 430), "Area: 75.0 sq.m", font=f_dim, fill=(191, 219, 254), anchor="mm")

    # TITLE BLOCK
    draw.rectangle([(500, 540), (870, 660)], outline=(255, 255, 255), width=2, fill=(10, 28, 64))
    draw.text((515, 555), "ARCHITECT: M/s Deshmukh & Associates", font=f_dim, fill=(255, 255, 255))
    draw.text((515, 580), "Council of Architecture Reg: CA/2018/74199", font=f_dim, fill=(147, 197, 253))
    draw.text((515, 605), "Date of Approval: 12-FEB-2024", font=f_dim, fill=(255, 255, 255))
    draw.text((515, 630), "Drawing No: AIT-ENG-BLD-014-R3", font=f_dim, fill=(254, 240, 138))

    file_path = os.path.join(OUTPUT_DIR, "apex_floor_plan_blueprint.png")
    img.save(file_path, "PNG")
    print(f"[OK] Generated: {file_path}")


# 2. GENERATE FIRE SAFETY NOC (Engine 7 Validity check)
def create_fire_noc():
    width, height = 800, 1050
    img = Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    f_title = get_bold_font(24)
    f_header = get_bold_font(18)
    f_body = get_default_font(16)
    f_small = get_default_font(14)

    draw.rectangle([(20, 20), (width - 20, height - 20)], outline=(30, 41, 59), width=3)
    draw.rectangle([(26, 26), (width - 26, height - 26)], outline=(148, 163, 184), width=1)

    draw.text((width // 2, 60), "DEPARTMENT OF FIRE & EMERGENCY SERVICES", font=f_title, fill=(15, 23, 42), anchor="mm")
    draw.text((width // 2, 95), "MUNICIPAL CORPORATION / GOVT. OF MAHARASHTRA", font=f_header, fill=(71, 85, 105), anchor="mm")
    draw.line([(50, 120), (width - 50, 120)], fill=(71, 85, 105), width=2)

    draw.text((60, 150), "Certificate No: NOC/FIRE/MH/2022/9412", font=f_header, fill=(15, 23, 42))
    draw.text((550, 150), "Date of Issue: 16/05/2022", font=f_header, fill=(15, 23, 42))

    draw.text((width // 2, 220), "FIRE SAFETY & CLEARANCE CERTIFICATE", font=f_title, fill=(185, 28, 28), anchor="mm")

    body_text = (
        "This is to certify that the premises of technical education institution:\n\n"
        "      Institution Name: APEX INSTITUTE OF TECHNOLOGY\n"
        "      Address: Sector 14, Hinjewadi Knowledge Park, Pune, MH - 411057\n"
        "      Building Structure: Ground + 3 Upper Floors (RCC Structure)\n\n"
        "Has been thoroughly inspected by the authorized Divisional Fire Officer on 10/05/2022.\n"
        "The automated fire hydrant system, smoke detectors, and emergency exits comply with\n"
        "Part 4 of the National Building Code (NBC) of India and AICTE guidelines.\n\n"
        "This Certificate is officially granted with the following validity terms:\n"
    )
    draw.multiline_text((60, 260), body_text, font=f_body, fill=(30, 41, 59), spacing=8)

    draw.rectangle([(60, 520), (width - 60, 600)], fill=(241, 245, 249), outline=(79, 70, 229), width=2)
    draw.text((80, 545), "VALID UP TO / EXPIRY DATE:  15/05/2025", font=f_title, fill=(185, 28, 28))
    draw.text((80, 575), "(Must be renewed prior to date of expiry for continued academic operations)", font=f_small, fill=(71, 85, 105))

    file_path = os.path.join(OUTPUT_DIR, "apex_fire_safety_noc.png")
    img.save(file_path, "PNG")
    print(f"[OK] Generated: {file_path}")


# 3. GENERATE JSON APPLICATION & ROSTER DATA (Engine 6 & Cadre checks)
def create_json_payloads():
    application_payload = {
        "institution_id": "AICTE-1-987654321",
        "institution_name": "Apex Institute of Technology",
        "academic_year": "2025-26",
        "campus_location": {
            "address": "Sector 14, Hinjewadi Knowledge Park, Pune, Maharashtra 411057",
            "latitude": 18.520430,
            "longitude": 73.856744
        },
        "application_type": "Extension of Approval (EoA) with Intake Increase",
        "declared_claims": {
            "programme": "Engineering & Technology (UG)",
            "course": "Computer Science & Engineering",
            "previous_intake": 120,
            "requested_intake": 180,           # Requires 9 faculty under APH 1:20 ratio
            "claimed_lab_area_sqm": 640.0,      # Floor plan shows only 410.0 sqm
        },
        "declared_faculty_members": [           # Total: 7 faculty (Deficit of 2 for 180 seats)
            {"name": "Dr. R.K. Sharma", "pan_or_aadhaar": "ABCD-1234-9999", "designation": "Professor & HOD", "department": "CSE"}, # Ghost Faculty Trap
            {"name": "Prof. Amit Verma", "pan_or_aadhaar": "BCDE-2345-8888", "designation": "Associate Professor", "department": "CSE"},
            {"name": "Dr. Sneha Patil", "pan_or_aadhaar": "CDEF-3456-7777", "designation": "Assistant Professor", "department": "CSE"},
            {"name": "Prof. Rahul Kulkarni", "pan_or_aadhaar": "DEFG-4567-6666", "designation": "Assistant Professor", "department": "CSE"},
            {"name": "Prof. Pooja Nair", "pan_or_aadhaar": "EFGH-5678-5555", "designation": "Assistant Professor", "department": "CSE"},
            {"name": "Prof. Vikram Joshi", "pan_or_aadhaar": "FGHI-6789-4444", "designation": "Assistant Professor", "department": "CSE"},
            {"name": "Prof. Meera Deshmukh", "pan_or_aadhaar": "GHIJ-7890-3333", "designation": "Assistant Professor", "department": "CSE"}
        ]
    }

    from engines.faculty_matcher import FacultyMatcher
    matcher = FacultyMatcher()
    other_colleges_roster = [
        {
            "name": "Dr. Ram Kumar Sharma",
            "institution": "Greenfield Institute of Technology",
            "department": "CSE",
            "privacy_hash": matcher.generate_privacy_hash("ABCD-1234-9999")
        },
        {
            "name": "Prof. S.K. Gupta",
            "institution": "Modern College of Engineering",
            "department": "ECE",
            "privacy_hash": matcher.generate_privacy_hash("KLMN-9999-1111")
        }
    ]

    with open(os.path.join(OUTPUT_DIR, "apex_application_payload.json"), "w") as f:
        json.dump(application_payload, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "other_colleges_faculty_roster.json"), "w") as f:
        json.dump(other_colleges_roster, f, indent=2)

    print(f"[OK] Generated JSON records in: {OUTPUT_DIR}")


if __name__ == "__main__":
    print("[INFO] Generating Demo Assets for Engines 6, 7 & 8...")
    create_floor_plan()
    create_fire_noc()
    create_json_payloads()
    print("\n[SUCCESS] Assets generated successfully in 'demo_assets/' folder!")
