import test from "node:test";
import assert from "node:assert/strict";
import { classifySceneQA } from "../supabase/functions/_shared/sceneQA.ts";
import { assignRenderStrategies, enforceSequenceDiversity, buildCompositionFingerprint } from "../supabase/functions/_shared/visualShotPlanning.js";
import { detectSharedIdentityAcrossDistinctRoles, sceneHasIdentityCollision } from "../supabase/functions/_shared/castIdentityPolicy.ts";
import { determineRepairAction, repairIsBillable } from "../supabase/functions/_shared/repairLadder.ts";
import { runEpisodeQA } from "../supabase/functions/_shared/episodeQA.ts";
import { CLAIM_TYPES, CONTENT_MODES } from "../supabase/functions/_shared/narrationVisualContract.ts";

// 2026-09-18 "ZYVO LONG-FORM — PRODUCTION VISUAL RELIABILITY V2" — Section
// 30's regression coverage for the genuinely NEW pieces built this pass
// (one-scene invariant generalization, rolling freshness windows,
// distinct-cast policy, the auto-repair ladder decision table, episode-
// level QA, and the genre-agnostic contentMode/claimType extension). Items
// already covered by the prior two passes' own test files (16:9 invariant,
// contract version pinning, reference-leakage hard-fail, CROP/REUSE
// invariants, structured GraphicSpec) are NOT re-duplicated here.

function goodQa(overrides = {}) {
  return {
    requiredCharactersPresent: true, characterIdentityConsistent: true, locationIdentityConsistent: true,
    actionMatchesDescription: true, framingMatchesShotSize: true, isCharacterSheetLayout: false,
    referenceLeakageDetected: false, multiPanelViolation: false, castCloningDetected: false, semanticPolarityViolated: false, forbiddenEntityPresent: false,
    textArtifactSeverity: "none", styleMismatchSeverity: "none", corruptionArtifacts: false, environmentIrrelevant: false,
    reasons: [], ...overrides,
  };
}

/* Section 9: general one-scene-only invariant */
test("multiPanelViolation is a HARD_FAIL when the beat was NOT authorized for multi-panel", () => {
  const r = classifySceneQA(goodQa({ multiPanelViolation: true }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "UNAUTHORIZED_MULTI_PANEL");
});
test("multiPanelViolation does NOT hard-fail when the beat's own contract explicitly authorized multi-panel (a real COMPARISON/BEFORE_AFTER)", () => {
  const r = classifySceneQA(goodQa({ multiPanelViolation: true }), { allowMultiPanel: true });
  assert.notEqual(r.severity, "HARD_FAIL");
});
test("multiPanelViolation is independent of referenceLeakageDetected/isCharacterSheetLayout — a plain collage with NO reference material involved still hard-fails", () => {
  const r = classifySceneQA(goodQa({ multiPanelViolation: true, referenceLeakageDetected: false, isCharacterSheetLayout: false }));
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "UNAUTHORIZED_MULTI_PANEL");
});

