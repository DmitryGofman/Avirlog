// Local reminder notifications with Left / Right / Both action buttons.
//
// Model: a *chained* single reminder. Instead of a fixed repeating alarm, one
// reminder is scheduled at a time; the next is armed only after you interact
// with the current one (tap it or a quick-log button) — or when you next open
// the app. Reminders never fire inside the sleep window. Native only; every
// call is a no-op on web.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  endBreathWindow,
  liveActivityRunning,
  startBreathWindow,
} from "@/src/lib/liveActivityBridge";
import { storage } from "@/src/utils/storage";
import { pickMessage, SWARA } from "@/src/lib/swara";
import { clearWidgetDue, setWidgetDue } from "@/src/lib/widgetBridge";
import { NostrilState, STATE_META } from "@/src/theme/theme";

// iOS lets a Live Activity stay active for up to 8 hours, which covers every
// reminder interval the app offers. This used to be 10 minutes, so on an
// hour-long interval the card counted down to a moment that meant nothing and
// then vanished for the remaining fifty — the window now runs to the actual
// reminder time.
const LIVE_WINDOW_SECONDS = 8 * 3600;

// In "both" style the Live Activity opens only inside this final stretch
// before the reminder is due. Running it for the whole interval meant that the
// moment you logged — on the card itself, on the widget, in the app — the next
// cycle's card came straight back on the next foreground, so a tap never
// seemed to close anything. Now logging closes the card and it stays closed;
// the countdown reappears near the due time, and the notification remains the
// guaranteed prompt either way. "live" style is exempt: there the card IS the
// reminder, so it runs the full interval by design.
const LIVE_LEAD_SECONDS = 20 * 60;

// When the armed reminder is due, in epoch ms. Kept because a Live Activity can
// only be started with the app in the foreground: when the background attempt
// fails, the next app open needs to know how much of the window is left.
const DUE_AT_KEY = "avirlog_next_due_at";

export const BREATH_CATEGORY = "breath-log";
// Advanced variant: the reminder offers three preset-blend buttons instead of
// plain Left / Right / Both, matching the widget + Live Activity.
export const BREATH_BLEND_CATEGORY = "breath-blend";
const CHANNEL_ID = "reminders";

// How a due reminder announces itself.
//   "banner" — only the classic notification (sound + Notification Centre).
//   "live"   — only the Live Activity: a countdown card on the Lock Screen and
//              in the Dynamic Island. Silent: it appears when the reminder is
//              armed and runs down to zero without buzzing.
//   "both"   — the default, and what shipped before this setting existed.
export type ReminderStyle = "banner" | "live" | "both";

export const REMINDER_STYLES: { value: ReminderStyle; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "banner", label: "Notification" },
  { value: "live", label: "Live Activity" },
];

export interface ReminderConfig {
  reminder_enabled: boolean;
  reminder_interval_seconds: number;
  quiet_hours_enabled: boolean;
  quiet_start_minutes: number;
  quiet_end_minutes: number;
  // When on, the reminder shows preset-blend buttons (mirrors Advanced logging).
  advanced_logging?: boolean;
  // Absent on settings saved before this existed — treated as "both".
  reminder_style?: ReminderStyle;
  // When off, reminders arrive silently: the banner still appears, but there is
  // no alert tone and so no vibration either — on iOS a notification's haptic
  // is tied to its sound and can't be kept without it.
  reminder_sound?: boolean;
}

export function reminderStyle(cfg?: { reminder_style?: ReminderStyle } | null): ReminderStyle {
  return cfg?.reminder_style ?? "both";
}

const ACTION_TO_STATE: Record<string, NostrilState> = {
  "log-left": "left",
  "log-right": "right",
  "log-both": "both",
};

// Preset-blend actions → the right-nostril % they log and its dominant side.
// Seven levels, symmetric around even, matching the widget and Live Activity:
// 100 / 80 / 60 Ida · 50 even · 60 / 80 / 100 Pingala. The number is the share
// of the DOMINANT side, so "60% left" stores right = 40.
const ACTION_TO_BLEND: Record<string, { state: NostrilState; right: number }> = {
  "blend-l100": { state: "left", right: 0 },
  "blend-l80": { state: "left", right: 20 },
  "blend-l60": { state: "left", right: 40 },
  "blend-even": { state: "both", right: 50 },
  "blend-r60": { state: "right", right: 60 },
  "blend-r80": { state: "right", right: 80 },
  "blend-r100": { state: "right", right: 100 },
};

export function actionToState(actionId: string): NostrilState | null {
  return ACTION_TO_STATE[actionId] ?? null;
}

