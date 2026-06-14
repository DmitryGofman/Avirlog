// On-device data layer for guest / local mode.
// Mirrors the subset of the backend API the app screens use, so when no user
// is signed in everything still works against AsyncStorage / localStorage.
// Routed from src/lib/api.ts whenever there is no auth token.

import { storage } from "@/src/utils/storage";
import { BreathLog, NostrilState } from "@/src/theme/theme";

interface LocalApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: any;
}

export interface LocalSettings {
  reminder_enabled: boolean;
  reminder_interval_minutes: number;
  theme: "light" | "dark";
  mood_journaling: boolean;
}

const LOGS_KEY = "avirlog_local_logs";
const SETTINGS_KEY = "avirlog_local_settings";

const DEFAULT_SETTINGS: LocalSettings = {
  reminder_enabled: false,
  reminder_interval_minutes: 60,
  theme: "light",
  mood_journaling: true,
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

async function readSettings(): Promise<LocalSettings> {
  const raw = await storage.getItem<string>(SETTINGS_KEY, "");
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<LocalSettings>) };
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
      const next = { ...(await readSettings()), ...(options.body ?? {}) } as LocalSettings;
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
    if (method === "POST") {
      const body = options.body ?? {};
      const now = new Date().toISOString();
      const log: BreathLog = {
        id: genId(),
        user_id: "local",
        nostril_state: body.nostril_state as NostrilState,
        mood_score: body.mood_score ?? null,
        energy_score: body.energy_score ?? null,
        focus_score: body.focus_score ?? null,
        note: body.note ?? null,
        tags: body.tags ?? [],
        local_date: body.local_date,
        local_hour: body.local_hour ?? new Date().getHours(),
        created_at: now,
        updated_at: now,
      };
      const logs = await readLogs();
      logs.push(log);
      await writeLogs(logs);
      return log as T;
    }
  }

  // ----- /logs/:id (item) -----
  if (segments[0] === "logs" && segments.length === 2) {
    const id = segments[1];
    const logs = await readLogs();
    const idx = logs.findIndex((l) => l.id === id);
    if (method === "PATCH") {
      if (idx === -1) throw notFound();
      logs[idx] = { ...logs[idx], ...(options.body ?? {}), updated_at: new Date().toISOString() };
      await writeLogs(logs);
      return logs[idx] as T;
    }
    if (method === "DELETE") {
      if (idx === -1) throw notFound();
      logs.splice(idx, 1);
      await writeLogs(logs);
      return { ok: true } as T;
    }
  }

  throw new Error(`Local mode does not support ${method} ${path}`);
}
