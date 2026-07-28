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
  - `LogBreathLiveIntent` / `LogBlendLiveIntent` — the button intents (see
    "Why the buttons live in the app target" below).
  - Added to `AvirLogWidgetBundle` (guarded by `if #available(iOS 17.0, *)`).
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

## Why the buttons live in the app target

This one cost a couple of builds, so it is worth stating plainly.

The buttons originally ran `LogBreathIntent`, a plain `AppIntent` declared only in
the widget extension. **A plain `AppIntent` performs inside the extension's
process, and `Activity<…>.activities` is always empty there** — an extension
cannot see the activities the app requested. So the code that flipped the window
to "LOGGED" and then ended it was iterating over an empty array: the tap logged
the breath, but the window showed no confirmation and stayed on the Lock Screen
until its countdown ran out.

The fix has three parts:

1. **`LiveActivityIntent`, not `AppIntent`.** iOS performs these in the *app's*
   process, where the activities are reachable. It is iOS 17+, which is why Live
   Activities are now gated to 17 across the app (the buttons are the whole point
   of the window; iOS 16 falls back to the chained notification).
2. **The intent has to be in the app's own bundle.** Expo local modules build as
   CocoaPods targets, not app-target sources, so `modules/live-activity/` is not
   enough. `native/BreathLiveIntents.swift` is copied into `ios/<Project>/` and
   added to the app target's Compile Sources by
   `plugins/withLiveActivityIntents.js` during prebuild. The widget extension
   keeps a same-named copy so its SwiftUI can build the `Button`; when both
   exist, iOS runs the app's.
3. **Ending goes through the pod.** `BreathLiveActivityControl` in
   `LiveActivityModule.swift` is `public` and owns the `BreathActivityAttributes`
   used by `Activity.request`. The app-target intent calls into it rather than
   declaring its own copy of the struct — a second copy would be a different
   Swift type and would find no activities, reproducing the original bug one
   layer down.

To check the plugin did its job without a Mac:

```bash
cd frontend && npx expo prebuild -p ios --no-install
grep BreathLiveIntents.swift ios/*.xcodeproj/project.pbxproj   # expect a "in Sources" entry
rm -rf ios                                                     # it is gitignored; regenerate at will
```

If a tap logs the breath but the window neither confirms nor closes, that grep is
the first thing to run — it means the intent is being served by the extension copy.

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
