// Client for the Generate / Scenes workspace. Mirrors visualWorld.js's own
// shape exactly (fetch helpers + thin functions.invoke wrappers with the
// same error-unwrapping pattern) — a deliberate consistency choice, not a
// coincidence.
import { supabase } from "../../../lib/supabaseClient";

async function unwrapFunctionError(error, fallback) {
  const context = error?.context;
  let payload = null;
  try {
    payload = context && typeof context.json === "function" ? await context.json() : null;
  } catch {
    payload = null;
  }
  return { ok: false, status: context?.status ?? 500, message: payload?.error ?? fallback };
}

// Part 5 (2026-09-15 "safe full-episode rebuild" pass): scoped to the
// ACTIVE generation run — `generationRunId` is `project.active_generation_
// charge_id` (null for a project with only pre-charge test/dev scenes,
// which also carry a null generation_run_id — see start-long-form-scene-
// generation's own comment on that). Without this filter, a project that
// has ever been rebuilt would show BOTH the old and new run's scene cards
// mixed together in the same grid, exactly what Part 5 forbids ("do not mix
// scene cards from different runs").
export async function fetchScenePlansAndScenes(visualWorldVersionId, generationRunId = null) {
  if (!visualWorldVersionId) return { plans: [], scenes: [] };
  const { data: plans, error: plansError } = await supabase.from("long_form_scene_render_plans").select("*").eq("visual_world_version_id", visualWorldVersionId);
  if (plansError) throw plansError;
  let scenesQuery = supabase.from("long_form_scenes").select("*").eq("visual_world_version_id", visualWorldVersionId);
  scenesQuery = generationRunId ? scenesQuery.eq("generation_run_id", generationRunId) : scenesQuery.is("generation_run_id", null);
  const { data: scenes, error: scenesError } = await scenesQuery;
  if (scenesError) throw scenesError;
  return { plans: plans ?? [], scenes: scenes ?? [] };
}

// Reads the project's own authoritative pointer (active_generation_charge_id)
// rather than filtering charges by status='charged' directly — the ONE
// place this codebase now designates "the current active generation run"
// (Part 5). `project` must already be loaded (every caller has it).
//
// 2026-09-19 forensic fix (real Mars incident): a charge whose OWN
// visual_plan_version_id points at a DIFFERENT, already-superseded plan
// must never be treated as "the current generation run" — that was exactly
// why Mars's Generate page showed Image Quality locked to V3 and a
// production-status view for a plan that had 0 compiled scenes: the OLD
// (v4) charge still existed and was still 'charged', but the project had
// since replanned and adopted a NEW (v5) plan with an entirely different
// beat list. active_generation_charge_id is intentionally left untouched by
// adopt_visual_plan_version (billing history must survive a replan) — it is
// THIS read path's job to recognize when that pointer no longer describes
// the current plan, mirroring the same fix already applied to
// long_form_project_resume_state.
export async function fetchEpisodeCharge(project) {
  if (!project?.active_generation_charge_id) return null;
  const { data, error } = await supabase.from("long_form_episode_generation_charges").select("*").eq("id", project.active_generation_charge_id).maybeSingle();
  if (error) return null;
  if (data && project.current_visual_plan_version_id && data.visual_plan_version_id !== project.current_visual_plan_version_id) return null;
  return data;
}

// Routed through an edge function (service role), not a direct client-side
// table write — long_form_projects has no UPDATE RLS policy at all, same
// as every other Long Form mutation in this codebase.
export async function saveSceneGenerationTier(projectId, tier) {
  const { error } = await supabase.functions.invoke("save-long-form-scene-tier", { body: { projectId, tier } });
  if (error) throw error;
}

// The real paid action — verifies readiness, prices the episode server-side
// (never trusts what the UI displayed), charges credits exactly once, and
// begins compiling/dispatching every scene in the episode. See
// charge-long-form-episode-generation/index.ts. Idempotent: calling this
// twice for the same project (double-click, reload-and-resubmit) returns
// the SAME charge, never a second deduction.
// `chapterGate` (2026-09-22, opt-in, default false): does not change what
// gets charged (still the full episode, exactly once) — it only paces WHEN
// scenes past the first chapter become eligible for real dispatch, so a
// systemic problem shows up after one chapter's worth of provider calls
// instead of the whole episode's. See advanceChapterGate below for how
// later chapters get unlocked.
export async function chargeAndStartEpisodeGeneration(projectId, tier, chapterGate = false) {
  const { data, error } = await supabase.functions.invoke("charge-long-form-episode-generation", { body: { projectId, tier, chapterGate } });
  if (error) return unwrapFunctionError(error, "Couldn't start episode generation. Please try again.");
  return { ok: true, alreadyCharged: data?.alreadyCharged, creditsCharged: data?.creditsCharged, breakdown: data?.breakdown, tier: data?.tier };
}

