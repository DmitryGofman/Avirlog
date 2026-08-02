# AvirLog — App Store Release Checklist & Blind-Spot Pass

_Prepared for the v1.0.0 iOS submission. Work through "Blockers" top-to-bottom on
the MacBook; everything in "Blind spots" is something that has surprised
first-time submitters before._

---

## 1. Already verified in this repo (done, no action)

- ✅ Bundle ID `com.avirlog.app`, version `1.0.0`, remote build-number
  auto-increment (`eas.json` → `appVersionSource: "remote"`, `autoIncrement`).
- ✅ App icon is 1024×1024 and **fully opaque** (App Store rejects icons with
  transparency — checked pixel-by-pixel, safe).
- ✅ Adaptive icon + splash configured; dark/light mode supported.
- ✅ v1 is **local-only** (`ACCOUNTS_ENABLED = false`): no login in the UI, so
  Apple's *account-deletion* rule (5.1.1(v)) and *Sign in with Apple* rule
  (4.8) do **not** apply. Do not flip this flag on before submission without
  re-reading those rules.
- ✅ Export compliance answered in the binary
  (`ITSAppUsesNonExemptEncryption: false` in `app.json`) — builds won't stall
  in TestFlight's "Missing Compliance" state.
- ✅ iPhone-only (`supportsTablet: false`) — this removes the *mandatory* iPad
  screenshot set and the untested-iPad review surface. The app still runs on
  iPad in compatibility mode. Flip back to `true` in a later release if you
  test iPad layouts.
- ✅ Reminder notifications are **local** (no push entitlement, no APNs setup
  needed). Left / Right / Both action buttons implemented, including
  cold-launch handling and de-duplication.
- ✅ Privacy policy exists in-app (`/privacy`) and as `PRIVACY.md`; app
  collects nothing, no analytics, no third-party SDKs that phone home.

## 2. Blockers — must do before/at submission (MacBook day)

1. **Apple Developer Program enrollment** — $99/yr. If you are not already
   enrolled: enrollment approval can take **24–48 hours** (occasionally longer
   with identity verification). This is the #1 thing that silently kills a
   "ship tomorrow" plan. Check https://developer.apple.com/account first.
2. **EAS setup** (no Xcode required if you build in the cloud):
   ```bash
   npm i -g eas-cli
   cd frontend
   eas login                      # your Expo account
   eas init                       # writes extra.eas.projectId into app.json — commit it
   eas build --platform ios --profile production
   eas submit --platform ios      # uploads to App Store Connect
   ```
   EAS can create the App Store Connect app record and signing credentials
   for you interactively — say yes when prompted.
