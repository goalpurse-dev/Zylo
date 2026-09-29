// deno-lint-ignore-file no-explicit-any
// update-long-form-scene/index.ts — user-facing (Phase 6c). The Scenes
// review page's per-scene actions:
//   text        — edit the on-screen words: FREE, edits the text layer only
//                 (re-placed on the image), never re-renders.
//   regenerate  — draw the scene again on the project's tier (credits from
//                 the reservation, shown in the button).
//   describe    — the user's own description becomes the picture, through the
//                 same compiler (style, cast, IP guard), then regenerate.
//   regenerate_flagged — every scene with a warning (total cost shown first).
// dryRun: validate + compile + price, no render and no charge.
// Regenerations run on the autopilot's scene loop (same watchdog: a stalled
// scene is re-queued once, then marked failed — Regenerate stays free then).
// POST { projectId, action, sceneNumber?, description?, text?, dryRun? }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { overlayText, scaleLayer } from "../_shared/stickman/textOverlay.ts";
import { compileBeatPrompt, canonicalSetFromBible, plantFrameFor } from "../_shared/stickman/promptCompiler.ts";
import { compileOptionsFor } from "../_shared/stickman/renderTiers.ts";
import { IP_MARKS, IP_LOOKALIKE } from "../_shared/stickman/beatDirector.ts";
import { plainWarnings, sceneCredits, tierOf } from "../_shared/stickman/scenes.ts";
import { duplicateScenes } from "../_shared/stickman/imageChecks.ts";
import { nudgeAutopilot } from "../_shared/stickman/autopilotNudge.ts";
import { logEvent } from "../_shared/systemLog.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const FONT_URL = `${SUPABASE_URL}/storage/v1/object/public/generated/assets/fonts/LilitaOne-Regular.ttf`;
const fetchBytes = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`fetch ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
const MAX_TEXT_WORDS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const action = String(body?.action ?? "");
  const dryRun = body?.dryRun === true;
  if (!projectId || !["text", "regenerate", "describe", "regenerate_flagged", "undo"].includes(action)) return err(req, "Bad request", 400);
  const { data: project } = await admin.from("long_form_projects").select("id, user_id, autopilot").eq("id", projectId).maybeSingle();
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);
  const { data: profile } = await admin.from("long_form_generation_profiles").select("render_tier").eq("project_id", projectId).eq("status", "active").maybeSingle();
  const tier = tierOf(profile?.render_tier);
  const credits = sceneCredits(tier);

  // The plan the review page shows: the Scenes run's, else the newest with scene images.
  const ap = project.autopilot ?? {};
  let planId: string | null = ap.phase === "scenes" ? ap.scenes?.planId ?? null : null;
  if (!planId) planId = (await admin.from("long_form_scene_images").select("beat_plan_version_id").eq("project_id", projectId).eq("is_current", true).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.beat_plan_version_id ?? null;
  if (!planId) return err(req, "This video has no scenes yet.", 409);
  const current = async (n: number) => (await admin.from("long_form_scene_images").select("*").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("beat_sequence", n).eq("is_current", true).maybeSingle()).data;

  // ---- text: free, the layer only ----
  if (action === "text") {
    const n = Number(body?.sceneNumber);
    const scene = await current(n);
    if (!scene?.image_url) return err(req, "This scene has no picture yet.", 409);
    const text = String(body?.text ?? "").replace(/\s+/g, " ").trim();
    if (text.split(" ").filter(Boolean).length > MAX_TEXT_WORDS) return err(req, `Keep on-screen text to ${MAX_TEXT_WORDS} words or fewer.`, 422);
    if (IP_MARKS.test(text)) return err(req, "Please leave brand or team names out of the on-screen text.", 422);
    let layer = null;
    if (text) {
      // Placed on the smallest copy we have (the model's raw render when present), then scaled to 1920x1080.
      const src = scene.original_url ?? scene.image_url;
      const bytes = await fetchBytes(src);
      const o = await overlayText(bytes, text, { font: await fetchBytes(FONT_URL) });
      // Styled from the words (a number -> BIG STAT, a "?" -> QUESTION).
      layer = scaleLayer(o.layer, 1920 / Math.max(1, o.frame.width));
    }
    if (dryRun) return ok(req, { ok: true, dryRun: true, action, credits: 0, overlay: layer, overlayText: text || null });
    await admin.from("long_form_scene_images").update({ overlay: layer, overlay_text: text || null }).eq("id", scene.id);
    await logEvent("update-long-form-scene", "info", "scene_text_edited", { projectId, scene: n });
    return ok(req, { ok: true, action, credits: 0, overlay: layer, overlayText: text || null });
  }

  // ---- undo: bring back the previous picture (free; the page offers it for 10 s after a redraw) ----
  if (action === "undo") {
    const n = Number(body?.sceneNumber);
    const cur = await current(n);
    if (!cur || cur.status !== "ready" || cur.source === "autopilot" || cur.source === "seeded") return err(req, "There's nothing to undo for this scene.", 409);
    const { data: prev } = await admin.from("long_form_scene_images").select("id").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("beat_sequence", n).eq("status", "ready").lt("version", cur.version).order("version", { ascending: false }).limit(1).maybeSingle();
    if (!prev) return err(req, "There's no earlier picture for this scene.", 409);
    if (dryRun) return ok(req, { ok: true, dryRun: true, action, credits: 0 });
    // The partial unique index allows one current row per scene: retire the new one first.
    await admin.from("long_form_scene_images").update({ is_current: false }).eq("id", cur.id);
    await admin.from("long_form_scene_images").update({ is_current: true }).eq("id", prev.id);
    await logEvent("update-long-form-scene", "info", "scene_undo", { projectId, scene: n });
    return ok(req, { ok: true, action, credits: 0 });
  }

  // ---- regenerate / describe / regenerate_flagged ----
  let numbers: number[] = [];
  let description: string | null = null;
  if (action === "regenerate_flagged") {
    const [{ data: beats }, { data: imgs }] = await Promise.all([
      admin.from("long_form_beats").select("sequence, warnings").eq("beat_plan_version_id", planId),
      admin.from("long_form_scene_images").select("beat_sequence, status, warnings, qa").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("is_current", true),
    ]);
    const img = new Map((imgs ?? []).map((i: any) => [i.beat_sequence, i]));
    // The same flags the review page shows: real image problems + true near-duplicates only.
    const dups = duplicateScenes((imgs ?? []).filter((i: any) => i.status === "ready").map((i: any) => ({ n: i.beat_sequence, hash: i.qa?.dhash })));
    numbers = (beats ?? []).filter((b: any) => { const i: any = img.get(b.sequence); return i && i.status !== "queued" && i.status !== "rendering" && plainWarnings([...(b.warnings ?? []), ...(i.warnings ?? []), ...(i.status === "failed" ? ["image_failed"] : []), ...(dups.has(b.sequence) ? ["duplicate"] : [])]).length > 0; }).map((b: any) => b.sequence).sort((a: number, b: number) => a - b);
  } else {
    numbers = [Number(body?.sceneNumber)];
    if (action === "describe") {
      description = String(body?.description ?? "").replace(/\s+/g, " ").trim();
      if (description.length < 8) return err(req, "Describe what you want to see in a few more words.", 422);
      if (description.length > 400) return err(req, "Keep the description under 400 characters.", 422);
      if (IP_MARKS.test(description) || IP_LOOKALIKE.test(description)) return err(req, "Please describe it without brand names or look-alikes of well-known characters.", 422);
    }
  }
  if (!numbers.length) return ok(req, { ok: true, action, scenes: 0, credits: 0 });

  // Every description goes through the same compiler before anything is drawn.
  if (description) {
    const { data: plan } = await admin.from("long_form_beat_plan_versions").select("production_bible_id").eq("id", planId).single();
    const { data: bible } = await admin.from("long_form_production_bibles").select("bible").eq("id", plan.production_bible_id).single();
    const { data: beats } = await admin.from("long_form_beats").select("sequence, start_word, end_word, start_ms, end_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
    const all = (beats ?? []).map((b: any) => ({ sequence: b.sequence, startWord: b.start_word, endWord: b.end_word, startMs: b.start_ms, endMs: b.end_ms, narrationText: b.narration_text, contract: b.contract }));
    const beat = all.find((b: any) => b.sequence === numbers[0]);
    if (!beat) return err(req, "Scene not found", 404);
    const set = canonicalSetFromBible(bible.bible);
    const p = compileBeatPrompt({ ...beat, contract: { ...beat.contract, visualConcept: description, userSummary: description } }, set, { plantFrame: plantFrameFor(all, set), ...compileOptionsFor(tier) });
    if (p.lintErrors.length) return err(req, "That description asks for written words or labels in the picture — use the on-screen text for words instead.", 422);
  }
  const total = numbers.length * credits;
  if (dryRun) return ok(req, { ok: true, dryRun: true, action, scenes: numbers.length, sceneNumbers: numbers.slice(0, 200), creditsPerScene: credits, credits: total });

  // Real: a new version per scene (the old one stays in history), drawn by the scene loop.
  for (const n of numbers) {
    const old = await current(n);
    if (old && (old.status === "queued" || old.status === "rendering")) continue;
    if (old) await admin.from("long_form_scene_images").update({ is_current: false }).eq("id", old.id);
    await admin.from("long_form_scene_images").insert({
      project_id: projectId, beat_plan_version_id: planId, beat_sequence: n, version: (old?.version ?? 0) + 1, tier, status: "queued",
      source: description ? "edit_description" : "regenerate", description_override: description ?? (old?.description_override ?? null),
      overlay_text: old?.overlay_text ?? null,
    });
  }
  const sc = ap.phase === "scenes" && ap.scenes ? ap.scenes : { startedAt: new Date().toISOString(), resumes: 0, dispatched: {} };
  // While the first drawing is still running, a redraw just joins its queue (the page stays on the drawing grid).
  const firstRunDrawing = sc.status === "running" && !sc.regenerating;
  const autopilot = firstRunDrawing ? ap : { ...ap, status: "running", phase: "scenes", lockUntil: null, scenes: { ...sc, status: "running", planId, regenerating: true, stage: "drawing" } };
  await admin.from("long_form_projects").update({ autopilot }).eq("id", projectId);
  await logEvent("update-long-form-scene", "info", `scene_${action}`, { projectId, scenes: numbers.length, credits: total });
  nudgeAutopilot(projectId);
  return ok(req, { ok: true, action, scenes: numbers.length, credits: total });
});
