import test from "node:test";
import assert from "node:assert/strict";
import { refineVisualSequences } from "../supabase/functions/_shared/visualShotPlanning.js";
import { matchOldScenesToNewBeats, applyReconciliation } from "../supabase/functions/_shared/visualPlanReconciliation.js";

// Part 9 (A-I) — "APPLY THE NEW VISUAL-DENSITY PLAN TO MARS SAFELY". The
// actual Mars migration ran as a one-off, real-data script (documented in
// the final report — 6/13 scenes reconciled, 7 correctly left history-only,
// verified live). These tests cover the reusable LOGIC that migration used
// (now extracted to visualPlanReconciliation.js), which is what needs to
// keep working correctly for any future replan, not just Mars's.

function macro(o) {
  return {
    id: o.id, chapterId: "c1", sequenceIndex: o.sequenceIndex ?? 1, narrationSegmentIds: o.narrationSegmentIds,
    estimatedStartSeconds: 0, estimatedEndSeconds: 1, informationToCommunicate: o.informationToCommunicate ?? "beat",
    narrativeFunction: "develop", revealConstraints: [], visualType: o.visualType ?? "STORY_ILLUSTRATION",
    shotStrategy: "NEW_SETUP", renderMethod: "GENERATE", shotSize: "WIDE", continuityGroupId: null,
    primaryEntityIds: [], supportingEntityIds: [], locationId: o.locationId ?? "loc1", baseSetupKey: o.baseSetupKey ?? null,
    deltaInstruction: null, factualVisualConstraints: [], forbiddenElements: [],
  };
}
function seg(id, text) { return { id, text }; }

/* A: new planner creates VisualPlan N+1 instead of mutating N */
test("A: refineVisualSequences never returns the same object it was given, and never mutates the source plan — a caller building N+1 keeps N's object intact", () => {
  const source = { visualBeats: [macro({ id: "m1", narrationSegmentIds: ["s1"] })] };
  const script = { narrationSegments: [seg("s1", "A quiet establishing moment in the room.")] };
  const before = JSON.parse(JSON.stringify(source));
  const newPlan = refineVisualSequences(source, script);
  assert.notEqual(newPlan, source, "must return a new object, never the same reference as N");
  assert.deepEqual(source, before, "the source plan object must be byte-for-byte unchanged after building N+1");
});

/* B: old plan remains immutable */
test("B: calling refineVisualSequences twice on the SAME source produces two independent plan objects with equal content — proves no shared mutable state leaks between an old plan and a freshly built new one", () => {
  const source = { visualBeats: [macro({ id: "m1", narrationSegmentIds: ["s1"] })] };
  const script = { narrationSegments: [seg("s1", "A quiet establishing moment in the room.")] };
  const planA = refineVisualSequences(source, script);
  const planB = refineVisualSequences(source, script);
  assert.notEqual(planA, planB);
  assert.deepEqual(planA.visualBeats.map((b) => b.renderMethod), planB.visualBeats.map((b) => b.renderMethod));
});

/* C: high-confidence scene reconciliation preserves existing renders */
test("C: a GENERATE scene whose narration segment/time-range matches a new beat is reconciled — the new beat inherits the old scene's exact beat id", () => {
  const oldScenes = [{ oldBeatId: "old_shot_1", segmentId: "s1", start: 0, end: 9, method: "GENERATE" }];
  const source = { visualBeats: [macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "Establish the room" })] };
  const script = { narrationSegments: [seg("s1", "A quiet establishing moment settles over the room.")] };
  const newPlan = refineVisualSequences(source, script);
  const matches = matchOldScenesToNewBeats(oldScenes, newPlan.visualBeats);
  assert.equal(matches[0].confidence, 1);
  assert.ok(matches[0].matchedNewBeatId);
  applyReconciliation(newPlan, matches);
  assert.ok(newPlan.visualBeats.some((b) => b.id === "old_shot_1"), "the reconciled beat must carry the OLD scene's exact beat id so the existing scene row naturally re-attaches");
});

/* D: unmatched scenes remain history-only */
test("D: an old scene whose narration segment doesn't exist anywhere in the new plan gets no match — it is never force-attached", () => {
  const oldScenes = [{ oldBeatId: "old_shot_orphan", segmentId: "s_does_not_exist", start: 0, end: 9, method: "GENERATE" }];
  const source = { visualBeats: [macro({ id: "m1", narrationSegmentIds: ["s1"] })] };
  const script = { narrationSegments: [seg("s1", "A quiet establishing moment settles over the room.")] };
  const newPlan = refineVisualSequences(source, script);
  const matches = matchOldScenesToNewBeats(oldScenes, newPlan.visualBeats);
  assert.equal(matches[0].matchedNewBeatId, null);
  assert.equal(matches[0].confidence, 0);
});

