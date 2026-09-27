// 2026-09-22 "targeted Visual Plan repair" pass — LIVE execution script.
// Runs the EXACT SAME repair logic as the deployed
// repair-long-form-visual-plan-focal-subjects edge function (imports the
// identical shared module — no duplicated/drifted logic), invoked directly
// against the real database + OpenAI so it can run outside an
// authenticated HTTP request in this session. Defaults to --dry-run;
// pass --apply to actually persist+adopt vNext (only happens if every
// validation gate passes).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { register } from "node:module";
register("../tests/assetStub.loader.mjs", import.meta.url);
if (typeof globalThis.Deno === "undefined") globalThis.Deno = { env: { get: () => undefined } };
if (typeof globalThis.Deno.serve === "undefined") globalThis.Deno.serve = () => undefined;

const { narrationCoverageIssues } = await import("../supabase/functions/_shared/visualPlanDeterministic.js");
const { validatePlanContract, sequenceEpisode } = await import("../supabase/functions/_shared/visualDirectorReliability.js");
const { preflightEpisode } = await import("../supabase/functions/_shared/episodePreflight.ts");
const {
  detectFocalSubjectRepairRegions, buildFocalSubjectRepairSchema, buildFocalSubjectRepairInput,
  mergeFocalSubjectRepairIntoPlan, FOCAL_SUBJECT_REPAIR_INSTRUCTIONS,
} = await import("../supabase/functions/_shared/visualPlanFocalSubjectRepair.ts");

const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const APPLY = process.argv.includes("--apply");
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = "gpt-5-mini";
const GPT5_MINI_INPUT_PER_M = 0.25, GPT5_MINI_OUTPUT_PER_M = 2.0;

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (typeof content?.text === "string") return content.text;
  return "";
}

async function callFocalSubjectRepair(region, input, usage) {
  const beatIds = input.shots.map((s) => s.beatId);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL, reasoning: { effort: "low" }, max_output_tokens: 8000, store: false,
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
  const candidateIdsByBeat = new Map(input.shots.map((s) => [s.beatId, new Set(s.candidateEntities.map((c) => c.id))]));
  for (const shot of shots) {
    if (shot.focalEntityId && !candidateIdsByBeat.get(shot.beatId)?.has(shot.focalEntityId)) {
      throw new Error(`FOCAL_SUBJECT_REPAIR_INVALID_ENTITY: ${shot.beatId} chose ${shot.focalEntityId}, not in its own candidate list`);
    }
  }
  return shots;
}

const { data: project } = await admin.from("long_form_projects").select("*").eq("id", PROJECT_ID).maybeSingle();
const { data: source } = await admin.from("long_form_visual_plan_versions").select("*").eq("id", project.current_visual_plan_version_id).maybeSingle();
console.log("AUDIT: current_visual_plan_version_id =", project.current_visual_plan_version_id, "version", source.version, "status", source.status);
console.log("AUDIT: current_script_version_id =", project.current_script_version_id, "matches plan's script_version_id:", source.script_version_id === project.current_script_version_id);

const contractVersionId = source.visual_plan?.narrationContractVersionId;
const { data: contractRow } = await admin.from("long_form_narration_contract_versions").select("*").eq("id", contractVersionId).eq("project_id", PROJECT_ID).maybeSingle();
const { data: scriptRow } = await admin.from("long_form_script_versions").select("script_document").eq("id", source.script_version_id).maybeSingle();

const beforePlan = source.visual_plan;
console.log("AUDIT: total macros (visualSequences) =", beforePlan.visualSequences.length, "| total expanded beats (visualBeats) =", beforePlan.visualBeats.length, "| continuityGroups =", beforePlan.continuityGroups.length, "| chapters =", scriptRow.script_document.chapters.length);

const regions = detectFocalSubjectRepairRegions(beforePlan);
console.log(`\nAUDIT: detected ${regions.length} FOCAL_SUBJECT_REPETITION region(s):`);
for (const r of regions) console.log(" -", r.regionId, "| macros:", r.macroSequenceIds.join(","), "| beats:", r.beatIds.length, "| reason:", r.reason);

if (!regions.length) {
  console.log("\nNo repair needed — exiting.");
  process.exit(0);
}

const { data: compat } = await admin.rpc("long_form_visual_world_compatibility", { p_project_id: PROJECT_ID });
const referenceAvailabilityByEntityId = new Map();
if (compat?.visualWorldVersionId) {
  const { data: assets } = await admin.from("long_form_reference_assets").select("entity_id,status,qa_status").eq("visual_world_version_id", compat.visualWorldVersionId);
  for (const a of assets ?? []) if (a.status === "succeeded" && (a.qa_status === "approved" || a.qa_status === null)) referenceAvailabilityByEntityId.set(a.entity_id, true);
}
const entityRegistryById = new Map((beforePlan.entityRegistry ?? []).map((e) => [e.id, e]));

