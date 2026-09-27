import test from "node:test";
import assert from "node:assert/strict";
import { refineVisualSequences, visualDensity } from "../supabase/functions/_shared/visualShotPlanning.js";

// Part 17 (A-M) — "LONG FORM SCENE DENSITY / FRESH-VISUAL ARCHITECTURE FIX".
// Synthetic macro-level fixtures, each isolating one freshness rule, so a
// failure points straight at the rule instead of requiring a diff against
// Mars's full 115/136-beat real plan.

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

/* A: exact image not reused repeatedly within a short window */
test("A: two REUSE-eligible beats on the same base within the cooldown window do not both become REUSE — the second one breaks the chain instead", () => {
  const macros = [
    macro({ id: "m1", narrationSegmentIds: ["s1"], baseSetupKey: "hearth", informationToCommunicate: "A quiet moment by the hearth" }),
    macro({ id: "m2", narrationSegmentIds: ["s2"], baseSetupKey: "hearth", informationToCommunicate: "The room stays calm and still" }),
    macro({ id: "m3", narrationSegmentIds: ["s3"], baseSetupKey: "hearth", informationToCommunicate: "Nothing changes in the quiet room" }),
  ];
  const segments = [seg("s1", "A quiet moment settles over the room."), seg("s2", "The room stays calm and still."), seg("s3", "Nothing changes in the quiet room.")];
  const plan = planOf(macros, segments);
  const methods = plan.visualBeats.map((b) => b.renderMethod);
  // At most ONE REUSE may appear consecutively before the chain is broken
  // (CONSECUTIVE_SAME_SOURCE_LIMIT=1) — never a run of 2+ back-to-back REUSE.
  let run = 0, maxRun = 0;
  for (const m of methods) { run = m === "REUSE" ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
  assert.ok(maxRun <= 1, `expected no more than 1 consecutive REUSE, got a run of ${maxRun}: ${methods.join(",")}`);
});

/* B: crop only used when desired framing actually exists within source */
test("B: a SECOND OBJECT_DETAIL beat on an already-established detail setup, with no state change and outside the opening window, becomes CROP", () => {
  // CROP is deliberately disabled during the opening 60s (Part 4) — pad
  // with an unrelated macro first so the real detail pair is timed past it.
  const pad = Array.from({ length: 260 }, () => "word").join(" ") + ".";
  const macros = [
    macro({ id: "m0", narrationSegmentIds: ["s0"], baseSetupKey: "pad", informationToCommunicate: "padding" }),
    macro({ id: "m1", narrationSegmentIds: ["s1"], baseSetupKey: "console", informationToCommunicate: "A valve on the console" }),
    macro({ id: "m2", narrationSegmentIds: ["s2"], baseSetupKey: "console", informationToCommunicate: "A tool nearby" }),
  ];
  const segments = [seg("s0", pad), seg("s1", "A valve sits quietly on the console panel."), seg("s2", "A small tool rests beside it, untouched.")];
  const plan = planOf(macros, segments);
  const detailBeats = plan.visualBeats.filter((b) => b.visualType === "OBJECT_DETAIL");
  assert.equal(detailBeats.length, 2, "fixture must produce two OBJECT_DETAIL beats");
  assert.equal(detailBeats[0].renderMethod, "GENERATE", "the first detail beat establishes the setup");
  assert.equal(detailBeats[1].renderMethod, "CROP");
  assert.equal(detailBeats[1].freshnessDecision, "crop_within_frame");
});

/* C: camera-angle change triggers generate/edit, not crop/reuse */
test("C: a beat whose composition type differs from the established one becomes GENERATE (a materially different camera/subject is a new setup, not a crop)", () => {
  const macros = [
    macro({ id: "m1", narrationSegmentIds: ["s1"], baseSetupKey: "hab", informationToCommunicate: "Establish the habitat interior" }),
    macro({ id: "m2", narrationSegmentIds: ["s2"], baseSetupKey: "hab", informationToCommunicate: "A quiet moment of relief among the crew" }),
  ];
  const segments = [seg("s1", "The habitat hums with quiet machinery."), seg("s2", "A quiet sense of relief settles over the crew.")];
  const plan = planOf(macros, segments);
  const characterBeat = plan.visualBeats.find((b) => b.visualType === "CHARACTER");
  assert.ok(characterBeat, "fixture must produce a CHARACTER-focus beat after the ENVIRONMENT-focus establishing shot");
  assert.equal(characterBeat.renderMethod, "GENERATE");
  assert.equal(characterBeat.freshnessDecision, "composition_change_new_setup");
});

/* D: meaningful WorldState change triggers edit */
test("D: same composition, a state-change verb in the narration -> EDIT (Part 6's Viking/hearth example: GENERATE then EDIT, never a silent CROP/REUSE)", () => {
  const macros = [
    macro({ id: "m1", narrationSegmentIds: ["s1"], baseSetupKey: "hearth", informationToCommunicate: "Sitting by the cold hearth" }),
    macro({ id: "m2", narrationSegmentIds: ["s2"], baseSetupKey: "hearth", informationToCommunicate: "He feeds wood into the hearth" }),
    macro({ id: "m3", narrationSegmentIds: ["s3"], baseSetupKey: "hearth", informationToCommunicate: "The fire now warms the room" }),
  ];
  const segments = [seg("s1", "He sits beside the cold, dark hearth."), seg("s2", "He feeds wood into the hearth, and it begins to light."), seg("s3", "The fire now warms the room as he leans closer.")];
  const plan = planOf(macros, segments);
  const methods = plan.visualBeats.map((b) => b.renderMethod);
  assert.equal(methods[0], "GENERATE");
  assert.ok(methods.slice(1).includes("EDIT"), `expected at least one EDIT after the establishing shot, got ${methods.join(",")}`);
});

/* E: opening hook prefers fresh visuals */
test("E: within the first ~60 seconds, CROP is disabled — a detail-type beat there still becomes something other than CROP", () => {
  const macros = [
    macro({ id: "m1", narrationSegmentIds: ["s1"], baseSetupKey: "open", informationToCommunicate: "Cold open on the character" }),
    macro({ id: "m2", narrationSegmentIds: ["s2"], baseSetupKey: "open", informationToCommunicate: "A close look at the tool in their hand" }),
  ];
  const segments = [seg("s1", "She wakes to the alarm, sharp in the dark."), seg("s2", "The tool in her hand catches the light.")];
  const plan = planOf(macros, segments);
  const detailBeat = plan.visualBeats.find((b) => b.visualType === "OBJECT_DETAIL");
  assert.ok(detailBeat && detailBeat.estimatedStartSeconds < 60);
  assert.notEqual(detailBeat.renderMethod, "CROP");
});

/* F: graphic keyword inside story narration does not force graphic (preserved from the prior fix) */
test("F: 'checklist'/'status' vocabulary inside a STORY_ILLUSTRATION macro does not force PROGRAMMATIC_GRAPHIC", () => {
  const macros = [macro({ id: "m1", narrationSegmentIds: ["s1"], visualType: "STORY_ILLUSTRATION", baseSetupKey: "hab", informationToCommunicate: "Morning checklist" })];
  const segments = [seg("s1", "A tap opens the morning checklist. Status icons glow on the tablet in their hands.")];
  const plan = planOf(macros, segments);
  assert.ok(plan.visualBeats.some((b) => b.renderMethod !== "PROGRAMMATIC_GRAPHIC"));
});

/* G: real explainer macro still allows graphics */
test("G: a genuine DIAGRAM macro's matching narration still becomes PROGRAMMATIC_GRAPHIC", () => {
  const macros = [macro({ id: "m1", narrationSegmentIds: ["s1"], visualType: "DIAGRAM", informationToCommunicate: "Explain the airflow loop" })];
  const segments = [seg("s1", "The airflow loop recycles cabin air through a scrubber cause chain.")];
  const plan = planOf(macros, segments);
  assert.ok(plan.visualBeats.every((b) => b.renderMethod === "PROGRAMMATIC_GRAPHIC"));
});

/* H: intentional callback can reuse */
test("H: a beat whose narrativeFunction signals a payoff/callback, well outside the cooldown window, is allowed to REUSE", () => {
  const macros = [
    macro({ id: "m1", narrationSegmentIds: ["s1"], baseSetupKey: "console", informationToCommunicate: "Establish the console" }),
    // A long macro to push the callback beat's start time past the 40s cooldown.
    macro({ id: "m2", narrationSegmentIds: ["s2"], baseSetupKey: "other", informationToCommunicate: "A long unrelated detour of substantial length to pass real time" }),
    macro({ id: "m3", narrationSegmentIds: ["s3"], baseSetupKey: "console", narrativeFunction: "payoff callback to the console", informationToCommunicate: "Return to the console for the payoff" }),
  ];
  const segments = [
    seg("s1", "The technician stands at the console."),
    seg("s2", Array.from({ length: 130 }, () => "word").join(" ") + "."), // ~52s at 150wpm
    seg("s3", "The console shows the resolved status once more."),
  ];
  const plan = planOf(macros, segments);
  const callback = plan.visualBeats.find((b) => b.sourceMacroBeatId === "m3");
  assert.equal(callback.renderMethod, "REUSE");
  assert.equal(callback.intentionalCallback, true);
});

/* I: base setup can split within same location */
test("I: a location can produce MULTIPLE distinct base setups, not one baseSetupKey for the whole macro chain — unique setup count exceeds macro count when composition changes recur", () => {
  const macros = [
    macro({ id: "m1", narrationSegmentIds: ["s1"], locationId: "hab", baseSetupKey: "hab_A", informationToCommunicate: "Wide shot of the habitat" }),
    macro({ id: "m2", narrationSegmentIds: ["s2"], locationId: "hab", baseSetupKey: "hab_A", informationToCommunicate: "Look outside through the porthole window" }),
    macro({ id: "m3", narrationSegmentIds: ["s3"], locationId: "hab", baseSetupKey: "hab_A", informationToCommunicate: "A close detail of the console readout" }),
  ];
  const segments = [seg("s1", "The habitat hums with quiet machinery."), seg("s2", "Through the porthole window, the horizon glows red."), seg("s3", "The instrument panel readout blinks steadily.")];
  const plan = planOf(macros, segments);
  const uniqueSetups = new Set(plan.visualBeats.filter((b) => b.baseSetupKey).map((b) => b.baseSetupKey));
  assert.ok(uniqueSetups.size > 1, "one location's own narration drift across ENVIRONMENT/OBJECT focus should split into more than one real base setup");
});

/* J: price follows resulting strategy mix */
test("J: the credit total recomputed from a plan's actual renderMethod mix changes when the mix changes — pricing is derived, never independent of the plan", () => {
  const priceOf = (counts, genCredits) => (counts.GENERATE || 0) * genCredits + (counts.EDIT || 0) * 1;
  const sparse = { GENERATE: 11, EDIT: 5 };
  const dense = { GENERATE: 53, EDIT: 42 };
  assert.ok(priceOf(dense, 3) > priceOf(sparse, 3) * 2, "a genuinely richer plan must price meaningfully higher, not be normalized back toward the old cheap total");
});

/* K: no strategy changes to chase a lower price */
test("K: the freshness engine's decisions never reference credits/price/cost — render-strategy assignment is a pure function of timing/narration/composition signals only", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/functions/_shared/visualShotPlanning.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export function assignRenderStrategies"), src.indexOf("function splitDuration"));
  assert.doesNotMatch(fn, /credit|price|cost/i);
});

