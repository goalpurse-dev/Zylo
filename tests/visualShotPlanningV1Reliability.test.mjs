import test from "node:test";
import assert from "node:assert/strict";
import { assignRenderStrategies, buildCompositionFingerprint, fingerprintsNearIdentical, enforceSequenceDiversity, checkRollingWindowVariety, visualDensity } from "../supabase/functions/_shared/visualShotPlanning.js";

// 2026-09-19 "V1 reliability patch" (narration contract mandatory / cast
// director / global sequencer / fix EDIT abuse / fix graphic rhythm). Real
// Mars v5 findings this closes: a 3+ consecutive EDIT chain (119-121), 4+
// same-base-setup windows (5-8, 26-29, 88-91, 114-117, 118-121), and
// standalone GRAPHIC clusters (53-61, 96-98, 123-127).

function beat(overrides) {
  return {
    id: "b1", candidateBaseKey: "setup1", visualType: "STORY_ILLUSTRATION", shotSize: "MEDIUM",
    estimatedStartSeconds: 0, estimatedEndSeconds: 8, informationToCommunicate: "x: something happens",
    narrativeFunction: "", primaryEntityIds: [], locationId: "loc1",
    ...overrides,
  };
}

/* ---- Task 4: fix EDIT abuse ---- */
test("a second consecutive EDIT on the same setup is capped to a fresh GENERATE (V1 rule: base frame -> one EDIT, then a new composition)", () => {
  const beats = [
    beat({ id: "b1", estimatedStartSeconds: 0, estimatedEndSeconds: 8 }), // GENERATE (first occurrence)
    beat({ id: "b2", estimatedStartSeconds: 8, estimatedEndSeconds: 16, informationToCommunicate: "x: she stands up" }), // real state-change verb -> EDIT
    beat({ id: "b3", estimatedStartSeconds: 16, estimatedEndSeconds: 24, informationToCommunicate: "x: she turns around" }), // another state-change verb on the SAME setup -> must be capped
  ];
  assignRenderStrategies(beats);
  assert.equal(beats[0].renderMethod, "GENERATE");
  assert.equal(beats[1].renderMethod, "EDIT");
  assert.equal(beats[2].renderMethod, "GENERATE", "a second consecutive EDIT must be blocked");
  assert.equal(beats[2].freshnessDecision, "edit_chain_capped");
});

test("an explicit before/during/after progression (contract temporalClaims) is allowed a real third EDIT-eligible beat without being capped", () => {
  const beats = [
    beat({ id: "b1", estimatedStartSeconds: 0, estimatedEndSeconds: 8 }),
    beat({ id: "b2", estimatedStartSeconds: 8, estimatedEndSeconds: 16, informationToCommunicate: "x: the machine starts to warm" }),
    beat({ id: "b3", estimatedStartSeconds: 16, estimatedEndSeconds: 24, informationToCommunicate: "x: the machine ignites fully", hasTemporalProgression: true }),
  ];
  assignRenderStrategies(beats);
  assert.equal(beats[1].renderMethod, "EDIT");
  assert.equal(beats[2].renderMethod, "EDIT", "an explicit temporal progression is the one allowed exception to the chain cap");
});

test("a contract claim reporting no real stateBefore/stateAfter distinction denies EDIT even when the verb regex matches (trivial delta)", () => {
  const beats = [
    beat({ id: "b1", estimatedStartSeconds: 0, estimatedEndSeconds: 8 }),
    beat({ id: "b2", estimatedStartSeconds: 8, estimatedEndSeconds: 16, informationToCommunicate: "x: she turns slightly", hasContractStateChange: false }),
  ];
  assignRenderStrategies(beats);
  assert.notEqual(beats[1].renderMethod, "EDIT", "a claim explicitly reporting a trivial (non-)change must never become an EDIT");
});

test("a claim WITH a real stateBefore/stateAfter distinction behaves exactly like the pre-existing verb-only EDIT path (no regression)", () => {
  const beats = [
    beat({ id: "b1", estimatedStartSeconds: 0, estimatedEndSeconds: 8 }),
    beat({ id: "b2", estimatedStartSeconds: 8, estimatedEndSeconds: 16, informationToCommunicate: "x: she stands up", hasContractStateChange: true }),
  ];
  assignRenderStrategies(beats);
  assert.equal(beats[1].renderMethod, "EDIT");
});

test("a beat with no contract claim at all (hasContractStateChange/hasTemporalProgression both undefined) is completely unaffected — backward compatible", () => {
  const beats = [
    beat({ id: "b1", estimatedStartSeconds: 0, estimatedEndSeconds: 8 }),
    beat({ id: "b2", estimatedStartSeconds: 8, estimatedEndSeconds: 16, informationToCommunicate: "x: she stands up" }),
  ];
  assignRenderStrategies(beats);
  assert.equal(beats[1].renderMethod, "EDIT", "no claim -> exact pre-existing verb-only behavior");
});

