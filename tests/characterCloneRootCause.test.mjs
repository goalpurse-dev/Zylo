import test from "node:test";
import assert from "node:assert/strict";
import { classifySceneQA } from "../supabase/functions/_shared/sceneQA.ts";
import { determineRepairAction, repairIsBillable } from "../supabase/functions/_shared/repairLadder.ts";
import {
  deriveSceneQAExpectations,
  buildUnreferencedCharacterNote,
  assessMultiCharacterReferenceSafety,
} from "../supabase/functions/_shared/sceneRenderPlan.ts";

// 2026-09-19 "close the character-clone root cause" pass — regression
// coverage built directly from real Mars evidence (plan version
// e65b6e53-489d-4b79-b6c0-b281699a2a18, contract 9a3826cd-9a2d-4b48-8275-
// 9a3826cd..., real shots 106 and 112).
//
// The REAL mechanism (confirmed against live Mars data, not hypothetical):
// castIdentityPolicy.ts's registry-level check found ZERO violations — every
// distinct character role already has its own canonical reference asset.
// The clone bug happens one step later, at SCENE COMPILE TIME: a beat
// needing 2+ CHARACTER references can only carry 1 into the renderer
// (Kling O3's own maxReferenceImages cap), so selectMinimalReferenceSet
// correctly drops the lower-priority character to a text-only description
// — but the entity registry has NO appearance/visual-description field
// beyond a bare role name, so that text-only description gives the image
// model zero basis to draw someone who looks different from the one face
// it was actually shown. Real shot 112's compiled prompt: "protagonist:
// present, canonical identity established via the supplied reference
// image" sits right next to "agricultural specialist: present (described,
// no dedicated reference image for this shot)" — nothing else. That is the
// exact shape reproduced below.

function goodQa(overrides = {}) {
  return {
    requiredCharactersPresent: true, characterIdentityConsistent: true, locationIdentityConsistent: true,
    actionMatchesDescription: true, framingMatchesShotSize: true, isCharacterSheetLayout: false,
    referenceLeakageDetected: false, multiPanelViolation: false, castCloningDetected: false,
    semanticPolarityViolated: false, forbiddenEntityPresent: false,
    textArtifactSeverity: "none", styleMismatchSeverity: "none", corruptionArtifacts: false, environmentIrrelevant: false,
    reasons: [], ...overrides,
  };
}

/* ---- sceneQA.ts: the new targeted clone-detection signal ---- */
test("castCloningDetected is a HARD_FAIL mapped to failureType CHARACTER_CLONE", () => {
  const r = classifySceneQA(goodQa({ castCloningDetected: true }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "CHARACTER_CLONE");
});
test("castCloningDetected is independent of characterIdentityConsistent — a scene can pass the generic identity check (the ONE referenced face is fine) and still fail cast-cloning (a SECOND role duplicated that same face)", () => {
  const r = classifySceneQA(goodQa({ characterIdentityConsistent: true, castCloningDetected: true }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "CHARACTER_CLONE");
});
test("a clean scene with no cast-cloning signal is unaffected by the new field", () => {
  const r = classifySceneQA(goodQa());
  assert.notEqual(r.severity, "HARD_FAIL");
});

/* ---- repairLadder.ts: CHARACTER_CLONE requires a real fresh generation, never a free repair ---- */
test("determineRepairAction maps CHARACTER_CLONE to a billable FRESH_GENERATE — no deterministic fix exists for a rendered clone", () => {
  const d = determineRepairAction("CHARACTER_CLONE");
  assert.equal(d.action, "FRESH_GENERATE");
  assert.equal(d.billable, true);
  assert.equal(d.providerCallRequired, true);
});
test("repairIsBillable(CHARACTER_CLONE) is true", () => {
  assert.equal(repairIsBillable("CHARACTER_CLONE"), true);
});

/* ---- sceneRenderPlan.ts: the compile-time fix ---- */
test("buildUnreferencedCharacterNote names the referenced character(s) so the dropped one is explicitly told NOT to be rendered as the same person (real shot 112 shape: protagonist referenced, agricultural specialist dropped)", () => {
  const note = buildUnreferencedCharacterNote("Agricultural Specialist", ["Protagonist"]);
  assert.match(note, /Agricultural Specialist: present \(described, no dedicated reference image for this shot\)\./);
  assert.match(note, /DIFFERENT, visually distinct individual from Protagonist/);
  assert.match(note, /do not render them as the same person or reuse Protagonist's face/);
});
test("buildUnreferencedCharacterNote handles 2+ referenced characters with correct pluralization", () => {
  const note = buildUnreferencedCharacterNote("Third Crew Member", ["Protagonist", "Power Officer"]);
  assert.match(note, /DIFFERENT, visually distinct individual from Protagonist and Power Officer/);
  assert.match(note, /reuse their face/);
});
test("buildUnreferencedCharacterNote degrades gracefully with no contrast note when nothing else was referenced (real shot 106 shape: a beat requiring 'crew' with zero character references at all)", () => {
  const note = buildUnreferencedCharacterNote("Crew Member", []);
  assert.equal(note, "Crew Member: present (described, no dedicated reference image for this shot).");
  assert.doesNotMatch(note, /DIFFERENT/);
});

test("assessMultiCharacterReferenceSafety is SAFE when the dropped character is only MEDIUM/LOW criticality (a real minor/incidental role, Section 5's explicitly-allowed exception)", () => {
  const result = assessMultiCharacterReferenceSafety(["MEDIUM"], 1);
  assert.equal(result.safe, true);
});
test("assessMultiCharacterReferenceSafety is UNSAFE when a dropped character is HIGH/EXACT criticality alongside an already-referenced character — two co-equal named roles must never silently share one face", () => {
  const result = assessMultiCharacterReferenceSafety(["HIGH"], 1);
  assert.equal(result.safe, false);
  assert.match(result.reason, /co-equal \(HIGH\/EXACT\) characters/);
});
test("assessMultiCharacterReferenceSafety is SAFE when nothing was actually referenced yet (no competing identity to collide with)", () => {
  const result = assessMultiCharacterReferenceSafety(["EXACT"], 0);
  assert.equal(result.safe, true);
});
test("assessMultiCharacterReferenceSafety is SAFE when nothing was dropped at all", () => {
  assert.equal(assessMultiCharacterReferenceSafety([], 1).safe, true);
});

/* ---- deriveSceneQAExpectations: the compile-time -> QA-time context thread ---- */
test("deriveSceneQAExpectations threads multiCharacterReferenceConstrained and the unreferenced character names through to QA context", () => {
  const expectations = deriveSceneQAExpectations("STORY_SCENE", ["protagonist", "ag_specialist"], "greenhouse_dome", true, ["Agricultural Specialist"]);
  assert.equal(expectations.multiCharacterReferenceConstrained, true);
  assert.deepEqual(expectations.unreferencedCharacterNames, ["Agricultural Specialist"]);
});
test("deriveSceneQAExpectations defaults multiCharacterReferenceConstrained to false and unreferencedCharacterNames to empty for an ordinary single-character beat", () => {
  const expectations = deriveSceneQAExpectations("STORY_SCENE", ["protagonist"], "rover", false);
  assert.equal(expectations.multiCharacterReferenceConstrained, false);
  assert.deepEqual(expectations.unreferencedCharacterNames, []);
});
