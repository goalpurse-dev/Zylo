import test from "node:test";
import assert from "node:assert/strict";
import {
  computePerceptualHash, hammingDistance, NEAR_DUPLICATE_HAMMING_THRESHOLD,
  computeSharpness, classifyBlurSeverity, classifyVisualDelta, hasMaterialVisualDelta,
} from "../supabase/functions/_shared/sceneVisualAnalysis.ts";
import { recomputeSceneApproval } from "../supabase/functions/_shared/sceneQA.ts";

// Part 9/12/13/14 (2026-09-15 "VISUAL VARIETY + PROFESSIONAL ON-SCREEN TEXT +
// QA CALIBRATION" pass) — local, zero-provider-cost visual analysis plus the
// recalibrated hard/soft QA gate. See the final report for the real Mars
// audit evidence (52% of Needs Review rejections were text-only) that
// motivated the `hasProgrammaticTextOverlay` soft-warning carve-out below.

function solidImage(w, h, [r, g, b]) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  return { width: w, height: h, data };
}
function checkerImage(w, h) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const on = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) === 0;
    data[i] = data[i + 1] = data[i + 2] = on ? 240 : 10; data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}
function blur(img, radius = 4) {
  // Box blur (both axes, radius 4 — empirically confirmed to drop this
  // module's sharpness metric to ~0.42x of the source, comfortably past the
  // "major" 0.45x threshold, unlike a 1px blur which barely moves it).
  const { width, height } = img;
  const out = new Uint8Array(img.data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) {
      let sum = 0, n = 0;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const ny = y + dy, nx = x + dx;
        if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
        sum += img.data[(ny * width + nx) * 4 + c]; n++;
      }
      out[i + c] = Math.round(sum / n);
    }
    out[i + 3] = 255;
  }
  return { width, height, data: out };
}

/* E: identical output vs source -> near-duplicate detected via hash distance 0 */
test("E: an identical image compared to itself has Hamming distance 0 (duplicate detected)", () => {
  const img = checkerImage(64, 64);
  const d = hammingDistance(computePerceptualHash(img), computePerceptualHash(img));
  assert.equal(d, 0);
  assert.ok(d < NEAR_DUPLICATE_HAMMING_THRESHOLD);
});

/* F: perceptually near-identical edit (tiny color shift only) with a required delta -> fails delta QA */
test("F: a near-identical edit (only a slight uniform color shift) stays under the near-duplicate threshold", () => {
  const a = checkerImage(64, 64);
  const bData = new Uint8Array(a.data);
  for (let i = 0; i < bData.length; i += 4) { bData[i] = Math.min(255, bData[i] + 5); bData[i + 1] = Math.min(255, bData[i + 1] + 5); }
  const b = { width: 64, height: 64, data: bData };
  const d = hammingDistance(computePerceptualHash(a), computePerceptualHash(b));
  assert.ok(d < NEAR_DUPLICATE_HAMMING_THRESHOLD, `expected a near-duplicate hash distance, got ${d}`);
});

/* A genuinely different composition (inverted checker) is NOT flagged as a duplicate */
test("a materially different image is well above the near-duplicate threshold", () => {
  const a = checkerImage(64, 64);
  const b = solidImage(64, 64, [230, 230, 230]);
  const d = hammingDistance(computePerceptualHash(a), computePerceptualHash(b));
  assert.ok(d >= NEAR_DUPLICATE_HAMMING_THRESHOLD, `expected a real difference to clear the threshold, got ${d}`);
});

/* Blur: a visibly softened output relative to its own sharp source is MAJOR; the same output vs. an already-soft source is not */
test("blur severity is judged RELATIVE to the edit's own source, not an absolute threshold", () => {
  const sharpSource = checkerImage(64, 64);
  const blurredOutput = blur(sharpSource);
  const sharpness = { source: computeSharpness(sharpSource), output: computeSharpness(blurredOutput) };
  assert.equal(classifyBlurSeverity(sharpness.output, sharpness.source), "major");
  // The identical output compared against an equally-soft "source" (itself) is none.
  assert.equal(classifyBlurSeverity(sharpness.output, sharpness.output), "none");
});

test("a flat/minimal illustration style (naturally low local contrast) is never penalized as blur when its source is equally flat", () => {
  const flatSource = solidImage(64, 64, [245, 245, 245]);
  const flatOutput = solidImage(64, 64, [245, 245, 245]);
  assert.equal(classifyBlurSeverity(computeSharpness(flatOutput), computeSharpness(flatSource)), "none");
});

/* A: EDIT with only a lighting delta and narration unrelated to lighting -> insufficient/no material delta */
test("A: narration describing only lighting (no time-of-day) does not count as a material visual delta", () => {
  const categories = classifyVisualDelta("The lighting in the cabin grows warmer.");
  assert.equal(categories.lightingDelta, true);
  assert.equal(categories.timeOfDayNarration, false);
  assert.equal(hasMaterialVisualDelta(categories), false);
});

