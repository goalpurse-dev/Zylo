import test from "node:test";
import assert from "node:assert/strict";
import { mergeDraftIntoBible, validateBible, warnBible } from "../supabase/functions/_shared/stickman/productionBible.ts";
import { STICKMAN_DOODLE_EXPLAINER_V1 } from "../supabase/functions/_shared/stickman/styleContract.ts";

// 2026-10-02 "Production Bible" pass — deterministic (no real LLM call)
// coverage of mergeDraftIntoBible/validateBible/warnBible, using synthetic
// draft objects that stand in for what the real gpt-5-mini call would
// return. The real, live, paid-call end-to-end evidence (across the 8
// required episode fixtures) lives in scripts/stickmanProductionBibleLive.mjs
// — kept separate so CI never makes a real OpenAI call.

const baseCtx = { productionBibleVersion: 1, projectId: "proj-1", generationProfileId: "profile-1", scriptVersionId: "script-1" };

function baseHero(overrides = {}) {
  return {
    exists: false, subjectType: "none", semanticIdentity: "", canonicalAppearance: "", headFaceConstruction: "",
    bodyConstruction: "", skinTone: "", hair: "", outfit: "", accessories: [], persistentIdentifyingFeatures: [],
    bodyProportions: "", emotionalExpressionLanguage: "", forbiddenMutations: [],
    ...overrides,
  };
}
function baseDraft(overrides = {}) {
  return {
    visualPremise: "A visual exploration of X.", visualTone: "curious and clear",
    continuityMode: "NONE", continuityModeReasoning: "No persistent individual is followed; this is a pure mechanism explainer.",
    hero: baseHero(),
    recurringCharacters: [],
    world: { settingFamilies: ["a generic lab"], architecture: "", geography: "", era: "present day", recurringEnvironmentConstruction: "2 flat layers", environmentalColorRules: "cool blues", weatherTimeConventions: "", historicalScientificConstraints: [] },
    objectLanguage: [],
    palette: { primaryColors: ["blue", "white"], supportingColors: ["grey"], environmentPaletteRules: "cool", contrastRules: "high contrast for readability", colorApproach: "LIMITED_PALETTE", monochromeJustification: "" },
    colorStrategy: "Cool blues throughout, consistent with a clinical explainer tone.",
    lightingStrategy: "Even flat lighting, no dramatic shadow.",
    graphicLanguageNotes: { diagramConventions: "simple flat diagrams", comparisonLayouts: "side by side", timelineConventions: "horizontal bar", mapConventions: "n/a", symbolicMetaphorLanguage: "n/a" },
    cameraLanguageNotes: { framingConventions: "mostly wide/medium", visualHierarchyRules: "one idea per frame", whenEstablishingVsCloseupVsDiagram: "diagrams for mechanisms, wide shots for context" },
    episodeSpecificContinuityRules: { neverDrift: [], allowedToVary: [], episodeWideConsistencyRules: [] },
    factualVisualConstraints: [],
    episodeSpecificNegativeRules: [],
    ...overrides,
  };
}

test("mergeDraftIntoBible copies recipe style traits VERBATIM — the LLM never re-authors universal grammar", () => {
  const bible = mergeDraftIntoBible(baseDraft(), baseCtx);
  assert.equal(bible.styleContract.medium, STICKMAN_DOODLE_EXPLAINER_V1.styleTraits.medium);
  assert.equal(bible.styleContract.lineLanguage, STICKMAN_DOODLE_EXPLAINER_V1.styleTraits.lineLanguage);
  assert.deepEqual(bible.styleContract.forbiddenStyleTraits, STICKMAN_DOODLE_EXPLAINER_V1.styleTraits.forbiddenStyleTraits);
  // Only these two style fields are episode-specialized (LLM-authored).
  assert.equal(bible.styleContract.colorStrategy, "Cool blues throughout, consistent with a clinical explainer tone.");
  assert.equal(bible.styleContract.lightingStrategy, "Even flat lighting, no dramatic shadow.");
});

