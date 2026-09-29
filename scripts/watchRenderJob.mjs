// Prints a line whenever a render job's status/stage (or progress bucket) changes; exits on done/failed.
//   node --env-file=.env.local scripts/watchRenderJob.mjs <jobId>
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const id = process.argv[2];
let last = "";
const t0 = Date.now();
for (;;) {
  const { data: j } = await admin.from("long_form_render_jobs").select("status, stage, worker_id, segments_done, segments_total, error_code, user_reason, compute_seconds").eq("id", id).maybeSingle();
  if (j) {
    const pct = j.segments_total ? Math.floor((j.segments_done / j.segments_total) * 4) * 25 : 0;
    const key = `${j.status}|${j.stage}|${pct}|${j.worker_id ?? ""}`;
    if (key !== last) { console.log(`${Math.round((Date.now() - t0) / 1000)}s ${j.status} ${j.stage ?? ""} ${j.segments_done ?? 0}/${j.segments_total ?? "?"} ${j.worker_id ?? ""} ${j.error_code ?? ""} ${j.user_reason ?? ""}`); last = key; }
    if (j.status === "done" || j.status === "failed") process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 20000));
}
