import { localApi } from "./localStore";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

let authToken: string | null = null;

export function setApiToken(token: string | null) {
  authToken = token;
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  // Guest / local mode: with no signed-in user, data routes are served from
  // on-device storage. Auth routes always go to the backend (login needs it).
  if (!authToken && !path.startsWith("/auth/")) {
    return localApi<T>(path, options);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${BASE}/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let detail = "Something went wrong";
    try {
      const j = await res.json();
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      // keep default
    }
    const err = new Error(detail) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}
