// supabase/functions/runware-video/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { launchRunwareVideo, pollRunware } from "./runware.ts";
import { logEvent as persistLog } from "../_shared/systemLog.ts";

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

// Supabase Pro wall-clock limit is ~400s total (including waitUntil background work).
// We must mark the job "failed" *before* Supabase kills the function mid-poll,
// otherwise the job stays stuck in "running" and the frontend never gets a
// terminal state to trigger the retry button.
const MAX_RUNTIME_MS = 320 * 1000; // 320s — leaves ~80s buffer before Supabase kills it

const POLL_INTERVAL_MS = 4000;     // slightly longer interval to save CPU budget
const MAX_POLLS = Math.ceil(MAX_RUNTIME_MS / POLL_INTERVAL_MS);
const MAX_CONSECUTIVE_POLL_ERRORS = 8;

const PROGRESS_MIN = 25;
const PROGRESS_MAX_RUNNING = 95;

/* ================= LOGGING =================
   Every line is prefixed with an icon + [runware-video] + event name so
   Supabase → Edge Functions → runware-video → Logs reads like a timeline:
   scan for 🔴 to find failures, filter by jobId to follow one video's whole
   life (launch → poll → content-policy retry → success/fail).
================================================= */

type LogLevel = "info" | "warn" | "error";

function logEvent(level: LogLevel, event: string, ctx: Record<string, unknown> = {}) {
  const icon = level === "error" ? "🔴" : level === "warn" ? "🟠" : "🟢";
  const line = `${icon} [runware-video] ${event}`;
  const detail = JSON.stringify({ ts: new Date().toISOString(), ...ctx });

  if (level === "error") console.error(line, detail);
  else if (level === "warn") console.warn(line, detail);
  else console.log(line, detail);

  void persistLog("runware-video", level, event, ctx);
}

// Safety net for genuinely unexpected crashes (a bug, not a provider
// rejection) — without this, a stray unhandled promise inside waitUntil
// can vanish from the logs entirely.
globalThis.addEventListener("unhandledrejection", (e: any) => {
  logEvent("error", "unhandled_rejection", {
    reason: e?.reason instanceof Error ? (e.reason.stack ?? e.reason.message) : String(e?.reason),
  });
});

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

function extensionFromContentType(contentType: string | null, fallback = "mp4") {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("quicktime")) return "mov";
  if (normalized.includes("mpegurl")) return "m3u8";
  if (normalized.includes("mp4")) return "mp4";
  return fallback;
}

async function persistVideoResult(sb: SB, jobId: string, sourceUrl: string): Promise<string> {
  if (!/^https?:\/\//i.test(sourceUrl)) return sourceUrl;

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`download failed ${res.status}`);

    const contentType = res.headers.get("content-type") || "video/mp4";
    const blob = await res.blob();
    const ext = extensionFromContentType(contentType);
    const path = `runware/videos/${jobId}.${ext}`;

    const { error: uploadError } = await sb.storage
      .from("generated")
      .upload(path, blob, {
        contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = sb.storage.from("generated").getPublicUrl(path);
    return data?.publicUrl || sourceUrl;
  } catch (e) {
    console.warn("[runware-video] failed to persist result, using provider URL:", String((e as any)?.message ?? e));
    return sourceUrl;
  }
}

/* ================= 402 LAUNCH RETRY ================= */

// Runware returns 402 "insufficientCredits" when their balance-based concurrency
// throttle kicks in — NOT when the account is actually empty. Wait, then retry.
const LAUNCH_RETRY_DELAY_MS = 3 * 60 * 1000; // 3 min

async function launchWithRetry(
  sb: SB,
  jobId: string,
  payload: any,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { jobId: providerJobId } = await launchRunwareVideo(payload);
      return String(providerJobId);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const is402 = msg.includes("(402)");

      if (!is402 || attempt >= 1) throw e;

      logEvent("warn", "launch_402_retry", {
        jobId,
        attempt: attempt + 1,
        retryInSec: LAUNCH_RETRY_DELAY_MS / 1000,
      });

      // Set queued with future retry_after so job-worker won't re-dispatch this row
      await safeUpdateJob(sb, jobId, {
        status: "queued",
        progress: 0,
        retry_after: new Date(Date.now() + LAUNCH_RETRY_DELAY_MS + 10_000).toISOString(),
      });
      await sleep(LAUNCH_RETRY_DELAY_MS);
      await safeUpdateJob(sb, jobId, {
        status: "running",
        progress: PROGRESS_MIN,
        retry_after: new Date().toISOString(),
      });
    }
  }
  throw new Error("unreachable");
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
    logEvent("error", "credit_charge_failed", {
      jobId,
      userId: job.user_id,
      credits,
      message: error.message,
    });
    return false;
  }

  logEvent("info", "credit_charge_success", { jobId, userId: job.user_id, credits });
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
    logEvent("error", "credit_refund_rpc_failed", {
      jobId,
      userId: job.user_id,
      credits,
      message: error.message,
    });

    const { data: profile } = await sb
      .from("profiles")
      .select("credit_balance")
      .eq("id", job.user_id)
      .single();

    await sb
      .from("profiles")
      .update({ credit_balance: (profile?.credit_balance ?? 0) + credits })
      .eq("id", job.user_id);

    logEvent("warn", "credit_refund_fallback_applied", { jobId, userId: job.user_id, credits });
  } else {
    logEvent("info", "credit_refund_success", { jobId, userId: job.user_id, credits });
  }
}

