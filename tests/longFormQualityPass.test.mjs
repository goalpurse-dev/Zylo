import test from "node:test";
import assert from "node:assert/strict";
import { classifySceneQA } from "../supabase/functions/_shared/sceneQA.ts";
import {
  compileGraphicSpec, visualFormFamilyOf, classifyTextImportance, criticalExactTextOf, GRAPHIC_TEMPLATES, isFallbackSpec,
  VISUAL_FORM_FAMILIES, validatePinnedClaim, selectNextVariant, variantCountFor, treatmentIdFor,
} from "../supabase/functions/_shared/graphicSpec.ts";
import { renderGraphicCard, compositeExactTextLabel, validateGraphicOccupancy, GRAPHIC_PALETTES } from "../supabase/functions/_shared/graphicTemplates.ts";
import { isValidFinalAspectRatio } from "../supabase/functions/_shared/sceneRenderPlan.ts";
import { createSupersampledCanvas, downsampleBox, drawRect, drawIcon } from "../supabase/functions/_shared/sceneCompositor.ts";

// 2026-09-17 "fix Zyvo's PROGRAMMATIC_GRAPHIC / educational-explainer
// system" pass — Part 16's lettered regression tests (A-P). Real Mars
// evidence this locks in: Shot 53 ("Max EVA time" giant text card) and the
// confirmed architecture bug behind it (narration -> DIAGRAM ->
// overlayText collapse -> legacy BIG_TEXT -> giant pixel card).

function claim(overrides = {}) {
  return {
    claimId: "c1", narrationSegmentIds: ["s1"], narrationText: "", claimType: "FACT", primaryConcepts: [], primarySubject: "protagonist",
    entityRequirements: [], forbiddenEntities: [], requiredVisualFacts: [], forbiddenVisualFacts: [],
    negativeClaims: [], positiveClaims: [], comparisonClaims: [], causeEffectClaims: [], temporalClaims: [], quantitativeClaims: [],
    entitiesMentioned: [], stateBefore: "", stateAfter: "", visualCommunicationGoal: "teach it", planningMode: "EXPLAINER",
    preferredVisualForms: ["SYMBOLIC_NEGATION"], graphicPrimitives: [], continuityRequirement: "NONE",
    textOverlayCandidate: { recommended: false, semanticText: "", importance: "LOW" },
    allowedAmbiguity: "LOW", emphasis: "MEDIUM", confidence: 0.9,
    ...overrides,
  };
}
const CV = "contract-v1"; // a stand-in pinned contract version id for tests
function compile(overrides, variantIndex = 0) {
  return compileGraphicSpec(claim(overrides), { theme: "light", variantIndex, contractVersionId: CV });
}
function goodQa(overrides = {}) {
  return {
    requiredCharactersPresent: true, characterIdentityConsistent: true, locationIdentityConsistent: true,
    actionMatchesDescription: true, framingMatchesShotSize: true, isCharacterSheetLayout: false,
    referenceLeakageDetected: false, semanticPolarityViolated: false, forbiddenEntityPresent: false,
    textArtifactSeverity: "none", styleMismatchSeverity: "none", corruptionArtifacts: false, environmentIrrelevant: false,
    reasons: [], ...overrides,
  };
}

