// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // service key to bypass RLS

type Ok<T> = { ok: true; data: T };
type Err   = { ok: false; error: string };

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": req.headers.get("Access-Control-Request-Headers") || "*",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // ---- read user (auth required) ----
    const { data: auth } = await supa.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ ok: false, error: "not_authenticated" }), {
        status: 200, headers: { "content-type": "application/json", ...cors(req) }
      });
    }

    // ---- parse body (accept several shapes) ----
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const toolKey = body?.key || body?.tool || body?.toolKey || "";     // e.g. "ads:sora"
    const intent  = body?.intent || "use";                               // "use" | "create"
    // optional: cap check (true by default)
    const checkCap = body?.checkCap !== false;

    // ---- fetch plan_code + features via join profiles → app_plans ----
    const { data: rows, error } = await supa
      .from("profiles")
      .select("plan_code, app_plans!inner(code, features)")
      .eq("id", uid)
      .maybeSingle();

    // If the inner join didn’t hit (plan changed or NULL), do LEFT JOIN style:
    let planCode = rows?.plan_code ?? "free";
    let features: any = rows?.app_plans?.features ?? null;

    if (!features) {
      const { data: planRow } = await supa
        .from("app_plans")
        .select("features")
        .eq("code", planCode)
        .maybeSingle();
      features = planRow?.features ?? {};
    }

    const tools: Record<string, boolean> = features?.tools ?? {};
    const dailyCap: number = typeof features?.daily_job_limit === "number" ? features.daily_job_limit : 0;

    const canUseTool = toolKey ? !!tools[toolKey] : true;

    // ---- optional daily cap check ----
    let underCap = true;
    if (checkCap && dailyCap > 0) {
      // Count today's jobs for this user
      const { data: countRows } = await supa
        .from("jobs") // <-- your jobs table
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .gte("created_at", new Date(new Date().toISOString().slice(0,10)).toISOString()); // midnight UTC
      const count = (countRows as unknown as { count: number } | null)?.count ?? 0;
      underCap = count < dailyCap;
    }

    const allowed = canUseTool && underCap;

    return new Response(JSON.stringify({
      ok: true,
      data: {
        allowed,
        reason: allowed ? null : !canUseTool
          ? "Plan does not include this tool"
          : "Daily job limit reached",
        plan_code: planCode,
        features,
      }
    } as Ok<any>), { status: 200, headers: { "content-type": "application/json", ...cors(req) } });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) } as Err), {
      status: 200, // keep 200 so the client never explodes with FunctionsHttpError
      headers: { "content-type": "application/json", ...cors(req) },
    });
  }
});
