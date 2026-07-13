// The living sky engine: a 12-stop day palette blended continuously by local
// time, plus sun/moon arc positions and the moon's true phase. Pure functions
// — no network, no location. (See prototypes/designs/BANNERS_CONCEPT.md for
// the plan to anchor stops to real sunrise/sunset via suncalc later.)

export interface SkyPalette {
  sky1: string;
  sky2: string;
  far: string;
  mid: string;
  near: string;
  ink: string;
  text: string;
  starOpacity: number;
}

// [hour, sky1, sky2, far, mid, near, ink, text, starOpacity]
const KEYS: [number, string, string, string, string, string, string, string, number][] = [
  [0, "#04060F", "#02030A", "#10182B", "#0B1120", "#060B16", "#030710", "#D9DEEC", 1],
  [3.5, "#05081A", "#030512", "#121A30", "#0C1324", "#070C18", "#040814", "#D9DEEC", 1],
  [5, "#141B38", "#1E1A38", "#1E2643", "#161D36", "#0E1426", "#080C1C", "#E0E2F0", 0.8],
  [6, "#3A3E72", "#7E5678", "#3A4066", "#2C3252", "#1C2340", "#12162E", "#F0EAF0", 0.35],
  [6.8, "#5E6EA8", "#F2A268", "#5E5A80", "#4A4468", "#302E50", "#201E3A", "#FFF4E4", 0.05],
  [8, "#7FB0DC", "#C9E2EC", "#7FA0BC", "#5E86A6", "#3E6488", "#2A4662", "#FFFFFF", 0],
  [12, "#4E9EE0", "#A8D8F0", "#6E9EC2", "#4E82AC", "#2E608C", "#1E4468", "#FFFFFF", 0],
  [15, "#5EA4DC", "#B8D8E8", "#7AA0BE", "#5A84A8", "#3A6288", "#264462", "#FFFFFF", 0],
  [17.5, "#6E86B8", "#F2C078", "#9E7E88", "#7A5E70", "#523E54", "#382640", "#FFF4E0", 0],
  [19, "#4E5490", "#E8825E", "#8A5460", "#6E3E50", "#48283E", "#2E182A", "#FFEEDE", 0.08],
  [20.2, "#2E3560", "#4A4278", "#3A3A62", "#2A2C50", "#1A1E3C", "#101428", "#E8E8F4", 0.4],
  [21.8, "#12182E", "#0C1024", "#1A2238", "#121A2C", "#0A101E", "#050A16", "#DCE0EE", 0.85],
  [24, "#04060F", "#02030A", "#10182B", "#0B1120", "#060B16", "#030710", "#D9DEEC", 1],
];

function hexToRgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    "#" +
    A.map((v, i) =>
      Math.round(v + (B[i] - v) * t)
        .toString(16)
        .padStart(2, "0"),
    ).join("")
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Palette for a local time expressed in minutes since midnight.
export function paletteAt(minutes: number): SkyPalette {
  const h = ((minutes % 1440) + 1440) % 1440 / 60;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const A = KEYS[i];
  const B = KEYS[i + 1];
  const t = (h - A[0]) / (B[0] - A[0]);
  return {
    sky1: mixHex(A[1], B[1], t),
    sky2: mixHex(A[2], B[2], t),
    far: mixHex(A[3], B[3], t),
    mid: mixHex(A[4], B[4], t),
    near: mixHex(A[5], B[5], t),
    ink: mixHex(A[6], B[6], t),
    text: mixHex(A[7], B[7], t),
    starOpacity: A[8] + (B[8] - A[8]) * t,
  };
}

export interface CelestialState {
  sunTopPct: number; // % of scene height
  sunOpacity: number;
  moonTopPct: number;
  moonOpacity: number;
}

// Sun above the horizon ~05:48–19:48; moon ~19:12–06:24 (wraps midnight).
// Both fade in/out near the horizons.
export function celestialAt(minutes: number): CelestialState {
  const h = ((minutes % 1440) + 1440) % 1440 / 60;
  const dayP = (h - 5.8) / 14;
  const sunVisible = dayP > 0 && dayP < 1;
  const nightP = h >= 19.2 ? (h - 19.2) / 11.2 : (h + 4.8) / 11.2;
  const moonVisible = nightP > 0 && nightP < 1;
  return {
    sunTopPct: sunVisible ? 58 - 50 * Math.sin(Math.PI * dayP) : 64,
    sunOpacity: sunVisible ? clamp(Math.min(dayP, 1 - dayP) * 8, 0, 1) : 0,
    moonTopPct: moonVisible ? 50 - 40 * Math.sin(Math.PI * nightP) : 64,
    moonOpacity: moonVisible ? clamp(Math.min(nightP, 1 - nightP) * 8, 0, 1) : 0,
  };
}

// Moon phase fraction: 0 = new, 0.5 = full. Depends only on the date —
// computed from a reference new moon and the synodic month.
export function moonPhaseFraction(now: Date = new Date()): number {
  const NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);
  const SYNODIC_MS = 29.530588853 * 86400000;
  const frac = ((now.getTime() - NEW_MOON_UTC) % SYNODIC_MS) / SYNODIC_MS;
  return frac < 0 ? frac + 1 : frac;
}

// SVG path for the lit part of the moon (waxing lights the right side).
export function moonLitPath(cx: number, cy: number, r: number, phase: number): string {
  const c = Math.cos(2 * Math.PI * phase);
  const rx = Math.abs(c) * r;
  const waxing = phase < 0.5;
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = c > 0 ? (waxing ? 0 : 1) : waxing ? 1 : 0;
  return (
    `M ${cx} ${cy - r} A ${r} ${r} 0 1 ${sweepOuter} ${cx} ${cy + r}` +
    ` A ${rx} ${r} 0 1 ${sweepInner} ${cx} ${cy - r} Z`
  );
}

export function nowMinutes(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}
