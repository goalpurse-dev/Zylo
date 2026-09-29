// deno-lint-ignore-file no-explicit-any
// build-stickman-production-bible/index.ts — 2026-10-02 "Production Bible"
// pass.
//
// Creates the ONE frozen per-video visual Production Bible for a Stickman
// recipe project. Narration-first by construction: refuses outright unless
// the project's script is genuinely FINAL (status:'ready') — this function
// is deliberately positioned AFTER script, not before, per the new master
// pipeline (Idea -> Setup -> Research -> Story -> FINAL Narration -> TTS ->
// Production Bible -> Beat Director -> ...). It does not touch TTS/audio at
// all (that's the separate Phase 1.5 stage) — the Bible only needs the
// FINAL TEXT, never audio timing.
//
// Exactly one text-LLM call (gpt-5-mini, ~$0.001-0.01 typical), with at most
// one bounded repair call on a deterministic validation failure — see
// compileStickmanProductionBible's own doc comment. NEVER calls Runware,
// Kling, or any image/video provider. NEVER charges credits (Bible
// authoring is a planning-cost, exactly like the existing narration-contract
// compiler and Visual World reference-planner, neither of which charge the
// user directly).
//
// POST { projectId }
// Returns { ok:true, bible, warnings, stats, productionBibleId, bibleVersion }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUserOrAutopilot } from "../shared/auth.ts";
import { compileStickmanProductionBible } from "../_shared/stickman/productionBible.ts";
import { recordCost } from "../_shared/costLedger.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { bibleBuildState, bibleBuildInFlight } from "../_shared/stickman/bibleBuild.ts";
import { STICKMAN_DOODLE_EXPLAINER_V1 } from "../_shared/stickman/styleContract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  if (!OPENAI_KEY) return err(req, "OPENAI_API_KEY not configured", 500);

  const { user, authError } = await requireUserOrAutopilot(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  // The Production Profile snapshot must exist and name this recipe —
  // nothing about style/recipe is ever read live off long_form_projects
  // once a profile exists (Section J: settings are locked once generation
  // begins).
  const { data: profile, error: profileError } = await admin.from("long_form_generation_profiles").select("*").eq("project_id", projectId).eq("status", "active").maybeSingle();
  if (profileError) return err(req, "Failed to load generation profile", 500);
  if (!profile) return err(req, "This project has no active Production Profile yet — complete Setup first.", 409);
  if (profile.visual_recipe !== "stickman_doodle_explainer") return err(req, `This project's visual recipe ('${profile.visual_recipe}') is not Stickman — this endpoint only builds a Stickman Production Bible.`, 409);
  if (profile.recipe_version !== STICKMAN_DOODLE_EXPLAINER_V1.recipeVersion) return err(req, `Unsupported recipe version: ${profile.recipe_version}`, 409);

  // Narration-first, hard gate: refuse if the script isn't genuinely LOCKED
  // (2026-10-02 — "Lock Story" is now the deliberate trigger, distinct from
  // merely reaching status='ready') for THIS exact profile. This is the one
  // rule the whole redesign exists to enforce — visual planning (and the
  // Bible is the first visual-planning artifact) must never precede final,
  // committed narration.
  if (!project.current_script_version_id) return err(req, "This project has no script yet — write and finalize the script before building a Production Bible.", 409);
  const { data: scriptVersion, error: scriptError } = await admin.from("long_form_script_versions").select("*").eq("id", project.current_script_version_id).maybeSingle();
  if (scriptError) return err(req, "Failed to load script", 500);
  if (!scriptVersion) return err(req, "Script not found", 404);
  if (!scriptVersion.locked_at || scriptVersion.locked_generation_profile_id !== profile.id) {
    return err(req, "The script must be locked (Lock Story) for this exact Production Profile before the Production Bible can be built.", 409);
  }

  // Idempotent (2026-10-02): a frozen Bible already exists for this exact
  // (project, script version, profile) — return it unchanged rather than
  // spending a second LLM call. This is what makes it safe to call this
  // function from lock-long-form-script on every lock (including a
  // resumed/refreshed one) without ever double-building.
  const { data: existingBible } = await admin.from("long_form_production_bibles").select("*").eq("project_id", projectId).eq("script_version_id", scriptVersion.id).eq("generation_profile_id", profile.id).eq("status", "frozen").maybeSingle();
  if (existingBible) {
    return ok(req, { ok: true, bible: existingBible.bible, warnings: existingBible.warnings ?? [], stats: { llmCalls: 0, repairCalls: 0, inputTokens: 0, outputTokens: 0, estimatedModelCostUsd: 0, latencyMs: 0 }, productionBibleId: existingBible.id, bibleVersion: existingBible.bible_version, alreadyBuilt: true });
  }

  const segments: { id: string; text: string }[] = scriptVersion.script_document?.narrationSegments ?? [];
  if (!segments.length) return err(req, "The final script has no narration segments to build a visual identity from.", 422);
  const finalScript = segments.map((s) => s.text).join(" ");

  // Phase 6d-1: one build per script. A build already running (the lock's) is
  // THE build — a second caller (Scenes, a retry) waits for it, never pays twice.
  const buildCtx = { projectId, scriptVersionId: scriptVersion.id };
  if (bibleBuildInFlight(await bibleBuildState(admin, projectId, scriptVersion.id))) {
    await logEvent("build-stickman-production-bible", "info", "bible_build_joined", buildCtx);
    return ok(req, { ok: true, inFlight: true, message: "The style guide is already being built." }, 202);
  }
  await logEvent("build-stickman-production-bible", "info", "bible_build_started", buildCtx);

  // A provider failure (truncated/unparseable output, HTTP error, timeout) is
  // reported with its reason — never a bare 500 (Phase 4c incident).
  let compileResult: Awaited<ReturnType<typeof compileStickmanProductionBible>>;
  try {
    compileResult = await compileBible();
  } catch (e: any) {
    console.error("[build-stickman-production-bible] draft call failed:", projectId, e?.message);
    if (e?.outputTokens) await recordCost(admin, { projectId, stage: "bible", provider: "openai", model: "gpt-5-mini", units: { calls: 1, inputTokens: e.inputTokens ?? 0, outputTokens: e.outputTokens }, usd: ((e.inputTokens ?? 0) * 0.25 + e.outputTokens * 2) / 1_000_000, estimated: false, sourceTable: "long_form_production_bibles" });
    const code = String(e?.message ?? "").split(":")[0] || "PRODUCTION_BIBLE_CALL_FAILED";
    await logEvent("build-stickman-production-bible", "warn", "bible_build_failed", { ...buildCtx, reason: code });
    return err(req, "The Production Bible could not be generated right now — please try again.", 502, { code, detail: String(e?.message ?? e).slice(0, 300) });
  }

  async function compileBible() { return await compileStickmanProductionBible({
    openaiKey: OPENAI_KEY,
    projectId, generationProfileId: profile.id, scriptVersionId: scriptVersion.id,
    productionBibleVersion: 1, // the RPC below is the real authority on the next version number; this is only used inside the compiled bible's own self-description
    topic: project.topic ?? "",
    viewerPromise: [project.selected_idea_title, project.selected_idea_angle].filter(Boolean).join(" — "),
    narrativeStrategy: project.narrative_strategy ? JSON.stringify(project.narrative_strategy).slice(0, 2000) : "",
    finalScript,
    // Deliberately minimal — Section 2: "do not feed huge raw research
    // documents unnecessarily." Only a short topic-model digest, never a
    // full research/fact-graph dump.
    researchNotes: project.topic_model?.summary ? String(project.topic_model.summary).slice(0, 1000) : "",
    targetAudience: project.narrative_strategy?.targetAudience ?? "",
  }); }

  // Cost ledger: the calls were paid whether or not the bible validated.
  await recordCost(admin, { projectId, stage: "bible", provider: "openai", model: "gpt-5-mini", units: { calls: compileResult.stats.llmCalls, inputTokens: compileResult.stats.inputTokens, outputTokens: compileResult.stats.outputTokens }, usd: compileResult.stats.estimatedModelCostUsd, estimated: false, sourceTable: "long_form_production_bibles" });

  if (!compileResult.ok) {
    await logEvent("build-stickman-production-bible", "warn", "bible_build_failed", { ...buildCtx, reason: "validation" });
    console.error("[build-stickman-production-bible] validation failed after repair attempt:", projectId, compileResult.errors);
    return err(req, "Could not produce a valid Production Bible for this script — please try again.", 422, { errors: compileResult.errors, stats: compileResult.stats });
  }

  const { data: frozen, error: freezeError } = await admin.rpc("freeze_long_form_production_bible", {
    p_project_id: projectId, p_user_id: user.id, p_generation_profile_id: profile.id, p_script_version_id: scriptVersion.id,
    p_recipe_id: compileResult.bible.recipeId, p_recipe_version: compileResult.bible.recipeVersion, p_bible: compileResult.bible,
    p_llm_calls: compileResult.stats.llmCalls, p_repair_calls: compileResult.stats.repairCalls,
    p_input_tokens: compileResult.stats.inputTokens, p_output_tokens: compileResult.stats.outputTokens,
    p_estimated_model_cost_usd: compileResult.stats.estimatedModelCostUsd, p_warnings: compileResult.warnings,
  });
  if (freezeError) {
    await logEvent("build-stickman-production-bible", "warn", "bible_build_failed", { ...buildCtx, reason: "freeze" });
    const status = freezeError.message?.includes("FORBIDDEN") ? 403 : freezeError.message?.includes("PROJECT_NOT_FOUND") ? 404 : 500;
    return err(req, "Could not save the Production Bible.", status);
  }

  await logEvent("build-stickman-production-bible", "info", "bible_build_done", buildCtx);
  return ok(req, {
    ok: true, bible: compileResult.bible, warnings: compileResult.warnings, stats: compileResult.stats,
    productionBibleId: frozen.id, bibleVersion: frozen.bible_version,
  });
});
