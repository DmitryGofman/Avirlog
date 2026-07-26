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
| `modules/*/ios/*.podspec` | **Required.** Without a podspec CocoaPods never compiles the module, so the native module is missing at runtime and every bridge call silently no-ops |
| `src/lib/widgetBridge.ts` | JS wrapper: push the next-due time, import logs made on the widget, reload |
| `app.config.js` | Adds the `@bacons/apple-targets` plugin + App Group entitlement on the main app |

## Shared data (App Group `group.com.avirlog.app`)

- `nextDueAt` (number, epoch seconds) — when the widget switches to LOG NOW. Written by the app when reminders are (re)scheduled.
- `intervalSeconds` (number) — so a widget tap can arm the next due time itself.
- `advanced` (number, 0/1) — mirrors the app's **Advanced logging** setting. When 1, the widget + Live Activity swap Left/Right/Both for five **preset-blend** buttons (`80L` / `65L` / `50` / `65R` / `80R`), which log via `LogBlendIntent` (a `blend` = right-nostril % on the pending log). Written by the app on the Log screen and when the setting is toggled.
- `pendingLogs` (JSON string) — logs made on the widget; each is `{state, at}` (or `{state, blend, at}` for a preset-blend tap). The app imports them on next foreground and clears them.

## Simple vs advanced

The widget, Live Activity and reminder notification all follow one setting:

- **Advanced logging OFF** → simple **Left / Right / Both** (the default everywhere).
- **Advanced logging ON** → five **preset-blend** buttons on the widget + Live Activity, and the reminder notification uses the `breath-blend` category (`80% Left` / `65% Left` / `Even` / `65% Right` / `80% Right`).

A true drag slider isn't possible on these Apple surfaces (buttons/toggles only), so "blend" is expressed as presets; the full drag bar lives in the app.

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

## Sizes

`supportedFamilies` offers `systemSmall`, `systemMedium`, `systemLarge` and
`accessoryRectangular`, so you can add the widget at whatever size you want and
resize it by removing/re-adding at another size (iOS has no drag-to-resize for
widgets). One view adapts to all of them via `@Environment(\.widgetFamily)`:
button height and type scale up, the wide families show full words
(Left / Both / Right) instead of initials, and the large family adds a caption.
Lock-Screen accessory widgets are rendered monochrome by iOS, so they skip the
dark card and coloured fills and use outlined buttons instead.

## Troubleshooting

**Widget taps never appear in History, no Live Activity shows, or the widget
ignores Advanced logging.** All three have the same cause: the local native
modules under `modules/` weren't compiled, so `requireOptionalNativeModule`
returns `null` and `widgetBridge` / `liveActivityBridge` become silent no-ops.
Check that each module has **`ios/<Name>.podspec`** and that
`package.json` has `expo.autolinking.nativeModulesDir = "./modules"`, then
rebuild. (The bridges are deliberately written as safe no-ops so a missing
module can't crash the app — which is why this fails quietly.)

**No Live Activity even with the module present.** The window is opened from
`scheduleNextReminder`, so **reminders must be enabled** in Settings; it also
needs iOS 16.2+ and Live Activities allowed for the app in iOS Settings.

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
