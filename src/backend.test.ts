import { defaults } from "./domain";
import { currentGoal } from "./goals";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const pg = new PGlite();
const alice = "10000000-0000-4000-8000-000000000001",
  bob = "20000000-0000-4000-8000-000000000002";
const operation = (overrides: Record<string, unknown> = {}) => ({
  operation_id: crypto.randomUUID(),
  key: "cravings:first",
  kind: "cravings",
  record_id: "first",
  payload: {
    id: "first",
    at: "2025-01-01T00:00:00Z",
    intensity: 3,
    trigger: "Stress",
    notes: "",
  },
  expected_revision: 0,
  ...overrides,
});
async function asUser(user: string) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await pg.exec("set role authenticated");
}
async function push(op: unknown) {
  return (
    await pg.query<{ result: unknown }>(
      "select public.baga_sync_batch($1::jsonb) as result",
      [JSON.stringify([op])],
    )
  ).rows[0].result as any[];
}
beforeAll(async () => {
  await pg.exec(
    "create schema auth;create table auth.users(id uuid primary key);create role authenticated;create role anon;create role service_role bypassrls;grant usage on schema public to service_role;grant usage on schema public,auth to authenticated,anon;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  );
  await pg.exec(
    readFileSync(
      new URL("../supabase/migrations/001_private_sync.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.exec(
    readFileSync(
      new URL("../supabase/migrations/002_push_reminders.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.exec(
    readFileSync(
      new URL("../supabase/migrations/003_goal_history.sql", import.meta.url),
      "utf8",
    ),
  );
}, 20000);
beforeEach(async () => {
  await pg.exec("reset role;delete from auth.users");
  await pg.query("insert into auth.users values ($1),($2)", [alice, bob]);
  await asUser(alice);
});
afterAll(() => pg.close());
describe("actual PostgreSQL cloud authorization and retries", () => {
  it("isolates reads and rejects direct writes across accounts", async () => {
    await push(operation());
    await asUser(bob);
    expect(
      (await pg.query("select * from public.baga_records")).rows,
    ).toHaveLength(0);
    await expect(pg.exec("delete from public.baga_records")).rejects.toThrow(
      "permission denied",
    );
    await asUser(alice);
    expect(
      (await pg.query("select * from public.baga_records")).rows,
    ).toHaveLength(1);
  });
  it("replays idempotency receipts and rejects reuse for another payload", async () => {
    const op = operation();
    expect(await push(op)).toEqual(await push(op));
    expect(
      (
        await pg.query<{ revision: number }>(
          "select revision from public.baga_records",
        )
      ).rows[0].revision,
    ).toBe(1);
    await expect(
      push({ ...op, payload: { ...op.payload, notes: "different" } }),
    ).rejects.toThrow("idempotency_key_reused");
  });
  it("returns conflicts instead of overwriting an outdated revision", async () => {
    await push(operation());
    const result = await push(
      operation({
        payload: {
          id: "first",
          at: "2025-01-01T00:00:00Z",
          intensity: 4,
          trigger: "Coffee",
          notes: "",
        },
      }),
    );
    expect(result[0].status).toBe("conflict");
    expect(result[0].row.payload.intensity).toBe(3);
  });
  it("validates payloads on the server and atomically rejects an invalid batch", async () => {
    const good = operation();
    const bad = operation({
      key: "cravings:bad",
      record_id: "bad",
      payload: {
        id: "bad",
        at: "not-a-date",
        intensity: 999,
        trigger: "Stress",
        notes: "",
      },
    });
    await expect(
      pg.query("select public.baga_sync_batch($1::jsonb)", [
        JSON.stringify([good, bad]),
      ]),
    ).rejects.toThrow("invalid_payload");
    expect(
      (await pg.query("select * from public.baga_records")).rows,
    ).toHaveLength(0);
  });
  it("accepts deletion tombstones without resurrecting old writes", async () => {
    await push(operation());
    expect(
      (await push(operation({ payload: null, expected_revision: 1 })))[0].row
        .payload,
    ).toBeNull();
    expect((await push(operation()))[0].status).toBe("conflict");
  });
  it("deletes only the signed-in account and cascades sensitive records and receipts", async () => {
    await push(operation());
    await asUser(bob);
    await push(operation());
    await asUser(alice);
    await pg.exec("select public.baga_delete_account()");
    await pg.exec("reset role");
    expect((await pg.query("select id from auth.users")).rows).toEqual([
      { id: bob },
    ]);
    expect(
      (await pg.query("select user_id from public.baga_records")).rows,
    ).toEqual([{ user_id: bob }]);
    expect(
      (await pg.query("select user_id from public.baga_sync_receipts")).rows,
    ).toEqual([{ user_id: bob }]);
  });
  it("refuses unauthenticated use of privileged operations", async () => {
    await pg.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false);set role anon",
    );
    await expect(push(operation())).rejects.toThrow("permission denied");
    await expect(
      pg.exec("select public.baga_delete_account()"),
    ).rejects.toThrow("permission denied");
  });
});

it("does not let authenticated users claim scheduled deliveries", async () => {
  await expect(pg.exec("select public.baga_claim_reminders()")).rejects.toThrow(
    "permission denied",
  );
});
it("leases due reminders only once and ignores future reminders", async () => {
  await pg.exec("reset role");
  await pg.query(
    "insert into public.baga_push_subscriptions(user_id,endpoint,subscription,category,timezone,reminder_time,quiet_start,quiet_end,next_at) values ($1,'https://fcm.googleapis.com/a','{}','daily','Asia/Manila','20:00','22:00','08:00',now()-interval '1 minute'),($1,'https://fcm.googleapis.com/b','{}','daily','Asia/Manila','20:00','22:00','08:00',now()+interval '1 day')",
    [alice],
  );
  await pg.exec("set role service_role");
  expect(
    (await pg.query("select * from public.baga_claim_reminders()")).rows,
  ).toHaveLength(1);
  expect(
    (await pg.query("select * from public.baga_claim_reminders()")).rows,
  ).toHaveLength(0);
});
it("requires complete measurement and preference payloads on the server", async () => {
  await expect(
    push(
      operation({
        key: "measurements:first",
        kind: "measurements",
        payload: {
          id: "first",
          type: null,
          value: 4,
          reference: 5,
          unit: "L",
          source: "Report",
          measuredAt: "2025-01-01T00:00:00Z",
        },
      }),
    ),
  ).rejects.toThrow("invalid_payload");
  await expect(
    push(
      operation({
        key: "preferences:local",
        kind: "preferences",
        record_id: "local",
        payload: { id: "local", timezone: "Asia/Manila" },
      }),
    ),
  ).rejects.toThrow("invalid_payload");
});

it("accepts the complete preference schema and isolates account fields", async () => {
  const { defaults } = await import("./domain");
  const result = await push(
    operation({
      key: "preferences:local",
      kind: "preferences",
      record_id: "local",
      payload: defaults,
    }),
  );
  expect(result[0].status).toBe("applied");
  await expect(
    push(operation({ payload: { ...operation().payload, user_id: bob } })),
  ).rejects.toThrow("invalid_payload");
});
it("limits new-operation bursts while keeping acknowledged retries available", async () => {
  const op = operation();
  const acknowledged = await push(op);
  await pg.exec("reset role");
  await pg.query(
    "insert into public.baga_sync_receipts(user_id,operation_id,request,result) select $1,gen_random_uuid(),'{}'::jsonb,'{}'::jsonb from generate_series(1,2000)",
    [alice],
  );
  await asUser(alice);
  expect(await push(op)).toEqual(acknowledged);
  await expect(
    push(
      operation({
        key: "cravings:new",
        record_id: "new",
        payload: { ...op.payload, id: "new" },
      }),
    ),
  ).rejects.toThrow("rate_limit_exceeded");
});

it("accepts versioned goals, rejects unknown or invalid history, and retains legacy payload support", async () => {
  const goal = currentGoal(defaults, new Date("2026-10-11T12:00:00Z"));
  const valid = { ...defaults, goalHistory: [goal] };
  const check = async (payload: unknown) =>
    (
      await pg.query<{ valid: boolean }>(
        "select public.baga_valid_payload('preferences','local',$1::jsonb) as valid",
        [JSON.stringify(payload)],
      )
    ).rows[0].valid;
  expect(await check(defaults)).toBe(true);
  expect(await check(valid)).toBe(true);
  expect(await check({ ...valid, goalHistory: [goal, goal] })).toBe(false);
  expect(
    await check({ ...valid, goalHistory: [{ ...goal, dailyLimit: 101 }] }),
  ).toBe(false);
  expect(
    await check({ ...valid, goalHistory: [{ ...goal, timezone: "invalid" }] }),
  ).toBe(false);
  expect(
    await check({ ...valid, goalHistory: [{ ...goal, secret: "bad" }] }),
  ).toBe(false);
});
