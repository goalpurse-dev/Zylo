import test from "node:test";
import assert from "node:assert/strict";
import { classifySceneQA, recomputeSceneApproval } from "../supabase/functions/_shared/sceneQA.ts";

// "Rebuild the Visual Director around narration meaning" (2026-09-15) —
// Sections 17-22/26 (H-L). Real Mars baseline this targets: 24 AUTO_READY /
// 96 NEEDS_REVIEW / 16 HARD_FAIL out of 136 (way too much manual review).
// These tests lock in the new 3-tier classification's actual thresholds.
//
// UPDATED 2026-09-17 ("long-form quality pass", Part 5): severity is now
// exactly {AUTO_READY, SOFT_WARNING, HARD_FAIL} and `requiresReview` is a
// SEPARATE boolean — NEEDS_REVIEW is no longer a severity value at all.
// SOFT_WARNING is still `approved:true` ("Ready") — the review's own
// explicit rule: "Do NOT make SOFT_WARNING automatically mean Needs
// Review." Only `requiresReview:true` gates a scene behind a human, and it
// is reserved for genuine semantic uncertainty (action/framing signals, or
// QA being unavailable) — never for cosmetic signals, no matter how many
// stack. Critical-text hard-blocking is now conditioned on
// `ctx.criticalTextRequired` (Part 4's exact-text policy) rather than
// firing on ANY major legible text — a beat with no critical-text
// requirement is real INCIDENTAL_AI_TEXT territory (SOFT_WARNING, not a
// block), which is the direct fix for "too many genuinely usable scenes
// become Needs Review."

function goodResult(overrides = {}) {
  return {
    requiredCharactersPresent: true, characterIdentityConsistent: true, locationIdentityConsistent: true,
    actionMatchesDescription: true, framingMatchesShotSize: true, isCharacterSheetLayout: false,
    referenceLeakageDetected: false, semanticPolarityViolated: false, forbiddenEntityPresent: false,
    textArtifactSeverity: "none", styleMismatchSeverity: "none", corruptionArtifacts: false, environmentIrrelevant: false,
    reasons: [],
    ...overrides,
  };
}

