import test from "node:test";
import assert from "node:assert/strict";
import { assignRenderStrategies } from "../supabase/functions/_shared/visualShotPlanning.js";

// "Rebuild the Visual Director around narration meaning" (2026-09-15) —
// Sections 2/6/7/9/10/26's render-method policy, tested directly against
// assignRenderStrategies with synthetic beat fixtures. Every case here
// ALSO passes with no primarySubject/continuityRequirement/contractVisualForm
// set at all (the pre-existing visualShotPlanning.test.mjs fixture still
// passes unchanged after this rewrite — see that file) — these tests only
// cover the NEW semantic layer's own behavior.

function beat(overrides = {}) {
  return {
    id: "b", candidateBaseKey: "setup_1", visualType: "STORY_ILLUSTRATION", shotSize: "MEDIUM",
    estimatedStartSeconds: 100, estimatedEndSeconds: 105, narrativeFunction: "",
    informationToCommunicate: "Follow the narrated action: nothing special happens.",
    ...overrides,
  };
}
function sequential(beats) {
  let t = 100;
  return beats.map((b) => { const dur = b.estimatedEndSeconds != null ? b.estimatedEndSeconds - b.estimatedStartSeconds : 5; const out = { ...b, estimatedStartSeconds: t, estimatedEndSeconds: t + dur }; t += dur; return out; });
}

/* F: same character composition repeated -> repetition debt forces a different visual solution once accumulated similarity crosses the threshold */
test("F: repetition debt accumulates across weakly-differentiated derived shots (REUSE and non-HIGH-justified EDIT alike) and forces a fresh GENERATE once it crosses the limit", () => {
  const beats = sequential([
    beat({ contractVisualForm: "CHARACTER_ACTION", continuityRequirement: "MEDIUM" }), // GENERATE (first), debt=0
    beat({ contractVisualForm: "CHARACTER_ACTION", continuityRequirement: "MEDIUM" }), // no signal -> REUSE, debt=1
    beat({ contractVisualForm: "CHARACTER_ACTION", continuityRequirement: "MEDIUM" }), // consecutive-chain limit hit -> EDIT (not HIGH-justified) -> debt=2
    beat({ contractVisualForm: "CHARACTER_ACTION", continuityRequirement: "MEDIUM" }), // no signal -> REUSE, debt=3 (limit reached)
    beat({ contractVisualForm: "CHARACTER_ACTION", continuityRequirement: "MEDIUM" }), // debt exceeded -> GENERATE
  ]);
  assignRenderStrategies(beats);
  assert.equal(beats[0].renderMethod, "GENERATE");
  assert.equal(beats[1].renderMethod, "REUSE");
  assert.equal(beats[2].renderMethod, "REUSE", "repetition alone must never invent a state-changing EDIT");
  assert.equal(beats[2].freshnessDecision, "default_reuse_no_signal");
  assert.equal(beats[4].renderMethod, "GENERATE");
  assert.equal(beats[4].freshnessDecision, "diversity_break_repetition_debt");
});

test("a HIGH-continuity EDIT chain-break does NOT itself accrue repetition debt, so it never trips the debt-based GENERATE break on its own", () => {
  const beats = sequential([
    beat({ contractVisualForm: "OBJECT_DETAIL", continuityRequirement: "HIGH" }), // GENERATE (first)
    beat({ contractVisualForm: "OBJECT_DETAIL", continuityRequirement: "HIGH" }), // REUSE, debt=1 (no state-change verb here, so still default reuse)
    beat({ informationToCommunicate: "State change: the tray closes over the sample.", contractVisualForm: "OBJECT_DETAIL", continuityRequirement: "HIGH" }), // EDIT via chain-break, HIGH-justified -> debt stays 1
    beat({ contractVisualForm: "OBJECT_DETAIL", continuityRequirement: "HIGH" }),
  ]);
  assignRenderStrategies(beats);
  assert.equal(beats[2].renderMethod, "EDIT");
  assert.notEqual(beats[3].freshnessDecision, "diversity_break_repetition_debt");
});

