import { beforeEach, describe, expect, it } from "vitest";
import { db, eraseData, saveLog, savePreferences, setDeleted } from "./db";
import { defaults } from "./domain";
import {
  enableSync,
  pauseSync,
  pendingChanges,
  resolveConflict,
  syncDiary,
} from "./sync";
import type {
  CloudRow,
  SyncOperation,
  SyncResult,
  SyncTransport,
} from "./sync-types";
const user = "10000000-0000-4000-8000-000000000001";
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
class Server implements SyncTransport {
  rows = new Map<string, CloudRow>();
  receipts = new Map<string, SyncResult>();
  loss = false;
  async pull() {
    return structuredClone([...this.rows.values()]);
  }
  async push(operations: SyncOperation[]) {
    const results = operations.map((op) => {
      const receipt = this.receipts.get(op.operationId);
      if (receipt) return structuredClone(receipt);
      const old = this.rows.get(op.key);
      const row: CloudRow =
        old && old.revision !== op.expectedRevision
          ? old
          : {
              key: op.key,
              kind: op.kind,
              record_id: op.recordId,
              payload: structuredClone(op.payload),
              revision: (old?.revision || 0) + 1,
            };
      const result: SyncResult = {
        operation_id: op.operationId,
        status:
          old && old.revision !== op.expectedRevision ? "conflict" : "applied",
        row: structuredClone(row),
      };
      this.rows.set(op.key, row);
      this.receipts.set(op.operationId, result);
      return result;
    });
    if (this.loss) {
      this.loss = false;
      throw new Error("Connection lost after commit");
    }
    return results;
  }
}
beforeEach(async () => {
  await eraseData();
  await enableSync(user);
});
describe("offline-first cloud reconciliation", () => {
  it("keeps simultaneous logs distinct and synchronizes only once", async () => {
    const a = await saveLog(input),
      b = await saveLog(input);
    const server = new Server();
    await syncDiary(user, server);
    await syncDiary(user, server);
    expect(server.rows.size).toBe(2);
    expect(server.rows.get(`logs:${a.id}`)?.revision).toBe(1);
    expect(server.rows.has(`logs:${b.id}`)).toBe(true);
    expect(await pendingChanges()).toBe(0);
  });
  it("replays the persisted operation ID after losing the response", async () => {
    const row = await saveLog(input);
    const server = new Server();
    server.loss = true;
    await expect(syncDiary(user, server)).rejects.toThrow("lost");
    const queued = await db.syncOperations.get(`logs:${row.id}`);
    expect(queued?.retries).toBe(1);
    db.close();
    await db.open();
    await syncDiary(user, server);
    expect(server.receipts.size).toBe(1);
    expect(server.rows.get(`logs:${row.id}`)?.revision).toBe(1);
    expect(await db.syncOperations.count()).toBe(0);
  });
  it("preserves a new edit made while an upload is in flight", async () => {
    const log = await saveLog(input);
    const server = new Server();
    const push = server.push.bind(server);
    server.push = async (operations) => {
      await saveLog({ ...input, quantity: 2 }, log);
      return push(operations);
    };
    await syncDiary(user, server);
    expect((await db.logs.get(log.id))?.quantity).toBe(2);
    expect(await pendingChanges()).toBe(1);
    server.push = push;
    await syncDiary(user, server);
    expect(server.rows.get(`logs:${log.id}`)?.payload?.quantity).toBe(2);
  });
  it("propagates deletion markers and undo without losing historical prices", async () => {
    const log = await saveLog(input);
    const server = new Server();
    await syncDiary(user, server);
    await setDeleted(log.id, true);
    await syncDiary(user, server);
    expect(server.rows.get(`logs:${log.id}`)?.payload?.deletedAt).toBeTruthy();
    await setDeleted(log.id, false);
    await syncDiary(user, server);
    expect(server.rows.get(`logs:${log.id}`)?.payload).toMatchObject({
      priceSnapshot: 12,
      deletedAt: null,
      revision: 3,
    });
  });
  it("creates tombstones for deleted non-log records", async () => {
    await db.cravings.put({
      id: "craving",
      at: "2025-01-01T00:00:00Z",
      intensity: 3,
      trigger: "Stress",
      notes: "",
    });
    const server = new Server();
    await syncDiary(user, server);
    await db.cravings.delete("craving");
    await syncDiary(user, server);
    expect(server.rows.get("cravings:craving")?.payload).toBeNull();
    expect(await pendingChanges()).toBe(0);
  });
  it("keeps concurrent edits for explicit review and can keep the local version", async () => {
    const log = await saveLog(input);
    const key = `logs:${log.id}`,
      server = new Server();
    await syncDiary(user, server);
    await saveLog({ ...input, quantity: 2 }, log);
    const old = server.rows.get(key)!;
    server.rows.set(key, {
      ...old,
      revision: 2,
      payload: { ...old.payload, quantity: 3 },
    });
    await syncDiary(user, server);
    expect((await db.logs.get(log.id))?.quantity).toBe(2);
    expect((await db.syncConflicts.get(key))?.remote.payload?.quantity).toBe(3);
    await resolveConflict(key, "local", user);
    await syncDiary(user, server);
    expect(server.rows.get(key)?.payload?.quantity).toBe(2);
    expect(server.rows.get(key)?.revision).toBe(3);
  });
  it("accepts a cloud deletion only after conflict review when local edits exist", async () => {
    const log = await saveLog(input);
    const key = `logs:${log.id}`,
      server = new Server();
    await syncDiary(user, server);
    await saveLog({ ...input, notes: "local change" }, log);
    server.rows.set(key, {
      ...server.rows.get(key)!,
      payload: null,
      revision: 2,
    });
    await syncDiary(user, server);
    expect(await db.logs.get(log.id)).toBeTruthy();
    await resolveConflict(key, "cloud", user);
    expect(await db.logs.get(log.id)).toBeUndefined();
    expect(await pendingChanges()).toBe(0);
  });
  it("applies remote changes when the device copy has not changed", async () => {
    const log = await saveLog(input);
    const key = `logs:${log.id}`,
      server = new Server();
    await syncDiary(user, server);
    server.rows.set(key, {
      ...server.rows.get(key)!,
      revision: 2,
      payload: { ...server.rows.get(key)!.payload, notes: "another device" },
    });
    await syncDiary(user, server);
    expect((await db.logs.get(log.id))?.notes).toBe("another device");
    expect(await db.syncConflicts.count()).toBe(0);
  });
  it("prevents uploading an existing diary into a different account", async () => {
    await pauseSync();
    await expect(
      enableSync("20000000-0000-4000-8000-000000000002"),
    ).rejects.toThrow("another account");
    await expect(syncDiary(user, new Server())).rejects.toThrow("paused");
  });
  it("preserves the durable queue if sync is paused during the request", async () => {
    await saveLog(input);
    const server = new Server();
    const push = server.push.bind(server);
    server.push = async (operations) => {
      const results = await push(operations);
      await pauseSync();
      return results;
    };
    await expect(syncDiary(user, server)).rejects.toThrow("paused");
    expect(await db.syncOperations.count()).toBe(1);
    expect(await db.logs.count()).toBe(1);
  });
  it("rejects invalid cloud content without partially importing a snapshot", async () => {
    const server = new Server();
    server.rows.set("preferences:local", {
      key: "preferences:local",
      kind: "preferences",
      record_id: "local",
      revision: 1,
      payload: { ...defaults, timezone: "invalid" },
    });
    await expect(syncDiary(user, server)).rejects.toThrow();
    expect(await db.preferences.count()).toBe(0);
  });
  it("restores remote preferences into a fresh unconfigured diary", async () => {
    await savePreferences(defaults);
    const server = new Server();
    server.rows.set("preferences:local", {
      key: "preferences:local",
      kind: "preferences",
      record_id: "local",
      revision: 1,
      payload: { ...defaults, name: "Alex", adult: true, onboarded: true },
    });
    await syncDiary(user, server);
    expect((await db.preferences.get("local"))?.name).toBe("Alex");
  });
});

