import { expect, it } from "vitest";
import { inQuietHours, nextReminder } from "./notification-schedule";
const schedule = {
  timezone: "Asia/Manila",
  time: "20:00",
  quietStart: "22:00",
  quietEnd: "08:00",
  category: "daily" as const,
};
it("schedules future local reminders across midnight", () => {
  expect(nextReminder(schedule, new Date("2026-10-11T11:00:00Z"))).toBe(
    "2026-10-11T12:00:00.000Z",
  );
  expect(nextReminder(schedule, new Date("2026-10-11T12:00:00Z"))).toBe(
    "2026-10-12T12:00:00.000Z",
  );
});
it("handles quiet hours spanning midnight and equal times disabling quiet hours", () => {
  expect(inQuietHours("23:00", "22:00", "08:00")).toBe(true);
  expect(inQuietHours("07:00", "22:00", "08:00")).toBe(true);
  expect(inQuietHours("08:00", "22:00", "08:00")).toBe(false);
  expect(inQuietHours("20:00", "20:00", "20:00")).toBe(false);
  expect(() =>
    nextReminder({ ...schedule, time: "23:00" }, new Date()),
  ).toThrow("quiet");
});
it("schedules weekly reviews on local Sunday", () => {
  expect(
    nextReminder(
      { ...schedule, category: "weekly" },
      new Date("2026-10-12T00:00:00Z"),
    ),
  ).toBe("2026-10-18T12:00:00.000Z");
});
it("skips nonexistent daylight-saving wall times", () => {
  expect(
    nextReminder(
      {
        ...schedule,
        timezone: "America/New_York",
        time: "02:30",
        quietStart: "00:00",
        quietEnd: "00:00",
      },
      new Date("2026-03-08T05:00:00Z"),
    ),
  ).toBe("2026-03-09T06:30:00.000Z");
});
it("rejects invalid schedule values rather than manufacturing dates", () => {
  expect(() =>
    nextReminder({ ...schedule, time: "25:00" }, new Date()),
  ).toThrow("valid");
  expect(() =>
    nextReminder({ ...schedule, timezone: "fake-zone" }, new Date()),
  ).toThrow();
});