3. **App Store Connect record**: name **"AvirLog"** must be globally unique
   in the store. Have 2–3 fallback names ready (e.g. "AvirLog — Breath
   Journal") in case it's taken.
4. **Screenshots** — required for the 6.9″ size class (1320×2868 px,
   e.g. iPhone 16 Pro Max simulator; 6.7″/1290×2796 also accepted). 3–5 shots:
   Log screen, Today, Insights, Learn, Settings/reminder. Take them in the
   simulator (`npx expo run:ios` or a TestFlight build + device).
5. **Support URL and Privacy Policy URL** are required fields. You can use:
   - Privacy: `https://dmitrygofman.github.io/Avirlog/privacy` (web deploy)
   - Support: the repo URL or the same site. Verify both load publicly
     **before** filling in the form.
6. **Contact email in `PRIVACY.md` is a placeholder** (`support@avirlog.app`).
   Replace it with an inbox you actually monitor, or set up forwarding for
   that address. Reviewers and users may write to it.
7. **TestFlight pass on your physical iPhone before submitting.** Notifications
   behave differently on a real device than in the simulator. Test, at minimum:
   - Enable reminders → lock the phone → wait for one to arrive.
   - **Long-press the notification** → tap Left → open app → entry exists.
   - Force-quit the app, tap a notification action → cold launch logs it once.

## 3. App Store Connect form answers (so you're not guessing in the UI)

| Field | Answer |
|---|---|
| Category | Health & Fitness (secondary: Lifestyle) |
| Privacy "nutrition label" | **"Data Not Collected"** — true for v1 (all data on-device, no analytics). Don't over-declare; declaring collection you don't do triggers extra questions. |
| App Tracking Transparency | Not needed (no tracking). |
| Age rating questionnaire | All "None"; result should be 4+. The wellness content is educational. |
| Sign-in info for review | Check **"Sign-in not required"** — the app is fully usable without an account. |
| Notes for reviewer | Suggested text below. |
| Export compliance | Already answered in the binary; if asked, "None of the algorithms mentioned / exempt". |

Suggested reviewer note:

> AvirLog is a local-only breath-awareness journal based on the Swara Yoga
> tradition. No account is required; all data stays on-device. Optional
> reminders are local notifications — long-press a reminder to reveal the
> Left / Right / Both quick-log buttons. Educational content only; the app
> makes no medical or diagnostic claims (see in-app disclaimer under Learn
> and the privacy policy).

## 4. Blind spots — the unknown unknowns

Things that commonly reject or delay apps like this one:

1. **Health claims wording (Guideline 5.1.1 / 1.4.1).** Your store
   *description* is reviewed too. Avoid: "improves", "heals", "treats",
   "balances your nervous system", "reduces anxiety". Safe framing:
   "observe", "log", "notice patterns", "based on the Swara Yoga tradition",
   plus the disclaimer you already have. The Learn screen's traditional
   framing is fine *because* it's labelled educational — keep the store copy
   equally careful.
2. **Guideline 4.2 (minimum functionality).** Simple logging apps sometimes
   get flagged as "not app-like enough". Your mitigations already exist —
   Insights, Learn guide, reminders with quick actions, mood journaling.
   Mention this breadth in the description; screenshots should show more than
   just three buttons.
3. **iOS hides notification action buttons.** Left/Right/Both only appear
   after a **long-press (or pull-down) on the notification banner**. Users
   (and the reviewer) will think the feature is broken otherwise. Mitigated in
   the reviewer note above; consider a one-time hint in the app after enabling
   reminders (post-v1 is fine).
4. **Repeating local notifications are best-effort.** iOS may coalesce/delay
   them (Focus modes, Low Power Mode, notification summaries). A "every 30
   min" reminder will *mostly* fire, not always. Don't promise exact timing
   in store copy.
5. **First review takes ~24–48 h**, and a rejection + resubmission adds the
   same again. If tomorrow is submission day, expect live-on-store toward the
   end of the week. Reply to rejections in Resolution Center — most 4.x/5.x
   flags for an app like this are resolved with a text answer, not a binary.
6. **App name / subtitle keyword stuffing** (Guideline 2.3.7) — subtitle like
   "breath, nostril, swara, yoga, log" will be rejected. Write a sentence, not
   keywords (keywords go in the hidden keyword field).
7. **The web preview and the iOS binary share `EXPO_PUBLIC_BACKEND_URL`
   handling** — the iOS build must ship **without** that env var set so `api()`
   stays in local mode. With `ACCOUNTS_ENABLED=false` this is already safe;
   just don't add the env var to an EAS production profile.
8. **Expo Go ≠ production.** Anything you validated in Expo Go must be
   re-validated in the actual build (notification categories especially —
   they work differently in Expo Go).
9. **Screenshots must match the shipped app** (Guideline 2.3.3). No mockups
   with features that aren't in the build you ship (the widget now exists, but
   only if `@bacons/apple-targets` was installed at build time — see below).
10. **Apple can ask "what does Avirlog mean / what is Swara Yoga"** via a
    metadata rejection if the description is too sparse. One plain-English
    paragraph explaining the concept up front avoids this.

## 5. Widget status (honest assessment)

**Notification quick-log ("widget in the notification bar") — READY.**
The repeating reminder carries three action buttons: **Left**, **Right**, and
the smaller middle **Both** — tapping logs without opening the app
(`src/lib/notifications.ts`, `src/hooks/use-breath-notifications.ts`).
Remember: on iOS the buttons appear on long-press/pull-down of the banner.

**Home-screen / Lock-screen widget — NOW EXISTS.** The WidgetKit target lives
at `frontend/targets/widget/index.swift` (systemSmall/Medium/Large +
accessoryRectangular, iOS 17+ App Intents so Left/Right/Both log straight from
the widget, plus a Live Activity for the Lock Screen and Dynamic Island). Data
is shared through App Group `group.com.avirlog.app`; see `frontend/WIDGET.md`
and `frontend/LIVEACTIVITY.md` for the build-and-verify loop.

Two things to watch:

- `@bacons/apple-targets` is deliberately **not** in `package.json` —
  `app.config.js` registers it only if `require.resolve` succeeds. If it isn't
  installed on the build side, the widget is **silently dropped** from the
  build with no error.
- The widget can only be verified on a real device via TestFlight, so if
  screenshots show it, confirm it is actually present in the build you ship
  (Guideline 2.3.3).

## 6. Nice-to-have before submission (not blocking)

- Replace the boilerplate `frontend/README.md` (Expo template text).
- App Store description draft + keyword field (100 chars) — write these
  offline before opening the form; the form times out.
- Set up an App Store Connect API key for `eas submit` so future submissions
  are non-interactive.
- Decide on a marketing URL (optional field; GitHub Pages site works).