it("requires a fresh review if a conflict changes while the dialog is open", async () => {
  const log = await saveLog(input),
    server = new Server(),
    key = `logs:${log.id}`;
  await syncDiary(user, server);
  const edited = await saveLog({ ...input, quantity: 2 }, log);
  const remote = server.rows.get(key)!;
  server.rows.set(key, {
    ...remote,
    revision: 2,
    payload: { ...remote.payload, quantity: 3 },
  });
  await syncDiary(user, server);
  const conflict = (await db.syncConflicts.get(key))!;
  const { snapshot } = await import("./records");
  await saveLog({ ...input, quantity: 4 }, edited);
  await expect(
    resolveConflict(key, "cloud", user, {
      localSnapshot: snapshot(conflict.local),
      remoteRevision: conflict.remote.revision,
    }),
  ).rejects.toThrow("changed while");
  expect((await db.logs.get(log.id))?.quantity).toBe(4);
  expect(await db.syncConflicts.count()).toBe(1);
});

it("syncs goal history and reviews divergent goal versions without losing either choice", async () => {
  const { currentGoal } = await import("./goals");
  const preferences = {
    ...defaults,
    onboarded: true,
    adult: true,
    goalHistory: [currentGoal(defaults)],
  };
  await db.preferences.put(preferences);
  const server = new Server();
  await syncDiary(user, server);
  expect(server.rows.get("preferences:local")?.payload?.goalHistory).toEqual(
    preferences.goalHistory,
  );
  const row = server.rows.get("preferences:local")!;
  await savePreferences({ ...preferences, dailyLimit: 4 });
  server.rows.set(row.key, {
    ...row,
    revision: row.revision + 1,
    payload: {
      ...row.payload,
      dailyLimit: 8,
      goalHistory: [{ ...preferences.goalHistory[0], dailyLimit: 8 }],
    },
  });
  await syncDiary(user, server);
  const conflict = (await db.syncConflicts.get(row.key))!;
  expect(conflict.local?.dailyLimit).toBe(4);
  expect(conflict.remote.payload?.dailyLimit).toBe(8);
  expect((await db.preferences.get("local"))?.dailyLimit).toBe(4);
});
