"""
认证路由：注册、登录、查询当前用户、修改密码
前缀：/auth（由 main.py 挂载到 /api/auth/*）
"""

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select

from auth.dependencies import get_current_user
from auth.security import create_access_token, hash_password, verify_password
from database.engine import async_session_maker
from database.models import User

router = APIRouter(prefix="/auth", tags=["用户认证"])


# ─── Pydantic 请求 / 响应模型 ───

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
        if not re.match(pattern, v):
            raise ValueError("邮箱格式不正确")
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("密码至少需要 6 位")
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("用户名不能为空")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("新密码至少需要 6 位")
        return v


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    role: str

    class Config:
        from_attributes = True


class UserDetailResponse(BaseModel):
    id: int
    email: str
    username: str
    role: str
    created_at: str

    class Config:
        from_attributes = True


# ─── 路由 ───

@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest):
    """注册新用户。邮箱不能重复。"""
    async with async_session_maker() as session:
        existing = await session.execute(
            select(User).where(User.email == body.email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="该邮箱已被注册")

        user = User(
            email=body.email,
            username=body.username,
            password_hash=hash_password(body.password),
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    return UserResponse(id=user.id, email=user.email, username=user.username, role=user.role)


@router.post("/login")
async def login(body: LoginRequest):
    """邮箱 + 密码登录，返回 JWT token 和用户信息。"""
    async with async_session_maker() as session:
        result = await session.execute(
            select(User).where(User.email == body.email.lower().strip())
        )
        user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="账号已被禁用")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role,
        },
    }


@router.get("/me", response_model=UserDetailResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息（需要认证）。"""
    return UserDetailResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        role=current_user.role,
        created_at=current_user.created_at.isoformat(),
    )


@router.put("/change-password", status_code=200)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
):
    """修改密码（需要认证，需要提供旧密码验证）。"""
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="旧密码不正确")

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == current_user.id))
        user = result.scalar_one()
        user.password_hash = hash_password(body.new_password)
        await session.commit()

    return {"message": "密码修改成功"}