// "Rebuild Episode Visuals" — server-authoritative, identical price source
// to Generate Episode (both ultimately call estimate_long_form_episode_
// credits), but creates a NEW generation run rather than requiring none to
// exist. `expectedActiveGenerationRunId` is the run id the modal displayed
// when it opened (project.active_generation_charge_id at that moment) — the
// server rejects (ACTIVE_RUN_CHANGED_SINCE_QUOTE, surfaced as 409) if the
// active run changed between opening the modal and confirming, rather than
// silently rebuilding the wrong thing. Idempotent exactly like Generate
// Episode: a double-click returns the SAME new run, never a second charge.
export async function rebuildEpisodeGeneration(projectId, tier, expectedActiveGenerationRunId) {
  const { data, error } = await supabase.functions.invoke("rebuild-long-form-episode-generation", { body: { projectId, tier, expectedActiveGenerationRunId } });
  if (error) return unwrapFunctionError(error, "Couldn't start the rebuild. Please try again.");
  return { ok: true, newGenerationRunId: data?.newGenerationRunId, previousGenerationRunId: data?.previousGenerationRunId, alreadyCharged: data?.alreadyCharged, creditsCharged: data?.creditsCharged, breakdown: data?.breakdown, tier: data?.tier };
}

// Both server-authoritative charge functions (retry_long_form_scene /
// edit_long_form_scene) return the real credits debited for THIS call —
// 0 when a pre-dispatch failure was resumed for free, or when a double-
// click hit the idempotent early return. The caller uses this (never a
// client-guessed number) to drive emitCreditSpend/balance UI.
export async function retryScene(sceneId) {
  const { data, error } = await supabase.functions.invoke("retry-long-form-scene", { body: { sceneId } });
  if (error) return unwrapFunctionError(error, "Couldn't retry this scene. Please try again.");
  return { ok: true, sceneId: data?.sceneId, creditsCharged: data?.creditsCharged ?? 0 };
}

// 2026-09-22 "FINAL stabilization pass" §0/§10 — reverts a scene's
// displayed frame to its clean base image. Always free (there is no
// creditsCharged field at all — disable_long_form_scene_overlay makes no
// provider call, ever) and never regenerates the base.
export async function disableSceneOverlay(sceneId) {
  const { data, error } = await supabase.functions.invoke("disable-long-form-scene-overlay", { body: { sceneId } });
  if (error) return unwrapFunctionError(error, "Couldn't update this scene's overlay. Please try again.");
  return { ok: true, sceneId: data?.sceneId };
}

// Part 5 (2026-09-15 content-grounding pass) — "Try as New Scene": escalates
// a weak EDIT (visualDeltaSatisfied === false) to a fresh, independently-
// grounded GENERATE render plan for the same beat, priced at the tier's
// GENERATE cost. See escalate-long-form-scene-to-generate.
export async function escalateSceneToGenerate(sceneId) {
  const { data, error } = await supabase.functions.invoke("escalate-long-form-scene-to-generate", { body: { sceneId } });
  if (error) return unwrapFunctionError(error, "Couldn't create a new scene. Please try again.");
  return { ok: true, sceneId: data?.sceneId, creditsCharged: data?.creditsCharged ?? 0 };
}

export async function editScene(sceneId, instruction) {
  const { data, error } = await supabase.functions.invoke("edit-long-form-scene", { body: { sceneId, instruction } });
  if (error) return unwrapFunctionError(error, "Couldn't edit this scene. Please try again.");
  return { ok: true, sceneId: data?.sceneId, creditsCharged: data?.creditsCharged ?? 0 };
}

export async function approveSceneManually(sceneId) {
  const { data, error } = await supabase.functions.invoke("approve-long-form-scene", { body: { sceneId } });
  if (error) return unwrapFunctionError(error, "Couldn't approve this scene. Please try again.");
  return { ok: true, sceneId: data?.sceneId };
}

