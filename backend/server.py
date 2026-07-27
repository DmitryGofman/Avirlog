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
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from pymongo import UpdateOne
from pymongo.errors import DuplicateKeyError
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
    # Client-supplied id makes create idempotent: notification quick-logs and
    # the local->cloud migration pass a stable id so a retried delivery upserts
    # the same row instead of duplicating it. Omitted => server generates one.
    id: Optional[str] = Field(default=None, min_length=1, max_length=128)
    nostril_state: NostrilState
    # Advanced logging: the RIGHT nostril's share, 0-100 (left = 100 - blend).
    blend: Optional[int] = Field(default=None, ge=0, le=100)
    mood_score: Optional[int] = Field(default=None, ge=1, le=10)
    energy_score: Optional[int] = Field(default=None, ge=1, le=10)
    focus_score: Optional[int] = Field(default=None, ge=1, le=10)
    note: Optional[str] = Field(default=None, max_length=1000)
    tags: List[str] = []
    local_date: str  # YYYY-MM-DD in the user's timezone
    local_hour: int = Field(ge=0, le=23)


class LogImportItem(LogCreate):
    """A log being migrated in from on-device storage.

    Unlike a fresh create, an imported row keeps the timestamps it was recorded
    with — otherwise a user's whole history collapses onto migration day.
    """

    id: str = Field(min_length=1, max_length=128)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class LogImportIn(BaseModel):
    logs: List[LogImportItem] = Field(default_factory=list, max_length=1000)


class LogUpdate(BaseModel):
    nostril_state: Optional[NostrilState] = None
    blend: Optional[int] = Field(default=None, ge=0, le=100)
    mood_score: Optional[int] = Field(default=None, ge=1, le=10)
    energy_score: Optional[int] = Field(default=None, ge=1, le=10)
    focus_score: Optional[int] = Field(default=None, ge=1, le=10)
    note: Optional[str] = Field(default=None, max_length=1000)
    tags: Optional[List[str]] = None


SkinId = Literal["classic", "banners", "instrument"]


class SettingsIn(BaseModel):
    """Mirrors LocalSettings in frontend/src/lib/localStore.ts.

    Every field is optional so a partial PUT patches instead of resetting the
    fields it omits (the app sends the whole object, but a narrower client
    must not silently wipe skin/quiet-hours).
    """

    reminder_enabled: Optional[bool] = None
    # Cadence is stored in seconds so short test intervals are possible; the
    # legacy minutes field is still accepted and converted.
    reminder_interval_seconds: Optional[int] = Field(default=None, ge=60, le=86400)
    reminder_interval_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    quiet_hours_enabled: Optional[bool] = None
    quiet_start_minutes: Optional[int] = Field(default=None, ge=0, le=1439)
    quiet_end_minutes: Optional[int] = Field(default=None, ge=0, le=1439)
    theme: Optional[Literal["light", "dark"]] = None
    mood_journaling: Optional[bool] = None
    skin: Optional[SkinId] = None
    advanced_logging: Optional[bool] = None


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


# Defaults must match DEFAULT_SETTINGS in frontend/src/lib/localStore.ts, so a
# user signing in for the first time sees the same configuration they had as a
# guest rather than having the server reset it.
DEFAULT_SETTINGS = {
    "reminder_enabled": False,
    "reminder_interval_seconds": 3600,
    "quiet_hours_enabled": False,
    "quiet_start_minutes": 22 * 60,
    "quiet_end_minutes": 7 * 60,
    "theme": "light",
    "mood_journaling": True,
    "skin": "banners",
    "advanced_logging": False,
}


