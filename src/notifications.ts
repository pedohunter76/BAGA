import { z } from "zod";
import { db } from "./db";
import {
  dayKey,
  localDateTime,
  type Preferences,
  type Checkin,
  type CigaretteLog,
} from "./domain";
import { inQuietHours } from "./notification-schedule";
import { milestones } from "./progress";
export const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  daily: z.boolean(),
  weekly: z.boolean(),
  milestones: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  system: z.boolean(),
  baseline: z.array(z.string()).max(20),
});
export type NotificationSettingsValue = z.infer<
  typeof notificationSettingsSchema
>;
export const defaultNotificationSettings: NotificationSettingsValue = {
  enabled: false,
  daily: true,
  weekly: false,
  milestones: true,
  time: "20:00",
  quietStart: "22:00",
  quietEnd: "08:00",
  system: false,
  baseline: [],
};
export interface AppNotification {
  id: string;
  category: "daily" | "weekly" | "milestone" | "test";
  createdAt: string;
  readAt: string | null;
  title: string;
  body: string;
  view: "home" | "goals" | "insights";
}
export async function readNotificationSettings() {
  const row = await db.deviceState.get("notifications");
  const result = notificationSettingsSchema.safeParse(row?.data);
  return result.success ? result.data : defaultNotificationSettings;
}
export async function saveNotificationSettings(
  value: NotificationSettingsValue,
) {
  const valid = notificationSettingsSchema.parse(value);
  if (
    valid.enabled &&
    (valid.daily || valid.weekly) &&
    inQuietHours(valid.time, valid.quietStart, valid.quietEnd)
  )
    throw new Error("Choose a delivery time outside your quiet hours.");
  await db.deviceState.put({ id: "notifications", data: valid });
}
export function dueNotifications(
  settings: NotificationSettingsValue,
  p: Preferences,
  logs: CigaretteLog[],
  checkins: Checkin[],
  now: Date,
): AppNotification[] {
  if (!settings.enabled || !p.onboarded) return [];
  const date = dayKey(now, p.timezone);
  const time = localDateTime(now.toISOString(), p.timezone).slice(-5);
  if (inQuietHours(time, settings.quietStart, settings.quietEnd)) return [];
  const make = (
    id: string,
    category: AppNotification["category"],
    view: AppNotification["view"],
  ): AppNotification => ({
    id,
    category,
    view,
    createdAt: now.toISOString(),
    readAt: null,
    title: "A moment for yourself",
    body: "Your private space is ready whenever you are.",
  });
  const minutes = (value: string) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const elapsed = minutes(time) - minutes(settings.time);
  const result: AppNotification[] = [];
  if (elapsed >= 0 && elapsed < 60) {
    if (settings.daily && !checkins.some((row) => row.date === date))
      result.push(make(`daily:${date}`, "daily", "home"));
    if (settings.weekly && new Date(`${date}T12:00:00Z`).getUTCDay() === 0)
      result.push(make(`weekly:${date}`, "weekly", "insights"));
  }
  if (settings.milestones)
    for (const milestone of milestones(logs, checkins, p, date))
      if (milestone.unlocked && !settings.baseline.includes(milestone.id))
        result.push(make(`milestone:${milestone.id}`, "milestone", "goals"));
  return result;
}
// Persist a receipt before delivering; a lost system alert is preferable to repeated nudges.
export async function claimNotification(row: AppNotification) {
  return db.transaction("rw", db.notifications, async () => {
    if (await db.notifications.get(row.id)) return false;
    await db.notifications.add(row);
    return true;
  });
}
export async function showSystemAlert(row: AppNotification) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return false;
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration?.active) return false;
  await registration.showNotification(row.title, {
    body: row.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `baga-${row.category}`,
    data: { view: row.view },
  });
  return true;
}
