// 2026-09-23 targeted, zero-cost correction for the real regression found
// after adopting v6: the FIRST run of the semantic-binding repair grouped
// by WHOLE MACRO, sweeping two valid, zero-cost REUSE beats (and possibly
// others never actually flagged) into repair regions alongside their
// genuinely defective siblings — the repair schema only offers GENERATE/
// PROGRAMMATIC_GRAPHIC, so those untouched-by-rights beats got silently
// force-converted into new paid GENERATE assignments. The detection/
// grouping code is now fixed (region.beatIds is ONLY the actually-flagged
// beats), but v6 already exists with the over-broad result baked in.
//
// Rather than re-running the LLM repair a second time (real cost, and no
// guarantee of identical output), this deterministically computes v7 = v6,
// with every beat v6 changed that should NOT have been touched (per the
// NOW-CORRECT detector run against the original v5) reverted BYTE-FOR-BYTE
// to its exact v5 value. Zero new OpenAI calls, zero image/video provider
// calls, zero credits. Defaults to --dry-run; pass --apply to persist+adopt.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { register } from "node:module";
register("../tests/assetStub.loader.mjs", import.meta.url);
if (typeof globalThis.Deno === "undefined") globalThis.Deno = { env: { get: () => undefined } };
if (typeof globalThis.Deno.serve === "undefined") globalThis.Deno.serve = () => undefined;

const { narrationCoverageIssues } = await import("../supabase/functions/_shared/visualPlanDeterministic.js");
const { validatePlanContract } = await import("../supabase/functions/_shared/visualDirectorReliability.js");
const { preflightEpisode } = await import("../supabase/functions/_shared/episodePreflight.ts");
const { detectFocalSubjectRepairRegions } = await import("../supabase/functions/_shared/visualPlanFocalSubjectRepair.ts");
const { detectSemanticBindingDefects } = await import("../supabase/functions/_shared/visualPlanSemanticBindingRepair.ts");

const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const V5 = "dae92f04-912f-4053-b348-ac11471c2b8d";
const V6 = "65412f9f-591b-425f-a380-782f887753ae";
const APPLY = process.argv.includes("--apply");
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: project } = await admin.from("long_form_projects").select("*").eq("id", PROJECT_ID).maybeSingle();
if (project.current_visual_plan_version_id !== V6) {
  console.error("REFUSING: project is not currently pointed at v6.", project.current_visual_plan_version_id);
  process.exit(1);
}
const { data: v5Row } = await admin.from("long_form_visual_plan_versions").select("*").eq("id", V5).maybeSingle();
const { data: v6Row } = await admin.from("long_form_visual_plan_versions").select("*").eq("id", V6).maybeSingle();

const correctDefects = detectSemanticBindingDefects(v5Row.visual_plan);
const correctBeatIds = new Set(correctDefects.map((d) => d.beatId));
console.log(`AUDIT: the FIXED detector finds ${correctBeatIds.size} genuinely-defective beats in v5 (source of truth).`);

const v5BeatsById = new Map(v5Row.visual_plan.visualBeats.map((b) => [b.id, b]));
let revertedCount = 0, keptRepairedCount = 0;
const revertedBeatIds = [];
const workingBeats = v6Row.visual_plan.visualBeats.map((b) => {
  if (b.repairMethod !== "semantic_binding_llm_repair") return b;
  if (correctBeatIds.has(b.id)) { keptRepairedCount++; return b; }
  // This beat was swept into a region by the OLD (whole-macro) bug even
  // though it was never actually flagged — revert it byte-for-byte.
  revertedCount++;
  revertedBeatIds.push(b.id);
  return v5BeatsById.get(b.id);
});
console.log(`Reverting ${revertedCount} wrongly-touched beat(s) to their exact v5 value:`, revertedBeatIds);
console.log(`Keeping ${keptRepairedCount} genuinely-repaired beat(s) from v6.`);

// Deliberately NEVER calls sequenceEpisode here: this is a pure, surgical
// revert of specific beats to their exact prior values, not a fresh repair
// pass. Re-running the pacing/diversity engine over this hybrid (part-v5,
// part-v6) sequence would re-litigate graphic-run-length/diversity counters
// across beats this operation never touched, risking a NEW, unrequested
// mutation on some third beat — confirmed live: doing so here spuriously
// re-flagged 5 beats that a same-logic scan WITHOUT re-sequencing found
// completely clean.
const workingPlan = { ...v6Row.visual_plan, visualBeats: workingBeats };

