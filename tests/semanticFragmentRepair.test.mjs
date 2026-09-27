import test from "node:test";
import assert from "node:assert/strict";
import { refineVisualSequences } from "../supabase/functions/_shared/visualShotPlanning.js";
import { normalizeNarrationCoverage, narrationCoverageIssues } from "../supabase/functions/_shared/visualPlanDeterministic.js";

// 2026-09-22 "semantic fragment" fix — real Atlantis incident: a single
// coherent idea ("geologists evaluate whether deposits indicate rapid
// inundation or gradual deposition") got mechanically word-proportion-split
// into shots purely from its spoken DURATION, producing meaningless
// fragments ("geologists evaluate" | "whether deposits" | "indicate rapid" |
// "inundation or" | "gradual deposition"). These are GENERIC fixtures for
// refineVisualSequences itself — the same function every brand-new project's
// storyboard goes through — not an Atlantis-specific regression test.

function macro(overrides) {
  return {
    id: overrides.id, chapterId: "c1", sequenceIndex: overrides.sequenceIndex ?? 1,
    narrationSegmentIds: overrides.narrationSegmentIds, estimatedStartSeconds: 0, estimatedEndSeconds: 1,
    informationToCommunicate: overrides.informationToCommunicate ?? "beat", narrativeFunction: overrides.narrativeFunction ?? "develop",
    revealConstraints: [], visualType: overrides.visualType ?? "STORY_ILLUSTRATION", shotStrategy: "NEW_SETUP", renderMethod: "GENERATE",
    shotSize: "WIDE", continuityGroupId: null, primaryEntityIds: [], supportingEntityIds: [], locationId: overrides.locationId ?? "loc1",
    baseSetupKey: overrides.baseSetupKey ?? null, deltaInstruction: null, factualVisualConstraints: [], forbiddenElements: [],
  };
}
function seg(id, text) { return { id, text }; }
function planOf(macros, segments) { return refineVisualSequences({ visualBeats: macros }, { narrationSegments: segments }); }
function words(text) { return (text.match(/\S+/g) ?? []).length; }

test("A: a single long clause with no internal punctuation is not chopped into meaningless word-count fragments", () => {
  const text = "Geologists evaluate whether deposits indicate rapid inundation or gradual deposition over many centuries of accumulation.";
  const plan = planOf(
    [macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "x: " + text })],
    [seg("s1", text)],
  );
  const shots = plan.visualBeats.filter((b) => b.sourceMacroBeatId === "m1");
  assert.ok(shots.length >= 1);
  for (const shot of shots) {
    assert.ok(words(shot.shotNarrationText) >= 4, `shot "${shot.shotNarrationText}" has too few words to be a meaningful visual beat`);
  }
});

test("B: two genuinely distinct sentences remain distinct shots, never merged into one vague beat", () => {
  const text = "The geologists collect a long sediment core from the seabed near the strait. Later, a separate team analyzes the tephra layer in a shipboard laboratory.";
  const plan = planOf(
    [macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "x: " + text })],
    [seg("s1", text)],
  );
  const shots = plan.visualBeats.filter((b) => b.sourceMacroBeatId === "m1");
  assert.ok(shots.length >= 2, "two distinct ideas should not collapse into a single shot");
  assert.ok(shots.some((s) => s.shotNarrationText.includes("sediment core")));
  assert.ok(shots.some((s) => s.shotNarrationText.includes("tephra layer")));
});

test("C: a short, already-coherent sentence stays as one visual beat, never force-split", () => {
  const text = "The scientist examines the core sample closely.";
  const plan = planOf(
    [macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "x: " + text })],
    [seg("s1", text)],
  );
  const shots = plan.visualBeats.filter((b) => b.sourceMacroBeatId === "m1");
  assert.equal(shots.length, 1);
});

test("G: narration coverage remains exact (no gaps, no overlaps) after fragment-prevention merges shots", () => {
  const text = "Geologists evaluate whether deposits indicate rapid inundation or gradual deposition over many centuries, and the resulting chronology either supports or undermines the catastrophist reading of the myth.";
  const plan = planOf(
    [macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "x: " + text })],
    [seg("s1", text)],
  );
  const spans = plan.visualBeats.flatMap((b) => b.narrationRanges).filter((r) => r.segmentId === "s1").sort((a, b) => a.startChar - b.startChar);
  for (let i = 0; i < text.length; i += 1) {
    if (/\s/.test(text[i])) continue;
    assert.ok(spans.some((r) => r.startChar <= i && r.endChar > i), `character ${i} ("${text[i]}") not covered by any shot`);
  }
  // No overlaps either — every span's start is >= the previous span's end.
  for (let i = 1; i < spans.length; i += 1) assert.ok(spans[i].startChar >= spans[i - 1].endChar);
});

