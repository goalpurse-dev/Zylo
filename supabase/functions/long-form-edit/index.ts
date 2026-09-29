// deno-lint-ignore-file no-explicit-any
// long-form-edit/index.ts — user-facing (Phase 6d-1). The Edit step's document
// (src/lib/stickmanEdit.js): the single source of truth the editor edits and
// the render worker renders.
//   get           — the newest version (built from the Scenes step on first
//                   open; re-timed to a new voiceover, pictures kept) + the
//                   word timings, the voice, the script with its fact checks.
//   save          — autosave: validated, versioned (conflict-checked).
//   upload        — "Upload my own image" (centre 16:9 crop, upscaled when
//                   small, 1920x1080) or a music track (the user confirms the
//                   rights; stored with the project).
//   split_generate — the new half of a split gets its own picture: a new
//                   version of the source scene drawn from its narration
//                   (credits per scene, like Regenerate; dryRun prices it).
//   scene_status  — poll that picture.
// POST { projectId, action, ... }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { buildInitialEdit, flattenWords, retimeToWords, validateEdit, EDIT_VERSION } from "../../../src/lib/stickmanEdit.js";
import { sceneCredits, tierOf, segmentForWord } from "../_shared/stickman/scenes.ts";
import { IP_MARKS, IP_LOOKALIKE } from "../_shared/stickman/beatDirector.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { fillCenterFlatness } from "../_shared/stickman/flatness.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("LONG_FORM_AUTOPILOT_SECRET") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const KEEP_VERSIONS = 100;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024, MAX_MUSIC_BYTES = 15 * 1024 * 1024;
const MUSIC_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/ogg"];

const b64ToBytes = (s: string) => Uint8Array.from(atob(String(s).replace(/^data:[^,]*,/, "")), (c) => c.charCodeAt(0));
const runware = async (task: any) => {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
  const j: any = await r.json().catch(() => null);
  if (!j?.ok) throw new Error(`runware ${r.status}`);
  return j as { result: { imageURL: string; cost: number | null } };
};

// Any object in the research document with this fact id (its source).
function findFact(node: any, id: string, depth = 0): any {
  if (!node || depth > 6 || typeof node !== "object") return null;
  if (!Array.isArray(node) && node.id === id) return node;
  for (const v of Array.isArray(node) ? node : Object.values(node)) { const f = findFact(v, id, depth + 1); if (f) return f; }
  return null;
}

