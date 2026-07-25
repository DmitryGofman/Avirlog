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
