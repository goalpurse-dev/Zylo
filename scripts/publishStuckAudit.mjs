// $0, READ-ONLY: which Long Form projects can't get through Publish?
// For every project with drawn scenes: is there a saved edit, does it show the
// scenes' CURRENT pictures, are all scenes ready, is there a render, and what
// did the edit / render / publish functions log for it.
//   node --env-file=.env.local scripts/publishStuckAudit.mjs [projectIdPrefix]
import { createClient } from "@supabase/supabase-js";

const only = process.argv[2] ?? null;
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = async (build) => { const out = []; for (let from = 0; ; from += 1000) { const { data, error } = await build().range(from, from + 999); if (error) throw new Error(error.message); out.push(...data); if (data.length < 1000) return out; } };

const scenes = await all(() => admin.from("long_form_scene_images").select("id, project_id, beat_plan_version_id, beat_sequence, version, status, image_url, created_at, source").eq("is_current", true).order("id"));
const byProject = new Map();
for (const s of scenes) { if (!byProject.has(s.project_id)) byProject.set(s.project_id, []); byProject.get(s.project_id).push(s); }
const rows = [];
for (const [projectId, list] of byProject) {
  if (only && !projectId.startsWith(only)) continue;
  const { data: project } = await admin.from("long_form_projects").select("id, user_id, status, topic, autopilot, deleted_at, updated_at").eq("id", projectId).maybeSingle();
  if (!project || project.deleted_at) continue;
  // The plan the app uses (autopilot's, else the newest current scene's).
  const planId = project.autopilot?.scenes?.planId ?? [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].beat_plan_version_id;
  const cur = list.filter((s) => s.beat_plan_version_id === planId);
  const { count: beats } = await admin.from("long_form_beats").select("sequence", { count: "exact", head: true }).eq("beat_plan_version_id", planId);
  const { data: edit } = await admin.from("long_form_edits").select("version, doc, created_at").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
  const { data: narr } = await admin.from("long_form_narration_audio_versions").select("id, status").eq("project_id", projectId).in("status", ["ready", "alignment_failed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: jobs } = await admin.from("long_form_render_jobs").select("status, edit_version, resolution, created_at").eq("project_id", projectId).is("parent_job_id", null).order("created_at", { ascending: false }).limit(3);
  const { data: meta } = await admin.from("long_form_publish_meta").select("title").eq("project_id", projectId).maybeSingle();
  const { count: thumbs } = await admin.from("long_form_thumbnails").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const curBySeq = new Map(cur.map((s) => [s.beat_sequence, s]));
  let stale = 0, needsImage = 0;
  for (const c of edit?.doc?.clips ?? []) {
    if (c.needsImage) needsImage++;
    if (c.uploaded || c.needsImage || c.splitFrom) continue;
    const s = curBySeq.get(c.beatSequence);
    if (s && s.status === "ready" && s.image_url && s.image_url !== c.image) stale++;
  }
  const notReady = cur.filter((s) => s.status !== "ready");
  rows.push({
    project: projectId.slice(0, 8), user: project.user_id.slice(0, 8), status: project.status, autopilot: project.autopilot?.status ?? null,
    beats, scenes: cur.length, notReady: notReady.length, notReadyStatuses: [...new Set(notReady.map((s) => s.status))].join("/") || null,
    narration: narr ? narr.status : "none",
    edit: edit ? `v${edit.version}` : "NONE", editNarrationOk: edit ? edit.doc?.audio?.narrationId === narr?.id : null, staleClips: stale, needsImage,
    render: (jobs ?? []).map((j) => `${j.status}@v${j.edit_version}`).join(",") || "none", text: !!meta?.title, thumbs: thumbs ?? 0,
    redrawn: cur.filter((s) => s.version > 1).length,
  });
}
rows.sort((a, b) => (a.edit === "NONE" ? -1 : 1) - (b.edit === "NONE" ? -1 : 1));
for (const r of rows) console.log(JSON.stringify(r));

// What the functions logged recently for these flows.
const since = new Date(Date.now() - 6 * 86_400_000).toISOString();
const { data: logs, error } = await admin.from("system_logs").select("*").in("source", ["long-form-publish-start", "long-form-edit", "long-form-render"]).gte("created_at", since).order("created_at", { ascending: false }).limit(60);
if (error) console.log("system_logs:", error.message);
else {
  console.log("log columns:", Object.keys(logs[0] ?? {}).join(","));
  for (const l of logs.filter((x) => x.level !== "info" || /publish_autopilot/.test(JSON.stringify(x))).slice(0, 25)) console.log(l.created_at.slice(0, 16), l.source, l.level, JSON.stringify(l.context ?? l.payload ?? l.details ?? l.message ?? "").slice(0, 330));
}
