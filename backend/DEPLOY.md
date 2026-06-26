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

## 3. Point the app at it

1. Set the backend URL for the build. In `frontend/eas.json`, add to the
   `preview`/`production` profiles:
   ```json
   "env": { "EXPO_PUBLIC_BACKEND_URL": "https://<your-url>" }
   ```
   (or `eas env:create EXPO_PUBLIC_BACKEND_URL`).
2. Enable accounts: in `frontend/src/lib/config.ts` set `ACCOUNTS_ENABLED = true`.
3. Rebuild the app (`eas build ...`). "Sign in to sync" reappears in Settings and
   the app talks to the backend when signed in; guests still work offline.

## Notes
- Google sign-in stays disabled (`EMERGENT_GOOGLE_ENABLED=false`) — it depends on
  an Emergent sandbox and isn't production-ready. If you later add real Google
  login, Apple will also require "Sign in with Apple."
- Local run: `cp .env.example .env`, fill it in, then
  `pip install -r requirements-prod.txt && python server.py`.
