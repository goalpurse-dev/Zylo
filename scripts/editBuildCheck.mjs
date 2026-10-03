// $0, READ-ONLY: build a project's first edit exactly as long-form-edit "get"
// does (from the current scenes, beats and voiceover) and run the same
// validation "save" runs. Shows why an editor visit does or doesn't leave a
// saved edit behind.
//   node --env-file=.env.local scripts/editBuildCheck.mjs <projectId> [...]
import { createClient } from "@supabase/supabase-js";
import { buildInitialEdit, flattenWords, validateEdit, MIN_CLIP_MS } from "../src/lib/stickmanEdit.js";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const projectId of process.argv.slice(2)) {
  const { data: project } = await admin.from("long_form_projects").select("id, autopilot").eq("id", projectId).single();
  let planId = project.autopilot?.scenes?.planId ?? null;
  if (!planId) planId = (await admin.from("long_form_scene_images").select("beat_plan_version_id").eq("project_id", projectId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.beat_plan_version_id ?? null;
  const { data: narr } = await admin.from("long_form_narration_audio_versions").select("id, audio_url, audio_duration_seconds, narration").eq("project_id", projectId).in("status", ["ready", "alignment_failed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const words = flattenWords(narr.narration);
  const audio = { url: narr.audio_url, durationMs: Math.round(Number(narr.audio_duration_seconds) * 1000) };
  const [{ data: beats }, { data: imgs }] = await Promise.all([
    admin.from("long_form_beats").select("sequence, start_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence"),
    admin.from("long_form_scene_images").select("id, beat_sequence, version, status, image_url, overlay").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("is_current", true),
  ]);
  const img = new Map(imgs.map((i) => [i.beat_sequence, i]));
  const scenes = beats.map((b) => { const i = img.get(b.sequence); return { sceneId: i?.id ?? null, imageVersion: i?.version ?? null, number: b.sequence, startMs: b.start_ms, narration: b.narration_text, imageUrl: i?.status === "ready" ? i.image_url : null, overlay: i?.overlay ?? null, camera: b.contract?.motionIntent?.camera ?? null }; });
  const missing = scenes.filter((s) => !s.imageUrl).map((s) => s.number);
  let doc = null, errors = [], threw = null;
  try { doc = buildInitialEdit({ scenes, words, audio, narrationId: narr.id, seed: projectId }); errors = validateEdit(doc); } catch (e) { threw = String(e?.message ?? e); }
  const gaps = beats.slice(1).map((b, i) => ({ n: b.sequence, gap: b.start_ms - beats[i].start_ms })).filter((g) => g.gap < MIN_CLIP_MS);
  console.log(JSON.stringify({
    project: projectId.slice(0, 8), planFromAutopilot: !!project.autopilot?.scenes?.planId, beats: beats.length, images: imgs.length, scenesWithoutPicture: missing,
    words: words.length, audioMs: audio.durationMs, threw, clips: doc?.clips.length ?? null, texts: doc?.texts.length ?? null, bytes: doc ? JSON.stringify(doc).length : null,
    validationErrors: errors.slice(0, 12), errorCount: errors.length, shortBeats: gaps.slice(0, 8),
  }));
}
