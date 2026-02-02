from pydantic import BaseModel, EmailStr, Field, HttpUrl
from typing import Optional


class UserBase(BaseModel):
    email: EmailStr
    is_active: Optional[bool] = True


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    role: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenPayload(BaseModel):
    sub: Optional[int] = None
    type: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str