test("mergeDraftIntoBible merges recipe negative rules with episode-specific ones, deduplicated", () => {
  const bible = mergeDraftIntoBible(baseDraft({ episodeSpecificNegativeRules: ["the device's screen must never show real readable app text", "accidental 3D render or CGI look"] }), baseCtx);
  assert.ok(bible.negativeRules.includes("accidental 3D render or CGI look")); // present in BOTH recipe + episode list
  const occurrences = bible.negativeRules.filter((r) => r === "accidental 3D render or CGI look").length;
  assert.equal(occurrences, 1, "must be deduplicated, never listed twice");
  assert.ok(bible.negativeRules.includes("the device's screen must never show real readable app text"));
  for (const universal of STICKMAN_DOODLE_EXPLAINER_V1.universalForbiddenOutcomes) assert.ok(bible.negativeRules.includes(universal));
});

test("mergeDraftIntoBible's graphicLanguage explicitly allows characters/objects inside graphics — never text-card-only", () => {
  const bible = mergeDraftIntoBible(baseDraft(), baseCtx);
  assert.match(bible.graphicLanguage.characterUseInsideGraphics, /allowed|encouraged/i);
  assert.doesNotMatch(bible.graphicLanguage.characterUseInsideGraphics, /^text only$/i);
});

test("mergeDraftIntoBible's textPolicy default is always OFF for provider-generated text, regardless of draft content", () => {
  const bible = mergeDraftIntoBible(baseDraft(), baseCtx);
  assert.equal(bible.textPolicy.providerGeneratedTextDefault, "OFF");
  assert.equal(bible.textPolicy.exactTextHandledDownstream, true);
});

/* ---- Protagonist detection (validateBible's consistency checks) ---- */

test("validateBible: a real protagonist (HERO mode) with a full canonical appearance passes clean", () => {
  const draft = baseDraft({
    continuityMode: "HERO", continuityModeReasoning: "The narration places 'you' as a millionaire and follows your experience throughout.",
    hero: baseHero({ exists: true, subjectType: "human", semanticIdentity: "second-person viewer avatar", canonicalAppearance: "a modern adult, medium build, ...", persistentIdentifyingFeatures: ["dark hair", "grey hoodie"] }),
  });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.deepEqual(validateBible(bible), []);
  assert.equal(bible.continuityMode, "HERO");
  assert.equal(bible.hero.exists, true);
});

test("validateBible: NONE mode (no protagonist) with hero.exists:false passes clean — a mechanism explainer never gets a forced protagonist", () => {
  const bible = mergeDraftIntoBible(baseDraft(), baseCtx); // default draft is NONE / no hero
  assert.deepEqual(validateBible(bible), []);
  assert.equal(bible.continuityMode, "NONE");
  assert.equal(bible.hero.exists, false);
});

test("validateBible rejects a HERO mode claim with no hero actually defined (inconsistent protagonist logic)", () => {
  const draft = baseDraft({ continuityMode: "HERO", continuityModeReasoning: "reasoning", hero: baseHero({ exists: false }) });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.ok(validateBible(bible).includes("CONTINUITY_MODE_HERO_BUT_NO_HERO_DEFINED"));
});

test("validateBible rejects hero.exists:true under continuityMode NONE — a protagonist must never sneak in when none was decided", () => {
  const draft = baseDraft({ continuityMode: "NONE", hero: baseHero({ exists: true, canonicalAppearance: "someone" }) });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.ok(validateBible(bible).includes("HERO_EXISTS_BUT_CONTINUITY_MODE_IS_NONE"));
});

test("validateBible rejects SUBJECT mode with no subject defined (e.g. a lion/planet episode that never actually locked its subject)", () => {
  const draft = baseDraft({ continuityMode: "SUBJECT", hero: baseHero({ exists: false }) });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.ok(validateBible(bible).includes("CONTINUITY_MODE_SUBJECT_BUT_NO_SUBJECT_DEFINED"));
});

test("validateBible rejects a hero claimed to exist with no canonical appearance text", () => {
  const draft = baseDraft({ continuityMode: "HERO", hero: baseHero({ exists: true, canonicalAppearance: "" }) });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.ok(validateBible(bible).includes("HERO_EXISTS_BUT_NO_CANONICAL_APPEARANCE"));
});

/* ---- Recurring characters: no unnecessary full identity contracts ---- */

