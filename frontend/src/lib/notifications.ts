// Local reminder notifications with Left / Right / Both action buttons.
//
// Model: a *chained* single reminder. Instead of a fixed repeating alarm, one
// reminder is scheduled at a time; the next is armed only after you interact
// with the current one (tap it or a quick-log button) — or when you next open
// the app. Reminders never fire inside the sleep window. Native only; every
// call is a no-op on web.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { endBreathWindow, startBreathWindow } from "@/src/lib/liveActivityBridge";
import { pickMessage, SWARA } from "@/src/lib/swara";
import { clearWidgetDue, setWidgetDue } from "@/src/lib/widgetBridge";
import { NostrilState, STATE_META } from "@/src/theme/theme";

// The Live Activity logging window stays up for at most this long before it
// goes stale and the classic notification takes over as the fallback.
const LIVE_WINDOW_SECONDS = 600;

export const BREATH_CATEGORY = "breath-log";
const CHANNEL_ID = "reminders";

export interface ReminderConfig {
  reminder_enabled: boolean;
  reminder_interval_seconds: number;
  quiet_hours_enabled: boolean;
  quiet_start_minutes: number;
  quiet_end_minutes: number;
}

const ACTION_TO_STATE: Record<string, NostrilState> = {
  "log-left": "left",
  "log-right": "right",
  "log-both": "both",
};

export function actionToState(actionId: string): NostrilState | null {
  return ACTION_TO_STATE[actionId] ?? null;
}

let configured = false;

// Register the foreground presentation behaviour, the Left/Right/Both action
// category, and (Android) a high-importance channel. Safe to call repeatedly.
export async function configureNotifications(): Promise<void> {
  if (Platform.OS === "web") return;

  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    configured = true;
  }

  await Notifications.setNotificationCategoryAsync(BREATH_CATEGORY, [
    { identifier: "log-left", buttonTitle: "Left", options: { opensAppToForeground: false } },
    { identifier: "log-right", buttonTitle: "Right", options: { opensAppToForeground: false } },
    { identifier: "log-both", buttonTitle: "Both", options: { opensAppToForeground: false } },
  ]);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Breath reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === "granted") return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted || next.status === "granted";
}

// ---- sleep window ----
// nowMinutes is minutes since local midnight. The window may wrap past
// midnight (e.g. 22:00 → 07:00).
function inQuiet(minutes: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

// Given a Date that lands inside the sleep window, return the Date the window
// next ends (so the reminder resumes right when you wake).
function quietEndAfter(t: Date, endMinutes: number): Date {
  const e = new Date(t);
  e.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  if (e.getTime() <= t.getTime()) e.setDate(e.getDate() + 1);
  return e;
}

// Seconds from now until the next reminder should fire, honoring sleep hours.
function nextDelaySeconds(cfg: ReminderConfig): number {
  let target = new Date(Date.now() + Math.max(5, cfg.reminder_interval_seconds) * 1000);
  if (cfg.quiet_hours_enabled) {
    const mins = target.getHours() * 60 + target.getMinutes();
    if (inQuiet(mins, cfg.quiet_start_minutes, cfg.quiet_end_minutes)) {
      target = quietEndAfter(target, cfg.quiet_end_minutes);
    }
  }
  return Math.max(5, Math.round((target.getTime() - Date.now()) / 1000));
}

// Cancel any pending reminder and arm exactly one for the next tick. The
// widget is lit at the same moment (shared "due" time).
export async function scheduleNextReminder(cfg: ReminderConfig): Promise<void> {
  if (Platform.OS === "web" || !cfg.reminder_enabled) return;
  await configureNotifications();
  await cancelReminders();
  const delay = nextDelaySeconds(cfg);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Breath check",
      body: "Which nostril is active? Hold to log · Left / Right / Both",
      categoryIdentifier: BREATH_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delay,
      repeats: false,
      channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
    },
  });
  setWidgetDue(Date.now() / 1000 + delay, cfg.reminder_interval_seconds);
  // Open the interactive Live Activity logging window (no-op if unsupported).
  // It counts down and offers Left/Right/Both; when it goes stale the
  // scheduled notification above is the fallback.
  startBreathWindow(Math.min(delay, LIVE_WINDOW_SECONDS));
}

// Re-arm on app open / after a swipe: only if reminders are on and nothing is
// currently pending (so opening the app doesn't reset a live timer).
export async function ensureReminderArmed(cfg: ReminderConfig): Promise<void> {
  if (Platform.OS === "web" || !cfg.reminder_enabled) return;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  if (pending.length === 0) await scheduleNextReminder(cfg);
}

// A short confirmation that appears in the notification bar right after a
// quick-log, so logging from the lock screen gives visible feedback.
export async function presentLogConfirmation(state: NostrilState): Promise<void> {
  if (Platform.OS === "web") return;
  const meta = STATE_META[state];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Logged · ${meta.label} · ${SWARA[state].sanskrit}`,
      body: pickMessage(state),
    },
    trigger: null, // immediate
  });
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  clearWidgetDue();
  endBreathWindow();
}