// Bounded convergence loop — mirrors the deployed edge function exactly. A
// single pass can itself introduce a new repetitive run (real observed
// case: several shots each adding one point to the same on-screen
// checklist all converged on the checklist GRAPHIC as their subject) —
// re-detect after each pass and repair whatever remains, bounded so a
// genuinely unresolvable case fails closed rather than looping forever.
const MAX_REPAIR_ITERATIONS = 3;
const usage = { inputTokens: 0, outputTokens: 0, modelCalls: 0 };
let workingPlan = beforePlan;
const regionResults = [];
let iterationCount = 0;
let pendingRegions = regions;
console.log("\nRepairing regions (real OpenAI text call per region — no image/video provider call)...");
while (pendingRegions.length && iterationCount < MAX_REPAIR_ITERATIONS) {
  iterationCount++;
  console.log(`\n--- convergence pass ${iterationCount} (${pendingRegions.length} region(s)) ---`);
  for (const region of pendingRegions) {
    const input = buildFocalSubjectRepairInput(region, workingPlan, entityRegistryById, referenceAvailabilityByEntityId);
    try {
      const repairedShots = await callFocalSubjectRepair(region, input, usage);
      const merged = mergeFocalSubjectRepairIntoPlan(workingPlan, region, repairedShots, source.id);
      workingPlan = merged.plan;
      regionResults.push({ regionId: region.regionId, macroSequenceIds: region.macroSequenceIds, changedCount: merged.changedCount, unchangedInRegionCount: merged.unchangedInRegionCount, iteration: iterationCount, ok: true });
      console.log(` - ${region.regionId}: repaired ${merged.changedCount} shot(s)`);
      for (const s of repairedShots) console.log(`     ${s.beatId}: subject -> ${s.focalEntityId ?? s.displaySubject} (${s.visualType}) | ${s.narrationMeaning}`);
    } catch (e) {
      console.error(` - ${region.regionId}: FAILED —`, e.message);
      regionResults.push({ regionId: region.regionId, macroSequenceIds: region.macroSequenceIds, iteration: iterationCount, ok: false, error: e.message });
    }
  }
  pendingRegions = detectFocalSubjectRepairRegions(workingPlan);
}
console.log(`\nConvergence: ${pendingRegions.length === 0 ? "CLEAN" : "NOT CLEAN"} after ${iterationCount} pass(es). Remaining regions:`, pendingRegions.map((r) => r.regionId));

sequenceEpisode(workingPlan.visualBeats);
const focalSubjectRepetitionAfter = pendingRegions;
const contractErrors = validatePlanContract(workingPlan, contractRow, project.current_script_version_id);
const coverageIssues = narrationCoverageIssues(workingPlan.visualBeats, scriptRow.script_document.narrationSegments ?? []);
const narrationCoverageOk = coverageIssues.length === 0;

let afterPreflight = { ok: true, errors: [] };
if (compat?.visualWorldVersionId) {
  const [{ data: world }, { data: assetsForPreflight }] = await Promise.all([
    admin.from("long_form_visual_world_versions").select("*").eq("id", compat.visualWorldVersionId).maybeSingle(),
    admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", compat.visualWorldVersionId),
  ]);
  afterPreflight = preflightEpisode({ project: { ...project, scene_generation_tier: project.scene_generation_tier ?? "v3" }, plan: workingPlan, world, assets: assetsForPreflight ?? [], contract: contractRow });
}
const remainingDuplicateBeatIds = [...new Set(afterPreflight.errors.filter((e) => e.reason?.startsWith("DUPLICATE_GENERATE_PROMPT")).flatMap((e) => [e.beatId, e.reason.split(":")[1]]).filter(Boolean))];

const allRegionsRepaired = regionResults.every((r) => r.ok);
const ready = allRegionsRepaired && contractErrors.length === 0 && narrationCoverageOk && focalSubjectRepetitionAfter.length === 0 && remainingDuplicateBeatIds.length === 0 && afterPreflight.ok;
const changedBeatCount = workingPlan.visualBeats.filter((b) => b.repairMethod === "focal_subject_llm_repair").length;
const estimatedModelCostUsd = Number(((usage.inputTokens * GPT5_MINI_INPUT_PER_M + usage.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000).toFixed(4));

console.log("\n=== VALIDATION ===");
console.log("allRegionsRepaired:", allRegionsRepaired);
console.log("contractErrors:", contractErrors.length, contractErrors.slice(0, 5));
console.log("narrationCoverageOk:", narrationCoverageOk, coverageIssues.slice(0, 5));
console.log("focalSubjectRepetitionAfter:", focalSubjectRepetitionAfter.length, focalSubjectRepetitionAfter.map(r => r.regionId));
console.log("remainingDuplicateBeatIds:", remainingDuplicateBeatIds.length);
console.log("afterPreflight.ok:", afterPreflight.ok, "errors:", afterPreflight.errors.length);
console.log("READY:", ready);
console.log("beforeBeatCount:", beforePlan.visualBeats.length, "afterBeatCount:", workingPlan.visualBeats.length, "changedBeatCount:", changedBeatCount, "preservedBeatCount:", workingPlan.visualBeats.length - changedBeatCount);
console.log("modelCalls:", usage.modelCalls, "inputTokens:", usage.inputTokens, "outputTokens:", usage.outputTokens, "estimatedModelCostUsd:", estimatedModelCostUsd);
console.log("imageProviderCallsMade: 0 | creditsCharged: 0");

if (!APPLY) {
  console.log("\nDRY RUN ONLY (pass --apply to persist+adopt if ready). Not applying.");
  process.exit(0);
}
if (!ready) {
  console.log("\nNOT READY — refusing to apply. Old plan remains adopted.");
  process.exit(1);
}

const { data: dest, error: applyError } = await admin.rpc("apply_long_form_storyboard_repair", {
  p_source_id: source.id, p_user_id: project.user_id, p_repaired_plan: workingPlan, p_storyboard_summary: source.storyboard_summary,
  p_repair_meta: { source: "focal_subject_repetition_repair", regionsRepaired: regionResults.filter(r => r.ok).length, changedBeatCount, modelCalls: usage.modelCalls, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedTotalCostUsd: estimatedModelCostUsd },
});
if (applyError) {
  console.error("APPLY FAILED:", applyError);
  process.exit(1);
}
console.log("\nAPPLIED. New Visual Plan version id:", dest.id, "version", dest.version);
