from fastapi import APIRouter
from pydantic import BaseModel

from ..deps import AnyUser
from ...engine.ruleset import RULESET_ID, RULESET_VERSION, RULESET_STATUS
from ...report.aggregate import TEST_ORDER, test_title

router = APIRouter(prefix="/ruleset", tags=["ruleset"])


class RulesetOut(BaseModel):
    id: str
    version: str
    status: str
    test_types: list[dict[str, str]]


@router.get("", response_model=RulesetOut)
def read_ruleset(_user: AnyUser) -> RulesetOut:
    """Return the versioned rule-set metadata used by the application."""
    return RulesetOut(
        id=RULESET_ID,
        version=RULESET_VERSION,
        status=RULESET_STATUS,
        test_types=[{"test_type": key, "title": test_title(key)} for key in TEST_ORDER],
    )
