// Bridges reminder notifications to the app. A tapped Left/Right/Both button
// logs the entry (and shows a confirmation in the notification bar); tapping
// the notification body opens the app on the Log screen. Either interaction
// arms the next reminder (the chained model). Also re-arms when the app comes
// to the foreground, so an ignored/swiped reminder doesn't end the chain.
// Native only.
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
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
import { importWidgetLogs } from "@/src/lib/widgetBridge";
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
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS === "web") return;

    configureNotifications().catch(() => {});

    const handle = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const actionId = response.actionIdentifier;
      const state = actionToState(actionId);

      if (state) {
        // Quick-log button.
        const key = `${response.notification.request.identifier}:${actionId}`;
        if (handledRef.current.has(key)) return;
        handledRef.current.add(key);
        try {
          await createBreathLog(state);
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

    // On foreground: import any logs made on the widget, then re-arm the chain
    // (covers ignored/swiped reminders and app restarts).
    const onActive = () => {
      importWidgetLogs().catch(() => {});
      getReminderConfig().then((cfg) => {
        if (cfg?.reminder_enabled) ensureReminderArmed(cfg).catch(() => {});
      });
    };
    onActive();
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") onActive();
    });

    return () => {
      sub.remove();
      appSub.remove();
    };
  }, [showToast]);
}
