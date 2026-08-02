---
name: ship-ios
description: Release the AvirLog iOS app — preflight checks, EAS cloud build, and App Store Connect / TestFlight submission. Use when the user asks to ship, release, build, submit, or send the iOS app to TestFlight or the App Store, or asks for a new build on their phone. Pass "dry-run" to run preflight only and report readiness without building.
---

# Ship AvirLog to iOS

This skill drives an AvirLog release as far as it can be driven from a Linux
container, then hands the user a precise list of the steps that genuinely
require their Mac, iPhone, or Apple account. It does not duplicate the manual
runbooks — `SUBMIT_STEPS.md`, `RELEASE_CHECKLIST.md`, and `STORE_LISTING.md`
remain the source of truth for anything a human does by hand.

**Arguments:** `dry-run` → run phases 1–2 only, report readiness, do not build.

## Phase 1 — Preflight

```bash
bash .claude/skills/ship-ios/scripts/preflight.sh
```

The script checks: clean tree, node/dependencies, `tsc --noEmit`, `expo-doctor`,
local-only invariants (no `EXPO_PUBLIC_BACKEND_URL`, `ACCOUNTS_ENABLED=false`),
whether `@bacons/apple-targets` will resolve (if not, **the widget and Live
Activity are silently dropped from the build** — never ship a "widget fix"
without this passing), the live privacy-policy URL, and which credentials
exist. It prints PASS/WARN/FAIL per check and a verdict; exit 1 means blockers.

Do not proceed past a FAIL. Fix it, or report it and stop.

**Bump the build stamp before building.** Edit `frontend/src/lib/buildInfo.ts`:
increment `CODE_REVISION` ("r5" → "r6") and rewrite `CODE_REVISION_NOTE` to a
short summary of what this batch contains. This is the only way the user can
confirm on-device that a new build actually installed — the version stays
1.0.0 across TestFlight builds. Commit it before building so the binary matches
a commit.

Also skim `RELEASE_CHECKLIST.md` if the diff touched user-visible copy: wording
must be "observe / log / notice", never "treat / heal / cure".

## Phase 2 — What can actually run unattended

The preflight verdict tells you which path you are on:

| Verdict | Path |
|---|---|
| `READY` | Build and submit here (phases 3–4). |
| `READY TO BUILD` | Build here, then hand off submission (`SUBMIT_STEPS.md` step 5). |
| `CREDENTIALS ARE NOT` | Skip to phase 5 — give the user the Mac-side runbook. |

Never fabricate progress. If `EXPO_TOKEN` is missing or the project has no
`extra.eas.projectId`, no build can start from here; say so plainly and give
the one-time setup commands the script printed. If the user is on `dry-run`,
stop here and report.

## Phase 3 — Build (EAS cloud)

```bash
cd frontend
npx eas-cli@latest build --platform ios --profile production --non-interactive --no-wait
```

`--no-wait` returns a build URL immediately. Poll instead of blocking:

```bash
cd frontend && npx eas-cli@latest build:list --platform ios --limit 1 --json --non-interactive
```

Check `status` (`NEW` → `IN_QUEUE` → `IN_PROGRESS` → `FINISHED` / `ERRORED`).
A production build takes 20–40 minutes; poll every few minutes rather than
sitting in a blocking wait, and tell the user the build URL so they can watch.

On `ERRORED`, fetch the logs from the build URL and read them before guessing.
The failure modes that actually happen here:

- **Swift compile errors in the widget target** — `frontend/targets/widget/index.swift`.
  Delegate to the `ios-native` agent with the log excerpt.
- **Podspec failures** in `frontend/modules/{live-activity,app-group-storage}/ios/`
  — see the troubleshooting sections of `frontend/WIDGET.md` and
  `frontend/LIVEACTIVITY.md`.
- **Credential prompts** — `--non-interactive` turns these into errors. iOS
  signing must be set up once interactively (Apple ID login on the Mac, or an
  App Store Connect API key registered with EAS). Report it; do not retry
  without `--non-interactive`, which would hang.

## Phase 4 — Submit

Only if the preflight found submit credentials:

```bash
cd frontend
npx eas-cli@latest submit --platform ios --latest --non-interactive
```

The build appears in App Store Connect → TestFlight within ~10–15 minutes
("Processing" → ready). Export compliance is already answered in the binary
(`ITSAppUsesNonExemptEncryption: false`), so it will not stall on that.

Without credentials, do not attempt it — give the user `SUBMIT_STEPS.md` step 5
verbatim to run on the Mac.

## Phase 5 — Handoff

Always end with what the user still has to do themselves. Keep it short and
specific to this release — don't paste whole documents, point at them:

1. **TestFlight device check** — `SUBMIT_STEPS.md` step 6. List only the items
   this release actually affects, plus the always-on ones (app opens, logging
   works). If Swift changed, explicitly include the widget / Live Activity /
   notification-long-press checks, because nothing in CI can verify them.
2. **Store listing** — first submission only, or when screenshots go stale:
   `SUBMIT_STEPS.md` step 7 with copy from `STORE_LISTING.md`. Screenshots must
   match the shipped app (Guideline 2.3.3).
3. **Submit for review** — `SUBMIT_STEPS.md` step 8, and the rejection playbook
   at the bottom of that file if Apple pushes back.

If a rejection comes back, most flags for this app (5.1.1 health claims, 4.2
minimum functionality, 2.1 "couldn't find the feature") are answered with text
in the Resolution Center, not a new build.

## Rules

- **Never write secrets into the repo.** `EXPO_TOKEN` lives in the environment;
  the App Store Connect key lives in EAS-stored credentials or a path outside
  the repo. If you add `submit.production` config to `frontend/eas.json`, put
  the key ID and issuer ID there only if the user says those are fine to
  commit — never the `.p8` file itself.
- **Never run `expo prebuild` and commit the result.** This is a managed Expo
  project; there is no `ios/` directory by design.
- **Never claim a build or submission succeeded without a status you actually
  read** from `build:list` or the build URL.
