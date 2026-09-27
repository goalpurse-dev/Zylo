// deno-lint-ignore-file no-explicit-any
// repair-long-form-visual-plan-focal-subjects/index.ts
//
// 2026-09-22 "targeted Visual Plan repair" pass — generic, topic-agnostic
// repair for FOCAL_SUBJECT_REPETITION. Real, live finding this closes
// (confirmed by reading actual persisted contracts): a macro sequence's own
// primaryEntityIds correctly declared several distinct valid subjects, yet
// every one of its expanded shots still resolved to the same single
// fallback subject, because per-shot subject resolution
// (visualShotPlanning.js's shotEntityIds) falls back to the shared
// narration claim's one primarySubject whenever no candidate entity's name
// is literally quoted in that shot's own narration text — collapsing every
// shot in the macro onto one static visual regardless of how much the
// narration actually moves between shots.
//
// Architecture (generic — works for any topic/format, never hardcodes an
// entity/topic name):
//   CURRENT adopted plan
//   -> detectFocalSubjectRepairRegions (deterministic, zero cost)
//   -> for each region: ONE real OpenAI text call (buildFocalSubjectRepairInput
//      + FOCAL_SUBJECT_REPAIR_INSTRUCTIONS) asking for the narration-MEANING-
//      driven subject, never a keyword match, never a hardcoded fallback
//   -> mergeFocalSubjectRepairIntoPlan (only subject/display/visualType/
//      provenance fields change; timing/render_strategy/baseSetupKey/
//      forbidden elements/etc. are copied verbatim from the parent)
//   -> global deterministic validation (contract validity, narration
//      coverage, no remaining FOCAL_SUBJECT_REPETITION, no new duplicate-
//      prompt families)
//   -> only if clean: apply_long_form_storyboard_repair (the SAME generic,
//      already-existing, already-tested atomic-version RPC "Fix Storyboard"
//      uses — it persists any validated plan JSON as a new version with a
//      parent pointer, so no new SQL migration is needed for this repair)
//
// This makes exactly one kind of provider call: a text-only OpenAI
// "reasoning" call, one per repair region, to judge narration MEANING —
// never an image/video generation call (no Runware/Kling call exists
// anywhere in this file), and never a user credit charge (this endpoint
// never touches profiles.credit_balance or any *_charges table).
//
// POST { projectId, dryRun }
// Returns { ok, dryRun, ready, regionsFound, regionsRepaired,
//   beforeBeatCount, afterBeatCount, preservedBeatCount, changedBeatCount,
//   focalSubjectRepetitionBefore, focalSubjectRepetitionAfter,
//   remainingDuplicateBeatIds, narrationCoverageOk, modelCalls,
//   estimatedModelCostUsd, newVisualPlanVersionId? }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { narrationCoverageIssues } from "../_shared/visualPlanDeterministic.js";
import { validatePlanContract, sequenceEpisode } from "../_shared/visualDirectorReliability.js";
import { preflightEpisode } from "../_shared/episodePreflight.ts";
import { GPT5_MINI_INPUT_PER_M, GPT5_MINI_OUTPUT_PER_M } from "../../../src/lib/longFormPipelineConstants.ts";
import {
  detectFocalSubjectRepairRegions, buildFocalSubjectRepairSchema, buildFocalSubjectRepairInput,
  mergeFocalSubjectRepairIntoPlan, FOCAL_SUBJECT_REPAIR_INSTRUCTIONS, type RepairRegion,
} from "../_shared/visualPlanFocalSubjectRepair.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
// Same published per-token pricing this codebase already uses for every
// other gpt-5-mini planning call (advance-long-form-visual-plan.ts) — kept
// in sync deliberately, not re-derived.
// Phase 0, Section C.3 — GPT5_MINI_INPUT_PER_M/OUTPUT_PER_M now imported
// from the shared constants module above.

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (typeof content?.text === "string") return content.text;
  return "";
}