/* G: edit -> edit re-anchors/escalates — continuityRequirement HIGH edits do not themselves accrue debt (the legitimate power-on/off exception) */
// 2026-09-19 "fix EDIT abuse" V1 fix updated this fixture: THREE raw
// consecutive EDITs justified only by continuityRequirement:"HIGH" (with no
// explicit temporal-progression signal) is now exactly the "GENERATE ->
// EDIT -> EDIT" abuse pattern the real Mars incident flagged (5-7, 10-12,
// 68-70, 88-90, 109-111, 118-121) — continuityRequirement HIGH alone is no
// longer sufficient to chain unlimited EDITs, only an explicit before/
// during/after progression is (see hasTemporalProgression, set from the
// contract's own temporalClaims). This fixture genuinely IS such a
// progression (a machine's power state degrading in three real stages), so
// it now marks that explicitly — the debt-exemption behavior this test
// actually verifies is otherwise unchanged.
test("a legitimate HIGH-continuity state-change EDIT progression (e.g. machine ON -> dimming -> OFF) does not accrue repetition debt", () => {
  const beats = sequential([
    beat({ continuityRequirement: "LOW" }), // GENERATE
    beat({ informationToCommunicate: "State change: the indicator light turns from green to red.", continuityRequirement: "HIGH", hasTemporalProgression: true }), // EDIT, no debt
    beat({ informationToCommunicate: "State change: the panel dims as the power drains away.", continuityRequirement: "HIGH", hasTemporalProgression: true }), // EDIT (explicit progression), no debt
    beat({ informationToCommunicate: "State change: a warning light flares on the panel.", continuityRequirement: "HIGH", hasTemporalProgression: true }), // EDIT (explicit progression), no debt
    beat({ continuityRequirement: "LOW" }), // still should NOT be forced GENERATE by debt (debt stayed 0) — some other signal may still apply, but not diversity_break
  ]);
  assignRenderStrategies(beats);
  assert.equal(beats[1].renderMethod, "EDIT");
  assert.equal(beats[2].renderMethod, "EDIT");
  assert.equal(beats[3].renderMethod, "EDIT");
  assert.notEqual(beats[4].freshnessDecision, "diversity_break_repetition_debt");
});

test("the SAME three-EDIT sequence WITHOUT an explicit temporal progression is now capped after the first EDIT (V1 fix EDIT abuse rule)", () => {
  const beats = sequential([
    beat({ continuityRequirement: "LOW" }),
    beat({ informationToCommunicate: "State change: the indicator light turns from green to red.", continuityRequirement: "HIGH" }),
    beat({ informationToCommunicate: "State change: the panel dims as the power drains away.", continuityRequirement: "HIGH" }),
  ]);
  assignRenderStrategies(beats);
  assert.equal(beats[1].renderMethod, "EDIT");
  assert.equal(beats[2].renderMethod, "GENERATE", "continuityRequirement HIGH alone no longer justifies a second consecutive EDIT");
  assert.equal(beats[2].freshnessDecision, "edit_chain_capped");
});

/* D: same room normal power -> power failure -> legitimate EDIT/before-after continuity */
test("D: a HIGH continuityRequirement with a state-change verb produces EDIT, not a forced fresh composition", () => {
  const beats = sequential([
    beat({}),
    beat({ informationToCommunicate: "State change: the lights cut out and the room goes dark.", continuityRequirement: "HIGH" }),
  ]);
  assignRenderStrategies(beats);
  assert.equal(beats[1].renderMethod, "EDIT");
});

/* Contract explicitly says NONE/LOW continuity -> EDIT is refused even with a state-change verb; GENERATE instead */
test("continuityRequirement NONE overrides a matching state-change verb — GENERATE, never EDIT, because cost/cheapness is never the deciding factor", () => {
  const beats = sequential([
    beat({}),
    beat({ informationToCommunicate: "State change: she stands and walks into a different room entirely.", continuityRequirement: "NONE" }),
  ]);
  assignRenderStrategies(beats);
  assert.notEqual(beats[1].renderMethod, "EDIT");
  assert.equal(beats[1].renderMethod, "GENERATE");
  assert.equal(beats[1].freshnessDecision, "contract_requires_fresh_composition");
});

