import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
TOKEN_DAYS = 7
EMERGENT_SESSION_API = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# Email/password is the production auth path. The Emergent-hosted Google
# session flow is a sandbox dependency and stays OFF unless explicitly enabled.
GOOGLE_AUTH_ENABLED = os.getenv("EMERGENT_GOOGLE_ENABLED", "false").lower() == "true"

# CORS: comma-separated allowlist (default "*"). The app authenticates with a
# Bearer token, not cookies, so credentials are not allowed (keeps "*" valid).
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="AvirLog API")
api_router = APIRouter(prefix="/api")

NostrilState = Literal["left", "right", "both"]


# ---------- Models ----------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=64)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SessionIn(BaseModel):
    session_id: str


class UserPublic(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: str = "password"


class LogCreate(BaseModel):
    # Client-supplied idempotency key. Notification quick-logs send a stable id
    # so a retried delivery upserts the same row instead of duplicating it —
    # the local store honours this and the API must match.
    id: Optional[str] = Field(default=None, min_length=8, max_length=80)
    nostril_state: NostrilState
    # Advanced logging: the RIGHT nostril's share, 0–100. Absent for simple
    # Left/Right/Both taps. Without this field Pydantic silently dropped the
    # value and every advanced log lost its blend.
    blend: Optional[int] = Field(default=None, ge=0, le=100)
    # Breath-pad logging: how open each nostril is, 0–100 per side and
    # independent of each other — a congested nose can be 30 / 40. `blend`
    # still carries the balance between them, so every blend consumer works
    # unchanged on pad logs.
    left_open: Optional[int] = Field(default=None, ge=0, le=100)
    right_open: Optional[int] = Field(default=None, ge=0, le=100)
    mood_score: Optional[int] = Field(default=None, ge=1, le=10)
    energy_score: Optional[int] = Field(default=None, ge=1, le=10)
    focus_score: Optional[int] = Field(default=None, ge=1, le=10)
    note: Optional[str] = Field(default=None, max_length=1000)
    tags: List[str] = []
    local_date: str  # YYYY-MM-DD in the user's timezone
    local_hour: int = Field(ge=0, le=23)
    # Minutes EAST of UTC at the moment of logging (JS: -getTimezoneOffset()).
    # local_date/local_hour alone can't be re-anchored to the solar day once
    # users span timezones; this can't be backfilled, so capture it from day one.
    tz_offset_minutes: Optional[int] = Field(default=None, ge=-840, le=840)


class LogUpdate(BaseModel):
    nostril_state: Optional[NostrilState] = None
    blend: Optional[int] = Field(default=None, ge=0, le=100)
    left_open: Optional[int] = Field(default=None, ge=0, le=100)
    right_open: Optional[int] = Field(default=None, ge=0, le=100)
    mood_score: Optional[int] = Field(default=None, ge=1, le=10)
    energy_score: Optional[int] = Field(default=None, ge=1, le=10)
    focus_score: Optional[int] = Field(default=None, ge=1, le=10)
    note: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[List[str]] = None


# Partial update: every field optional, applied with exclude_unset so a PUT
# carrying one setting no longer resets the rest to defaults. Mirrors the
# LocalSettings shape in frontend/src/lib/localStore.ts — keep in sync.
class SettingsIn(BaseModel):
    reminder_enabled: Optional[bool] = None
    reminder_interval_seconds: Optional[int] = Field(default=None, ge=5, le=86400)
    quiet_hours_enabled: Optional[bool] = None
    quiet_start_minutes: Optional[int] = Field(default=None, ge=0, le=1439)
    quiet_end_minutes: Optional[int] = Field(default=None, ge=0, le=1439)
    theme: Optional[Literal["light", "dark"]] = None
    mood_journaling: Optional[bool] = None
    skin: Optional[Literal["classic", "banners", "instrument"]] = None
    advanced_logging: Optional[bool] = None
    # Which advanced control the Log screen shows: the one-axis blend control
    # ("blend") or the two-axis breath pad ("pad"). Ignored while
    # advanced_logging is off, so switching advanced off and on again keeps
    # the last choice.
    advanced_style: Optional[Literal["blend", "pad"]] = None
    reminder_style: Optional[Literal["banner", "live", "both"]] = None
    reminder_sound: Optional[bool] = None
    widget_tap_feedback: Optional[bool] = None
    haptics_enabled: Optional[bool] = None
    # Research opt-in: whether this user's anonymized logs may be included in
    # aggregate breath-pattern analysis. Defaults off; the consent timestamp is
    # stamped server-side so the client can't fabricate it.
    research_consent: Optional[bool] = None


# ---------- Helpers ----------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return now_utc().isoformat()


def make_jwt(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def public_user(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "email": doc["email"],
        "name": doc.get("name"),
        "picture": doc.get("picture"),
        "auth_provider": doc.get("auth_provider", "password"),
    }


async def get_current_user(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()

    # 1) JWT (email/password)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
        if user:
            return user
    except jwt.PyJWTError:
        pass

    # 2) Google session token
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = sess.get("expires_at")
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp > now_utc():
            user = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
            if user:
                return user

    raise HTTPException(status_code=401, detail="Invalid or expired token")


async def auth_user(authorization: Optional[str] = Header(default=None)) -> dict:
    return await get_current_user(authorization)


# Defaults mirror DEFAULT_SETTINGS in frontend/src/lib/localStore.ts.
SETTINGS_DEFAULTS = {
    "reminder_enabled": False,
    "reminder_interval_seconds": 3600,
    "quiet_hours_enabled": False,
    "quiet_start_minutes": 22 * 60,  # 22:00
    "quiet_end_minutes": 7 * 60,  # 07:00
    "theme": "light",
    "mood_journaling": True,
    "skin": "banners",
    "advanced_logging": False,
    "advanced_style": "blend",
    "reminder_style": "both",
    "reminder_sound": True,
    "widget_tap_feedback": True,
    "haptics_enabled": True,
    "research_consent": False,
    "research_consent_at": None,
}


async def ensure_settings(user_id: str) -> dict:
    existing = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        # Migrate pre-seconds documents and backfill fields added since the doc
        # was created, so clients always see the full current shape.
        if existing.get("reminder_interval_seconds") is None and existing.get("reminder_interval_minutes") is not None:
            existing["reminder_interval_seconds"] = int(existing["reminder_interval_minutes"]) * 60
        existing.pop("reminder_interval_minutes", None)
        return {**SETTINGS_DEFAULTS, **existing}
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        **SETTINGS_DEFAULTS,
        "created_at": iso_now(),
        "updated_at": iso_now(),
    }
    await db.user_settings.insert_one({**doc})
    return doc


# ---------- Auth routes ----------

@api_router.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "name": None,
        "picture": None,
        "auth_provider": "password",
        "password_hash": pwd_context.hash(body.password),
        "created_at": iso_now(),
    }
    await db.users.insert_one({**user})
    await ensure_settings(user["id"])
    return {"token": make_jwt(user["id"]), "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not pwd_context.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"token": make_jwt(user["id"]), "user": public_user(user)}


@api_router.post("/auth/session")
async def google_session(body: SessionIn):
    if not GOOGLE_AUTH_ENABLED:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(EMERGENT_SESSION_API, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = resp.json()
    email = data["email"].lower()

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {
            "id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "auth_provider": "google",
            "created_at": iso_now(),
        }
        await db.users.insert_one({**user})
        await ensure_settings(user["id"])
    else:
        updates = {}
        if data.get("name") and not user.get("name"):
            updates["name"] = data["name"]
        if data.get("picture") and not user.get("picture"):
            updates["picture"] = data["picture"]
        if updates:
            await db.users.update_one({"id": user["id"]}, {"$set": updates})
            user.update(updates)

    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["id"],
        "created_at": iso_now(),
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
    })
    return {"session_token": session_token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api_router.delete("/auth/account")
async def delete_account(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    await db.breath_logs.delete_many({"user_id": user["id"]})
    await db.user_settings.delete_many({"user_id": user["id"]})
    await db.user_sessions.delete_many({"user_id": user["id"]})
    await db.users.delete_one({"id": user["id"]})
    return {"ok": True}


# ---------- Breath logs ----------

@api_router.post("/logs")
async def create_log(body: LogCreate, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    # Idempotent create: a client-supplied id that already exists for this user
    # returns the stored row unchanged, so a retried notification quick-log
    # never duplicates. Scoped to the user — one client's key can't collide
    # with or read another's.
    if body.id:
        existing = await db.breath_logs.find_one({"id": body.id, "user_id": user["id"]}, {"_id": 0})
        if existing:
            return existing
    doc = {
        "id": body.id or str(uuid.uuid4()),
        "user_id": user["id"],
        "nostril_state": body.nostril_state,
        "blend": body.blend,
        "left_open": body.left_open,
        "right_open": body.right_open,
        "mood_score": body.mood_score,
        "energy_score": body.energy_score,
        "focus_score": body.focus_score,
        "note": body.note,
        "tags": body.tags,
        "local_date": body.local_date,
        "local_hour": body.local_hour,
        "tz_offset_minutes": body.tz_offset_minutes,
        "created_at": iso_now(),
        "updated_at": iso_now(),
    }
    try:
        await db.breath_logs.insert_one({**doc})
    except DuplicateKeyError:
        # Two retries of the same quick-log raced past the pre-check; the row
        # the other one inserted is the answer.
        return await db.breath_logs.find_one({"id": doc["id"], "user_id": user["id"]}, {"_id": 0})
    return doc


@api_router.get("/logs")
async def list_logs(
    date: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    user = await get_current_user(authorization)
    query: dict = {"user_id": user["id"]}
    if date:
        query["local_date"] = date
    elif start and end:
        query["local_date"] = {"$gte": start, "$lte": end}
    else:
        raise HTTPException(status_code=400, detail="Provide ?date= or ?start=&end=")
    logs = await db.breath_logs.find(query, {"_id": 0}).sort("created_at", 1).to_list(2000)
    return logs


@api_router.get("/logs/dates")
async def log_dates(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$group": {
            "_id": "$local_date",
            "count": {"$sum": 1},
            "left": {"$sum": {"$cond": [{"$eq": ["$nostril_state", "left"]}, 1, 0]}},
            "right": {"$sum": {"$cond": [{"$eq": ["$nostril_state", "right"]}, 1, 0]}},
            "both": {"$sum": {"$cond": [{"$eq": ["$nostril_state", "both"]}, 1, 0]}},
        }},
        {"$sort": {"_id": -1}},
    ]
    rows = await db.breath_logs.aggregate(pipeline).to_list(1000)
    return [
        {"date": r["_id"], "count": r["count"], "left": r["left"], "right": r["right"], "both": r["both"]}
        for r in rows
    ]


@api_router.patch("/logs/{log_id}")
async def update_log(log_id: str, body: LogUpdate, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    existing = await db.breath_logs.find_one({"id": log_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Log not found")
    updates = body.model_dump(exclude_unset=True)
    updates["updated_at"] = iso_now()
    await db.breath_logs.update_one({"id": log_id}, {"$set": updates})
    updated = await db.breath_logs.find_one({"id": log_id}, {"_id": 0})
    return updated


# Clear a whole day at once — mirrors the local store's DELETE /logs?date=.
# The date is required so this can never wipe a whole account by accident.
@api_router.delete("/logs")
async def delete_day(date: str, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    result = await db.breath_logs.delete_many({"user_id": user["id"], "local_date": date})
    return {"deleted": result.deleted_count}


@api_router.delete("/logs/{log_id}")
async def delete_log(log_id: str, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    result = await db.breath_logs.delete_one({"id": log_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"ok": True}


# ---------- Settings ----------

@api_router.get("/settings")
async def get_settings(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    return await ensure_settings(user["id"])


@api_router.put("/settings")
async def update_settings(body: SettingsIn, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    current = await ensure_settings(user["id"])
    # exclude_unset: only fields the client actually sent are written. The old
    # model_dump() wrote every default too, so saving one toggle silently reset
    # the reminder interval and everything else.
    updates = body.model_dump(exclude_unset=True)
    # Consent gets a server-side timestamp the moment it flips on, and a
    # revocation timestamp when it flips off — the audit trail research use
    # depends on, and not something the client is trusted to write.
    if "research_consent" in updates:
        if updates["research_consent"] and not current.get("research_consent"):
            updates["research_consent_at"] = iso_now()
        elif not updates["research_consent"] and current.get("research_consent"):
            updates["research_revoked_at"] = iso_now()
    updates["updated_at"] = iso_now()
    await db.user_settings.update_one({"user_id": user["id"]}, {"$set": updates})
    return await ensure_settings(user["id"])


# ---------- Export ----------

@api_router.get("/export")
async def export_data(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    logs = await db.breath_logs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(10000)
    settings = await ensure_settings(user["id"])
    return {
        "exported_at": iso_now(),
        "user": public_user(user),
        "settings": settings,
        "logs": logs,
    }


@api_router.get("/")
async def root():
    return {"message": "AvirLog API"}


# Unauthenticated health check for the hosting platform.
@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def create_indexes():
    await db.users.create_index("id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.breath_logs.create_index([("user_id", 1), ("local_date", 1)])
    # The id lookups (idempotent create, patch, delete) were collection scans.
    await db.breath_logs.create_index("id", unique=True)
    await db.user_settings.create_index("user_id", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
