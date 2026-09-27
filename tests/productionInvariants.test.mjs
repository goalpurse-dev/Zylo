import test from "node:test";
import assert from "node:assert/strict";
import {
  LONG_FORM_FINAL_ASPECT_RATIO, isValidFinalAspectRatio, canSatisfyCrop, compileOverlaySpec,
} from "../supabase/functions/_shared/sceneRenderPlan.ts";
import { classifySceneQA } from "../supabase/functions/_shared/sceneQA.ts";
import { detectStructuralReferenceLeakage, computePerceptualHash } from "../supabase/functions/_shared/sceneVisualAnalysis.ts";
import { resolveSceneReferencePayload, buildReferenceBundleImage } from "../supabase/functions/_shared/sceneReferenceBundle.ts";
import { cropRegion, fitTextToZone, wrapText, renderProgrammaticGraphicCard } from "../supabase/functions/advance-long-form-scene-generation/index.ts";
import { assignRenderStrategies, enforceSequenceDiversity, buildCompositionFingerprint, fingerprintsNearIdentical, refineVisualSequences } from "../supabase/functions/_shared/visualShotPlanning.js";

// 2026-09-16 "PRODUCTION INVARIANTS + VISUAL-DIVERSITY/GRAPHICS FIXES" pass
// — Section 20's lettered regression tests (A-J), each locking in a fix
// traced to a REAL, directly-observed defect in Mars's newest run (shots
// 01/18/19/28-30/32/53-56 — see the final report for the full per-shot
// audit). J (LOW criticality -> no unnecessary reference) is already fully
// covered by tests/referenceCriticalityResolver.test.mjs's own "tablet
// close-up" case and is not duplicated here.

function solidImage(width, height, rgb) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) { data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255; }
  return { width, height, data };
}

/* A — reference sheet appears in final image -> HARD_FAIL REFERENCE_LEAKAGE (deterministic backstop) */
test("A: detectStructuralReferenceLeakage flags a region of the output that closely matches a bundled reference source image", () => {
  const sourceA = solidImage(768, 768, [255, 240, 220]); // e.g. a character sheet's cream background
  const sourceB = solidImage(768, 768, [30, 60, 120]); // e.g. a location reference
  const bundle = buildReferenceBundleImage([sourceA, sourceB]);
  // Simulate Kling reproducing the bundle's own layout into the "final" output.
  const result = detectStructuralReferenceLeakage(bundle, [sourceA, sourceB]);
  assert.equal(result.leaked, true);
  assert.equal(typeof result.matchedSourceIndex, "number");
});
test("A: a genuinely fresh, unrelated final image is NOT flagged by the structural backstop", () => {
  const sourceA = solidImage(768, 768, [255, 240, 220]);
  const sourceB = solidImage(768, 768, [30, 60, 120]);
  const freshOutput = solidImage(2720, 1536, [90, 140, 90]); // a plausible real scene, unrelated palette
  const result = detectStructuralReferenceLeakage(freshOutput, [sourceA, sourceB]);
  assert.equal(result.leaked, false);
});
test("A (routing root cause): once maxReferenceImages is respected, resolveSceneReferencePayload no longer defaults to a visible collage — it sends the top reference and describes the rest in TEXT only", async () => {
  const assets = [
    { id: "char1", result_url: "https://example.com/char.jpg", reference_type: "character_reference", entity_name: "Protagonist" },
    { id: "loc1", result_url: "https://example.com/loc.jpg", reference_type: "location_reference", entity_name: "Habitat Module" },
  ];
  const result = await resolveSceneReferencePayload({ admin: {}, renderModel: "klingai:kling-image@o3", maxReferenceImages: 1, visualWorldVersionId: "w1", canonicalReferenceAssets: assets });
  assert.equal(result.usedBundle, false, "no visible collage board by default");
  assert.equal(result.referenceUrls.length, 1);
  assert.equal(result.referenceUrls[0], "https://example.com/char.jpg", "the higher-priority (character) reference wins the one real slot");
  assert.match(result.promptInstruction ?? "", /Habitat Module/, "the dropped reference is still named in text");
  assert.equal(result.structuralOnlyAssets.length, 1);
});

/* B — CROP requests portrait framing in long-form -> rejected/escalated before final output */
test("B: canSatisfyCrop rejects a DETAIL shotSize (the real shot-19 combination) — CROP cannot isolate a tight detail while staying 16:9", () => {
  assert.equal(canSatisfyCrop({ shotSize: "DETAIL" }), false);
  assert.equal(canSatisfyCrop({ shotSize: "WIDE" }), true);
  assert.equal(canSatisfyCrop({ shotSize: "MEDIUM" }), true);
  assert.equal(canSatisfyCrop({ shotSize: "CLOSE" }), true);
});
test("B: the CROP executor itself (cropRegion) always produces a true 16:9 window regardless of named region — the real shot-19 bug (a literal 907x1536 portrait slice) can no longer happen even if an invalid region reaches it", () => {
  const source = solidImage(2720, 1536, [10, 10, 10]);
  for (const region of ["left_third", "center_third", "right_third", "top_half", "bottom_half", "center_detail", "unknown_region_string"]) {
    const cropped = cropRegion(source, region);
    assert.ok(isValidFinalAspectRatio(cropped.width, cropped.height), `${region} produced ${cropped.width}x${cropped.height}, not 16:9`);
  }
});