async function callFocalSubjectRepair(region: RepairRegion, input: any, usage: { inputTokens: number; outputTokens: number; modelCalls: number }) {
  const beatIds = input.shots.map((s: any) => s.beatId);
  const response = await fetch(OPENAI_RESPONSES, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      max_output_tokens: 8000,
      store: false,
      instructions: FOCAL_SUBJECT_REPAIR_INSTRUCTIONS,
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name: "focal_subject_repair", strict: true, schema: buildFocalSubjectRepairSchema(beatIds) } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 400)}`);
  const payload = await response.json();
  if (payload?.usage) {
    usage.inputTokens += payload.usage.input_tokens ?? 0;
    usage.outputTokens += payload.usage.output_tokens ?? 0;
    usage.modelCalls += 1;
  }
  const parsed = JSON.parse(extractOutputText(payload).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  const shots = Array.isArray(parsed?.shots) ? parsed.shots : [];
  // Defensive: an LLM naming an entity outside the candidate list it was
  // actually given is a compile-time contract violation, not a soft
  // preference — never silently trusted through to the merge.
  const candidateIdsByBeat = new Map(input.shots.map((s: any) => [s.beatId, new Set(s.candidateEntities.map((c: any) => c.id))]));
  for (const shot of shots) {
    if (shot.focalEntityId && !candidateIdsByBeat.get(shot.beatId)?.has(shot.focalEntityId)) {
      throw new Error(`FOCAL_SUBJECT_REPAIR_INVALID_ENTITY: ${shot.beatId} chose ${shot.focalEntityId}, not in its own candidate list`);
    }
  }
  return shots;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const dryRun = Boolean(body?.dryRun);
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (projectError || !project || project.user_id !== user.id) return err(req, "Project not found", 404);
  if (!project.current_visual_plan_version_id) return err(req, "No current Visual Plan to repair", 404);

  const { data: source, error: planError } = await admin.from("long_form_visual_plan_versions").select("*").eq("id", project.current_visual_plan_version_id).maybeSingle();
  if (planError || !source || source.status !== "ready" || source.script_version_id !== project.current_script_version_id) {
    return err(req, "This Visual Plan isn't in a repairable state right now.", 422);
  }

  const contractVersionId = source.visual_plan?.narrationContractVersionId;
  if (!contractVersionId) return err(req, "This Visual Plan has no narration contract to repair against.", 422);
  const { data: contractRow } = await admin.from("long_form_narration_contract_versions").select("*").eq("id", contractVersionId).eq("project_id", projectId).maybeSingle();
  if (!contractRow || contractRow.status !== "ready" || contractRow.script_version_id !== project.current_script_version_id || !contractRow.claims?.length) {
    return err(req, "This Visual Plan's narration contract isn't ready.", 422);
  }
  const { data: scriptRow } = await admin.from("long_form_script_versions").select("script_document").eq("id", source.script_version_id).maybeSingle();
  if (!scriptRow?.script_document) return err(req, "Narration script not found", 404);

  const beforePlan = source.visual_plan;
  const regions = detectFocalSubjectRepairRegions(beforePlan);
  const focalSubjectRepetitionBefore = regions.map((r) => ({ regionId: r.regionId, macroSequenceIds: r.macroSequenceIds, beatCount: r.beatIds.length, reason: r.reason, repeatedSubjects: r.repeatedSubjects }));

  if (!regions.length) {
    return ok(req, { ok: true, dryRun, ready: true, regionsFound: 0, regionsRepaired: 0, beforeBeatCount: beforePlan.visualBeats.length, afterBeatCount: beforePlan.visualBeats.length, preservedBeatCount: beforePlan.visualBeats.length, changedBeatCount: 0, focalSubjectRepetitionBefore: [], focalSubjectRepetitionAfter: [], modelCalls: 0, estimatedModelCostUsd: 0, message: "No FOCAL_SUBJECT_REPETITION regions detected — nothing to repair." });
  }

  // Reference availability — pure INFORMATION for the repair call (§F: the
  // Scene Director decides the visual FIRST; a reference existing is never
  // itself a reason to choose an entity). Compatible Visual World only.
  const { data: compat } = await admin.rpc("long_form_visual_world_compatibility", { p_project_id: projectId });
  const referenceAvailabilityByEntityId = new Map<string, boolean>();
  if (compat?.visualWorldVersionId) {
    const { data: assets } = await admin.from("long_form_reference_assets").select("entity_id,status,qa_status").eq("visual_world_version_id", compat.visualWorldVersionId);
    for (const a of assets ?? []) {
      if (a.status === "succeeded" && (a.qa_status === "approved" || a.qa_status === null)) referenceAvailabilityByEntityId.set(a.entity_id, true);
    }
  }
  const entityRegistryById = new Map((beforePlan.entityRegistry ?? []).map((e: any) => [e.id, e]));

  // 2026-09-22 — bounded convergence loop. A single repair pass over a
  // region can itself introduce a NEW repetitive run (real observed case:
  // several consecutive shots each adding one point to the same on-screen
  // checklist all converged on the checklist GRAPHIC itself as their
  // chosen subject — thematically coherent, still visually repetitive).
  // Rather than hand-tune the prompt for every narrative pattern that
  // could cause this (which would not generalize to "millions of possible
  // topics"), re-detect after each pass and repair whatever remains,
  // bounded so a genuinely unresolvable case fails closed into "needs
  // review" instead of looping forever or silently adopting a plan that
  // still has a known defect.
  const MAX_REPAIR_ITERATIONS = 3;
  const usage = { inputTokens: 0, outputTokens: 0, modelCalls: 0 };
  let workingPlan = beforePlan;
  const regionResults: any[] = [];
  let iteration = 0;
  let pendingRegions = regions;
  while (pendingRegions.length && iteration < MAX_REPAIR_ITERATIONS) {
    iteration++;
    for (const region of pendingRegions) {
      const input = buildFocalSubjectRepairInput(region, workingPlan, entityRegistryById, referenceAvailabilityByEntityId);
      try {
        const repairedShots = await callFocalSubjectRepair(region, input, usage);
        const merged = mergeFocalSubjectRepairIntoPlan(workingPlan, region, repairedShots, source.id);
        workingPlan = merged.plan;
        regionResults.push({ regionId: region.regionId, macroSequenceIds: region.macroSequenceIds, changedCount: merged.changedCount, unchangedInRegionCount: merged.unchangedInRegionCount, iteration, ok: true });
      } catch (e) {
        console.error("[repair-long-form-visual-plan-focal-subjects] region repair failed (region left untouched):", region.regionId, e);
        regionResults.push({ regionId: region.regionId, macroSequenceIds: region.macroSequenceIds, iteration, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    pendingRegions = detectFocalSubjectRepairRegions(workingPlan);
  }

  sequenceEpisode(workingPlan.visualBeats);
  const focalSubjectRepetitionAfter = pendingRegions.map((r) => ({ regionId: r.regionId, macroSequenceIds: r.macroSequenceIds, beatCount: r.beatIds.length, reason: r.reason, repeatedSubjects: r.repeatedSubjects }));

  // ---- Global deterministic validation (§G) — the SAME narration-contract
  // validator, coverage checker, and duplicate-prompt compile-check the
  // existing "Fix Storyboard" repair already relies on, plus the
  // repetition re-check above.
  const contractErrors = validatePlanContract(workingPlan, contractRow, project.current_script_version_id);
  const coverageIssues = narrationCoverageIssues(workingPlan.visualBeats, scriptRow.script_document.narrationSegments ?? []);
  const narrationCoverageOk = coverageIssues.length === 0;

  const [{ data: world }, { data: assetsForPreflight }] = compat?.visualWorldVersionId
    ? await Promise.all([
        admin.from("long_form_visual_world_versions").select("*").eq("id", compat.visualWorldVersionId).maybeSingle(),
        admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", compat.visualWorldVersionId),
      ])
    : [{ data: null }, { data: [] }];
  const preflightContext = { project: { ...project, scene_generation_tier: project.scene_generation_tier ?? "v3" }, plan: workingPlan, world, assets: assetsForPreflight ?? [], contract: contractRow };
  const afterPreflight = world ? preflightEpisode(preflightContext) : { ok: true, errors: [] as any[] };
  const remainingDuplicateBeatIds = [...new Set(afterPreflight.errors.filter((e: any) => e.reason?.startsWith("DUPLICATE_GENERATE_PROMPT")).flatMap((e: any) => [e.beatId, e.reason.split(":")[1]]).filter(Boolean))];

  const allRegionsRepaired = regionResults.every((r) => r.ok);
  const ready = allRegionsRepaired && contractErrors.length === 0 && narrationCoverageOk && focalSubjectRepetitionAfter.length === 0 && remainingDuplicateBeatIds.length === 0 && afterPreflight.ok;

  // Counted from the final plan itself (never summed across iterations) —
  // a beat re-touched in a later convergence pass must count once, not
  // once per pass it was part of a detected region.
  const changedBeatCount = workingPlan.visualBeats.filter((b: any) => b.repairMethod === "focal_subject_llm_repair").length;
  const estimatedModelCostUsd = Number(((usage.inputTokens * GPT5_MINI_INPUT_PER_M + usage.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000).toFixed(4));

  const stats = {
    regionsFound: regions.length,
    regionsRepaired: regionResults.filter((r) => r.ok).length,
    regionResults,
    convergenceIterationsUsed: iteration,
    convergedWithinBound: pendingRegions.length === 0,
    beforeBeatCount: beforePlan.visualBeats.length,
    afterBeatCount: workingPlan.visualBeats.length,
    preservedBeatCount: workingPlan.visualBeats.length - changedBeatCount,
    changedBeatCount,
    focalSubjectRepetitionBefore,
    focalSubjectRepetitionAfter,
    contractErrors: contractErrors.slice(0, 10),
    narrationCoverageOk,
    coverageIssues: coverageIssues.slice(0, 10),
    remainingDuplicateBeatIds,
    modelCalls: usage.modelCalls,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedModelCostUsd,
    imageProviderCallsMade: 0,
    creditsCharged: 0,
  };

  if (dryRun || !ready) {
    return ok(req, { ok: true, dryRun: true, ready, ...stats });
  }

  const { data: dest, error: applyError } = await admin.rpc("apply_long_form_storyboard_repair", {
    p_source_id: source.id, p_user_id: user.id, p_repaired_plan: workingPlan, p_storyboard_summary: source.storyboard_summary,
    p_repair_meta: {
      source: "focal_subject_repetition_repair", regionsRepaired: stats.regionsRepaired, changedBeatCount,
      modelCalls: usage.modelCalls, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedTotalCostUsd: estimatedModelCostUsd,
    },
  });
  if (applyError) {
    const message = applyError.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("STORYBOARD_CHANGED") ? 409 : message.includes("REPLAN_IN_PROGRESS") ? 409 : 500;
    return err(req, status === 409 ? "The Visual Plan changed since this repair started — please refresh and try again." : "Could not apply the Visual Plan repair.", status);
  }

  return ok(req, { ok: true, dryRun: false, ready: true, ...stats, newVisualPlanVersionId: dest.id });
});
