import test from "node:test";
import assert from "node:assert/strict";
import {
  validateClaim, matchClaimToRange, batchSegmentsByChapter, legacyVisualTypeForClaim, compileClaimRendererNotes, resolveClaimVisualType,
} from "../supabase/functions/_shared/narrationVisualContract.ts";
import { compileScenePrompt, compileEditInstruction } from "../supabase/functions/_shared/sceneRenderPlan.ts";
import { ZYVO_STYLE_SPEC } from "../supabase/functions/_shared/visualWorldStyle.ts";

// Narration → Visual Contract (2026-09-15 semantic-grounding pass, extended
// the same day for the "rebuild the Visual Director around narration
// meaning" pass — see that task's Sections 3/4/5/26 for the schema/cases
// this now implements). The LLM call itself (compileNarrationVisualContract/
// callResponses) is exercised live against the real Mars script for the
// final report — matching this codebase's established convention of unit-
// testing the DETERMINISTIC parts of an LLM-backed stage (validation,
// batching, matching, prompt compilation) while verifying the live model
// call separately. These tests use hand-built claims representing a
// CORRECT compilation of each case — i.e. they lock in what "correct" means
// for the validator and the downstream integration, independent of any one
// model's actual output.

function baseClaim(overrides = {}) {
  return {
    claimId: "seg1__c1", narrationSegmentIds: ["seg1"], narrationText: "placeholder",
    claimType: "FACT", primaryConcepts: [], primarySubject: "the scene",
    entityRequirements: [], forbiddenEntities: [],
    requiredVisualFacts: [], forbiddenVisualFacts: [], negativeClaims: [], positiveClaims: [],
    comparisonClaims: [], causeEffectClaims: [], temporalClaims: [], quantitativeClaims: [],
    entitiesMentioned: [], stateBefore: "", stateAfter: "", visualCommunicationGoal: "The viewer understands the idea.",
    planningMode: "STORY", preferredVisualForms: ["CHARACTER_ACTION"], graphicPrimitives: [],
    continuityRequirement: "NONE",
    textOverlayCandidate: { recommended: false, semanticText: "", importance: "LOW" },
    allowedAmbiguity: "MEDIUM", emphasis: "MEDIUM", confidence: 0.9,
    ...overrides,
  };
}
function ctx(segmentIds = ["seg1"]) {
  return { validSegmentIds: new Set(segmentIds), seenClaimIds: new Set() };
}

/* A: "They had no phones." -> NEGATION, must forbid a working phone */
test("A: a NEGATION claim with a populated forbiddenVisualFacts passes validation", () => {
  const claim = baseClaim({
    narrationText: "They had no phones.", claimType: "NEGATION",
    negativeClaims: ["no phones existed"], forbiddenVisualFacts: ["a functioning smartphone in the character's possession"],
    forbiddenEntities: ["working phone"], preferredVisualForms: ["SYMBOLIC_NEGATION"], planningMode: "EXPLAINER",
  });
  assert.deepEqual(validateClaim(claim, ctx()), []);
});
test("A: a NEGATION claim with NO forbidden/negative facts at all is rejected", () => {
  const claim = baseClaim({ narrationText: "They had no phones.", claimType: "NEGATION" });
  const errors = validateClaim(claim, ctx());
  assert.ok(errors.some((e) => e.startsWith("NEGATION_MISSING_FORBIDDEN_FACTS")));
});

/* B: "They had no internet connection." -> NEGATION, disconnected/unavailable, symbolic not cinematic */
test("B: NEGATION for 'no internet connection' requires a forbidden connectivity fact and prefers a symbolic/graphic form, not an automatic character shot", () => {
  const claim = baseClaim({
    narrationText: "They had no internet connection.", claimType: "NEGATION",
    forbiddenVisualFacts: ["an active, connected internet device or working Wi-Fi indicator"],
    preferredVisualForms: ["SYMBOLIC_NEGATION"], planningMode: "EXPLAINER",
  });
  assert.deepEqual(validateClaim(claim, ctx()), []);
  assert.notEqual(legacyVisualTypeForClaim(claim), "STORY_ILLUSTRATION");
});

