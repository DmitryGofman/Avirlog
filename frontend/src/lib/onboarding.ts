// Whether the welcome flow has been completed on this device.
//
// Device-local rather than part of the /settings blob on purpose: onboarding is
// a property of this install, not of the account. Signing in on a second phone
// should still show the welcome flow there, and a guest who never signs in
// still needs the flag to persist.
//
// The key is versioned. Bumping to _v2 re-runs the flow for everyone, which is
// the right move only if the flow changes enough to be worth interrupting
// existing users — it is not a routine thing to do.
import { storage } from "@/src/utils/storage";

export const ONBOARDING_KEY = "avirlog_onboarding_v1";

export async function hasSeenOnboarding(): Promise<boolean> {
  const v = await storage.getItem<boolean>(ONBOARDING_KEY, false);
  return v === true;
}

export async function markOnboardingSeen(): Promise<void> {
  await storage.setItem(ONBOARDING_KEY, true);
}

/** Test hook: lets Settings offer a "show the welcome again" affordance. */
export async function resetOnboarding(): Promise<void> {
  await storage.setItem(ONBOARDING_KEY, false);
}
