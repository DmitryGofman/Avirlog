// Shared "create a breath log" used by the Log screen and the reminder
// notification action buttons. Routes through api(), so it works against the
// on-device store (guest) or the backend (signed in) automatically.
import { api, todayStr } from "./api";
import { BreathLog, NostrilState } from "@/src/theme/theme";

export async function createBreathLog(state: NostrilState): Promise<BreathLog> {
  return api<BreathLog>("/logs", {
    method: "POST",
    body: {
      nostril_state: state,
      tags: [],
      local_date: todayStr(),
      local_hour: new Date().getHours(),
    },
  });
}
