# AvirLog — PRD

## Original Problem Statement
Build a production-ready mobile-first app "AvirLog": a breath-awareness and self-regulation journal for tracking nostril dominance (Left=Ida/calming, Right=Pingala/active, Both=Sushumna/balanced), energy, mood, focus, tags, and time of day. Minimal, calm, serious — Apple Health × Stoic aesthetic. Originally specced Next.js+Supabase; user confirmed Expo (React Native) + FastAPI + MongoDB instead.

## User Choices
- Stack: Expo + FastAPI + MongoDB
- Auth: Email/password (JWT) + Emergent-managed Google login
- Reminders: settings UI + placeholder architecture (no push for MVP)
- Theme: Light + dark mode toggle

## Architecture
- Backend: FastAPI single `server.py`, all routes under `/api`. Motor/MongoDB, uuid string ids, `_id` excluded everywhere.
- Auth: dual-token `get_current_user` — JWT (pyjwt, bcrypt via passlib) OR Emergent Google session token (`user_sessions` collection, 7-day expiry). JWT_SECRET in backend/.env.
- Collections: `users`, `user_sessions`, `breath_logs` (nostril_state, mood/energy/focus 1-10 nullable, note, tags[], local_date, local_hour, created/updated_at), `user_settings` (reminder_enabled, reminder_interval_minutes, theme). Indexes created on startup.
- Frontend: expo-router. `app/index.tsx` landing/login → `app/(tabs)/{log,today,insights,history,settings}.tsx`. `app/auth.tsx` deep-link route for mobile Google redirect.
- Contexts: AuthContext (JWT + Google session flow per playbook), ThemeContext (light/dark, persisted). Toast provider (no Alerts). Custom Modal bottom Sheet + shared LogForm (sliders via @react-native-community/slider, tag pills, note).
- Design: design_guidelines.json tokens in `src/theme/theme.ts` (sage/rust/stone state colors), Geist fonts in assets/fonts, keyboard via react-native-keyboard-controller 1.18.5.
- Analytics computed client-side from raw logs (today summary; insights from 30-day range). Pattern cards gated at >=10 logs over >=3 days.

## Implemented (2026-06-10) — MVP
- Email/password + Google auth, route protection, sign out, delete account
- Quick Log: one-tap Left/Right/Both → instant save + optional context sheet (mood/energy/focus sliders, 9 tags, note, Skip details)
- Today: timeline + summary (total, % L/R/B bar, avg M/E/F, top tag), pull-to-refresh, empty state
- Insights: 7-day stacked dominance chart, mood/energy/focus daily-avg charts, time-of-day distribution, plain-language correlation cards (gated)
- History: dates list with mini distribution bars → day view with edit (full sheet incl. state picker) and delete (confirm sheet)
- Settings: email/provider, dark mode, reminder enable + interval (30/60/120/custom 5–1440) persisted to backend (placeholder for push), export (Share on mobile / clipboard on web)
- Tested: 17/17 backend pytest + full frontend E2E pass (iteration_1)

## Backlog
- P0: none outstanding
- P1: Local scheduled reminder notifications (expo-notifications, needs native build) wired to saved interval; password reset
- P2: Calendar grid view in History; CSV export; weekly email digest; insights date-range selector

## Test Credentials
See /app/memory/test_credentials.md (tester@avirlog.com / breathe123)
