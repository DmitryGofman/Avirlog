// One-time local -> cloud migration.
//
// A guest's logs live only in AsyncStorage. Without this, the first sign-in
// would show an empty history while every local log sat orphaned on the device.
// Runs once after sign-in and uploads them into the account.
//
// Safety properties, in order of how much they matter:
//   1. Idempotent. Rows are keyed on the ids they already have on-device, and
//      POST /logs/import upserts, so a retry after a partial failure re-sends
//      the same rows harmlessly instead of duplicating the history.
//   2. Non-destructive. Local data is never cleared. If anything goes wrong the
//      device still holds the original, and signing out still shows it.
//   3. Claimed once. A history uploaded into one account is not later uploaded
//      into a different one, so switching accounts cannot fan copies out. The
//      same account does re-run if the device has picked up new guest logs
//      since (signed out, logged offline, signed back in).

import { api } from "./api";
import { DEFAULT_SETTINGS, LocalSettings, readLocalLogs, readLocalSettings } from "./localStore";
import { BreathLog, NostrilState } from "@/src/theme/theme";
import { storage } from "@/src/utils/storage";

const CLAIM_KEY = "avirlog_local_migration";

// The server caps a single import at 1000 rows; stay well under so a long
// history is several small requests rather than one that can time out.
const BATCH_SIZE = 200;

export interface MigrationClaim {
  user_id: string;
  at: string;
  /** How many importable local logs existed when this claim was written. */
  count: number;
}

export type MigrationResult =
  | { status: "nothing_to_migrate" }
  | { status: "already_migrated"; claim: MigrationClaim }
  | { status: "claimed_by_other_account"; claim: MigrationClaim }
  | { status: "migrated"; imported: number; skipped: number; total: number; malformed: number };

const VALID_STATES: NostrilState[] = ["left", "right", "both"];

async function readClaim(): Promise<MigrationClaim | null> {
  const raw = await storage.getItem<string>(CLAIM_KEY, "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MigrationClaim;
    return parsed && typeof parsed.user_id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeClaim(claim: MigrationClaim): Promise<void> {
  await storage.setItem(CLAIM_KEY, JSON.stringify(claim));
}

/** Shape a stored log into exactly what POST /logs/import accepts. */
function toImportItem(log: BreathLog) {
  return {
    id: log.id,
    nostril_state: log.nostril_state,
    blend: log.blend ?? null,
    mood_score: log.mood_score ?? null,
    energy_score: log.energy_score ?? null,
    focus_score: log.focus_score ?? null,
    note: log.note ?? null,
    tags: Array.isArray(log.tags) ? log.tags : [],
    local_date: log.local_date,
    local_hour: log.local_hour,
    created_at: log.created_at,
    updated_at: log.updated_at,
  };
}

// One malformed row (hand-edited export, a half-written record from an old
// build) must not 422 the batch it happens to sit in and strand the rest.
function isImportable(log: BreathLog): boolean {
  return (
    !!log &&
    typeof log.id === "string" &&
    log.id.length > 0 &&
    VALID_STATES.includes(log.nostril_state) &&
    typeof log.local_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(log.local_date) &&
    Number.isInteger(log.local_hour) &&
    log.local_hour >= 0 &&
    log.local_hour <= 23
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Push the guest's local settings up, but only into an account that has not
 * configured its own. An existing user signing in on a new device keeps the
 * settings they already chose; a brand-new account inherits the ones the user
 * had been using as a guest.
 */
async function migrateSettings(local: LocalSettings): Promise<void> {
  const remote = await api<Partial<LocalSettings>>("/settings");
  const untouched = (Object.keys(DEFAULT_SETTINGS) as (keyof LocalSettings)[]).every(
    (k) => remote[k] === undefined || remote[k] === DEFAULT_SETTINGS[k],
  );
  if (!untouched) return;
  await api("/settings", { method: "PUT", body: local });
}

/**
 * Upload on-device logs (and, for a fresh account, settings) into the
 * signed-in account. Safe to call on every sign-in: it short-circuits once the
 * local history has been claimed.
 */
export async function migrateLocalToCloud(userId: string): Promise<MigrationResult> {
  const claim = await readClaim();
  const logs = await readLocalLogs();
  const importable = logs.filter(isImportable);
  const malformed = logs.length - importable.length;

  if (claim) {
    // A history uploaded into one account is not fanned out into a second one.
    if (claim.user_id !== userId) return { status: "claimed_by_other_account", claim };
    // Same account, and nothing new on the device: done. If the local store has
    // grown since the claim (signed out, logged as a guest, signed back in),
    // fall through and re-run — the import upserts, so the rows already
    // uploaded come back as skipped rather than duplicated.
    if (importable.length <= claim.count) return { status: "already_migrated", claim };
  }

  if (importable.length === 0) {
    // Nothing to move, but the local store has still been accounted for —
    // claim it so this does not re-scan on every launch.
    await writeClaim({ user_id: userId, at: new Date().toISOString(), count: 0 });
    return { status: "nothing_to_migrate" };
  }

  let imported = 0;
  let skipped = 0;
  for (const batch of chunk(importable, BATCH_SIZE)) {
    const res = await api<{ imported: number; skipped: number; total: number }>("/logs/import", {
      method: "POST",
      body: { logs: batch.map(toImportItem) },
    });
    imported += res.imported ?? 0;
    skipped += res.skipped ?? 0;
  }

  // Only claimed once every batch landed. A throw above leaves the claim unset,
  // so the next sign-in retries — and the upsert makes that retry a no-op for
  // whatever already made it across.
  await writeClaim({ user_id: userId, at: new Date().toISOString(), count: importable.length });

  // Settings are a nicety; a failure here must not undo a successful log
  // migration or make it look like it failed.
  try {
    await migrateSettings(await readLocalSettings());
  } catch {
    // keep going — logs are what matter
  }

  return { status: "migrated", imported, skipped, total: importable.length, malformed };
}

/** Test/support hook: forget the claim so the migration can run again. */
export async function resetMigrationClaim(): Promise<void> {
  await storage.removeItem(CLAIM_KEY);
}
