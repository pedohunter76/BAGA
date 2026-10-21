import { beforeEach, expect, it } from "vitest";
import Dexie from "dexie";
import { db, eraseData, readState } from "./db";
import { saveFinance, deleteFinance, undoDeleteFinance } from "./finance-db";
import { restoreBackup, parseBackup } from "./backup";
const input = {
  type: "income" as const,
  amount: 1000,
  category: "Salary",
  description: "Pay",
  date: "2026-10-01",
};
beforeEach(eraseData);
it("persists transactions and prevents stale edits, deletes and undo overwrites", async () => {
  const first = await saveFinance(input);
  const edited = await saveFinance({ ...input, amount: 2000 }, first);
  await expect(saveFinance(input, first)).rejects.toThrow("another tab");
  await expect(deleteFinance(first)).rejects.toThrow("changed");
  await deleteFinance(edited);
  expect(await db.finances.count()).toBe(0);
  await undoDeleteFinance(edited);
  expect((await readState()).finances[0].amount).toBe(2000);
  await expect(undoDeleteFinance(edited)).rejects.toThrow("already exists");
});
it("round-trips finances in backups, validates duplicates, and rolls back conflicts atomically", async () => {
  const first = await saveFinance(input);
  const state = await readState();
  const backup = parseBackup(
    JSON.stringify({
      ...state,
      version: 1,
      exportedAt: new Date().toISOString(),
    }),
  );
  expect(() =>
    parseBackup(JSON.stringify({ ...backup, finances: [first, first] })),
  ).toThrow("duplicate");
  await eraseData();
  await restoreBackup(backup, "replace");
  expect(await db.finances.get(first.id)).toEqual(first);
  const edited = await saveFinance({ ...input, amount: 2000 }, first);
  await expect(restoreBackup(backup, "merge")).rejects.toThrow(
    "Nothing was imported",
  );
  expect((await db.finances.get(first.id))?.amount).toBe(2000);
  await restoreBackup(backup, "replace");
  expect((await db.finances.get(first.id))?.amount).toBe(1000);
  const { finances, ...legacy } = backup;
  await restoreBackup(legacy, "replace");
  expect(await db.finances.count()).toBe(0);
  await saveFinance(input);
  await eraseData();
  expect(await db.finances.count()).toBe(0);
});
it("upgrades version 3 without losing existing budget settings", async () => {
  await db.delete();
  const legacy = new Dexie(db.name);
  legacy.version(3).stores({
    deviceState: "id",
    logs: "id, smokedAt, variantId, updatedAt",
    preferences: "id",
    checkins: "date",
    measurements: "id, measuredAt",
    variants: "id",
    cravings: "id, at",
    cloudMeta: "id",
    syncRecords: "key",
    syncOperations: "key, operationId",
    syncConflicts: "key",
    notifications: "id, createdAt",
  });
  await legacy.open();
  await legacy
    .table("deviceState")
    .put({ id: "budget", data: { monthlyLimit: 500 } });
  legacy.close();
  await db.open();
  expect(db.verno).toBe(4);
  expect((await db.deviceState.get("budget"))?.data).toEqual({
    monthlyLimit: 500,
  });
  expect(await db.finances.count()).toBe(0);
});