/* Section 7: rolling-window sequence freshness (3/5/8) */
function photoBeat(overrides) {
  return { id: "b", renderMethod: "GENERATE", visualType: "STORY_ILLUSTRATION", shotSize: "MEDIUM", baseSetupKey: "setup1", candidateBaseKey: "setup1", primarySubject: "protagonist", ...overrides };
}
test("a 5-shot run sharing one baseSetupKey (but varying enough to dodge the strict 3-window check) is caught by the long-run window and broken at its midpoint", () => {
  const beats = [
    photoBeat({ id: "s1", shotSize: "WIDE" }),
    photoBeat({ id: "s2", shotSize: "MEDIUM" }), // differs from s1 -> strict 3-window never fires
    photoBeat({ id: "s3", shotSize: "CLOSE" }),
    photoBeat({ id: "s4", shotSize: "MEDIUM" }),
    photoBeat({ id: "s5", shotSize: "WIDE" }),
  ];
  enforceSequenceDiversity(beats);
  const forced = beats.filter((b) => b.diversityForced);
  assert.equal(forced.length, 1, "exactly one beat in the 5-run should be forced fresh");
  assert.equal(forced[0].id, "s3", "the midpoint of the 5-shot run");
  assert.equal(forced[0].freshnessDecision, "sequence_diversity_break_long_run");
});
test("an 8-shot run all sharing one baseSetupKey is caught even when NO 5-window would have (because a 5-sub-window inside it might have been interrupted) — the 8-window is checked independently", () => {
  const beats = Array.from({ length: 8 }, (_, i) => photoBeat({ id: `r${i}`, shotSize: i % 2 === 0 ? "WIDE" : "CLOSE" }));
  enforceSequenceDiversity(beats);
  assert.ok(beats.some((b) => b.diversityForced), "a long enough run on one setup must be caught by SOME window");
});
test("intentionalVisualComparison beats inside a long run are exempt from the long-run break", () => {
  const beats = Array.from({ length: 5 }, (_, i) => photoBeat({ id: `c${i}`, intentionalVisualComparison: true }));
  enforceSequenceDiversity(beats);
  assert.equal(beats.some((b) => b.diversityForced), false);
});
test("a genuinely varied sequence (different baseSetupKey every shot) is never touched by either window", () => {
  const beats = Array.from({ length: 8 }, (_, i) => photoBeat({ id: `v${i}`, baseSetupKey: `setup${i}`, candidateBaseKey: `setup${i}` }));
  enforceSequenceDiversity(beats);
  assert.equal(beats.some((b) => b.diversityForced), false);
});

/* Section 11: distinct-cast role-aware identity policy */
test("detectSharedIdentityAcrossDistinctRoles flags two DISTINCT HERO/RECURRING characters sharing one canonical asset", () => {
  const entities = [
    { entityId: "protagonist", name: "Protagonist", category: "CHARACTER", importance: "HERO", referenceNeeded: true },
    { entityId: "engineer", name: "Engineer", category: "CHARACTER", importance: "RECURRING", referenceNeeded: true },
  ];
  const assets = new Map([["protagonist", "asset_A"], ["engineer", "asset_A"]]);
  const violations = detectSharedIdentityAcrossDistinctRoles(entities, assets);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].entities.length, 2);
});
test("detectSharedIdentityAcrossDistinctRoles does NOT flag a LOW-importance background extra sharing a generic asset", () => {
  const entities = [
    { entityId: "protagonist", name: "Protagonist", category: "CHARACTER", importance: "HERO", referenceNeeded: true },
    { entityId: "extra1", name: "Background Extra", category: "CHARACTER", importance: "LOW", referenceNeeded: false },
  ];
  const assets = new Map([["protagonist", "asset_A"], ["extra1", "asset_generic"]]);
  assert.equal(detectSharedIdentityAcrossDistinctRoles(entities, assets).length, 0);
});
test("sceneHasIdentityCollision detects 3 required roles resolving to only 1 real asset ('five clones of the protagonist')", () => {
  const assets = new Map([["a", "asset_1"], ["b", "asset_1"], ["c", "asset_1"]]);
  assert.equal(sceneHasIdentityCollision(["a", "b", "c"], assets), true);
});
test("sceneHasIdentityCollision is false when every required role has its own distinct asset", () => {
  const assets = new Map([["a", "asset_1"], ["b", "asset_2"]]);
  assert.equal(sceneHasIdentityCollision(["a", "b"], assets), false);
});

