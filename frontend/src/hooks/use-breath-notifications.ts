// Turns a tapped Left/Right/Both reminder-notification button into a logged
// entry. Mounted once near the app root (inside the toast provider). Handles
// both live taps and the tap that cold-launched the app. Native only.
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useToast } from "@/src/components/Toast";
import { createBreathLog } from "@/src/lib/breathLog";
import { actionToState, configureNotifications } from "@/src/lib/notifications";
import { STATE_META } from "@/src/theme/theme";

export function useBreathNotifications() {
  const { showToast } = useToast();
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS === "web") return;

    configureNotifications().catch(() => {});

    const handle = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const state = actionToState(response.actionIdentifier);
      if (!state) return;
      // De-dupe: the cold-launch response can also arrive via the listener.
      const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handledRef.current.has(key)) return;
      handledRef.current.add(key);
      try {
        await createBreathLog(state);
        showToast(`Logged · ${STATE_META[state].label}`);
      } catch {
        showToast("Could not log from reminder", "error");
      }
    };

    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [showToast]);
}
