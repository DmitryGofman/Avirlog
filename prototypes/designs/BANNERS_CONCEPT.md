# AvirLog "Living Banners" — Design Concept & Implementation Plan

The chosen direction (prototype `31-ronin-banners-live.html`): a flat cinematic
valley whose sky lives on the user's real clock, with two cloth banner-buttons
(moon & water = left nostril, sun & flame = right nostril) and a thin
full-length eclipse banner between them for Both.

## 1. The day spectrum

Twelve palette keyframes, blended continuously by local time. Each stop sets:
sky-top, sky-horizon, three mountain layers, silhouette ink, text, star opacity.

| Local time | Mood |
|---|---|
| 00:00–03:30 | true night — near-black blues, full stars |
| 05:00 | pre-dawn indigo |
| 06:00 | first light — violet/rose creeps up from the horizon |
| 06:48 | sunrise — horizon ignites orange under a still-blue sky |
| 08:00 | soft morning blue |
| 12:00 | clear vivid noon |
| 15:00 | mellow afternoon |
| 17:30 | golden hour — warm light rakes the hills |
| 19:00 | sunset — the horizon burns, mountains go plum |
| 20:12 | blue hour — everything cools to violet-blue, first stars |
| 21:48 | night settles |
| 24:00 | wraps back to true night |

The static-hour version ships fine; the *better* version anchors these stops to
the user's **actual sunrise/sunset**:

- **No API needed.** `suncalc` (tiny, offline npm package) computes sunrise,
  sunset, golden hour, dawn/dusk from latitude/longitude + date. Get coarse
  location once from the device (or even from the timezone as a fallback —
  `Intl.DateTimeFormat().resolvedOptions().timeZone` maps to an approximate
  lat/long table). Then stretch/shift the keyframe hours so "sunrise" lands on
  the real sunrise. Winter days compress the daylight stops; summer stretches
  them. Edge case: extreme latitudes (no sunset) — clamp to a min/max day length.
- If a network API is preferred later: `https://api.sunrise-sunset.org/json`
  (free, no key) — but offline suncalc is strictly better for a privacy-first app.

## 2. Sun and moon

- The **sun** crosses an arc during daylight (position from the day fraction),
  fading in/out at the horizons.
- At night the **moon** rises in its **true current phase**, computed on-device
  from the synodic month (`(now − known new moon) / 29.530588853d`) — the
  prototype draws the lit portion as an SVG path from that fraction (waxing
  lights the right side, waning the left). `suncalc` also provides
  `getMoonIllumination()` if we want library-grade accuracy plus moon
  rise/set times.
- Full-moon nights can subtly brighten the whole valley; new-moon nights get
  the deepest black and the most stars.

## 3. Why this matters for AvirLog specifically

Swara Yoga tradition ties nostril dominance to the sun (pingala), the moon
(ida), and the lunar calendar — traditional practice even prescribes which
nostril *should* dominate at sunrise depending on the fortnight of the moon.
The living sky isn't decoration; it's the app's own subject rendered honestly.

## 4. Ideas to push the concept further (v1.2+)

1. **Predicted current**: from moon phase + time of day, show tradition's
   *expected* dominant nostril as a faint glow on that banner. Logging then
   quietly shows "matched tradition / ran contrary" — a fascinating long-term
   stat, and it makes every log feel like checking a compass.
2. **Banners as history**: each log embroiders a tiny stitch mark into the
   banner's inner border — a week of practice literally decorates your
   banners. Monthly they "weather" and reset (or archive as Chronicle pages).
3. **Breath-paced wind**: the idle banner sway runs at ~6 cycles/minute — a
   calm breathing rate — so the home screen doubles as a subtle breath pacer.
4. **Weather layer** (optional, needs one API): overcast/rain/snow tints the
   sky and adds drifting clouds or rain streaks. Privacy note: coarse location
   only, cached daily.
5. **Seasons**: sun arc height and day length already follow suncalc; add
   seasonal set dressing — snow caps in winter, blossom petals in spring,
   fireflies on summer nights.
6. **Device tilt parallax**: mountains/banners shift on gyroscope for depth.
7. **Night rewards**: rare shooting star at night; birdsong glyph at dawn.
   Delight that costs nothing daily but gets noticed weekly.
8. **Widget/Live Activity**: the same scene, miniaturized — the lock screen
   shows the valley at the current hour with the last-logged banner raised.
9. **Sound (off by default)**: wind + cloth flutter on press; crickets at
   night, birds at dawn.
10. **Reduce-motion mode**: static banners, palette still follows the clock —
    accessibility and battery.

## 5. React Native implementation sketch

- Palette engine: the keyframe table + lerp above ports 1:1; drive with
  `useEffect` + 60s interval, animate transitions with reanimated
  `interpolateColor` (or simply update state — 60s steps are imperceptible).
- Mountains: `react-native-svg` polygons (same clip-path points).
- Banners: `react-native-svg` (art identical to prototype), idle sway +
  press-wave with reanimated; the banner is a `Pressable` wrapping the SVG.
- Sun/moon: SVG; moon-phase path function ports verbatim.
- Suncalc: `npm i suncalc` (no native code, Expo-safe).
- Performance: everything is a handful of SVG nodes + one gradient — trivial.
