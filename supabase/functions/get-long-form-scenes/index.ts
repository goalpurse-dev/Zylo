// deno-lint-ignore-file no-explicit-any
// get-long-form-scenes/index.ts — user-facing (Phase 6c). Display only.
// What the Scenes page polls: the run's progress (stage, server clock, ETA
// range from measured timings, "N of M drawn") while it builds, and the full
// scene list for review (grouped by script chapter; each scene's times, exact
// narration line, one-line summary, image, editable text layer and warnings
// in plain words — never ids of the pipeline, prompts or warning codes).
// POST { projectId }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { decideScenes, plainWarnings, plainNames, sceneCredits, sceneSummary, segmentForWord, tierOf, SCENES_STAGES, FAILED_SCENES_COPY, type ScenesRecord } from "../_shared/stickman/scenes.ts";
import { loadScenesInput } from "../_shared/stickman/scenesState.ts";
import { duplicateScenes } from "../_shared/stickman/imageChecks.ts";
import { motionFor } from "../_shared/stickman/edl.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const humanize = (s: string) => String(s ?? "").replace(/^s\d+_/, "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);
  const { data: project } = await admin.from("long_form_projects").select("id, user_id, autopilot, current_script_version_id, selected_title, included_manual_tts_regenerations").eq("id", projectId).maybeSingle();
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  const now = new Date().toISOString();
  const ap = project.autopilot ?? {};
  const sc: ScenesRecord | null = ap.phase === "scenes" ? ap.scenes ?? null : null;
  const { data: profile } = await admin.from("long_form_generation_profiles").select("id, render_tier").eq("project_id", projectId).eq("status", "active").maybeSingle();
  const tier = tierOf(profile?.render_tier);

  // Progress (only while a Scenes run exists).
  let run: any = null;
  let planId: string | null = sc?.planId ?? null;
  if (sc) {
    const { input } = await loadScenesInput(admin, projectId, project, sc, now);
    const d = decideScenes(input);
    planId = planId ?? input.plan?.id ?? null;
    const uiStage = d.stage === "done" ? "done" : d.stage === "drawing" ? (d.total && d.drawn >= d.total - input.images.failed ? "finishing" : "drawing") : "beats";
    run = {
      status: sc.status, regenerating: !!(sc as any).regenerating, stage: uiStage, stages: SCENES_STAGES, startedAt: sc.startedAt, serverNow: now,
      etaSeconds: d.etaSeconds, drawn: d.drawn, total: d.total, failedScenes: input.images.failed,
      failed: sc.status === "failed" ? { message: FAILED_SCENES_COPY } : null,
    };
  }
  // The review list: the run's plan, else the newest plan that has scene images (e.g. an older project).
  if (!planId) {
    const { data: any1 } = await admin.from("long_form_scene_images").select("beat_plan_version_id, created_at").eq("project_id", projectId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    planId = any1?.beat_plan_version_id ?? null;
  }
  const { data: narrationRow } = profile ? await admin.from("long_form_narration_audio_versions").select("audio_url, audio_duration_seconds").eq("project_id", projectId).eq("generation_profile_id", profile.id).in("status", ["ready", "alignment_failed"]).order("version", { ascending: false }).limit(1).maybeSingle() : { data: null };
  if (!planId) return ok(req, { run, sections: [], scenes: [], tier, creditsPerScene: sceneCredits(tier), audio: narrationRow ? { url: narrationRow.audio_url, durationSeconds: Number(narrationRow.audio_duration_seconds) } : null });

  const [{ data: beats }, { data: images }, { data: script }] = await Promise.all([
    admin.from("long_form_beats").select("sequence, start_word, start_ms, end_ms, narration_text, contract, warnings").eq("beat_plan_version_id", planId).order("sequence"),
    admin.from("long_form_scene_images").select("id, beat_sequence, status, image_url, overlay, overlay_text, warnings, description_override, version, source, ready_at, qa").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("is_current", true),
    admin.from("long_form_script_versions").select("script_document").eq("id", project.current_script_version_id).maybeSingle(),
  ]);
  const { data: planRow } = await admin.from("long_form_beat_plan_versions").select("production_bible_id").eq("id", planId).maybeSingle();
  const { data: bibleRow } = planRow ? await admin.from("long_form_production_bibles").select("bible").eq("id", planRow.production_bible_id).maybeSingle() : { data: null };
  const bible = bibleRow?.bible ?? null;
  const doc = script?.script_document ?? {};
  const segments = doc.narrationSegments ?? [];
  const chapterTitle = new Map<string, string>((doc.chapters ?? []).map((c: any) => [c.id ?? c.chapterId, c.title ?? humanize(c.id ?? "")]));
  const imgBySeq = new Map((images ?? []).map((i: any) => [i.beat_sequence, i]));
  // True near-duplicates only (image difference hash), never "similar subject nearby".
  const dups = duplicateScenes((images ?? []).filter((i: any) => i.status === "ready").map((i: any) => ({ n: i.beat_sequence, hash: i.qa?.dhash })));
  // Small WebP thumbnails through Supabase image transforms (the full image opens on click).
  // Width AND height with resize=contain: a width-only transform keeps the source height and
  // centre-crops (a 640-wide "thumbnail" came back 640x1080 portrait) — scenes are never cropped.
  // The cache key carries the image version: a redrawn scene is never served from a stale cache.
  const thumb = (url: string | null, w: number, v?: number | null) => (url && url.includes("/storage/v1/object/public/") ? `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=${w}&height=${Math.round((w * 9) / 16)}&resize=contain&quality=72${v != null ? `&v=${v}` : ""}` : url);
  const scenes = (beats ?? []).map((b: any, i: number) => {
    const img: any = imgBySeq.get(b.sequence) ?? null;
    const seg = segmentForWord(segments, b.start_word ?? 0);
    const warnings = plainWarnings([...(b.warnings ?? []), ...(img?.warnings ?? []), ...(img?.status === "failed" ? ["image_failed"] : []), ...(dups.has(b.sequence) ? ["duplicate"] : [])]);
    const textIntent = b.contract?.textIntent ?? {};
    return {
      key: img?.id ?? `beat-${b.sequence}`, sceneId: img?.id ?? null, number: b.sequence, startMs: b.start_ms, endMs: b.end_ms,
      narration: b.narration_text, summary: plainNames(sceneSummary(b.contract, img?.description_override), bible),
      imageUrl: img?.status === "ready" ? img.image_url : null, thumbUrl: img?.status === "ready" ? thumb(img.image_url, 640, img.version) : null, playerUrl: img?.status === "ready" ? thumb(img.image_url, 1920, img.version) : null, status: img?.status ?? "queued", version: img?.version ?? 1,
      // The same camera motion the renderer uses (edl.motionFor), so the browser player matches the render.
      motion: motionFor(b.contract?.motionIntent?.camera, i, { durationMs: (b.end_ms ?? 0) - (b.start_ms ?? 0), hasOverlay: !!img?.overlay }),
      overlay: img?.overlay ?? null, overlayText: img?.overlay_text ?? (textIntent.mode === "SHORT_TEXT" ? textIntent.text : null),
      warnings, flagged: warnings.length > 0, edited: img?.source === "edit_description",
      section: chapterTitle.get(seg?.chapterId) ?? humanize(seg?.chapterId ?? "Scenes"),
    };
  });
  const sections: { title: string; count: number }[] = [];
  for (const s of scenes) { const last = sections[sections.length - 1]; if (last?.title === s.section) last.count++; else sections.push({ title: s.section, count: 1 }); }
  // Runware balance guard: scenes waiting while drawing is paused (never failed).
  const { data: guard } = await admin.from("provider_balance_guard").select("paused").eq("provider", "runware").maybeSingle();
  const drawingPaused = !!guard?.paused && scenes.some((s: any) => s.status === "queued");
  return ok(req, {
    run, tier, creditsPerScene: sceneCredits(tier), sections, scenes, drawingPaused,
    counts: { scenes: scenes.length, drawn: scenes.filter((s: any) => s.imageUrl).length, flagged: scenes.filter((s: any) => s.flagged).length },
    audio: narrationRow ? { url: narrationRow.audio_url, durationSeconds: Number(narrationRow.audio_duration_seconds) } : null,
    title: project.selected_title ?? null,
  });
});
