import logging
import time
from collections import defaultdict
from datetime import timedelta
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from app.api import deps
from app import models, schemas
from app.core import security
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# M14: Simple in-memory rate limiter for login endpoint
# ---------------------------------------------------------------------------
_login_attempts: dict[str, list[float]] = defaultdict(list)
_lock = Lock()
_MAX_LOGIN_ATTEMPTS = 5
_WINDOW_SECONDS = 300  # 5 minutes


def _check_rate_limit(client_ip: str) -> None:
    """Raise 429 if the client has exceeded the login attempt limit."""
    now = time.monotonic()
    with _lock:
        attempts = _login_attempts[client_ip]
        # Prune attempts outside the window
        _login_attempts[client_ip] = [t for t in attempts if now - t < _WINDOW_SECONDS]
        if len(_login_attempts[client_ip]) >= _MAX_LOGIN_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again later.",
            )
        _login_attempts[client_ip].append(now)


@router.post("/login/access-token", response_model=schemas.Token)
def login_access_token(
    request: Request,
    db: Session = Depends(deps.get_db),
    form_data: schemas.LoginRequest = Depends(),
):
    """
    OAuth2 compatible endpoint to exchange username and password for tokens.
    """
    logger.info(f"Login attempt for user {form_data.username}")
    _check_rate_limit(request.client.host)

    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException (
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires,
    )
    refresh_token = security.create_refresh_token(data={"sub": str(user.id)})
    logger.info(f"User {user.email} logged in successfully, id={user.id}")
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=schemas.Token)
def refresh_access_token(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    token: str = Depends(deps.reusable_oauth2),
):
    """
    Exchange a valid refresh token for a new access + refresh token pair.
    """
    logger.info(f"Refresh token request received for user {current_user.email}, id={current_user.id}")
    try:
        payload = security.jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.CRYPT_ALGORITHM]
        )
        token_data = schemas.TokenPayload(**payload)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if token_data.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not a refresh token",
        )

    user = db.query(models.User).filter(models.User.id == token_data.sub).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    access_token = security.create_access_token(data={"sub": str(user.id)})
    refresh_token = security.create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/register", response_model=schemas.UserResponse, status_code=201)
def register_user(
    user_in: schemas.UserCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Register a new user. Admin-only.
    """
    logger.info(f"User registration request received for email {user_in.email}, id={user_in.id}")
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can register new users",
        )

    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    user = models.User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        is_active=True,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
