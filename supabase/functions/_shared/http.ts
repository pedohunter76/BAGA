export function headers(request: Request): Record<string, string> {
  const allowed = Deno.env.get("BAGA_APP_ORIGIN");
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    ...(allowed && request.headers.get("origin") === allowed
      ? {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers":
          "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      }
      : {}),
  };
}
export function reply(request: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers(request),
  });
}
export function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === Deno.env.get("BAGA_APP_ORIGIN");
}
