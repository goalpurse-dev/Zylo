import test from "node:test";
import assert from "node:assert/strict";
import { classifySceneQA } from "../supabase/functions/_shared/sceneQA.ts";

// 2026-09-22 "FINAL stabilization pass" §14 — real Atlantis finding: Shot
// 16 had reference_asset_ids=[] (no reference image was ever supplied to
// the model) yet was classified failureType=REFERENCE_LEAKAGE — a
// structural impossibility (nothing was ever given to leak FROM). This is
// test #20 from the regression list: "REFERENCE_LEAKAGE impossible when no
// reference was used."

function goodQa(overrides = {}) {
  return {
    requiredCharactersPresent: true, characterIdentityConsistent: true, locationIdentityConsistent: true,
    actionMatchesDescription: true, framingMatchesShotSize: true, isCharacterSheetLayout: false,
    referenceLeakageDetected: false, multiPanelViolation: false, castCloningDetected: false, semanticPolarityViolated: false, forbiddenEntityPresent: false,
    textArtifactSeverity: "none", styleMismatchSeverity: "none", corruptionArtifacts: false, environmentIrrelevant: false,
    reasons: [], ...overrides,
  };
}

test("§14: referenceLeakageDetected=true is suppressed (never HARD_FAIL) when the context explicitly says no reference was supplied", () => {
  const r = classifySceneQA(goodQa({ referenceLeakageDetected: true }), { referencesSupplied: false });
  assert.notEqual(r.failureType, "REFERENCE_LEAKAGE");
  assert.equal(r.severity, "AUTO_READY");
});

test("§14: referenceLeakageDetected=true still HARD_FAILS when a reference genuinely was supplied", () => {
  const r = classifySceneQA(goodQa({ referenceLeakageDetected: true }), { referencesSupplied: true });
  assert.equal(r.failureType, "REFERENCE_LEAKAGE");
  assert.equal(r.severity, "HARD_FAIL");
});

test("§14: omitting referencesSupplied entirely preserves prior behavior (backward-compatible default) — still HARD_FAILS", () => {
  const r = classifySceneQA(goodQa({ referenceLeakageDetected: true }));
  assert.equal(r.failureType, "REFERENCE_LEAKAGE");
});

test("§14: isCharacterSheetLayout (a different signal — the WHOLE image is a sheet) is never affected by referencesSupplied — that defect needs no reference to occur", () => {
  const r = classifySceneQA(goodQa({ isCharacterSheetLayout: true }), { referencesSupplied: false });
  assert.equal(r.failureType, "REFERENCE_LEAKAGE");
  assert.equal(r.severity, "HARD_FAIL");
});
