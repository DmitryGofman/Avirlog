#!/usr/bin/env bash
# Preflight for an AvirLog iOS release.
#
# Runs every mechanical check that is possible without a Mac, then reports
# which release credentials are available. Prints a PASS/WARN/FAIL line per
# check and a summary. Exits 1 if any blocker (FAIL) is present, 0 otherwise —
# WARNs never fail the run, they just narrow how far the release can go
# unattended.
#
# Usage:  bash .claude/skills/ship-ios/scripts/preflight.sh [--skip-slow]
#           --skip-slow   skip expo-doctor and the privacy-URL fetch

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
FRONTEND="$REPO_ROOT/frontend"
PRIVACY_URL="https://dmitrygofman.github.io/Avirlog/privacy"

SKIP_SLOW=0
[[ "${1:-}" == "--skip-slow" ]] && SKIP_SLOW=1

FAILS=0
WARNS=0
CAN_BUILD=1
CAN_SUBMIT=1

pass() { printf 'PASS  %s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*"; WARNS=$((WARNS + 1)); }
fail() { printf 'FAIL  %s\n' "$*"; FAILS=$((FAILS + 1)); }
info() { printf 'INFO  %s\n' "$*"; }
head2() { printf '\n=== %s ===\n' "$*"; }

head2 "Repo state"

cd "$REPO_ROOT" || { echo "FAIL  cannot cd to repo root"; exit 1; }

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
info "branch: $BRANCH"

if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  warn "working tree is dirty — commit or stash before building, so the build is reproducible from a commit"
  git status --porcelain | sed 's/^/        /'
else
  pass "working tree clean"
fi

head2 "Toolchain"

if command -v node >/dev/null 2>&1; then
  pass "node $(node -v)"
else
  fail "node not found — required for every step"
fi

if [[ -d "$FRONTEND/node_modules" ]]; then
  pass "frontend/node_modules present"
else
  fail "frontend/node_modules missing — run: cd frontend && yarn install"
fi

head2 "Code health"

if [[ -d "$FRONTEND/node_modules" ]]; then
  # Capture first, then test — piping into sed would mask tsc's exit status.
  if TSC_OUT="$(cd "$FRONTEND" && npx --no-install tsc --noEmit 2>&1)"; then
    pass "tsc --noEmit clean"
  else
    fail "TypeScript errors — fix before shipping"
    printf '%s\n' "$TSC_OUT" | tail -40 | sed 's/^/        /'
  fi

  if [[ $SKIP_SLOW -eq 0 ]]; then
    if DOCTOR_OUT="$(cd "$FRONTEND" && npx --yes expo-doctor 2>&1)"; then
      pass "expo-doctor clean"
    else
      warn "expo-doctor reported issues (not always blocking — read them):"
      printf '%s\n' "$DOCTOR_OUT" | tail -30 | sed 's/^/        /'
    fi
  else
    info "expo-doctor skipped (--skip-slow)"
  fi
else
  warn "skipping tsc/expo-doctor — dependencies not installed"
fi

head2 "Ship-mode invariants"

# The store build must be local-only: no backend URL baked in.
if [[ -n "${EXPO_PUBLIC_BACKEND_URL:-}" ]]; then
  fail "EXPO_PUBLIC_BACKEND_URL is set ('${EXPO_PUBLIC_BACKEND_URL}') — store builds must ship local-only. Unset it."
else
  pass "EXPO_PUBLIC_BACKEND_URL unset"
fi

if grep -rqs "EXPO_PUBLIC_BACKEND_URL" "$FRONTEND/.env" 2>/dev/null; then
  fail "frontend/.env defines EXPO_PUBLIC_BACKEND_URL — it would be baked into the build"
else
  pass "no EXPO_PUBLIC_BACKEND_URL in frontend/.env"
fi

if grep -qs "ACCOUNTS_ENABLED = false" "$FRONTEND/src/lib/config.ts"; then
  pass "ACCOUNTS_ENABLED is false (local-only mode)"
else
  warn "could not confirm ACCOUNTS_ENABLED=false in frontend/src/lib/config.ts — verify by hand"
fi

VERSION="$(grep -o '"version": *"[^"]*"' "$FRONTEND/app.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')"
REVISION="$(grep -o 'CODE_REVISION = "[^"]*"' "$FRONTEND/src/lib/buildInfo.ts" | sed 's/.*"\([^"]*\)".*/\1/')"
info "app.json version: ${VERSION:-unknown}"
info "CODE_REVISION:    ${REVISION:-unknown}  (bump this for every shipped build — Settings → About shows it)"

