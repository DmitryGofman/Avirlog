// Bridges reminder notifications to the app. A tapped Left/Right/Both button
// logs the entry (and shows a confirmation in the notification bar); tapping
// the notification body opens the app on the Log screen. Either interaction
// arms the next reminder (the chained model). Also re-arms when the app comes
// to the foreground, so an ignored/swiped reminder doesn't end the chain.
// Native only.
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { useToast } from "@/src/components/Toast";
import { api } from "@/src/lib/api";
import { createBreathLog } from "@/src/lib/breathLog";
import {
  actionToState,
  configureNotifications,
  ensureReminderArmed,
  presentLogConfirmation,
  ReminderConfig,
  scheduleNextReminder,
} from "@/src/lib/notifications";
import { STATE_META } from "@/src/theme/theme";

async function getReminderConfig(): Promise<ReminderConfig | null> {
  try {
    return await api<ReminderConfig>("/settings");
  } catch {
    return null;
  }
}

export function useBreathNotifications() {
  const { showToast } = useToast();

  useEffect(() => {
    if (Platform.OS === "web") return;

    configureNotifications().catch(() => {});

    const handle = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const actionId = response.actionIdentifier;
      const state = actionToState(actionId);

      if (state) {
        // Quick-log button. Use the notification id + action as a stable
        // idempotency key: if iOS suspended a background write before it
        // flushed, this same response is replayed on next open and the store
        // upserts the same row — so the log is never lost or duplicated.
        const key = `notif_${response.notification.request.identifier}_${actionId}`;
        try {
          await createBreathLog(state, key);
          await presentLogConfirmation(state);
          showToast(`Logged · ${STATE_META[state].label}`);
        } catch {
          showToast("Could not log from reminder", "error");
        }
      } else if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // The notification itself was tapped — land on the Log screen.
        router.navigate("/(tabs)/log");
      }

      // Any interaction arms the next reminder in the chain.
      const cfg = await getReminderConfig();
      if (cfg?.reminder_enabled) await scheduleNextReminder(cfg).catch(() => {});
    };

    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);

    // Re-arm the chain whenever the app becomes active (covers ignored/swiped
    // reminders and app restarts).
    const appSub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      getReminderConfig().then((cfg) => {
        if (cfg?.reminder_enabled) ensureReminderArmed(cfg).catch(() => {});
      });
    });

    return () => {
      sub.remove();
      appSub.remove();
    };
  }, [showToast]);
}