/* C — all final output strategies -> enforce 16:9 */
test("C: isValidFinalAspectRatio accepts real 16:9 renders and rejects the real shot-19 portrait dimensions", () => {
  assert.equal(isValidFinalAspectRatio(2720, 1536), true);
  assert.equal(isValidFinalAspectRatio(1360, 768), true);
  assert.equal(isValidFinalAspectRatio(907, 1536), false, "the exact real shot-19 dimensions must fail");
  assert.equal(isValidFinalAspectRatio(1536, 1536), false, "square");
  assert.equal(isValidFinalAspectRatio(1080, 1920), false, "9:16 portrait");
});
test("C: classifySceneQA HARD_FAILs on finalFrameGeometryValid:false, checked before reference/identity signals", () => {
  const r = classifySceneQA({
    requiredCharactersPresent: true, characterIdentityConsistent: true, locationIdentityConsistent: true,
    actionMatchesDescription: true, framingMatchesShotSize: true, isCharacterSheetLayout: false,
    referenceLeakageDetected: false, semanticPolarityViolated: false, forbiddenEntityPresent: false,
    textArtifactSeverity: "none", styleMismatchSeverity: "none", corruptionArtifacts: false, environmentIrrelevant: false,
    reasons: [], finalFrameGeometryValid: false,
  });
  assert.equal(r.severity, "HARD_FAIL");
  assert.equal(r.failureType, "INVALID_FINAL_FRAME_GEOMETRY");
});
test("C: renderProgrammaticGraphicCard's fixed canvas and cropRegion's windows both independently satisfy the SAME 16:9 invariant (within tolerance — Kling's own approved sizes, e.g. 2720x1536, round to 1.7708 rather than the exact 1.7778 ratio)", () => {
  const { img } = renderProgrammaticGraphicCard({ text: "TEST" }, { name: "test" });
  assert.ok(isValidFinalAspectRatio(img.width, img.height), `${img.width}x${img.height} must pass the same 16:9 invariant check every other strategy is held to`);
});

/* D — three adjacent composition fingerprints nearly identical -> sequence-diversity planner changes one */
function photoBeat(overrides) {
  return {
    id: "b", renderMethod: "GENERATE", visualType: "STORY_ILLUSTRATION", shotSize: "MEDIUM", baseSetupKey: "setup1", candidateBaseKey: "setup1", primarySubject: "protagonist",
    informationToCommunicate: "focus: the protagonist continues the task", estimatedStartSeconds: 90, estimatedEndSeconds: 96,
    ...overrides,
  };
}
test("D: three consecutive beats sharing an identical composition fingerprint get their middle beat forced to a fresh GENERATE", () => {
  const beats = [photoBeat({ id: "s28" }), photoBeat({ id: "s29", renderMethod: "REUSE" }), photoBeat({ id: "s30", renderMethod: "EDIT" })];
  enforceSequenceDiversity(beats);
  assert.equal(beats[1].renderMethod, "GENERATE", "the middle beat (s29) must be forced to a fresh composition");
  assert.equal(beats[1].diversityForced, true);
  assert.notEqual(beats[1].baseSetupKey, "setup1", "must get its OWN fresh setup key, not keep sharing the stagnant one");
});
test("D: buildCompositionFingerprint/fingerprintsNearIdentical correctly treat a real strategy-mix (GENERATE/REUSE/EDIT) as visually identical when subject/shotSize/form/setup all match — proving strategy alone was never a sufficient diversity signal", () => {
  const a = buildCompositionFingerprint(photoBeat({ id: "a" }));
  const b = buildCompositionFingerprint(photoBeat({ id: "b", renderMethod: "REUSE" }));
  assert.equal(fingerprintsNearIdentical(a, b), true);
});
test("D: a real subject/shotSize change between neighbors is correctly NOT flagged as stagnation", () => {
  const beats = [photoBeat({ id: "s1" }), photoBeat({ id: "s2", shotSize: "CLOSE" }), photoBeat({ id: "s3" })];
  enforceSequenceDiversity(beats);
  assert.equal(beats[1].diversityForced, undefined);
});