test("validateBible passes a project with zero recurring characters (side characters correctly not given identity contracts)", () => {
  const bible = mergeDraftIntoBible(baseDraft({ recurringCharacters: [] }), baseCtx);
  assert.deepEqual(validateBible(bible), []);
  assert.equal(bible.recurringCharacters.length, 0);
});

test("validateBible rejects a recurring character contract missing its narrative justification", () => {
  const draft = baseDraft({ recurringCharacters: [{ id: "coworker", role: "skeptical coworker", canonicalAppearance: "a person", identifyingFeatures: ["red jacket"], appearsForNarrativeReason: "" }] });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.ok(validateBible(bible).some((e) => e.startsWith("RECURRING_CHARACTER_MISSING_REASON")));
});

test("validateBible rejects more than 6 recurring characters — the cast must stay small and reasoned", () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, role: "role", canonicalAppearance: "appearance", identifyingFeatures: [], appearsForNarrativeReason: "reason" }));
  const bible = mergeDraftIntoBible(baseDraft({ recurringCharacters: many }), baseCtx);
  assert.ok(validateBible(bible).includes("TOO_MANY_RECURRING_CHARACTERS"));
});

/* ---- Palette / monochrome ---- */

test("validateBible passes a genuinely justified MONOCHROME choice", () => {
  const draft = baseDraft({ palette: { primaryColors: ["black", "white"], supportingColors: [], environmentPaletteRules: "high contrast", contrastRules: "stark", colorApproach: "MONOCHROME", monochromeJustification: "A deliberate noir silhouette treatment for a suspense-driven episode." } });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.deepEqual(validateBible(bible), []);
});

test("validateBible rejects MONOCHROME with no justification (never force grayscale silently)", () => {
  const draft = baseDraft({ palette: { primaryColors: ["black", "white"], supportingColors: [], environmentPaletteRules: "", contrastRules: "", colorApproach: "MONOCHROME", monochromeJustification: "" } });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.ok(validateBible(bible).includes("MONOCHROME_WITHOUT_JUSTIFICATION"));
});

test("validateBible rejects a stray monochrome justification attached to a full-color palette", () => {
  const draft = baseDraft({ palette: { primaryColors: ["orange", "purple"], supportingColors: [], environmentPaletteRules: "", contrastRules: "", colorApproach: "FULL_COLOR", monochromeJustification: "leftover text" } });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.ok(validateBible(bible).includes("JUSTIFICATION_PROVIDED_FOR_NON_MONOCHROME_PALETTE"));
});

test("validateBible never forces grayscale — a default FULL_COLOR/LIMITED_PALETTE draft always validates clean on this axis", () => {
  const bible = mergeDraftIntoBible(baseDraft(), baseCtx);
  assert.equal(bible.palette.colorApproach, "LIMITED_PALETTE");
  assert.deepEqual(validateBible(bible), []);
});

/* ---- warnBible: soft, non-blocking ---- */

test("warnBible flags (but does not block) a HERO-mode non-human subject as worth reconsidering", () => {
  const draft = baseDraft({ continuityMode: "HERO", hero: baseHero({ exists: true, subjectType: "animal", canonicalAppearance: "a lion" }) });
  const bible = mergeDraftIntoBible(draft, baseCtx);
  assert.deepEqual(validateBible(bible), []); // never a hard error
  assert.ok(warnBible(bible).some((w) => w.includes("HERO_MODE_WITH_NON_HUMAN_SUBJECT_TYPE")));
});

test("lineage fields are always stamped from the caller's context, never invented", () => {
  const bible = mergeDraftIntoBible(baseDraft(), { productionBibleVersion: 3, projectId: "p9", generationProfileId: "g9", scriptVersionId: "s9" });
  assert.equal(bible.productionBibleVersion, 3);
  assert.equal(bible.projectId, "p9");
  assert.equal(bible.generationProfileId, "g9");
  assert.equal(bible.scriptVersionId, "s9");
  assert.equal(bible.recipeId, "stickman_doodle_explainer");
  assert.equal(bible.recipeVersion, "STICKMAN_DOODLE_EXPLAINER_V1");
});
