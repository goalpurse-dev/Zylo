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

function safeRunwarePositivePrompt(positivePrompt: unknown, max = 1450): string {
  const safePositivePrompt = String(positivePrompt || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

  if (safePositivePrompt.length < 2) {
    throw new Error("Video prompt is empty or too short");
  }

  return safePositivePrompt;
}

function computeProgress(startMs: number) {
  const elapsed = Date.now() - startMs;
  const ratio = Math.min(1, elapsed / MAX_RUNTIME_MS);
  const eased = 1 - Math.pow(1 - ratio, 2);

  return Math.floor(
    clamp(
      eased * PROGRESS_MAX_RUNNING + PROGRESS_MIN,
      PROGRESS_MIN,
      PROGRESS_MAX_RUNNING,
    ),
  );
}

type SB = ReturnType<typeof createClient>;

async function safeUpdateJob(
  sb: SB,
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await sb.from("jobs").update(patch).eq("id", jobId);

  if (error) {
    console.error("[runware-video] DB update error:", error.message);
  }
}

async function safeRpc(
  sb: SB,
  fn: string,
  args: Record<string, unknown>,
) {
  const { error } = await sb.rpc(fn, args);

  if (error) {
    console.error(`[runware-video] RPC ${fn} error:`, error.message);
  }
}

/* ================= CREDITS ================= */

// Returns true if the charge went through (or there was nothing to charge),
// false if the user's balance couldn't cover it. Called at LAUNCH time —
// Runware starts billing the instant the job launches, not when polling
// later confirms completion, so the ledger needs to move at the same moment.
async function chargeJobCredits(sb: SB, jobId: string): Promise<boolean> {
  const { data: job } = await sb
    .from("jobs")
    .select("user_id, settings")
    .eq("id", jobId)
    .single();

  if (!job?.user_id) return false;

  const credits = Number(job.settings?.credits ?? 0);
  if (credits <= 0) return true;

  const { error } = await sb.rpc("deduct_credits", {
    uid: job.user_id,
    amount: credits,
  });

  if (error) {
    console.error(
      "[runware-video] credit deduction failed at launch:",
      error.message,
    );
    return false;
  }

  return true;
}

// Reverses chargeJobCredits when a launched job ultimately fails to deliver —
// the user shouldn't pay for a video they never received. Mirrors the
// fallback pattern used in stripe-webhook's atomicAddCredits.
async function refundJobCredits(sb: SB, jobId: string) {
  const { data: job } = await sb
    .from("jobs")
    .select("user_id, settings")
    .eq("id", jobId)
    .single();

  if (!job?.user_id) return;

  const credits = Number(job.settings?.credits ?? 0);
  if (credits <= 0) return;

  const { error } = await sb.rpc("increment_credit_balance", {
    p_user_id: job.user_id,
    p_delta: credits,
  });

  if (error) {
    console.error(
      "[runware-video] credit refund RPC failed, falling back to direct update:",
      error.message,
    );

    const { data: profile } = await sb
      .from("profiles")
      .select("credit_balance")
      .eq("id", job.user_id)
      .single();

    await sb
      .from("profiles")
      .update({ credit_balance: (profile?.credit_balance ?? 0) + credits })
      .eq("id", job.user_id);
  } else {
    console.log(
      `[runware-video] refunded ${credits} credits to user ${job.user_id} for failed job ${jobId}`,
    );
  }
}

/* ================= HANDLER ================= */

async function processVideoJob(body: any) {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

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

  const airTagStr = String(airTag);

  // Runway removed/disabled for now because Runware -> Runway image refs fail.
  if (airTagStr.startsWith("runway:")) {
    await safeUpdateJob(sb, String(jobId), {
      status: "failed",
      error:
        "Runway Gen-4 is temporarily disabled because image-to-video references are not working through this provider.",
    });
    return;
  }

  const isMiniMax = airTagStr.includes("minimax");

  await safeUpdateJob(sb, String(jobId), {
    status: "running",
    progress: PROGRESS_MIN,
  });

  /* ================= PAYLOAD ================= */

  const rawReferenceImages = Array.isArray(referenceImages)
    ? referenceImages.filter(Boolean).map(String)
    : [];
  const safePositivePrompt = safeRunwarePositivePrompt(prompt);

  const launchPayload: any = {
    subject: safePositivePrompt,
    durationSec: Number(durationSec ?? 5),
    referenceImages: rawReferenceImages,
    airTag: airTagStr,
    withSound: !!withSound,
  };

  if (isMiniMax) {
    launchPayload.resolution =
      resolution === "1080p" ? "1080p" : "768p";
  } else {
    launchPayload.width = Number(width);
    launchPayload.height = Number(height);
  }

  console.log(
    "[runware-video] FINAL PROVIDER PAYLOAD:",
    JSON.stringify(launchPayload, null, 2),
  );

  const { jobId: providerJobId } = await launchRunwareVideo(launchPayload);

  // ============== CHARGE AT LAUNCH ==============
  // Runware starts billing the instant launchRunwareVideo succeeds — not
  // when polling later confirms a finished video. Charging here keeps your
  // ledger in sync with the real billing trigger. If the job doesn't pan
  // out, every failure branch below refunds it.
  const charged = await chargeJobCredits(sb, String(jobId));

  /* ================= SAVE PROVIDER ID ================= */

  const { data: settingsRow } = await sb
    .from("jobs")
    .select("settings")
    .eq("id", String(jobId))
    .single();

  await safeUpdateJob(sb, String(jobId), {
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

      console.error("[runware-video] Poll error:", e);

      if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        await safeUpdateJob(sb, String(jobId), {
          status: "failed",
          error: "Provider polling failed repeatedly",
        });
        if (charged) await refundJobCredits(sb, String(jobId));
        return;
      }

      continue;
    }

    console.log("[runware-video] POLL RESULT:", JSON.stringify(poll));

    if (poll?.url) {
      await safeUpdateJob(sb, String(jobId), {
        status: "succeeded",
        progress: 100,
        result_url: poll.url,
        charged: true,
      });
      // Already charged at launch — do not charge again here.
      return;
    }

    const status = String(poll?.status || "").toLowerCase();

    // For real provider failures, fail the job instead of waiting forever.
    if (status === "failed") {
      await safeUpdateJob(sb, String(jobId), {
        status: "failed",
        error: poll?.error ?? "Provider failed",
      });
      if (charged) await refundJobCredits(sb, String(jobId));
      return;
    }

    const p = computeProgress(startMs);

    await safeRpc(sb, "bump_job_progress", {
      p_id: String(jobId),
      p_progress: p,
    });
  }

  /* ================= FINAL FAIL ================= */

  await safeUpdateJob(sb, String(jobId), {
    status: "failed",
    error: "Final timeout after 8 minutes",
  });
  if (charged) await refundJobCredits(sb, String(jobId));
}

