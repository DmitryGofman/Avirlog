// Pure reminder-timing logic: no React Native, no Expo, so it can be tested with
// plain Node (see tests/reminderSlots.test.ts). Used by src/lib/notifications.ts.
// The Swift twin lives in targets/widget/_shared/SharedLogging.swift
// (SharedStore.reminderSlots) — keep the two in sync.

// The slice of the reminder settings that decides WHEN reminders fire.
export interface SlotConfig {
  reminder_interval_seconds: number;
  quiet_hours_enabled: boolean;
  quiet_start_minutes: number;
  quiet_end_minutes: number;
}

// ---- sleep window ----
// nowMinutes is minutes since local midnight. The window may wrap past
// midnight (e.g. 22:00 → 07:00).
export function inQuiet(minutes: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

// Given a Date that lands inside the sleep window, return the Date the window
// next ends (so the reminder resumes right when you wake).
export function quietEndAfter(t: Date, endMinutes: number): Date {
  const e = new Date(t);
  e.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  if (e.getTime() <= t.getTime()) e.setDate(e.getDate() + 1);
  return e;
}

// The next `count` reminder times after `fromMs`, in epoch ms. Each slot is one
// interval after the previous; a slot that lands in the sleep window moves to
// the moment the window ends, and the cadence continues from there.
// Keep in sync with SharedStore.reminderSlots in targets/widget/_shared/SharedLogging.swift.
export function reminderSlots(cfg: SlotConfig, fromMs: number, count: number): number[] {
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

