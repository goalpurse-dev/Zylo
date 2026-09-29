// Ops: re-queue a render job that failed for an infrastructure reason (e.g.
// the storage upload limit), keeping its inputs and — on the same machine —
// its finished segments. Resets the attempt counter; the project goes back
// to 'rendering'. Usage: deno run -A scripts/requeueRenderJob.ts <jobId> "<why>"
import { admin } from "./lib/v2Runner.ts";
const [jobId, why] = Deno.args;
if (!jobId || !why) throw new Error("usage: requeueRenderJob.ts <jobId> <reason>");
const { data: job, error } = await admin.from("long_form_render_jobs").select("id,project_id,status,error_code").eq("id", jobId).single();
if (error || !job) throw new Error(`job not found: ${error?.message}`);
if (job.status !== "failed") throw new Error(`job is ${job.status}, not failed`);
await admin.from("long_form_render_jobs").update({ status: "queued", attempt: 0, finished_at: null, user_reason: null, error_code: `requeued: ${why}`.slice(0, 120), updated_at: new Date().toISOString() }).eq("id", jobId);
await admin.from("long_form_projects").update({ status: "rendering", status_reason: null }).eq("id", job.project_id);
console.log(`re-queued ${jobId} (was: ${job.error_code})`);
