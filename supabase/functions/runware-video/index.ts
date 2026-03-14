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

const MAX_RUNTIME_MS = 7 * 60 * 1000; // 7 minutes
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = Math.ceil(MAX_RUNTIME_MS / POLL_INTERVAL_MS); // ~140
const MAX_CONSECUTIVE_POLL_ERRORS = 8; // tolerate transient network/provider issues
const PROGRESS_MIN = 20;
const PROGRESS_MAX_RUNNING = 95;

// reduce DB write volume (progress updates)
const PROGRESS_UPDATE_EVERY_N_POLLS = 3;

/* ================= HELPERS ================= */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeProgress(startMs: number) {
  const elapsed = Date.now() - startMs;
  const pct = (elapsed / MAX_RUNTIME_MS) * 100;
  // Keep it in [20..95] while running
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
  return !error;
}

async function safeRpc(
  sb: SB,
  fn: string,
  args: Record<string, unknown>,
) {
  const { error } = await sb.rpc(fn, args);
  if (error) console.error(`[runware-video] RPC ${fn} error:`, error.message);
  return !error;
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
      durationSec,
      referenceImages,
      airTag,
    } = body ?? {};

    currentJobId = jobId ?? null;

    if (!jobId) return err(req, "Missing jobId");
    if (!prompt) return err(req, "Missing prompt");
    if (!width || !height) return err(req, "Missing dimensions");
    if (!durationSec) return err(req, "Missing durationSec");
    if (!airTag) return err(req, "Missing airTag");

    // mark job running
    await safeUpdateJob(sb, jobId, { status: "running", progress: PROGRESS_MIN });

    // Launch provider job
    const { jobId: providerJobId } = await launchRunwareVideo({
      subject: String(prompt),
      width: Number(width),
      height: Number(height),
      durationSec: Number(durationSec ?? 5),
      referenceImages: Array.isArray(referenceImages) ? referenceImages : [],
      airTag: String(airTag),
    });

    // Persist provider_job_id (best effort)
    const { data: settingsRow, error: settingsErr } = await sb
      .from("jobs")
      .select("settings")
      .eq("id", jobId)
      .single();

    if (settingsErr) {
      console.error("[runware-video] Failed to read settings:", settingsErr.message);
    }

    await safeUpdateJob(sb, jobId, {
      settings: {
        ...(settingsRow?.settings ?? {}),
        provider_job_id: providerJobId,
      },
    });

    // Poll loop
    const startMs = Date.now();
    let consecutivePollErrors = 0;

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);

      // hard timeout check
      if (Date.now() - startMs > MAX_RUNTIME_MS) break;

      let poll: any;
      try {
        poll = await pollRunware(providerJobId);
        consecutivePollErrors = 0;
      } catch (e) {
        consecutivePollErrors++;
        console.error(
          "[runware-video] pollRunware error:",
          e instanceof Error ? e.message : String(e),
        );

        if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          await safeUpdateJob(sb, jobId, {
            status: "failed",
            error: "Provider polling failed repeatedly",
          });
          return ok(req, { ok: false });
        }

        // keep waiting
        continue;
      }

      const status = poll?.status;

      if (status === "succeeded") {
        const url = poll?.url;
        if (!url) {
          // Provider claims succeeded but no URL: treat as provider error
          await safeUpdateJob(sb, jobId, {
            status: "failed",
            error: "Provider succeeded but missing result URL",
          });
          return ok(req, { ok: false });
        }

        // Billing + finalization
        const { data: job, error: jobErr } = await sb
          .from("jobs")
          .select("user_id, charge_credits, charged")
          .eq("id", jobId)
          .single();

        if (jobErr || !job) {
          await safeUpdateJob(sb, jobId, {
            status: "failed",
            error: "Billing error: job not found",
          });
          return ok(req, { ok: false });
        }

        // If not charged yet, attempt to deduct
      await safeUpdateJob(sb, jobId, {
  status: "succeeded",
  progress: 100,
  result_url: url,
  charged: true,
});


        // Final DB update (this is the critical state transition)
        await safeUpdateJob(sb, jobId, {
          status: "succeeded",
          progress: 100,
          result_url: url,
          charged: true,
        });

        console.log("[runware-video] succeeded", { jobId, providerJobId });
        return ok(req, { ok: true });
      }

      if (status === "failed") {
        await safeUpdateJob(sb, jobId, {
          status: "failed",
          error: poll?.error ?? "Video failed",
        });

        console.log("[runware-video] failed", { jobId, providerJobId });
        return ok(req, { ok: false });
      }

      // progress update (best effort, not too frequent)
      if (i % PROGRESS_UPDATE_EVERY_N_POLLS === 0) {
        const p = computeProgress(startMs);

        // If you prefer direct update instead of RPC, swap this:
        // await safeUpdateJob(sb, jobId, { progress: p });
        await safeRpc(sb, "bump_job_progress", { p_id: jobId, p_progress: p });
      }
    }

    // timeout
    await safeUpdateJob(sb, currentJobId ?? "UNKNOWN", {
      status: "failed",
      error: "Timeout",
    });

    console.log("[runware-video] timeout", { jobId: currentJobId });
    return ok(req, { ok: false, error: "Timeout" });
  } catch (e) {
    console.error("[runware-video] FULL ERROR:", e);


    // Always try to mark the job failed to avoid "stuck running" forever
    if (currentJobId) {
      try {
        await safeUpdateJob(sb, currentJobId, {
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
      } catch {
        // ignore
      }
    }

    return err(req, e instanceof Error ? e.message : String(e), 500);
  }
});