# AvirLog — Step-by-Step App Store Submission

Follow these in order on the MacBook. Each step says what to do and how to know
it worked. You do **not** need Xcode — EAS builds in the cloud.

Estimated hands-on time: ~2 hours. Plus waiting: enrollment (if not done) can
take 24–48h, each cloud build ~20–40 min, Apple's review ~24–48h.

---

## STEP 0 — Prerequisites (do tonight if possible)

- [ ] **Apple Developer Program** account, active. Check
      https://developer.apple.com/account — if it says "enroll", start now;
      approval can take 1–2 days and is the thing most likely to slip your
      timeline.
- [ ] **Expo account** (free) — https://expo.dev/signup
- [ ] Node.js 20+ installed on the Mac (`node -v`).

---

## STEP 1 — Get the code and install (10 min)

```bash
git clone https://github.com/DmitryGofman/Avirlog.git
cd Avirlog
git checkout claude/app-store-release-prep-fv29nf   # or main, once merged
cd frontend
npm install -g eas-cli
yarn install
```

✅ Check: `npx tsc --noEmit` prints nothing (no type errors).

---

## STEP 2 — Link the project to EAS (5 min)

```bash
eas login            # your Expo credentials
eas init             # creates the project, writes extra.eas.projectId into app.json
```

When it asks "Would you like to create a project?" → **yes**.

✅ Check: `app.json` now has `extra.eas.projectId`. **Commit that change:**

```bash
git add app.json && git commit -m "Add EAS projectId" && git push
```

---

## STEP 3 — Create the App Store Connect record (15 min)

You can let EAS do most of this in Step 5, but doing it first is cleaner.

1. Go to https://appstoreconnect.apple.com → **My Apps → +  → New App**.
2. Fill in:
   - **Platform:** iOS
   - **Name:** `AvirLog` (if taken, try `AvirLog - Breath Journal`)
   - **Primary language:** English (U.S.)
   - **Bundle ID:** select `com.avirlog.app`
     *(if it's not in the list, register it at
     https://developer.apple.com/account/resources/identifiers → +  → App IDs,
     description "AvirLog", bundle ID `com.avirlog.app`, explicit)*
   - **SKU:** `avirlog-ios-001` (any unique string, internal only)
3. Create.

✅ Check: the app appears in App Store Connect in "Prepare for Submission".

---

## STEP 4 — Build the production binary (30–40 min mostly waiting)

```bash
cd frontend
eas build --platform ios --profile production
```

- When prompted to **log in with your Apple ID** → do it; let EAS **manage
  credentials** and create the distribution certificate + provisioning profile
  (say yes to all "Would you like EAS to handle this?" prompts).
- The build runs on Expo's servers. You'll get a URL to watch it.

✅ Check: build finishes green; you get a `.ipa`. **Do not set
`EXPO_PUBLIC_BACKEND_URL`** — the app must ship in local-only mode (it does by
default).

---

## STEP 5 — Upload to App Store Connect (10 min)

```bash
eas submit --platform ios --latest
```

- Pick the build you just made.
- It uploads to App Store Connect / TestFlight.