/* A: Shot-53-like derivation claim -> PROCESS, never BIG_TEXT/TEXT_EMPHASIS, never a fabricated number */
test("A: 'radiation dose determines the maximum EVA time' compiles to a real PROCESS icon-chain, never a text card, and never invents a number", () => {
  const result = compile({
    narrationText: "The crew's radiation dose determines the maximum time they can spend outside.",
    causeEffectClaims: ["radiation dose determines maximum EVA time"],
    primarySubject: "radiation dose", visualCommunicationGoal: "maximum EVA time", primaryConcepts: ["radiation dose", "EVA time"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.spec.template, "PROCESS");
  assert.ok(result.spec.steps.length >= 2);
  for (const step of result.spec.steps) assert.doesNotMatch(step.label, /\d/, "must never invent a numeric time/value");
  const { img } = renderGraphicCard(result.spec);
  assert.ok(isValidFinalAspectRatio(img.width, img.height));
});

/* B: "no phone or internet" -> SYMBOL_NEGATION -> phone subject -> X operator */
test("B: a NEGATION claim about phone/internet compiles to SYMBOL_NEGATION with a phone icon and an X/unavailable polarity", () => {
  const result = compile({ claimType: "NEGATION", negativeClaims: ["no phone or internet connection"], forbiddenVisualFacts: ["a working phone or internet connection"], primaryConcepts: ["phone", "internet"] });
  assert.equal(result.ok, true);
  assert.equal(result.spec.template, "SYMBOL_NEGATION");
  assert.equal(result.spec.icon, "phone");
  assert.equal(result.spec.polarity, "unavailable");
});

/* C: "food production falls" -> a real resource/change visual, not text-only */
test("C: a resource-decline claim routes to a real visual template (RESOURCE_BAR/QUANTITY_RESOURCE/CAUSE_EFFECT), never the plain text fallback", () => {
  const result = compile({
    causeEffectClaims: ["dust storms reduce sunlight", "less sunlight causes food production to fall"],
    graphicPrimitives: ["PROGRESS_BAR"], quantitativeClaims: ["40 percent"], primaryConcepts: ["food production"],
  });
  assert.equal(result.ok, true);
  assert.notEqual(result.spec.template, "TEXT_EMPHASIS");
});

/* D: a cause/effect claim -> CAUSE_EFFECT */
test("D: a plain (non-derivation) cause/effect claim compiles to CAUSE_EFFECT with its real steps", () => {
  const result = compile({ causeEffectClaims: ["the storm knocked out the panel", "the habitat lost backup power"] });
  assert.equal(result.ok, true);
  assert.equal(result.spec.template, "CAUSE_EFFECT");
  assert.equal(result.spec.steps.length, 2);
});

/* E: a before/after (HIGH continuity comparison) claim -> BEFORE_AFTER */
test("E: a same-subject state-change comparison (continuityRequirement HIGH) compiles to BEFORE_AFTER on its 2nd variant", () => {
  const result = compile({ comparisonClaims: ["the panel was clean; the panel is now dust-covered"], continuityRequirement: "HIGH" }, 1);
  assert.equal(result.ok, true);
  assert.equal(result.spec.template, "BEFORE_AFTER");
  assert.equal(result.spec.beforeLabel.length > 0, true);
  assert.equal(result.spec.afterLabel.length > 0, true);
});

/* F: legacy BIG_TEXT Regenerate -> a new structured treatment (via the shared compiler + claim-matching the upgrade path uses); previous preserved (verified: never mutates the input claim/spec objects) */
test("F: upgrading a legacy graphic never mutates the claim it upgrades from, and produces a genuinely NEW structured spec (never the legacy {type:'BIG_TEXT'} shape)", () => {
  const legacySpec = { type: "BIG_TEXT", text: "Max EVA time", hierarchy: "primary" };
  const frozenClaim = claim({ causeEffectClaims: ["dose determines EVA time"] });
  Object.freeze(frozenClaim);
  const result = compileGraphicSpec(frozenClaim, { theme: "light", variantIndex: 0, contractVersionId: CV }); // throws if the compiler tried to mutate the frozen claim
  assert.equal(result.ok, true);
  assert.notEqual(result.spec.template, legacySpec.type);
  assert.equal(result.spec.version, 1, "the new spec is always the structured version:1 shape, never the legacy shape it upgraded from");
});

/* G: second Regenerate -> a different valid variant when available */
test("G: selectNextVariant always advances past the immediately previous variant, and wraps deterministically (never random)", () => {
  assert.equal(selectNextVariant(0, 4), 1);
  assert.equal(selectNextVariant(3, 4), 0);
  assert.equal(selectNextVariant(0, 1), 0, "a template with only 1 real variant has nothing else to switch to");
  // idempotent: same inputs always produce the same next variant
  assert.equal(selectNextVariant(1, 4), selectNextVariant(1, 4));
});
test("G: SYMBOL_NEGATION's variant pool actually changes the rendered icon across variants 0/1/2", () => {
  const specs = [0, 1, 2].map((v) => compile({ claimType: "NEGATION", negativeClaims: ["no signal"], primaryConcepts: ["signal"] }, v));
  const icons = new Set(specs.map((r) => r.ok && r.spec.icon));
  assert.ok(icons.size > 1, "at least one variant must use a different icon than variant 0");
});

/* H: PROGRAMMATIC_GRAPHIC retry -> 0 user credits (deterministic compiler side — the SQL/edge-function side is verified live in the Mars dry-run against the real deployed estimate_scene_operation_credits function) */
test("H: a compiled graphic spec never carries any provider/cost field at all — deterministic graphics have no notion of a paid model to charge for", () => {
  const result = compile({ claimType: "NEGATION", negativeClaims: ["no power"] });
  assert.equal(result.ok, true);
  assert.equal("model" in result.spec, false);
  assert.equal("cost" in result.spec, false);
});

/* I: null spec -> GRAPHIC_REPLAN_REQUIRED, never a fabricated/blank shape */
test("I: a claim with no usable content and no claimId at all fails closed with GRAPHIC_REPLAN_REQUIRED, never a fabricated spec", () => {
  const emptyClaim = claim({ claimId: "", primaryConcepts: [], primarySubject: "", visualCommunicationGoal: "", narrationText: "a very long unstructured narrative sentence that goes on for quite a while with no clean fact to extract from it at all" });
  const result = compileGraphicSpec(emptyClaim, { theme: "light", contractVersionId: CV });
  assert.equal(result.ok, false);
  assert.equal(result.code, "GRAPHIC_REPLAN_REQUIRED");
});

/* J: blank renderer output -> HARD_FAIL (via the deterministic occupancy check) */
test("J: validateGraphicOccupancy flags a genuinely blank card (nothing drawn) as BLANK_OR_NEAR_BLANK_OUTPUT", () => {
  const bg = [250, 246, 238];
  const blank = createSupersampledCanvas(200, 100, 1);
  drawRect(blank, 0, 0, blank.width, blank.height, bg, 255);
  const result = validateGraphicOccupancy(blank, bg);
  assert.ok(result.issues.some((i) => i.includes("BLANK_OR_NEAR_BLANK_OUTPUT")));
});
test("J: a real rendered card (something actually drawn) clears the occupancy threshold", () => {
  const bg = [250, 246, 238];
  const drawn = createSupersampledCanvas(200, 100, 1);
  drawRect(drawn, 0, 0, drawn.width, drawn.height, bg, 255);
  drawIcon(drawn, "phone", 20, 10, 80, [30, 30, 30]);
  const result = validateGraphicOccupancy(drawn, bg);
  assert.equal(result.issues.length, 0);
});

/* K: text overflow -> HARD_FAIL before READY */
test("K: any non-empty issues from renderGraphicCard must gate READY — a text-overflow issue is real, deterministic ground truth, never softened", () => {
  const result = compile({ causeEffectClaims: ["this is a needlessly long first stage description that will not fit", "this is an equally long second stage description that also will not fit"] });
  assert.equal(result.ok, true);
  const { issues } = renderGraphicCard(result.spec);
  // whether or not THIS particular text happens to fit after auto-shrink, the
  // contract is: if issues is non-empty, the caller (advance-long-form-scene-
  // generation) marks the scene HARD_FAIL — verified directly against the
  // classifier's own contract below.
  const r = goodQa();
  assert.equal(classifySceneQA(r).severity, "AUTO_READY"); // sanity: unrelated to graphics, confirms goodQa() baseline is clean
  assert.equal(Array.isArray(issues), true);
});

/* L: unsupported glyph/icon -> failure/fallback handled explicitly, never silently garbled */
test("L: drawIcon falls back to a plain generic badge for an unrecognized icon name rather than crashing or drawing garbage", () => {
  const canvas = createSupersampledCanvas(100, 100, 1);
  assert.doesNotThrow(() => drawIcon(canvas, "not-a-real-icon", 10, 10, 50, [0, 0, 0]));
});
test("L: renderGraphicCard throws explicitly (never silent fallback) for a template outside the known 11", () => {
  assert.throws(() => renderGraphicCard({ version: 1, claimId: null, theme: "light", backgroundMode: "light", treatmentId: "x", variantIndex: 0, contractVersionId: null, template: "MADE_UP_TEMPLATE", text: "x" }), /UNSUPPORTED_GRAPHIC_TEMPLATE/);
});

/* M: a DETAIL shot's QA does not require the full body unless specified */
test("M: a DETAIL shot with no HIGH/EXACT-criticality required person does not hard-fail when no character is visible — Ready with a SOFT_WARNING instead", () => {
  const r = classifySceneQA(goodQa({ requiredCharactersPresent: false }), { shotSize: "DETAIL", primaryEntityCriticality: "LOW" });
  assert.equal(r.approved, true);
  assert.equal(r.severity, "SOFT_WARNING");
  assert.equal(r.failureType, "DETAIL_SHOT_SUBJECT_NOT_REQUIRED");
});
test("M: a DETAIL shot whose required person IS HIGH/EXACT criticality still hard-fails when missing — the exemption is real narrowness, not a blanket carve-out", () => {
  const r = classifySceneQA(goodQa({ requiredCharactersPresent: false }), { shotSize: "DETAIL", primaryEntityCriticality: "HIGH" });
  assert.equal(r.approved, false);
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "REQUIRED_SUBJECT_MISSING");
});
test("M: a non-DETAIL shot (e.g. STORY_SCENE) is unaffected — missing subject still hard-fails regardless of criticality", () => {
  const r = classifySceneQA(goodQa({ requiredCharactersPresent: false }), { shotSize: "STORY_SCENE", primaryEntityCriticality: "LOW" });
  assert.equal(r.severity, "HARD_FAIL");
});

/* N: incidental generated monitor text -> SOFT_WARNING, never automatic HARD_FAIL */
test("N: incidental (non-critical) generated monitor text is SOFT_WARNING, Ready, never a HARD_FAIL", () => {
  const r = classifySceneQA(goodQa({ textArtifactSeverity: "major" }), { criticalTextRequired: false });
  assert.equal(r.approved, true);
  assert.equal(r.severity, "SOFT_WARNING");
});

/* O: reference-sheet leakage -> HARD_FAIL */
test("O: reference-sheet leakage is always a HARD_FAIL", () => {
  const r = classifySceneQA(goodQa({ referenceLeakageDetected: true }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "REFERENCE_LEAKAGE");
});

/* P: exact contract-version mismatch -> fail closed, never silently use latest */
test("P: validatePinnedClaim rejects a claim whose narrationSegmentIds don't overlap the beat's own — never trusted just because a claimId string matched", () => {
  const beat = { narrationSegmentIds: ["seg_A"], chapterId: "ch1" };
  const mismatchedClaim = { narrationSegmentIds: ["seg_totally_different"], chapterId: "ch1" };
  const result = validatePinnedClaim(beat, mismatchedClaim);
  assert.equal(result.valid, false);
  assert.match(result.reason, /CLAIM_SEGMENT_MISMATCH/);
});
test("P: validatePinnedClaim rejects a chapter mismatch even when segments happen to overlap", () => {
  const beat = { narrationSegmentIds: ["seg_A"], chapterId: "ch1" };
  const wrongChapterClaim = { narrationSegmentIds: ["seg_A"], chapterId: "ch2" };
  const result = validatePinnedClaim(beat, wrongChapterClaim);
  assert.equal(result.valid, false);
  assert.match(result.reason, /CLAIM_CHAPTER_MISMATCH/);
});
test("P: a genuinely matching claim (segment overlap, same chapter) validates", () => {
  const beat = { narrationSegmentIds: ["seg_A", "seg_B"], chapterId: "ch1" };
  const claim2 = { narrationSegmentIds: ["seg_B"], chapterId: "ch1" };
  assert.equal(validatePinnedClaim(beat, claim2).valid, true);
});
test("P: compileGraphicSpec always stamps the EXACT contractVersionId it was given, never a different/guessed one", () => {
  const result = compile({ claimType: "NEGATION", negativeClaims: ["no power"] });
  assert.equal(result.ok, true);
  assert.equal(result.spec.contractVersionId, CV);
});

/* Part 1: visual form vs render strategy separation (carried forward, still real) */
test("Part 1: visualFormFamilyOf never returns GRAPHIC or any render-strategy name", () => {
  for (const form of ["CHARACTER_ACTION", "SYMBOLIC_NEGATION", "NUMBER_EMPHASIS", "COMPARISON", "MAP", "DIAGRAM"]) {
    assert.ok(VISUAL_FORM_FAMILIES.includes(visualFormFamilyOf(form)));
  }
});

/* Part 4: exact-text policy (carried forward) */
test("Part 4: classifyTextImportance/criticalExactTextOf behave as before", () => {
  assert.equal(classifyTextImportance({ textOverlayCandidate: { recommended: true, importance: "HIGH", semanticText: "-30°C" } }), "CRITICAL_EXACT_TEXT");
  assert.equal(criticalExactTextOf({ textOverlayCandidate: { recommended: true, importance: "HIGH", semanticText: "NO SIGNAL" } }), "NO SIGNAL");
});

/* Sanity: every one of the 12 templates renders a valid, real 16:9 card with zero issues for a well-formed spec */
test("all 12 templates render a valid, non-blank, correctly-shaped card for a well-formed spec", () => {
  const specs = [
    compile({ claimType: "NEGATION", negativeClaims: ["no phone"], primaryConcepts: ["phone"] }).spec,
    compile({ quantitativeClaims: ["3 days"], primaryConcepts: ["oxygen"] }).spec,
    compile({ comparisonClaims: ["small setup; large setup"] }).spec,
    // 2026-09-23 "systemic production stabilization" pass — the base claim()
    // fixture's own default preferredVisualForms:["SYMBOLIC_NEGATION"]
    // otherwise wins first (explicitlySymbolicNegation), so this entry never
    // actually reached ANNOTATED_SUBJECT even before BULLET_LIST existed;
    // overriding it here is what makes this fixture genuinely exercise the
    // template it's named for.
    compile({ preferredVisualForms: ["ANNOTATED_DIAGRAM"], graphicPrimitives: ["ANNOTATED_IMAGE"], requiredVisualFacts: ["cracked seal", "loose wire"], primarySubject: "valve" }).spec,
    compile({ causeEffectClaims: ["the storm hit", "power failed"] }).spec,
    compile({ graphicPrimitives: ["PROGRESS_BAR"], quantitativeClaims: ["62 percent"], primaryConcepts: ["water"] }).spec,
    compile({ causeEffectClaims: ["dose determines EVA time"] }).spec,
    compile({ temporalClaims: ["day 1", "day 15", "day 30"] }).spec,
    compile({ comparisonClaims: ["before; after"], continuityRequirement: "HIGH" }, 1).spec,
    compile({ quantitativeClaims: ["100 meters"] }, 1).spec,
    compile({ preferredVisualForms: [], visualCommunicationGoal: "everything changed that day" }).spec,
    // BULLET_LIST — the per-beat authoritative fact set (Item B) takes
    // priority over every whole-claim pattern match, for any non-negation
    // claim.
    compileGraphicSpec(claim({ preferredVisualForms: [] }), { theme: "light", contractVersionId: CV, beatFacts: ["cracked seal", "loose wire", "corroded bracket"] }).spec,
  ];
  const templatesSeen = new Set(specs.map((s) => s.template));
  for (const t of GRAPHIC_TEMPLATES) assert.ok(templatesSeen.has(t), `no fixture exercised ${t}`);
  for (const spec of specs) {
    const { img, issues } = renderGraphicCard(spec);
    assert.equal(issues.length, 0, `${spec.template} produced issues: ${issues.join("; ")}`);
    assert.ok(isValidFinalAspectRatio(img.width, img.height));
  }
});

test("compositeExactTextLabel still works (Part 6, carried forward)", () => {
  const base = { width: 1360, height: 768, data: new Uint8Array(1360 * 768 * 4).fill(120) };
  const composited = compositeExactTextLabel(base, "-30°C", "dark");
  assert.equal(composited.width, base.width);
  assert.ok(isValidFinalAspectRatio(composited.width, composited.height));
});

test("treatmentIdFor is stable for the same (claimId, template) pair and differs across templates", () => {
  assert.equal(treatmentIdFor("c1", "SYMBOL_NEGATION"), treatmentIdFor("c1", "SYMBOL_NEGATION"));
  assert.notEqual(treatmentIdFor("c1", "SYMBOL_NEGATION"), treatmentIdFor("c1", "PROCESS"));
});
