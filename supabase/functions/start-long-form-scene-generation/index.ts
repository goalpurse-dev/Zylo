// deno-lint-ignore-file no-explicit-any
// start-long-form-scene-generation/index.ts
//
// Turns a READY VisualPlan + READY Visual World into durable, versioned
// SceneRenderPlans (Part 3) and their first long_form_scenes attempt rows.
// Does NOT replan the story — every VisualBeat field (shotSize, visualType,
// shotStrategy, renderMethod, baseSetupKey, timing, narration, factual/
// forbidden constraints) is consumed verbatim; this only adds the
// deterministic + LLM-judged PRODUCTION decisions described in
// _shared/sceneRenderPlan.ts.
//
// CONTROLLED ROLLOUT GUARDRAIL (Part 42): `beatIds` is REQUIRED, not
// optional with an "all beats" default — this endpoint structurally cannot
// compile the whole ~115-shot plan in one call. A future full-rollout call
// simply passes every beat id; nothing else changes.
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
  deriveSceneType, deriveRenderStrategy, resolveSourceBeatId, requiredReferenceLookups,
  buildSceneDirectorSchema, SCENE_DIRECTOR_INSTRUCTIONS, compileScenePrompt, compileEditInstruction,
  deriveSceneQAExpectations, SCENE_RENDER_PLAN_COMPILER_VERSION, canSatisfyCrop,
} from "../_shared/sceneRenderPlan.ts";
import { compileClaimRendererNotes } from "../_shared/narrationVisualContract.ts";
import { compileGraphicSpec, validatePinnedClaim } from "../_shared/graphicSpec.ts";
import { resolveReferenceCriticality, selectMinimalReferenceSet, buildUnreferencedCharacterNote, assessMultiCharacterReferenceSafety } from "../_shared/sceneRenderPlan.ts";
import { resolveLongFormSceneRenderer } from "../_shared/sceneRendererTiers.ts";
import { getMaxReferenceImages } from "../_shared/imageDimensionPolicy.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCENE_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`;
const SELF_URL = `${SUPABASE_URL}/functions/v1/start-long-form-scene-generation`;

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (typeof content?.text === "string") return content.text;
  return "";
}
async function runSceneDirector(beats: any[]) {
  if (!beats.length) return { scenes: [] };
  const beatIds = beats.map((b) => b.id);
  const input = beats.map((b) => ({
    beatId: b.id, shotSize: b.shotSize, visualType: b.visualType, shotStrategy: b.shotStrategy, renderMethod: b.renderMethod,
    sketchContext: b.sketchContext, informationToCommunicate: b.informationToCommunicate, deltaInstruction: b.deltaInstruction,
    availableCameraAnchors: b.__availableCameraAnchors ?? [], narrativeFunction: b.narrativeFunction,
  }));
  const response = await fetch(OPENAI_RESPONSES, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL, reasoning: { effort: "low" }, max_output_tokens: 20000, store: false,
      instructions: SCENE_DIRECTOR_INSTRUCTIONS,
      input: JSON.stringify({ beats: input }),
      text: { format: { type: "json_schema", name: "scene_director", strict: true, schema: buildSceneDirectorSchema(beatIds) } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`SCENE_DIRECTOR_CALL_FAILED: ${response.status} ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json();
  return JSON.parse(extractOutputText(payload).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const body = await req.json().catch(() => ({}));

  // Two callers: (a) a real signed-in user hitting this directly (kept for
  // parity/manual testing), and (b) charge-long-form-episode-generation's
  // own trusted server-to-server batch-compile calls AFTER it has already
  // charged credits and validated ownership itself — those carry the
  // service role key plus an explicit ownerUserId instead of a user JWT
  // (a service-role key is not a real user session, so requireUser would
  // reject it). The internal path still re-verifies ownership below exactly
  // like the user path — it only skips re-deriving user.id from a JWT.
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
  // Part 4/7/9 (2026-09-15 "safe full-episode rebuild" pass): a rebuild
  // recompiles every beat as a genuinely NEW SceneRenderPlan version — never
  // an in-place upsert onto plan_version=1, which would silently mutate/
  // replace the previous generation run's already-rendered plan (exactly
  // what long_form_scene_render_plans' own header comment forbids: "a new
  // plan_version is a full replacement, never an in-place mutation of a
  // plan already used to render a scene"). Only the rebuild orchestrator
  // (rebuild-long-form-episode-generation) ever sets this; the normal
  // Generate Episode / controlled-test-batch path is completely unchanged
  // (plan_version stays 1, scenes stay upsertable while unpaid/undispatched).
  const forceNewPlanVersion = body?.forceNewPlanVersion === true;
  const explicitGenerationRunId = body?.generationRunId ? String(body.generationRunId) : undefined;
  // Chapter testing mode compiles exactly the charged chapter. Normal paid
  // episode generation keeps the existing self-healing whole-plan chain.
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
  // shotSize beat can never be satisfied by CROP while staying 16:9 (see
  // canSatisfyCrop's own doc comment — the real Mars shot-19 incident this
  // closes shipped a literal 907x1536 portrait PNG from exactly this
  // combination). Escalating here, once, before any plan row is written,
  // means every downstream consumer (source-beat resolution, reference
  // lookups, the Scene Director batch, cost estimation) already sees the
  // corrected GENERATE strategy — never a CROP plan row that would need
  // fixing up after the fact.
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

  // Part 4 of the 2026-09-17 "fix PROGRAMMATIC_GRAPHIC" pass: NEVER read
  // project.current_narration_contract_version_id here — that pointer can
  // move (or, as the real Mars audit found, sit NULL) independently of
  // which contract version this SPECIFIC plan's beats were actually
  // authored against. The pinned value lives on the plan itself
  // (advance-long-form-visual-plan stamps it in at compile time) — resolve
  // EXACTLY that version, or none at all. A plan with no pin (compiled
  // before this system existed) falls back to no semantic notes, exactly
  // the prior behavior — never a silent "use whatever's current" guess.
  const pinnedContractVersionId: string | null = plan.narrationContractVersionId ?? null;
  let claimsById = new Map<string, any>();
  if (pinnedContractVersionId) {
    const { data: contractRow } = await admin.from("long_form_narration_contract_versions").select("claims").eq("id", pinnedContractVersionId).maybeSingle();
    claimsById = new Map((contractRow?.claims ?? []).map((c: any) => [c.claimId, c]));
  }

  // Part 10: every freshly-compiled scene is attributed to the CURRENTLY
  // active paid charge (if one exists) — this is what lets the frontend
  // exclude old pre-charge test/dev scenes from a real run's own Ready/
  // Needs Review progress counters while still compiling normally when
  // nothing has been charged yet (e.g. a controlled test batch), in which
  // case generation_run_id stays null, exactly like the historical rows.
  let generationRunId: string | null = explicitGenerationRunId ?? null;
  if (!generationRunId) {
    const { data: activeCharge } = await admin.from("long_form_episode_generation_charges").select("id").eq("project_id", projectId).eq("status", "charged").maybeSingle();
    generationRunId = activeCharge?.id ?? null;
  }

  // Transitively include any missing base GENERATE beat a requested
  // REUSE/EDIT/CROP beat depends on — a test-batch pick of e.g. "one reuse
  // shot" must not fail for lack of the base it reuses; this stays a small,
  // bounded expansion (one base per requested beat, never a cascade of
  // unrelated shots) and is reported back so the caller sees exactly what
  // was actually compiled.
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

  // Dependency order: beats with no source first, then dependents — so a
  // dependent's source plan row always exists by the time we compile it.
  const orderedBeats = [...beatIdSet].map((id) => beatsById.get(id)).filter(Boolean)
    .sort((a: any, b: any) => a.sequenceIndex - b.sequenceIndex);

  // Per-beat next plan_version for a rebuild — grouped in ONE query rather
  // than one per beat. A beat that was never compiled before (e.g. added by
  // a later storyboard revision) has no existing rows and correctly starts
  // at version 1 even inside a rebuild call.
  const nextPlanVersionByBeatId = new Map<string, number>();
  if (forceNewPlanVersion) {
    const { data: existingVersions } = await admin.from("long_form_scene_render_plans").select("visual_beat_id, plan_version").eq("visual_world_version_id", world.id).in("visual_beat_id", orderedBeats.map((b: any) => b.id));
    for (const row of existingVersions ?? []) {
      const current = nextPlanVersionByBeatId.get(row.visual_beat_id) ?? 0;
      if (row.plan_version > current) nextPlanVersionByBeatId.set(row.visual_beat_id, row.plan_version);
    }
  }

  // Same deterministic compiler as the charge boundary; never skip an invalid beat.
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

      const planVersion = forceNewPlanVersion ? (nextPlanVersionByBeatId.get(beat.id) ?? 0) + 1 : 1;
      const { data: planRowInserted, error: planInsertError } = await admin.from("long_form_scene_render_plans").upsert({
        project_id: project.id, visual_world_version_id: world.id, visual_plan_version_id: planRow.id, visual_beat_id: beat.id, plan_version: planVersion,
        chapter_id: effectiveBeat.chapterId, sequence_index: effectiveBeat.sequenceIndex, narration_segment_ids: effectiveBeat.narrationSegmentIds ?? [],
        start_seconds: effectiveBeat.estimatedStartSeconds, end_seconds: effectiveBeat.estimatedEndSeconds, communication_goal: effectiveBeat.shotPurpose ?? effectiveBeat.informationToCommunicate,
        narrative_function: effectiveBeat.narrativeFunction, scene_type: sceneType, continuity_group_id: effectiveBeat.continuityGroupId, base_setup_key: effectiveBeat.baseSetupKey,
        composition: { shotSize: effectiveBeat.shotSize, cameraFraming: director.cameraFraming, focalSubject: director.focalSubject, focalEntityId: director.focalEntityId ?? null, displaySubject: director.displaySubject ?? director.focalSubject, cameraAnchor: director.cameraAnchor, cropRegion: director.cropRegion, visualDelta: effectiveBeat.visualDelta ?? null },
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
        const { data: sceneRow, error: sceneInsertError } = await admin.from("long_form_scenes").insert({
          scene_render_plan_id: planRowInserted.id, visual_world_version_id: world.id, visual_beat_id: beat.id,
          status: "pending", render_strategy: renderStrategy, input_reference_asset_ids: referenceAssetIds,
          generation_run_id: generationRunId,
        }).select("id").single();
        if (sceneInsertError) throw sceneInsertError;
        sceneId = sceneRow.id;
      } else if (generationRunId) {
        // Adopt an already-ready controlled-test scene into the paid run so
        // authoritative partial-work quotes and the refreshed UI agree.
        await admin.from("long_form_scenes").update({ generation_run_id: generationRunId }).eq("id", sceneId).is("generation_run_id", null);
      }
      compiled.push({ beatId: beat.id, sceneId, renderStrategy, sceneType });
    } catch (error) {
      skipped.push({ beatId: beat.id, reason: error instanceof Error ? error.message : "COMPILE_FAILED" });
    }
  }

  if (compiled.length) {
    fetch(ADVANCE_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId: world.id }) }).catch(() => {});
  }

  // Self-chain until the WHOLE plan is durably compiled (Part 7 — real
  // incident: Mars's 201-credit charge only ever got 80 of 136 beats
  // compiled because the caller's own batch loop was killed mid-flight with
  // no way to resume). Only the trusted server-to-server path (the real
  // paid Generate Episode flow) self-chains automatically; a direct
  // manually-triggered call keeps Part 42's original controlled-batch
  // behavior (compiles exactly the beats asked for, nothing more) so ad-hoc
  // testing never silently balloons into a full-plan compile.
  if (isInternalServiceCall && !scopeBeatIdsOnly) {
    const { data: existingPlans } = await admin.from("long_form_scene_render_plans").select("visual_beat_id").eq("visual_world_version_id", world.id).eq("visual_plan_version_id", planRow.id);
    const compiledBeatIds = new Set((existingPlans ?? []).map((p: any) => p.visual_beat_id));
    const remainingBeatIds = allBeats.map((b: any) => b.id).filter((id: string) => !compiledBeatIds.has(id));
    if (remainingBeatIds.length && compiled.length && !skipped.length) {
      const nextBatch = remainingBeatIds.slice(0, 40);
      const chain = fetch(SELF_URL, {
        method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, beatIds: nextBatch, ownerUserId }),
      }).catch((e: any) => console.error("[start-long-form-scene-generation] self-chain failed", e));
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(chain); else await chain;
    }
  }

  return ok(req, { ok: true, compiled, skipped });
});
