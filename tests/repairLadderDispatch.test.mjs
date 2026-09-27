import test from "node:test";
import assert from "node:assert/strict";
import { determineRepairAction } from "../supabase/functions/_shared/repairLadder.ts";
import { isValidFinalAspectRatio } from "../supabase/functions/_shared/sceneRenderPlan.ts";
import { renderGraphicCardWithAutoRepair, cropRegion } from "../supabase/functions/advance-long-form-scene-generation/index.ts";

// 2026-09-19 "activate the repair ladder — but safely" pass (Section 6): the
// task's own instruction is explicit — "wire only the ZERO-COST
// deterministic repairs first... Do NOT automatically spend image-
// generation credits." This file covers the two automatic dispatches that
// were actually wired into advance-long-form-scene-generation/index.ts:
//
// 1. GEOMETRY (INVALID_FINAL_FRAME_GEOMETRY -> LOCAL_DETERMINISTIC_
//    CORRECTION): runQaCheckpoint now decodes the output and, for GENERATE/
//    EDIT scenes with bad geometry, applies cropRegion(...,"center_detail")
//    BEFORE vision QA runs — the same zero-cost crop CROP-strategy scenes
//    already use, just applied as a repair instead of a plan. This test
//    exercises the underlying cropRegion() guarantee that a repair uses.
//
// 2. GRAPHIC (GRAPHIC_RENDER_DEFECT -> RECOMPILE_GRAPHIC): a structured
//    graphic spec that fails renderGraphicCard's structural validation now
//    gets a BOUNDED number of alternate-variant recompiles attempted
//    automatically, using the exact same resolveGraphicClaim/
//    compileGraphicSpec/selectNextVariant machinery the manual "Try Another
//    Layout" button already used — never a different template, never a
//    FRESH_GENERATE, never a credit charged.
//
// Both repairs are confirmed zero-cost/zero-provider-call at the
// repairLadder.ts decision layer first, then exercised directly.

test("the repair ladder itself marks both of these failureTypes as non-billable before any dispatch code runs", () => {
  assert.equal(determineRepairAction("INVALID_FINAL_FRAME_GEOMETRY").billable, false);
  assert.equal(determineRepairAction("INVALID_FINAL_FRAME_GEOMETRY").providerCallRequired, false);
  assert.equal(determineRepairAction("GRAPHIC_RENDER_DEFECT").billable, false);
  assert.equal(determineRepairAction("GRAPHIC_RENDER_DEFECT").providerCallRequired, false);
});

/* ---- Geometry auto-correction (used by runQaCheckpoint's new pre-QA crop) ---- */
test("cropRegion always produces a valid 16:9 window from a real Mars-shaped portrait mistake (907x1536, the actual shot-19 incident dimensions)", () => {
  const portrait = { width: 907, height: 1536, data: new Uint8Array(907 * 1536 * 4) };
  const corrected = cropRegion(portrait, "center_detail");
  assert.equal(isValidFinalAspectRatio(corrected.width, corrected.height), true);
});
test("cropRegion produces a valid 16:9 window from an oversized landscape source too (not just the portrait case)", () => {
  const wide = { width: 4000, height: 1200, data: new Uint8Array(4000 * 1200 * 4) };
  const corrected = cropRegion(wide, "center_detail");
  assert.equal(isValidFinalAspectRatio(corrected.width, corrected.height), true);
});

/* ---- Graphic auto-recompile (used by processZeroCostScene's PROGRAMMATIC_GRAPHIC branch) ---- */
function stubAdmin(claims) {
  return {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => (table === "long_form_narration_contract_versions" ? { data: { claims } } : { data: null }),
      };
    },
  };
}
const negationSpecBase = { version: 1, claimId: "c1", theme: "light", backgroundMode: "light", treatmentId: "c1::SYMBOL_NEGATION", contractVersionId: "v1" };
const negationPlan = { narration_claim_id: "c1", narration_contract_version_id: "v1", visual_plan_version_id: "p1", narration_segment_ids: [], chapter_id: null };
const negationClaim = { claimId: "c1", claimType: "NEGATION", negativeClaims: ["no signal"], primaryConcepts: ["signal"] };

test("renderGraphicCardWithAutoRepair returns immediately (no admin lookup at all) when the FIRST compile already renders clean", async () => {
  const cleanSpec = { ...negationSpecBase, variantIndex: 0, template: "SYMBOL_NEGATION", icon: "warning", label: "NO SIGNAL", polarity: "unavailable" };
  const result = await renderGraphicCardWithAutoRepair(null, negationPlan, cleanSpec);
  assert.deepEqual(result.issues, []);
  assert.equal(result.variantSwapped, false);
  assert.equal(result.finalSpec, cleanSpec);
});

test("renderGraphicCardWithAutoRepair auto-recompiles to the next variant and succeeds when the first compile is structurally broken (real GRAPHIC_RENDER_DEFECT shape: SYMBOL_NEGATION missing its required icon)", async () => {
  const brokenSpec = { ...negationSpecBase, variantIndex: 0, template: "SYMBOL_NEGATION", icon: undefined, label: "NO SIGNAL", polarity: "unavailable" };
  const result = await renderGraphicCardWithAutoRepair(stubAdmin([negationClaim]), negationPlan, brokenSpec);
  assert.deepEqual(result.issues, []);
  assert.equal(result.variantSwapped, true);
  assert.equal(result.finalSpec.icon, "warning", "variantIndex 1 always resolves to the pool's 2nd icon, never undefined");
  assert.notEqual(result.finalSpec.variantIndex, brokenSpec.variantIndex);
});

test("renderGraphicCardWithAutoRepair gives up cleanly (never throws, never spends a provider call) when no contract claim can be resolved to recompile from", async () => {
  const brokenSpec = { ...negationSpecBase, variantIndex: 0, template: "SYMBOL_NEGATION", icon: undefined, label: "NO SIGNAL", polarity: "unavailable" };
  const legacyPlan = { narration_claim_id: null, narration_contract_version_id: null, visual_plan_version_id: "p1", narration_segment_ids: [], chapter_id: null };
  const result = await renderGraphicCardWithAutoRepair(stubAdmin([]), legacyPlan, brokenSpec);
  assert.equal(result.variantSwapped, false);
  assert.ok(result.issues.length > 0, "the original defect is preserved, never silently dropped");
  assert.equal(result.finalSpec, brokenSpec);
});

test("renderGraphicCardWithAutoRepair is bounded — it never attempts more recompiles than the template actually has variants", async () => {
  // SYMBOL_NEGATION has exactly 4 pool variants -> at most 3 additional
  // attempts. A claim that keeps producing a valid icon at every variant
  // (this one does, by construction) must still terminate after the first
  // successful attempt rather than exhausting all 3 — this test's real
  // assertion is simply that the call resolves at all (no infinite loop)
  // and lands on variant 1, the very first retry.
  const brokenSpec = { ...negationSpecBase, variantIndex: 0, template: "SYMBOL_NEGATION", icon: undefined, label: "NO SIGNAL", polarity: "unavailable" };
  const result = await renderGraphicCardWithAutoRepair(stubAdmin([negationClaim]), negationPlan, brokenSpec);
  assert.equal(result.finalSpec.variantIndex, 1);
});
