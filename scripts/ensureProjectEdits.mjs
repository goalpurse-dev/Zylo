// $0: makes sure every Long Form project with finished scenes has an edit, and
// that the edit shows the scenes' current pictures (deployed long-form-edit,
// action "ensure"). Nothing is rendered, written by a model or charged.
//   node --env-file=.env.local scripts/ensureProjectEdits.mjs            # list what would change
//   node --env-file=.env.local scripts/ensureProjectEdits.mjs --apply    # do it
//   ... [projectId ...] limits it to those projects
import { createClient } from "@supabase/supabase-js";
import { ensureProjectEdit } from "./lib/ensureProjectEdit.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const only = args.filter((a) => !a.startsWith("--"));
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = async (build) => { const out = []; for (let from = 0; ; from += 1000) { const { data, error } = await build().range(from, from + 999); if (error) throw new Error(error.message); out.push(...data); if (data.length < 1000) return out; } };

const scenes = await all(() => admin.from("long_form_scene_images").select("project_id, beat_plan_version_id, beat_sequence, status, image_url, created_at").eq("is_current", true).order("id"));
const byProject = new Map();
for (const s of scenes) { if (!byProject.has(s.project_id)) byProject.set(s.project_id, []); byProject.get(s.project_id).push(s); }
for (const [projectId, list] of byProject) {
  if (only.length && !only.some((p) => projectId.startsWith(p))) continue;
  const { data: project } = await admin.from("long_form_projects").select("id, user_id, autopilot, deleted_at").eq("id", projectId).maybeSingle();
  if (!project || project.deleted_at) continue;
  const planId = project.autopilot?.scenes?.planId ?? [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].beat_plan_version_id;
  const cur = list.filter((s) => s.beat_plan_version_id === planId);
  const { count: beats } = await admin.from("long_form_beats").select("sequence", { count: "exact", head: true }).eq("beat_plan_version_id", planId);
  const ready = cur.filter((s) => s.status === "ready").length;
  const { data: edit } = await admin.from("long_form_edits").select("version, doc").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
  const bySeq = new Map(cur.map((s) => [s.beat_sequence, s]));
  const stale = (edit?.doc?.clips ?? []).filter((c) => !c.uploaded && !c.needsImage && !c.splitFrom && bySeq.get(c.beatSequence)?.status === "ready" && bySeq.get(c.beatSequence).image_url !== c.image).length;
  const state = !edit ? (ready === beats && beats > 0 ? "NO EDIT" : "no edit (scenes not finished)") : stale ? `STALE (${stale} clips on an old picture)` : "ok";
  const needs = state === "NO EDIT" || state.startsWith("STALE");
  let result = null;
  if (needs && apply) result = await ensureProjectEdit(projectId);
  console.log(JSON.stringify({ project: projectId, user: project.user_id.slice(0, 8), scenes: `${ready}/${beats}`, edit: edit ? `v${edit.version}` : null, state, ...(result ? { result } : needs ? { wouldFix: true } : {}) }));
}
