#!/usr/bin/env python3
"""Pre-flight contract check for a deployed AvirLog API.

Run this against the live URL *before* flipping ACCOUNTS_ENABLED, so a stale
deploy or a missing route shows up here instead of in a shipped build. It
exercises every route and field the app actually depends on, including the ones
the backend used to be missing (idempotent create, `blend`, whole-day delete,
the full settings schema, bulk import).

    python backend/preflight.py https://avirlog-api.onrender.com

With no argument it reads EXPO_PUBLIC_BACKEND_URL. Exit code is 0 only if every
check passes, so it can gate a release.

It registers a throwaway account, writes a handful of logs to it, and deletes
the account at the end — it never touches existing users' data. A free-tier
host may be asleep, so the first request is given a long timeout.
"""
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

TIMEOUT = 90  # generous: a sleeping free-tier instance cold-starts slowly

GREEN, RED, YELLOW, DIM, RESET = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"
if not sys.stdout.isatty():
    GREEN = RED = YELLOW = DIM = RESET = ""

results: list[tuple[str, bool, str]] = []


def request(base, method, path, body=None, token=None, timeout=TIMEOUT):
    """Return (status, parsed_json_or_text). Never raises on an HTTP error."""
    url = f"{base}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw
    except (urllib.error.URLError, TimeoutError) as e:
        return 0, str(e)


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    mark = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
    line = f"  {mark}  {name}"
    if detail and not ok:
        line += f"\n        {DIM}{detail}{RESET}"
    print(line, flush=True)


def section(title):
    print(f"\n{title}")