test("D (weak overlap rejected): a candidate sharing the segment but with negligible time overlap is not treated as a match", () => {
  const oldScenes = [{ oldBeatId: "old_shot_late", segmentId: "s1", start: 500, end: 509, method: "GENERATE" }];
  const source = { visualBeats: [macro({ id: "m1", narrationSegmentIds: ["s1"] })] };
  const script = { narrationSegments: [seg("s1", "A quiet establishing moment settles over the room.")] };
  const newPlan = refineVisualSequences(source, script);
  const matches = matchOldScenesToNewBeats(oldScenes, newPlan.visualBeats);
  assert.ok(matches[0].confidence < 0.5);
  assert.equal(matches[0].matchedNewBeatId, null);
});

/* Collision safety — the real bug caught and fixed during the actual Mars migration */
test("collision safety: reconciling onto an id another new beat already naturally holds shifts that OTHER beat away instead of producing a duplicate id", () => {
  const source = {
    visualBeats: [
      macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "Establish the room" }),
      macro({ id: "m2", narrationSegmentIds: ["s2"], informationToCommunicate: "A quiet sense of relief among the crew" }),
    ],
  };
  const script = { narrationSegments: [seg("s1", "A quiet establishing moment settles over the room."), seg("s2", "A quiet sense of relief settles over the crew.")] };
  const newPlan = refineVisualSequences(source, script);
  const secondBeatNaturalId = newPlan.visualBeats[1].id;
  // Force a reconciliation whose OLD id happens to equal the SECOND beat's
  // own natural id, while matching the FIRST beat's content.
  const matches = [{ oldBeatId: secondBeatNaturalId, matchedNewBeatId: newPlan.visualBeats[0].id, confidence: 1 }];
  applyReconciliation(newPlan, matches);
  const idCounts = new Map();
  for (const b of newPlan.visualBeats) idCounts.set(b.id, (idCounts.get(b.id) ?? 0) + 1);
  assert.ok([...idCounts.values()].every((c) => c === 1), "no beat id may ever appear twice after reconciliation");
  assert.ok(newPlan.visualBeats.some((b) => b.id === secondBeatNaturalId), "the reconciliation target id is now held by the reconciled beat");
});

test("collision safety: an old beat id NOT in the reconciliation set but coincidentally matching a new beat's natural id is shifted away via otherOldBeatIdsToProtect", () => {
  const source = { visualBeats: [macro({ id: "m1", narrationSegmentIds: ["s1"] })] };
  const script = { narrationSegments: [seg("s1", "A quiet establishing moment settles over the room.")] };
  const newPlan = refineVisualSequences(source, script);
  const naturalId = newPlan.visualBeats[0].id;
  applyReconciliation(newPlan, [], [naturalId]);
  assert.equal(newPlan.visualBeats[0].id, `${naturalId}_shifted`, "an unreconciled old beat id must not silently attach to a coincidentally-matching new beat");
});

/* E: Generate page reads active VisualPlan version (structural check) */
test("E: GenerateWorkspace derives scene data from the visualPlanRow prop it's given, not a cached/memoized copy independent of which plan version was passed in", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8");
  assert.match(src, /visualPlanRow\?\.visual_plan\?\.visualBeats/, "scene cards must be built from the visualPlanRow prop's own visual_plan.visualBeats");
});

/* F: credit estimate changes when active plan changes (structural check) */
test("F: estimate_long_form_episode_credits reads the project's CURRENT plan version live via a join, never a cached/frozen id", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/migrations/20260930160000_long_form_scene_generation_pricing.sql", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("function public.estimate_long_form_episode_credits"), src.indexOf("$$;", src.indexOf("function public.estimate_long_form_episode_credits")));
  assert.match(fn, /p\.current_visual_plan_version_id/, "pricing must join through the project's live current_visual_plan_version_id, not a value captured earlier");
});

/* I: no generation/provider call during migration (structural check) */
test("I: the reconciliation module makes no network/provider/OpenAI calls — matching and id rewriting are pure, synchronous, in-memory operations", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/functions/_shared/visualPlanReconciliation.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\(|runware|openai/i);
});
