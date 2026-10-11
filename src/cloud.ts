import { z } from "zod";
import {
  cloudKinds,
  type SyncOperation,
  type SyncTransport,
} from "./sync-types";

const project = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "") || "";
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
function isPublicKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(
        atob(key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
      ).role === "anon"
    );
  } catch {
    return false;
  }
}
export const cloudConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(project) &&
  isPublicKey(publicKey);
const sessionSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.number(),
  user: z.object({ id: z.uuid(), email: z.email().optional() }),
});
export type CloudSession = z.infer<typeof sessionSchema>;
const storageKey = "baga-cloud-session";
function restoreSession(): CloudSession | null {
  try {
    const parsed = sessionSchema.safeParse(
      JSON.parse(sessionStorage.getItem(storageKey) || "null"),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
let session: CloudSession | null =
  typeof sessionStorage !== "undefined" ? restoreSession() : null;
const subscribers = new Set<() => void>();
export const getSession = () => session;
export function subscribeSession(listener: () => void) {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
function saveSession(value: CloudSession | null) {
  session = value;
  try {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* In-memory sessions still work if session storage is disabled. */
  }
  subscribers.forEach((listener) => listener());
}
async function request(
  path: string,
  body?: unknown,
  token?: string,
  method?: string,
) {
  if (!cloudConfigured)
    throw new Error("Cloud accounts are not configured for this installation.");
  const response = await fetch(`${project}${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: {
      apikey: publicKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error(
        "Your session expired or your sign-in details were not accepted. Sign in again; your local diary is safe.",
      );
    if (response.status === 429)
      throw new Error("Too many requests. Wait a moment before trying again.");
    throw new Error(
      "The cloud service could not complete this request. Check your connection and project setup, then retry.",
    );
  }
  return response.status === 204 ? null : response.json();
}
export async function cloudFunction(name: "push-subscription", body: unknown) {
  const current = await authenticatedSession();
  return request(`/functions/v1/${name}`, body, current.access_token);
}
function authSession(data: Record<string, unknown>) {
  const value = sessionSchema.parse({
    ...data,
    expires_at:
      typeof data.expires_at === "number"
        ? data.expires_at
        : Date.now() / 1000 + Number(data.expires_in || 3600),
  });
  saveSession(value);
  return value;
}
export async function signIn(email: string, password: string) {
  return authSession(
    await request("/auth/v1/token?grant_type=password", { email, password }),
  );
}
export async function signUp(
  email: string,
  password: string,
): Promise<boolean> {
  const data = await request("/auth/v1/signup", { email, password });
  if (data.access_token) {
    authSession(data);
    return true;
  }
  return false;
}
let refreshing: Promise<CloudSession> | undefined;
export async function authenticatedSession(): Promise<CloudSession> {
  if (!session) throw new Error("Sign in to use optional cloud sync.");
  if (session.expires_at > Date.now() / 1000 + 60) return session;
  if (!refreshing) {
    const originalRefreshToken = session.refresh_token;
    refreshing = request("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: originalRefreshToken,
    })
      .then((data) => {
        if (session?.refresh_token !== originalRefreshToken)
          throw new Error("The session changed. Sign in again before syncing.");
        return authSession(data);
      })
      .finally(() => {
        refreshing = undefined;
      });
  }
  return refreshing;
}
export async function signOut() {
  const previous = session;
  saveSession(null);
  // Local sign-out works offline; a failed remote revocation is explicitly returned.
  if (previous) await request("/auth/v1/logout", {}, previous.access_token);
}
const rowSchema = z.object({
  key: z.string().min(1).max(160),
  kind: z.enum(cloudKinds),
  record_id: z.string().min(1).max(120),
  payload: z.record(z.string(), z.unknown()).nullable(),
  revision: z.number().int().min(1),
});
const resultSchema = z.object({
  operation_id: z.uuid(),
  status: z.enum(["applied", "conflict"]),
  row: rowSchema,
});
export function cloudTransport(userId: string): SyncTransport {
  async function token() {
    const current = await authenticatedSession();
    if (current.user.id !== userId)
      throw new Error(
        "The account changed. Retry after linking the correct diary.",
      );
    return current.access_token;
  }
  return {
    async pull() {
      const rows: z.infer<typeof rowSchema>[] = [];
      let cursor = "";
      for (;;) {
        const query = new URLSearchParams({
          select: "key,kind,record_id,payload,revision",
          order: "key.asc",
          limit: "200",
        });
        if (cursor) query.set("key", `gt.${cursor}`);
        const page = z
          .array(rowSchema)
          .parse(
            await request(
              `/rest/v1/baga_records?${query}`,
              undefined,
              await token(),
            ),
          );
        rows.push(...page);
        if (page.length < 200) break;
        const next = page.at(-1)!.key;
        if (next <= cursor)
          throw new Error(
            "Cloud pagination did not advance. Local records were preserved.",
          );
        cursor = next;
      }
      return rows;
    },
    async push(operations: SyncOperation[]) {
      return z.array(resultSchema).parse(
        await request(
          "/rest/v1/rpc/baga_sync_batch",
          {
            p_operations: operations.map((op) => ({
              operation_id: op.operationId,
              key: op.key,
              kind: op.kind,
              record_id: op.recordId,
              payload: op.payload,
              expected_revision: op.expectedRevision,
            })),
          },
          await token(),
        ),
      );
    },
  };
}
export async function deleteCloudAccount() {
  const current = await authenticatedSession();
  await request("/rest/v1/rpc/baga_delete_account", {}, current.access_token);
  saveSession(null);
}
