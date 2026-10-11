import { z } from "zod";
export const goalVersionSchema = z.object({
  effectiveDate: z.iso.date(),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }),
  goalMode: z.enum(["reduce", "quit", "track"]),
  dailyLimit: z.number().int().min(0).max(100),
  baseline: z.number().int().min(0).max(100),
  weeklyReduction: z.number().min(0).max(100),
  quitAt: z
    .string()
    .refine((value) => !value || Number.isFinite(Date.parse(value))),
});
export type GoalVersion = z.infer<typeof goalVersionSchema>;
export const goalHistorySchema = z
  .array(goalVersionSchema)
  .max(1000)
  .refine(
    (rows) =>
      rows.every(
        (row, i) => !i || row.effectiveDate > rows[i - 1].effectiveDate,
      ),
    "Goal history must have unique dates in chronological order.",
  );
export function goalOnDate(history: GoalVersion[], date: string) {
  return [...history].reverse().find((goal) => goal.effectiveDate <= date);
}
