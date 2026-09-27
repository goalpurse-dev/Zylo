import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classifySceneQA } from "../supabase/functions/_shared/sceneQA.ts";
import { determineRepairAction } from "../supabase/functions/_shared/repairLadder.ts";

// 2026-09-22 "FINAL stabilization pass" §2/§14/§19 — real Atlantis finding:
// Shot 1 required exactly ONE character (Plato) but generated TWO physical
// instances of him in the frame; castCloningDetected (which only asks
// about DIFFERENT roles sharing one face) structurally could not catch
// this and correctly reported false, so the real defect went entirely
// unclassified. New duplicateCharacterInstanceDetected signal + a
// CHARACTER_DUPLICATION repair-ladder entry close this gap. Also verifies
// the repair ladder's decision (built since "production visual reliability
// v2" but never consumed anywhere) now actually reaches the persisted
// qa_result on a Phase 1 rejection.

function goodQa(overrides = {}) {
  return {
    requiredCharactersPresent: true, characterIdentityConsistent: true, locationIdentityConsistent: true,
    actionMatchesDescription: true, framingMatchesShotSize: true, isCharacterSheetLayout: false,
    referenceLeakageDetected: false, multiPanelViolation: false, castCloningDetected: false, duplicateCharacterInstanceDetected: false,
    semanticPolarityViolated: false, forbiddenEntityPresent: false,
    textArtifactSeverity: "none", styleMismatchSeverity: "none", corruptionArtifacts: false, environmentIrrelevant: false,
    reasons: [], ...overrides,
  };
}

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("§2/§14: duplicateCharacterInstanceDetected=true HARD_FAILS with a DISTINCT failureType (CHARACTER_DUPLICATION), never conflated with CHARACTER_CLONE", () => {
  const r = classifySceneQA(goodQa({ duplicateCharacterInstanceDetected: true }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "CHARACTER_DUPLICATION");
});

test("§2/§14: castCloningDetected and duplicateCharacterInstanceDetected are independent — one being false never masks the other being true", () => {
  const cloneOnly = classifySceneQA(goodQa({ castCloningDetected: true, duplicateCharacterInstanceDetected: false }));
  assert.equal(cloneOnly.failureType, "CHARACTER_CLONE");
  const duplicateOnly = classifySceneQA(goodQa({ castCloningDetected: false, duplicateCharacterInstanceDetected: true }));
  assert.equal(duplicateOnly.failureType, "CHARACTER_DUPLICATION");
});

test("§19: the repair ladder maps CHARACTER_DUPLICATION to a billable FRESH_GENERATE with an explicit single-instance/count-constraint reason", () => {
  const decision = determineRepairAction("CHARACTER_DUPLICATION");
  assert.equal(decision.action, "FRESH_GENERATE");
  assert.equal(decision.billable, true);
  assert.match(decision.reason, /single-instance identity anchor/);
});

test("§19: a Phase 1 QA rejection attaches the repair-ladder decision (repairAction/repairBillable) to the persisted qa_result — the decision table existed but nothing consumed it before this pass", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const gateBlock = text.slice(text.indexOf("if (!result.approved) {"), text.indexOf("if (!result.approved) {") + 1400);
  assert.match(gateBlock, /const repair = determineRepairAction\(result\.failureType \?\? null\);/);
  assert.match(gateBlock, /\(result as any\)\.repairAction = repair\.action;/);
  assert.match(gateBlock, /\(result as any\)\.repairBillable = repair\.billable;/);
});

test("§19: a BILLABLE repair is never auto-triggered as a real provider call inside runQaCheckpoint — it stays a decision attached to qa_result, surfaced to the existing user-driven Regenerate flow", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const gateBlock = text.slice(text.indexOf("if (!result.approved) {"), text.indexOf("if (!result.approved) {") + 1400);
  // No dispatch of a fresh job/provider call inside this specific branch.
  assert.doesNotMatch(gateBlock, /ensureSceneJob|kickJobWorker/);
});