def main() -> int:
    base = (len(sys.argv) > 1 and sys.argv[1]) or os.getenv("EXPO_PUBLIC_BACKEND_URL")
    if not base:
        print("usage: preflight.py <base-url>   (or set EXPO_PUBLIC_BACKEND_URL)")
        return 2
    base = base.rstrip("/")
    api = f"{base}/api"
    print(f"AvirLog API pre-flight against {base}")
    print(f"{DIM}(a free-tier instance may need ~30s to wake up){RESET}")

    # ---------- reachability ----------
    section("Reachability")
    status, health = request(base, "GET", "/health")
    check(
        "GET /health returns ok",
        status == 200 and isinstance(health, dict) and health.get("status") == "ok",
        f"got {status}: {health!r}",
    )
    if status == 0:
        print(f"\n{RED}Cannot reach the API at all — stopping.{RESET}")
        print(f"{DIM}{health}{RESET}")
        return 1

    # ---------- auth ----------
    section("Auth")
    # A real-looking domain: email-validator rejects reserved TLDs like .test.
    email = f"preflight_{uuid.uuid4().hex[:10]}@avirlog.com"
    status, reg = request(api, "POST", "/auth/register", {"email": email, "password": "preflight123"})
    ok_reg = status == 200 and isinstance(reg, dict) and "token" in reg
    check("POST /api/auth/register issues a token", ok_reg, f"got {status}: {reg!r}")
    if not ok_reg:
        print(f"\n{RED}Cannot create an account — the remaining checks need one.{RESET}")
        return 1
    token = reg["token"]
    user_id = reg["user"]["id"]

    status, me = request(api, "GET", "/auth/me", token=token)
    check("GET /api/auth/me resolves the token", status == 200 and me.get("id") == user_id, f"got {status}: {me!r}")

    status, _ = request(api, "GET", "/logs?date=2026-01-01")
    check("unauthenticated data route is rejected", status == 401, f"expected 401, got {status}")

    status, login = request(api, "POST", "/auth/login", {"email": email, "password": "preflight123"})
    check("POST /api/auth/login works", status == 200 and "token" in login, f"got {status}: {login!r}")

    # ---------- logs: idempotency ----------
    section("Logs — idempotent create (migration depends on this)")
    day = "2026-01-02"
    client_id = f"preflight_{uuid.uuid4().hex[:8]}"
    log_body = {"id": client_id, "nostril_state": "left", "local_date": day, "local_hour": 9}

    status, first = request(api, "POST", "/logs", log_body, token=token)
    honoured = status == 200 and isinstance(first, dict) and first.get("id") == client_id
    check(
        "POST /api/logs honours a client-supplied id",
        honoured,
        f"got {status}: id={first.get('id') if isinstance(first, dict) else first!r} — "
        "a server-generated id here means a retried write duplicates rows",
    )

    status, second = request(api, "POST", "/logs", log_body, token=token)
    status_l, rows = request(api, "GET", f"/logs?date={day}", token=token)
    check(
        "replaying the same id does not duplicate",
        status == 200 and status_l == 200 and isinstance(rows, list) and len(rows) == 1,
        f"expected 1 row for {day}, got {len(rows) if isinstance(rows, list) else rows!r}",
    )

    # ---------- logs: blend ----------
    section("Logs — blend (advanced logging)")
    status, blended = request(
        api, "POST", "/logs",
        {"nostril_state": "both", "blend": 70, "local_date": day, "local_hour": 10},
        token=token,
    )
    check(
        "POST /api/logs stores blend",
        status == 200 and isinstance(blended, dict) and blended.get("blend") == 70,
        f"got {status}: blend={blended.get('blend') if isinstance(blended, dict) else blended!r} — "
        "dropped blend means advanced-logging data is lost on sync",
    )
    if isinstance(blended, dict) and blended.get("id"):
        status, patched = request(api, "PATCH", f"/logs/{blended['id']}", {"blend": 25}, token=token)
        check(
            "PATCH /api/logs/{id} updates blend",
            status == 200 and patched.get("blend") == 25,
            f"got {status}: {patched!r}",
        )

    # ---------- logs: aggregation + day delete ----------
    section("Logs — history and whole-day delete")
    status, dates = request(api, "GET", "/logs/dates", token=token)
    shape_ok = (
        status == 200
        and isinstance(dates, list)
        and any(
            isinstance(d, dict) and {"date", "count", "left", "right", "both"} <= set(d)
            for d in dates
        )
    )
    check("GET /api/logs/dates returns per-day counts", shape_ok, f"got {status}: {dates!r}")

    status, deleted = request(api, "DELETE", f"/logs?date={day}", token=token)
    check(
        "DELETE /api/logs?date= clears a whole day",
        status == 200 and isinstance(deleted, dict) and deleted.get("deleted", 0) >= 2,
        f"got {status}: {deleted!r} — a 404/405 here means the History day-delete "
        "button will fail once signed in",
    )

    status, after = request(api, "GET", f"/logs?date={day}", token=token)
    check("the day is actually empty afterwards", status == 200 and after == [], f"got {status}: {after!r}")

    # ---------- settings ----------
    section("Settings — full schema the app reads")
    expected_fields = {
        "reminder_enabled",
        "reminder_interval_seconds",
        "quiet_hours_enabled",
        "quiet_start_minutes",
        "quiet_end_minutes",
        "theme",
        "mood_journaling",
        "skin",
        "advanced_logging",
    }
    status, settings = request(api, "GET", "/settings", token=token)
    missing = expected_fields - set(settings) if isinstance(settings, dict) else expected_fields
    check(
        "GET /api/settings returns every field",
        status == 200 and not missing,
        f"missing {sorted(missing)} — the app would fall back to defaults for these",
    )

    status, saved = request(
        api, "PUT", "/settings",
        {"skin": "instrument", "advanced_logging": True, "reminder_interval_seconds": 900},
        token=token,
    )
    check(
        "PUT /api/settings persists skin and advanced_logging",
        status == 200
        and isinstance(saved, dict)
        and saved.get("skin") == "instrument"
        and saved.get("advanced_logging") is True
        and saved.get("reminder_interval_seconds") == 900,
        f"got {status}: {saved!r}",
    )

    status, patched_settings = request(api, "PUT", "/settings", {"theme": "dark"}, token=token)
    check(
        "a partial PUT does not reset the other fields",
        status == 200
        and isinstance(patched_settings, dict)
        and patched_settings.get("theme") == "dark"
        and patched_settings.get("skin") == "instrument",
        f"got {status}: {patched_settings!r} — skin was reset, so saving one "
        "setting would silently clear others",
    )

    # ---------- bulk import ----------
    section("Bulk import — the local→cloud migration")
    import_day = "2026-01-03"
    payload = {
        "logs": [
            {
                "id": f"preflight_import_{i}",
                "nostril_state": "right",
                "blend": 40,
                "local_date": import_day,
                "local_hour": 7,
                "created_at": "2026-01-03T07:00:00+00:00",
                "updated_at": "2026-01-03T07:00:00+00:00",
            }
            for i in range(3)
        ]
    }
    status, imp = request(api, "POST", "/logs/import", payload, token=token)
    check(
        "POST /api/logs/import accepts a batch",
        status == 200 and isinstance(imp, dict) and imp.get("imported") == 3,
        f"got {status}: {imp!r} — a 404 here means the deploy predates the "
        "migration endpoint (redeploy the backend)",
    )

    status, again = request(api, "POST", "/logs/import", payload, token=token)
    check(
        "re-importing the same batch is a no-op",
        status == 200 and isinstance(again, dict) and again.get("imported") == 0 and again.get("skipped") == 3,
        f"got {status}: {again!r} — a retried migration would duplicate history",
    )

    status, imported_rows = request(api, "GET", f"/logs?date={import_day}", token=token)
    ts_ok = (
        status == 200
        and isinstance(imported_rows, list)
        and len(imported_rows) == 3
        and all(r.get("created_at") == "2026-01-03T07:00:00+00:00" for r in imported_rows)
    )
    check(
        "imported logs keep their original timestamps",
        ts_ok,
        f"got {status}: {imported_rows!r} — otherwise a whole history collapses onto migration day",
    )
    check(
        "imported logs keep blend",
        isinstance(imported_rows, list)
        and len(imported_rows) == 3
        and all(r.get("blend") == 40 for r in imported_rows),
        f"got {imported_rows!r}",
    )

    # ---------- export ----------
    section("Export (App Store data-access requirement)")
    status, export = request(api, "GET", "/export", token=token)
    check(
        "GET /api/export returns user, settings and logs",
        status == 200 and isinstance(export, dict) and {"user", "settings", "logs"} <= set(export),
        f"got {status}: {export!r}",
    )

    # ---------- account deletion ----------
    section("Account deletion (Apple requires this once accounts exist)")
    status, gone = request(api, "DELETE", "/auth/account", token=token)
    check("DELETE /api/auth/account succeeds", status == 200, f"got {status}: {gone!r}")

    status, _ = request(api, "GET", "/auth/me", token=token)
    check("the token stops working afterwards", status == 401, f"expected 401, got {status}")

    status, relogin = request(api, "POST", "/auth/login", {"email": email, "password": "preflight123"})
    check("the deleted account cannot log back in", status == 401, f"expected 401, got {status}")

    # ---------- summary ----------
    failed = [name for name, ok, _ in results if not ok]
    print(f"\n{'-' * 60}")
    if failed:
        print(f"{RED}{len(failed)} of {len(results)} checks failed:{RESET}")
        for name in failed:
            print(f"  - {name}")
        print(
            f"\n{YELLOW}Do not enable ACCOUNTS_ENABLED until these pass.{RESET}\n"
            f"{DIM}Most failures here mean the deployed backend is older than this "
            f"repo — redeploy it and re-run.{RESET}"
        )
        return 1

    print(f"{GREEN}All {len(results)} checks passed.{RESET}")
    print(f"{DIM}The deployed API matches what the app expects; the throwaway "
          f"account was deleted.{RESET}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
