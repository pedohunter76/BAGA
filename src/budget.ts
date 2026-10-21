import { z } from "zod";
import { dayKey, type CigaretteLog } from "./domain";

export const budgetSchema = z.object({
  monthlyLimit: z.number().finite().min(0).max(10000000),
  openingBalance: z.number().finite().min(-10000000).max(10000000).optional(),
  savingsTarget: z.number().finite().min(0).max(10000000).optional(),
  includeCigarettes: z.boolean().optional(),
  categoryLimits: z
    .record(
      z.string().trim().min(1).max(60),
      z.number().finite().min(0).max(10000000),
    )
    .refine(
      (value) => Object.keys(value).length <= 100,
      "Use at most 100 category budgets.",
    )
    .optional(),
});
export type BudgetSettings = z.infer<typeof budgetSchema>;
const cents = (value: number) => Math.round(value * 100);

// Calendar arithmetic uses the profile timezone, not the browser's timezone.
export function budgetSummary(
  logs: CigaretteLog[],
  now: Date,
  timezone: string,
  limit: number,
) {
  const today = dayKey(now, timezone);
  const month = today.slice(0, 7);
  const [year, monthNumber, day] = today.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const rows = logs.filter(
    (row) =>
      !row.deletedAt &&
      Date.parse(row.smokedAt) <= now.getTime() &&
      dayKey(row.smokedAt, timezone).startsWith(month),
  );
  const totalCents = rows.reduce(
    (sum, row) => sum + cents(row.quantity * row.priceSnapshot),
    0,
  );
  const todayCents = rows
    .filter((row) => dayKey(row.smokedAt, timezone) === today)
    .reduce((sum, row) => sum + cents(row.quantity * row.priceSnapshot), 0);
  const remainingCents = cents(limit) - totalCents;
  const futureDays = days - day;
  // Today's allowance includes what has already been spent today.
  const dailyCents = Math.floor(
    Math.max(0, remainingCents + todayCents) / (futureDays + 1),
  );
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const date = dayKey(row.smokedAt, timezone);
    byDay.set(
      date,
      (byDay.get(date) ?? 0) + cents(row.quantity * row.priceSnapshot),
    );
  }
  return {
    month,
    days,
    day,
    spent: totalCents / 100,
    todaySpent: todayCents / 100,
    remaining: remainingCents / 100,
    dailyAllowance: dailyCents / 100,
    todayAvailable:
      Math.max(0, Math.min(remainingCents, dailyCents - todayCents)) / 100,
    projected: Math.round((totalCents / day) * days) / 100,
    usage:
      limit > 0
        ? Math.min(100, (totalCents / cents(limit)) * 100)
        : totalCents > 0
          ? 100
          : 0,
    unpriced: rows.filter((row) => row.priceSnapshot === 0).length,
    transactions: rows.length,
    daily: [...byDay]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, amount]) => ({ date, amount: amount / 100 })),
  };
}