/* ================= HANDLER =================
   Returns 202 immediately and runs generation in the background via
   EdgeRuntime.waitUntil. Kling/MiniMax videos take 3-5 minutes — far
   longer than the platform's ~150s handoff idle timeout. The old
   synchronous design meant job-worker gave up and marked these jobs
   "failed" while Runware kept generating (and billing) them anyway,
   so credits never got charged for videos that were actually delivered
   and paid for. Mirrors the pattern already used in runware-image.
================================================= */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }

  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return err(req, "Missing Supabase env", 500);
  }

  const body = await req.json().catch(() => ({}));
  const { jobId, prompt, width, height, durationSec, airTag } = body ?? {};

  if (!jobId) return err(req, "Missing jobId");
  if (!prompt) return err(req, "Missing prompt");
  if (!durationSec) return err(req, "Missing durationSec");
  if (!airTag) return err(req, "Missing airTag");

  const airTagStr = String(airTag);
  const isMiniMax = airTagStr.includes("minimax");
  const isKling = airTagStr.includes("kling");

  if (!isMiniMax && !isKling && (!width || !height)) {
    return err(req, "Missing dimensions");
  }

  EdgeRuntime.waitUntil(
    processVideoJob(body).catch(async (e) => {
      console.error("[runware-video] background process threw:", e);
      try {
        const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false },
        });
        await safeUpdateJob(sb, String(jobId), {
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
        await refundJobCredits(sb, String(jobId));
      } catch { /* ignore */ }
    }),
  );

  return ok(req, { ok: true, accepted: true, jobId }, 202);
});
