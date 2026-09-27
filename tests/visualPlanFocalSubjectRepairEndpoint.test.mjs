import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "targeted Visual Plan repair" pass — safety-invariant tests
// for the orchestrating edge function. Source-pattern tests matching this
// repo's own established convention for a Deno edge function entrypoint
// with no fetch-mock harness (see repair-long-form-storyboard's own
// tests, reuseNeverOutlivesSourceQA.test.mjs, etc).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/repair-long-form-visual-plan-focal-subjects/index.ts";

test("this endpoint never calls an image/video provider function or endpoint — no runware-image/runware-video/job-worker invocation anywhere in the code (prose mentions in comments are fine)", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /"runware-image"|"runware-video"|"job-worker"|functions\/v1\/runware|kickJobWorker|ensureSceneJob/);
});

test("this endpoint never touches credit balance or any *_charges table — no user is ever billed by this repair", async () => {
  const text = await source(FN);
  // No functional read/write of any billing surface — never a `.from(...)`
  // targeting a charges table, and no `.update(` writing credit_balance.
  assert.doesNotMatch(text, /\.from\("[a-zA-Z_]*_charges"\)/);
  assert.doesNotMatch(text, /\.update\(\{[^}]*credit_balance/);
  assert.match(text, /creditsCharged: 0/);
  assert.match(text, /imageProviderCallsMade: 0/);
});

test("it reuses the EXISTING generic apply_long_form_storyboard_repair RPC — no new SQL migration required for persistence", async () => {
  const text = await source(FN);
  assert.match(text, /admin\.rpc\("apply_long_form_storyboard_repair"/);
});

test("it never adopts a repaired plan unless `ready` (every validation gate passed) — dryRun or !ready both stop before the apply RPC", async () => {
  const text = await source(FN);
  assert.match(text, /if \(dryRun \|\| !ready\) \{\s*\n\s*return ok\(req, \{ ok: true, dryRun: true, ready, \.\.\.stats \}\);\s*\n\s*\}/);
  const applyIndex = text.indexOf('admin.rpc("apply_long_form_storyboard_repair"');
  const gateIndex = text.indexOf("if (dryRun || !ready)");
  assert.ok(gateIndex >= 0 && applyIndex > gateIndex, "the readiness gate must appear before the apply call in source order");
});

test("readiness requires ALL of: every region repaired, contract validation, narration coverage, zero remaining repetition, zero new duplicate prompts, and a clean preflight compile", async () => {
  const text = await source(FN);
  assert.match(text, /const ready = allRegionsRepaired && contractErrors\.length === 0 && narrationCoverageOk && focalSubjectRepetitionAfter\.length === 0 && remainingDuplicateBeatIds\.length === 0 && afterPreflight\.ok;/);
});

test("an LLM response naming an entity outside that shot's own candidate list is rejected, never silently trusted", async () => {
  const text = await source(FN);
  assert.match(text, /FOCAL_SUBJECT_REPAIR_INVALID_ENTITY/);
});

test("the repair loop re-detects and repairs remaining regions in bounded convergence passes — a single pass can introduce a new repetitive run (e.g. several shots converging on one shared checklist graphic), so this never trusts one pass as final", async () => {
  const text = await source(FN);
  assert.match(text, /const MAX_REPAIR_ITERATIONS = 3;/);
  assert.match(text, /while \(pendingRegions\.length && iteration < MAX_REPAIR_ITERATIONS\) \{/);
  assert.match(text, /pendingRegions = detectFocalSubjectRepairRegions\(workingPlan\);/);
});

test("changedBeatCount is counted from the FINAL plan's own repairMethod marker, never summed across convergence passes — a beat re-touched in a later pass must count once", async () => {
  const text = await source(FN);
  assert.match(text, /workingPlan\.visualBeats\.filter\(\(b: any\) => b\.repairMethod === "focal_subject_llm_repair"\)\.length/);
});

test("a single region's repair failure never aborts the whole run — it's recorded and left untouched (preservedFromParent), other regions still proceed", async () => {
  const text = await source(FN);
  const loopBlock = text.slice(text.indexOf("for (const region of pendingRegions)"), text.indexOf("sequenceEpisode(workingPlan"));
  assert.match(loopBlock, /catch \(e\) \{/);
  assert.match(loopBlock, /region repair failed \(region left untouched\)/);
});

test("ownership/staleness are enforced before any repair work begins (project.user_id check, plan status='ready', script_version match)", async () => {
  const text = await source(FN);
  assert.match(text, /project\.user_id !== user\.id/);
  assert.match(text, /source\.status !== "ready" \|\| source\.script_version_id !== project\.current_script_version_id/);
});

test("reference availability is passed as information only — computed from Visual World assets, never used to filter/force a candidate entity choice before the LLM call", async () => {
  const text = await source(FN);
  assert.match(text, /referenceAvailabilityByEntityId/);
  // The map is built straight from status/qa_status, never used in an if/filter gating which entities are OFFERED to the model.
  assert.doesNotMatch(text, /candidateEntities\.filter/);
});