async function planIdOf(project: any, projectId: string) {
  const ap = project.autopilot ?? {};
  let planId: string | null = ap.scenes?.planId ?? null;
  if (!planId) planId = (await admin.from("long_form_scene_images").select("beat_plan_version_id").eq("project_id", projectId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.beat_plan_version_id ?? null;
  return planId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const action = String(body?.action ?? "");
  if (!projectId || !["get", "save", "upload", "split_generate", "scene_status"].includes(action)) return err(req, "Bad request", 400);
  const { data: project } = await admin.from("long_form_projects").select("id, user_id, autopilot, current_script_version_id, selected_title").eq("id", projectId).maybeSingle();
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  // ---------------- get ----------------
  if (action === "get") {
    const planId = await planIdOf(project, projectId);
    if (!planId) return err(req, "This video has no scenes yet.", 409);
    const { data: profile } = await admin.from("long_form_generation_profiles").select("id, voice_id, render_tier").eq("project_id", projectId).eq("status", "active").maybeSingle();
    const { data: narr } = await admin.from("long_form_narration_audio_versions").select("id, audio_url, audio_duration_seconds, narration, voice_id, credits_charged, created_at").eq("project_id", projectId).in("status", ["ready", "alignment_failed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!narr) return err(req, "This video has no voiceover yet.", 409);
    const words = flattenWords(narr.narration);
    const audio = { url: narr.audio_url, durationMs: Math.round(Number(narr.audio_duration_seconds) * 1000) };
    const { data: latest } = await admin.from("long_form_edits").select("version, doc, created_at").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
    let doc = latest?.doc ?? null, retimed = false;
    if (!doc) {
      const [{ data: beats }, { data: imgs }] = await Promise.all([
        admin.from("long_form_beats").select("sequence, start_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence"),
        admin.from("long_form_scene_images").select("id, beat_sequence, version, status, image_url, overlay").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("is_current", true),
      ]);
      const img = new Map((imgs ?? []).map((i: any) => [i.beat_sequence, i]));
      const scenes = (beats ?? []).map((b: any) => { const i: any = img.get(b.sequence); return { sceneId: i?.id ?? null, imageVersion: i?.version ?? null, number: b.sequence, startMs: b.start_ms, narration: b.narration_text, imageUrl: i?.status === "ready" ? i.image_url : null, overlay: i?.overlay ?? null, camera: b.contract?.motionIntent?.camera ?? null }; });
      if (scenes.some((s: any) => !s.imageUrl)) return err(req, "Some scenes are still being drawn. Open Edit when they're done.", 409);
      // A new edit starts on the camera Mix (seeded by the project id: preview == render).
      const sidesInit: Record<number, string> = {};
      const revealsInit: number[] = [];
      for (const b of beats ?? []) {
        const side = (b.contract?.subjects ?? []).map((x: any) => x.position).find((v: any) => v === "left" || v === "right");
        if (side) sidesInit[b.sequence] = side;
        if (b.contract?.textIntent?.category === "REVEAL") revealsInit.push(b.sequence);
      }
      doc = buildInitialEdit({ scenes, words, audio, narrationId: narr.id, seed: projectId, reveals: revealsInit, sides: sidesInit });
    } else if (doc.audio?.narrationId && doc.audio.narrationId !== narr.id) {
      // A new voiceover: the cuts follow the words, the pictures stay.
      doc = retimeToWords(doc, words, audio, narr.id);
      retimed = true;
    }
    // Every clip shows its scene's CURRENT picture: a clip names its scene
    // (beat) + image version, and is resolved here on every open — a scene
    // redrawn on the Scenes page (or anywhere) replaces the old picture; the
    // user's edits (texts, cuts, motion, captions, music) are kept. The
    // user's own uploads and a split half's own picture are left alone.
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
    // Each picture's centre flatness (a Zoom punch never dives into blank white).
    const measured = await fillCenterFlatness(doc.clips);
    let version = latest?.version ?? 0;
    // A changed picture (or a new voiceover) is a new edit version, saved here.
    if (latest && (resynced || relinked || retimed || measured)) {
      const { error: saveErr } = await admin.from("long_form_edits").insert({ project_id: projectId, version: version + 1, doc, narration_id: doc.audio?.narrationId ?? null, created_by: user.id });
      if (!saveErr) version++;
      if (resynced || retimed) await logEvent("long-form-edit", "info", "edit_resynced", { projectId, resynced, relinked, retimed, version });
    }
    // Script + fact checks (read-only panel).
    const { data: script } = await admin.from("long_form_script_versions").select("script_document, research_version_id").eq("id", project.current_script_version_id).maybeSingle();
    const sd = script?.script_document ?? {};
    const { data: research } = script?.research_version_id ? await admin.from("long_form_research_versions").select("*").eq("id", script.research_version_id).maybeSingle() : { data: null };
    const verdict = new Map((sd.claimVerification ?? []).map((v: any) => [v.claimId, v]));
    const claims = (sd.claims ?? []).map((c: any) => {
      const v: any = verdict.get(c.id) ?? {};
      const fact = c.sourceFactId && research ? findFact(research, c.sourceFactId) : null;
      const url = v.url ?? fact?.url ?? fact?.sourceUrl ?? fact?.source?.url ?? null;
      const name = fact?.sourceName ?? fact?.source?.name ?? fact?.publisher ?? fact?.title ?? (v.sourceName && !/research-lite/.test(v.sourceName) ? v.sourceName : null);
      return { id: c.id, segmentId: c.segmentId, sentence: c.sentence, claim: c.claim, verdict: v.verdict ?? null, source: name, url };
    });
    const segById = new Map((sd.narrationSegments ?? []).map((s: any) => [s.id, s]));
    const chapters = (sd.chapters ?? []).map((ch: any) => ({ title: ch.title, segments: (ch.segmentIds ?? []).map((id: string) => ({ id, text: (segById.get(id) as any)?.text ?? "" })) }));
    // Auto mix inputs: each scene's chapter (from the beat plan's first word)
    // and the big reveals (the text pass's REVEAL captions, flagged twists).
    const { data: planBeats } = await admin.from("long_form_beats").select("sequence, start_word, contract").eq("beat_plan_version_id", planId);
    const chapterOfSeg = new Map<string, string>();
    for (const ch of sd.chapters ?? []) for (const id of ch.segmentIds ?? []) chapterOfSeg.set(id, ch.chapterId ?? ch.id ?? ch.title);
    const sections: Record<number, string> = {};
    const reveals: number[] = [];
    const sides: Record<number, string> = {};
    for (const b of planBeats ?? []) {
      const seg: any = segmentForWord(sd.narrationSegments ?? [], b.start_word ?? 0);
      sections[b.sequence] = (seg && (chapterOfSeg.get(seg.id) ?? seg.chapterId)) ?? "main";
      const c = b.contract ?? {};
      if (c.textIntent?.category === "REVEAL" || c.flags?.reveal === true || /reveal|twist/i.test(String(c.flags?.reason ?? c.treatment ?? ""))) reveals.push(b.sequence);
      const side = (c.subjects ?? []).map((x: any) => x.position).find((v: any) => v === "left" || v === "right");
      if (side) sides[b.sequence] = side;
    }
    const { count: rerecords } =await admin.from("long_form_narration_audio_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "ready");
    return ok(req, {
      doc, version, retimed, resynced, words, narrationId: narr.id,
      voice: { voiceId: narr.voice_id ?? profile?.voice_id ?? null, freeRerecordUsed: (rerecords ?? 0) > 1 },
      script: { title: project.selected_title ?? sd.title ?? null, chapters, claims }, sections, reveals, sides,
      tier: tierOf(profile?.render_tier), creditsPerScene: sceneCredits(tierOf(profile?.render_tier)),
    });
  }

  // ---------------- save ----------------
  if (action === "save") {
    const doc = body?.doc;
    const errors = validateEdit(doc);
    if (errors.length) return err(req, "This edit can't be saved.", 422, { errors: errors.slice(0, 10) });
    if (JSON.stringify(doc).length > 3_000_000) return err(req, "This edit is too large.", 413);
    const { data: latest } = await admin.from("long_form_edits").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
    const have = latest?.version ?? 0;
    if (body?.baseVersion != null && Number(body.baseVersion) !== have) return err(req, "This video was changed in another tab. Reload to see the newest edit.", 409, { code: "EDIT_CONFLICT", version: have });
    const { error } = await admin.from("long_form_edits").insert({ project_id: projectId, version: have + 1, doc, narration_id: doc.audio?.narrationId ?? null, created_by: user.id });
    if (error) return err(req, /duplicate/.test(error.message) ? "This video was changed in another tab. Reload to see the newest edit." : "Couldn't save the edit.", /duplicate/.test(error.message) ? 409 : 500, { code: "EDIT_CONFLICT" });
    if (have + 1 > KEEP_VERSIONS) await admin.from("long_form_edits").delete().eq("project_id", projectId).lte("version", have + 1 - KEEP_VERSIONS);
    return ok(req, { ok: true, version: have + 1 });
  }

  // ---------------- upload ----------------
  if (action === "upload") {
    const kind = String(body?.kind ?? "");
    const bytes = b64ToBytes(String(body?.data ?? ""));
    const id = crypto.randomUUID();
    if (kind === "image") {
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return err(req, "Pick a JPG or PNG under 12 MB.", 413);
      let img: Image;
      try { img = await Image.decode(bytes) as Image; } catch { return err(req, "That file isn't a JPG or PNG we can read.", 422); }
      // Centre 16:9 crop (the picture is never stretched).
      const cw = Math.min(img.width, Math.floor((img.height * 16) / 9)), ch = Math.min(img.height, Math.floor((img.width * 9) / 16));
      img.crop(Math.floor((img.width - cw) / 2), Math.floor((img.height - ch) / 2), cw, ch);
      let upscaled = false;
      if (cw < 1600) {
        // The same upscale path as generated scenes (Runware 2x), then 1920x1080.
        const tmp = `long-form/uploads/${projectId}/${id}-src.jpg`;
        await admin.storage.from("generated").upload(tmp, await img.encodeJPEG(95), { contentType: "image/jpeg", upsert: true });
        try {
          const up = await runware({ taskType: "upscale", model: "runware:504@1", upscaleFactor: 2, inputs: { image: admin.storage.from("generated").getPublicUrl(tmp).data.publicUrl }, outputType: "URL", outputFormat: "JPG", outputQuality: 95 });
          img = await Image.decode(new Uint8Array(await (await fetch(up.result.imageURL)).arrayBuffer())) as Image;
          upscaled = true;
          await admin.from("long_form_cost_ledger").insert({ project_id: projectId, stage: "images", provider: "runware", model: "runware:504@1", units: { calls: 1, images: 1, purpose: "uploaded image upscale" }, usd: Number(up.result.cost ?? 0), estimated: false, source_table: "long_form_edits" });
        } catch { /* keep the plain resize */ }
      }
      img.resize(1920, 1080);
      const path = `long-form/uploads/${projectId}/${id}.jpg`;
      await admin.storage.from("generated").upload(path, await img.encodeJPEG(92), { contentType: "image/jpeg", upsert: true });
      await logEvent("long-form-edit", "info", "edit_image_uploaded", { projectId, upscaled });
      return ok(req, { ok: true, url: admin.storage.from("generated").getPublicUrl(path).data.publicUrl, upscaled });
    }
    if (kind === "music") {
      const type = String(body?.contentType ?? "audio/mpeg");
      if (!MUSIC_TYPES.includes(type)) return err(req, "Pick an MP3, M4A, WAV or OGG file.", 422);
      if (!bytes.length || bytes.length > MAX_MUSIC_BYTES) return err(req, "Pick a music file under 15 MB.", 413);
      if (body?.rightsConfirmed !== true) return err(req, "Please confirm you have the rights to use this music.", 422);
      const ext = type.includes("wav") ? "wav" : type.includes("ogg") ? "ogg" : type.includes("mp4") || type.includes("m4a") || type.includes("aac") ? "m4a" : "mp3";
      const path = `long-form/music/${projectId}/${id}.${ext}`;
      await admin.storage.from("generated").upload(path, bytes, { contentType: type, upsert: true });
      await logEvent("long-form-edit", "info", "edit_music_uploaded", { projectId, bytes: bytes.length });
      return ok(req, { ok: true, url: admin.storage.from("generated").getPublicUrl(path).data.publicUrl, name: String(body?.name ?? "My music").slice(0, 80) });
    }
    return err(req, "Bad request", 400);
  }

  // ---------------- split_generate / scene_status ----------------
  if (action === "scene_status") {
    // By id (a split's picture) or by scene number (the current picture after Regenerate / Edit description).
    const planId = body?.beatSequence != null ? await planIdOf(project, projectId) : null;
    const q = admin.from("long_form_scene_images").select("id, version, status, image_url").eq("project_id", projectId);
    const { data: s } = body?.beatSequence != null
      ? await q.eq("beat_plan_version_id", planId).eq("beat_sequence", Number(body.beatSequence)).eq("is_current", true).maybeSingle()
      : await q.eq("id", String(body?.sceneId ?? "")).maybeSingle();
    if (!s) return err(req, "Not found", 404);
    return ok(req, { ok: true, sceneId: s.id, version: s.version, status: s.status, imageUrl: s.status === "ready" ? s.image_url : null });
  }
  if (action === "split_generate") {
    const planId = await planIdOf(project, projectId);
    const beatSequence = Number(body?.beatSequence);
    const narration = String(body?.narration ?? "").replace(/\s+/g, " ").trim();
    if (!planId || !Number.isFinite(beatSequence) || narration.length < 8) return err(req, "Bad request", 400);
    if (IP_MARKS.test(narration) || IP_LOOKALIKE.test(narration)) return err(req, "This line names a brand or a well-known character; describe the picture instead.", 422);
    const { data: profile } = await admin.from("long_form_generation_profiles").select("render_tier").eq("project_id", projectId).eq("status", "active").maybeSingle();
    const tier = tierOf(profile?.render_tier);
    const credits = sceneCredits(tier);
    if (body?.dryRun === true) return ok(req, { ok: true, dryRun: true, credits });
    const { data: last } = await admin.from("long_form_scene_images").select("version").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("beat_sequence", beatSequence).order("version", { ascending: false }).limit(1).maybeSingle();
    const description = `A different moment of the same scene, showing: ${narration}`.slice(0, 400);
    const { data: row, error } = await admin.from("long_form_scene_images").insert({ project_id: projectId, beat_plan_version_id: planId, beat_sequence: beatSequence, version: (last?.version ?? 0) + 1, tier, status: "queued", source: "split", description_override: description, is_current: false }).select("id").single();
    if (error) return err(req, "Couldn't start the new picture.", 500);
    // Drawn now by the scene worker (credits per finished scene, from the reservation).
    fetch(`${SUPABASE_URL}/functions/v1/render-long-form-scene`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, "x-autopilot-secret": SECRET }, body: JSON.stringify({ projectId, userId: user.id, sceneId: row.id }) }).then((r) => r.body?.cancel()).catch(() => {});
    await logEvent("long-form-edit", "info", "edit_split_generate", { projectId, beatSequence, credits });
    return ok(req, { ok: true, sceneId: row.id, credits });
  }
  return err(req, "Bad request", 400);
});

export const _version = EDIT_VERSION;
