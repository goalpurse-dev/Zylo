// supabase/functions/runware-video/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { launchRunwareVideo, pollRunware } from "./runware.ts";

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

/* ================= CONFIG ================= */

const MAX_RUNTIME_MS = 7 * 60 * 1000;
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = Math.ceil(MAX_RUNTIME_MS / POLL_INTERVAL_MS);
const MAX_CONSECUTIVE_POLL_ERRORS = 8;

const PROGRESS_MIN = 20;
const PROGRESS_MAX_RUNNING = 95;
const PROGRESS_UPDATE_EVERY_N_POLLS = 3;

/* ================= HELPERS ================= */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeProgress(startMs: number) {
  const elapsed = Date.now() - startMs;
  const pct = (elapsed / MAX_RUNTIME_MS) * 100;
  return Math.floor(clamp(pct, PROGRESS_MIN, PROGRESS_MAX_RUNNING));
}

type SB = ReturnType<typeof createClient>;

async function safeUpdateJob(
  sb: SB,
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await sb.from("jobs").update(patch).eq("id", jobId);
  if (error) console.error("[runware-video] DB update error:", error.message);
}

async function safeRpc(
  sb: SB,
  fn: string,
  args: Record<string, unknown>,
) {
  const { error } = await sb.rpc(fn, args);
  if (error) console.error(`[runware-video] RPC ${fn} error:`, error.message);
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
    if (!SUPABASE_URL || !SERVICE_KEY) return err(req, "Missing Supabase env", 500);

    const body = await req.json().catch(() => ({}));

    const {
      jobId,
      prompt,
      width,
      height,
      resolution, // 🔥 ADD THIS
      durationSec,
      referenceImages,
      airTag,
    } = body ?? {};

    currentJobId = jobId ?? null;

    if (!jobId) return err(req, "Missing jobId");
    if (!prompt) return err(req, "Missing prompt");
    if (!durationSec) return err(req, "Missing durationSec");
    if (!airTag) return err(req, "Missing airTag");

    const isMiniMax = String(airTag).includes("minimax");
    const isKling = String(airTag).includes("kling");

    // ✅ ONLY require width/height for non-resolution models
    if (!isMiniMax && !isKling && (!width || !height)) {
      return err(req, "Missing dimensions");
    }

    // mark job running
    await safeUpdateJob(sb, jobId, {
      status: "running",
      progress: PROGRESS_MIN,
    });

    /* ================= BUILD PROVIDER PAYLOAD ================= */

    const launchPayload: any = {
      subject: String(prompt),
      durationSec: Number(durationSec ?? 5),
      referenceImages: Array.isArray(referenceImages) ? referenceImages : [],
      airTag: String(airTag),
    };

    // 🔥 MiniMax
   if (isMiniMax) {
  launchPayload.resolution =
    resolution === "1080p" ? "1080p" : "720p";
}
else {
  // ✅ Kling + Runway BOTH use width/height
  launchPayload.width = Number(width);
  launchPayload.height = Number(height);
}

    console.log("FINAL PROVIDER PAYLOAD:", launchPayload);

    const { jobId: providerJobId } =
      await launchRunwareVideo(launchPayload);

    /* ================= SAVE PROVIDER ID ================= */

    const { data: settingsRow } = await sb
      .from("jobs")
      .select("settings")
      .eq("id", jobId)
      .single();

    await safeUpdateJob(sb, jobId, {
      settings: {
        ...(settingsRow?.settings ?? {}),
        provider_job_id: providerJobId,
      },
    });

    /* ================= POLLING ================= */

    const startMs = Date.now();
    let consecutivePollErrors = 0;

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);

      if (Date.now() - startMs > MAX_RUNTIME_MS) break;

      let poll: any;

      try {
        poll = await pollRunware(providerJobId);
        consecutivePollErrors = 0;
      } catch (e) {
        consecutivePollErrors++;

        if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          await safeUpdateJob(sb, jobId, {
            status: "failed",
            error: "Provider polling failed repeatedly",
          });
          return ok(req, { ok: false });
        }

        continue;
      }

      if (poll?.url) {
        await safeUpdateJob(sb, jobId, {
          status: "succeeded",
          progress: 100,
          result_url: poll.url,
          charged: true,
        });

        return ok(req, { ok: true });
      }

      const status = String(poll?.status || "").toLowerCase();

      if (["succeeded", "completed", "done"].includes(status)) {
        if (!poll?.url) {
          await safeUpdateJob(sb, jobId, {
            status: "failed",
            error: "Missing result URL",
          });
          return ok(req, { ok: false });
        }

        await safeUpdateJob(sb, jobId, {
          status: "succeeded",
          progress: 100,
          result_url: poll.url,
          charged: true,
        });

        return ok(req, { ok: true });
      }

      if (status === "failed") {
        await safeUpdateJob(sb, jobId, {
          status: "failed",
          error: poll?.error ?? "Video failed",
        });

        return ok(req, { ok: false });
      }

      if (i % PROGRESS_UPDATE_EVERY_N_POLLS === 0) {
        const p = computeProgress(startMs);
        await safeRpc(sb, "bump_job_progress", {
          p_id: jobId,
          p_progress: p,
        });
      }
    }

    await safeUpdateJob(sb, jobId, {
      status: "failed",
      error: "Timeout",
    });

    return ok(req, { ok: false, error: "Timeout" });

  } catch (e) {
    console.error("[runware-video] FULL ERROR:", e);

    if (currentJobId) {
      await safeUpdateJob(sb, currentJobId, {
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return err(req, e instanceof Error ? e.message : String(e), 500);
  }
});