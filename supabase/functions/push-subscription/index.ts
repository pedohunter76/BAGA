import { createClient } from "npm:@supabase/supabase-js@2.99.2";
import { nextReminder } from "../../../src/notification-schedule.ts";
import { allowedOrigin, headers, reply } from "../_shared/http.ts";
const endpointAllowed = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.port &&
      [
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
        "wns.windows.com",
      ].some((host) =>
        url.hostname === host || url.hostname.endsWith(`.${host}`)
      );
  } catch {
    return false;
  }
};
Deno.serve(async (request) => {
  if (!allowedOrigin(request)) {
    return reply(request, 403, { error: "origin_not_allowed" });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headers(request) });
  }
  if (request.method !== "POST") {
    return reply(request, 405, { error: "method_not_allowed" });
  }
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return reply(request, 401, { error: "authentication_required" });
  }
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: { user }, error: authError } = await client.auth.getUser(
    authorization.slice(7),
  );
  if (authError || !user) {
    return reply(request, 401, { error: "authentication_required" });
  }
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 8192) {
      return reply(request, 413, { error: "request_too_large" });
    }
    const body = JSON.parse(raw);
    if (body.action === "remove") {
      if (!endpointAllowed(body.endpoint)) {
        return reply(request, 400, { error: "invalid_subscription" });
      }
      const { error } = await client.from("baga_push_subscriptions").delete()
        .eq("user_id", user.id).eq("endpoint", body.endpoint);
      if (error) throw error;
      return reply(request, 200, { saved: true });
    }
    const { subscription, schedule, categories } = body;
    if (
      body.action !== "save" || !endpointAllowed(subscription?.endpoint) ||
      !/^[A-Za-z0-9_-]{80,100}$/.test(subscription?.keys?.p256dh || "") ||
      !/^[A-Za-z0-9_-]{20,30}$/.test(subscription?.keys?.auth || "") ||
      !Array.isArray(categories) || !categories.length ||
      categories.length > 2 || new Set(categories).size !== categories.length ||
      categories.some((c: unknown) => !["daily", "weekly"].includes(String(c)))
    ) return reply(request, 400, { error: "invalid_subscription" });
    // Only standard subscription keys are retained. Request content is never logged.
    const sanitized = {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    };
    const rows = categories.map((category) => ({
      user_id: user.id,
      endpoint: subscription.endpoint,
      subscription: sanitized,
      category,
      timezone: schedule.timezone,
      reminder_time: schedule.time,
      quiet_start: schedule.quietStart,
      quiet_end: schedule.quietEnd,
      next_at: nextReminder({ ...schedule, category }, new Date()),
      lease_until: null,
      retries: 0,
    }));
    const { count, error: countError } = await client.from(
      "baga_push_subscriptions",
    ).select("id", { count: "exact", head: true }).eq("user_id", user.id).neq(
      "endpoint",
      subscription.endpoint,
    );
    if (countError) throw countError;
    if ((count || 0) + rows.length > 20) {
      return reply(request, 429, { error: "subscription_limit" });
    }
    const { error } = await client.from("baga_push_subscriptions").upsert(
      rows,
      { onConflict: "user_id,endpoint,category" },
    );
    if (error) throw error;
    const { error: removeError } = await client.from("baga_push_subscriptions")
      .delete().eq("user_id", user.id).eq("endpoint", subscription.endpoint)
      .not("category", "in", `(${categories.join(",")})`);
    if (removeError) throw removeError;
    return reply(request, 200, { saved: true });
  } catch {
    return reply(request, 400, { error: "invalid_schedule_or_request" });
  }
});