/* ---- Task 5: fix graphic rhythm ---- */
test("a 3rd consecutive standalone GRAPHIC beat is downgraded to a fresh photographic composition (max 2 consecutive graphics)", () => {
  const beats = [
    beat({ id: "g1", visualType: "DIAGRAM", candidateBaseKey: "g_setup" }),
    beat({ id: "g2", visualType: "DIAGRAM", candidateBaseKey: "g_setup", estimatedStartSeconds: 8, estimatedEndSeconds: 16 }),
    beat({ id: "g3", visualType: "DIAGRAM", candidateBaseKey: "g_setup", estimatedStartSeconds: 16, estimatedEndSeconds: 24 }),
  ];
  assignRenderStrategies(beats);
  assert.equal(beats[0].renderMethod, "PROGRAMMATIC_GRAPHIC");
  assert.equal(beats[1].renderMethod, "PROGRAMMATIC_GRAPHIC");
  assert.notEqual(beats[2].renderMethod, "PROGRAMMATIC_GRAPHIC", "a 3rd consecutive graphic must be capped");
  assert.equal(beats[2].graphicClusterCapped, true);
});

test("an intentionalVisualComparison beat is exempt from the graphic-cluster cap (the brief's own 'deliberately defined comparison/build sequence' exception)", () => {
  const beats = [
    beat({ id: "g1", visualType: "DIAGRAM", candidateBaseKey: "g_setup" }),
    beat({ id: "g2", visualType: "DIAGRAM", candidateBaseKey: "g_setup", estimatedStartSeconds: 8, estimatedEndSeconds: 16 }),
    beat({ id: "g3", visualType: "DIAGRAM", candidateBaseKey: "g_setup", estimatedStartSeconds: 16, estimatedEndSeconds: 24, intentionalVisualComparison: true }),
  ];
  assignRenderStrategies(beats);
  assert.equal(beats[2].renderMethod, "PROGRAMMATIC_GRAPHIC");
});

test("the cluster count resets after a non-graphic beat interrupts it — a later pair of graphics is not blocked by an earlier, already-broken cluster", () => {
  const beats = [
    beat({ id: "g1", visualType: "DIAGRAM", candidateBaseKey: "g_setup" }),
    beat({ id: "g2", visualType: "DIAGRAM", candidateBaseKey: "g_setup", estimatedStartSeconds: 8, estimatedEndSeconds: 16 }),
    beat({ id: "s1", visualType: "STORY_ILLUSTRATION", candidateBaseKey: "story_setup", estimatedStartSeconds: 16, estimatedEndSeconds: 24 }),
    beat({ id: "g3", visualType: "DIAGRAM", candidateBaseKey: "g_setup2", estimatedStartSeconds: 24, estimatedEndSeconds: 32 }),
  ];
  assignRenderStrategies(beats);
  assert.equal(beats[3].renderMethod, "PROGRAMMATIC_GRAPHIC", "a fresh cluster after an interruption is allowed");
});

/* ---- Task 3: global sequencer ---- */
test("window size 4 is now checked — a real 4-beat same-baseSetupKey run gets broken at its midpoint (the exact reported Mars bug)", () => {
  const beats = [
    beat({ id: "b1", candidateBaseKey: "s", baseSetupKey: "s", estimatedStartSeconds: 0, estimatedEndSeconds: 4 }),
    beat({ id: "b2", candidateBaseKey: "s", baseSetupKey: "s", estimatedStartSeconds: 4, estimatedEndSeconds: 8 }),
    beat({ id: "b3", candidateBaseKey: "s", baseSetupKey: "s", estimatedStartSeconds: 8, estimatedEndSeconds: 12 }),
    beat({ id: "b4", candidateBaseKey: "s", baseSetupKey: "s", estimatedStartSeconds: 12, estimatedEndSeconds: 16 }),
  ];
  enforceSequenceDiversity(beats);
  const broken = beats.filter((b) => b.diversityForced);
  assert.equal(broken.length, 1, "exactly one beat in the 4-run must be forced fresh");
  assert.equal(broken[0].renderMethod, "GENERATE");
});

test("buildCompositionFingerprint now includes character binding (sorted) and locationId, per the brief's 'meaningful planning features' list", () => {
  const fp1 = buildCompositionFingerprint(beat({ primaryEntityIds: ["b", "a"], locationId: "greenhouse" }));
  const fp2 = buildCompositionFingerprint(beat({ primaryEntityIds: ["a", "b"], locationId: "greenhouse" }));
  assert.equal(fp1.characterIds, fp2.characterIds, "order-independent");
  assert.equal(fp1.locationId, "greenhouse");
  const fp3 = buildCompositionFingerprint(beat({ primaryEntityIds: ["c"], locationId: "greenhouse" }));
  assert.equal(fingerprintsNearIdentical(fp1, fp3), false, "a different cast must not count as the same composition");
});

test("checkRollingWindowVariety is diagnostic-only — never appears in visualDensity's own errors/passed, only in varietyWarnings", () => {
  const plan = { visualBeats: Array.from({ length: 6 }, (_, i) => beat({ id: `b${i}`, baseSetupKey: "same", shotSize: "MEDIUM", narrationSegmentIds: ["s1"], estimatedStartSeconds: i * 4, estimatedEndSeconds: i * 4 + 4 })) };
  const density = visualDensity(plan);
  assert.ok(density.varietyWarnings.some((w) => w.code === "low_composition_variety_5window"));
  assert.ok(density.varietyWarnings.some((w) => w.code === "low_shot_size_variety_5window"));
  assert.equal(density.passed, true, "variety warnings must never fail visualDensity.passed — that would turn a soft target into a hard planning-failure gate");
});
