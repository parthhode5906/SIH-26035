"""Instruments endpoints (architecture.md §6.2)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..deps import DbDep, TechnicianOnly, TechnicianPlus
from ...services.instrument_service import (
    InstrumentValidationError,
    create_instrument,
    get_instrument,
    list_instruments,
)
from ..schemas import InstrumentCreate, InstrumentOut, InstrumentPage

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.post("", response_model=InstrumentOut, status_code=status.HTTP_201_CREATED)
def register_instrument(
    body: InstrumentCreate, db: DbDep, user: TechnicianOnly
) -> InstrumentOut:
    """Register an instrument — rejected unless R 76-1 Table 3 is satisfied."""
    try:
        instrument = create_instrument(
            db,
            manufacturer=body.manufacturer,
            model=body.model,
            serial_number=body.serial_number,
            accuracy_class=body.accuracy_class,
            max_capacity=body.max_capacity,
            min_capacity=body.min_capacity,
            verification_scale_interval=body.verification_scale_interval,
            display_interval=body.display_interval,
            base_unit=body.base_unit,
            created_by=user.id,
        )
    except InstrumentValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, exc.reason) from exc
    return InstrumentOut.model_validate(instrument)


@router.get("", response_model=InstrumentPage)
def search_instruments(
    db: DbDep,
    _user: TechnicianPlus,
    q: str | None = Query(default=None, max_length=100),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> InstrumentPage:
    """Paginated manufacturer/model/serial search."""
    rows, total = list_instruments(db, q=q, skip=skip, limit=limit)
    return InstrumentPage(
        total=total,
        skip=skip,
        limit=limit,
        items=[InstrumentOut.model_validate(r) for r in rows],
    )


@router.get("/{instrument_id}", response_model=InstrumentOut)
def read_instrument(
    instrument_id: uuid.UUID, db: DbDep, _user: TechnicianPlus
) -> InstrumentOut:
    """Fetch one instrument (404 if absent)."""
    instrument = get_instrument(db, instrument_id)
    if instrument is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "instrument not found")
    return InstrumentOut.model_validate(instrument)
