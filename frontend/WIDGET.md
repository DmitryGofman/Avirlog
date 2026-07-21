# AvirLog Lock/Home-Screen Widget — build & architecture

The widget shows tappable **Left / Right / Both** buttons on the Home Screen
and Lock Screen. On your reminder schedule it flips to a bright **"LOG NOW"**
highlighted state (white border) — so waking the phone shows you it's time,
without a classic notification. Logging on the widget clears the pending
notification; logging in the app/notification resets the widget. iOS 17+ for
the interactive buttons.

> ⚠️ This is native Swift, built by EAS and testable only on a device. It lives
> on the `claude/lockscreen-widget` branch, isolated from the v1 submission.

## Pieces

| File | Role |
|---|---|
| `targets/widget/index.swift` | The WidgetKit widget: timeline, calm vs LOG-NOW view, `LogBreathIntent` (App Intent) that logs from a button tap |
| `targets/widget/expo-target.config.js` | Declares the widget target + App Group entitlement to `@bacons/apple-targets` |
| `modules/app-group-storage/` | Local Expo native module so JS can read/write the shared App Group store and reload the widget |
| `src/lib/widgetBridge.ts` | JS wrapper: push the next-due time, import logs made on the widget, reload |
| `app.config.js` | Adds the `@bacons/apple-targets` plugin + App Group entitlement on the main app |

## Shared data (App Group `group.com.avirlog.app`)

- `nextDueAt` (number, epoch seconds) — when the widget switches to LOG NOW. Written by the app when reminders are (re)scheduled.
- `intervalSeconds` (number) — so a widget tap can arm the next due time itself.
- `pendingLogs` (JSON string) — logs made on the widget; the app imports them on next foreground and clears them.

## Build & test loop (on the Mac)

1. Install the widget toolchain (writes the version into package.json):
   ```bash
   cd ~/Avirlog/frontend
   git checkout claude/lockscreen-widget
   npm install
   npx expo install @bacons/apple-targets
   git add package.json package-lock.json 2>/dev/null; git commit -m "add apple-targets" || true
   ```
2. Build (EAS registers the App Group capability; approve prompts):
   ```bash
   npx eas-cli@latest build --platform ios --profile production
   ```
   (or a faster internal build: `--profile preview`)
3. Install via TestFlight, then **long-press the Home Screen → add the AvirLog
   widget**, and/or **Lock Screen → Customize → add the widget**.
4. Tap Left/Right/Both on the widget → open the app → the log should appear in
   Today/History. Enable reminders → at the interval, the widget border goes
   white ("LOG NOW").

## Known constraints (Apple platform, not our code)

- No continuous glow animation — widgets render fixed snapshots, so it's a
  **state change** to a white "LOG NOW" look, not a shimmer.
- Widget refreshes are rate-limited by iOS (~dozens/day) → use **minute-scale**
  intervals for the widget cue (10 min is ideal); seconds only work for the
  in-app notification path.
- Interactive buttons require **iOS 17+**; on iOS 16 tapping opens the app.

## Apple Watch (later)

The watch app is a separate watchOS target that reuses the same App Group and
`LogBreathIntent` logic. Once this widget is stable, the watch complication +
app is an additive target — same shared store, same intents.
