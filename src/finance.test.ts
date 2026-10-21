import { expect, it } from "vitest";
import {
  financeSchema,
  financeSummary,
  ledgerEntries,
  financeCSV,
  type FinanceTransaction,
} from "./finance";
import type { CigaretteLog } from "./domain";
const now = new Date("2026-10-10T12:00:00Z");
const entry = (
  id: string,
  type: "income" | "expense",
  amount: number,
  date = "2026-10-10",
  category = "Food & groceries",
): FinanceTransaction => ({
  id,
  type,
  amount,
  date,
  category,
  description: id,
  updatedAt: now.toISOString(),
});
it("tracks all income and expenses with an opening balance and cash-aware allowance", () => {
  const summary = financeSummary(
    [
      entry("salary", "income", 1000, "2026-10-01", "Salary"),
      entry("rent", "expense", 300, "2026-10-01", "Housing"),
      entry("food", "expense", 100),
      entry("old", "expense", 50, "2026-09-01"),
      entry("future", "income", 9999, "2026-10-11"),
    ],
    {
      monthlyLimit: 800,
      openingBalance: 200,
      savingsTarget: 100,
      categoryLimits: { Housing: 250 },
    },
    "2026-10",
    now,
    "UTC",
  );
  expect(summary.income).toBe(1000);
  expect(summary.expenses).toBe(400);
  expect(summary.net).toBe(600);
  expect(summary.balance).toBe(750);
  expect(summary.remaining).toBe(400);
  expect(summary.spendable).toBe(400);
  expect(summary.dailyAvailable).toBe(18.18);
  expect(
    summary.categories.find((row) => row.category === "Housing"),
  ).toMatchObject({ spent: 300, limit: 250 });
  expect(summary.savingsProgress).toBe(100);
});
it("never allocates unreceived money or a negative balance", () => {
  const negative = financeSummary(
    [entry("food", "expense", 100)],
    { monthlyLimit: 5000 },
    "2026-10",
    now,
    "UTC",
  );
  expect(negative.balance).toBe(-100);
  expect(negative.dailyAvailable).toBe(0);
  const cashLimited = financeSummary(
    [entry("salary", "income", 100)],
    { monthlyLimit: 5000, savingsTarget: 50 },
    "2026-10",
    now,
    "UTC",
  );
  expect(cashLimited.spendable).toBe(50);
  expect(cashLimited.dailyAvailable).toBe(2.27);
});
it("uses actual totals for past months and carries balances forward", () => {
  const rows = [
    entry("salary", "income", 1000, "2024-02-01"),
    entry("food", "expense", 100, "2024-02-29"),
    entry("march", "expense", 10, "2024-03-01"),
  ];
  const feb = financeSummary(
    rows,
    { monthlyLimit: 500, openingBalance: 20 },
    "2024-02",
    now,
    "UTC",
  );
  expect(feb.projected).toBe(100);
  expect(feb.balance).toBe(920);
  expect(feb.dailyAvailable).toBe(0);
  const march = financeSummary(rows, null, "2024-03", now, "UTC");
  expect(march.balance).toBe(890);
  expect(march.net).toBe(-10);
});
it("integrates cigarette consumption exactly once or lets purchases replace it", () => {
  const log = {
    id: "log",
    quantity: 2,
    priceSnapshot: 12,
    smokedAt: "2026-09-30T18:00:00Z",
    brand: "Brand",
    variant: "Variant",
    deletedAt: null,
    updatedAt: now.toISOString(),
  } as CigaretteLog;
  const rows = ledgerEntries(
    [entry("food", "expense", 2)],
    [log, { ...log, id: "deleted", deletedAt: now.toISOString() }],
    "Asia/Manila",
  );
  expect(rows).toHaveLength(2);
  expect(rows[1]).toMatchObject({
    id: "cigarette:log",
    amount: 24,
    date: "2026-10-01",
    automatic: true,
  });
  expect(ledgerEntries([], [log], "UTC", false)).toHaveLength(0);
});
it("rejects invalid money and dates, and escapes spreadsheet formulas", () => {
  expect(financeSchema.safeParse(entry("ok", "expense", 0.1)).success).toBe(
    true,
  );
  for (const amount of [0, -1, NaN, Infinity, 1.001])
    expect(
      financeSchema.safeParse(entry("bad", "income", amount)).success,
    ).toBe(false);
  expect(
    financeSchema.safeParse({
      ...entry("bad", "expense", 1),
      date: "2026-02-30",
    }).success,
  ).toBe(false);
  const csv = financeCSV([
    {
      ...entry("=SUM(A1)", "expense", 2),
      category: 'a,"b',
      description: ' =HYPERLINK("bad")',
    },
  ]);
  expect(csv).toContain('"\' =HYPERLINK(""bad"")"');
  expect(csv).toContain('"a,""b"');
});
