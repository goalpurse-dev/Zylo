// deno-lint-ignore-file no-explicit-any
// compile-long-form-scenes/index.ts
//
// 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION" pass.
// Real Atlantis finding this closes: start-long-form-scene-generation
// compiled scenes AND THEN unconditionally self-chained into
// advance-long-form-scene-generation, which claims 'pending' scenes and can
// immediately start real Runware/Kling provider jobs — making it
// structurally impossible to compile a real, inspectable render plan
// without also risking real spend, and impossible to review a persisted
// compile before any money moves.
//
// This function is start-long-form-scene-generation's own compile logic,
// carried over field-for-field (deterministic + LLM-judged PRODUCTION
// decisions from _shared/sceneRenderPlan.ts / episodePreflight.ts — never
// replans the story), with exactly two changes:
//
//   1. Freshly-compiled scenes are inserted with status='awaiting_generation',
//      never 'pending'. claim_long_form_scene_for_render (SQL) only ever
//      claims status IN ('pending', 'running') — an 'awaiting_generation'
//      row is therefore STRUCTURALLY UNCLAIMABLE by the provider-dispatch
//      claim function, with no dependency on any environment flag, no
//      reliance on frontend state, and no new migration required (status
//      is a plain, unconstrained text column). This is "safe by design":
//      the safety property holds even if this function is called from
//      somewhere new, even if the dispatch worker runs on a cron, even if
//      a future engineer forgets this file's own history.
//
//   2. The unconditional self-chain into advance-long-form-scene-generation
//      is REMOVED. This function only ever compiles; it never dispatches.
//      (The batch self-chain back into ITSELF, to durably finish compiling
//      a large plan across multiple 40-beat calls, is kept — that's still
//      pure compilation, zero provider risk.)
//
// Moving a compiled beat from 'awaiting_generation' to 'pending' (i.e.
// AUTHORIZING it for real provider spend) is a deliberately SEPARATE,
// explicit action — see charge-long-form-episode-generation (full
// chapter/episode) and generate-long-form-scene-sample (an explicit,
// user-reviewed 2-3 scene test) — never automatic, and never triggered by
// compilation itself.
//
// Idempotent: a beat that already has a current (non-superseded) scene row
// is left untouched (its existing status, whatever it is, is never reset)
// — re-running this for the same beats after a page refresh compiles
// nothing twice, creates no duplicate rows, and never re-authorizes an
// already-dispatched or already-finished scene.
//
// POST { projectId, beatIds: string[] }
// Returns { ok:true, compiled: [{beatId, sceneId, renderStrategy, sceneType}], skipped: [{beatId, reason}] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { loadEpisodePreflight } from "../_shared/episodePreflight.ts";
import { getStylePresetForProject } from "../_shared/visualWorldStyle.ts";
import {
  deriveRenderStrategy, resolveSourceBeatId,
  deriveSceneQAExpectations, SCENE_RENDER_PLAN_COMPILER_VERSION, canSatisfyCrop,
} from "../_shared/sceneRenderPlan.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SELF_URL = `${SUPABASE_URL}/functions/v1/compile-long-form-scenes`;

