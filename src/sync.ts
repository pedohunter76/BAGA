import { db } from "./db";
import { snapshot, validatePayload } from "./records";
import {
  cloudKinds,
  type CloudKind,
  type CloudRow,
  type Payload,
  type SyncOperation,
  type SyncTransport,
} from "./sync-types";

const tables = () => [
  db.deviceState,
  ...cloudKinds.map((kind) => db.table(kind)),
  db.syncRecords,
  db.syncOperations,
  db.syncConflicts,
  db.cloudMeta,
];
function validateCloudRow(row: CloudRow) {
  if (
    !cloudKinds.includes(row.kind) ||
    row.key !== `${row.kind}:${row.record_id}` ||
    !Number.isInteger(row.revision) ||
    row.revision < 1
  )
    throw new Error(
      "Cloud response contains an invalid record. Local records were preserved.",
    );
  validatePayload(row.kind, row.record_id, row.payload);
}
export async function localRows(): Promise<
  Map<string, { kind: CloudKind; recordId: string; payload: Payload }>
> {
  const result = new Map<
    string,
    { kind: CloudKind; recordId: string; payload: Payload }
  >();
  for (const kind of cloudKinds) {
    for (const value of await db.table(kind).toArray()) {
      const recordId = kind === "checkins" ? value.date : value.id;
      result.set(`${kind}:${recordId}`, {
        kind,
        recordId,
        payload: validatePayload(kind, recordId, value),
      });
    }
  }
  return result;
}
async function assertOwner(userId: string) {
  const meta = await db.cloudMeta.get("account");
  if (!meta?.enabled || meta.userId !== userId)
    throw new Error(
      "Cloud sync is paused. Link this diary to the same account before syncing.",
    );
}
export async function enableSync(userId: string) {
  await db.transaction("rw", db.cloudMeta, async () => {
    const meta = await db.cloudMeta.get("account");
    if (meta && meta.userId !== userId)
      throw new Error(
        "This device’s diary belongs to another account. Export and clear local data before linking a different account.",
      );
    await db.cloudMeta.put({ ...meta, id: "account", userId, enabled: true });
  });
}
export async function pauseSync() {
  await db.cloudMeta.update("account", { enabled: false });
}
async function applyRow(row: CloudRow) {
  const payload = validatePayload(row.kind, row.record_id, row.payload);
  if (row.key !== `${row.kind}:${row.record_id}`)
    throw new Error("Cloud response contains an invalid record key.");
  if (payload === null) await db.table(row.kind).delete(row.record_id);
  else {
    await db.table(row.kind).put(payload);
    if (row.kind === "preferences" && payload.onboarded)
      await db.deviceState.delete("onboarding");
  }
  await db.syncRecords.put({
    key: row.key,
    revision: row.revision,
    baseline: snapshot(payload),
  });
  await db.syncConflicts.delete(row.key);
}
export async function queueChanges(userId: string): Promise<number> {
  return db.transaction("rw", tables(), async () => {
    await assertOwner(userId);
    const rows = await localRows();
    const records = new Map(
      (await db.syncRecords.toArray()).map((row) => [row.key, row]),
    );
    const conflicts = new Set(
      (await db.syncConflicts.toArray()).map((row) => row.key),
    );
    const keys = new Set([...rows.keys(), ...records.keys()]);
    for (const key of keys) {
      if (conflicts.has(key)) {
        await db.syncOperations.delete(key);
        continue;
      }
      const record = records.get(key);
      const value = rows.get(key);
      const current = snapshot(value?.payload ?? null);
      if (record?.baseline === current) {
        await db.syncOperations.delete(key);
        continue;
      }
      const old = await db.syncOperations.get(key);
      if (
        old?.snapshot === current &&
        old.expectedRevision === (record?.revision || 0)
      )
        continue;
      const separator = key.indexOf(":");
      await db.syncOperations.put({
        key,
        operationId: crypto.randomUUID(),
        kind: (value?.kind || key.slice(0, separator)) as CloudKind,
        recordId: value?.recordId || key.slice(separator + 1),
        payload: value?.payload ?? null,
        expectedRevision: record?.revision || 0,
        snapshot: current,
        retries: 0,
      });
    }
    return db.syncOperations.count();
  });
}
export async function pendingChanges(): Promise<number> {
  const rows = await localRows();
  const records = new Map(
    (await db.syncRecords.toArray()).map((row) => [row.key, row]),
  );
  const conflicts = new Set(
    (await db.syncConflicts.toArray()).map((row) => row.key),
  );
  return [...new Set([...rows.keys(), ...records.keys()])].filter(
    (key) =>
      !conflicts.has(key) &&
      snapshot(rows.get(key)?.payload ?? null) !== records.get(key)?.baseline,
  ).length;
}

