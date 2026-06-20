// supabase/functions/queue-worker/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProviderLink } from "../../../src/lib/providers.ts";

/* ─── CORS ─── */
const CORS = {
  "access-control-allow-origin":  "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

/* ─── ENV ─── */
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")              ?? "";
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WORKER_ID         = `qw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/* ─── CONCURRENCY LIMITS ─── */
// Tune via env vars without redeploy
const RUNWARE_TOTAL_MAX = Number(Deno.env.get("RUNWARE_TOTAL_MAX_CONCURRENT") ?? 3);
const RUNWARE_IMAGE_MAX = Number(Deno.env.get("RUNWARE_IMAGE_MAX_CONCURRENT") ?? 3);
const RUNWARE_VIDEO_MAX = Number(Deno.env.get("RUNWARE_VIDEO_MAX_CONCURRENT") ?? 1);

/* ─── RETRY LOGIC ─── */
const RETRY_DELAYS_MS = [30_000, 90_000, 180_000, 420_000, 900_000];

function retryDelayMs(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)];
}

function isRetryableConcurrencyError(errorBody: any): boolean {
  const errors: any[] = Array.isArray(errorBody?.errors)
    ? errorBody.errors
    : Array.isArray(errorBody)
    ? errorBody
    : [];
  return errors.some((e: any) => {
    const code    = String(e?.code    ?? "").toLowerCase();
    const message = String(e?.message ?? "").toLowerCase();
    return (
      code    === "insufficientcredits" ||
      message.includes("insufficient credits") ||
      message.includes("concurrency") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    );
  });
}

/* ─── HELPERS ─── */

type Counts = { total: number; image: number; video: number };

async function getRunwareProcessingCounts(sb: any): Promise<Counts> {
  const [{ count: total }, { count: image }, { count: video }] = await Promise.all([
    sb.from("jobs").select("id", { count: "exact", head: true })
      .eq("status", "running").eq("type", "image").or("type.eq.video"),
    sb.from("jobs").select("id", { count: "exact", head: true })
      .eq("type", "image").in("status", ["queued", "running", "processing"]),
    sb.from("jobs").select("id", { count: "exact", head: true })
      .eq("type", "video").in("status", ["queued", "running", "processing"]),
  ]);
  return {
    total: (total ?? 0) + (image ?? 0),  // approximate: combine image+video running
    image: image ?? 0,
    video: video ?? 0,
  };
}

function canStartJob(taskType: string, counts: Counts): boolean {
  if (counts.image + counts.video >= RUNWARE_TOTAL_MAX) return false;
  if (taskType === "image") return counts.image < RUNWARE_IMAGE_MAX;
  if (taskType === "video") return counts.video < RUNWARE_VIDEO_MAX;
  return false;
}

/* ─── PHASE 1: Sync completed/failed jobs → queue rows ─── */
async function syncCompletedJobs(sb: any): Promise<void> {
  // Find processing queue rows whose linked job has finished
  const { data: processingRows } = await sb
    .from("generation_queue")
    .select("id, job_id, attempts, max_attempts, payload")
    .eq("status", "processing")
    .not("job_id", "is", null)
    .limit(50);

  if (!processingRows?.length) return;

  const jobIds = processingRows.map((r: any) => r.job_id);
  const { data: jobs } = await sb
    .from("jobs")
    .select("id, status, result_url, error")
    .in("id", jobIds);

  if (!jobs?.length) return;

  const jobMap = new Map(jobs.map((j: any) => [j.id, j]));

  for (const row of processingRows) {
    const job = jobMap.get(row.job_id);
    if (!job) continue;

    if (job.status === "succeeded") {
      await sb.from("generation_queue").update({
        status:       "completed",
        result:       { result_url: job.result_url },
        completed_at: new Date().toISOString(),
        locked_at:    null,
        locked_by:    null,
        updated_at:   new Date().toISOString(),
      }).eq("id", row.id);

    } else if (job.status === "failed" || job.status === "canceled") {
      const attempts     = Number(row.attempts ?? 0) + 1;
      const maxAttempts  = Number(row.max_attempts ?? 5);
      const errorPayload = { message: job.error ?? "Provider job failed", job_status: job.status };

      // Check if the error is a retryable concurrency error
      const retryable = isRetryableConcurrencyError({ errors: [{ code: "insufficientcredits", message: job.error ?? "" }] });

      if (retryable && attempts < maxAttempts) {
        const delay       = retryDelayMs(attempts - 1);
        const retryAfter  = new Date(Date.now() + delay).toISOString();
        await sb.rpc("requeue_generation_queue_job", {
          p_id:          row.id,
          p_attempts:    attempts,
          p_retry_after: retryAfter,
          p_error:       errorPayload,
        });
        console.log(`[queue-worker] Requeued ${row.id} after ${delay / 1000}s (attempt ${attempts}/${maxAttempts})`);
      } else {
        await sb.from("generation_queue").update({
          status:    "failed",
          attempts,
          error:     errorPayload,
          failed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
      }
    }
  }
}

/* ─── PHASE 2: Claim and dispatch new queue jobs ─── */
async function dispatchQueuedJobs(sb: any): Promise<{ dispatched: number }> {
  const counts = await getRunwareProcessingCounts(sb);

  const availableSlots = Math.max(0, RUNWARE_TOTAL_MAX - (counts.image + counts.video));
  if (availableSlots === 0) {
    console.log("[queue-worker] All concurrency slots full, skipping dispatch");
    return { dispatched: 0 };
  }

  // Claim up to availableSlots queue jobs
  const { data: jobs, error } = await sb.rpc("claim_generation_queue_jobs", {
    worker_id: WORKER_ID,
    max_jobs:  availableSlots,
  });

  if (error) throw error;
  if (!jobs?.length) return { dispatched: 0 };

  let dispatched = 0;
  const latestCounts = { ...counts };

  for (const qJob of jobs) {
    if (!canStartJob(qJob.task_type, latestCounts)) {
      // Release back to queue — this slot type is full
      await sb.from("generation_queue").update({
        status:      "queued",
        locked_at:   null,
        locked_by:   null,
        retry_after: new Date(Date.now() + 15_000).toISOString(),
        updated_at:  new Date().toISOString(),
      }).eq("id", qJob.id);
      continue;
    }

    try {
      const jobId = await createAndFireJob(sb, qJob);

      // Link job_id to queue row
      await sb.from("generation_queue").update({
        job_id:     jobId,
        updated_at: new Date().toISOString(),
      }).eq("id", qJob.id);

      if (qJob.task_type === "image") latestCounts.image++;
      if (qJob.task_type === "video") latestCounts.video++;
      latestCounts.total++;
      dispatched++;

      console.log(`[queue-worker] Dispatched queue job ${qJob.id} → jobs row ${jobId}`);
    } catch (e: any) {
      console.error(`[queue-worker] Failed to dispatch ${qJob.id}:`, e?.message);

      const attempts    = Number(qJob.attempts ?? 0) + 1;
      const maxAttempts = Number(qJob.max_attempts ?? 5);
      const retryable   = isRetryableConcurrencyError(e) || /504|idle.?timeout/i.test(e?.message ?? "");

      if (retryable && attempts < maxAttempts) {
        await sb.rpc("requeue_generation_queue_job", {
          p_id:          qJob.id,
          p_attempts:    attempts,
          p_retry_after: new Date(Date.now() + retryDelayMs(attempts - 1)).toISOString(),
          p_error:       { message: e?.message ?? "Dispatch failed" },
        });
      } else {
        await sb.from("generation_queue").update({
          status:    "failed",
          attempts,
          error:     { message: e?.message ?? "Dispatch failed" },
          failed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        }).eq("id", qJob.id);
      }
    }
  }

  return { dispatched };
}

/* ─── Create a jobs row + trigger job-worker ─── */
async function createAndFireJob(sb: any, qJob: any): Promise<string> {
  const p          = qJob.payload ?? {};
  const provider   = getProviderLink(p.tool_key);
  if (!provider) throw new Error(`No provider for tool_key: ${p.tool_key}`);

  // plan_code and priority MUST come from the same queue job row — never allow divergence
  const planCode = String(qJob.plan_code ?? "free").toLowerCase().trim();
  const priority = Number(qJob.priority ?? 9);

  console.log("[queue-worker] createAndFireJob", {
    queueJobId: qJob.id,
    planCode,
    priority,
    taskType:   qJob.task_type,
    toolKey:    p.tool_key,
  });

  // Insert directly into jobs table (credits already validated at queue creation time)
  const { data: job, error } = await sb
    .from("jobs")
    .insert({
      user_id:        qJob.user_id,
      type:           qJob.task_type,
      tool_key:       p.tool_key,
      priority,
      plan_code:      planCode,
      provider:       qJob.provider ?? "runware",
      status:         "queued",
      progress:       0,
      attempts:       0,
      max_attempts:   5,
      retry_after:    new Date().toISOString(),
      prompt:         p.prompt ?? null,
      input:          p.input  ?? {},
      settings:       p.settings ?? {},
      charge_credits: p.credits ?? 0,
      charged:        p.charged ?? false,
      project_id:     p.project_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  // Trigger job-worker to process this specific job
  const jobWorkerUrl = `${SUPABASE_URL}/functions/v1/job-worker`;
  const res = await fetch(jobWorkerUrl, {
    method:  "POST",
    headers: {
      "content-type":  "application/json",
      "authorization": `Bearer ${SERVICE_KEY}`,
      "apikey":        SERVICE_KEY,
    },
    body: JSON.stringify({ jobId: job.id }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[queue-worker] job-worker handoff failed (${res.status}): ${text.slice(0, 200)}`);
    // Job still exists in DB — job-worker's cron will eventually pick it up
  }

  return job.id as string;
}

/* ─── Main handler ─── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: "Missing env vars" }, 500);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Phase 1: Sync completed/failed jobs → update queue rows
    await syncCompletedJobs(sb);

    // Phase 2: Dispatch new queued jobs within concurrency limits
    const { dispatched } = await dispatchQueuedJobs(sb);

    return json({ ok: true, dispatched, worker: WORKER_ID });
  } catch (e: any) {
    console.error("[queue-worker] Unhandled error:", e?.message);
    return json({ ok: false, error: e?.message ?? "Unknown error" }, 500);
  }
});
