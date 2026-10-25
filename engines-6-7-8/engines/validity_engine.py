"""
Engine 7: The Scrutiny Calendar (Dynamic Validity-at-Decision-Date Engine)
Part of OneCheck 8-Engine ML & Forensics Architecture (SIH 2025)
Compares certificate expiry dates against dynamic scrutiny anchor dates (e.g. committee date, academic session start).
"""
import re
from datetime import datetime, date
from typing import Dict, Any, Optional, Union


class ValidityEngine:
    """
    Decouples document upload date from regulatory scrutiny decision date.
    A certificate valid on upload day (e.g. Jan 15) must remain valid on Scrutiny Day (e.g. May 15)
    and Academic Session Start Day (e.g. Aug 1).
    """

    def __init__(self, urgent_renewal_window_days: int = 30):
        self.renewal_window_days = urgent_renewal_window_days

    def parse_flexible_date(self, date_str: str) -> Optional[datetime]:
        """Parses dates in formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD Month YYYY, etc."""
        if not date_str:
            return None

        clean = date_str.strip()
        # Common date format patterns
        formats = [
            "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
            "%Y-%m-%d", "%Y/%m/%d",
            "%d %b %Y", "%d %B %Y",
            "%d %b, %Y", "%d %B, %Y"
        ]

        for fmt in formats:
            try:
                return datetime.strptime(clean, fmt)
            except ValueError:
                continue

        # Regex fallback for DD/MM/YYYY embedded in text
        match = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b', clean)
        if match:
            day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            if year < 100:
                year += 2000
            try:
                return datetime(year, month, day)
            except ValueError:
                pass

        return None

    def evaluate_validity(
        self,
        expiry_date_input: Union[str, datetime],
        scrutiny_anchor_date_input: Optional[Union[str, datetime]] = None,
        session_start_date_input: Optional[Union[str, datetime]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates validity against both the scrutiny decision date and academic term start date.
        """
        # Parse expiry date
        expiry_dt = expiry_date_input if isinstance(expiry_date_input, datetime) else self.parse_flexible_date(str(expiry_date_input))

        if not expiry_dt:
            return {
                "status": "ERROR",
                "verdict": "MANUAL_REVIEW_REQUIRED",
                "reason": f"Unable to parse certificate expiry date: '{expiry_date_input}'",
                "is_valid_on_scrutiny_date": False,
                "is_valid_for_academic_session": False
            }

        # Anchor dates default
        # Default scrutiny date = today
        scrutiny_dt = (
            scrutiny_anchor_date_input if isinstance(scrutiny_anchor_date_input, datetime)
            else (self.parse_flexible_date(str(scrutiny_anchor_date_input)) if scrutiny_anchor_date_input else datetime.now())
        )

        # Default session start date = 1st August of the current/next academic year
        if session_start_date_input:
            session_dt = session_start_date_input if isinstance(session_start_date_input, datetime) else self.parse_flexible_date(str(session_start_date_input))
        else:
            current_year = scrutiny_dt.year
            session_dt = datetime(current_year, 8, 1)
            if scrutiny_dt.date() >= session_dt.date():
                session_dt = datetime(current_year + 1, 8, 1)  # this year's session already started

        # Days remaining relative to scrutiny anchor date
        days_to_expiry_from_scrutiny = (expiry_dt.date() - scrutiny_dt.date()).days
        # Days remaining relative to session start date
        days_to_expiry_from_session = (expiry_dt.date() - session_dt.date()).days

        is_valid_on_scrutiny = days_to_expiry_from_scrutiny >= 0
        is_valid_on_session = days_to_expiry_from_session >= 0

        # Determine official regulatory status
        if not is_valid_on_scrutiny:
            verdict = "EXPIRED"
            alert = f"Certificate lapsed {abs(days_to_expiry_from_scrutiny)} days prior to scrutiny decision date!"
        elif not is_valid_on_session:
            verdict = "EXPIRED"
            alert = f"PROACTIVE ALERT: Certificate is active today but lapses {abs(days_to_expiry_from_session)} days BEFORE academic session begins ({session_dt.strftime('%d-%b-%Y')})!"
        elif days_to_expiry_from_scrutiny <= self.renewal_window_days:
            verdict = "RENEWAL_URGENT"
            alert = f"Certificate expires within {days_to_expiry_from_scrutiny} days. Renewal required immediately."
        else:
            verdict = "VERIFIED"
            alert = None

        return {
            "status": "SUCCESS",
            "verdict": verdict,
            "expiry_date": expiry_dt.strftime("%Y-%m-%d"),
            "scrutiny_anchor_date": scrutiny_dt.strftime("%Y-%m-%d"),
            "session_start_date": session_dt.strftime("%Y-%m-%d"),
            "days_remaining_from_scrutiny": days_to_expiry_from_scrutiny,
            "days_remaining_from_session_start": days_to_expiry_from_session,
            "is_valid_on_scrutiny_date": is_valid_on_scrutiny,
            "is_valid_for_academic_session": is_valid_on_session,
            "alert": alert
        }
