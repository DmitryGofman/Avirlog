// Feature flags.
//
// ACCOUNTS_ENABLED gates email/Google sign-in and cloud sync. It is OFF for
// the first release: AvirLog ships fully functional as a local, on-device app
// (no backend required). Flip this to true once a production backend is
// deployed and EXPO_PUBLIC_BACKEND_URL points at it — sign-in then reappears
// in Settings and api() resumes talking to the server when authenticated.
export const ACCOUNTS_ENABLED = false;

// ---- Skins ----
// The Log screen ships with two skins; the registry is the seed of a future
// skin library (planned as a premium feature — more worlds uploaded later).
export type SkinId = "classic" | "banners";

export interface SkinMeta {
  id: SkinId;
  name: string;
  description: string;
}

export const SKINS: SkinMeta[] = [
  {
    id: "classic",
    name: "Classic",
    description: "The original minimal buttons — clean, quiet, fast.",
  },
  {
    id: "banners",
    name: "Living Banners",
    description: "A valley on your real clock: day-cycle sky, true moon phase, cloth banners.",
  },
];

export const DEFAULT_SKIN: SkinId = "banners";
