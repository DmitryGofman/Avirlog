# Deploying the AvirLog API

The app works fully offline without this backend. Deploy it only when you want
**account sign-in + cloud sync** (a v1.1 feature). It's email/password only.

## 1. Database — MongoDB Atlas (free)

1. Create an account at https://www.mongodb.com/atlas and create a free **M0**
   cluster.
2. **Database Access** → add a database user (username + password).
3. **Network Access** → allow access from anywhere (`0.0.0.0/0`) for simplicity,
   or restrict to your host's IPs.
4. **Connect → Drivers** → copy the connection string. It looks like:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

## 2. API — Render (free tier)

1. Create an account at https://render.com and connect your GitHub.
2. **New → Blueprint**, pick this repo. Render reads `render.yaml` and builds
   `backend/Dockerfile`.
3. When prompted, set **`MONGO_URL`** to your Atlas string (the other env vars are
   filled in by the blueprint; `JWT_SECRET` is auto-generated).
4. Deploy. You'll get a URL like `https://avirlog-api.onrender.com`.
5. Verify: open `https://<your-url>/health` → `{"status":"ok"}`.

> Free Render web services sleep after ~15 min idle, so the first request after
> idle is slow (cold start). Upgrade to a paid instance for always-on.

Any container host works the same way (Railway, Fly.io, a VPS) — they just build
the Dockerfile and need the same env vars (see `.env.example`).

## 3. Pre-flight the deploy — do this before enabling accounts

The app expects more of the API than the original version shipped (idempotent
create, `blend`, whole-day delete, the full settings schema, bulk import). Check
the *deployed* instance really has it:

```bash
python backend/preflight.py https://<your-url>
```

It registers a throwaway account, exercises every route the app depends on, and
deletes the account again. Exit code 0 means the deploy matches the app; any
failure names the route and says what would break. **A wall of failures almost
always means the deployed backend is older than this repo — redeploy and re-run.**

Only stdlib, so no install needed. The first request can take ~30s if the free
instance is asleep.

The same checks run without a network or a Mongo, for CI:

```bash
pip install -r backend/requirements-prod.txt pytest mongomock_motor
python -m pytest backend/tests/test_sync_contract.py
```

## 4. Point the app at it

1. Set the backend URL for the build. In `frontend/eas.json`, add to the
   `preview`/`production` profiles:
   ```json
   "env": { "EXPO_PUBLIC_BACKEND_URL": "https://<your-url>" }
   ```
   (or `eas env:create EXPO_PUBLIC_BACKEND_URL`).
2. Enable accounts: in `frontend/src/lib/config.ts` set `ACCOUNTS_ENABLED = true`.
3. Tighten `CORS_ORIGINS` from `*` to the origins you actually serve.
4. Rebuild the app (`eas build ...`). "Sign in to sync" reappears in Settings and
   the app talks to the backend when signed in; guests still work offline.

## 5. What happens to a guest's existing logs

The first sign-in uploads the device's logs into the account
(`frontend/src/lib/migrate.ts` → `POST /api/logs/import`). Without it a signing-in
user would see an empty history while their logs sat orphaned in AsyncStorage.

- **Idempotent** — rows keep the ids they already have on-device, and the import
  upserts, so an interrupted run is simply retried on the next launch.
- **Non-destructive** — local data is never cleared; signing out still shows it.
- **Claimed once** — a history uploaded into one account is not later uploaded
  into a different one. The same account re-runs only if the device has picked up
  new guest logs since.
- Progress is exposed as `syncState` on the auth context (`uploading` / `done` /
  `error`) if you want to surface it in the UI.

## Notes
- Google sign-in stays disabled (`EMERGENT_GOOGLE_ENABLED=false`) — it depends on
  an Emergent sandbox and isn't production-ready. If you later add real Google
  login, Apple will also require "Sign in with Apple."
- Local run: `cp .env.example .env`, fill it in, then
  `pip install -r requirements-prod.txt && python server.py`.
