// supabase/functions/runware-video/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CREATION_TYPES } from "./_creations.ts";
import {
  launchRunwareVideo,
  type RunwareLaunchArgs,
  AIR_BY_TIER,
} from "./runware.ts";

/* ================= CORS ================= */

function cors(req: Request): Headers {
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

const ok = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

const err = (req: Request, msg: string, status = 400) =>
  ok(req, { ok: false, error: msg }, status);

/* ================= ENV ================= */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

/* ================= HANDLER ================= */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }

  try {
    if (req.method !== "POST") return err(req, "Method not allowed", 405);
    if (!SUPABASE_URL || !SERVICE_KEY)
      return err(req, "Missing Supabase env", 500);

    const body = await req.json().catch(() => ({}));

    const {
      subject,
      tier: rawTier,
      aspect: rawAspect,
      resolution: rawResolution,
      durationSec: rawDuration,
      initImageUrl,
      audio,
      userId,
    } = body ?? {};

    if (!userId) return err(req, "Missing userId", 400);
    if (!subject || typeof subject !== "string") {
      return err(req, "Missing subject", 400);
    }

    // ---------- normalise inputs ----------

    type TierId = keyof typeof AIR_BY_TIER;

    let tier: TierId = "zylo-v3";
    if (rawTier === "zylo-v4") tier = "zylo-v4";
    else if (rawTier === "zylo-v2") tier = "zylo-v2";
    else if (rawTier === "zylo-v1") tier = "zylo-v1";

    const aspect: "16:9" | "9:16" | "1:1" =
      rawAspect === "16:9" || rawAspect === "1:1" ? rawAspect : "9:16";

    const resolution: "720p" | "1080p" =
      rawResolution === "720p" ? "720p" : "1080p";

    const durationSec = Math.max(
      1,
      Math.round(Number(rawDuration ?? 5)),
    );

    const args: RunwareLaunchArgs = {
      tier,
      subject,
      aspect,
      resolution,
      durationSec,
      initImageUrl: initImageUrl ?? null,
      audio: !!audio,
      airTag: null, // let AIR_BY_TIER choose
    };

    console.log("[runware-video] launching with args", args);

    // ---------- Launch Runware via helper ----------

    const { jobId: providerJobId } = await launchRunwareVideo(args);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Optional: know which AIR tag we used for UI/debug
    const airTag = AIR_BY_TIER[tier]?.air ?? null;

    // ---------- Insert job row ----------

    const { data: job, error: jobErr } = await sb
      .from("jobs")
      .insert({
        user_id: userId,
        type: "video",
        status: "queued",
        progress: 0,
        prompt: subject,
        input: {
          subject,
          aspect,
          resolution,
          durationSec,
          initImageUrl,
          audio: !!audio,
        },
        settings: {
          tier,
          tool: "video",
          tool_key: tier === "zylo-v4" ? "t2v:v4" : "t2v:v3",
          creation_type: CREATION_TYPES.VIDEO,
          provider_hint: {
            engine: "runware",
            mode: "t2v",
            airTag,
          },
          provider_job_id: providerJobId,
        },
      })
      .select()
      .single();

    if (jobErr || !job) {
      console.error("[runware-video] job insert error:", jobErr);
      return err(req, "Failed to insert job", 500);
    }

    // ---------- Trigger job-worker so it polls Runware & updates the job ----------

    try {
      fetch(`${SUPABASE_URL}/functions/v1/job-worker`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: SERVICE_KEY,
          authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      }).catch((e) => {
        console.error("[runware-video] failed to trigger job-worker (catch):", e);
      });
    } catch (e) {
      console.error("[runware-video] failed to trigger job-worker (try):", e);
    }

    // ---------- Response to frontend ----------

    return ok(req, {
      ok: true,
      jobId: job.id,
      providerJobId,
    });
  } catch (e) {
    console.error("[runware-video] unhandled error:", e);
    return err(
      req,
      e instanceof Error ? e.message : String(e),
      500,
    );
  }
});