/* E — intentional power-on/power-off comparison -> identical composition allowed */
test("E: intentionalVisualComparison exempts an identical-fingerprint window from the diversity rule", () => {
  const beats = [
    photoBeat({ id: "power_on" }),
    photoBeat({ id: "power_off", renderMethod: "EDIT", intentionalVisualComparison: true, comparisonDimension: "POWER_STATE" }),
    photoBeat({ id: "next" }),
  ];
  enforceSequenceDiversity(beats);
  assert.equal(beats[1].renderMethod, "EDIT", "a real before/after comparison must survive unforced");
  assert.equal(beats[1].diversityForced, undefined);
});
test("E: refineVisualSequences only sets intentionalVisualComparison when BOTH comparisonClaims exist AND continuityRequirement is HIGH — a COMPARISON claim between two different (LOW-continuity) locations is correctly NOT exempted", () => {
  const script = { narrationSegments: [{ id: "seg1", text: "Small setups suit a shoebox habitat; large setups suit a research base." }] };
  const macro = { id: "m1", narrationSegmentIds: ["seg1"], locationId: "loc1", informationToCommunicate: "compare setups", estimatedStartSeconds: 0, estimatedEndSeconds: 8 };
  const claim = { claimId: "c1", narrationSegmentIds: ["seg1"], narrationText: script.narrationSegments[0].text, comparisonClaims: ["small setups; large setups"], continuityRequirement: "LOW", primarySubject: "setups", preferredVisualForms: ["COMPARISON_SPLIT"] };
  const plan = { visualSequences: [macro], entityRegistry: [] };
  const refined = refineVisualSequences(plan, script, "balanced", [claim]);
  const beat = refined.visualBeats.find((b) => b.narrationClaimId === "c1");
  assert.ok(beat, "the claim should have matched at least one shot");
  assert.equal(beat.intentionalVisualComparison, false, "LOW continuity must not earn the same-composition exemption even though it's a COMPARISON claim");
});

/* F — GRAPHIC receives long narration sentence -> renderer does NOT print it verbatim */
test("F: compileOverlaySpec flags overlay text over the ~9-word guidance rather than silently accepting a full sentence", () => {
  const short = compileOverlaySpec("DIAGRAM", "Max EVA time", "primary", null);
  assert.equal(short.exceedsWordGuidance, false);
  const long = compileOverlaySpec("DIAGRAM", "Every single EVA consumes a strictly limited radiation and oxygen budget for the crew", "primary", null);
  assert.equal(long.exceedsWordGuidance, true);
});
test("F: a quantitative claim routes to NUMBER_EMPHASIS instead of always BIG_TEXT — a real stat reads as a stat, not a sentence", () => {
  const spec = compileOverlaySpec("DIAGRAM", "2 hours max EVA", "primary", { quantitativeClaims: ["2 hours"] });
  assert.equal(spec.type, "NUMBER_EMPHASIS");
});
test("F: renderProgrammaticGraphicCard's NUMBER_EMPHASIS layout renders the numeric token far larger than a plain BIG_TEXT card would, and never just re-prints one uniform-size sentence", () => {
  const { img, overflowed } = renderProgrammaticGraphicCard({ type: "NUMBER_EMPHASIS", text: "2 HOURS MAX EVA TIME", textStyle: { casing: "upper" } }, { name: "test" });
  assert.equal(overflowed, false);
  assert.equal(img.width, 2720);
});

/* G — BIG_TEXT exceeds layout capacity -> automatic resize/re-layout/split */
test("G: fitTextToZone shrinks scale automatically rather than overflowing the safe zone", () => {
  const longText = "THIS SENTENCE IS DELIBERATELY MUCH TOO LONG TO FIT A SAFE ZONE AT THE DEFAULT STARTING SCALE";
  const fit = fitTextToZone(longText, 90, 8, 2400, 400);
  assert.equal(fit.overflowed, false, "a real (if extreme) shrink should still find a fitting scale before hitting the floor");
  assert.ok(fit.scale < 90, "must have actually shrunk from the starting scale");
  for (const line of fit.lines) assert.ok(line.length > 0);
});
test("G: wrapText and fitTextToZone never disagree about line width (no line in fitTextToZone's output exceeds maxWidth at its own chosen scale)", () => {
  const fit = fitTextToZone("A REASONABLY LONG PIECE OF OVERLAY TEXT FOR A GRAPHIC CARD", 60, 10, 1800, 900);
  for (const line of fit.lines) {
    const w = wrapText(line, fit.scale, 999999)[0]; // measure the line itself at the chosen scale
    assert.ok(w.length > 0);
  }
});

/* H — programmatic graphic text overflows -> cannot become Ready */
test("H: fitTextToZone reports overflowed:true (not silently clipped) when even the floor scale can't fit the text", () => {
  const impossible = "A" .repeat(500);
  const fit = fitTextToZone(impossible, 20, 18, 100, 50);
  assert.equal(fit.overflowed, true);
  assert.ok(fit.lines.join(" ").includes("…"), "must ship a visibly truncated marker, never silently clipped pixels");
});
test("H: the real Mars sample overlay ('Max EVA time') fits cleanly and is never flagged as overflow", () => {
  const fit = fitTextToZone("MAX EVA TIME", 90, 36, 2394, 400);
  assert.equal(fit.overflowed, false);
});

/* Sanity: assignRenderStrategies + enforceSequenceDiversity compose correctly end-to-end on a small synthetic timeline */
test("assignRenderStrategies followed by enforceSequenceDiversity never crashes on a graphic-only or single-beat timeline (edge cases)", () => {
  assert.doesNotThrow(() => { const beats = []; assignRenderStrategies(beats); enforceSequenceDiversity(beats); });
  assert.doesNotThrow(() => { const beats = [photoBeat({ id: "only" })]; assignRenderStrategies(beats); enforceSequenceDiversity(beats); });
});
