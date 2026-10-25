"""
Engine 7: Scrutiny Calendar & Dynamic Validity Router
Endpoints:
  • POST /validity-check        — Direct & backend scrutiny decision date check
  • POST /ml/validity-check     — Alias for consistency with engines-6-7-8
"""

import logging
from typing import Optional
from fastapi import APIRouter, Body

from models.schemas import ValidityCheckRequest, ValidityCheckResponse
from services.validity_service import ValidityEngine

logger = logging.getLogger("routers.validity_router")
router = APIRouter()
validity_engine = ValidityEngine()


@router.post(
    "/validity-check",
    response_model=ValidityCheckResponse,
    summary="Scrutiny Calendar Temporal Certificate Validity Audit",
    description="Evaluates certificate validity against scrutiny decision date and academic session start date.",
)
async def check_validity(payload: ValidityCheckRequest):
    logger.info("Evaluating certificate validity: expiry=%s, anchor=%s", payload.expiry_date, payload.scrutiny_anchor_date)
    res = validity_engine.evaluate_validity(
        expiry_date_input=payload.expiry_date,
        scrutiny_anchor_date_input=payload.scrutiny_anchor_date,
        session_start_date_input=payload.session_start_date,
    )
    return res


@router.post(
    "/ml/validity-check",
    response_model=ValidityCheckResponse,
    include_in_schema=False,
)
async def check_validity_alias(payload: ValidityCheckRequest):
    return await check_validity(payload)
