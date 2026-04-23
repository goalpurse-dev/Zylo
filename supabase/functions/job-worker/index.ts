// supabase/functions/job-worker/index.ts
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

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

/* ============================ MAIN ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return fail(req, "Method not allowed", 405);
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return fail(req, "Missing SUPABASE_URL / SERVICE_ROLE_KEY", 500);
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
      if (!data?.id) return json(req, { ok: true, message: "no queued jobs" });

      jobId = data.id;
    }

    // claim job (safe if already claimed elsewhere)
    try {
      await sbAdmin.rpc("claim_job", { p_id: jobId });
    } catch {
      // ignore claim race
    }

    const { data: job, error: jobErr } = await sbAdmin
      .from("jobs")
      .select("id,user_id,type,input,settings,tool_key,status,progress,prompt")
      .eq("id", jobId)
      .single();

    if (jobErr) return fail(req, `Job load error: ${jobErr.message}`, 500);
    if (!job) return fail(req, "Job not found", 404);

    if (job.status !== "queued" && job.status !== "running" && job.status !== "processing") {
      // already done or canceled
      return json(req, { ok: true, id: jobId, message: "job not runnable", status: job.status });
    }

    if (job.type !== "image" && job.type !== "video") {
      return fail(req, `Unsupported job type: ${job.type}`, 400);
    }

    if (!job.tool_key) {
      return fail(req, "Missing tool_key on job row", 400);
    }

    const provider = getProviderLink(job.tool_key);
    if (!provider || provider.provider !== "runware") {
      return fail(req, "Unsupported provider", 400);
    }

    // mark started
    try {
      await sbAdmin.rpc("bump_job_progress", {
        p_id: jobId,
        p_progress: 10,
      });
    } catch {
      // ignore
    }

    // Build refs consistently
    const referenceImages =
      job.input?.ref_images ??
      (job.input?.init_image_url ? [job.input.init_image_url] : []);

    // Use provider.edgeFn as the source of truth
    const EDGE_FN_URL = `${SUPABASE_URL}${provider.edgeFn}`;

    // IMPORTANT:
    // - runware-image expects prompt + refs + settings (your current design)
    // - runware-video MUST be changed to accept jobId + settings and UPDATE the existing job (NOT insert a new one)
    const payload =
  job.type === "image"
    ? {
        jobId,
        airTag: provider.airTag,
        prompt: job.prompt ?? job.input?.subject ?? "",
        referenceImages,
        settings: {
          ...(job.settings ?? {}),
          width: job.input?.width,
          height: job.input?.height,
        },
      }
    : {
        jobId,
        airTag: provider.airTag,
        prompt: job.prompt ?? job.input?.subject ?? "",
        width: job.input?.width,
        height: job.input?.height,
        durationSec: job.input?.durationSec,
        referenceImages,
        withSound: job.input?.withSound ?? false,
      };

      console.log("VIDEO PAYLOAD:", JSON.stringify(payload));
      
    const handoffRes = await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    return json(req, {
      ok: true,
      id: jobId,
      message: "handoff started",
      edgeFn: provider.edgeFn,
      handoff_ok: !!handoffRes && handoffRes.ok,
      handoff_status: handoffRes?.status ?? null,
    });
  } catch (e) {
    console.error(e);
    return fail(req, `Unhandled error: ${String(e)}`, 500);
  }

  
});