const contractVersionId = workingPlan.narrationContractVersionId;
const { data: contractRow } = await admin.from("long_form_narration_contract_versions").select("*").eq("id", contractVersionId).eq("project_id", PROJECT_ID).maybeSingle();
const { data: scriptRow } = await admin.from("long_form_script_versions").select("script_document").eq("id", v6Row.script_version_id).maybeSingle();

const afterDefects = detectSemanticBindingDefects(workingPlan);
const planForRepetitionCheck = { ...workingPlan, visualBeats: workingPlan.visualBeats.map((b) => (b.renderMethod === "PROGRAMMATIC_GRAPHIC" ? { ...b, subject: null } : b)) };
const focalSubjectRepetitionAfter = detectFocalSubjectRepairRegions(planForRepetitionCheck);
const contractErrors = validatePlanContract(workingPlan, contractRow, project.current_script_version_id);
const coverageIssues = narrationCoverageIssues(workingPlan.visualBeats, scriptRow.script_document.narrationSegments ?? []);
const narrationCoverageOk = coverageIssues.length === 0;

const { data: compat } = await admin.rpc("long_form_visual_world_compatibility", { p_project_id: PROJECT_ID });
let afterPreflight = { ok: true, errors: [] };
if (compat?.visualWorldVersionId) {
  const [{ data: world }, { data: assetsForPreflight }] = await Promise.all([
    admin.from("long_form_visual_world_versions").select("*").eq("id", compat.visualWorldVersionId).maybeSingle(),
    admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", compat.visualWorldVersionId),
  ]);
  afterPreflight = preflightEpisode({ project: { ...project, scene_generation_tier: project.scene_generation_tier ?? "v3" }, plan: workingPlan, world, assets: assetsForPreflight ?? [], contract: contractRow });
}
const remainingDuplicateBeatIds = [...new Set(afterPreflight.errors.filter((e) => e.reason?.startsWith("DUPLICATE_GENERATE_PROMPT")).flatMap((e) => [e.beatId, e.reason.split(":")[1]]).filter(Boolean))];

const ready = contractErrors.length === 0 && narrationCoverageOk && afterDefects.length === 0 && focalSubjectRepetitionAfter.length === 0 && remainingDuplicateBeatIds.length === 0 && afterPreflight.ok;

console.log("\n=== VALIDATION ===");
console.log("contractErrors:", contractErrors.length, contractErrors.slice(0, 5));
console.log("narrationCoverageOk:", narrationCoverageOk, coverageIssues.slice(0, 5));
console.log("remainingSemanticBindingDefects:", afterDefects.length, [...new Set(afterDefects.flatMap((d) => d.reasons))]);
console.log("focalSubjectRepetitionAfter:", focalSubjectRepetitionAfter.length);
console.log("remainingDuplicateBeatIds:", remainingDuplicateBeatIds.length);
console.log("afterPreflight.ok:", afterPreflight.ok, "errors:", afterPreflight.errors.length, afterPreflight.errors.slice(0, 5));
console.log("READY:", ready);

const byRenderMethod = {};
for (const b of workingPlan.visualBeats) byRenderMethod[b.renderMethod] = (byRenderMethod[b.renderMethod] ?? 0) + 1;
console.log("byRenderMethod:", byRenderMethod);
console.log("modelCalls: 0 (deterministic revert only) | imageProviderCallsMade: 0 | creditsCharged: 0");

if (!APPLY) {
  console.log("\nDRY RUN ONLY (pass --apply to persist+adopt if ready). Not applying.");
  process.exit(0);
}
if (!ready) {
  console.log("\nNOT READY — refusing to apply. v6 remains adopted.");
  process.exit(1);
}

const { data: dest, error: applyError } = await admin.rpc("apply_long_form_storyboard_repair", {
  p_source_id: v6Row.id, p_user_id: project.user_id, p_repaired_plan: workingPlan, p_storyboard_summary: v6Row.storyboard_summary,
  p_repair_meta: { source: "semantic_binding_repair_overbroad_revert", revertedCount, keptRepairedCount, modelCalls: 0, estimatedTotalCostUsd: 0 },
});
if (applyError) {
  console.error("APPLY FAILED:", applyError);
  process.exit(1);
}
console.log("\nAPPLIED. New Visual Plan version id:", dest.id, "version", dest.version);
