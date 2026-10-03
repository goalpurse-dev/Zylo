// Redraws a project's FAILED scenes for free (a scene we failed to draw), the
// same way update-long-form-scene's regenerate does: a new queued version per
// scene (old one kept in history, addon_credits 0) + the scene step marked
// running so the autopilot cron draws them. Waits up to 12 min and reports.
// Paid (provider cost only): ~$0.003 per V2 scene, ~$0.045 per V3 scene.
// Afterwards the project's edit is put on the new pictures (and created if the
// editor was never opened), so Publish and the next render use them.
//   node --env-file=.env.local scripts/redrawFailedScenes.mjs <projectId> [beat,beat,...]
// With a beat list: redraws exactly those current scenes (free), whatever their status.
import { createClient } from "@supabase/supabase-js";
import { ensureProjectEdit } from "./lib/ensureProjectEdit.mjs";

const [P, beatList] = process.argv.slice(2);
const only = beatList ? beatList.split(",").map(Number) : null;
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const since = new Date().toISOString();
let q = admin.from("long_form_scene_images").select("*").eq("project_id", P).eq("is_current", true).order("beat_sequence");
q = only ? q.in("beat_sequence", only) : q.eq("status", "failed");
const { data: failed } = await q;
if (!failed?.length) { console.log("No failed scenes."); process.exit(0); }
const { data: project } = await admin.from("long_form_projects").select("autopilot, deleted_at").eq("id", P).single();
if (project.deleted_at) { console.log("Project is deleted — not redrawing."); process.exit(1); }
for (const old of failed) {
  await admin.from("long_form_scene_images").update({ is_current: false }).eq("id", old.id);
  const { error } = await admin.from("long_form_scene_images").insert({
    project_id: P, beat_plan_version_id: old.beat_plan_version_id, beat_sequence: old.beat_sequence, version: old.version + 1, tier: old.tier, status: "queued",
    source: "regenerate", description_override: old.description_override ?? null, overlay_text: old.overlay_text ?? null, addon_credits: 0,
  });
  if (error) { console.error(old.beat_sequence, error.message); await admin.from("long_form_scene_images").update({ is_current: true }).eq("id", old.id); }
}
const ap = project.autopilot ?? {};
const sc = ap.phase === "scenes" && ap.scenes ? ap.scenes : { startedAt: new Date().toISOString(), resumes: 0, dispatched: {} };
const planId = failed[0].beat_plan_version_id;
await admin.from("long_form_projects").update({ autopilot: { ...ap, status: "running", phase: "scenes", lockUntil: null, scenes: { ...sc, status: "running", planId, regenerating: true, stage: "drawing" } } }).eq("id", P);
console.log(`Queued ${failed.length} free redraws: ${failed.map((f) => f.beat_sequence).join(", ")} (${failed[0].tier}). Waiting for the autopilot…`);
const beats = failed.map((f) => f.beat_sequence);
let rows = [];
for (let i = 0; i < 144; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  ({ data: rows } = await admin.from("long_form_scene_images").select("beat_sequence, status, qa, cost_usd, image_url, error").eq("project_id", P).eq("is_current", true).in("beat_sequence", beats).order("beat_sequence"));
  if (rows.every((r) => r.status === "ready" || r.status === "failed")) break;
}
const { data: led } = await admin.from("long_form_cost_ledger").select("usd").eq("project_id", P).eq("source_table", "long_form_scene_images").gte("created_at", since);
for (const r of rows) console.log(JSON.stringify({ beat: r.beat_sequence, status: r.status, safeFallback: !!r.qa?.safeFallback, failures: r.qa?.failures ?? null, cost: r.cost_usd, error: r.status === "failed" ? (r.qa?.failures ?? r.qa?.error ?? r.error) : null }));
console.log(JSON.stringify({ ready: rows.filter((r) => r.status === "ready").length, of: rows.length, usd: Number((led ?? []).reduce((a, x) => a + Number(x.usd), 0).toFixed(4)) }));
console.log("edit:", JSON.stringify(await ensureProjectEdit(P)));
