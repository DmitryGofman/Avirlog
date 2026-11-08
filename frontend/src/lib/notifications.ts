// Local reminder notifications with Left / Right / Both action buttons.
//
// Model: a rolling batch. The next REMINDER_BATCH reminders are booked up
// front, so a reminder you ignore never stops the ones after it. Every log —
// from the app, a notification button, the widget or the Live Activity —
// re-books the batch from that moment, and opening the app tops it up.
// Reminders never fire inside the sleep window. Native only; every call is a
// no-op on web.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  endBreathWindow,
  liveActivityRunning,
  startBreathWindow,
} from "@/src/lib/liveActivityBridge";
import { storage } from "@/src/utils/storage";
import { pickMessage, SWARA } from "@/src/lib/swara";
import { clearWidgetDue, setWidgetDue, setWidgetReminderConfig } from "@/src/lib/widgetBridge";
import { NostrilState, STATE_META } from "@/src/theme/theme";

// iOS lets a Live Activity stay active for up to 8 hours, which covers every
// reminder interval the app offers. This used to be 10 minutes, so on an
// hour-long interval the card counted down to a moment that meant nothing and
// then vanished for the remaining fifty — the window now runs to the actual
// reminder time.
const LIVE_WINDOW_SECONDS = 8 * 3600;

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

// How many upcoming reminders are booked at once. iOS keeps at most 64 pending
// local notifications per app; 48 leaves room for the immediate "Logged"
// confirmations and the widget's tap buzz. At an hour's interval that is two
// days of reminders; at the 30-second test interval, 24 minutes.
//
// Booking a batch is what makes reminders reliable. The old model armed ONE
// reminder and relied on you answering it to arm the next — so the first
// reminder you ignored ended the chain until you happened to open the app.
// Now ignoring reminders changes nothing: the rest are already booked. Any log
// (app, notification, widget, Live Activity) re-books the batch from that
// moment, so the cadence restarts from your latest check.
// Keep in sync with REMINDER_BATCH in targets/widget/index.swift.
export const REMINDER_BATCH = 48;
// Top the batch up on app open once fewer than this many remain.
const REFILL_BELOW = REMINDER_BATCH / 2;

// The next `count` reminder times after `fromMs`, in epoch ms. Each slot is one
// interval after the previous; a slot that lands in the sleep window moves to
// the moment the window ends, and the cadence continues from there.
// Keep in sync with reminderSlots() in targets/widget/index.swift.
export function reminderSlots(cfg: ReminderConfig, fromMs: number, count: number): number[] {
  const step = Math.max(5, cfg.reminder_interval_seconds) * 1000;
  const out: number[] = [];
  let t = fromMs;
  for (let i = 0; i < count; i++) {
    let next = new Date(t + step);
    if (cfg.quiet_hours_enabled) {
      const mins = next.getHours() * 60 + next.getMinutes();
      if (inQuiet(mins, cfg.quiet_start_minutes, cfg.quiet_end_minutes)) {
        next = quietEndAfter(next, cfg.quiet_end_minutes);
      }
    }
    t = next.getTime();
    out.push(t);
  }
  return out;
}

function reminderContent(cfg: ReminderConfig): Notifications.NotificationContentInput {
  const advanced = !!cfg.advanced_logging;
  return {
    title: "Breath check",
    body: advanced
      ? "How open is each nostril? Hold to log a blend"
      : "Which nostril is active? Hold to log · Left / Both / Right",
    categoryIdentifier: advanced ? BREATH_BLEND_CATEGORY : BREATH_CATEGORY,
    sound: cfg.reminder_sound !== false,
  };
}

async function bookSlots(cfg: ReminderConfig, slots: number[]): Promise<void> {
  const content = reminderContent(cfg);
  for (const at of slots) {
    await Notifications.scheduleNotificationAsync({
      // Stable per-slot id, so booking the same slot twice replaces it.
      identifier: `breath-${Math.round(at / 1000)}`,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(at),
        channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
      },
    });
  }
}

function isReminder(r: Notifications.NotificationRequest): boolean {
  return r.identifier.startsWith("breath-");
}

// Fire time of a scheduled reminder, read back from its slot id.
function slotOf(r: Notifications.NotificationRequest): number {
  return Number(r.identifier.slice("breath-".length)) * 1000;
}

