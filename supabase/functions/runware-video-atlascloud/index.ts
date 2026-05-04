// supabase/functions/runware-video-atlascloud/index.ts
// Atlas Cloud video provider — Wan 2.6 Flash + Vidu Q3 Turbo
// Structure mirrors runware-video/index.ts exactly; only the provider calls differ.
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ================= ENV ================= */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";

const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

const ATLASCLOUD_API_KEY = Deno.env.get("ATLASCLOUD_API_KEY") ?? "";

const ATLAS_BASE         = "https://api.atlascloud.ai/api/v1/model";
const ATLAS_GENERATE     = `${ATLAS_BASE}/generateVideo`;
const ATLAS_PREDICTION   = (id: string) => `${ATLAS_BASE}/prediction/${id}`;

/* ================= CORS ================= */

function cors(req: Request): Headers {
  const origin = req.headers.get("Origin") || "*";
  const reqHeaders =
    req.headers.get("Access-Control-Request-Headers") ||
    "authorization, x-client-info, apikey, content-type";

  return new Headers({
    "access-control-allow-origin":      origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods":     "POST, OPTIONS",
    "access-control-allow-headers":     reqHeaders,
    "access-control-max-age":           "86400",
    "content-type":                     "application/json",
    vary:                               "Origin",
  });
}

const ok  = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

const err = (req: Request, msg: string, status = 400) =>
  ok(req, { ok: false, error: msg }, status);

/* ================= CONFIG ================= */

const MAX_RUNTIME_MS           = 8 * 60 * 1000;
const POLL_INTERVAL_MS         = 3000;
const MAX_POLLS                = Math.ceil(MAX_RUNTIME_MS / POLL_INTERVAL_MS);
const MAX_CONSECUTIVE_POLL_ERRORS = 8;
const PROGRESS_MIN             = 25;
const PROGRESS_MAX_RUNNING     = 95;

/* ================= HELPERS ================= */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeProgress(startMs: number) {
  const elapsed = Date.now() - startMs;
  const ratio   = Math.min(1, elapsed / MAX_RUNTIME_MS);
  const eased   = 1 - Math.pow(1 - ratio, 2);
  return Math.floor(clamp(eased * PROGRESS_MAX_RUNNING + PROGRESS_MIN, PROGRESS_MIN, PROGRESS_MAX_RUNNING));
}

type SB = ReturnType<typeof createClient>;

async function safeUpdateJob(sb: SB, jobId: string, patch: Record<string, unknown>) {
  const { error } = await sb.from("jobs").update(patch).eq("id", jobId);
  if (error) console.error("[atlascloud-video] DB update error:", error.message);
}

async function safeRpc(sb: SB, fn: string, args: Record<string, unknown>) {
  const { error } = await sb.rpc(fn, args);
  if (error) console.error(`[atlascloud-video] RPC ${fn} error:`, error.message);
}

/* ================= CREDITS ================= */

async function chargeJobCredits(sb: SB, jobId: string) {
  const { data: job } = await sb
    .from("jobs")
    .select("user_id, settings")
    .eq("id", jobId)
    .single();

  if (!job?.user_id) return;

  const credits = Number(job.settings?.credits ?? 0);
  if (credits <= 0) return;

  const { error } = await sb.rpc("deduct_credits", {
    uid:    job.user_id,
    amount: credits,
  });

  if (error) {
    console.error("[atlascloud-video] credit deduction failed after success:", error.message);
  }
}

/* ================= ATLAS CLOUD API ================= */

/**
 * Resolve the full model slug.
 * - Wan 2.6 Flash has a single slug (always i2v).
 * - Vidu Q3 Turbo has two slugs: append modality based on whether an
 *   input image is present.
 */
function resolveModelSlug(airTag: string, hasRefImage: boolean): string {
  if (airTag === "vidu/q3-turbo") {
    return hasRefImage
      ? "vidu/q3-turbo/image-to-video"
      : "vidu/q3-turbo/text-to-video";
  }
  // For all other tags (e.g. wan-2.6 flash), use as-is.
  return airTag;
}

