"""Autenticacao JWT customizada (admin + vendedor)."""
import os
import re
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
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


# ---------------------------------------------------------------------------
# Admin: gestao de usuarios
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=4, max_length=72)
    nome: str = Field(min_length=1, max_length=120)
    role: Role
    cod_vendedor: int | None = None
    email: str | None = None


class UserEdit(BaseModel):
    nome: str | None = None
    role: Role | None = None
    cod_vendedor: int | None = None
    email: str | None = None
    disabled: bool | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=4, max_length=72)


def _public_full(d: dict) -> dict:
    return {
        "id": str(d["_id"]),
        "username": d["username"],
        "nome": d.get("nome"),
        "email": d.get("email"),
        "role": d["role"],
        "cod_vendedor": d.get("cod_vendedor"),
        "disabled": bool(d.get("disabled", False)),
    }


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")


@auth_router.get("/users")
async def list_users(admin=Depends(require_role("admin"))):
    users = [
        _public_full(u)
        async for u in db.users.find({}, {"password_hash": 0}).sort("username", 1)
    ]
    return {"users": users}


@auth_router.post("/users", status_code=201)
async def create_user(body: UserCreate, admin=Depends(require_role("admin"))):
    username = body.username.strip()
    if len(body.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Senha muito longa (max 72 bytes)")
    existing = await db.users.find_one(
        {"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}}
    )
    if existing:
        raise HTTPException(status_code=409, detail="Nome de usuario ja existe")
    doc = {
        "username": username,
        "nome": body.nome.strip(),
        "email": (body.email or "").strip().lower() or None,
        "role": body.role,
        "cod_vendedor": int(body.cod_vendedor) if body.cod_vendedor is not None else None,
        "password_hash": hash_password(body.password),
        "disabled": False,
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _public_full(doc)


@auth_router.patch("/users/{user_id}")
async def edit_user(user_id: str, body: UserEdit, admin=Depends(require_role("admin"))):
    target = _oid(user_id)
    changes = body.model_dump(exclude_unset=True)
    if "nome" in changes and changes["nome"]:
        changes["nome"] = changes["nome"].strip()
    if "email" in changes:
        changes["email"] = (changes["email"] or "").strip().lower() or None
    if "cod_vendedor" in changes and changes["cod_vendedor"] is not None:
        changes["cod_vendedor"] = int(changes["cod_vendedor"])
    # nao permite auto-desativar ou rebaixar o proprio admin logado
    if target == admin["_id"] and (changes.get("disabled") is True or changes.get("role") == "vendedor"):
        raise HTTPException(status_code=409, detail="Nao e possivel desativar ou rebaixar o proprio usuario")
    if not changes:
        raise HTTPException(status_code=422, detail="Nada para atualizar")
    result = await db.users.update_one({"_id": target}, {"$set": changes})
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    updated = await db.users.find_one({"_id": target}, {"password_hash": 0})
    return _public_full(updated)


@auth_router.post("/users/{user_id}/reset-password", status_code=200)
async def reset_password(user_id: str, body: PasswordReset, admin=Depends(require_role("admin"))):
    if len(body.new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Senha muito longa (max 72 bytes)")
    result = await db.users.update_one(
        {"_id": _oid(user_id)}, {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    return {"ok": True}



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
