// One place for every vibration the app makes, so the feel is consistent
// wherever you log from.
//
// The pattern is a two-beat: a light impact the instant your finger lands
// ("registered"), then a success notification when the row is actually written
// ("saved"). Feeling the second beat is the point — it's the only confirmation
// that survives if the toast is missed.
//
// Note on the widget and Live Activity: their buttons run in the widget
// EXTENSION process, and UIFeedbackGenerator only produces haptics for an app
// that is foreground-active. Nothing here can reach them. Their feedback comes
// from a local notification posted by the App Intent instead (see
// targets/widget/index.swift), which is what actually makes the phone buzz.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const native = Platform.OS === "ios" || Platform.OS === "android";

export const HAPTICS_KEY = "avirlog_haptics";

// Cached so the fire-and-forget helpers below stay synchronous — a haptic that
// has to await storage arrives after the moment it was meant to mark. Hydrated
// once at import and kept current by setHapticsEnabled.
let enabled = true;
storage.getItem<boolean>(HAPTICS_KEY, true).then((v) => {
  enabled = v !== false;
});

/** Mirror the Settings switch. Persists, and takes effect immediately. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
  storage.setItem(HAPTICS_KEY, value);
}

export async function getHapticsEnabled(): Promise<boolean> {
  const v = await storage.getItem<boolean>(HAPTICS_KEY, true);
  enabled = v !== false;
  return enabled;
}

/** Finger down on a log button — immediate, before any network/storage work. */
export function hapticPress(): void {
  if (!native || !enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** The log was written. The confirming beat of the pair. */
export function hapticLogged(): void {
  if (!native || !enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** The log failed — a distinctly different buzz so an error is never mistaken. */
export function hapticFailed(): void {
  if (!native || !enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** A blend control crossed into a new step. Light enough to fire repeatedly. */
export function hapticTick(): void {
  if (!native || !enabled) return;
  Haptics.selectionAsync().catch(() => {});
}