// Cancel whatever is booked and book a fresh batch starting one interval from
// now. Called after every log and every settings change. The widget is lit at
// the first slot (shared "due" time).
export async function scheduleNextReminder(cfg: ReminderConfig): Promise<void> {
  if (Platform.OS === "web" || !cfg.reminder_enabled) return;
  await configureNotifications();
  await cancelReminders();
  // Let the widget extension re-book the same way after a widget / Live
  // Activity log, when this JS isn't running.
  setWidgetReminderConfig(cfg);
  const style = reminderStyle(cfg);

  // Live-Activity-only mode books no notifications — only the next due time.
  const slots = reminderSlots(cfg, Date.now(), style === "live" ? 1 : REMINDER_BATCH);
  if (style !== "live") await bookSlots(cfg, slots);
  const dueAt = slots[0];
  const delay = Math.max(5, Math.round((dueAt - Date.now()) / 1000));
  // The widget lights up on the same schedule whichever style is chosen.
  setWidgetDue(dueAt / 1000, cfg.reminder_interval_seconds);
  await storage.setItem(DUE_AT_KEY, dueAt);
  // Open the interactive Live Activity logging window (no-op if unsupported).
  // It counts down to the reminder and offers the log buttons.
  //
  // This SILENTLY FAILS whenever the app isn't in the foreground — ActivityKit
  // refuses to start an activity from the background, and the most common
  // re-arm path is a notification quick-log, which never foregrounds the app.
  // ensureLiveWindow() below is the recovery.
  if (style !== "banner") startBreathWindow(Math.min(delay, LIVE_WINDOW_SECONDS));
}

// Re-open the Live Activity window if reminders are on, the style wants one,
// and none is running — e.g. because scheduleNextReminder ran in the background
// and ActivityKit refused it. Safe to call on every foreground: it starts an
// activity only when there genuinely isn't one.
export async function ensureLiveWindow(cfg: ReminderConfig): Promise<void> {
  if (Platform.OS !== "ios" || !cfg.reminder_enabled) return;
  if (reminderStyle(cfg) === "banner") return;
  if (liveActivityRunning()) return;
  let dueAt = await storage.getItem<number>(DUE_AT_KEY, 0);
  if (!dueAt) return;
  if (dueAt <= Date.now() && reminderStyle(cfg) !== "live") {
    // That reminder came and went unanswered; the batch carries on, so count
    // down to the next booked one.
    const upcoming = (await Notifications.getAllScheduledNotificationsAsync())
      .filter(isReminder)
      .map(slotOf)
      .filter((t) => t > Date.now());
    if (upcoming.length === 0) return;
    dueAt = Math.min(...upcoming);
    await storage.setItem(DUE_AT_KEY, dueAt);
    setWidgetDue(dueAt / 1000, cfg.reminder_interval_seconds);
  }
  const secondsLeft = Math.round((dueAt - Date.now()) / 1000);
  // Under half a minute left: the reminder is about to fire and re-arm the
  // chain anyway, so a window now would be replaced immediately.
  if (secondsLeft < 30) return;
  startBreathWindow(Math.min(secondsLeft, LIVE_WINDOW_SECONDS));
}

// On app open: make sure reminders are still booked, WITHOUT restarting the
// cadence (opening the app is not a log). Books a fresh batch only when
// nothing is left; tops the batch up from its last slot when it is running low.
export async function ensureReminderArmed(cfg: ReminderConfig): Promise<void> {
  if (Platform.OS === "web" || !cfg.reminder_enabled) return;
  setWidgetReminderConfig(cfg);

  if (reminderStyle(cfg) === "live") {
    // No notifications to count in this mode, so the stored due time is the
    // only record. Re-arm only once it has passed — re-arming every time the
    // app opened used to restart the countdown on each open.
    const dueAt = await storage.getItem<number>(DUE_AT_KEY, 0);
    if (!dueAt || dueAt <= Date.now()) await scheduleNextReminder(cfg);
    return;
  }

  const pending = (await Notifications.getAllScheduledNotificationsAsync()).filter(isReminder);
  if (pending.length === 0) {
    await scheduleNextReminder(cfg);
    return;
  }
  if (pending.length < REFILL_BELOW) {
    await configureNotifications();
    const last = Math.max(...pending.map(slotOf));
    await bookSlots(cfg, reminderSlots(cfg, last, REMINDER_BATCH - pending.length));
  }
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

// Reminders switched off: also tell the widget extension, so a widget tap
// doesn't book a fresh batch behind the user's back.
export async function disableReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  setWidgetReminderConfig(null);
  await cancelReminders();
}
