"""Auth & users endpoints (architecture.md §6.1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import AdminOnly, AnyUser, DbDep, token_pair_response
from ...core.security import decode_token, TOKEN_TYPE_REFRESH
from ...services.user_service import AuthError, ConflictError, create_user
from ..schemas import LoginRequest, RefreshRequest, TokenResponse, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: DbDep) -> TokenResponse:
    """Exchange email+password for a token pair."""
    from ...services.user_service import authenticate

    try:
        _user, access, refresh = authenticate(
            db, email=body.email, password=body.password
        )
    except AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        role=_user.role.value,
        full_name=_user.full_name,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: DbDep) -> TokenResponse:
    """Exchange a refresh token for a fresh pair."""
    import jwt as pyjwt
    import uuid as _uuid

    from ...db.models import User

    try:
        claims = decode_token(body.refresh_token, expected_type=TOKEN_TYPE_REFRESH)
    except (pyjwt.PyJWTError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid refresh token") from exc
    user = db.get(User, _uuid.UUID(str(claims["sub"])))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unknown or deactivated user")
    return token_pair_response(user)


@users_router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_new_user(body: UserCreate, db: DbDep, admin: AdminOnly) -> UserOut:
    """Create a user (admin only)."""
    try:
        user = create_user(
            db,
            full_name=body.full_name,
            email=body.email,
            password=body.password,
            role=body.role,
        )
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return UserOut.model_validate(user)


@users_router.get("/me", response_model=UserOut)
def read_me(user: AnyUser) -> UserOut:
    """Return the caller's profile."""
    return UserOut.model_validate(user)
