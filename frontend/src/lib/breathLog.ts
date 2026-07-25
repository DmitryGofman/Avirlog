// Shared "create a breath log" used by the Log screen and the reminder
// notification action buttons. Routes through api(), so it works against the
// on-device store (guest) or the backend (signed in) automatically.
import { api, todayStr } from "./api";
import { BreathLog, NostrilState } from "@/src/theme/theme";

// `idempotencyKey` lets notification quick-logs pass a stable id so that a
// delivery which is retried (e.g. a background write iOS suspended before it
// flushed, then replayed via getLastNotificationResponseAsync on next open)
// upserts the same row instead of dropping or duplicating it.
export async function createBreathLog(
  state: NostrilState,
  idempotencyKey?: string,
  blend?: number,
): Promise<BreathLog> {
  return api<BreathLog>("/logs", {
    method: "POST",
    body: {
      ...(idempotencyKey ? { id: idempotencyKey } : {}),
      nostril_state: state,
      // A blend (right-nostril %) comes from the advanced widget/Live Activity
      // preset buttons; simple Left/Right/Both taps leave it unset.
      ...(blend != null ? { blend } : {}),
      tags: [],
      local_date: todayStr(),
      local_hour: new Date().getHours(),
    },
  });
}