/* Section 20: auto-repair ladder */
test("determineRepairAction maps REFERENCE_LEAKAGE to a billable FRESH_GENERATE", () => {
  const d = determineRepairAction("REFERENCE_LEAKAGE");
  assert.equal(d.action, "FRESH_GENERATE");
  assert.equal(d.billable, true);
  assert.equal(d.providerCallRequired, true);
});
test("determineRepairAction maps CRITICAL_TEXT to a non-billable DETERMINISTIC_OVERLAY — never another paid image generation for wrong text", () => {
  const d = determineRepairAction("CRITICAL_TEXT");
  assert.equal(d.action, "DETERMINISTIC_OVERLAY");
  assert.equal(d.billable, false);
});
test("determineRepairAction maps GRAPHIC_RENDER_DEFECT and GRAPHIC_REPLAN_REQUIRED to non-billable RECOMPILE_GRAPHIC", () => {
  assert.equal(determineRepairAction("GRAPHIC_RENDER_DEFECT").billable, false);
  assert.equal(determineRepairAction("GRAPHIC_REPLAN_REQUIRED").action, "RECOMPILE_GRAPHIC");
});
test("determineRepairAction maps INVALID_FINAL_FRAME_GEOMETRY to a non-billable local correction (fix the pixels we already have before ever paying for a new render)", () => {
  const d = determineRepairAction("INVALID_FINAL_FRAME_GEOMETRY");
  assert.equal(d.action, "LOCAL_DETERMINISTIC_CORRECTION");
  assert.equal(d.billable, false);
});
test("determineRepairAction returns NONE (never a guess) for an unrecognized failureType", () => {
  assert.equal(determineRepairAction("SOME_UNKNOWN_FAILURE_TYPE").action, "NONE");
  assert.equal(determineRepairAction(null).action, "NONE");
});
test("repairIsBillable is a real shortcut matching determineRepairAction's own billable field", () => {
  assert.equal(repairIsBillable("REFERENCE_LEAKAGE"), true);
  assert.equal(repairIsBillable("CRITICAL_TEXT"), false);
});

