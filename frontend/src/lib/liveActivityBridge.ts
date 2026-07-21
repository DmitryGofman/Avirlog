// JS wrapper around the native LiveActivity module (modules/live-activity).
// Everything here is a safe no-op when the module isn't present — web, Expo Go,
// Android, or a build that hasn't compiled the target yet — so callers never
// need to guard platform themselves.
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface LiveActivityModule {
  isSupported(): boolean;
  startWindow(windowSeconds: number): void;
  endAll(): void;
}

const LA = requireOptionalNativeModule<LiveActivityModule>("LiveActivity");

export function liveActivitySupported(): boolean {
  if (Platform.OS !== "ios" || !LA) return false;
  try {
    return LA.isSupported();
  } catch {
    return false;
  }
}

// Open a timed logging window (the countdown Live Activity + Dynamic Island).
export function startBreathWindow(windowSeconds: number): void {
  if (Platform.OS !== "ios" || !LA) return;
  try {
    LA.startWindow(windowSeconds);
  } catch {
    // ignore — a missing/denied Live Activity should never break logging
  }
}

// Close any open window (call right after a log).
export function endBreathWindow(): void {
  if (Platform.OS !== "ios" || !LA) return;
  try {
    LA.endAll();
  } catch {
    // ignore
  }
}