// Serialize runs within a tab; Web Locks also serialize participating tabs.
let running: Promise<void> | undefined;
export function syncDiary(
  userId: string,
  transport: SyncTransport,
): Promise<void> {
  if (running) return running;
  const task = () => runSync(userId, transport);
  const pending = (async () => {
    if (typeof navigator !== "undefined" && navigator.locks)
      await navigator.locks.request("baga-cloud-sync", task);
    else await task();
  })().finally(() => {
    running = undefined;
  });
  running = pending;
  return pending;
}
async function runSync(userId: string, transport: SyncTransport) {
  await assertOwner(userId);
  const remote = await transport.pull();
  await db.transaction("rw", tables(), async () => {
    await assertOwner(userId);
    const rows = await localRows();
    for (const row of remote) {
      validateCloudRow(row);
      const known = await db.syncRecords.get(row.key);
      const local = rows.get(row.key)?.payload ?? null;
      const localSnapshot = snapshot(local);
      const remoteSnapshot = snapshot(row.payload);
      const pending = await db.syncOperations.get(row.key);
      if (known && row.revision < known.revision)
        throw new Error(
          "Cloud revision moved backwards. Local records were preserved.",
        );
      // A pending write with the same value must still replay its original key:
      // its previous response may have been lost after the server committed.
      if (
        pending &&
        pending.snapshot === localSnapshot &&
        row.revision !== pending.expectedRevision
      )
        continue;
      if (localSnapshot === remoteSnapshot) {
        await db.syncRecords.put({
          key: row.key,
          revision: row.revision,
          baseline: remoteSnapshot,
        });
        await db.syncOperations.delete(row.key);
        await db.syncConflicts.delete(row.key);
      } else if (
        (known && localSnapshot === known.baseline) ||
        (!known && local === null) ||
        (!known && row.kind === "preferences" && local?.onboarded === false)
      ) {
        await applyRow(row);
      } else if (!known || row.revision !== known.revision) {
        await db.syncConflicts.put({ key: row.key, remote: row, local });
        await db.syncOperations.delete(row.key);
      }
    }
  });
  await queueChanges(userId);
  const operations = await db.syncOperations.toArray();
  for (let i = 0; i < operations.length; i += 50) {
    await assertOwner(userId);
    const batch = operations.slice(i, i + 50);
    let results;
    try {
      results = await transport.push(batch);
    } catch (error) {
      await db.transaction("rw", db.syncOperations, async () => {
        for (const op of batch) {
          const current = await db.syncOperations.get(op.key);
          if (current?.operationId === op.operationId)
            await db.syncOperations.update(op.key, {
              retries: current.retries + 1,
            });
        }
      });
      throw error;
    }
    if (
      results.length !== batch.length ||
      new Set(results.map((r) => r.operation_id)).size !== batch.length
    )
      throw new Error(
        "Cloud acknowledgement was incomplete. Retry to safely resume.",
      );
    await db.transaction("rw", tables(), async () => {
      await assertOwner(userId);
      const currentRows = await localRows();
      for (const result of results) {
        const op = batch.find((op) => op.operationId === result.operation_id);
        if (!op || result.row.key !== op.key)
          throw new Error(
            "Cloud acknowledgement did not match the saved operation.",
          );
        validateCloudRow(result.row);
        if (
          result.status === "applied" &&
          (result.row.revision !== op.expectedRevision + 1 ||
            snapshot(result.row.payload) !== op.snapshot)
        )
          throw new Error(
            "Cloud acknowledgement contained a different record. Local records and the retry were preserved.",
          );
        const current = currentRows.get(op.key)?.payload ?? null;
        if (result.status === "conflict")
          await db.syncConflicts.put({
            key: op.key,
            remote: result.row,
            local: current,
          });
        else
          await db.syncRecords.put({
            key: op.key,
            revision: result.row.revision,
            baseline: snapshot(result.row.payload),
          });
        const queued = await db.syncOperations.get(op.key);
        if (queued?.operationId === op.operationId)
          await db.syncOperations.delete(op.key);
      }
    });
  }
  await queueChanges(userId); // Edits made while a request was in flight stay queued.
  await assertOwner(userId);
  await db.cloudMeta.update("account", { lastSync: new Date().toISOString() });
}
export async function resolveConflict(
  key: string,
  choice: "local" | "cloud",
  userId: string,
  reviewed?: { localSnapshot: string; remoteRevision: number },
) {
  await db.transaction("rw", tables(), async () => {
    await assertOwner(userId);
    const conflict = await db.syncConflicts.get(key);
    if (!conflict) return;
    const current = (await localRows()).get(key)?.payload ?? null;
    if (
      reviewed &&
      (snapshot(current) !== reviewed.localSnapshot ||
        conflict.remote.revision !== reviewed.remoteRevision)
    )
      throw new Error(
        "This record changed while you were reviewing it. Close and reopen the review to choose its latest version.",
      );
    if (choice === "cloud") await applyRow(conflict.remote);
    else {
      await db.syncRecords.put({
        key,
        revision: conflict.remote.revision,
        baseline: snapshot(conflict.remote.payload),
      });
      await db.syncConflicts.delete(key);
    }
    await db.syncOperations.delete(key);
  });
  await queueChanges(userId);
}