/* Section 22: episode-level QA */
function scene(overrides) { return { id: "s", sequenceIndex: 0, renderStrategy: "GENERATE", baseSetupKey: null, status: "succeeded", ...overrides }; }
test("runEpisodeQA flags exact duplicate output between two independently-generated scenes", () => {
  const scenes = [
    scene({ id: "a", sequenceIndex: 1, resultUrl: "https://x/img.jpg" }),
    scene({ id: "b", sequenceIndex: 2, resultUrl: "https://x/img.jpg" }),
  ];
  const warnings = runEpisodeQA(scenes);
  assert.ok(warnings.some((w) => w.code === "EXACT_DUPLICATE_OUTPUT"));
});
test("runEpisodeQA does NOT flag a REUSE scene sharing its source's own resultUrl (that's REUSE's whole point)", () => {
  const scenes = [
    scene({ id: "a", sequenceIndex: 1, resultUrl: "https://x/img.jpg", renderStrategy: "GENERATE" }),
    scene({ id: "b", sequenceIndex: 2, resultUrl: "https://x/img.jpg", renderStrategy: "REUSE" }),
  ];
  assert.equal(runEpisodeQA(scenes).some((w) => w.code === "EXACT_DUPLICATE_OUTPUT"), false);
});
test("runEpisodeQA flags a repeated-setup run of 5+ consecutive shots, matching the brief's own example message shape", () => {
  const scenes = Array.from({ length: 6 }, (_, i) => scene({ id: `s${i}`, sequenceIndex: i + 1, baseSetupKey: "setupX", startSeconds: i * 4, endSeconds: i * 4 + 4 }));
  const warnings = runEpisodeQA(scenes);
  const w = warnings.find((x) => x.code === "REPEATED_SETUP_RUN");
  assert.ok(w);
  assert.match(w.message, /Shots 1–6 reuse the same visual setup/);
});
test("runEpisodeQA flags excessive edit lineage off one base", () => {
  const scenes = [
    scene({ id: "a", sequenceIndex: 1, renderStrategy: "EDIT", baseSetupKey: "setupY" }),
    scene({ id: "b", sequenceIndex: 2, renderStrategy: "EDIT", baseSetupKey: "setupY" }),
    scene({ id: "c", sequenceIndex: 3, renderStrategy: "EDIT", baseSetupKey: "setupY" }),
  ];
  assert.ok(runEpisodeQA(scenes).some((w) => w.code === "EXCESSIVE_EDIT_LINEAGE"));
});
test("runEpisodeQA flags graphic clustering (3+ graphics within a 4-shot window)", () => {
  const scenes = [
    scene({ id: "a", sequenceIndex: 1, renderStrategy: "PROGRAMMATIC_GRAPHIC" }),
    scene({ id: "b", sequenceIndex: 2, renderStrategy: "GENERATE" }),
    scene({ id: "c", sequenceIndex: 3, renderStrategy: "PROGRAMMATIC_GRAPHIC" }),
    scene({ id: "d", sequenceIndex: 4, renderStrategy: "PROGRAMMATIC_GRAPHIC" }),
  ];
  assert.ok(runEpisodeQA(scenes).some((w) => w.code === "GRAPHIC_CLUSTERING"));
});
test("runEpisodeQA flags two adjacent TEXT_EMPHASIS graphic cards", () => {
  const scenes = [
    scene({ id: "a", sequenceIndex: 1, renderStrategy: "PROGRAMMATIC_GRAPHIC", graphicTemplate: "TEXT_EMPHASIS" }),
    scene({ id: "b", sequenceIndex: 2, renderStrategy: "PROGRAMMATIC_GRAPHIC", graphicTemplate: "TEXT_EMPHASIS" }),
  ];
  assert.ok(runEpisodeQA(scenes).some((w) => w.code === "ADJACENT_TEXT_EMPHASIS"));
});
test("runEpisodeQA does NOT flag two adjacent graphics of DIFFERENT templates (variety is fine, only repeated TEXT_EMPHASIS is the anti-clustering target)", () => {
  const scenes = [
    scene({ id: "a", sequenceIndex: 1, renderStrategy: "PROGRAMMATIC_GRAPHIC", graphicTemplate: "TEXT_EMPHASIS" }),
    scene({ id: "b", sequenceIndex: 2, renderStrategy: "PROGRAMMATIC_GRAPHIC", graphicTemplate: "CAUSE_EFFECT" }),
  ];
  assert.equal(runEpisodeQA(scenes).some((w) => w.code === "ADJACENT_TEXT_EMPHASIS"), false);
});
test("runEpisodeQA flags missing frames (failed scenes with no successful output)", () => {
  const scenes = [scene({ id: "a", sequenceIndex: 1, status: "failed" })];
  assert.ok(runEpisodeQA(scenes).some((w) => w.code === "MISSING_FRAMES"));
});
test("runEpisodeQA on a genuinely clean episode returns zero warnings", () => {
  const scenes = Array.from({ length: 6 }, (_, i) => scene({ id: `s${i}`, sequenceIndex: i + 1, baseSetupKey: `setup${i}`, resultUrl: `https://x/${i}.jpg` }));
  assert.deepEqual(runEpisodeQA(scenes), []);
});

/* Section 3/0: genre-agnostic taxonomy extension */
test("CLAIM_TYPES now covers non-documentary narrative functions (HOOK/ACTION/REACTION/DECISION/CONSEQUENCE/SOCIAL_INTERACTION/CALLBACK) alongside the original documentary-shaped values", () => {
  for (const v of ["HOOK", "SETUP", "ACTION", "REACTION", "MECHANISM", "DECISION", "CONSEQUENCE", "SOCIAL_INTERACTION", "CALLBACK", "EMPHASIS"]) {
    assert.ok(CLAIM_TYPES.includes(v), `missing narrative function: ${v}`);
  }
  // original values still present — this was an EXTENSION, not a rewrite
  for (const v of ["FACT", "NEGATION", "COMPARISON", "CAUSE_EFFECT", "QUANTITY"]) assert.ok(CLAIM_TYPES.includes(v));
});
test("CONTENT_MODES covers the genres named in the brief, including non-documentary ones", () => {
  for (const v of ["SCENARIO_NARRATIVE", "FINANCIAL_BUSINESS", "SOCIAL_PSYCHOLOGY", "HYPOTHETICAL", "MIXED"]) {
    assert.ok(CONTENT_MODES.includes(v));
  }
});