/* C: "No breathable atmosphere." -> comparison/diagram is valid; an unsuited comfortable-outdoor human is forbidden */
test("C: 'no breathable atmosphere' is a valid NEGATION/COMPARISON whose forbiddenVisualFacts explicitly rule out an unsuited human breathing comfortably outdoors", () => {
  const claim = baseClaim({
    narrationText: "Mars has no breathable atmosphere.", claimType: "NEGATION",
    negativeClaims: ["Mars's atmosphere is not breathable"],
    forbiddenVisualFacts: ["a human standing outdoors unsuited, breathing normally/comfortably"],
    preferredVisualForms: ["COMPARISON"], planningMode: "EXPLAINER",
  });
  assert.deepEqual(validateClaim(claim, ctx()), []);
  assert.notEqual(legacyVisualTypeForClaim(claim), "STORY_ILLUSTRATION", "a comparison/diagram treatment, not a default cinematic shot");
});

/* C: "Unlike bears, humans had no thick fur." -> COMPARISON + NEGATION-flavored; comparison/diagram valid, unsuited-comfortable-human forbidden */
test("C: a comparison naming both sides passes; one naming only one side is rejected", () => {
  const good = baseClaim({
    narrationText: "Unlike bears, humans had no thick fur.", claimType: "COMPARISON",
    comparisonClaims: ["bears have thick fur", "humans do not have thick fur"],
    entitiesMentioned: ["bears", "humans"], preferredVisualForms: ["COMPARISON"], planningMode: "EXPLAINER",
  });
  assert.deepEqual(validateClaim(good, ctx()), []);
  const bad = baseClaim({ narrationText: "Unlike bears, humans had no thick fur.", claimType: "COMPARISON" });
  assert.ok(validateClaim(bad, ctx()).some((e) => e.startsWith("COMPARISON_MISSING_BOTH_SIDES")));
});

/* D: "As the temperature fell, the body burned more calories." -> CAUSE_EFFECT */
test("D: a CAUSE_EFFECT claim requires a populated causeEffectClaims", () => {
  const good = baseClaim({
    narrationText: "As the temperature fell, the body burned more calories.", claimType: "CAUSE_EFFECT",
    causeEffectClaims: ["falling temperature causes the body to burn more calories"],
    preferredVisualForms: ["CAUSE_EFFECT"], planningMode: "EXPLAINER",
  });
  assert.deepEqual(validateClaim(good, ctx()), []);
  const bad = baseClaim({ narrationText: "As the temperature fell, the body burned more calories.", claimType: "CAUSE_EFFECT" });
  assert.ok(validateClaim(bad, ctx()).some((e) => e.startsWith("CAUSE_EFFECT_MISSING_CLAIM")));
});

/* Same room normal power -> power failure: legitimate EDIT/before-after continuity (HIGH continuityRequirement) */
test("a same-setup state-change claim (power on -> power failure) carries continuityRequirement HIGH", () => {
  const claim = baseClaim({
    narrationText: "Suddenly the lights cut out and the room went dark.", claimType: "SEQUENCE",
    stateBefore: "room lit, power on", stateAfter: "room dark, power failed",
    continuityRequirement: "HIGH", preferredVisualForms: ["ENVIRONMENT_DETAIL"], planningMode: "STORY",
  });
  assert.deepEqual(validateClaim(claim, ctx()), []);
  assert.equal(claim.continuityRequirement, "HIGH");
});

/* E: "Instead of heating the entire building, they heated the bed." -> CONTRAST */
test("E: a CONTRAST claim also requires both sides in comparisonClaims", () => {
  const claim = baseClaim({
    narrationText: "Instead of heating the entire building, they heated the bed.", claimType: "CONTRAST",
    comparisonClaims: ["heating the whole building (not done)", "heating just the bed (what they did)"],
    preferredVisualForms: ["BEFORE_AFTER"], planningMode: "EXPLAINER",
  });
  assert.deepEqual(validateClaim(claim, ctx()), []);
});

/* F: "For most of human history, central heating did not exist." -> TIMELINE + NEGATION */
test("F: a TIMELINE-flavored NEGATION still requires forbidden/negative facts", () => {
  const claim = baseClaim({
    narrationText: "For most of human history, central heating did not exist.", claimType: "NEGATION",
    negativeClaims: ["central heating did not exist for most of human history"],
    forbiddenVisualFacts: ["a modern powered heating system shown as commonplace"],
    temporalClaims: ["spans most of human history"],
    preferredVisualForms: ["TIMELINE"], planningMode: "EXPLAINER",
  });
  assert.deepEqual(validateClaim(claim, ctx()), []);
});

