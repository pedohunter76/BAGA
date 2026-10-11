import { describe, expect, it } from "vitest";
import {
  dayKey,
  fromLocalDateTime,
  localDateTime,
  defaults,
  dayTotals,
  streak,
  logInputSchema,
  measurementSchema,
  preferencesSchema,
  perStick,
} from "./domain";
import type { CigaretteLog, Checkin } from "./domain";

const row = (date: string, quantity = 1, price = 12): CigaretteLog => ({
  id: date,
  variantId: "marlboro-red",
  brand: "Marlboro",
  variant: "Red",
  quantity,
  smokedAt: `${date}T04:00:00Z`,
  priceSnapshot: price,
  trigger: "None",
  mood: "",
  location: "",
  notes: "",
  revision: 1,
  updatedAt: `${date}T04:00:00Z`,
  deletedAt: null,
});
const check = (date: string): Checkin => ({
  date,
  confirmedCount: 0,
  completedAt: `${date}T14:00:00Z`,
});
describe("timezone-aware diary", () => {
  it("groups a timestamp on the correct side of midnight", () => {
    expect(dayKey("2026-10-10T16:01:00Z", "Asia/Manila")).toBe("2026-10-11");
    expect(dayKey("2026-10-10T16:01:00Z", "UTC")).toBe("2026-10-10");
    expect(dayKey("2026-01-01T01:00:00Z", "America/Los_Angeles")).toBe(
      "2025-12-31",
    );
  });
  it("roundtrips local backdated times and rejects nonexistent DST times", () => {
    expect(fromLocalDateTime("2026-10-11T00:01", "Asia/Manila")).toBe(
      "2026-10-10T16:01:00.000Z",
    );
    const iso = fromLocalDateTime("2026-01-03T20:30", "America/New_York");
    expect(localDateTime(iso, "America/New_York")).toBe("2026-01-03T20:30");
    expect(() =>
      fromLocalDateTime("2026-03-08T02:30", "America/New_York"),
    ).toThrow("does not exist");
  });
  it("uses quantities and original price snapshots, excluding tombstones", () => {
    const removed = {
      ...row("2025-01-01", 50, 100),
      deletedAt: "2025-01-01T16:00:00Z",
    };
    expect(
      dayTotals(
        [row("2025-01-01", 2, 12), row("2025-01-01", 1, 8), removed],
        "2025-01-01",
        "Asia/Manila",
      ),
    ).toMatchObject({ count: 3, spent: 32 });
    expect(
      perStick({ ...defaults, price: 160, packSize: 20, priceUnit: "pack" }),
    ).toBe(8);
  });
});
describe("honest streaks", () => {
  it("never treats missing days as smoke-free", () => {
    expect(streak([], [], "2025-01-04", "Asia/Manila", 10, "smokeFree")).toBe(
      0,
    );
    expect(
      streak(
        [],
        [check("2025-01-01"), check("2025-01-03")],
        "2025-01-04",
        "Asia/Manila",
        10,
        "smokeFree",
      ),
    ).toBe(1);
  });
  it("counts zero-cigarette check-ins for engagement and abstinence", () => {
    const checks = ["2025-01-01", "2025-01-02", "2025-01-03"].map(check);
    expect(streak([], checks, "2025-01-03", "Asia/Manila", 10, "logging")).toBe(
      3,
    );
    expect(
      streak([], checks, "2025-01-03", "Asia/Manila", 10, "smokeFree"),
    ).toBe(3);
  });
  it("recalculates after a backdated cigarette, independently of logging streaks", () => {
    const checks = ["2025-01-01", "2025-01-02", "2025-01-03"].map(check);
    expect(
      streak(
        [row("2025-01-02")],
        checks,
        "2025-01-03",
        "Asia/Manila",
        10,
        "smokeFree",
      ),
    ).toBe(1);
    expect(
      streak(
        [row("2025-01-02", 11)],
        checks,
        "2025-01-03",
        "Asia/Manila",
        10,
        "withinLimit",
      ),
    ).toBe(1);
    expect(
      streak(
        [row("2025-01-02", 11)],
        checks,
        "2025-01-03",
        "Asia/Manila",
        10,
        "logging",
      ),
    ).toBe(3);
  });
  it("does not count an unfinished current day", () => {
    expect(
      streak(
        [],
        [check("2025-01-02")],
        "2025-01-03",
        "Asia/Manila",
        10,
        "withinLimit",
      ),
    ).toBe(1);
  });
});
describe("input validation", () => {
  it("rejects invalid counts, prices, and future records", () => {
    expect(logInputSchema.safeParse(row("2025-01-01", 0)).success).toBe(false);
    expect(logInputSchema.safeParse(row("2025-01-01", 1, -1)).success).toBe(
      false,
    );
    expect(
      logInputSchema.safeParse({
        ...row("2025-01-01"),
        smokedAt: new Date(Date.now() + 86400000).toISOString(),
      }).success,
    ).toBe(false);
  });
  it("rejects wrong units and missing or implausible medical values", () => {
    const input = {
      type: "FVC",
      value: 4.3,
      reference: 5,
      unit: "L",
      source: "Manual entry",
      measuredAt: "2025-01-01T00:00:00Z",
    };
    expect(measurementSchema.safeParse(input).success).toBe(true);
    for (const overrides of [
      { value: 0 },
      { value: 4300 },
      { reference: 0 },
      { unit: "mL" },
      { source: "" },
    ])
      expect(
        measurementSchema.safeParse({ ...input, ...overrides }).success,
      ).toBe(false);
  });
  it("rejects unknown timezones and zero-sized packs", () => {
    expect(
      preferencesSchema.safeParse({ ...defaults, timezone: "not-a-timezone" })
        .success,
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({ ...defaults, packSize: 0 }).success,
    ).toBe(false);
  });
});