/* E: character looking at tablet -> next narration explains Mars atmosphere -> fresh visual form, not another tablet EDIT */
test("E: a primarySubject change forces GENERATE even when the legacy visualType family and shotSize stayed identical", () => {
  const beats = sequential([
    beat({ primarySubject: "the tablet checklist", contractVisualForm: "OBJECT_DETAIL", continuityRequirement: "MEDIUM" }),
    beat({ informationToCommunicate: "State change: the checklist screen updates.", primarySubject: "the tablet checklist", contractVisualForm: "OBJECT_DETAIL", continuityRequirement: "HIGH" }), // still same subject -> EDIT allowed
    beat({ primarySubject: "Mars's thin atmosphere", contractVisualForm: "DIAGRAM", continuityRequirement: "NONE" }), // subject changes entirely
  ]);
  assignRenderStrategies(beats);
  assert.equal(beats[1].renderMethod, "EDIT");
  assert.equal(beats[2].renderMethod, "GENERATE");
  assert.equal(beats[2].freshnessDecision, "subject_change_new_setup");
});

/* A visual-form change (not HIGH continuity) forces GENERATE even without a primarySubject change */
test("a visual-form change with non-HIGH continuity forces GENERATE", () => {
  const beats = sequential([
    beat({ primarySubject: "the habitat", contractVisualForm: "ENVIRONMENT_ESTABLISHING", continuityRequirement: "LOW" }),
    beat({ primarySubject: "the habitat", contractVisualForm: "DIAGRAM", continuityRequirement: "LOW" }),
  ]);
  assignRenderStrategies(beats);
  assert.equal(beats[1].renderMethod, "GENERATE");
  assert.equal(beats[1].freshnessDecision, "visual_form_change_new_setup");
});

test("a visual-form change IS allowed to continue when continuityRequirement is explicitly HIGH (e.g. a diagram gaining an annotation)", () => {
  const beats = sequential([
    beat({ primarySubject: "the process", contractVisualForm: "DIAGRAM", continuityRequirement: "MEDIUM" }),
    beat({ informationToCommunicate: "State change: a label appears on the diagram.", primarySubject: "the process", contractVisualForm: "ANNOTATED_DIAGRAM", continuityRequirement: "HIGH" }),
  ]);
  assignRenderStrategies(beats);
  assert.notEqual(beats[1].freshnessDecision, "visual_form_change_new_setup");
});

/* Explainable metadata is actually persisted */
test("diversityReason/repetitionDebt/sameBaseRunLength/sameVisualFormRunLength are persisted on every beat", () => {
  const beats = sequential([beat({}), beat({})]);
  assignRenderStrategies(beats);
  for (const b of beats) {
    assert.equal(typeof b.diversityReason, "string");
    assert.equal(typeof b.repetitionDebt, "number");
    assert.equal(typeof b.sameBaseRunLength, "number");
    assert.equal(typeof b.sameVisualFormRunLength, "number");
  }
});

/* Backward compatibility: a beat with no contract fields at all behaves exactly like the pre-existing engine */
test("a beat with no primarySubject/continuityRequirement/contractVisualForm never triggers any of the new semantic branches", () => {
  const beats = sequential([
    beat({}),
    beat({ informationToCommunicate: "State change: he checks the valve." }),
  ]);
  assignRenderStrategies(beats);
  assert.notEqual(beats[1].freshnessDecision, "subject_change_new_setup");
  assert.notEqual(beats[1].freshnessDecision, "visual_form_change_new_setup");
  assert.notEqual(beats[1].freshnessDecision, "contract_requires_fresh_composition");
  assert.equal(beats[1].renderMethod, "EDIT"); // falls through to the original verb-based EDIT logic
});
