// Blend logging: instead of a discrete Left / Right / Both tap, "Advanced
// logging" records how open each nostril is as a single number — the RIGHT
// nostril's share, 0–100 (so left share is 100 − right). Everything else in the
// app still works off nostril_state, which we derive from the blend here.
import { NostrilState } from "@/src/theme/theme";

// Near-even splits read as balanced (Sushumna); otherwise the fuller side wins.
export function blendToState(rightPct: number): NostrilState {
  if (rightPct >= 55) return "right";
  if (rightPct <= 45) return "left";
  return "both";
}

// A discrete state, placed on the 0–100 scale for seeding the slider.
export function stateToBlend(state: NostrilState): number {
  return state === "right" ? 100 : state === "left" ? 0 : 50;
}

export function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** "28% left · 72% right" — the reading shown on a log and in Insights. */
export function formatBlendSplit(rightPct: number): string {
  const r = clampPct(rightPct);
  return `${100 - r}% left · ${r}% right`;
}

export interface BlendStats {
  /** How many logs carried a blend at all. */
  count: number;
  /** Mean right-nostril share across those logs. */
  avgRight: number;
  /** Which way the mean leans, using the same thresholds as a single log. */
  lean: NostrilState;
  /** Widest gap between any two readings — how much the balance moves. */
  swing: number;
  /** Share of blend logs falling on each side, 0–1. */
  shares: Record<NostrilState, number>;
}

/**
 * Summarise a set of right-nostril percentages.
 *
 * Returns null rather than zeroes for an empty set, so callers can distinguish
 * "no blend logs yet" from "perfectly balanced".
 */
export function blendStats(rights: number[]): BlendStats | null {
  const vals = rights.filter((v) => typeof v === "number" && Number.isFinite(v)).map(clampPct);
  if (vals.length === 0) return null;

  const avgRight = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const counts: Record<NostrilState, number> = { left: 0, right: 0, both: 0 };
  vals.forEach((v) => (counts[blendToState(v)] += 1));

  return {
    count: vals.length,
    avgRight,
    lean: blendToState(avgRight),
    swing: Math.max(...vals) - Math.min(...vals),
    shares: {
      left: counts.left / vals.length,
      right: counts.right / vals.length,
      both: counts.both / vals.length,
    },
  };
}

/** Per-day mean right share; null on days with no blend logs. */
export function blendByDay<T extends { local_date: string; blend?: number | null }>(
  logs: T[],
  dates: string[],
): { date: string; avgRight: number | null }[] {
  const buckets: Record<string, number[]> = {};
  logs.forEach((l) => {
    if (l.blend == null) return;
    (buckets[l.local_date] = buckets[l.local_date] ?? []).push(clampPct(l.blend));
  });
  return dates.map((date) => {
    const vals = buckets[date] ?? [];
    return {
      date,
      avgRight: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
    };
  });
}
