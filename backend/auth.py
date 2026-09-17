"""Autenticacao JWT customizada (admin + vendedor)."""
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel, Field

from db import db

SECRET = os.environ["JWT_SECRET"]
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
TOKEN_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "720"))

Role = Literal["admin", "vendedor"]
security = HTTPBearer(auto_error=False)
auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginIn(BaseModel):
    identifier: str = Field(min_length=1)
    password: str = Field(min_length=1)


class PublicUser(BaseModel):
    username: str
    nome: str | None = None
    role: Role
    cod_vendedor: int | None = None


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: PublicUser


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


def make_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user["username"],
        "role": user["role"],
        "iat": now,
        "exp": now + timedelta(minutes=TOKEN_MINUTES),
    }
    return jwt.encode(claims, SECRET, algorithm=ALGORITHM)


def public(user: dict) -> dict:
    return {
        "username": user["username"],
        "nome": user.get("nome"),
        "role": user["role"],
        "cod_vendedor": user.get("cod_vendedor"),
    }


async def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
):
    unauthorized = HTTPException(
        status_code=401, detail="Token invalido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, SECRET, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise unauthorized
    except InvalidTokenError:
        raise unauthorized
    user = await db.users.find_one({"username": username})
    if not user or user.get("disabled", False):
        raise unauthorized
    return user


def require_role(*allowed: str):
    async def dependency(user=Depends(current_user)):
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="Permissao insuficiente")
        return user
    return dependency


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------
@auth_router.post("/login", response_model=LoginOut)
async def login(body: LoginIn):
    ident = body.identifier.strip()
    user = await db.users.find_one(
        {"$or": [
            {"username": ident},
            {"username": ident.lower()},
            {"username": ident.upper()},
            {"email": ident.lower()},
        ]}
    )
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Usuario ou senha incorretos")
    return {"access_token": make_token(user), "user": public(user)}


@auth_router.get("/me", response_model=PublicUser)
async def me(user=Depends(current_user)):
    return public(user)


async def seed_users():
    """Cria admin e VAGNER se ainda nao existirem (idempotente)."""
    seeds = [
        {
            "username": "admin",
            "email": "admin@byvision.com",
            "nome": "Administrador",
            "role": "admin",
            "cod_vendedor": None,
            "password_hash": hash_password(os.environ.get("SEED_ADMIN_PASSWORD", "admin123")),
            "disabled": False,
        },
        {
            "username": "VAGNER",
            "email": "vagner@byvision.com",
            "nome": "VAGNER LUIS FERREIRA SANTOS",
            "role": "vendedor",
            "cod_vendedor": int(os.environ["VENDEDOR_COD"]),
            "password_hash": hash_password(os.environ.get("SEED_VAGNER_PASSWORD", "vagner123")),
            "disabled": False,
        },
    ]
    for s in seeds:
        await db.users.update_one(
            {"username": s["username"]}, {"$setOnInsert": s}, upsert=True
        )
