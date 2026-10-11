import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "./context";
import {
  claimNotification,
  dueNotifications,
  readNotificationSettings,
  showSystemAlert,
} from "./notifications";
export function NotificationManager() {
  const { preferences, logs, checkins, now, toast } = useApp();
  const settings = useLiveQuery(readNotificationSettings, []);
  useEffect(() => {
    if (!settings) return;
    let active = true;
    void (async () => {
      try {
        const rows = dueNotifications(
          settings,
          preferences,
          logs,
          checkins,
          now,
        );
        for (const row of rows) {
          if (!active) break;
          if (await claimNotification(row)) {
            toast(
              "A moment for yourself. There’s a new notification in your inbox.",
            );
            if (settings.system)
              try {
                await showSystemAlert(row);
              } catch {
                /* The inbox is the durable fallback. */
              }
          }
        }
      } catch {
        if (active)
          toast(
            "Notifications could not be saved on this device. Check browser storage.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [settings, preferences, logs, checkins, now, toast]);
  return null;
}