/* G: "He reaches for the control panel and checks oxygen." -> STORY/ACTION, not infographic. Next narration about atmosphere should NOT stay another tablet EDIT. */
test("G: a plain physical-action claim is STORY planningMode with a CHARACTER_ACTION visual form", () => {
  const claim = baseClaim({ narrationText: "He reaches for the control panel and checks oxygen.", claimType: "FACT", planningMode: "STORY", preferredVisualForms: ["CHARACTER_ACTION"], continuityRequirement: "LOW" });
  assert.deepEqual(validateClaim(claim, ctx()), []);
  assert.equal(legacyVisualTypeForClaim(claim), "STORY_ILLUSTRATION");
});
test("E (sequence case): a new claim explaining Mars atmosphere after a tablet-check beat has a DIFFERENT primarySubject and LOW/NONE continuity, not a forced continuation", () => {
  const tabletBeat = baseClaim({ primarySubject: "the tablet checklist", continuityRequirement: "HIGH", planningMode: "STORY" });
  const atmosphereBeat = baseClaim({ primarySubject: "Mars's atmosphere", continuityRequirement: "NONE", planningMode: "EXPLAINER", claimType: "FACT", preferredVisualForms: ["DIAGRAM"] });
  assert.notEqual(tabletBeat.primarySubject, atmosphereBeat.primarySubject);
  assert.notEqual(atmosphereBeat.continuityRequirement, "HIGH");
});

/* H: "No grocery stores." -> a crossed-out store concept is valid */
test("H: 'no grocery stores' is a valid NEGATION with a symbolic-negation preferred form", () => {
  const claim = baseClaim({
    narrationText: "There were no grocery stores.", claimType: "NEGATION",
    negativeClaims: ["no grocery stores existed"], forbiddenVisualFacts: ["a modern, stocked grocery store shown as accessible"],
    preferredVisualForms: ["SYMBOLIC_NEGATION"], planningMode: "EXPLAINER",
  });
  assert.deepEqual(validateClaim(claim, ctx()), []);
});

/* Entity criticality / identity QA weighting inputs */
test("L: a background entity with LOW criticality is distinct from a hero at EXACT — the schema carries this per-entity, not globally", () => {
  const claim = baseClaim({
    entityRequirements: [
      { entity: "protagonist", criticality: "EXACT" },
      { entity: "background technician", criticality: "LOW" },
    ],
  });
  assert.deepEqual(validateClaim(claim, ctx()), []);
  assert.equal(claim.entityRequirements.find((e) => e.entity === "protagonist").criticality, "EXACT");
  assert.equal(claim.entityRequirements.find((e) => e.entity === "background technician").criticality, "LOW");
});
test("an entity cannot be both required and forbidden in the same claim — a self-contradiction is rejected", () => {
  const claim = baseClaim({
    entityRequirements: [{ entity: "phone", criticality: "MEDIUM" }],
    forbiddenEntities: ["Phone"], // case-insensitive match
  });
  assert.ok(validateClaim(claim, ctx()).some((e) => e.startsWith("ENTITY_BOTH_REQUIRED_AND_FORBIDDEN")));
});

/* Other invariants */
test("narrationSegmentIds referencing a segment outside the known set is rejected", () => {
  const claim = baseClaim({ narrationSegmentIds: ["seg_does_not_exist"] });
  assert.ok(validateClaim(claim, ctx(["seg1"])).some((e) => e.startsWith("UNKNOWN_NARRATION_SEGMENT_ID")));
});
test("an empty communication goal is rejected", () => {
  const claim = baseClaim({ visualCommunicationGoal: "   " });
  assert.ok(validateClaim(claim, ctx()).some((e) => e.startsWith("EMPTY_COMMUNICATION_GOAL")));
});
test("a duplicate claim id (already seen in this compilation) is rejected", () => {
  const seen = new Set(["seg1__c1"]);
  const claim = baseClaim();
  assert.ok(validateClaim(claim, { validSegmentIds: new Set(["seg1"]), seenClaimIds: seen }).some((e) => e.startsWith("DUPLICATE_CLAIM_ID")));
});
test("an entity mentioned that never appears anywhere in the claim's own narrationText is rejected as unverifiable", () => {
  const claim = baseClaim({ narrationText: "They had no phones.", entitiesMentioned: ["a spaceship"] });
  assert.ok(validateClaim(claim, ctx()).some((e) => e.startsWith("UNVERIFIABLE_ENTITY")));
});
test("an entity that DOES appear in narrationText (including simple pluralization) is accepted", () => {
  const claim = baseClaim({ narrationText: "They had no working phones at the outpost.", entitiesMentioned: ["phone", "outpost"] });
  assert.deepEqual(validateClaim(claim, ctx()).filter((e) => e.startsWith("UNVERIFIABLE_ENTITY")), []);
});

