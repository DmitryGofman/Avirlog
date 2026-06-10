"""AvirLog backend integration tests."""
import os
import time
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if "EXPO_PUBLIC_BACKEND_URL" in os.environ else None
# Fallback: read from frontend .env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

API = f"{BASE_URL}/api"
TESTER_EMAIL = "tester@avirlog.com"
TESTER_PASSWORD = "breathe123"


# ----------------- Fixtures -----------------

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def tester_token(session):
    # Ensure tester account exists (register if missing); then login
    r = session.post(f"{API}/auth/register", json={"email": TESTER_EMAIL, "password": TESTER_PASSWORD})
    # 200 ok (new) or 400 already exists
    assert r.status_code in (200, 400), r.text
    if r.status_code == 200:
        return r.json()["token"]
    r = session.post(f"{API}/auth/login", json={"email": TESTER_EMAIL, "password": TESTER_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def tester_headers(tester_token):
    return {"Authorization": f"Bearer {tester_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def secondary_user(session):
    """A second user to verify user scoping."""
    email = f"test_userb_{uuid.uuid4().hex[:8]}@avirlog.com"
    r = session.post(f"{API}/auth/register", json={"email": email, "password": "secretpw"})
    assert r.status_code == 200, r.text
    return {"email": email, "token": r.json()["token"], "user_id": r.json()["user"]["id"]}


# ----------------- Auth -----------------

class TestAuth:
    def test_register_duplicate(self, session):
        r = session.post(f"{API}/auth/register", json={"email": TESTER_EMAIL, "password": TESTER_PASSWORD})
        # Should already exist after fixture in test_tester_token
        # Force register to ensure account first via login flow then duplicate
        session.post(f"{API}/auth/register", json={"email": TESTER_EMAIL, "password": TESTER_PASSWORD})
        r2 = session.post(f"{API}/auth/register", json={"email": TESTER_EMAIL, "password": TESTER_PASSWORD})
        assert r2.status_code == 400

    def test_register_new(self, session):
        email = f"test_new_{uuid.uuid4().hex[:8]}@avirlog.com"
        r = session.post(f"{API}/auth/register", json={"email": email, "password": "secretpw"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and "user" in body
        assert body["user"]["email"] == email

    def test_login_correct(self, session, tester_token):
        _ = tester_token  # ensures registered
        r = session.post(f"{API}/auth/login", json={"email": TESTER_EMAIL, "password": TESTER_PASSWORD})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": TESTER_EMAIL, "password": "wrongpass!!"})
        assert r.status_code == 401

    def test_me_with_token(self, session, tester_headers):
        r = session.get(f"{API}/auth/me", headers=tester_headers)
        assert r.status_code == 200
        assert r.json()["email"] == TESTER_EMAIL

    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# ----------------- Logs -----------------

def today_str():
    return datetime.now(timezone.utc).date().isoformat()


class TestLogs:
    def test_create_and_get_by_date(self, session, tester_headers):
        payload = {
            "nostril_state": "left",
            "tags": ["Work"],
            "local_date": today_str(),
            "local_hour": 10,
        }
        r = session.post(f"{API}/logs", headers=tester_headers, json=payload)
        assert r.status_code == 200, r.text
        log = r.json()
        assert log["nostril_state"] == "left"
        assert log["local_date"] == payload["local_date"]
        assert "_id" not in log
        log_id = log["id"]

        r2 = session.get(f"{API}/logs", headers=tester_headers, params={"date": payload["local_date"]})
        assert r2.status_code == 200
        ids = [l["id"] for l in r2.json()]
        assert log_id in ids

    def test_list_logs_requires_filter(self, session, tester_headers):
        r = session.get(f"{API}/logs", headers=tester_headers)
        assert r.status_code == 400

    def test_list_logs_range(self, session, tester_headers):
        d = today_str()
        r = session.get(f"{API}/logs", headers=tester_headers, params={"start": d, "end": d})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_logs_dates(self, session, tester_headers):
        # ensure at least one log exists today
        session.post(f"{API}/logs", headers=tester_headers, json={
            "nostril_state": "both",
            "tags": [],
            "local_date": today_str(),
            "local_hour": 11,
        })
        r = session.get(f"{API}/logs/dates", headers=tester_headers)
        assert r.status_code == 200
        rows = r.json()
        assert any(row["date"] == today_str() for row in rows)
        row = next(row for row in rows if row["date"] == today_str())
        for k in ("count", "left", "right", "both"):
            assert k in row

    def test_patch_log(self, session, tester_headers):
        r = session.post(f"{API}/logs", headers=tester_headers, json={
            "nostril_state": "right",
            "tags": [],
            "local_date": today_str(),
            "local_hour": 12,
        })
        log_id = r.json()["id"]
        patch = {"mood_score": 7, "energy_score": 6, "focus_score": 8, "note": "feeling good", "tags": ["Work", "Trading"], "nostril_state": "left"}
        r2 = session.patch(f"{API}/logs/{log_id}", headers=tester_headers, json=patch)
        assert r2.status_code == 200, r2.text
        updated = r2.json()
        assert updated["mood_score"] == 7
        assert updated["nostril_state"] == "left"
        assert set(updated["tags"]) == {"Work", "Trading"}

    def test_delete_log(self, session, tester_headers):
        r = session.post(f"{API}/logs", headers=tester_headers, json={
            "nostril_state": "right",
            "tags": [],
            "local_date": today_str(),
            "local_hour": 13,
        })
        log_id = r.json()["id"]
        r2 = session.delete(f"{API}/logs/{log_id}", headers=tester_headers)
        assert r2.status_code == 200
        # Verify removed
        r3 = session.get(f"{API}/logs", headers=tester_headers, params={"date": today_str()})
        assert log_id not in [l["id"] for l in r3.json()]
        # Second delete -> 404
        r4 = session.delete(f"{API}/logs/{log_id}", headers=tester_headers)
        assert r4.status_code == 404

    def test_user_scoping(self, session, tester_headers, secondary_user):
        # Create log as tester
        r = session.post(f"{API}/logs", headers=tester_headers, json={
            "nostril_state": "left",
            "tags": [],
            "local_date": today_str(),
            "local_hour": 14,
        })
        log_id = r.json()["id"]
        b_headers = {"Authorization": f"Bearer {secondary_user['token']}", "Content-Type": "application/json"}
        # User B cannot patch
        r2 = session.patch(f"{API}/logs/{log_id}", headers=b_headers, json={"mood_score": 1})
        assert r2.status_code == 404
        # User B cannot delete
        r3 = session.delete(f"{API}/logs/{log_id}", headers=b_headers)
        assert r3.status_code == 404


# ----------------- Settings -----------------

class TestSettings:
    def test_get_settings_autocreate(self, session, tester_headers):
        r = session.get(f"{API}/settings", headers=tester_headers)
        assert r.status_code == 200
        data = r.json()
        for k in ("reminder_enabled", "reminder_interval_minutes", "theme"):
            assert k in data

    def test_put_settings(self, session, tester_headers):
        payload = {"reminder_enabled": True, "reminder_interval_minutes": 120, "theme": "dark"}
        r = session.put(f"{API}/settings", headers=tester_headers, json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["reminder_enabled"] is True
        assert data["reminder_interval_minutes"] == 120
        assert data["theme"] == "dark"
        # GET verifies persistence
        r2 = session.get(f"{API}/settings", headers=tester_headers)
        assert r2.json()["theme"] == "dark"
        # revert to light
        session.put(f"{API}/settings", headers=tester_headers, json={"reminder_enabled": False, "reminder_interval_minutes": 60, "theme": "light"})


# ----------------- Export & Account -----------------

class TestExportAndAccount:
    def test_export(self, session, tester_headers):
        r = session.get(f"{API}/export", headers=tester_headers)
        assert r.status_code == 200
        data = r.json()
        for k in ("exported_at", "user", "settings", "logs"):
            assert k in data
        assert data["user"]["email"] == TESTER_EMAIL

    def test_delete_account_removes_everything(self, session):
        # Create a throwaway user
        email = f"test_del_{uuid.uuid4().hex[:8]}@avirlog.com"
        r = session.post(f"{API}/auth/register", json={"email": email, "password": "secretpw"})
        assert r.status_code == 200
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        # Add a log
        session.post(f"{API}/logs", headers=h, json={
            "nostril_state": "left", "tags": [], "local_date": today_str(), "local_hour": 9
        })
        # Delete account
        r2 = session.delete(f"{API}/auth/account", headers=h)
        assert r2.status_code == 200
        # Now me with same token should fail
        r3 = session.get(f"{API}/auth/me", headers=h)
        assert r3.status_code == 401
