// JS side of the widget bridge. Talks to the App Group store shared with the
// WidgetKit extension (see targets/widget + modules/app-group-storage). All
// calls are safe no-ops when the native module is absent (web, Android, or a
// build without the widget), so callers never need to guard by platform.
import { requireOptionalNativeModule } from "expo";

import { createBreathLog } from "@/src/lib/breathLog";
import { NostrilState } from "@/src/theme/theme";

interface AppGroupNative {
  setNumber(key: string, value: number): void;
  getNumber(key: string): number;
  setString(key: string, value: string): void;
  getString(key: string): string | null;
  remove(key: string): void;
  reloadWidget(): void;
}

const M = requireOptionalNativeModule<AppGroupNative>("AppGroupStorage");

export const widgetAvailable = !!M;

// Tell the widget when to switch to its "LOG NOW" state, and remember the
// cadence so a widget tap can arm the next one itself.
export function setWidgetDue(nextDueEpochSeconds: number, intervalSeconds: number): void {
  if (!M) return;
  M.setNumber("intervalSeconds", intervalSeconds);
  M.setNumber("nextDueAt", nextDueEpochSeconds);
  M.reloadWidget();
}

// Reminders turned off — calm the widget.
export function clearWidgetDue(): void {
  if (!M) return;
  M.setNumber("nextDueAt", 0);
  M.reloadWidget();
}

// Import logs made on the widget into the on-device store. Returns how many.
export async function importWidgetLogs(): Promise<number> {
  if (!M) return 0;
  const raw = M.getString("pendingLogs");
  if (!raw) return 0;
  M.remove("pendingLogs");
  let items: { state: NostrilState; at: number }[] = [];
  try {
    items = JSON.parse(raw);
  } catch {
    return 0;
  }
  for (const it of items) {
    if (it?.state) await createBreathLog(it.state).catch(() => {});
  }
  M.reloadWidget();
  return items.length;
}
