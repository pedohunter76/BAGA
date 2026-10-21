import { financeSchema } from "./finance";
import { budgetSchema } from "./budget";
import { z } from "zod";
import { db } from "./db";
import { recordSchemas, snapshot } from "./records";
import { cloudKinds } from "./sync-types";

export const backupSchema = z.object({
  version: z.literal(1),
  budget: budgetSchema.optional(),
  finances: z.array(financeSchema).max(50000).optional(),
  exportedAt: z.iso.datetime(),
  preferences: recordSchemas.preferences,
  logs: z.array(recordSchemas.logs).max(50000),
  checkins: z.array(recordSchemas.checkins).max(50000),
  measurements: z.array(recordSchemas.measurements).max(50000),
  customVariants: z.array(recordSchemas.variants).max(1000),
  cravings: z.array(recordSchemas.cravings).max(50000),
});
export type Backup = z.infer<typeof backupSchema>;
export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).length > 10 * 1024 * 1024)
    throw new Error("Choose a BAGA JSON backup smaller than 10 MB.");
  let parsed: Backup;
  try {
    parsed = backupSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(
      "This is not a valid BAGA version 1 JSON backup. No data was changed.",
    );
  }
  for (const kind of cloudKinds.filter((kind) => kind !== "preferences")) {
    const rows = kind === "variants" ? parsed.customVariants : parsed[kind];
    const ids = rows.map((row) => ("date" in row ? row.date : row.id));
    if (new Set(ids).size !== ids.length)
      throw new Error(
        "The backup contains duplicate record IDs. No data was changed.",
      );
  }
  const financeIds = (parsed.finances ?? []).map((row) => row.id);
  if (new Set(financeIds).size !== financeIds.length)
    throw new Error(
      "The backup contains duplicate financial transaction IDs. No data was changed.",
    );
  return parsed;
}
export async function restoreBackup(backup: Backup, mode: "merge" | "replace") {
  const valid = parseBackup(JSON.stringify(backup));
  await db.transaction(
    "rw",
    [
      db.logs,
      db.finances,
      db.preferences,
      db.deviceState,
      db.checkins,
      db.measurements,
      db.variants,
      db.cravings,
    ],
    async () => {
      for (const kind of cloudKinds) {
        const table = db.table(kind);
        if (mode === "replace") await table.clear();
        const rows =
          kind === "preferences"
            ? [valid.preferences]
            : kind === "variants"
              ? valid.customVariants
              : valid[kind];
        for (const row of rows) {
          const key = "date" in row ? row.date : row.id;
          const existing = await table.get(key);
          if (existing) {
            if (kind === "preferences" || snapshot(existing) === snapshot(row))
              continue;
            throw new Error(
              "A record in this backup differs from a record on this device. Nothing was imported. Review your backup or explicitly choose Replace local diary.",
            );
          }
          await table.put(row);
        }
      }
      if (mode === "replace") await db.finances.clear();
      for (const row of valid.finances ?? []) {
        const existing = await db.finances.get(row.id);
        if (existing && snapshot(existing) !== snapshot(row))
          throw new Error(
            "A financial transaction differs from this backup. Nothing was imported. Review the backup or choose Replace.",
          );
        await db.finances.put(row);
      }
      if (mode === "replace") await db.deviceState.delete("budget");
      if (
        valid.budget &&
        (mode === "replace" || !(await db.deviceState.get("budget")))
      )
        await db.deviceState.put({ id: "budget", data: valid.budget });
      if ((await db.preferences.get("local"))?.onboarded)
        await db.deviceState.delete("onboarding");
    },
  );
}