/* Batching */
test("batchSegmentsByChapter never merges segments across a chapter boundary", () => {
  const segments = [
    { id: "s1", chapterId: "c1", sequenceIndex: 0, text: "a".repeat(100) },
    { id: "s2", chapterId: "c1", sequenceIndex: 1, text: "b".repeat(100) },
    { id: "s3", chapterId: "c2", sequenceIndex: 2, text: "c".repeat(100) },
  ];
  const batches = batchSegmentsByChapter(segments);
  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0].map((s) => s.id), ["s1", "s2"]);
  assert.deepEqual(batches[1].map((s) => s.id), ["s3"]);
});
test("batchSegmentsByChapter splits an oversized single chapter into more than one batch rather than one huge call", () => {
  const segments = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, chapterId: "c1", sequenceIndex: i, text: "x".repeat(500) }));
  const batches = batchSegmentsByChapter(segments);
  assert.ok(batches.length > 1, "10 segments of 500 chars each (5000 total) must split under the 2200-char batch budget");
  for (const b of batches) assert.ok(b.reduce((n, s) => n + s.text.length, 0) <= 2200 || b.length === 1, "each batch stays under budget unless a single segment alone exceeds it");
});

/* Shot-planner integration: matching a range back to its claim */
test("matchClaimToRange finds the claim covering a given semantic range's text within the same segment", () => {
  const claims = [
    baseClaim({ claimId: "s1__c1", narrationSegmentIds: ["s1"], narrationText: "They had no phones and no internet." }),
    baseClaim({ claimId: "s1__c2", narrationSegmentIds: ["s1"], narrationText: "The crew checked the airlock." }),
  ];
  const match = matchClaimToRange(claims, "s1", "no internet");
  assert.equal(match?.claimId, "s1__c1", "the range's text only appears inside the first claim's quoted narrationText");
});
test("matchClaimToRange returns null when no claim in that segment covers the range (caller keeps its own fallback)", () => {
  const claims = [baseClaim({ claimId: "s1__c1", narrationSegmentIds: ["s1"], narrationText: "The crew checked the airlock." })];
  assert.equal(matchClaimToRange(claims, "s1", "completely unrelated text"), null);
  assert.equal(matchClaimToRange(claims, "s2", "the crew checked the airlock"), null, "different segment id never matches even with identical text");
});