# The widget target only compiles if the plugin resolves at build time.
if [[ -f "$FRONTEND/targets/widget/expo-target.config.js" ]]; then
  if [[ -d "$FRONTEND/node_modules/@bacons/apple-targets" ]]; then
    pass "@bacons/apple-targets resolvable — widget target WILL be included"
  else
    warn "@bacons/apple-targets not installed — the widget/Live Activity target will be SILENTLY DROPPED from the build. Install it on the build side: cd frontend && npx expo install @bacons/apple-targets"
  fi
fi

head2 "Store prerequisites"

if [[ $SKIP_SLOW -eq 0 ]]; then
  CODE="$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 "$PRIVACY_URL" 2>/dev/null)"
  if [[ "$CODE" == "200" ]]; then
    pass "privacy policy URL live ($PRIVACY_URL)"
  else
    warn "privacy URL returned '${CODE:-no response}' — App Store Connect requires a working Privacy Policy URL. Enable GitHub Pages (Settings → Pages → Source = GitHub Actions) and let deploy-web.yml run."
  fi
else
  info "privacy URL check skipped (--skip-slow)"
fi

head2 "Release credentials"

if command -v eas >/dev/null 2>&1 || [[ -d "$FRONTEND/node_modules/eas-cli" ]]; then
  pass "eas-cli available"
else
  info "eas-cli not installed locally — commands below use 'npx eas-cli@latest'"
fi

if [[ -n "${EXPO_TOKEN:-}" ]]; then
  pass "EXPO_TOKEN set — non-interactive EAS commands possible"
else
  warn "EXPO_TOKEN not set — cannot run eas non-interactively from here"
  info "  fix: create a token at https://expo.dev/settings/access-tokens and export EXPO_TOKEN=<token>"
  CAN_BUILD=0
fi

if grep -qs '"projectId"' "$FRONTEND/app.json"; then
  pass "extra.eas.projectId present in app.json"
else
  warn "no extra.eas.projectId in frontend/app.json — the project has never been linked to EAS"
  info "  fix (one time, then commit app.json): cd frontend && npx eas-cli@latest init"
  CAN_BUILD=0
fi

if grep -qs -E 'ascApiKey|appleId|ascAppId' "$FRONTEND/eas.json"; then
  pass "submit credentials configured in eas.json"
else
  warn "eas.json submit.production is empty — 'eas submit' cannot run non-interactively"
  info "  fix: App Store Connect → Users and Access → Integrations → App Store Connect API → generate a key,"
  info "       then either run 'npx eas-cli@latest credentials' to store it with EAS, or set"
  info "       submit.production.ascApiKeyPath / ascApiKeyId / ascApiKeyIssuerId in frontend/eas.json."
  CAN_SUBMIT=0
fi

head2 "Summary"

printf 'blockers: %s   warnings: %s\n' "$FAILS" "$WARNS"

if [[ $FAILS -gt 0 ]]; then
  printf 'VERDICT: NOT READY — resolve the FAIL items above.\n'
elif [[ $CAN_BUILD -eq 1 && $CAN_SUBMIT -eq 1 ]]; then
  printf 'VERDICT: READY — build and submit can both run non-interactively from here.\n'
elif [[ $CAN_BUILD -eq 1 ]]; then
  printf 'VERDICT: READY TO BUILD — submit will need the Mac (see SUBMIT_STEPS.md step 5).\n'
else
  printf 'VERDICT: CODE IS READY, CREDENTIALS ARE NOT — run the release from the Mac using SUBMIT_STEPS.md, or set up EXPO_TOKEN + eas init to automate it.\n'
fi

exit $(( FAILS > 0 ? 1 : 0 ))