export function actionToBlend(actionId: string): { state: NostrilState; right: number } | null {
  return ACTION_TO_BLEND[actionId] ?? null;
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
        // Honoured per-notification by content.sound; this only allows it.
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    configured = true;
  }

  await Notifications.setNotificationCategoryAsync(BREATH_CATEGORY, [
    { identifier: "log-left", buttonTitle: "Left", options: { opensAppToForeground: false } },
    { identifier: "log-both", buttonTitle: "Both", options: { opensAppToForeground: false } },
    { identifier: "log-right", buttonTitle: "Right", options: { opensAppToForeground: false } },
  ]);

  await Notifications.setNotificationCategoryAsync(BREATH_BLEND_CATEGORY, [
    { identifier: "blend-l100", buttonTitle: "100% Left", options: { opensAppToForeground: false } },
    { identifier: "blend-l80", buttonTitle: "80% Left", options: { opensAppToForeground: false } },
    { identifier: "blend-l60", buttonTitle: "60% Left", options: { opensAppToForeground: false } },
    { identifier: "blend-even", buttonTitle: "Even 50 / 50", options: { opensAppToForeground: false } },
    { identifier: "blend-r60", buttonTitle: "60% Right", options: { opensAppToForeground: false } },
    { identifier: "blend-r80", buttonTitle: "80% Right", options: { opensAppToForeground: false } },
    { identifier: "blend-r100", buttonTitle: "100% Right", options: { opensAppToForeground: false } },
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
  const advanced = !!cfg.advanced_logging;
  const style = reminderStyle(cfg);

  if (style !== "live") {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Breath check",
        body: advanced
          ? "How open is each nostril? Hold to log a blend"
          : "Which nostril is active? Hold to log · Left / Both / Right",
        categoryIdentifier: advanced ? BREATH_BLEND_CATEGORY : BREATH_CATEGORY,
        sound: cfg.reminder_sound !== false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delay,
        repeats: false,
        channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
      },
    });
  }
  // The widget lights up on the same schedule whichever style is chosen.
  setWidgetDue(Date.now() / 1000 + delay, cfg.reminder_interval_seconds);
  await storage.setItem(DUE_AT_KEY, Date.now() + delay * 1000);
  // Open the interactive Live Activity logging window (no-op if unsupported).
  // It counts down to the reminder and offers the log buttons.
  //
  // This SILENTLY FAILS whenever the app isn't in the foreground — ActivityKit
  // refuses to start an activity from the background, and the most common
  // re-arm path is a notification quick-log, which never foregrounds the app.
  // ensureLiveWindow() below is the recovery.
  //
  // "live" opens for the whole interval (the card is the only reminder);
  // "both" opens only when the due time is already inside the lead window, so
  // logging doesn't immediately resurrect a card for the next cycle.
  if (style === "live") {
    startBreathWindow(Math.min(delay, LIVE_WINDOW_SECONDS));
  } else if (style === "both" && delay <= LIVE_LEAD_SECONDS) {
    startBreathWindow(delay);
  }
}

// Re-open the Live Activity window if reminders are on, the style wants one,
// and none is running — e.g. because scheduleNextReminder ran in the background
// and ActivityKit refused it. Safe to call on every foreground: it starts an
// activity only when there genuinely isn't one.
export async function ensureLiveWindow(cfg: ReminderConfig): Promise<void> {
  if (Platform.OS !== "ios" || !cfg.reminder_enabled) return;
  const style = reminderStyle(cfg);
  if (style === "banner") return;
  if (liveActivityRunning()) return;
  const dueAt = await storage.getItem<number>(DUE_AT_KEY, 0);
  if (!dueAt) return;
  const secondsLeft = Math.round((dueAt - Date.now()) / 1000);
  // Under half a minute left: the reminder is about to fire and re-arm the
  // chain anyway, so a window now would be replaced immediately.
  if (secondsLeft < 30) return;
  // "both": the card belongs only to the final stretch before the due time.
  // Reopening it earlier is what made a just-logged card come straight back.
  if (style === "both" && secondsLeft > LIVE_LEAD_SECONDS) return;
  startBreathWindow(Math.min(secondsLeft, LIVE_WINDOW_SECONDS));
}

// Re-arm on app open / after a swipe: only if reminders are on and nothing is
// currently pending (so opening the app doesn't reset a live timer).
export async function ensureReminderArmed(cfg: ReminderConfig): Promise<void> {
  if (Platform.OS === "web" || !cfg.reminder_enabled) return;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  if (pending.length === 0) await scheduleNextReminder(cfg);
}

// A short confirmation that appears in the notification bar right after a
// quick-log, so logging from the lock screen gives visible feedback. Skipped in
// Live-Activity-only mode, where the whole point is to keep the bar quiet.
export async function presentLogConfirmation(
  state: NostrilState,
  style: ReminderStyle = "both",
): Promise<void> {
  if (Platform.OS === "web" || style === "live") return;
  const meta = STATE_META[state];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Logged · ${meta.label} · ${SWARA[state].sanskrit}`,
      body: pickMessage(state),
    },
    trigger: null, // immediate
  });
}

// Take down whatever is still asking you to log: the delivered reminder sitting
// in Notification Centre and the Live Activity / Dynamic Island window. Called
// after EVERY log, wherever it came from — before this, logging inside the app
// left the reminder you tapped still sitting on the Lock Screen.
export async function clearBreathPrompts(): Promise<void> {
  if (Platform.OS === "web") return;
  endBreathWindow();
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // dismissal is cosmetic — never let it break a log
  }
}

// Note: cancels SCHEDULED reminders only. Delivered ones are left alone — this
// runs at the top of scheduleNextReminder, right after a quick-log posts its
// "Logged" confirmation, and dismissing here would take that down too.
export async function cancelReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await storage.setItem(DUE_AT_KEY, 0);
  clearWidgetDue();
  endBreathWindow();
}
