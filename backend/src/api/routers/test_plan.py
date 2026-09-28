from __future__ import annotations
import uuid
from typing import Literal
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from ..deps import AnyUser, DbDep
from ...services.session_service import get_session
from ...services.test_plan_service import ensure_plan, list_plan, set_status, TestPlanStateError

router=APIRouter(prefix="/sessions", tags=["test-plan"])
class PlanOut(BaseModel):
    id: uuid.UUID; test_type: str; status: str; rationale: str|None; updated_at: object
class PlanUpdate(BaseModel):
    test_type: str
    status: Literal["required","optional","not_applicable"]
    rationale: str|None=Field(default=None,max_length=1000)
class PlanResponse(BaseModel):
    items:list[PlanOut]
    completion:dict[str,object]

@router.get("/{session_id}/test-plan", response_model=PlanResponse)
def read(session_id:uuid.UUID, db:DbDep, user:AnyUser):
    session=get_session(db,session_id)
    if session is None: raise HTTPException(status.HTTP_404_NOT_FOUND,"session not found")
    rows=ensure_plan(db,session,user.id)
    from ...services.test_plan_service import completion
    return PlanResponse(items=[PlanOut(id=r.id,test_type=r.test_type.value,status=r.status.value,rationale=r.rationale,updated_at=r.updated_at) for r in rows], completion=completion(db,session))

@router.put("/{session_id}/test-plan", response_model=PlanOut)
def update(session_id:uuid.UUID, body:PlanUpdate, db:DbDep, user:AnyUser):
    if user.role.value=="approving_officer": raise HTTPException(status.HTTP_403_FORBIDDEN,"officers may not modify the test plan")
    session=get_session(db,session_id)
    if session is None: raise HTTPException(status.HTTP_404_NOT_FOUND,"session not found")
    ensure_plan(db,session,user.id)
    try: r=set_status(db,session,test_type=body.test_type,status=body.status,rationale=body.rationale,user_id=user.id)
    except (ValueError,TestPlanStateError) as exc: raise HTTPException(status.HTTP_409_CONFLICT,str(exc)) from exc
    return PlanOut(id=r.id,test_type=r.test_type.value,status=r.status.value,rationale=r.rationale,updated_at=r.updated_at)
