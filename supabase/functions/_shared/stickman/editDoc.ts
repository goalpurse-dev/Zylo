// deno-lint-ignore-file no-explicit-any
// stickman/editDoc.ts — the project's CURRENT edit, made sure of server-side.
//
// The edit document (src/lib/stickmanEdit.js) is what the editor edits and the
// renderer renders. It used to exist only after the editor page had opened and
// saved it, so Publish told people to "open the editor first" — and a project
// whose first edit failed validation never got one at all. ensureEdit() is the
// one place that settles it, for the editor (long-form-edit), the render
// (long-form-render), the YouTube text (long-form-youtube-text) and scripts:
//   - no edit yet            -> built from the current scenes and SAVED (v1)
//   - a new voiceover        -> re-timed to its words (pictures kept), saved
//   - a scene was redrawn    -> its clip shows the CURRENT picture, saved
// The user's own work (texts, cuts, motion, captions, music, uploads, split
// halves) is never touched.
import { buildInitialEdit, flattenWords, retimeToWords } from "../../../../src/lib/stickmanEdit.js";
import { fillCenterFlatness } from "./flatness.ts";
import { logEvent } from "../systemLog.ts";

export async function planIdOf(admin: any, project: any): Promise<string | null> {
  const planId: string | null = project.autopilot?.scenes?.planId ?? null;
  if (planId) return planId;
  return (await admin.from("long_form_scene_images").select("beat_plan_version_id").eq("project_id", project.id).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.beat_plan_version_id ?? null;
}

export type EnsuredEdit =
  | { ok: true; doc: any; version: number; created: boolean; resynced: number; relinked: number; retimed: boolean; words: any[]; narr: any; planId: string }
  | { ok: false; status: number; message: string };

// project: { id, user_id, autopilot }. `editor`: the editor is opening it, so
// small housekeeping (a re-linked scene id, picture stats) is saved too; a
// render or a script only saves a change that alters the video.
export async function ensureEdit(admin: any, project: any, opts: { createdBy?: string | null; editor?: boolean; source?: string } = {}): Promise<EnsuredEdit> {
  const projectId = project.id;
  const source = opts.source ?? "long-form-edit";
  const planId = await planIdOf(admin, project);
  if (!planId) return { ok: false, status: 409, message: "This video has no scenes yet." };
  const { data: narr } = await admin.from("long_form_narration_audio_versions").select("id, audio_url, audio_duration_seconds, narration, voice_id, credits_charged, created_at").eq("project_id", projectId).in("status", ["ready", "alignment_failed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!narr) return { ok: false, status: 409, message: "This video has no voiceover yet." };
  const words = flattenWords(narr.narration);
  const audio = { url: narr.audio_url, durationMs: Math.round(Number(narr.audio_duration_seconds) * 1000) };
  const { data: latest } = await admin.from("long_form_edits").select("version, doc, created_at").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
  let doc = latest?.doc ?? null, retimed = false, created = false;
  if (!doc) {
    const [{ data: beats }, { data: imgs }] = await Promise.all([
      admin.from("long_form_beats").select("sequence, start_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence"),
      admin.from("long_form_scene_images").select("id, beat_sequence, version, status, image_url, overlay").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("is_current", true),
    ]);
    const img = new Map((imgs ?? []).map((i: any) => [i.beat_sequence, i]));
    const scenes = (beats ?? []).map((b: any) => { const i: any = img.get(b.sequence); return { sceneId: i?.id ?? null, imageVersion: i?.version ?? null, number: b.sequence, startMs: b.start_ms, narration: b.narration_text, imageUrl: i?.status === "ready" ? i.image_url : null, overlay: i?.overlay ?? null, camera: b.contract?.motionIntent?.camera ?? null }; });
    if (!scenes.length) return { ok: false, status: 409, message: "This video has no scenes yet." };
    if (scenes.some((s: any) => !s.imageUrl)) return { ok: false, status: 409, message: "Some scenes are still being drawn. Open Edit when they're done." };
    // A new edit starts on the camera Mix (seeded by the project id: preview == render).
    const sidesInit: Record<number, string> = {};
    const revealsInit: number[] = [];
    for (const b of beats ?? []) {
      const side = (b.contract?.subjects ?? []).map((x: any) => x.position).find((v: any) => v === "left" || v === "right");
      if (side) sidesInit[b.sequence] = side;
      if (b.contract?.textIntent?.category === "REVEAL") revealsInit.push(b.sequence);
    }
    doc = buildInitialEdit({ scenes, words, audio, narrationId: narr.id, seed: projectId, reveals: revealsInit, sides: sidesInit });
    created = true;
  } else if (doc.audio?.narrationId && doc.audio.narrationId !== narr.id) {
    // A new voiceover: the cuts follow the words, the pictures stay.
    doc = retimeToWords(doc, words, audio, narr.id);
    retimed = true;
  }
  // Every clip shows its scene's CURRENT picture: a clip names its scene (beat)
  // + image version and is resolved here — a scene redrawn on the Scenes page,
  // by a repair script or anywhere else replaces the old picture. The user's
  // own uploads and a split half's own picture are left alone.
  const { data: current } = await admin.from("long_form_scene_images").select("id, beat_sequence, version, status, image_url").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("is_current", true);
  const cur = new Map((current ?? []).map((s: any) => [s.beat_sequence, s]));
  let resynced = 0, relinked = 0;
  doc = { ...doc, clips: doc.clips.map((c: any) => {
    if (c.uploaded || c.needsImage || c.splitFrom) return c;
    const s: any = cur.get(c.beatSequence);
    if (!s || s.status !== "ready" || !s.image_url) return c;
    if (s.image_url === c.image && s.id === c.sceneId && s.version === c.imageVersion) return c;
    if (s.image_url !== c.image) resynced++; else relinked++;
    return { ...c, image: s.image_url, sceneId: s.id, imageVersion: s.version };
  }) };
  // Each picture's centre flatness (a Zoom punch never dives into blank white):
  // measured for a new edit and when the editor opens one.
  const measured = created || opts.editor ? await fillCenterFlatness(doc.clips) : 0;
  let version = latest?.version ?? 0;
  const save = created || resynced > 0 || retimed || (opts.editor === true && (relinked > 0 || measured > 0));
  if (save) {
    const { error: saveErr } = await admin.from("long_form_edits").insert({ project_id: projectId, version: version + 1, doc, narration_id: doc.audio?.narrationId ?? null, created_by: opts.createdBy ?? project.user_id ?? null });
    if (!saveErr) {
      version++;
      if (created || resynced || retimed) await logEvent(source, "info", created ? "edit_created" : "edit_resynced", { projectId, created, resynced, relinked, retimed, version, clips: doc.clips.length });
    } else if (/duplicate|unique/i.test(saveErr.message ?? "")) {
      // Another request saved this version a moment ago (Publish starts the render
      // and the YouTube text together): use what is there.
      const { data: now } = await admin.from("long_form_edits").select("version, doc").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
      if (now) { doc = now.doc; version = now.version; created = false; }
    } else if (created) {
      await logEvent(source, "error", "edit_create_failed", { projectId, message: saveErr.message });
      return { ok: false, status: 500, message: "Couldn't prepare this video's edit. Try again in a moment." };
    }
  }
  return { ok: true, doc, version, created, resynced, relinked, retimed, words, narr, planId };
}