/** Submit a generation job to Atlas Cloud. Returns the prediction ID. */
async function launchAtlasVideo(params: {
  modelSlug:   string;
  prompt:      string;
  durationSec: number;
  width:       number;
  height:      number;
  refImage?:   string;
  withSound:   boolean;
}): Promise<string> {
  const input: Record<string, any> = {
    prompt:   params.prompt,
    duration: params.durationSec,
    width:    params.width,
    height:   params.height,
  };

  if (params.refImage) {
    input.image = params.refImage;
  }

  if (params.withSound) {
    input.with_audio = true;
  }

  const body = {
    model: params.modelSlug,
    input,
  };

  console.log("[atlascloud-video] LAUNCH PAYLOAD:", JSON.stringify(body, null, 2));

  const res = await fetch(ATLAS_GENERATE, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${ATLASCLOUD_API_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new Error(`Atlas Cloud submit failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const predictionId = data?.id ?? data?.prediction_id ?? data?.requestId;

  if (!predictionId) {
    throw new Error(`Atlas Cloud returned no prediction ID. Response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return String(predictionId);
}

/** Poll Atlas Cloud for a prediction result. Returns { url } on success or { status } while pending. */
async function pollAtlas(predictionId: string): Promise<{ url?: string; status: string; error?: string }> {
  const res = await fetch(ATLAS_PREDICTION(predictionId), {
    headers: { "Authorization": `Bearer ${ATLASCLOUD_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`Atlas Cloud poll failed (${res.status})`);
  }

  const data = await res.json();
  const status = String(data?.status ?? "").toLowerCase();

  if (status === "completed" || status === "succeeded") {
    // outputs[0] is the video URL per the Atlas Cloud spec
    const url =
      data?.outputs?.[0] ??
      data?.output?.[0]  ??
      data?.video_url    ??
      data?.url          ??
      null;

    if (!url) {
      throw new Error(`Atlas Cloud completed but no video URL found. Response: ${JSON.stringify(data).slice(0, 200)}`);
    }

    return { url: String(url), status };
  }

  if (status === "failed" || status === "error") {
    return { status, error: data?.error ?? data?.message ?? "Provider failed" };
  }

  // still in_queue / processing / running
  return { status };
}

/* ================= HANDLER ================= */

Deno.serve(async (req) => {
  let currentJobId: string | null = null;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (req.method !== "POST") return err(req, "Method not allowed", 405);

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return err(req, "Missing Supabase env", 500);
    }

    if (!ATLASCLOUD_API_KEY) {
      return err(req, "Missing ATLASCLOUD_API_KEY", 500);
    }

    const body = await req.json().catch(() => ({}));

    const {
      jobId,
      prompt,
      width,
      height,
      durationSec,
      referenceImages,
      airTag,
      withSound,
    } = body ?? {};

    currentJobId = jobId ?? null;

    if (!jobId)      return err(req, "Missing jobId");
    if (!prompt)     return err(req, "Missing prompt");
    if (!durationSec) return err(req, "Missing durationSec");
    if (!airTag)     return err(req, "Missing airTag");
    if (!width || !height) return err(req, "Missing dimensions");

    const rawRefs: string[] = Array.isArray(referenceImages)
      ? referenceImages.filter(Boolean).map(String)
      : [];

    const refImage   = rawRefs[0] ?? undefined;
    const modelSlug  = resolveModelSlug(String(airTag), !!refImage);

    await safeUpdateJob(sb, String(jobId), {
      status:   "running",
      progress: PROGRESS_MIN,
    });

    /* ─── Submit to Atlas Cloud ─── */

    let predictionId: string;
    try {
      predictionId = await launchAtlasVideo({
        modelSlug,
        prompt:      String(prompt),
        durationSec: Number(durationSec ?? 5),
        width:       Number(width),
        height:      Number(height),
        refImage,
        withSound:   !!withSound,
      });
    } catch (e: any) {
      await safeUpdateJob(sb, String(jobId), {
        status: "failed",
        error:  e.message,
      });
      return err(req, e.message, 502);
    }

    console.log("[atlascloud-video] prediction ID:", predictionId);

    /* ─── Save prediction ID ─── */

    const { data: settingsRow } = await sb
      .from("jobs")
      .select("settings")
      .eq("id", String(jobId))
      .single();

    await safeUpdateJob(sb, String(jobId), {
      settings: {
        ...(settingsRow?.settings ?? {}),
        provider_job_id: predictionId,
      },
    });

    /* ─── Poll for result ─── */

    const startMs              = Date.now();
    let consecutivePollErrors  = 0;

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);

      if (Date.now() - startMs > MAX_RUNTIME_MS) break;

      let poll: { url?: string; status: string; error?: string };

      try {
        poll = await pollAtlas(predictionId);
        consecutivePollErrors = 0;
      } catch (e) {
        consecutivePollErrors++;
        console.error("[atlascloud-video] Poll error:", e);

        if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          await safeUpdateJob(sb, String(jobId), {
            status: "failed",
            error:  "Provider polling failed repeatedly",
          });
          return ok(req, { ok: false });
        }

        continue;
      }

      console.log("[atlascloud-video] POLL:", JSON.stringify(poll));

      if (poll.url) {
        await safeUpdateJob(sb, String(jobId), {
          status:     "succeeded",
          progress:   100,
          result_url: poll.url,
          charged:    true,
        });

        await chargeJobCredits(sb, String(jobId));

        return ok(req, { ok: true, result_url: poll.url });
      }

      if (poll.status === "failed" || poll.status === "error") {
        await safeUpdateJob(sb, String(jobId), {
          status: "failed",
          error:  poll.error ?? "Provider failed",
        });
        return ok(req, { ok: false, error: poll.error ?? "Provider failed" });
      }

      // still pending — update progress and keep polling
      await safeRpc(sb, "bump_job_progress", {
        p_id:       String(jobId),
        p_progress: computeProgress(startMs),
      });
    }

    /* ─── Final timeout ─── */

    await safeUpdateJob(sb, String(jobId), {
      status: "failed",
      error:  "Final timeout after 8 minutes",
    });

    return ok(req, { ok: false, error: "Timeout" });

  } catch (e) {
    console.error("[atlascloud-video] FULL ERROR:", e);

    if (currentJobId) {
      await safeUpdateJob(sb, currentJobId, {
        status: "failed",
        error:  e instanceof Error ? e.message : String(e),
      });
    }

    return err(req, e instanceof Error ? e.message : String(e), 500);
  }
});
