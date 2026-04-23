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

// 🔥 HARD WALL = 8 MINUTES
const MAX_RUNTIME_MS = 8 * 60 * 1000;

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = Math.ceil(MAX_RUNTIME_MS / POLL_INTERVAL_MS);
const MAX_CONSECUTIVE_POLL_ERRORS = 8;

const PROGRESS_MIN = 25;
const PROGRESS_MAX_RUNNING = 95;

/* ================= HELPERS ================= */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeProgress(startMs: number) {
  const elapsed = Date.now() - startMs;
  const ratio = Math.min(1, elapsed / MAX_RUNTIME_MS);
  // Ease-out quad: fast early, slows toward the end so it never feels stuck
  const eased = 1 - Math.pow(1 - ratio, 2);
  return Math.floor(clamp(eased * PROGRESS_MAX_RUNNING + PROGRESS_MIN, PROGRESS_MIN, PROGRESS_MAX_RUNNING));
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
    uid: job.user_id,
    amount: credits,
  });
  if (error) console.error("[runware-video] credit deduction failed after success:", error.message);
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
    if (!SUPABASE_URL || !SERVICE_KEY)
      return err(req, "Missing Supabase env", 500);

    const body = await req.json().catch(() => ({}));

    const {
      jobId,
      prompt,
      width,
      height,
      resolution,
      durationSec,
      referenceImages,
      airTag,
      withSound,
    } = body ?? {};

    currentJobId = jobId ?? null;

    if (!jobId) return err(req, "Missing jobId");
    if (!prompt) return err(req, "Missing prompt");
    if (!durationSec) return err(req, "Missing durationSec");
    if (!airTag) return err(req, "Missing airTag");

    const isMiniMax = String(airTag).includes("minimax");
    const isKling = String(airTag).includes("kling");

    if (!isMiniMax && !isKling && (!width || !height)) {
      return err(req, "Missing dimensions");
    }

    await safeUpdateJob(sb, jobId, {
      status: "running",
      progress: PROGRESS_MIN,
    });

    /* ================= PAYLOAD ================= */

    const launchPayload: any = {
      subject: String(prompt),
      durationSec: Number(durationSec ?? 5),
      referenceImages: Array.isArray(referenceImages) ? referenceImages : [],
      airTag: String(airTag),
      withSound: !!withSound,
    };

    if (isMiniMax) {
      launchPayload.resolution =
        resolution === "1080p" ? "1080p" : "720p";
    } else {
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

      // ✅ REAL SUCCESS (ONLY TRUTH)
      if (poll?.url) {
        await safeUpdateJob(sb, jobId, {
          status: "succeeded",
          progress: 100,
          result_url: poll.url,
          charged: true,
        });
        await chargeJobCredits(sb, jobId);
        return ok(req, { ok: true });
      }

      const status = String(poll?.status || "").toLowerCase();

      // 🔥 IGNORE FAKE FAILURES
      if (status === "failed") {
        console.log("Ignoring Runware 'failed' status — still polling");
        continue;
      }

      // 🔥 ALSO IGNORE DONE WITHOUT URL
      if (["succeeded", "completed", "done"].includes(status)) {
        if (!poll?.url) {
          console.log("Done but no URL — waiting more");
          continue;
        }
      }

      // progress update every poll so the frontend never stalls
      const p = computeProgress(startMs);
      await safeRpc(sb, "bump_job_progress", {
        p_id: jobId,
        p_progress: p,
      });
    }

    /* ================= FINAL FAIL (AFTER 8 MIN) ================= */

    await safeUpdateJob(sb, jobId, {
      status: "failed",
      error: "Final timeout after 8 minutes",
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