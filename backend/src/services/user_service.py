"""User management + authentication (P2-2).

The service layer is the only writer of the ``users`` table. Password
hashing happens here, never in routers.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.security import (
    ROLE_ADMIN,
    ROLE_OFFICER,
    ROLE_TECHNICIAN,
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from ..db.models import User, UserRole

_ROLE_MAP: dict[str, UserRole] = {
    ROLE_TECHNICIAN: UserRole.LAB_TECHNICIAN,
    ROLE_OFFICER: UserRole.APPROVING_OFFICER,
    ROLE_ADMIN: UserRole.ADMIN,
}


class AuthError(Exception):
    """Raised on bad credentials or deactivated accounts."""


class ConflictError(Exception):
    """Raised on duplicate email."""


def create_user(
    db: Session,
    *,
    full_name: str,
    email: str,
    password: str,
    role: str,
) -> User:
    """Create a user (admin operation). Raises ConflictError on dup email."""
    email_norm = email.strip().lower()
    if db.scalar(select(User).where(User.email == email_norm)) is not None:
        raise ConflictError(f"a user with email {email_norm!r} already exists")
    if role not in _ROLE_MAP:
        raise ValueError(f"unknown role {role!r}")
    user = User(
        full_name=full_name.strip(),
        email=email_norm,
        password_hash=hash_password(password),
        role=_ROLE_MAP[role],
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, *, email: str, password: str) -> tuple[User, str, str]:
    """Verify credentials and return ``(user, access_token, refresh_token)``.

    Raises AuthError on any failure (identical error for unknown email and
    wrong password — no account enumeration).
    """
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("invalid credentials")
    if not user.is_active:
        raise AuthError("account is deactivated")
    return (
        user,
        create_access_token(str(user.id), user.role.value),
        create_refresh_token(str(user.id), user.role.value),
    )


def get_user(db: Session, user_id: uuid.UUID) -> User | None:
    """Fetch one active user by id."""
    user = db.get(User, user_id)
    if user is not None and not user.is_active:
        return None
    return user


def seed_demo_users(db: Session, *, password: str) -> list[User]:
    """Create one user per role for dev/demo (idempotent on email)."""
    out: list[User] = []
    for name, email, role in (
        ("Demo Admin", "admin@lab.gov.in", ROLE_ADMIN),
        ("Demo Technician", "tech@lab.gov.in", ROLE_TECHNICIAN),
        ("Demo Officer", "officer@lab.gov.in", ROLE_OFFICER),
    ):
        existing = db.scalar(select(User).where(User.email == email))
        if existing is None:
            existing = create_user(
                db, full_name=name, email=email, password=password, role=role
            )
        out.append(existing)
    return out
