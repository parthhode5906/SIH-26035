"""Security primitives: password hashing + JWT issue/verify (P2-2).

bcrypt via passlib; JWT via pyjwt. No user data is logged here.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Final

import bcrypt
import jwt

from .config import settings

#: Role claims used across the API (architecture.md §11).
ROLE_TECHNICIAN: Final[str] = "lab_technician"
ROLE_OFFICER: Final[str] = "approving_officer"
ROLE_ADMIN: Final[str] = "admin"
KNOWN_ROLES: Final[frozenset[str]] = frozenset(
    {ROLE_TECHNICIAN, ROLE_OFFICER, ROLE_ADMIN}
)

#: Issued-token types (access vs refresh) — refresh can never hit APIs.
TOKEN_TYPE_ACCESS: Final[str] = "access"
TOKEN_TYPE_REFRESH: Final[str] = "refresh"

def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt (salt generated per hash)."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, password_hash: str) -> bool:
    """Constant-time plaintext-vs-hash check; malformed hashes fail closed."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


def _issue(subject: str, role: str, token_type: str, lifetime: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, role: str) -> str:
    """Short-lived API access token."""
    return _issue(subject, role, TOKEN_TYPE_ACCESS, timedelta(minutes=settings.access_token_minutes))


def create_refresh_token(subject: str, role: str) -> str:
    """Long-lived refresh token (exchange-only)."""
    return _issue(subject, role, TOKEN_TYPE_REFRESH, timedelta(days=settings.refresh_token_days))


def decode_token(token: str, *, expected_type: str = TOKEN_TYPE_ACCESS) -> dict[str, Any]:
    """Verify signature/expiry and return claims.

    Raises:
        jwt.PyJWTError: on any signature, expiry, or claim problem.
        ValueError: if the token type does not match ``expected_type``.
    """
    claims = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if claims.get("type") != expected_type:
        raise ValueError(f"expected a {expected_type} token")
    return claims