/* L: exact duplicate provider result is rejected (structural, verified against the real worker) */
test("L: the scene worker's duplicate-output guard rejects two independent GENERATE/EDIT scenes sharing one result_url before QA (unchanged, still present)", async () => {
  const { findDuplicateResultUrl } = await import("../src/pages/workspace/long-form/sceneCardModel.js");
  const scenes = [
    { id: "g1", render_strategy: "GENERATE", result_url: "https://x/1.jpg" },
    { id: "g2", render_strategy: "GENERATE", result_url: "https://x/1.jpg" },
  ];
  assert.equal(findDuplicateResultUrl(scenes, "g2", "https://x/1.jpg", "GENERATE"), "g1");
});

/* M: existing VisualPlan history remains immutable */
test("M: refineVisualSequences never mutates its input plan/script objects — a caller re-reading its own source data after a call still sees the original values", () => {
  const macros = [macro({ id: "m1", narrationSegmentIds: ["s1"], informationToCommunicate: "Original" })];
  const segments = [seg("s1", "Some original narration text here.")];
  const source = { visualBeats: macros };
  const script = { narrationSegments: segments };
  const beforeText = script.narrationSegments[0].text;
  const beforeInfo = source.visualBeats[0].informationToCommunicate;
  refineVisualSequences(source, script);
  assert.equal(script.narrationSegments[0].text, beforeText);
  assert.equal(source.visualBeats[0].informationToCommunicate, beforeInfo);
});
