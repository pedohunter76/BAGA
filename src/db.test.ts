import { beforeEach, describe, expect, it } from "vitest";
import {
  db,
  eraseData,
  saveLog,
  savePreferences,
  setDeleted,
  saveMeasurement,
  readState,
} from "./db";
import { defaults } from "./domain";
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
beforeEach(async () => {
  await eraseData();
});
describe("durable local records", () => {
  it("recovers invalid saved settings without deleting diary records", async () => {
    const log = await saveLog(input);
    await db.preferences.put({ ...defaults, timezone: "invalid-zone" });
    const state = await readState();
    expect(state.preferencesRecoveryNeeded).toBe(true);
    expect(state.preferences.timezone).toBe(defaults.timezone);
    expect(state.logs).toEqual([log]);
    expect((await db.preferences.get("local"))?.timezone).toBe("invalid-zone");
  });
  it("assigns distinct UUIDs to simultaneous records", async () => {
    const [a, b] = await Promise.all([saveLog(input), saveLog(input)]);
    expect(a.id).not.toBe(b.id);
    expect(await db.logs.count()).toBe(2);
  });
  it("persists before reporting success and survives a database reopen", async () => {
    const log = await saveLog(input);
    db.close();
    await db.open();
    expect(await db.logs.get(log.id)).toEqual(log);
  });
  it("keeps past prices intact after preferences change", async () => {
    const log = await saveLog(input);
    await savePreferences({ ...defaults, price: 24 });
    expect((await db.logs.get(log.id))?.priceSnapshot).toBe(12);
  });
  it("uses deletion markers and revisions for delete and undo", async () => {
    const log = await saveLog(input);
    await setDeleted(log.id, true);
    expect(await db.logs.get(log.id)).toMatchObject({ revision: 2 });
    expect((await db.logs.get(log.id))?.deletedAt).toBeTruthy();
    await setDeleted(log.id, false);
    expect(await db.logs.get(log.id)).toMatchObject({
      revision: 3,
      deletedAt: null,
    });
  });
  it("rejects stale edits instead of overwriting another tab", async () => {
    const log = await saveLog(input);
    await saveLog({ ...input, quantity: 2 }, log);
    await expect(saveLog({ ...input, quantity: 3 }, log)).rejects.toThrow(
      "another tab",
    );
    expect((await db.logs.get(log.id))?.quantity).toBe(2);
  });
  it("never resurrects a deleted record through an edit", async () => {
    const log = await saveLog(input);
    await setDeleted(log.id, true);
    await expect(saveLog(input, log)).rejects.toThrow("removed");
  });
  it("keeps illustration preferences separate from measured values", async () => {
    await saveMeasurement({
      type: "FVC",
      value: 4.3,
      reference: 5,
      unit: "L",
      source: "Test report",
      measuredAt: "2025-01-01T00:00:00Z",
    });
    await savePreferences({ ...defaults, intensity: 95 });
    expect((await readState()).measurements[0]).toMatchObject({
      value: 4.3,
      unit: "L",
      source: "Test report",
    });
  });
  it("clears every sensitive local table", async () => {
    await saveLog(input);
    await savePreferences(defaults);
    await db.checkins.put({
      date: "2025-01-01",
      confirmedCount: 1,
      completedAt: "2025-01-01T00:00:00Z",
    });
    await db.cravings.put({
      id: "test",
      at: "2025-01-01T00:00:00Z",
      intensity: 1,
      trigger: "Stress",
      notes: "private",
    });
    await eraseData();
    const state = await readState();
    expect(state.logs).toHaveLength(0);
    expect(state.checkins).toHaveLength(0);
    expect(state.cravings).toHaveLength(0);
    expect(state.preferences.onboarded).toBe(false);
  });
});

it("upgrades a version-2 diary without inventing old limits or losing records and reminders", async () => {
  const { default: Dexie } = await import("dexie");
  const { dayKey } = await import("./domain");
  await db.delete();
  const legacy = new Dexie("baga-private-v1");
  legacy.version(1).stores({
    logs: "id, smokedAt, variantId, updatedAt",
    preferences: "id",
    checkins: "date",
    measurements: "id, measuredAt",
    variants: "id",
    cravings: "id, at",
  });
  legacy.version(2).stores({
    cloudMeta: "id",
    syncRecords: "key",
    syncOperations: "key, operationId",
    syncConflicts: "key",
  });
  await legacy.table("preferences").put({
    ...defaults,
    onboarded: true,
    adult: true,
    reminder: true,
    reminderTime: "19:00",
  });
  await legacy.table("logs").put({
    ...input,
    id: "legacy-log",
    revision: 1,
    updatedAt: input.smokedAt,
    deletedAt: null,
  });
  legacy.close();
  await db.open();
  const state = await readState();
  expect(state.logs[0].id).toBe("legacy-log");
  expect(state.preferences.goalHistory).toHaveLength(1);
  expect(state.preferences.goalHistory?.[0].effectiveDate).toBe(
    dayKey(new Date(), defaults.timezone),
  );
  expect((await db.deviceState.get("notifications"))?.data).toMatchObject({
    enabled: true,
    time: "19:00",
    system: false,
  });
});
