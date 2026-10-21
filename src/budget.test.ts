import { expect, it } from "vitest";
import { budgetSchema, budgetSummary } from "./budget";
import type { CigaretteLog } from "./domain";
const row = (
  date: string,
  quantity = 1,
  price = 10,
  deletedAt: string | null = null,
) =>
  ({
    smokedAt: date,
    quantity,
    priceSnapshot: price,
    deletedAt,
  }) as CigaretteLog;
it("uses price snapshots, excludes deleted, future and other-month spending", () => {
  const data = budgetSummary(
    [
      row("2026-10-10T00:00:00Z", 2, 12),
      row("2026-10-09T00:00:00Z", 1, 5),
      row("2026-10-09T00:00:00Z", 1, 20, "2026-10-10T00:00:00Z"),
      row("2026-09-30T00:00:00Z"),
      row("2026-10-11T00:00:00Z"),
    ],
    new Date("2026-10-10T12:00:00Z"),
    "UTC",
    100,
  );
  expect(data.spent).toBe(29);
  expect(data.remaining).toBe(71);
  expect(data.dailyAllowance).toBe(4.31);
  expect(data.todayAvailable).toBe(0);
  expect(data.projected).toBe(89.9);
});
it("handles leap months, timezone boundaries, zero and exceeded limits", () => {
  const rows = [row("2024-02-29T18:00:00Z", 2, 10)];
  const feb = budgetSummary(rows, new Date("2024-02-29T20:00:00Z"), "UTC", 10);
  expect(feb.days).toBe(29);
  expect(feb.remaining).toBe(-10);
  expect(feb.todayAvailable).toBe(0);
  expect(feb.usage).toBe(100);
  const march = budgetSummary(
    rows,
    new Date("2024-02-29T20:00:00Z"),
    "Asia/Manila",
    0,
  );
  expect(march.month).toBe("2024-03");
  expect(march.spent).toBe(20);
  expect(march.todayAvailable).toBe(0);
});
it("rounds monetary totals and rejects invalid limits", () => {
  expect(
    budgetSummary(
      [row("2026-10-01T00:00:00Z", 3, 0.1)],
      new Date("2026-10-02T00:00:00Z"),
      "UTC",
      1,
    ).spent,
  ).toBe(0.3);
  expect(budgetSchema.safeParse({ monthlyLimit: -1 }).success).toBe(false);
  expect(budgetSchema.safeParse({ monthlyLimit: Infinity }).success).toBe(
    false,
  );
});
