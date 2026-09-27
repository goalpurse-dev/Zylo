import test from "node:test";
import assert from "node:assert/strict";
import { compileGraphicSpec } from "../supabase/functions/_shared/graphicSpec.ts";

// 2026-09-20 "fix unsupported graphic claim" pass — real Mars finding:
// claim s16__c3 ("The chamber's CO2 returned to nominal over the following
// hours") failed to compile into ANY of the 11 templates despite having a
// clean, structured stateBefore/stateAfter pair and a short
// textOverlayCandidate, because (1) BEFORE_AFTER only checked
// comparisonClaims (empty here — comparisonClaims is for an explicit
// two-sided COMPARISON claimType, not every state-change claim), (2)
// TIMELINE required >=2 markers but this claim only has 1 real temporal
// point, and (3) the TEXT_EMPHASIS fallback used a plain ?? chain that
// picked the first EXISTING candidate (a 20-word visualCommunicationGoal)
// rather than the first one that actually fit the 12-word limit.

// Exact real claim from Mars's saved forensic snapshot (artifacts/mars-
// forensic/v1-reliability-input.json, claimId s16__c3).
const mars_s16_c3 = {
  claimId: "s16__c3", emphasis: "HIGH", claimType: "TIMELINE", confidence: 0.92,
  stateAfter: "CO2 back to nominal within hours", stateBefore: "elevated or off-nominal CO2 in the flagged chamber",
  planningMode: "EXPLAINER", narrationText: "The chamber's CO2 returned to nominal over the following hours;",
  negativeClaims: [], positiveClaims: ["the chamber's CO2 level returned to nominal over the following hours"],
  primarySubject: "chamber's CO2 level", temporalClaims: ["CO2 returned to nominal over the following hours"],
  primaryConcepts: ["chamber", "CO2 returned to nominal", "following hours"], allowedAmbiguity: "LOW",
  comparisonClaims: [], causeEffectClaims: [], entitiesMentioned: ["the chamber", "CO2"], forbiddenEntities: [],
  graphicPrimitives: ["TIMELINE_BAR", "SIMPLE_CHART", "NUMBER"],
  entityRequirements: [{ entity: "the chamber (previously flagged)", criticality: "MEDIUM" }, { entity: "CO2 indicator/readout for that chamber", criticality: "HIGH" }],
  quantitativeClaims: [], narrationSegmentIds: ["s16"],
  requiredVisualFacts: ["CO2 readout for the chamber shows a return to nominal levels over a timescale of hours (e.g., a timestamped trend or before/after readouts)"],
  forbiddenVisualFacts: [], preferredVisualForms: ["BEFORE_AFTER", "TIMELINE", "CHART"],
  textOverlayCandidate: { importance: "MEDIUM", recommended: true, semanticText: "CO2 → NOMINAL" },
  continuityRequirement: "MEDIUM",
  visualCommunicationGoal: "Show that after the manual fix, the specific chamber's CO2 levels trended back to nominal over a span of hours.",
};

test("REAL MARS CLAIM s16__c3 now compiles (previously the one unsupported graphic claim in the whole plan)", () => {
  const result = compileGraphicSpec(mars_s16_c3, { theme: "dark", contractVersionId: "contract-1" });
  assert.equal(result.ok, true, result.ok ? "" : `still failing: ${result.reason}`);
});

test("it compiles via BEFORE_AFTER, using the claim's own real stateBefore/stateAfter — never invented content", () => {
  const result = compileGraphicSpec(mars_s16_c3, { theme: "dark", contractVersionId: "contract-1" });
  assert.equal(result.spec.template, "BEFORE_AFTER");
  assert.match(result.spec.beforeLabel, /elevated|off-nominal/i);
  assert.match(result.spec.afterLabel, /CO2/i, "the real stateAfter text, truncated at a word boundary — never invented");
});

test("a claim with stateBefore/stateAfter but ALSO real comparisonClaims is unaffected — existing comparisonClaims-based matching still wins", () => {
  const claimWithComparison = { ...mars_s16_c3, comparisonClaims: ["one long paired EVA versus several short trips"] };
  const result = compileGraphicSpec(claimWithComparison, { theme: "dark", contractVersionId: "contract-1", variantIndex: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.spec.template, "COMPARISON", "comparisonClaims-based matching must take priority, unchanged from before this fix");
});

test("identical stateBefore/stateAfter (no real change) does not spuriously trigger BEFORE_AFTER", () => {
  const noChangeClaim = { ...mars_s16_c3, stateBefore: "nominal", stateAfter: "nominal" };
  const result = compileGraphicSpec(noChangeClaim, { theme: "dark", contractVersionId: "contract-1" });
  // Falls through to TEXT_EMPHASIS via textOverlayCandidate/visualCommunicationGoal-derived short text — never BEFORE_AFTER with two identical labels.
  assert.notEqual(result.ok && result.spec.template, "BEFORE_AFTER");
});

test("TEXT_EMPHASIS fallback tries every candidate in priority order and uses the first that actually fits, instead of failing on a too-long first candidate", () => {
  const claim = {
    claimId: "c1", claimType: "FACT", negativeClaims: [], comparisonClaims: [], causeEffectClaims: [], temporalClaims: [],
    graphicPrimitives: [], preferredVisualForms: [], quantitativeClaims: [],
    stateBefore: null, stateAfter: null,
    visualCommunicationGoal: "This is a deliberately long communication goal sentence that exceeds the twelve word emphasis ceiling easily.",
    primaryConcepts: ["short label"],
    narrationText: "Also a long narration sentence that would exceed the word count if tried first instead.",
  };
  const result = compileGraphicSpec(claim, { theme: "light", contractVersionId: null });
  assert.equal(result.ok, true, "must fall through past the too-long visualCommunicationGoal to the short primaryConcepts[0]");
  assert.equal(result.spec.template, "TEXT_EMPHASIS");
  assert.equal(result.spec.text, "short label");
});