test("J: two sibling macros sharing one narration segment keep their OWN distinct subject/purpose instead of both inheriting the shared claim's generic one (real Atlantis Layer B fix)", () => {
  const text = "Reception history shaped the myth. Then media incentives amplified it further.";
  const macros = [
    macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "Show the ancient reception history and Proclus's role.", visualType: "STORY_ILLUSTRATION", primaryEntityIds: ["proclus"] }),
    macro({ id: "m2", narrationSegmentIds: ["s1"], informationToCommunicate: "Show the modern media incentives that amplify sensational claims.", visualType: "DIAGRAM", primaryEntityIds: ["media_icon"] }),
  ];
  const claim = {
    claimId: "c1", narrationSegmentIds: ["s1"], narrationText: text,
    primarySubject: "the shared generic subject", visualCommunicationGoal: "the shared generic claim goal",
    preferredVisualForms: [], requiredVisualFacts: [], forbiddenVisualFacts: [], forbiddenEntities: [], comparisonClaims: [], causeEffectClaims: [],
  };
  const plan = refineVisualSequences({ visualBeats: macros }, { narrationSegments: [seg("s1", text)] }, "balanced", [claim]);
  const m1Shots = plan.visualBeats.filter((b) => b.sourceMacroBeatId === "m1");
  const m2Shots = plan.visualBeats.filter((b) => b.sourceMacroBeatId === "m2");
  assert.ok(m1Shots.length > 0 && m2Shots.length > 0);
  assert.notEqual(m1Shots[0].shotPurpose, m2Shots[0].shotPurpose, "sibling macros must not collapse onto the claim's shared generic purpose");
  assert.ok(!m1Shots[0].shotPurpose.includes("the shared generic claim goal"));
  assert.ok(!m2Shots[0].shotPurpose.includes("the shared generic claim goal"));
});

test("K: the narration-coverage normalizer drops an exact-duplicate range and trims a partial overlap, never touching a clean segment", () => {
  function beat(id, segmentId, startChar, endChar, start, end) {
    return { id, sourceMacroBeatId: id, sequenceIndex: start, estimatedStartSeconds: start, estimatedEndSeconds: end, narrationRanges: [{ segmentId, startChar, endChar }] };
  }
  const plan = {
    visualBeats: [
      beat("a1", "sA", 0, 20, 0, 4), beat("a2", "sA", 20, 20, 4, 8), // exact duplicate range on segment sA (a1 vs a2 differ: fix targets literal dup only)
    ],
  };
  // Build the literal exact-duplicate case precisely: two beats, same range.
  plan.visualBeats = [
    beat("dupA", "sA", 0, 20, 0, 4),
    beat("dupB", "sA", 0, 20, 4, 8),
    beat("clean1", "sB", 0, 10, 0, 2),
    beat("clean2", "sB", 10, 30, 2, 5),
  ];
  const result = normalizeNarrationCoverage(plan);
  assert.deepEqual(result.removedBeatIds, ["dupB"]);
  assert.equal(result.plan.visualBeats.find((b) => b.id === "dupA") != null, true);
  assert.equal(result.plan.visualBeats.find((b) => b.id === "dupB"), undefined);
  // The clean segment (sB) must be completely untouched.
  assert.deepEqual(result.plan.visualBeats.find((b) => b.id === "clean1").narrationRanges, [{ segmentId: "sB", startChar: 0, endChar: 10 }]);
  assert.deepEqual(result.plan.visualBeats.find((b) => b.id === "clean2").narrationRanges, [{ segmentId: "sB", startChar: 10, endChar: 30 }]);

  const partialOverlapPlan = { visualBeats: [beat("p1", "sC", 0, 20, 0, 4), beat("p2", "sC", 15, 40, 4, 8)] };
  const trimmed = normalizeNarrationCoverage(partialOverlapPlan);
  assert.deepEqual(trimmed.trimmedBeatIds, ["p2"]);
  assert.equal(trimmed.plan.visualBeats.find((b) => b.id === "p2").narrationRanges[0].startChar, 20);
  const segments = [{ id: "sA", text: "x".repeat(20) }, { id: "sB", text: "x".repeat(30) }];
  assert.deepEqual(narrationCoverageIssues(result.plan.visualBeats, segments), []);
});

test("I: reprocessing from a plan's own already-persisted visualSequences (as a targeted repair does) must restore each entry's id from sourceMacroBeatId first, or shot ids come out double-prefixed", () => {
  const macros = [macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "x: A calm establishing moment." })];
  const segments = [seg("s1", "A calm establishing moment in the observatory.")];
  const firstPass = planOf(macros, segments);
  // Simulate what a repair does: feed the plan's OWN persisted
  // visualSequences back in as the macro source, restoring each entry's id
  // from sourceMacroBeatId (the fix) before forcing reprocessing.
  const restored = structuredClone(firstPass);
  restored.visualSequences = restored.visualSequences.map((s) => ({ ...s, id: s.sourceMacroBeatId }));
  restored.shotPlannerVersion = "stale-version-forces-reprocess";
  const secondPass = refineVisualSequences(restored, { narrationSegments: segments });
  for (const beat of secondPass.visualBeats) {
    assert.ok(!beat.id.startsWith("sequence_"), `beat id "${beat.id}" is double-prefixed — visualSequences id was not restored before reprocessing`);
    assert.equal(beat.sourceMacroBeatId, "m1");
  }
});

test("H: a chapter/macro with no fragmentation risk is completely unaffected by the fix (idempotent, byte-identical on reprocess)", () => {
  const macros = [macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "x: A calm establishing moment." })];
  const segments = [seg("s1", "A calm establishing moment in the observatory.")];
  const first = planOf(macros, segments);
  const second = refineVisualSequences(first, { narrationSegments: segments });
  assert.deepEqual(second, first);
});
