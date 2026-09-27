import test from "node:test";
import assert from "node:assert/strict";
import { matchClaimToRange } from "../supabase/functions/_shared/narrationVisualContract.ts";

// 2026-09-20 "fix claim coverage" pass — real Mars finding: strict
// substring containment silently dropped a match whenever the shot
// planner's semanticRanges() slice didn't align character-for-character
// with the contract's own quoted narrationText, producing most of the real
// "33 uncovered narration beats" incident. matchClaimToRange now scores by
// word overlap and accepts a real (>=40%) match, never an invented one.

function claim(overrides) {
  return { claimId: "c1", narrationSegmentIds: ["s1"], narrationText: "The agricultural specialist checks the greenhouse soil moisture levels every morning.", ...overrides };
}

test("exact substring containment still matches instantly (unchanged fast path)", () => {
  const m = matchClaimToRange([claim({})], "s1", "checks the greenhouse soil moisture levels");
  assert.equal(m.claimId, "c1");
});

test("a range with slightly different punctuation/whitespace than the claim's quoted text now matches via word overlap (the real bug)", () => {
  const m = matchClaimToRange([claim({})], "s1", "Checks the greenhouse soil moisture levels every morning");
  assert.equal(m.claimId, "c1");
});

test("a range that only partially overlaps a claim's text (a shot-planner sub-slice) still matches when overlap is real and substantial", () => {
  const m = matchClaimToRange([claim({})], "s1", "the greenhouse soil moisture levels");
  assert.equal(m.claimId, "c1");
});

test("a range with essentially no shared vocabulary never matches — no invented claim", () => {
  const m = matchClaimToRange([claim({})], "s1", "the power officer inspects the solar array wiring");
  assert.equal(m, null);
});

test("among multiple candidate claims for the same segment, the best-overlap one wins", () => {
  const claims = [
    claim({ claimId: "c1", narrationText: "The agricultural specialist checks the greenhouse soil moisture levels." }),
    claim({ claimId: "c2", narrationText: "The power officer inspects the solar array and battery reserves." }),
  ];
  const m = matchClaimToRange(claims, "s1", "the power officer inspects the solar array");
  assert.equal(m.claimId, "c2");
});

test("multiple different ranges are allowed to resolve to the SAME claim — this is intended, not a uniqueness bug", () => {
  const claims = [claim({})];
  const m1 = matchClaimToRange(claims, "s1", "The agricultural specialist checks the greenhouse");
  const m2 = matchClaimToRange(claims, "s1", "soil moisture levels every morning");
  assert.equal(m1.claimId, "c1");
  assert.equal(m2.claimId, "c1");
});

test("a claim for a different segmentId is never considered, regardless of text similarity", () => {
  const m = matchClaimToRange([claim({ narrationSegmentIds: ["other-segment"] })], "s1", "checks the greenhouse soil moisture levels");
  assert.equal(m, null);
});