✅ Check: within ~10–15 min the build shows in App Store Connect under
**TestFlight** with status "Processing" → then ready. (Export compliance is
already answered in the binary, so it won't get stuck asking.)

---

## STEP 6 — Test on your real iPhone via TestFlight (20 min) — DO NOT SKIP

1. Install **TestFlight** from the App Store on your iPhone.
2. In App Store Connect → TestFlight → add yourself as an internal tester
   (your Apple ID email). Accept the invite on the phone.
3. Install AvirLog from TestFlight and verify **on the device**:
   - [ ] App opens to the Log screen, no crash.
   - [ ] Tap Left / Right / Both → the **Ice & Fire effect plays**, entry logs.
   - [ ] Settings → enable reminders → allow notifications.
   - [ ] Lock the phone, wait for a reminder to arrive.
   - [ ] **Long-press (or pull down) the reminder** → Left / Right / Both
         buttons appear → tap Left → open app → the entry exists.
   - [ ] Force-quit the app, tap a notification action → it logs once (no
         double entry).
   - [ ] Dark mode and light mode both look right.

✅ Check: everything above passes. If a reminder never arrives, check the
phone isn't in a Focus mode and Low Power Mode is off.

---

## STEP 7 — Fill in the store listing (30 min)

In App Store Connect → your app → the "1.0 Prepare for Submission" page.

- [ ] **Screenshots** — 6.9" size required (1320×2868). Easiest: run the app in
      the iOS Simulator on the Mac (`npx expo run:ios`), open iPhone 16 Pro Max,
      press **Cmd+S** to save each screen. Capture 3–5: Log, Today, Insights,
      Learn, Settings. (Screenshots must match the shipped app — don't show a
      home-screen widget, there isn't one yet.)
- [ ] **Description** — see draft in `STORE_LISTING.md`. Careful with health
      claims: "observe / log / notice", never "treat / heal / cure".
- [ ] **Keywords** (100 char field): `breath,nostril,swara,yoga,journal,
      mindfulness,wellness,pranayama,habit,log`
- [ ] **Support URL:** `https://dmitrygofman.github.io/Avirlog/` (or your repo)
- [ ] **Marketing URL:** optional — same site.
- [ ] **Privacy Policy URL:** `https://dmitrygofman.github.io/Avirlog/privacy`
      → confirm it loads in a browser first. (This requires the web deploy —
      see note at bottom.)
- [ ] **Category:** Health & Fitness (secondary: Lifestyle).
- [ ] **Age rating:** answer all "None" → 4+.
- [ ] **App Privacy** (the nutrition label): choose **"Data Not Collected"** —
      true for v1.
- [ ] **Sign-in required for review?** → No / not required. There's no login,
      so leave the review-account fields empty.
- [ ] **Review notes** — paste:
      > AvirLog is a local-only breath-awareness journal (Swara Yoga tradition).
      > No account is required; all data stays on-device. Optional reminders are
      > local notifications — long-press a reminder to reveal the Left/Right/Both
      > quick-log buttons. Educational content only; no medical claims.
- [ ] **Build:** select the build from Step 5.
- [ ] **Contact info** for App Review (your name/phone/email).

---

## STEP 8 — Submit (2 min)

- [ ] Click **Add for Review** → **Submit for Review**.
- [ ] Status becomes "Waiting for Review".

✅ Done. Review typically lands in 24–48h. Watch email for
"In Review" → "Ready for Sale" (or a rejection in Resolution Center — most
flags for an app like this are answered with text, not a new build).

---

## If Apple rejects (most common reasons for this app)

- **5.1.1 / health claims** in the description → soften wording, reply in
  Resolution Center, usually no new build needed.
- **4.2 minimum functionality** → point them (in Resolution Center) to
  Insights, the Learn guide, reminders with quick-actions, and mood journaling.
- **2.1 "couldn't find the feature"** → they didn't long-press the reminder;
  the review note above pre-empts this, but you can reply and explain.

---

## One dependency worth doing first: the Privacy Policy URL must be live

App Store Connect **requires** a working Privacy Policy URL. Your policy exists
in the repo (`PRIVACY.md`) and in-app, but the *public web page* only exists
once the web build is deployed. To turn it on:

1. GitHub repo → **Settings → Pages → Source = "GitHub Actions"**.
2. Push to `main` (the `deploy-web.yml` workflow builds and publishes).
3. Wait for the Actions run to finish, then confirm both load:
   - `https://dmitrygofman.github.io/Avirlog/`
   - `https://dmitrygofman.github.io/Avirlog/privacy`

Also: replace the placeholder `support@avirlog.app` in `PRIVACY.md` with an
inbox you actually read, or set up forwarding — reviewers and users may email it.
