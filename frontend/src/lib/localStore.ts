// On-device data layer for guest / local mode.
// Mirrors the subset of the backend API the app screens use, so when no user
// is signed in everything still works against AsyncStorage / localStorage.
// Routed from src/lib/api.ts whenever there is no auth token.

import { DEFAULT_SKIN, SkinId } from "@/src/lib/config";
// Type-only: notifications.ts reaches back here through api.ts, so a value
// import would close a require cycle.
import type { ReminderStyle } from "@/src/lib/notifications";
import { storage } from "@/src/utils/storage";
import { BreathLog, NostrilState } from "@/src/theme/theme";

interface LocalApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: any;
}

export interface LocalSettings {
  reminder_enabled: boolean;
  // Reminder cadence is stored in seconds so short test intervals are possible.
  reminder_interval_seconds: number;
  // Sleep window: no reminders fire between quiet_start and quiet_end (minutes
  // since local midnight; the window may wrap past midnight).
  quiet_hours_enabled: boolean;
  quiet_start_minutes: number;
  quiet_end_minutes: number;
  theme: "light" | "dark";
  mood_journaling: boolean;
  skin: SkinId;
  // When on, the Log screen swaps the Left/Right/Both buttons for a blend
  // slider that records how open each nostril is.
  advanced_logging: boolean;
  // Which alert a due reminder uses: the classic notification, the Live
  // Activity countdown, or both.
  reminder_style: ReminderStyle;
  // Whether a widget / Live Activity tap buzzes the phone.
  widget_tap_feedback: boolean;
  // Whether reminders make a sound (and so vibrate) when they arrive.
  reminder_sound: boolean;
  // Whether the app itself vibrates on a log and while dragging a blend.
  haptics_enabled: boolean;
  // Research opt-in: whether anonymized logs may join aggregate breath-pattern
  // analysis. Off by default; the timestamps are written by the store when the
  // flag flips (mirrors the backend, which stamps them server-side), so
  // consent recorded locally survives a later sign-in-and-sync intact.
  research_consent: boolean;
  research_consent_at: string | null;
  research_revoked_at: string | null;
}

const LOGS_KEY = "avirlog_local_logs";
export const LOCAL_SETTINGS_KEY = "avirlog_local_settings";
const SETTINGS_KEY = LOCAL_SETTINGS_KEY;

const DEFAULT_SETTINGS: LocalSettings = {
  reminder_enabled: false,
  reminder_interval_seconds: 3600,
  quiet_hours_enabled: false,
  quiet_start_minutes: 22 * 60, // 22:00
  quiet_end_minutes: 7 * 60, // 07:00
  theme: "light",
  mood_journaling: true,
  skin: DEFAULT_SKIN,
  advanced_logging: false,
  reminder_style: "both",
  widget_tap_feedback: true,
  reminder_sound: true,
  haptics_enabled: true,
  research_consent: false,
  research_consent_at: null,
  research_revoked_at: null,
};

