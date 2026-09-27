import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-23 "final targeted Atlantis Visual Plan repair" pass — same
// safety-property conventions as visualPlanFocalSubjectRepairEndpoint.test.mjs
// for its sibling repair endpoint.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/repair-long-form-visual-plan-semantic-bindings/index.ts";

test("this endpoint never calls an image/video provider function or endpoint", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /functions\/v1\/(runware-image|runware-video|job-worker)|ensureSceneJob|kickJobWorker/);
});

test("this endpoint never touches credit balance or any *_charges table — no user is ever billed by this repair", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /\.from\("profiles"\)|\.from\("[a-zA-Z_]*_charges"\)|credit_balance\s*[-+]?=/);
});

test("it reuses the EXISTING generic apply_long_form_storyboard_repair RPC — no new SQL migration required for persistence", async () => {
  const text = await source(FN);
  assert.match(text, /\.rpc\("apply_long_form_storyboard_repair"/);
});

test("it never adopts a repaired plan unless `ready` (every validation gate passed) — dryRun or !ready both stop before the apply RPC", async () => {
  const text = await source(FN);
  assert.match(text, /if \(dryRun \|\| !ready\) \{/);
  const applyIdx = text.indexOf('.rpc("apply_long_form_storyboard_repair"');
  const gateIdx = text.indexOf("if (dryRun || !ready)");
  assert.ok(gateIdx > -1 && applyIdx > gateIdx, "the apply RPC call must come AFTER the ready gate");
});

test("readiness requires ALL of: every region repaired, contract validation, narration coverage, zero remaining semantic-binding defects, zero reintroduced FOCAL_SUBJECT_REPETITION, zero new duplicate prompts, and a clean preflight compile", async () => {
  const text = await source(FN);
  assert.match(text, /const ready = allRegionsRepaired && contractErrors\.length === 0 && narrationCoverageOk/);
  assert.match(text, /&& afterDefects\.length === 0 && focalSubjectRepetitionAfter\.length === 0/);
  assert.match(text, /&& remainingDuplicateBeatIds\.length === 0 && afterPreflight\.ok;/);
});

test("never reintroduces the PRIOR repair pass's own defect class — re-runs detectFocalSubjectRepairRegions on the repaired plan, scoped to exclude PROGRAMMATIC_GRAPHIC beats (whose rendered content is claim-driven, not subject-label-driven)", async () => {
  const text = await source(FN);
  assert.match(text, /import \{ detectFocalSubjectRepairRegions \} from "\.\.\/_shared\/visualPlanFocalSubjectRepair\.ts";/);
  assert.match(text, /b\.renderMethod === "PROGRAMMATIC_GRAPHIC" \? \{ \.\.\.b, subject: null \} : b/);
  assert.match(text, /const focalSubjectRepetitionAfter = detectFocalSubjectRepairRegions\(planForRepetitionCheck\);/);
});

test("an LLM response naming an entity outside that shot's own candidate list is rejected, never silently trusted", async () => {
  const text = await source(FN);
  assert.match(text, /SEMANTIC_BINDING_REPAIR_INVALID_ENTITY/);
});

test("the repair loop re-detects and repairs remaining defects in bounded convergence passes — never trusts one pass as final", async () => {
  const text = await source(FN);
  assert.match(text, /const MAX_REPAIR_ITERATIONS = 3;/);
  assert.match(text, /while \(pendingRegions\.length && iteration < MAX_REPAIR_ITERATIONS\)/);
});

test("changedBeatCount is counted from the FINAL plan's own repairMethod marker, never summed across convergence passes", async () => {
  const text = await source(FN);
  assert.match(text, /const changedBeatCount = workingPlan\.visualBeats\.filter\(\(b: any\) => b\.repairMethod === "semantic_binding_llm_repair"\)\.length;/);
});

test("a single region's repair failure never aborts the whole run — it's recorded and left untouched, other regions still proceed", async () => {
  const text = await source(FN);
  assert.match(text, /catch \(e\) \{/);
  assert.match(text, /region repair failed \(region left untouched\)/);
});

test("ownership/staleness are enforced before any repair work begins (project.user_id check, plan status='ready', script_version match)", async () => {
  const text = await source(FN);
  assert.match(text, /project\.user_id !== user\.id/);
  assert.match(text, /source\.status !== "ready" \|\| source\.script_version_id !== project\.current_script_version_id/);
});
