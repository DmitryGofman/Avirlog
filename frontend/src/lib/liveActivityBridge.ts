// JS wrapper around the native LiveActivity module (modules/live-activity).
// Everything here is a safe no-op when the module isn't present — web, Expo Go,
// Android, or a build that hasn't compiled the target yet — so callers never
// need to guard platform themselves.
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface LiveActivityModule {
  isSupported(): boolean;
  isRunning(): boolean;
  startWindow(windowSeconds: number): boolean;
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

// Whether a logging window is open right now. False whenever the module is
// absent, so callers treat "can't tell" as "nothing running" and try to start.
export function liveActivityRunning(): boolean {
  if (Platform.OS !== "ios" || !LA) return false;
  try {
    return LA.isRunning();
  } catch {
    return false;
  }
}

// Open a timed logging window (the countdown Live Activity + Dynamic Island).
// Returns whether one is now running — false when ActivityKit refused, which it
// does for any attempt made while the app is in the background.
export function startBreathWindow(windowSeconds: number): boolean {
  if (Platform.OS !== "ios" || !LA) return false;
  try {
    return LA.startWindow(windowSeconds);
  } catch {
    // a missing/denied Live Activity should never break logging
    return false;
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
