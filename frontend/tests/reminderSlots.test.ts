// Run with:  yarn test   (plain Node — no Jest, no simulator)
// Covers the reminder timing that decides WHEN every reminder fires, in
// particular sleep hours that wrap past midnight. The Swift twin
// (SharedStore.reminderSlots) must behave identically.
import assert from "node:assert/strict";
import { test } from "node:test";

import { inQuiet, reminderSlots, type SlotConfig } from "../src/lib/reminderSlots.ts";

const HOUR = 3600;
const base: SlotConfig = {
  reminder_interval_seconds: HOUR,
  quiet_hours_enabled: false,
  quiet_start_minutes: 22 * 60,
  quiet_end_minutes: 7 * 60,
};
const sleep = (over: Partial<SlotConfig> = {}): SlotConfig => ({ ...base, quiet_hours_enabled: true, ...over });

// Local wall-clock time, so the tests mean the same thing in any timezone.
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const clock = (ms: number) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

test("returns `count` slots, one interval apart, when sleep hours are off", () => {
  const from = at(2026, 11, 9, 10);
  const slots = reminderSlots({ ...base, reminder_interval_seconds: 600 }, from, 5);
  assert.equal(slots.length, 5);
  slots.forEach((s, i) => assert.equal(s, from + (i + 1) * 600_000));
});

test("never books closer than 5 seconds apart", () => {
  const from = at(2026, 11, 9, 10);
  const slots = reminderSlots({ ...base, reminder_interval_seconds: 1 }, from, 3);
  assert.deepEqual(slots.map((s) => s - from), [5000, 10000, 15000]);
});

test("sleep hours off: a slot inside the would-be window is left alone", () => {
  const slots = reminderSlots(base, at(2026, 11, 9, 22), 1);
  assert.equal(clock(slots[0]), "11/9 23:00");
});

test("overnight window: a slot that lands asleep moves to wake time, then the cadence continues", () => {
  const slots = reminderSlots(sleep(), at(2026, 11, 9, 20, 30), 4);
  assert.deepEqual(slots.map(clock), ["11/9 21:30", "11/10 07:00", "11/10 08:00", "11/10 09:00"]);
});

test("overnight window: the start is asleep, the end is awake", () => {
  // 21:00 + 1h = 22:00 sharp -> asleep -> 07:00.  06:00 + 1h = 07:00 sharp -> awake.
  assert.equal(clock(reminderSlots(sleep(), at(2026, 11, 9, 21), 1)[0]), "11/10 07:00");
  assert.equal(clock(reminderSlots(sleep(), at(2026, 11, 10, 6), 1)[0]), "11/10 07:00");
  assert.equal(inQuiet(22 * 60, 22 * 60, 7 * 60), true);
  assert.equal(inQuiet(7 * 60, 22 * 60, 7 * 60), false);
});

test("overnight window: a slot in the small hours wakes the SAME day, not the next", () => {
  const slots = reminderSlots(sleep(), at(2026, 11, 10, 2), 1); // 03:00
  assert.equal(clock(slots[0]), "11/10 07:00");
});

test("same-day window (13:00-14:00)", () => {
  const cfg = sleep({ quiet_start_minutes: 13 * 60, quiet_end_minutes: 14 * 60 });
  const slots = reminderSlots(cfg, at(2026, 11, 9, 12, 30), 3);
  assert.deepEqual(slots.map(clock), ["11/9 14:00", "11/9 15:00", "11/9 16:00"]);
});

test("start == end means no window at all", () => {
  const cfg = sleep({ quiet_start_minutes: 8 * 60, quiet_end_minutes: 8 * 60 });
  assert.equal(clock(reminderSlots(cfg, at(2026, 11, 9, 7), 1)[0]), "11/9 08:00");
});

test("an interval longer than the window still lands awake", () => {
  const cfg = sleep({ reminder_interval_seconds: 24 * HOUR });
  const slots = reminderSlots(cfg, at(2026, 11, 9, 23), 3); // +24h = 23:00 -> asleep -> 07:00
  assert.deepEqual(slots.map(clock), ["11/11 07:00", "11/12 07:00", "11/13 07:00"]);
});

test("slots are strictly increasing and never inside the window (many intervals, many starts, around DST)", () => {
  const intervals = [30, 60, 300, 900, 1800, HOUR, 90 * 60, 2 * HOUR, 5 * HOUR, 12 * HOUR];
  // Includes the US spring-forward and fall-back days: run this file with TZ=America/New_York too.
  const starts = [at(2026, 3, 7, 21), at(2026, 3, 8, 1, 59), at(2026, 10, 31, 23), at(2026, 11, 1, 0, 30), at(2026, 11, 9, 6, 59)];
  for (const reminder_interval_seconds of intervals) {
    for (const from of starts) {
      const cfg = sleep({ reminder_interval_seconds });
      const slots = reminderSlots(cfg, from, 48);
      let prev = from;
      for (const s of slots) {
        assert.ok(s > prev, `not increasing at ${clock(s)} (interval ${reminder_interval_seconds}s)`);
        const d = new Date(s);
        assert.equal(
          inQuiet(d.getHours() * 60 + d.getMinutes(), cfg.quiet_start_minutes, cfg.quiet_end_minutes),
          false,
          `${clock(s)} is inside the sleep window (interval ${reminder_interval_seconds}s)`,
        );
        prev = s;
      }
    }
  }
});