/* ================= CONTENT-POLICY RETRY ================= */

// When a provider (most often Vertex AI behind Veo) rejects a prompt for
// violating its usage guidelines, retrying the exact same prompt just
// fails again. Instead, ask OpenAI to rewrite it — removing whatever most
// likely tripped the filter — and relaunch. Each attempt asks for a more
// conservative rewrite than the last.
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MAX_CONTENT_RETRIES = 2;
// Below this much remaining runtime, don't bother starting another
// attempt — there isn't enough budget left to launch + poll it out.
const MIN_TIME_FOR_RETRY_MS = 45 * 1000;

const CONTENT_POLICY_CODES = new Set([
  "invalidProviderContent",
  "contentPolicyViolation",
  "contentModeration",
]);

const CONTENT_POLICY_KEYWORDS = [
  "usage guidelines",
  "content policy",
  "safety filter",
  "safety system",
  "flagged",
  "moderation",
  "vertex ai",
];

function isContentPolicyFailure(poll: { error?: string; code?: string }): boolean {
  if (poll.code && CONTENT_POLICY_CODES.has(poll.code)) return true;
  const msg = String(poll.error || "").toLowerCase();
  return CONTENT_POLICY_KEYWORDS.some((kw) => msg.includes(kw));
}

async function sanitizePromptWithOpenAI(
  originalPrompt: string,
  attempt: number,
  jobId?: string,
): Promise<string> {
  if (!OPENAI_KEY) {
    logEvent("warn", "sanitize_skipped_no_key", { jobId });
    return originalPrompt;
  }

  const strictness =
    attempt >= 2
      ? "Be very conservative: strip out anything that could remotely be read as violent, dangerous, harmful to a person, sexual, or otherwise sensitive, even if it seems like a stretch. Keep only the safest possible interpretation of the scene."
      : "Remove or soften wording likely to trigger an automated content-safety filter (references to real harm, weapons, blood, distress, or anything that could be misread as violent or unsafe), while keeping the scene's core action and characters recognizable.";

  const systemMessage =
    `You rewrite AI video generation prompts that were rejected by a provider's content-safety filter (e.g. Google Vertex AI). ` +
    `${strictness} ` +
    `Preserve the overall structure, camera direction, and any dialogue formatting exactly — only change the parts likely causing the rejection. ` +
    `Output ONLY the rewritten prompt text. No explanation, no quotes, no markdown.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: originalPrompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      logEvent("error", "sanitize_openai_error", {
        jobId,
        status: res.status,
        body: (await res.text().catch(() => "")).slice(0, 500),
      });
      return originalPrompt;
    }

    const data = await res.json();
    const rewritten = String(data.choices?.[0]?.message?.content ?? "").trim();

    logEvent("info", "sanitize_success", {
      jobId,
      attempt,
      before: originalPrompt.slice(0, 160),
      after: (rewritten || originalPrompt).slice(0, 160),
    });

    return rewritten || originalPrompt;
  } catch (e) {
    logEvent("error", "sanitize_exception", { jobId, message: (e as Error).message });
    return originalPrompt;
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

  logEvent("info", "job_start", {
    jobId,
    airTag: airTagStr,
    durationSec,
    width,
    height,
    resolution,
    withSound: !!withSound,
    refCount: Array.isArray(referenceImages) ? referenceImages.length : 0,
    promptPreview: String(prompt ?? "").slice(0, 160),
  });

  // Runway removed/disabled for now because Runware -> Runway image refs fail.
  if (airTagStr.startsWith("runway:")) {
    logEvent("warn", "job_rejected_runway_disabled", { jobId });
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
  let currentPrompt = safeRunwarePositivePrompt(prompt);

  function buildLaunchPayload(promptText: string) {
    const p: any = {
      subject: promptText,
      durationSec: Number(durationSec ?? 5),
      referenceImages: rawReferenceImages,
      airTag: airTagStr,
      withSound: !!withSound,
      jobId: String(jobId),
    };

    if (isMiniMax) {
      p.resolution = resolution === "1080p" ? "1080p" : "768p";
    } else {
      p.width = Number(width);
      p.height = Number(height);
    }

    return p;
  }

  // Shared across every attempt (including content-policy retries) so the
  // whole job — original attempt plus any rewrites — stays inside the
  // ~320s wall-clock budget instead of resetting the clock each retry.
  const startMs = Date.now();
  let charged = false;
  let contentRetryCount = 0;

  attempts:
  for (;;) {
    const launchPayload = buildLaunchPayload(currentPrompt);

    logEvent("info", "attempt_start", {
      jobId,
      attempt: contentRetryCount + 1,
      isContentRetry: contentRetryCount > 0,
      elapsedMs: Date.now() - startMs,
    });

    const providerJobId = await launchWithRetry(sb, String(jobId), launchPayload);

    // ============== CHARGE AT LAUNCH ==============
    // Runware starts billing the instant launchRunwareVideo succeeds — not
    // when polling later confirms a finished video. Charging here keeps your
    // ledger in sync with the real billing trigger. If the job doesn't pan
    // out, every failure branch below refunds it. Only charge once — a
    // content-policy retry relaunches the same paid job, it doesn't buy
    // another one.
    if (!charged) {
      charged = await chargeJobCredits(sb, String(jobId));
    }

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
        content_retry_count: contentRetryCount,
        ...(contentRetryCount > 0 ? { sanitized_prompt: currentPrompt } : {}),
      },
    });

    /* ================= POLLING ================= */

    let consecutivePollErrors = 0;
    let lastLoggedStatus = "";

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);

      if (Date.now() - startMs > MAX_RUNTIME_MS) break attempts;

      let poll: any;

      try {
        poll = await pollRunware(providerJobId, String(jobId));
        consecutivePollErrors = 0;
      } catch (e) {
        consecutivePollErrors++;

        logEvent("error", "poll_exception", {
          jobId,
          consecutiveErrors: consecutivePollErrors,
          message: (e as Error)?.message ?? String(e),
        });

        if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          logEvent("error", "job_failed", { jobId, reason: "poll_errors_exhausted", elapsedMs: Date.now() - startMs });
          await safeUpdateJob(sb, String(jobId), {
            status: "failed",
            error: "Provider polling failed repeatedly",
          });
          if (charged) await refundJobCredits(sb, String(jobId));
          return;
        }

        continue;
      }

      // Only log when the status actually changes, or every ~20s as a
      // heartbeat — logging every 4s poll for minutes drowns out the
      // signal you actually care about.
      const statusKey = String(poll?.status || "unknown");
      if (statusKey !== lastLoggedStatus || i % 5 === 0) {
        logEvent("info", "poll_status", {
          jobId,
          status: statusKey,
          attempt: contentRetryCount + 1,
          elapsedMs: Date.now() - startMs,
        });
        lastLoggedStatus = statusKey;
      }

      if (poll?.url) {
        logEvent("info", "provider_video_ready", { jobId, elapsedMs: Date.now() - startMs });
        const storedUrl = await persistVideoResult(sb, String(jobId), poll.url);
        await safeUpdateJob(sb, String(jobId), {
          status: "succeeded",
          progress: 100,
          result_url: storedUrl,
          charged: true,
        });
        logEvent("info", "job_succeeded", {
          jobId,
          contentRetryCount,
          totalElapsedMs: Date.now() - startMs,
        });
        // Already charged at launch — do not charge again here.
        return;
      }

      const status = String(poll?.status || "").toLowerCase();

      // For real provider failures, fail the job instead of waiting forever.
      if (status === "failed") {
        const timeLeftMs = MAX_RUNTIME_MS - (Date.now() - startMs);
        const contentPolicyHit = isContentPolicyFailure(poll);

        if (contentPolicyHit) {
          logEvent("warn", "content_policy_detected", {
            jobId,
            code: poll?.code ?? null,
            message: poll?.error,
            contentRetryCount,
            timeLeftMs,
          });
        }

        if (
          contentPolicyHit &&
          contentRetryCount < MAX_CONTENT_RETRIES &&
          timeLeftMs > MIN_TIME_FOR_RETRY_MS
        ) {
          contentRetryCount++;
          logEvent("info", "content_retry_starting", {
            jobId,
            attempt: contentRetryCount,
            maxRetries: MAX_CONTENT_RETRIES,
          });

          currentPrompt = await sanitizePromptWithOpenAI(currentPrompt, contentRetryCount, String(jobId));

          await safeUpdateJob(sb, String(jobId), {
            status: "running",
            progress: PROGRESS_MIN,
          });

          continue attempts;
        }

        logEvent("error", "job_failed", {
          jobId,
          reason: contentPolicyHit ? "content_policy_retries_exhausted" : "provider_failed",
          providerError: poll?.error,
          contentRetryCount,
          elapsedMs: Date.now() - startMs,
        });

        await safeUpdateJob(sb, String(jobId), {
          status: "failed",
          error:
            contentRetryCount > 0
              ? `Video rejected by the provider's content filter after ${contentRetryCount} rewritten attempt${contentRetryCount > 1 ? "s" : ""}. Try a different description.`
              : poll?.error ?? "Provider failed",
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
  }

  /* ================= FINAL FAIL ================= */

  logEvent("error", "job_failed", { jobId, reason: "timeout", contentRetryCount, elapsedMs: Date.now() - startMs });

  await safeUpdateJob(sb, String(jobId), {
    status: "failed",
    error: "Video generation timed out — click Retry video to try again",
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

  const airTagStr    = String(airTag);
  const isMiniMax    = airTagStr.includes("minimax");
  const isKling      = airTagStr.includes("kling");
  const isVeoLite    = airTagStr === "google:veo@3.1-lite";
  const isSeedance20 = airTagStr === "bytedance:seedance@2.0-fast";

  // Seedance 2.0 Fast and Veo provide their own dimensions — skip the guard
  if (!isMiniMax && !isKling && !isVeoLite && !isSeedance20 && (!width || !height)) {
    logEvent("warn", "request_rejected_missing_dimensions", { jobId, airTag: airTagStr, width, height });
    return err(req, "Missing dimensions");
  }

  logEvent("info", "request_accepted", { jobId, airTag: airTagStr });

  EdgeRuntime.waitUntil(
    processVideoJob(body).catch(async (e) => {
      // Reaching this means something threw *outside* processVideoJob's own
      // handling (a genuine bug, not a modeled provider failure) — log the
      // full stack so it's actually debuggable from the dashboard.
      logEvent("error", "background_process_crashed", {
        jobId,
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      try {
        const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false },
        });
        await safeUpdateJob(sb, String(jobId), {
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
        await refundJobCredits(sb, String(jobId));
      } catch (inner) {
        logEvent("error", "crash_handler_itself_failed", {
          jobId,
          message: inner instanceof Error ? inner.message : String(inner),
        });
      }
    }),
  );

  return ok(req, { ok: true, accepted: true, jobId }, 202);
});