/* H: reference board detected in final scene -> HARD FAIL / REFERENCE_LEAKAGE, not Needs Review */
test("H: referenceLeakageDetected is always a HARD_FAIL with REFERENCE_LEAKAGE, never merely Needs Review", () => {
  const r = classifySceneQA(goodResult({ referenceLeakageDetected: true }));
  assert.equal(r.approved, false);
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "REFERENCE_LEAKAGE");
  assert.match(r.repairStrategy, /reference routing/);
});
test("isCharacterSheetLayout (the whole image IS a sheet) is also HARD_FAIL/REFERENCE_LEAKAGE — the same repair route, a distinct detection signal", () => {
  const r = classifySceneQA(goodResult({ isCharacterSheetLayout: true }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "REFERENCE_LEAKAGE");
});

/* I: tiny irrelevant text artifact -> does not necessarily force human review */
test("I: a LONE minor text artifact is Ready (approved), surfaced as SOFT_WARNING rather than silently absorbed into AUTO_READY or forced into review", () => {
  const r = classifySceneQA(goodResult({ textArtifactSeverity: "minor" }));
  assert.equal(r.approved, true);
  assert.equal(r.severity, "SOFT_WARNING");
  assert.equal(r.requiresReview, false);
});
test("two or more minor signals compounding together STILL stay Ready — Part 5 explicitly forbids a quota/count-based escalation to review", () => {
  const r = classifySceneQA(goodResult({ textArtifactSeverity: "minor", styleMismatchSeverity: "minor" }));
  assert.equal(r.approved, true);
  assert.equal(r.severity, "SOFT_WARNING");
  assert.equal(r.requiresReview, false);
});

/* J: wrong semantic polarity -> hard fail */
test("J: semanticPolarityViolated is a HARD_FAIL/SEMANTIC_CONTRADICTION", () => {
  const r = classifySceneQA(goodResult({ semanticPolarityViolated: true }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "SEMANTIC_CONTRADICTION");
});

/* K: same image returned for a requested fresh composition -> low-diversity hard failure/repair route */
test("K: visualDeltaSatisfied:false (a near-duplicate where a real change was required) is HARD_FAIL/LOW_DIVERSITY with a fresh-GENERATE repair route", () => {
  const r = classifySceneQA(goodResult({ visualDeltaSatisfied: false }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "LOW_DIVERSITY");
  assert.match(r.repairStrategy, /fresh GENERATE/);
});

/* L: character identity only LOW importance in background -> minor mismatch does not hard fail */
// (classifySceneQA itself takes characterIdentityConsistent as a boolean the
// VISION MODEL already weighted by criticality via the qaContext prompt —
// this test locks in that once the model says "consistent" at LOW
// criticality, nothing here re-escalates it; the importance-weighting
// itself is a PROMPT-level behavior verified separately below.)
test("L: characterIdentityConsistent:true never becomes a failure regardless of what criticality context was used to reach that verdict", () => {
  const r = classifySceneQA(goodResult({ characterIdentityConsistent: true }));
  assert.equal(r.severity, "AUTO_READY");
});
test("characterIdentityConsistent:false is always HARD_FAIL/IDENTITY_DRIFT — the criticality weighting happens in the PROMPT (what counts as 'consistent'), not by softening the gate afterward", () => {
  const r = classifySceneQA(goodResult({ characterIdentityConsistent: false }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "IDENTITY_DRIFT");
});

/* Other hard-fail examples from Section 18 */
test("forbiddenEntityPresent is a HARD_FAIL", () => {
  const r = classifySceneQA(goodResult({ forbiddenEntityPresent: true }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "FORBIDDEN_ENTITY_PRESENT");
});
test("a missing required subject/character is a HARD_FAIL, not Needs Review", () => {
  const r = classifySceneQA(goodResult({ requiredCharactersPresent: false }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "REQUIRED_SUBJECT_MISSING");
});
test("severe corruption is a HARD_FAIL", () => {
  const r = classifySceneQA(goodResult({ corruptionArtifacts: true }));
  assert.equal(r.severity, "HARD_FAIL");
});
test("Part 4/5: major legible text on a beat that actually needs that fact (criticalTextRequired) is a HARD_FAIL unless a VERIFIED overlay covers it — a merely PLANNED overlay (hasProgrammaticTextOverlay, no verification) is no longer enough on its own", () => {
  const criticalNoOverlay = classifySceneQA(goodResult({ textArtifactSeverity: "major" }), { criticalTextRequired: true });
  assert.equal(criticalNoOverlay.severity, "HARD_FAIL");
  assert.equal(criticalNoOverlay.failureType, "CRITICAL_TEXT");
  const criticalVerifiedOverlay = classifySceneQA(goodResult({ textArtifactSeverity: "major" }), { criticalTextRequired: true, hasVerifiedOverlay: true });
  assert.equal(criticalVerifiedOverlay.approved, true);
  // The legacy hasProgrammaticTextOverlay flag (a PLANNED overlay, from
  // before Part 6's verification concept existed) still works as an
  // alternate carve-out for backward compatibility with any caller that
  // hasn't been updated to pass hasVerifiedOverlay yet.
  const legacyPlannedOverlay = classifySceneQA(goodResult({ textArtifactSeverity: "major" }), { criticalTextRequired: true, hasProgrammaticTextOverlay: true });
  assert.equal(legacyPlannedOverlay.approved, true);
});
test("Part 4/5 (the direct 'too many Needs Review' fix): major legible text on a beat with NO critical-text requirement is real incidental AI text — SOFT_WARNING, never a HARD_FAIL", () => {
  const r = classifySceneQA(goodResult({ textArtifactSeverity: "major" }), { criticalTextRequired: false });
  assert.equal(r.approved, true);
  assert.equal(r.severity, "SOFT_WARNING");
  assert.equal(r.failureType, "INCIDENTAL_TEXT");
});

/* Part 5's own HARD_FAIL example list names this directly: "missing essential action/object" */
test("a missing/absent required action is a HARD_FAIL (ACTION_OR_OBJECT_MISSING), not silently approved and not merely flagged for review", () => {
  const r = classifySceneQA(goodResult({ actionMatchesDescription: false }));
  assert.equal(r.approved, false);
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.requiresReview, false);
  assert.equal(r.failureType, "ACTION_OR_OBJECT_MISSING");
});
/* Part 5's own SOFT_WARNING example list names this directly: "slight framing difference" */
test("a framing mismatch alone is a SOFT_WARNING (Ready) — Part 5's own example, never a hard fail or a forced review by itself", () => {
  const r = classifySceneQA(goodResult({ framingMatchesShotSize: false }));
  assert.equal(r.approved, true);
  assert.equal(r.severity, "SOFT_WARNING");
  assert.equal(r.failureType, "FRAMING_VARIANCE");
  assert.equal(r.requiresReview, false);
});
/* requiresReview is real but deliberately rare — reserved for the system having NO signal at all (QA itself unavailable), not for a firm-but-imperfect verdict */
test("requiresReview is never set by classifySceneQA itself for any of the boolean/enum signals above — every one resolves to a firm AUTO_READY/SOFT_WARNING/HARD_FAIL verdict", () => {
  for (const overrides of [{ actionMatchesDescription: false }, { framingMatchesShotSize: false }, { textArtifactSeverity: "major" }, { textArtifactSeverity: "minor" }]) {
    assert.equal(classifySceneQA(goodResult(overrides)).requiresReview, false, JSON.stringify(overrides));
  }
});

/* A genuinely clean result is AUTO_READY */
test("a fully clean result is AUTO_READY with no failureType/repairStrategy", () => {
  const r = classifySceneQA(goodResult());
  assert.equal(r.severity, "AUTO_READY");
  assert.equal(r.failureType, null);
  assert.equal(r.repairStrategy, null);
});

/* Backward-compatible boolean wrapper */
test("recomputeSceneApproval still returns a plain boolean matching classifySceneQA's own approved field (existing callers unaffected)", () => {
  const clean = goodResult();
  assert.equal(recomputeSceneApproval(clean), classifySceneQA(clean).approved);
  const leaked = goodResult({ referenceLeakageDetected: true });
  assert.equal(recomputeSceneApproval(leaked), false);
});