// 2026-09-21 emergency pause feature. Both set/clear the SAME durable
// is_paused flag the claim/enqueue RPCs already gate on — never a
// frontend-only flag. See pause-long-form-episode-generation /
// continue-long-form-episode-generation.
export async function pauseEpisodeGeneration(projectId) {
  const { data, error } = await supabase.functions.invoke("pause-long-form-episode-generation", { body: { projectId } });
  if (error) return unwrapFunctionError(error, "Couldn't pause generation. Please try again.");
  return { ok: true, chargeId: data?.chargeId, isPaused: data?.isPaused };
}

export async function continueEpisodeGeneration(projectId) {
  const { data, error } = await supabase.functions.invoke("continue-long-form-episode-generation", { body: { projectId } });
  if (error) return unwrapFunctionError(error, "Couldn't continue generation. Please try again.");
  return { ok: true, chargeId: data?.chargeId, isPaused: data?.isPaused };
}

// 2026-09-22 "Fix Storyboard" targeted repair — re-runs the (fixed)
// deterministic shot-expansion pipeline against the CURRENT storyboard's own
// persisted macro-level data, no LLM/provider calls, no credits charged.
// dryRun:false only actually persists+adopts a new VisualPlan version if the
// repair genuinely resolves the flagged duplicates (server-side gate — the
// caller can't force a partial repair through). See
// repair-long-form-storyboard/index.ts.
export async function repairStoryboard(projectId, dryRun = false) {
  const { data, error } = await supabase.functions.invoke("repair-long-form-storyboard", { body: { projectId, dryRun } });
  if (error) return unwrapFunctionError(error, "Couldn't repair the storyboard. Please try again.");
  return { ok: true, ...data };
}

// 2026-09-23 "systemic production stabilization" pass, Item E — "Generate
// Test Sample." Read-only quote: selects up to 3 representative beats from
// the current compiled plan (a real identity/reference-heavy shot, a real
// environment/concept shot, a real overlay/graphic/continuity shot — never
// a hardcoded topic-specific pick) and estimates their credits. Charges
// nothing, dispatches nothing — safe to call any number of times, including
// before the user has decided anything. See generate-long-form-scene-sample.
export async function quoteTestSample(projectId, tier) {
  const { data, error } = await supabase.functions.invoke("generate-long-form-scene-sample", { body: { projectId, tier } });
  if (error) return unwrapFunctionError(error, "Couldn't prepare a test sample. Please try again.");
  return { ok: true, totalCompiledScenes: data?.totalCompiledScenes ?? 0, sampleScenes: data?.sampleScenes ?? [], estimatedSampleCredits: data?.estimatedSampleCredits ?? 0 };
}

// The real paid action for the sample: charges ONLY the exact beats the
// server (re)selects at call time, authorizes ONLY those scenes, and kicks
// generation for them alone — Chapter 1 and the full episode remain
// completely unauthorized. Refuses (GENERATION_ALREADY_ACTIVE, surfaced as a
// friendly message) if a real chapter/episode generation is already charged
// for this project, so a test sample can never cancel real paid generation.
// See generate-long-form-scene-sample-dispatch.
export async function generateTestSample(projectId, tier) {
  const { data, error } = await supabase.functions.invoke("generate-long-form-scene-sample-dispatch", { body: { projectId, tier } });
  if (error) return unwrapFunctionError(error, "Couldn't start the test sample. Please try again.");
  return { ok: true, alreadyCharged: Boolean(data?.alreadyCharged), creditsCharged: data?.creditsCharged ?? 0, generationRunId: data?.generationRunId ?? null, sampleScenes: data?.sampleScenes ?? [] };
}

// 2026-09-22 chapter-by-chapter testing gate — unlocks the NEXT chapter's
// scenes for claim_long_form_scene_for_render once every scene in the
// current chapter has reached a terminal state. See
// advance-long-form-chapter-gate/index.ts.
export async function advanceChapterGate(projectId) {
  const { data, error } = await supabase.functions.invoke("advance-long-form-chapter-gate", { body: { projectId } });
  if (error) return unwrapFunctionError(error, "Couldn't start the next chapter. Please try again.");
  return { ok: true, chapterGateComplete: data?.chapterGateComplete, chapterGateBoundary: data?.chapterGateBoundary, chapterId: data?.chapterId };
}
