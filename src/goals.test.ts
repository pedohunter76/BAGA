import { beforeEach, expect, it } from "vitest";
import { defaults, longestStreak, streak } from "./domain";
import {
  currentGoal,
  goalHistorySchema,
  goalOnDate,
  withGoalHistory,
} from "./goals";
import { db, eraseData, savePreferences } from "./db";
import { parseBackup, restoreBackup } from "./backup";
beforeEach(eraseData);
const p = { ...defaults, onboarded: true, adult: true };
const first = withGoalHistory(p, undefined, new Date("2026-10-09T00:00:00Z"));
it("keeps prior goals and updates only the effective day's version", () => {
  const changed = withGoalHistory(
    { ...first, dailyLimit: 2 },
    first,
    new Date("2026-10-11T00:00:00Z"),
  );
  expect(goalOnDate(changed.goalHistory!, "2026-10-10")?.dailyLimit).toBe(10);
  expect(goalOnDate(changed.goalHistory!, "2026-10-11")?.dailyLimit).toBe(2);
  expect(goalOnDate(changed.goalHistory!, "2026-10-08")).toBeUndefined();
  const sameDay = withGoalHistory(
    { ...changed, dailyLimit: 3 },
    changed,
    new Date("2026-10-11T03:00:00Z"),
  );
  expect(sameDay.goalHistory).toHaveLength(2);
  expect(sameDay.goalHistory?.[0]).toEqual(first.goalHistory?.[0]);
});
it("uses the daily goal and its saved timezone for streaks and recalculates backdated logs", () => {
  const goal = currentGoal(p, new Date("2026-10-09T00:00:00Z"));
  const history = [
    goal,
    { ...goal, effectiveDate: "2026-10-11", dailyLimit: 0 },
  ];
  const checks = ["2026-10-09", "2026-10-10", "2026-10-11"].map((date) => ({
    date,
    completedAt: `${date}T12:00:00Z`,
    confirmedCount: 0,
  }));
  const log = {
    id: "one",
    variantId: "red",
    brand: "Test",
    variant: "Red",
    quantity: 5,
    smokedAt: "2026-10-09T17:00:00Z",
    priceSnapshot: 12,
    trigger: "None",
    mood: "",
    location: "",
    notes: "",
    revision: 1,
    updatedAt: "2026-10-09T17:00:00Z",
    deletedAt: null,
  };
  expect(
    streak([log], checks, "2026-10-11", "UTC", history, "withinLimit"),
  ).toBe(3);
  expect(longestStreak([log], checks, "UTC", history, "withinLimit")).toBe(3);
  expect(
    streak(
      [{ ...log, smokedAt: "2026-10-11T02:00:00Z" }],
      checks,
      "2026-10-11",
      "UTC",
      history,
      "withinLimit",
    ),
  ).toBe(0);
  expect(streak([], checks, "2026-10-11", "UTC", [], "withinLimit")).toBe(0);
  expect(
    streak(
      [],
      checks,
      "2026-10-11",
      "UTC",
      [{ ...goal, goalMode: "track" }],
      "withinLimit",
    ),
  ).toBe(0);
});
it("does not let an old tab rewrite the durable goal history", async () => {
  await savePreferences(p);
  const before = await db.preferences.get("local");
  await savePreferences({ ...before!, dailyLimit: 4 });
  await savePreferences({ ...p, name: "Other tab", dailyLimit: 4 });
  expect(
    (await db.preferences.get("local"))?.goalHistory?.at(-1)?.dailyLimit,
  ).toBe(4);
});
it("round-trips history while keeping legacy backups honest", async () => {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    preferences: first,
    logs: [],
    checkins: [],
    measurements: [],
    customVariants: [],
    cravings: [],
  };
  await restoreBackup(parseBackup(JSON.stringify(backup)), "replace");
  expect((await db.preferences.get("local"))?.goalHistory).toEqual(
    first.goalHistory,
  );
  await restoreBackup(
    parseBackup(JSON.stringify({ ...backup, preferences: p })),
    "replace",
  );
  expect((await db.preferences.get("local"))?.goalHistory).toBeUndefined();
});
it("rejects unordered, duplicate, and invalid goal histories", () => {
  const goal = first.goalHistory![0];
  expect(goalHistorySchema.safeParse([goal, goal]).success).toBe(false);
  expect(
    goalHistorySchema.safeParse([{ ...goal, timezone: "invalid" }]).success,
  ).toBe(false);
});
it("keeps earlier dates unchanged when a timezone moves the current date backward", () => {
  const manila = withGoalHistory(
    p,
    undefined,
    new Date("2026-10-11T17:00:00Z"),
  );
  const utc = withGoalHistory(
    { ...manila, timezone: "UTC" },
    manila,
    new Date("2026-10-11T17:00:00Z"),
  );
  expect(utc.timezone).toBe("UTC");
  expect(utc.goalHistory?.[0].effectiveDate).toBe("2026-10-12");
  expect(goalOnDate(utc.goalHistory!, "2026-10-11")).toBeUndefined();
});
it("rejects a goal edit from a tab with an outdated goal version", async () => {
  await savePreferences(p);
  const stale = (await db.preferences.get("local"))!;
  await savePreferences({ ...stale, dailyLimit: 4 });
  await expect(savePreferences({ ...stale, dailyLimit: 8 })).rejects.toThrow(
    "another tab",
  );
  expect((await db.preferences.get("local"))?.dailyLimit).toBe(4);
});