function genId(): string {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `local_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function notFound(): Error {
  const err = new Error("Not found") as Error & { status: number };
  err.status = 404;
  return err;
}

function parseQuery(qs?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!qs) return out;
  for (const part of qs.split("&")) {
    const [k, v] = part.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

async function readLogs(): Promise<BreathLog[]> {
  const raw = await storage.getItem<string>(LOGS_KEY, "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BreathLog[];
  } catch {
    return [];
  }
}

async function writeLogs(logs: BreathLog[]): Promise<void> {
  await storage.setItem(LOGS_KEY, JSON.stringify(logs));
}

// Serialize read-modify-write sequences on the logs array. Notification
// quick-logs and in-app taps can fire near-simultaneously; without this, two
// overlapping POSTs both read the same array, both push, and the second write
// clobbers the first (a lost log). Every mutating log op runs through here.
let logWriteChain: Promise<unknown> = Promise.resolve();
function withLogLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = logWriteChain.then(fn, fn);
  logWriteChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readSettings(): Promise<LocalSettings> {
  const raw = await storage.getItem<string>(SETTINGS_KEY, "");
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const stored = JSON.parse(raw) as Partial<LocalSettings> & { reminder_interval_minutes?: number };
    // Migrate the old minutes-based interval to seconds.
    if (stored.reminder_interval_seconds == null && stored.reminder_interval_minutes != null) {
      stored.reminder_interval_seconds = Math.round(stored.reminder_interval_minutes * 60);
    }
    delete stored.reminder_interval_minutes;
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function writeSettings(next: LocalSettings): Promise<void> {
  await storage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

export async function localApi<T = any>(path: string, options: LocalApiOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const [rawPath, queryStr] = path.split("?");
  const query = parseQuery(queryStr);
  const segments = rawPath.split("/").filter(Boolean);

  // ----- /settings -----
  if (rawPath === "/settings") {
    if (method === "GET") return (await readSettings()) as T;
    if (method === "PUT") {
      const prev = await readSettings();
      const next = { ...prev, ...(options.body ?? {}) } as LocalSettings;
      // Stamp consent transitions here, not in the UI, so every caller gets
      // the audit trail (mirrors the backend's server-side stamping).
      if (next.research_consent && !prev.research_consent) {
        next.research_consent_at = new Date().toISOString();
      } else if (!next.research_consent && prev.research_consent) {
        next.research_revoked_at = new Date().toISOString();
      }
      await writeSettings(next);
      return next as T;
    }
  }

  // ----- /export -----
  if (rawPath === "/export" && method === "GET") {
    return {
      exported_at: new Date().toISOString(),
      user: null,
      settings: await readSettings(),
      logs: await readLogs(),
    } as T;
  }

  // ----- /logs/dates -----
  if (rawPath === "/logs/dates" && method === "GET") {
    const logs = await readLogs();
    const agg: Record<string, { date: string; count: number; left: number; right: number; both: number }> = {};
    for (const l of logs) {
      const d = agg[l.local_date] ?? { date: l.local_date, count: 0, left: 0, right: 0, both: 0 };
      d.count += 1;
      d[l.nostril_state] += 1;
      agg[l.local_date] = d;
    }
    return Object.values(agg).sort((a, b) => (a.date < b.date ? 1 : -1)) as T;
  }

  // ----- /logs (collection) -----
  if (rawPath === "/logs") {
    if (method === "GET") {
      let logs = await readLogs();
      const { date, start, end } = query;
      if (date) logs = logs.filter((l) => l.local_date === date);
      else if (start && end) logs = logs.filter((l) => l.local_date >= start && l.local_date <= end);
      logs.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      return logs as T;
    }
    // Clear a whole day at once — e.g. a burst of accidental logs from first
    // opening the app. Requires ?date= so it can never wipe everything by
    // accident. Returns how many rows were removed.
    if (method === "DELETE" && query.date) {
      const day = query.date;
      return withLogLock(async () => {
        const logs = await readLogs();
        const keep = logs.filter((l) => l.local_date !== day);
        await writeLogs(keep);
        return { deleted: logs.length - keep.length } as T;
      });
    }
    if (method === "POST") {
      const body = options.body ?? {};
      return withLogLock(async () => {
        const logs = await readLogs();
        // Idempotent create: if the caller supplied an id (notification
        // quick-logs do, to survive retried deliveries) and a log with that id
        // already exists, return it unchanged instead of adding a duplicate.
        if (body.id) {
          const existing = logs.find((l) => l.id === body.id);
          if (existing) return existing as T;
        }
        const now = new Date().toISOString();
        const log: BreathLog = {
          id: body.id ?? genId(),
          user_id: "local",
          nostril_state: body.nostril_state as NostrilState,
          blend: body.blend ?? null,
          mood_score: body.mood_score ?? null,
          energy_score: body.energy_score ?? null,
          focus_score: body.focus_score ?? null,
          note: body.note ?? null,
          tags: body.tags ?? [],
          local_date: body.local_date,
          local_hour: body.local_hour ?? new Date().getHours(),
          tz_offset_minutes: body.tz_offset_minutes ?? null,
          created_at: now,
          updated_at: now,
        };
        logs.push(log);
        await writeLogs(logs);
        return log as T;
      });
    }
  }

  // ----- /logs/:id (item) -----
  if (segments[0] === "logs" && segments.length === 2) {
    const id = segments[1];
    if (method === "PATCH") {
      return withLogLock(async () => {
        const logs = await readLogs();
        const idx = logs.findIndex((l) => l.id === id);
        if (idx === -1) throw notFound();
        logs[idx] = { ...logs[idx], ...(options.body ?? {}), updated_at: new Date().toISOString() };
        await writeLogs(logs);
        return logs[idx] as T;
      });
    }
    if (method === "DELETE") {
      return withLogLock(async () => {
        const logs = await readLogs();
        const idx = logs.findIndex((l) => l.id === id);
        if (idx === -1) throw notFound();
        logs.splice(idx, 1);
        await writeLogs(logs);
        return { ok: true } as T;
      });
    }
  }

  throw new Error(`Local mode does not support ${method} ${path}`);
}
