// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProviderLink } from "../../../src/lib/providers.ts";

/* ============================ CORS ============================ */

function corsHeaders(req: Request): Headers {
  return new Headers({
    "access-control-allow-origin": req.headers.get("Origin") || "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ||
      "authorization, content-type, apikey",
    "access-control-max-age": "86400",
    "content-type": "application/json",
  });
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });

const fail = (req: Request, msg: string, status = 500) =>
  json(req, { ok: false, error: msg }, status);

/* ============================ ENV ============================ */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("ANON_KEY") ?? "";

/* ============================ MAIN ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return fail(req, "Method not allowed", 405);
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return fail(req, "Missing SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY", 500);
    }

    const body = (await req.json().catch(() => ({}))) as { jobId?: string };

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    /* ---------- pick job ---------- */

    let jobId = body.jobId;

    if (!jobId) {
      const { data, error } = await sbAdmin
        .from("jobs")
        .select("id")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) return fail(req, `DB query error: ${error.message}`, 500);

      if (!data) {
        return json(req, { ok: true, message: "no queued jobs" });
      }

      jobId = data.id;
    }

    // claim job (if claim fails because another worker claimed it, we still continue to fetch/verify)
    await sbAdmin.rpc("claim_job", { p_id: jobId });

    const { data: job, error: jobErr } = await sbAdmin
      .from("jobs")
      .select("id,user_id,type,input,settings,tool_key,status,progress")
      .eq("id", jobId)
      .single();

    if (jobErr) return fail(req, `Job load error: ${jobErr.message}`, 500);
    if (!job) return fail(req, "Job not found", 404);

    if (job.type !== "image") {
      return fail(req, "Unsupported job type", 400);
    }

    const provider = getProviderLink(job.tool_key);
    if (!provider || provider.provider !== "runware") {
      return fail(req, "Unsupported provider", 400);
    }

    // mark started
    await sbAdmin.rpc("bump_job_progress", {
      p_id: jobId,
      p_progress: 10,
    });

    // 🔥 hand off to runware-image (ASYNC)
    const handoffRes = await fetch(`${SUPABASE_URL}${provider.edgeFn}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: ANON_KEY,
        authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        jobId,
        userId: job.user_id,
        airTag: provider.airTag,
        prompt: job.input?.subject,
        imageUrl: job.input?.init_image_url || null,
        settings: job.settings, // keep as-is; runware-image handles width/height defaults
      }),
    }).catch((e) => {
      console.error("handoff fetch error:", e);
      return null;
    });
    

    // IMPORTANT: job-worker exits here (async architecture)
    return json(req, {
      ok: true,
      id: jobId,
      message: "handoff started",
      handoff_ok: !!handoffRes && handoffRes.ok,
      handoff_status: handoffRes?.status ?? null,
    });
  } catch (e) {
    console.error(e);
    return fail(req, `Unhandled error: ${String(e)}`, 500);
  }
});