// The one durable, explicit status this pass introduces. Every OTHER
// status value (pending/running/succeeded/failed) is unchanged and means
// exactly what it always has.
export const AWAITING_GENERATION_STATUS = "awaiting_generation";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const body = await req.json().catch(() => ({}));

  // Two callers: (a) a real signed-in user hitting this directly (kept for
  // parity/manual testing), and (b) charge-long-form-episode-generation's /
  // generate-long-form-scene-sample's own trusted server-to-server batch-
  // compile calls (these NEVER charge before this returns — see each
  // caller's own comments) — those carry the service role key plus an
  // explicit ownerUserId instead of a user JWT. The internal path still
  // re-verifies ownership below exactly like the user path.
  const isInternalServiceCall = req.headers.get("Authorization") === `Bearer ${SERVICE_KEY}` && Boolean(body?.ownerUserId);
  let ownerUserId: string;
  if (isInternalServiceCall) {
    ownerUserId = String(body.ownerUserId);
  } else {
    const { user, authError } = await requireUser(req);
    if (!user) return err(req, authError || "Unauthorized", 401);
    ownerUserId = user.id;
  }

  const projectId = String(body?.projectId ?? "").trim();
  const requestedBeatIds: string[] = Array.isArray(body?.beatIds) ? body.beatIds.map(String) : [];
  if (!projectId) return err(req, "Missing projectId", 400);
  if (!requestedBeatIds.length) return err(req, "beatIds is required — this endpoint never compiles the whole plan in one call", 400);
  if (requestedBeatIds.length > 40) return err(req, "Too many beatIds in one call (max 40) — this is a controlled-batch endpoint, not full-plan generation", 400);
  const forceNewPlanVersion = body?.forceNewPlanVersion === true;
  // Compile-only never has a real charge to attribute scenes to at compile
  // time — authorization (and therefore generation_run_id) is always
  // assigned LATER, by whichever caller actually authorizes these specific
  // beats for spend. A caller MAY still pass one explicitly (e.g. a
  // rebuild re-compiling under an already-authorized run) — never inferred
  // from "is there currently an active charge" the way the old coupled
  // function did, since that inference is exactly what let compilation and
  // authorization silently entangle.
  const explicitGenerationRunId = body?.generationRunId ? String(body.generationRunId) : undefined;
  const scopeBeatIdsOnly = body?.scopeBeatIdsOnly === true;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== ownerUserId) return err(req, "Project not found", 404);
  if (!project.current_visual_world_version_id || !project.current_visual_plan_version_id) return err(req, "Visual World or Visual Plan not ready", 400);

  const { data: world } = await admin.from("long_form_visual_world_versions").select("*").eq("id", project.current_visual_world_version_id).maybeSingle();
  if (!world || world.status !== "ready") return err(req, "Visual World is not ready for Scene Generation yet", 400);

  const { data: planRow } = await admin.from("long_form_visual_plan_versions").select("*").eq("id", project.current_visual_plan_version_id).maybeSingle();
  if (!planRow || planRow.status !== "ready") return err(req, "Visual Plan is not ready", 400);

  const plan = planRow.visual_plan;
  const allBeats: any[] = plan.visualBeats ?? [];
  // Section 5 of the 2026-09-16 "production invariants" pass: a DETAIL-
  // shotSize beat can never be satisfied by CROP while staying 16:9.
  // Escalating here, once, before any plan row is written, means every
  // downstream consumer already sees the corrected GENERATE strategy.
  for (const beat of allBeats) {
    if (deriveRenderStrategy(beat) === "CROP" && !canSatisfyCrop({ shotSize: beat.shotSize })) {
      beat.renderMethod = "GENERATE";
      beat.shotStrategy = "NEW_SETUP";
      beat.cropEscalatedFromDetail = true;
    }
  }
  const beatsById = new Map(allBeats.map((b) => [b.id, b]));
  const continuityGroupsById = new Map((plan.continuityGroups ?? []).map((g: any) => [g.id, g]));
  const entityRegistryById = new Map((plan.entityRegistry ?? []).map((e: any) => [e.id, e]));
  const styleSpec = getStylePresetForProject(project.visual_style_preset);

  // Never read project.current_narration_contract_version_id here — that
  // pointer can move independently of which contract version this
  // SPECIFIC plan's beats were actually authored against. The pinned value
  // lives on the plan itself.
  const pinnedContractVersionId: string | null = plan.narrationContractVersionId ?? null;

  // Transitively include any missing base GENERATE beat a requested
  // REUSE/EDIT/CROP beat depends on — never a cascade of unrelated shots.
  const beatIdSet = new Set(requestedBeatIds);
  const skipped: { beatId: string; reason: string }[] = [];
  for (const beatId of [...requestedBeatIds]) {
    const beat = beatsById.get(beatId);
    if (!beat) { skipped.push({ beatId, reason: "BEAT_NOT_FOUND" }); beatIdSet.delete(beatId); continue; }
    try {
      const sourceId = resolveSourceBeatId(beat, allBeats);
      if (sourceId) beatIdSet.add(sourceId);
    } catch (error) {
      skipped.push({ beatId, reason: error instanceof Error ? error.message : "SOURCE_RESOLUTION_FAILED" });
      beatIdSet.delete(beatId);
    }
  }

  // Dependency order: beats with no source first, then dependents.
  const orderedBeats = [...beatIdSet].map((id) => beatsById.get(id)).filter(Boolean)
    .sort((a: any, b: any) => a.sequenceIndex - b.sequenceIndex);

  // Real Atlantis finding (2026-09-22 live compile of adopted Visual Plan
  // v5): long_form_scene_render_plans has a hard 3-column unique constraint
  // — (visual_world_version_id, visual_beat_id, plan_version), deliberately
  // NOT including visual_plan_version_id (see that table's own migration
  // comment: "a new plan_version is a full replacement, never an in-place
  // mutation of a plan already used to render a scene"). A plain compile
  // (no forceNewPlanVersion) always computed plan_version=1 unconditionally
  // — so a beat re-compiled after a NORMAL Visual Plan repair/replan (not a
  // rebuild) landed on the exact SAME row a prior, now-superseded plan
  // version had already used. The upsert then silently overwrote that old
  // row's content in place, and because a scene is only ever created when
  // none exists yet FOR THAT PLAN ROW ID, the beat silently inherited the
  // old row's already-terminal (succeeded/failed, real-money) scene from
  // the superseded plan — 15 of Atlantis's 126 beats hit exactly this,
  // resurrecting real pre-repair scene attempts under the new plan's
  // identity. ALWAYS (not just under forceNewPlanVersion) resolve each
  // beat's latest existing plan row now, and bump plan_version whenever
  // that row belongs to a DIFFERENT visual_plan_version_id than the one
  // being compiled — a genuinely fresh row, a genuinely fresh scene, the
  // old row (real immutable history) never mutated in place. Re-compiling
  // the SAME plan version stays exactly as idempotent as before (reuses
  // that same plan_version, so the existing scene lookup still finds and
  // preserves it untouched).
  const latestPlanByBeatId = new Map<string, { planVersion: number; visualPlanVersionId: string }>();
  {
    const { data: existingVersions } = await admin.from("long_form_scene_render_plans").select("visual_beat_id, plan_version, visual_plan_version_id").eq("visual_world_version_id", world.id).in("visual_beat_id", orderedBeats.map((b: any) => b.id));
    for (const row of existingVersions ?? []) {
      const current = latestPlanByBeatId.get(row.visual_beat_id);
      if (!current || row.plan_version > current.planVersion) latestPlanByBeatId.set(row.visual_beat_id, { planVersion: row.plan_version, visualPlanVersionId: row.visual_plan_version_id });
    }
  }

  // Same deterministic compiler charge/quote uses; never skip an invalid beat.
  const preflight = await loadEpisodePreflight(admin, projectId, ownerUserId, project.scene_generation_tier ?? "v3");
  if (!preflight.ok) return err(req, "This plan needs repair before visuals can be produced. Please replan.", 422);
  if (preflight.planId !== planRow.id || preflight.worldId !== world.id) return err(req, "The plan changed. Please refresh.", 409);
  const compiledByBeatId = new Map(preflight.compiled.map((c: any) => [c.beatId, c]));

  const compiled: { beatId: string; sceneId: string; renderStrategy: string; sceneType: string }[] = [];
  const planIdByBeatId = new Map<string, string>();

  for (const beat of orderedBeats) {
    try {
      const candidate = compiledByBeatId.get(beat.id);
      if (!candidate) throw new Error("BEAT_NOT_PREFLIGHTED");
      const { renderStrategy, sceneType, sourceBeatId, director, characterNames, referenceAssetIds, imagePrompt, overlaySpec } = candidate;
      const effectiveBeat = candidate.plannedBeat ?? beat;
      let sourcePlanId = sourceBeatId ? planIdByBeatId.get(sourceBeatId) ?? null : null;
      if (sourceBeatId && !sourcePlanId) {
        const { data: existingSource } = await admin.from("long_form_scene_render_plans").select("id").eq("visual_world_version_id", world.id).eq("visual_plan_version_id", planRow.id).eq("visual_beat_id", sourceBeatId).order("plan_version", { ascending: false }).limit(1).maybeSingle();
        if (!existingSource) throw new Error("SOURCE_BEAT_NOT_YET_COMPILED:" + sourceBeatId);
        sourcePlanId = existingSource.id;
      }
      const multiCharacterReferenceConstrained = false;
      const unreferencedCharacterNames: string[] = [];

      const latestPlan = latestPlanByBeatId.get(beat.id);
      const planVersion = forceNewPlanVersion
        ? (latestPlan?.planVersion ?? 0) + 1
        : !latestPlan
          ? 1
          : latestPlan.visualPlanVersionId === planRow.id
            ? latestPlan.planVersion // same plan version as before — idempotent re-compile, reuse the same row
            : latestPlan.planVersion + 1; // a DIFFERENT (superseded) plan version already used this plan_version — never overwrite it
      const { data: planRowInserted, error: planInsertError } = await admin.from("long_form_scene_render_plans").upsert({
        project_id: project.id, visual_world_version_id: world.id, visual_plan_version_id: planRow.id, visual_beat_id: beat.id, plan_version: planVersion,
        chapter_id: effectiveBeat.chapterId, sequence_index: effectiveBeat.sequenceIndex, narration_segment_ids: effectiveBeat.narrationSegmentIds ?? [],
        start_seconds: effectiveBeat.estimatedStartSeconds, end_seconds: effectiveBeat.estimatedEndSeconds, communication_goal: effectiveBeat.shotPurpose ?? effectiveBeat.informationToCommunicate,
        narrative_function: effectiveBeat.narrativeFunction, scene_type: sceneType, continuity_group_id: effectiveBeat.continuityGroupId, base_setup_key: effectiveBeat.baseSetupKey,
        composition: { shotSize: effectiveBeat.shotSize, cameraFraming: director.cameraFraming, focalSubject: director.focalSubject, focalEntityId: director.focalEntityId ?? null, displaySubject: director.displaySubject ?? director.focalSubject, cameraAnchor: director.cameraAnchor, cropRegion: director.cropRegion, visualDelta: effectiveBeat.visualDelta ?? null, beatFacts: effectiveBeat.shotRequiredVisualFacts ?? [] },
        world_state_before: continuityGroupsById.get(effectiveBeat.continuityGroupId)?.inheritedState ?? [], world_state_after: director.continuityNote ? [{ key: "continuityNote", value: director.continuityNote }] : [],
        render_strategy: renderStrategy, source_scene_render_plan_id: sourcePlanId, reference_asset_ids: referenceAssetIds,
        narration_claim_id: effectiveBeat.narrationClaimId ?? null, narration_contract_version_id: effectiveBeat.narrationClaimId ? pinnedContractVersionId : null,
        image_prompt: imagePrompt, overlay_spec: overlaySpec, motion_intent: beat.motionSuggestion ?? null,
        factual_constraints: effectiveBeat.factualVisualConstraints ?? [], forbidden_elements: effectiveBeat.forbiddenElements ?? [],
        qa_expectations: deriveSceneQAExpectations(sceneType, characterNames, effectiveBeat.locationId ? entityRegistryById.get(effectiveBeat.locationId)?.name ?? effectiveBeat.locationId : null, multiCharacterReferenceConstrained, unreferencedCharacterNames),
        style_preset_id: styleSpec.id, style_contract_version: String(styleSpec.version), compiler_version: SCENE_RENDER_PLAN_COMPILER_VERSION,
        render_tier: project.scene_generation_tier ?? "v3",
        director_meta: director,
      }, { onConflict: "visual_world_version_id,visual_beat_id,plan_version" }).select("id").single();
      if (planInsertError) throw planInsertError;
      planIdByBeatId.set(beat.id, planRowInserted.id);

      const { data: existingScene } = await admin.from("long_form_scenes").select("id").eq("scene_render_plan_id", planRowInserted.id).is("replaces_scene_id", null).maybeSingle();
      let sceneId = existingScene?.id;
      if (!sceneId) {
        // §1: compiled scenes start AWAITING_GENERATION, never 'pending' —
        // structurally unclaimable by claim_long_form_scene_for_render
        // until an explicit authorization step (charge-long-form-episode-
        // generation or generate-long-form-scene-sample) flips this exact
        // row to 'pending'. No provider job, no dispatch, no charge can
        // ever originate from this insert alone.
        const { data: sceneRow, error: sceneInsertError } = await admin.from("long_form_scenes").insert({
          scene_render_plan_id: planRowInserted.id, visual_world_version_id: world.id, visual_beat_id: beat.id,
          status: AWAITING_GENERATION_STATUS, render_strategy: renderStrategy, input_reference_asset_ids: referenceAssetIds,
          generation_run_id: explicitGenerationRunId ?? null,
        }).select("id").single();
        if (sceneInsertError) throw sceneInsertError;
        sceneId = sceneRow.id;
      }
      // Idempotent: an existing (already compiled, whatever its status)
      // scene row is left completely untouched — re-compiling never resets
      // an in-progress, succeeded, failed, or already-authorized scene.
      compiled.push({ beatId: beat.id, sceneId, renderStrategy, sceneType });
    } catch (error) {
      skipped.push({ beatId: beat.id, reason: error instanceof Error ? error.message : "COMPILE_FAILED" });
    }
  }

  // Self-chain ONLY to continue COMPILING the rest of a large plan across
  // multiple 40-beat calls — pure compilation, zero provider risk, zero
  // dispatch. There is deliberately no equivalent of the old ADVANCE_URL
  // self-chain anywhere in this file.
  if (isInternalServiceCall && !scopeBeatIdsOnly) {
    const { data: existingPlans } = await admin.from("long_form_scene_render_plans").select("visual_beat_id").eq("visual_world_version_id", world.id).eq("visual_plan_version_id", planRow.id);
    const compiledBeatIds = new Set((existingPlans ?? []).map((p: any) => p.visual_beat_id));
    const remainingBeatIds = allBeats.map((b: any) => b.id).filter((id: string) => !compiledBeatIds.has(id));
    if (remainingBeatIds.length && compiled.length && !skipped.length) {
      const nextBatch = remainingBeatIds.slice(0, 40);
      const chain = fetch(SELF_URL, {
        method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, beatIds: nextBatch, ownerUserId, generationRunId: explicitGenerationRunId }),
      }).catch((e: any) => console.error("[compile-long-form-scenes] self-chain failed", e));
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(chain); else await chain;
    }
  }

  return ok(req, { ok: true, compiled, skipped });
});
