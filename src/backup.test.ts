import { beforeEach, expect, it } from "vitest";
import { db, eraseData, readState, saveLog, savePreferences } from "./db";
import { defaults } from "./domain";
import { parseBackup, restoreBackup } from "./backup";
const input = {
  variantId: "marlboro-red",
  brand: "Marlboro",
  variant: "Red",
  quantity: 1,
  smokedAt: "2025-01-01T00:00:00.000Z",
  priceSnapshot: 12,
  trigger: "None",
  mood: "",
  location: "",
  notes: "",
};
async function exported() {
  const { preferencesRecoveryNeeded, ...state } = await readState();
  return parseBackup(
    JSON.stringify({
      ...state,
      version: 1,
      exportedAt: new Date().toISOString(),
    }),
  );
}
beforeEach(eraseData);
it("round-trips a backup, including measurements and historical price snapshots", async () => {
  const log = await saveLog(input);
  await savePreferences({ ...defaults, name: "Alex" });
  await db.cravings.put({
    id: "craving",
    at: "2025-01-01T00:00:00Z",
    intensity: 3,
    trigger: "Stress",
    notes: "private",
  });
  const backup = await exported();
  await eraseData();
  await restoreBackup(backup, "replace");
  expect(await db.logs.get(log.id)).toEqual(log);
  expect((await db.preferences.get("local"))?.name).toBe("Alex");
  expect(await db.cravings.count()).toBe(1);
});
it("merges identical IDs without duplicates or preference overwrites", async () => {
  await saveLog(input);
  const backup = await exported();
  await savePreferences({ ...defaults, name: "Keep me" });
  await restoreBackup(backup, "merge");
  expect(await db.logs.count()).toBe(1);
  expect((await db.preferences.get("local"))?.name).toBe("Keep me");
});
it("rolls back the entire merge when an existing record differs", async () => {
  const original = await saveLog(input);
  const extra = await saveLog({ ...input, quantity: 3 });
  const backup = await exported();
  await db.logs.delete(extra.id);
  await saveLog({ ...input, quantity: 2 }, original);
  await expect(restoreBackup(backup, "merge")).rejects.toThrow(
    "Nothing was imported",
  );
  expect(await db.logs.count()).toBe(1);
  expect((await db.logs.get(original.id))?.quantity).toBe(2);
});
it("rejects invalid JSON and duplicate IDs before changing storage", async () => {
  const log = await saveLog(input);
  const backup = await exported();
  expect(() => parseBackup("{bad")).toThrow("valid");
  expect(() =>
    parseBackup(JSON.stringify({ ...backup, logs: [log, log] })),
  ).toThrow("duplicate");
  expect(await db.logs.count()).toBe(1);
});
