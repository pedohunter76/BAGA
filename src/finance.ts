import { z } from "zod";
import { dayKey, type CigaretteLog } from "./domain";
import type { BudgetSettings } from "./budget";

export const expenseCategories = [
  "Food & groceries",
  "Housing",
  "Transport",
  "Utilities",
  "Health",
  "Shopping",
  "Entertainment",
  "Education",
  "Cigarettes",
  "Other",
];
export const incomeCategories = [
  "Salary",
  "Freelance",
  "Business",
  "Gifts",
  "Other income",
];
export const currencyAmount = z
  .number()
  .finite()
  .min(0)
  .max(10000000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
    "Use at most two decimal places.",
  );
export const financeSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(["income", "expense"]),
  amount: currencyAmount.refine(
    (value) => value > 0,
    "Enter an amount greater than zero.",
  ),
  category: z.string().trim().min(1).max(60),
  date: z.iso
    .date()
    .refine(
      (value) => value >= "1900-01-01" && value <= "2199-12-31",
      "Choose a date between 1900 and 2199.",
    ),
  description: z.string().trim().max(200),
  updatedAt: z.iso.datetime(),
});
export type FinanceTransaction = z.infer<typeof financeSchema>;
export type LedgerEntry = FinanceTransaction & { automatic?: boolean };
export const toCents = (value: number) => Math.round(value * 100);
export function ledgerEntries(
  manual: FinanceTransaction[],
  logs: CigaretteLog[],
  timezone: string,
  automatic = true,
): LedgerEntry[] {
  return [
    ...manual,
    ...(automatic
      ? logs
          .filter((row) => !row.deletedAt)
          .map((row): LedgerEntry => ({
            id: `cigarette:${row.id}`,
            type: "expense",
            amount: toCents(row.quantity * row.priceSnapshot) / 100,
            category: "Cigarettes",
            date: dayKey(row.smokedAt, timezone),
            description: `${row.quantity} × ${row.brand} ${row.variant}`,
            updatedAt: row.updatedAt,
            automatic: true,
          }))
      : []),
  ];
}
export function financeSummary(
  entries: LedgerEntry[],
  settings: BudgetSettings | null,
  month: string,
  now: Date,
  timezone: string,
) {
  const today = dayKey(now, timezone);
  const currentMonth = today.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const elapsed =
    month === currentMonth
      ? Number(today.slice(8))
      : month < currentMonth
        ? days
        : 0;
  const through = month < currentMonth ? `${month}-${days}` : today;
  const posted = entries.filter((entry) => entry.date <= today);
  const selected = posted.filter((entry) => entry.date.startsWith(month));
  const sum = (rows: LedgerEntry[], type: "income" | "expense") =>
    rows
      .filter((row) => row.type === type)
      .reduce((total, row) => total + toCents(row.amount), 0);
  const income = sum(selected, "income");
  const expenses = sum(selected, "expense");
  const balanceRows = posted.filter((entry) => entry.date <= through);
  const balance =
    toCents(settings?.openingBalance ?? 0) +
    sum(balanceRows, "income") -
    sum(balanceRows, "expense");
  const remaining = toCents(settings?.monthlyLimit ?? 0) - expenses;
  const todayExpenses = sum(
    selected.filter((entry) => entry.date === today),
    "expense",
  );
  // Never allocate money that has not been recorded as income. Keep the savings target aside.
  const cashAvailable = Math.max(
    0,
    balance - toCents(settings?.savingsTarget ?? 0),
  );
  const spendable = settings
    ? Math.max(0, Math.min(remaining, cashAvailable))
    : cashAvailable;
  const dailyAvailable =
    month === currentMonth ? Math.floor(spendable / (days - elapsed + 1)) : 0;
  const categoryTotals = new Map<string, number>();
  for (const row of selected) {
    if (row.type === "expense")
      categoryTotals.set(
        row.category,
        (categoryTotals.get(row.category) ?? 0) + toCents(row.amount),
      );
  }
  const categories = [
    ...new Set([
      ...categoryTotals.keys(),
      ...Object.keys(settings?.categoryLimits ?? {}),
    ]),
  ]
    .map((category) => {
      const spent = categoryTotals.get(category) ?? 0;
      return {
        category,
        spent: spent / 100,
        limit:
          settings?.categoryLimits &&
          Object.hasOwn(settings.categoryLimits, category)
            ? settings.categoryLimits[category]
            : undefined,
        share: expenses ? (spent / expenses) * 100 : 0,
      };
    })
    .sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category));
  return {
    income: income / 100,
    expenses: expenses / 100,
    net: (income - expenses) / 100,
    balance: balance / 100,
    remaining: remaining / 100,
    spendable: spendable / 100,
    todayExpenses: todayExpenses / 100,
    dailyAvailable: dailyAvailable / 100,
    projected: elapsed ? Math.round((expenses / elapsed) * days) / 100 : 0,
    savingsProgress: settings?.savingsTarget
      ? Math.min(
          100,
          (Math.max(0, income - expenses) / toCents(settings.savingsTarget)) *
            100,
        )
      : 0,
    usage: settings?.monthlyLimit
      ? Math.min(100, (expenses / toCents(settings.monthlyLimit)) * 100)
      : expenses
        ? 100
        : 0,
    categories,
    entries: selected,
    current: month === currentMonth,
  };
}
export function financeCSV(rows: LedgerEntry[]) {
  // Quoting alone does not stop spreadsheet formulas in user-entered text.
  const cell = (value: unknown) => {
    let text = String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    "Date,Type,Category,Description,Amount (PHP),Source",
    ...rows.map((row) =>
      [
        row.date,
        row.type,
        row.category,
        row.description,
        row.amount.toFixed(2),
        row.automatic ? "Cigarette record" : "Manual",
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
