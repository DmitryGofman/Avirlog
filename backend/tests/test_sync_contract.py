"""Contract tests for the routes cloud sync depends on.

These run against an in-memory Mongo (no live server, no network), so they can
gate a deploy in CI. They cover the places the backend had drifted behind the
app: idempotent create, `blend`, whole-day delete, the full settings schema, and
the bulk import the local->cloud migration posts to.
"""
import os

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "avirlog_test")
os.environ.setdefault("JWT_SECRET", "test-secret")

import server  # noqa: E402


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(server, "db", AsyncMongoMockClient()["avirlog_test"])
    # Constructed without `with`, so the app's startup hook (create_index) does
    # not run — index creation is not what these tests are checking.
    return TestClient(server.app)


@pytest.fixture
def headers(client):
    r = client.post("/api/auth/register", json={"email": "a@b.co", "password": "breathe123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def make_log(**over):
    body = {"nostril_state": "left", "local_date": "2026-07-20", "local_hour": 9}
    body.update(over)
    return body


# ---------- idempotent create ----------

def test_client_id_is_honoured(client, headers):
    r = client.post("/api/logs", json=make_log(id="local_abc"), headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == "local_abc"


def test_replayed_create_does_not_duplicate(client, headers):
    first = client.post("/api/logs", json=make_log(id="local_abc"), headers=headers).json()
    second = client.post("/api/logs", json=make_log(id="local_abc"), headers=headers).json()
    assert first["id"] == second["id"] == "local_abc"
    assert second["created_at"] == first["created_at"]
    rows = client.get("/api/logs?date=2026-07-20", headers=headers).json()
    assert len(rows) == 1


def test_create_without_id_still_generates_one(client, headers):
    a = client.post("/api/logs", json=make_log(), headers=headers).json()
    b = client.post("/api/logs", json=make_log(), headers=headers).json()
    assert a["id"] != b["id"]


def test_same_client_id_is_per_user(client, headers):
    """Two guests can both hold a log id like "local_abc"; neither may win."""
    client.post("/api/logs", json=make_log(id="local_abc", nostril_state="left"), headers=headers)
    other = client.post("/api/auth/register", json={"email": "c@d.co", "password": "breathe123"})
    h2 = {"Authorization": f"Bearer {other.json()['token']}"}
    r = client.post("/api/logs", json=make_log(id="local_abc", nostril_state="right"), headers=h2)
    assert r.status_code == 200, r.text
    assert r.json()["nostril_state"] == "right"


# ---------- blend (advanced logging) ----------

def test_blend_round_trips_on_create(client, headers):
    r = client.post("/api/logs", json=make_log(blend=70), headers=headers)
    assert r.json()["blend"] == 70


def test_blend_is_patchable(client, headers):
    log = client.post("/api/logs", json=make_log(), headers=headers).json()
    r = client.patch(f"/api/logs/{log['id']}", json={"blend": 25}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["blend"] == 25


def test_blend_out_of_range_is_rejected(client, headers):
    assert client.post("/api/logs", json=make_log(blend=101), headers=headers).status_code == 422


# ---------- whole-day delete ----------

def test_delete_day_removes_only_that_day(client, headers):
    client.post("/api/logs", json=make_log(local_date="2026-07-20"), headers=headers)
    client.post("/api/logs", json=make_log(local_date="2026-07-20"), headers=headers)
    client.post("/api/logs", json=make_log(local_date="2026-07-21"), headers=headers)
    r = client.request("DELETE", "/api/logs?date=2026-07-20", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] == 2
    assert client.get("/api/logs?date=2026-07-20", headers=headers).json() == []
    assert len(client.get("/api/logs?date=2026-07-21", headers=headers).json()) == 1


def test_delete_day_requires_a_date(client, headers):
    """Without ?date= this must not become "delete my whole history"."""
    assert client.request("DELETE", "/api/logs", headers=headers).status_code == 422


# ---------- settings ----------

def test_settings_defaults_match_the_app(client, headers):
    s = client.get("/api/settings", headers=headers).json()
    assert s["skin"] == "banners"
    assert s["advanced_logging"] is False
    assert s["reminder_interval_seconds"] == 3600
    assert s["quiet_start_minutes"] == 22 * 60
    assert s["quiet_end_minutes"] == 7 * 60


def test_settings_persist_the_new_fields(client, headers):
    body = {
        "skin": "instrument",
        "advanced_logging": True,
        "quiet_hours_enabled": True,
        "reminder_interval_seconds": 900,
    }
    r = client.put("/api/settings", json=body, headers=headers)
    assert r.status_code == 200, r.text
    for k, v in body.items():
        assert r.json()[k] == v


def test_partial_put_does_not_reset_other_fields(client, headers):
    client.put("/api/settings", json={"skin": "instrument", "advanced_logging": True}, headers=headers)
    after = client.put("/api/settings", json={"theme": "dark"}, headers=headers).json()
    assert after["theme"] == "dark"
    assert after["skin"] == "instrument"
    assert after["advanced_logging"] is True


def test_legacy_minutes_field_converts_to_seconds(client, headers):
    r = client.put("/api/settings", json={"reminder_interval_minutes": 30}, headers=headers)
    assert r.json()["reminder_interval_seconds"] == 1800


def test_unknown_skin_is_rejected(client, headers):
    assert client.put("/api/settings", json={"skin": "nope"}, headers=headers).status_code == 422


# ---------- bulk import (the migration) ----------

def imported(**over):
    body = {
        "id": "local_1",
        "nostril_state": "left",
        "local_date": "2026-07-01",
        "local_hour": 8,
        "created_at": "2026-07-01T08:00:00+00:00",
        "updated_at": "2026-07-01T08:00:00+00:00",
    }
    body.update(over)
    return body


def test_import_preserves_ids_and_timestamps(client, headers):
    r = client.post("/api/logs/import", json={"logs": [imported(blend=60)]}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == {"imported": 1, "skipped": 0, "total": 1}
    rows = client.get("/api/logs?date=2026-07-01", headers=headers).json()
    assert len(rows) == 1
    assert rows[0]["id"] == "local_1"
    assert rows[0]["created_at"] == "2026-07-01T08:00:00+00:00"
    assert rows[0]["blend"] == 60


def test_reimport_is_a_no_op(client, headers):
    payload = {"logs": [imported(id="local_1"), imported(id="local_2", local_hour=9)]}
    first = client.post("/api/logs/import", json=payload, headers=headers).json()
    second = client.post("/api/logs/import", json=payload, headers=headers).json()
    assert first == {"imported": 2, "skipped": 0, "total": 2}
    assert second == {"imported": 0, "skipped": 2, "total": 2}
    assert len(client.get("/api/logs?date=2026-07-01", headers=headers).json()) == 2


def test_import_does_not_overwrite_edits_made_since(client, headers):
    client.post("/api/logs/import", json={"logs": [imported(note=None)]}, headers=headers)
    client.patch("/api/logs/local_1", json={"note": "edited on the server"}, headers=headers)
    client.post("/api/logs/import", json={"logs": [imported(note=None)]}, headers=headers)
    rows = client.get("/api/logs?date=2026-07-01", headers=headers).json()
    assert rows[0]["note"] == "edited on the server"


def test_import_is_scoped_to_the_caller(client, headers):
    client.post("/api/logs/import", json={"logs": [imported()]}, headers=headers)
    other = client.post("/api/auth/register", json={"email": "e@f.co", "password": "breathe123"})
    h2 = {"Authorization": f"Bearer {other.json()['token']}"}
    assert client.get("/api/logs?date=2026-07-01", headers=h2).json() == []


def test_empty_import_is_accepted(client, headers):
    r = client.post("/api/logs/import", json={"logs": []}, headers=headers)
    assert r.json() == {"imported": 0, "skipped": 0, "total": 0}


def test_import_requires_auth(client):
    assert client.post("/api/logs/import", json={"logs": [imported()]}).status_code == 401


def test_import_rejects_a_log_with_no_id(client, headers):
    body = imported()
    del body["id"]
    assert client.post("/api/logs/import", json={"logs": [body]}, headers=headers).status_code == 422
