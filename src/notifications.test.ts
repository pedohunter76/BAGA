import { beforeEach, expect, it } from "vitest";
import { defaults } from "./domain";
import { db, eraseData } from "./db";
import {
  claimNotification,
  defaultNotificationSettings,
  dueNotifications,
  readNotificationSettings,
  saveNotificationSettings,
} from "./notifications";
beforeEach(eraseData);
const p = { ...defaults, onboarded: true, adult: true, timezone: "UTC" };
const settings = {
  ...defaultNotificationSettings,
  enabled: true,
  weekly: true,
  milestones: false,
};
const now = new Date("2026-10-11T20:15:00Z");
it("requires opt-in, respects quiet hours, skips stale reminders and completed check-ins", () => {
  expect(dueNotifications(defaultNotificationSettings, p, [], [], now)).toEqual(
    [],
  );
  expect(
    dueNotifications(settings, p, [], [], now).map((row) => row.category),
  ).toEqual(["daily", "weekly"]);
  expect(
    dueNotifications({ ...settings, quietStart: "19:00" }, p, [], [], now),
  ).toEqual([]);
  expect(
    dueNotifications(settings, p, [], [], new Date("2026-10-11T21:01:00Z")),
  ).toEqual([]);
  expect(
    dueNotifications(
      settings,
      p,
      [],
      [
        {
          date: "2026-10-11",
          completedAt: now.toISOString(),
          confirmedCount: 0,
        },
      ],
      now,
    ).map((row) => row.category),
  ).toEqual(["weekly"]);
});
it("uses local Sunday and cannot expose health or identity data in the payload", () => {
  const rows = dueNotifications(
    { ...settings, time: "00:15", quietStart: "00:00", quietEnd: "00:00" },
    { ...p, timezone: "Asia/Manila", name: "Private Name" },
    [],
    [],
    new Date("2026-10-10T16:30:00Z"),
  );
  expect(rows.map((row) => row.category)).toEqual(["daily", "weekly"]);
  expect(JSON.stringify(rows)).not.toContain("Private Name");
});
it("suppresses old milestones on enable and claims notifications once across tabs", async () => {
  const check = {
    date: "2026-10-11",
    completedAt: now.toISOString(),
    confirmedCount: 0,
  };
  const opted = { ...settings, daily: false, weekly: false, milestones: true };
  const rows = dueNotifications(opted, p, [], [check], now);
  expect(rows[0].id).toBe("milestone:first");
  expect(
    dueNotifications({ ...opted, baseline: ["first"] }, p, [], [check], now),
  ).toEqual([]);
  expect(
    (
      await Promise.all([
        claimNotification(rows[0]),
        claimNotification(rows[0]),
      ])
    ).filter(Boolean),
  ).toHaveLength(1);
  await db.notifications.update(rows[0].id, { readAt: now.toISOString() });
  expect(await claimNotification(rows[0])).toBe(false);
});
it("persists local-only preferences and rejects invalid schedules", async () => {
  await saveNotificationSettings(settings);
  expect(await readNotificationSettings()).toEqual(settings);
  await expect(
    saveNotificationSettings({ ...settings, time: "23:00" }),
  ).rejects.toThrow("quiet hours");
  await expect(
    saveNotificationSettings({ ...settings, time: "invalid" }),
  ).rejects.toThrow();
});
