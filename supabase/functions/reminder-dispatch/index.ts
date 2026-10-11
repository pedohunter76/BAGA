import { createClient } from "npm:@supabase/supabase-js@2.99.2";
import webpush from "npm:web-push@3.6.7";
import {
  inQuietHours,
  nextReminder,
} from "../../../src/notification-schedule.ts";
// A scheduler secret authorizes this endpoint. It is never included in the PWA.
async function validSecret(value: string, expected: string) {
  const digest = async (text: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    );
  const [a, b] = await Promise.all([digest(value), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return Boolean(expected) && diff === 0;
}
Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  if (
    !await validSecret(
      request.headers.get("x-baga-cron-secret") || "",
      Deno.env.get("BAGA_CRON_SECRET") || "",
    )
  ) return new Response(null, { status: 401 });
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: rows, error } = await client.rpc("baga_claim_reminders");
  if (error) return Response.json({ error: "claim_failed" }, { status: 503 });
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );
  let sent = 0, failed = 0;
  const due = (rows || []) as {
    id: string;
    timezone: string;
    reminder_time: string;
    quiet_start: string;
    quiet_end: string;
    category: "daily" | "weekly";
    next_at: string;
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  }[];
  for (let offset = 0; offset < due.length; offset += 10) {
    await Promise.all(
      due.slice(offset, offset + 10).map(async (row) => {
        try {
          const now = new Date();
          const currentTime = new Intl.DateTimeFormat("en-GB", {
            timeZone: row.timezone,
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(now);
          const expired =
            now.getTime() - Date.parse(row.next_at) > 60 * 60 * 1000;
          const quiet = inQuietHours(
            currentTime,
            row.quiet_start,
            row.quiet_end,
          );
          const next = nextReminder({
            timezone: row.timezone,
            time: row.reminder_time,
            quietStart: row.quiet_start,
            quietEnd: row.quiet_end,
            category: row.category,
          }, now);
          if (!expired && !quiet) {
            await webpush.sendNotification(
              row.subscription,
              JSON.stringify({ category: row.category }),
              { TTL: 900, timeout: 10000, urgency: "normal" },
            );
            sent++;
          }
          const { error: saveError } = await client.from(
            "baga_push_subscriptions",
          ).update({ next_at: next, lease_until: null, retries: 0 }).eq(
            "id",
            row.id,
          );
          if (saveError) failed++;
        } catch (error) {
          failed++;
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await client.from("baga_push_subscriptions").delete().eq(
              "id",
              row.id,
            );
            return;
          }
          // Keep the due reminder for retry; skip stale reminders on the next run.
          await client.from("baga_push_subscriptions").update({
            lease_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }).eq("id", row.id);
        }
      }),
    );
  }
  // Counts only. No endpoints, identities, notes, or diary records are logged.
  return Response.json({ sent, failed }, {
    headers: { "Cache-Control": "no-store" },
  });
});
