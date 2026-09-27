import test from "node:test";
import assert from "node:assert/strict";
import { recomputeCharacterSheetApproval } from "../supabase/functions/_shared/referenceQA.ts";

// Part 7 test matrix (F-J) for the 2026-09-14 "FINAL CHARACTER REFERENCE
// POLISH" fix. A clean baseline result — everything present, identity
// consistent, no artifacts — is the starting point for every case below, so
// each test only overrides the ONE field under examination.
const clean = (over = {}) => ({
  panelCountCorrect: true, sameIdentityAcrossPanels: true,
  frontPresent: true, sidePresent: true, backPresent: true, facePresent: true,
  outfitDetailPresent: true, actionPosePresent: true, outfitConsistent: true,
  fullBodyNotCropped: true, environmentContamination: false,
  textArtifactSeverity: "none", styleMismatchSeverity: "none", corruptionArtifacts: false,
  reasons: [],
  ...over,
});

test("baseline clean HERO sheet is approved", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean()), true);
});

test("F: minor text-artifact severity does NOT reject (real incident: tiny pseudo-text on a power officer's handheld equipment)", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ textArtifactSeverity: "minor" })), true);
});
test("F (contrast): MAJOR text-artifact severity DOES reject", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ textArtifactSeverity: "major" })), false);
});

test("G: missing action pose does NOT reject a HERO sheet — action pose is no longer a required view at all", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ actionPosePresent: false })), true);
});

test("H: an incorrect panel count (e.g. a duplicate optional face close-up) does NOT reject on its own — soft, informational only", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ panelCountCorrect: false })), true);
  assert.equal(recomputeCharacterSheetApproval("RECURRING", clean({ panelCountCorrect: false })), true);
});

test("I: materially inconsistent outfit (outfit-detail panel redesigns the costume) DOES produce Needs Review — new hard gate", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ outfitConsistent: false })), false);
  assert.equal(recomputeCharacterSheetApproval("RECURRING", clean({ outfitConsistent: false })), false);
});

test("J: missing side or back view DOES produce Needs Review", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ sidePresent: false })), false);
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ backPresent: false })), false);
});

test("missing outfit-detail view is acceptable when the sheet already establishes a consistent identity and outfit", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ outfitDetailPresent: false })), true);
  assert.equal(recomputeCharacterSheetApproval("RECURRING", clean({ outfitDetailPresent: false })), true);
});

test("hard gates unaffected by this rewrite still reject: different identity across panels, cropped body, environment contamination, corruption", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ sameIdentityAcrossPanels: false })), false);
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ fullBodyNotCropped: false })), false);
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ environmentContamination: true })), false);
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ corruptionArtifacts: true })), false);
});

// Part 8 of the 2026-09-14 fix: style-match evaluation.
test("style QA: minor style variance (small shading/detail differences) does NOT reject on its own", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ styleMismatchSeverity: "minor" })), true);
});
test("style QA: MAJOR style mismatch (photorealistic/3D/painterly/anime/semi-real instead of the selected flat 2D preset) DOES produce Needs Review", () => {
  assert.equal(recomputeCharacterSheetApproval("HERO", clean({ styleMismatchSeverity: "major" })), false);
  assert.equal(recomputeCharacterSheetApproval("RECURRING", clean({ styleMismatchSeverity: "major" })), false);
});
