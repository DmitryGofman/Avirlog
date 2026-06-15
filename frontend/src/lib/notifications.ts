// Local reminder notifications with Left / Right / Both action buttons.
// Native only — every call is a no-op on web (which can't schedule reliable
// repeating local notifications anyway). The response handler that turns a
// tapped button into a logged entry lives in hooks/use-breath-notifications.ts.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { NostrilState } from "@/src/theme/theme";

export const BREATH_CATEGORY = "breath-log";
const CHANNEL_ID = "reminders";

const ACTION_TO_STATE: Record<string, NostrilState> = {
  "log-left": "left",
  "log-right": "right",
  "log-both": "both",
};

export function actionToState(actionId: string): NostrilState | null {
  return ACTION_TO_STATE[actionId] ?? null;
}

let configured = false;

// Register the foreground presentation behaviour, the Left/Right/Both action
// category, and (Android) a notification channel. Safe to call repeatedly.
export async function configureNotifications(): Promise<void> {
  if (Platform.OS === "web") return;

  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    configured = true;
  }

  await Notifications.setNotificationCategoryAsync(BREATH_CATEGORY, [
    { identifier: "log-left", buttonTitle: "Left", options: { opensAppToForeground: false } },
    { identifier: "log-right", buttonTitle: "Right", options: { opensAppToForeground: false } },
    { identifier: "log-both", buttonTitle: "Both", options: { opensAppToForeground: false } },
  ]);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Breath reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === "granted") return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted || next.status === "granted";
}

// Replace any existing reminder with a single repeating one at the given
// interval (minimum 1 minute, per OS constraints).
export async function scheduleReminders(intervalMinutes: number): Promise<void> {
  if (Platform.OS === "web") return;
  await configureNotifications();
  await cancelReminders();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Breath check",
      body: "Which nostril is active right now?",
      categoryIdentifier: BREATH_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, Math.round(intervalMinutes * 60)),
      repeats: true,
      channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
    },
  });
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