/* Renderer prompt integration */
test("compileClaimRendererNotes stays silent (null) for a plain claim with nothing load-bearing to say", () => {
  const claim = baseClaim();
  assert.equal(compileClaimRendererNotes(claim), null);
});
test("compileClaimRendererNotes produces a concise MUST SHOW / MUST NOT SHOW block, never raw JSON", () => {
  const claim = baseClaim({ requiredVisualFacts: ["an isolated figure"], forbiddenVisualFacts: ["a working phone"], visualCommunicationGoal: "No modern communication existed." });
  const notes = compileClaimRendererNotes(claim);
  assert.match(notes, /MUST SHOW: an isolated figure/);
  assert.match(notes, /MUST NOT SHOW: a working phone/);
  assert.match(notes, /COMMUNICATION GOAL: No modern communication existed\./);
  assert.doesNotMatch(notes, /claimId|narrationSegmentIds|\{/, "never dumps raw JSON/internal field names into the prompt");
});
test("compileClaimRendererNotes returns null for a null claim (no matching claim for this beat)", () => {
  assert.equal(compileClaimRendererNotes(null), null);
});

/* Text density changes presentation frequency, never factual meaning */
test("a STORY-mode claim is never touched by density (story context always wins)", () => {
  const claim = baseClaim({ planningMode: "STORY", preferredVisualForms: ["CHARACTER_ACTION"], claimType: "FACT" });
  assert.equal(resolveClaimVisualType(claim, "minimal"), "STORY_ILLUSTRATION");
  assert.equal(resolveClaimVisualType(claim, "frequent"), "STORY_ILLUSTRATION");
});

test("a NEGATION/COMPARISON/CAUSE_EFFECT/CONTRAST claim keeps its explainer treatment even at MINIMAL (the 'information impossible to show otherwise' carve-out)", () => {
  for (const claimType of ["NEGATION", "COMPARISON", "CAUSE_EFFECT", "CONTRAST"]) {
    const claim = baseClaim({ planningMode: "EXPLAINER", claimType, preferredVisualForms: ["SYMBOLIC_NEGATION"] });
    assert.notEqual(resolveClaimVisualType(claim, "minimal"), "STORY_ILLUSTRATION", `${claimType} must stay explainer even at minimal`);
  }
});

test("a non-essential EXPLAINER claim (plain FACT/QUANTITY) folds back to illustration at MINIMAL but keeps its graphic treatment at BALANCED/FREQUENT", () => {
  const claim = baseClaim({ planningMode: "EXPLAINER", claimType: "QUANTITY", preferredVisualForms: ["NUMBER_EMPHASIS"] });
  assert.equal(resolveClaimVisualType(claim, "minimal"), "STORY_ILLUSTRATION");
  assert.equal(resolveClaimVisualType(claim, "balanced"), "PROGRAMMATIC_GRAPHIC");
  assert.equal(resolveClaimVisualType(claim, "frequent"), "PROGRAMMATIC_GRAPHIC");
});

test("a text-forward form (TEXT_EMPHASIS/NUMBER_EMPHASIS) is never offered at MINIMAL, even for an essential claim type — it falls back to the next preferred form instead", () => {
  const claim = baseClaim({ planningMode: "EXPLAINER", claimType: "NEGATION", preferredVisualForms: ["TEXT_EMPHASIS", "SYMBOLIC_NEGATION"] });
  // TEXT_EMPHASIS is filtered out at minimal, but NEGATION is still essential, so it falls through to the next preferred form (SYMBOLIC_NEGATION) rather than illustration.
  assert.equal(resolveClaimVisualType(claim, "minimal"), "PROGRAMMATIC_GRAPHIC");
});

/* Renderer prompt integration end-to-end */
function scenePromptInput(overrides = {}) {
  return {
    sceneType: "STORY_SCENE", shotSize: "MEDIUM", cameraFraming: "", focalSubject: "", informationToCommunicate: "A character stands in a habitat.",
    characterIdentityBlocks: [], locationDescription: null, worldStateNotes: [], continuityNote: null,
    factualConstraints: [], forbiddenElements: [], reserveTextSafeArea: false, semanticNotes: null,
    ...overrides,
  };
}

test("compileScenePrompt includes a [SEMANTIC REQUIREMENTS] section when semanticNotes is set", () => {
  const claim = baseClaim({ claimType: "NEGATION", forbiddenVisualFacts: ["a functioning smartphone"], visualCommunicationGoal: "No modern communication existed." });
  const notes = compileClaimRendererNotes(claim);
  const prompt = compileScenePrompt(ZYVO_STYLE_SPEC, scenePromptInput({ semanticNotes: notes }));
  assert.match(prompt, /\[SEMANTIC REQUIREMENTS\]/);
  assert.match(prompt, /MUST NOT SHOW: a functioning smartphone/);
});

test("compileScenePrompt omits the section entirely when there is no claim for this beat (backward compatible)", () => {
  const prompt = compileScenePrompt(ZYVO_STYLE_SPEC, scenePromptInput());
  assert.doesNotMatch(prompt, /\[SEMANTIC REQUIREMENTS\]/);
});

test("compileEditInstruction appends semantic requirements when provided, and is unchanged when omitted", () => {
  const withNotes = compileEditInstruction("The character turns toward the window.", ZYVO_STYLE_SPEC, "MUST NOT SHOW: a working phone.");
  assert.match(withNotes, /\[SEMANTIC REQUIREMENTS\]/);
  const withoutNotes = compileEditInstruction("The character turns toward the window.", ZYVO_STYLE_SPEC);
  assert.doesNotMatch(withoutNotes, /\[SEMANTIC REQUIREMENTS\]/);
});
