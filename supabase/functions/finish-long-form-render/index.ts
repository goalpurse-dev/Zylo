// deno-lint-ignore-file no-explicit-any
// finish-long-form-render/index.ts — internal, service-key only (Phase 5b).
// The render worker calls this ONCE at the end of a job:
//   done   -> job done, project 'complete' (+ final video paths, duration,
//             thumbnail = the first beat's image), reservation SETTLED here
//             (render completion is now the last real stage).
//   failed -> job failed, project 'failed' + a user-facing reason (resumable:
//             a new render job continues from the same inputs); the
//             reservation is released only for a terminal failure before any
//             spend, otherwise kept (renderBillingDecision).
// Also records the render's compute cost (seconds x machine rate) in the cost
// ledger, stage "render". Idempotent: a finished job is returned unchanged.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { recordCost } from "../_shared/costLedger.ts";
import { applyRenderBilling } from "../_shared/longFormReservations.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, { auth: { persistSession: false } });
const BUCKET = "long-form-renders";
const THUMBNAIL_URL_SECONDS = 365 * 24 * 3600;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return err(req, "Unauthorized", 401);
  const b = await req.json().catch(() => ({}));
  if (!b?.jobId || !["done", "failed"].includes(b?.outcome)) return err(req, "jobId and outcome (done|failed) required", 400);

  const { data: job, error } = await admin.from("long_form_render_jobs").select("*").eq("id", b.jobId).maybeSingle();
  if (error || !job) return err(req, "job not found", 404);
  if (job.status === "done" || job.status === "failed") return ok(req, { ok: true, idempotent: true, job });

  const now = new Date().toISOString();
  // Compute cost first: it was spent whatever the outcome.
  if (Number(b.computeSeconds) > 0) {
    await recordCost(admin, {
      projectId: job.project_id, stage: "render", provider: b.host ?? "render-worker", model: b.machine ?? null,
      units: { calls: 1, seconds: Number(b.computeSeconds) }, usd: Number(b.computeUsd ?? 0), estimated: b.computeUsdEstimated !== false,
      sourceTable: "long_form_render_jobs", sourceId: job.id,
    });
  }

  if (b.outcome === "done") {
    const thumb = b.thumbnailPath ? await admin.storage.from(BUCKET).createSignedUrl(b.thumbnailPath, THUMBNAIL_URL_SECONDS) : null;
    await admin.from("long_form_render_jobs").update({
      status: "done", finished_at: now, updated_at: now, output_path: b.outputPath, proxy_path: b.proxyPath,
      duration_ms: b.durationMs, size_bytes: b.sizeBytes, proxy_size_bytes: b.proxySizeBytes, master_path: b.masterPath ?? null, master_size_bytes: b.masterSizeBytes ?? null, checks: b.checks ?? null,
      compute_seconds: b.computeSeconds ?? null, compute_usd: b.computeUsd ?? null, error_code: null, user_reason: null,
    }).eq("id", job.id);
    await admin.from("long_form_projects").update({
      status: "complete", status_reason: null, final_video_path: b.outputPath, final_video_proxy_path: b.proxyPath, final_video_master_path: b.masterPath ?? null,
      final_duration_ms: b.durationMs, final_thumbnail_url: thumb?.data?.signedUrl ?? null, current_render_job_id: job.id,
    }).eq("id", job.project_id);
    const billing = await applyRenderBilling(admin, job.project_id, "done", true, logEvent);
    await logEvent("finish-long-form-render", "info", "render_complete", { jobId: job.id, projectId: job.project_id, billing: billing.decision });
    return ok(req, { ok: true, billing: billing.decision });
  }

  const terminal = b.terminal === true || job.attempt >= job.max_attempts;
  const userReason = String(b.userReason ?? "The video couldn't be rendered. Your images and narration are saved — try rendering again.").slice(0, 300);
  await admin.from("long_form_render_jobs").update({
    status: "failed", finished_at: now, updated_at: now, error_code: String(b.errorCode ?? "RENDER_FAILED").slice(0, 120), user_reason: userReason,
    compute_seconds: b.computeSeconds ?? null, compute_usd: b.computeUsd ?? null, checks: b.checks ?? null,
  }).eq("id", job.id);
  // Phase 6f: a failed render of an EDIT (EDL v2) never marks the project failed —
  // the edit and every earlier render are intact; the Publish page offers a free Retry.
  const editRender = job.edl?.version === "STICKMAN_EDL_V2";
  await admin.from("long_form_projects").update({ ...(editRender ? {} : { status: "failed" }), status_reason: userReason, current_render_job_id: job.id }).eq("id", job.project_id);
  const billing = await applyRenderBilling(admin, job.project_id, "failed", terminal, logEvent);
  await logEvent("finish-long-form-render", "error", "render_failed", { jobId: job.id, projectId: job.project_id, errorCode: b.errorCode, terminal, billing: billing.decision });
  return ok(req, { ok: true, billing: billing.decision });
});
