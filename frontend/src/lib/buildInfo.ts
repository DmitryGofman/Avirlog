// A visible marker for "which code is actually running on this device".
//
// The app version stays 1.0.0 across TestFlight builds (eas.json uses remote
// versioning and only auto-increments the build number), so version alone can't
// tell you whether an update actually installed. CODE_REVISION is bumped by hand
// whenever a batch of changes ships, and is surfaced in Settings → About, so
// there is an unambiguous way to confirm a new build is on the phone.
import Constants from "expo-constants";

// Bump this with each shipped batch, and note what it contains.
export const CODE_REVISION = "r11";

// What landed in this revision, for the Settings subtitle.
export const CODE_REVISION_NOTE =
  "eight-screen welcome flow with the research consent question, Live Activity fixes";

/** e.g. "1.0.0 (7) · code r4" — falls back gracefully if a field is missing. */
export function buildStamp(): string {
  const cfg = Constants.expoConfig as
    | { version?: string; ios?: { buildNumber?: string } }
    | null
    | undefined;
  const version = cfg?.version ?? "—";
  // With remote versioning the build number is injected at build time; it can be
  // absent in dev, so only show it when present.
  const build = cfg?.ios?.buildNumber;
  return `${version}${build ? ` (${build})` : ""} · code ${CODE_REVISION}`;
}
