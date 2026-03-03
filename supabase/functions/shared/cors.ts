// supabase/functions/_shared/cors.ts
export function cors(req: Request): Headers {
  const origin = req.headers.get("Origin") || "*";
  const reqHeaders =
    req.headers.get("Access-Control-Request-Headers") ||
    "authorization, x-client-info, apikey, content-type";

  return new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": reqHeaders,
    "access-control-max-age": "86400",
    "content-type": "application/json",
    vary: "Origin",
  });
}

export function ok(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

export function err(req: Request, message: string, status = 400, extra?: Record<string, unknown>) {
  return ok(req, { error: message, ...(extra ?? {}) }, status);
}