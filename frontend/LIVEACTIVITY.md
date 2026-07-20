# Live Activity — breath logging window

A **Live Activity** turns a reminder into a live, time-bound task on the Lock
Screen and Dynamic Island: a countdown plus **Left / Right / Both** buttons that
log with one tap (no long-press, no opening the app). When the window closes it
**ends** and the classic notification takes over as the fallback.

This is native Swift (ActivityKit + WidgetKit + App Intents). It cannot be
built or tested headlessly — build it on your Mac via EAS, expect a round or two
of Swift errors to iterate on (same as the widget), then test on a device
(Live Activities do **not** run in the simulator's Lock Screen the same way, and
never in Expo Go).

## What's implemented

- `targets/widget/index.swift`
  - `BreathActivityAttributes` — the shared Activity type.
  - `BreathLiveActivity` — the Lock Screen UI (countdown + L/R/B) and the
    Dynamic Island (expanded buttons, compact countdown, minimal wind glyph).
  - `LogBreathIntent` now also **ends** any open Live Activity after logging.
  - Added to `AvirLogWidgetBundle` (guarded by `if #available(iOS 16.1, *)`).
- `modules/live-activity/ios/LiveActivityModule.swift` — app-side control:
  `isSupported()`, `startWindow(seconds)`, `endAll()`.
- `src/lib/liveActivityBridge.ts` — JS wrapper; a safe no-op when the native
  module is absent (web / Expo Go / Android / pre-build).
- Wiring:
  - `notifications.ts` → `scheduleNextReminder` opens a window
    (`min(delay, 600s)`); `cancelReminders` ends it.
  - `use-breath-notifications.ts` and `log.tsx` end the window on a log.
- Config: `expo-target.config.js` links `ActivityKit`; `app.config.js` sets
  `NSSupportsLiveActivities: true`.

## The one thing to verify first: shared attributes

`BreathActivityAttributes` is declared **twice** — in
`targets/widget/index.swift` and in
`modules/live-activity/ios/LiveActivityModule.swift`. ActivityKit matches the
app's `Activity<BreathActivityAttributes>` to the widget's renderer **by type**,
and the two targets are separate binaries.

If the activity starts (you see it appear) but shows a blank/default UI, or it
never appears, the types aren't unifying. Fix by making both targets compile the
**same** source file:

1. Put the struct in one file (e.g. `BreathActivityAttributes.swift`).
2. Add that file to **both** the app target and the widget extension target
   (Target Membership in Xcode), or share it via a small framework.
3. Remove the duplicate declarations.

Keeping the two copies byte-for-byte identical is usually enough for a first
run, but target-shared membership is the correct end state.

## Build & test loop (Mac)

```bash
cd frontend
npx expo install @bacons/apple-targets   # already a plugin; ensures native gen
npx eas-cli@latest build --platform ios --profile development   # or production
```

On device:
1. Enable reminders in Settings (grant notifications).
2. A Live Activity should appear with a countdown + L/R/B. Tapping a button
   logs instantly and the activity disappears.
3. Let it run out — it goes stale and the normal reminder notification is the
   fallback (long-press there for the buttons).

## Guidelines note

This is a legitimate ActivityKit use: a genuine, time-bound event with a clear
start and end and a countdown. It is not a persistent banner or an ad, and it
ends when the window closes — which is what Apple requires. Interactive buttons
via App Intents are supported on iOS 17+.

## Known limitation (local-only v1)

Without a server, the window opens when the reminder is **armed** (right after
your last interaction / on foreground), not precisely when it next becomes
**due**. Making it appear exactly at due-time — even when the app is closed —
needs ActivityKit **push** updates (APNs), a later enhancement. The current
version demonstrates the full on-device interaction; push just changes *when* it
fires.

## Apple Watch (future)

The same App Group + App Intents foundation extends to a watchOS complication /
app: the watch can read `nextDueAt` and log via the same intent. Build the
phone widget + Live Activity first, then add the watch target on top.