/* B: EDIT with changed head pose + hand action -> valid material delta */
test("B: narration with a hand action and a head/gaze change is a valid material delta", () => {
  const categories = classifyVisualDelta("He turns his head toward the porthole and reaches for the valve.");
  assert.equal(categories.handActionDelta, true);
  assert.equal(categories.headDirectionDelta, true);
  assert.equal(hasMaterialVisualDelta(categories), true);
});

test("lighting described as a sunrise/time-of-day change DOES count (Part 9's explicit exception)", () => {
  const categories = classifyVisualDelta("The lighting shifts as sunrise breaks over the ridge.");
  assert.equal(hasMaterialVisualDelta(categories), true);
});

test("a screen/status readout changing state is a valid material delta", () => {
  const categories = classifyVisualDelta("The checklist screen changes to a warning state as he leans in.");
  assert.equal(categories.screenStateDelta, true);
  assert.equal(hasMaterialVisualDelta(categories), true);
});

/* Part 14 QA calibration: hard vs soft gates */
function baseQa(overrides = {}) {
  return {
    requiredCharactersPresent: true, characterIdentityConsistent: true, locationIdentityConsistent: true,
    actionMatchesDescription: true, framingMatchesShotSize: true, isCharacterSheetLayout: false,
    textArtifactSeverity: "none", styleMismatchSeverity: "none", corruptionArtifacts: false,
    environmentIrrelevant: false, reasons: [], ...overrides,
  };
}

/* I: minor decorative gibberish -> soft warning only (already-existing behavior, still covered) */
test("I: minor illegible text squiggles never block approval", () => {
  assert.equal(recomputeSceneApproval(baseQa({ textArtifactSeverity: "minor" })), true);
});

/* J: major required text corruption on a beat that actually needs that exact fact, with no overlay covering it -> blocks */
test("J: major legible text on a beat with a critical-text requirement, with no overlay replacement, still hard-blocks", () => {
  assert.equal(recomputeSceneApproval(baseQa({ textArtifactSeverity: "major" }), { criticalTextRequired: true }), false);
});
// 2026-09-17 "long-form quality pass" (Part 4/5): the DEFAULT changed — a
// beat with NO asserted critical-text requirement is real incidental AI
// text (never needed a fact from that text in the first place), so major
// legible text there is a SOFT_WARNING, not a block. This is the direct
// fix for "too many genuinely usable scenes become Needs Review."
test("major legible text on a beat with NO critical-text requirement does not block (real incidental AI text, Part 4)", () => {
  assert.equal(recomputeSceneApproval(baseQa({ textArtifactSeverity: "major" })), true);
});

/* The Part 14 (now Part 6) fix: the SAME major text becomes a soft warning once this exact scene has a VERIFIED programmatic overlay covering it */
test("major legible text on a critical-text beat is a SOFT warning (does not block) once a verified overlay covers it", () => {
  const r = baseQa({ textArtifactSeverity: "major" });
  assert.equal(recomputeSceneApproval(r, { criticalTextRequired: true, hasVerifiedOverlay: true }), true);
});

test("every other hard gate still blocks even with a verified overlay (the carve-out is text-specific only)", () => {
  assert.equal(recomputeSceneApproval(baseQa({ textArtifactSeverity: "major", corruptionArtifacts: true }), { criticalTextRequired: true, hasVerifiedOverlay: true }), false);
  assert.equal(recomputeSceneApproval(baseQa({ textArtifactSeverity: "major", characterIdentityConsistent: false }), { criticalTextRequired: true, hasVerifiedOverlay: true }), false);
});

test("major blur hard-blocks; minor blur does not", () => {
  assert.equal(recomputeSceneApproval(baseQa({ blurSeverity: "major" })), false);
  assert.equal(recomputeSceneApproval(baseQa({ blurSeverity: "minor" })), true);
});

test("an EDIT that failed to produce its required visual delta (visualDeltaSatisfied: false) blocks approval", () => {
  assert.equal(recomputeSceneApproval(baseQa({ visualDeltaSatisfied: false })), false);
});

/* G: intentional REUSE exact same image is allowed (no visualDeltaSatisfied field is ever set for REUSE — null/undefined never blocks) */
test("G: a REUSE scene (no visualDeltaSatisfied field at all, i.e. not an EDIT) is never blocked by the delta gate", () => {
  assert.equal(recomputeSceneApproval(baseQa({ visualDeltaSatisfied: undefined })), true);
  assert.equal(recomputeSceneApproval(baseQa({ visualDeltaSatisfied: null })), true);
});
