import { budgetSchema } from "./budget";
import { clearDiagnostics } from "./diagnostics";
import { withGoalHistory } from "./goals";
import Dexie, { type EntityTable } from "dexie";
import {
  defaults,
  logInputSchema,
  measurementSchema,
  preferencesSchema,
} from "./domain";
import type {
  CigaretteLog,
  Preferences,
  Checkin,
  Measurement,
  Variant,
  Craving,
} from "./domain";
import type {
  CloudMeta,
  SyncRecord,
  SyncOperation,
  SyncConflict,
} from "./sync-types";

export const db = new Dexie("baga-private-v1") as Dexie & {
  deviceState: EntityTable<{ id: string; data: unknown }, "id">;
  notifications: EntityTable<import("./notifications").AppNotification, "id">;
  finances: EntityTable<import("./finance").FinanceTransaction, "id">;
  logs: EntityTable<CigaretteLog, "id">;
  preferences: EntityTable<Preferences, "id">;
  checkins: EntityTable<Checkin, "date">;
  measurements: EntityTable<Measurement, "id">;
  variants: EntityTable<Variant, "id">;
  cravings: EntityTable<Craving, "id">;
  cloudMeta: EntityTable<CloudMeta, "id">;
  syncRecords: EntityTable<SyncRecord, "key">;
  syncOperations: EntityTable<SyncOperation, "key">;
  syncConflicts: EntityTable<SyncConflict, "key">;
};
db.version(1).stores({
  logs: "id, smokedAt, variantId, updatedAt",
  preferences: "id",
  checkins: "date",
  measurements: "id, measuredAt",
  variants: "id",
  cravings: "id, at",
});
db.version(2).stores({
  cloudMeta: "id",
  syncRecords: "key",
  syncOperations: "key, operationId",
  syncConflicts: "key",
});

db.version(3)
  .stores({ deviceState: "id", notifications: "id, createdAt" })
  .upgrade(async (tx) => {
    const p = await tx.table("preferences").get("local");
    if (p?.reminder)
      await tx.table("deviceState").put({
        id: "notifications",
        data: {
          enabled: true,
          daily: true,
          weekly: false,
          milestones: false,
          time: p.reminderTime,
          quietStart: "00:00",
          quietEnd: "00:00",
          system: false,
          baseline: [],
        },
      });
    const validated = preferencesSchema.safeParse(p);
    if (
      validated.success &&
      validated.data.onboarded &&
      !validated.data.goalHistory
    )
      await tx.table("preferences").put(withGoalHistory(validated.data));
  });

db.version(4).stores({ finances: "id, date, type, category" });

export async function savePreferences(p: Preferences) {
  return db.transaction("rw", db.preferences, db.deviceState, async () => {
    const previous = await db.preferences.get("local");
    if (
      p.goalHistory &&
      previous?.goalHistory &&
      JSON.stringify(p.goalHistory) !== JSON.stringify(previous.goalHistory)
    )
      throw new Error(
        "Your goal changed in another tab. Reopen this page before saving.",
      );
    const valid = preferencesSchema.parse(
      withGoalHistory(preferencesSchema.parse(p), previous),
    );
    await db.preferences.put(valid);
    if (valid.onboarded) await db.deviceState.delete("onboarding");
    return valid;
  });
}
export async function saveLog(
  input: Omit<CigaretteLog, "id" | "revision" | "updatedAt" | "deletedAt">,
  existing?: CigaretteLog,
) {
  const valid = logInputSchema.parse(input);
  return db.transaction("rw", db.logs, async () => {
    const current = existing ? await db.logs.get(existing.id) : undefined;
    if (existing && (!current || current.deletedAt))
      throw new Error("This record was removed. Reopen the history.");
    if (existing && current!.revision !== existing.revision)
      throw new Error("This record changed in another tab. Reopen it to edit.");
    const row: CigaretteLog = {
      ...valid,
      id: current?.id || crypto.randomUUID(),
      revision: (current?.revision || 0) + 1,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    await db.logs.put(row);
    return row;
  });
}
export async function setDeleted(id: string, deleted: boolean) {
  await db.transaction("rw", db.logs, async () => {
    const current = await db.logs.get(id);
    if (!current) throw new Error("This record is no longer available.");
    await db.logs.put({
      ...current,
      deletedAt: deleted ? new Date().toISOString() : null,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  });
}
export async function saveMeasurement(input: Omit<Measurement, "id">) {
  const value = measurementSchema.parse(input);
  await db.measurements.add({ ...value, id: crypto.randomUUID() });
}
export async function readState() {
  const [
    preferences,
    logs,
    checkins,
    measurements,
    customVariants,
    cravings,
    budget,
    finances,
  ] = await Promise.all([
    db.preferences.get("local"),
    db.logs.toArray(),
    db.checkins.toArray(),
    db.measurements.toArray(),
    db.variants.toArray(),
    db.cravings.toArray(),
    db.deviceState.get("budget"),
    db.finances.toArray(),
  ]);
  const validated = preferencesSchema.safeParse({
    ...defaults,
    ...preferences,
  });
  return {
    preferences: validated.success
      ? { ...validated.data, goalHistory: validated.data.goalHistory ?? [] }
      : defaults,
    budget: budgetSchema.safeParse(budget?.data).success
      ? budgetSchema.parse(budget?.data)
      : undefined,
    finances,
    preferencesRecoveryNeeded: !validated.success,
    logs,
    checkins,
    measurements,
    customVariants,
    cravings,
  };
}
export async function eraseData() {
  await db.transaction(
    "rw",
    [
      db.deviceState,
      db.notifications,
      db.finances,
      db.logs,
      db.preferences,
      db.checkins,
      db.measurements,
      db.variants,
      db.cravings,
      db.cloudMeta,
      db.syncRecords,
      db.syncOperations,
      db.syncConflicts,
    ],
    async () => {
      await Promise.all([
        db.deviceState.clear(),
        db.notifications.clear(),
        db.finances.clear(),
        db.logs.clear(),
        db.preferences.clear(),
        db.checkins.clear(),
        db.measurements.clear(),
        db.variants.clear(),
        db.cravings.clear(),
        db.cloudMeta.clear(),
        db.syncRecords.clear(),
        db.syncOperations.clear(),
        db.syncConflicts.clear(),
      ]);
    },
  );
  clearDiagnostics();
}