async def ensure_settings(user_id: str) -> dict:
    existing = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        # Backfill fields added after this row was written, so older accounts
        # return a complete object instead of one the app has to patch up.
        missing = {k: v for k, v in DEFAULT_SETTINGS.items() if k not in existing}
        if missing:
            await db.user_settings.update_one({"user_id": user_id}, {"$set": missing})
            existing.update(missing)
        return existing
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        **DEFAULT_SETTINGS,
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
    # Idempotent when the client supplies an id: a replayed notification
    # quick-log returns the row already stored instead of adding a duplicate.
    if body.id:
        existing = await db.breath_logs.find_one(
            {"id": body.id, "user_id": user["id"]}, {"_id": 0}
        )
        if existing:
            return existing
    doc = {
        "id": body.id or str(uuid.uuid4()),
        "user_id": user["id"],
        "nostril_state": body.nostril_state,
        "blend": body.blend,
        "mood_score": body.mood_score,
        "energy_score": body.energy_score,
        "focus_score": body.focus_score,
        "note": body.note,
        "tags": body.tags,
        "local_date": body.local_date,
        "local_hour": body.local_hour,
        "created_at": iso_now(),
        "updated_at": iso_now(),
    }
    try:
        await db.breath_logs.insert_one({**doc})
    except DuplicateKeyError:
        # Two replays raced past the find_one above; the stored row wins.
        stored = await db.breath_logs.find_one(
            {"id": doc["id"], "user_id": user["id"]}, {"_id": 0}
        )
        if stored:
            return stored
        raise
    return doc


@api_router.post("/logs/import")
async def import_logs(body: LogImportIn, authorization: Optional[str] = Header(default=None)):
    """Bulk-upload logs from on-device storage into the signed-in account.

    Used once, when a guest signs in for the first time: without it their local
    history stays orphaned in AsyncStorage while the account looks empty.
    Keyed on the client's own log ids, so re-running it after a partial failure
    re-sends the same rows harmlessly instead of duplicating the history.
    """
    user = await get_current_user(authorization)
    if not body.logs:
        return {"imported": 0, "skipped": 0, "total": 0}

    ops = []
    for item in body.logs:
        stamp = item.created_at or iso_now()
        ops.append(
            UpdateOne(
                {"id": item.id, "user_id": user["id"]},
                {
                    "$setOnInsert": {
                        "id": item.id,
                        "user_id": user["id"],
                        "nostril_state": item.nostril_state,
                        "blend": item.blend,
                        "mood_score": item.mood_score,
                        "energy_score": item.energy_score,
                        "focus_score": item.focus_score,
                        "note": item.note,
                        "tags": item.tags,
                        "local_date": item.local_date,
                        "local_hour": item.local_hour,
                        "created_at": stamp,
                        "updated_at": item.updated_at or stamp,
                    }
                },
                upsert=True,
            )
        )

    result = await db.breath_logs.bulk_write(ops, ordered=False)
    imported = result.upserted_count
    return {
        "imported": imported,
        "skipped": len(ops) - imported,
        "total": len(ops),
    }


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
    # No date filter returns the whole history, matching local mode (used by the
    # migration to read everything back).
    logs = await db.breath_logs.find(query, {"_id": 0}).sort("created_at", 1).to_list(10000)
    return logs


@api_router.delete("/logs")
async def delete_day(date: str, authorization: Optional[str] = Header(default=None)):
    """Clear one whole day — e.g. a burst of accidental logs.

    ?date= is required so this can never wipe the entire history by accident.
    """
    user = await get_current_user(authorization)
    result = await db.breath_logs.delete_many({"user_id": user["id"], "local_date": date})
    return {"deleted": result.deleted_count}


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
    await ensure_settings(user["id"])
    # exclude_unset so omitted keys keep their stored value instead of snapping
    # back to a default — a client that knows nothing about `skin` must not
    # erase the user's choice of it.
    updates = body.model_dump(exclude_unset=True, exclude_none=True)
    # Accept the legacy minutes field from older clients, store seconds.
    minutes = updates.pop("reminder_interval_minutes", None)
    if minutes is not None and "reminder_interval_seconds" not in updates:
        updates["reminder_interval_seconds"] = minutes * 60
    if not updates:
        return await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    updates["updated_at"] = iso_now()
    await db.user_settings.update_one({"user_id": user["id"]}, {"$set": updates})
    return await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0})


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
    # Enforces idempotent create/import: a replayed client id can never become a
    # second row for the same user.
    await db.breath_logs.create_index([("user_id", 1), ("id", 1)], unique=True)
    await db.user_settings.create_index("user_id", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
