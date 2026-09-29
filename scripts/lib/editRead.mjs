// editRead.mjs — READ-ONLY: what long-form-edit "get" returns for a project
// (its newest saved edit, or the first one built from its scenes), with every
// clip resolved to its scene's CURRENT picture — the same rule as the server.
// Used to show a real user's project in the editor without signing in as them
// and without writing anything. Also reports the stale-clip count.
import { buildInitialEdit, flattenWords } from "../../src/lib/stickmanEdit.js";

export function resolveCurrentImages(doc, currentByBeat) {
  let stale = 0, relinked = 0;
  const clips = doc.clips.map((c) => {
    if (c.uploaded || c.needsImage || c.splitFrom) return c;
    const s = currentByBeat.get(c.beatSequence);
    if (!s || s.status !== "ready" || !s.image_url) return c;
    if (s.image_url === c.image && s.id === c.sceneId && s.version === c.imageVersion) return c;
    if (s.image_url !== c.image) stale++; else relinked++;
    return { ...c, image: s.image_url, sceneId: s.id, imageVersion: s.version };
  });
  return { doc: { ...doc, clips }, stale, relinked };
}

export async function loadEditFor(admin, projectId) {
  const { data: p } = await admin.from("long_form_projects").select("autopilot, selected_title").eq("id", projectId).single();
  const planId = p.autopilot.scenes.planId;
  const { data: narr } = await admin.from("long_form_narration_audio_versions").select("id, audio_url, audio_duration_seconds, narration, voice_id").eq("project_id", projectId).in("status", ["ready", "alignment_failed"]).order("created_at", { ascending: false }).limit(1).single();
  const words = flattenWords(narr.narration);
  const { data: current } = await admin.from("long_form_scene_images").select("id, beat_sequence, version, status, image_url, overlay").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("is_current", true);
  const cur = new Map(current.map((s) => [s.beat_sequence, s]));
  const { data: latest } = await admin.from("long_form_edits").select("version, doc").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
  let doc = latest?.doc;
  if (!doc) {
    const { data: beats } = await admin.from("long_form_beats").select("sequence, start_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
    doc = buildInitialEdit({ scenes: beats.map((b) => { const s = cur.get(b.sequence); return { sceneId: s.id, imageVersion: s.version, number: b.sequence, startMs: b.start_ms, narration: b.narration_text, imageUrl: s.image_url, overlay: s.overlay, camera: b.contract?.motionIntent?.camera }; }), words, audio: { url: narr.audio_url, durationMs: Math.round(narr.audio_duration_seconds * 1000) }, narrationId: narr.id });
  }
  const before = doc.clips.filter((c) => !c.uploaded && !c.needsImage && !c.splitFrom && cur.get(c.beatSequence)?.image_url && cur.get(c.beatSequence).image_url !== c.image).length;
  const r = resolveCurrentImages(doc, cur);
  const after = r.doc.clips.filter((c) => !c.uploaded && !c.needsImage && !c.splitFrom && cur.get(c.beatSequence)?.image_url && cur.get(c.beatSequence).image_url !== c.image).length;
  const at16 = r.doc.clips.filter((c) => c.startMs <= 16000).at(-1);
  return { doc: r.doc, version: latest?.version ?? 0, retimed: false, resynced: r.stale, words, narrationId: narr.id, voice: { voiceId: narr.voice_id, freeRerecordUsed: false }, script: { title: p.selected_title, chapters: [], claims: [] }, tier: "V3", creditsPerScene: 4, _check: { savedEditVersion: latest?.version ?? null, staleBefore: before, staleAfter: after, relinked: r.relinked, clipAt16: { scene: at16.beatSequence, image: at16.image.split("/").pop(), imageVersion: at16.imageVersion } } };
}
