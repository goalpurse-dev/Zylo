import test from "node:test";
import assert from "node:assert/strict";
import { shotEntityIds, refineVisualSequences } from "../supabase/functions/_shared/visualShotPlanning.js";

// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
// a shot whose OWN narration slice mentions no candidate entity by name
// used to fall back to "the first entity in the macro's list," which could
// be a DIAGRAM_SUBJECT entity (a dialogue voice, an abstract graphic
// concept — deliberately given no reference image and no physical
// description anywhere in the Visual World, see visualWorldStyle.ts's own
// "DIAGRAM_SUBJECT rows deliberately do not become subject-by-subject
// images" design). That entity's bare id then became a raster GENERATE
// shot's on-screen [SUBJECT] with nothing to visually ground it, and the
// image model invented an unrelated blob/mascot to satisfy "a subject must
// be here." Deliberately generic fixtures (no Atlantis/Plato names) to
// prove this is a category-driven fix, not a topic-specific patch.

const plan = {
  entityRegistry: [
    { id: "ent_hero", name: "Hero Character", category: "CHARACTER" },
    { id: "ent_narrator_voice", name: "Narrator Voice", category: "DIAGRAM_SUBJECT" },
    { id: "obj_summary_graphic", name: "On-screen summary graphic", category: "DIAGRAM_SUBJECT" },
    { id: "loc_harbor", name: "The Harbor", category: "LOCATION" },
  ],
};

test("never falls back to a DIAGRAM_SUBJECT entity when nothing is textually mentioned — falls back to a real illustratable entity instead", () => {
  const macro = { primaryEntityIds: ["ent_narrator_voice", "loc_harbor"], supportingEntityIds: [] };
  const result = shotEntityIds(plan, macro, "some narration text mentioning nobody by name", null, 1);
  assert.deepEqual(result, ["loc_harbor"]);
});

test("never falls back to a DIAGRAM_SUBJECT entity for the FIRST shot of a macro either (part=0 takes up to 2)", () => {
  const macro = { primaryEntityIds: ["obj_summary_graphic", "ent_hero", "loc_harbor"], supportingEntityIds: [] };
  const result = shotEntityIds(plan, macro, "no names mentioned here", null, 0);
  assert.deepEqual(result, ["ent_hero", "loc_harbor"]);
});

test("returns an empty array (never an invented subject) when EVERY macro-level candidate is DIAGRAM_SUBJECT", () => {
  const macro = { primaryEntityIds: ["ent_narrator_voice", "obj_summary_graphic"], supportingEntityIds: [] };
  const result = shotEntityIds(plan, macro, "no illustratable candidate exists for this shot", null, 1);
  assert.deepEqual(result, []);
});

test("a genuinely mentioned CHARACTER/LOCATION entity is still returned normally — the fix only excludes DIAGRAM_SUBJECT, never narrows real matches", () => {
  const macro = { primaryEntityIds: ["ent_hero", "loc_harbor"], supportingEntityIds: [] };
  const result = shotEntityIds(plan, macro, "Hero Character walks toward the water", null, 1);
  assert.deepEqual(result, ["ent_hero"]);
});

test("a DIAGRAM_SUBJECT entity is excluded even when its own name IS literally mentioned in the narration — it must never become an on-screen raster subject", () => {
  const macro = { primaryEntityIds: ["ent_narrator_voice", "loc_harbor"], supportingEntityIds: [] };
  const result = shotEntityIds(plan, macro, "Narrator Voice explains what happens next at the harbor", null, 1);
  assert.deepEqual(result, ["loc_harbor"]);
});

// End-to-end reproduction via the real pipeline entrypoint, generic fixture
// (no Atlantis-specific names) — proves the fix holds through the full
// refineVisualSequences path, not just the isolated helper.
test("end-to-end: a macro with sibling sub-shots and a DIAGRAM_SUBJECT-only late shot never anchors that shot's subject on the diagram entity", () => {
  const script = {
    narrationSegments: [
      { id: "seg1", chapterId: "ch1", text: "A short opening line introduces the harbor. Then a longer explanation follows with several distinct clauses about records and dates and figures that never name any specific person again." },
    ],
  };
  const contractClaims = [{
    claimId: "seg1__inline", primarySubject: "the harbor records", visualCommunicationGoal: "Explain the records.",
    preferredVisualForms: ["STORY_ILLUSTRATION"], requiredVisualFacts: [], textOverlayCandidate: null,
    entityRequirements: [], continuityRequirement: "LOW",
    narrationSegmentIds: ["seg1"], narrationText: script.narrationSegments[0].text,
  }];
  const macroBase = {
    sequenceIndex: 1, chapterId: "ch1", narrationSegmentIds: ["seg1"], estimatedStartSeconds: 0, estimatedEndSeconds: 20,
    informationToCommunicate: "Explain the records.", narrativeFunction: "", revealConstraints: [],
    visualType: "STORY_ILLUSTRATION", shotStrategy: "NEW_SETUP", renderMethod: "GENERATE", shotSize: "MEDIUM",
    continuityGroupId: null, baseSetupKey: "base", deltaInstruction: null, factualVisualConstraints: [], forbiddenElements: [],
    // Two sibling macros sharing the same segment forces preferMacroSubject=true.
    primaryEntityIds: ["ent_narrator_voice"], supportingEntityIds: ["loc_harbor"], locationId: null,
  };
  const source = { visualBeats: [{ ...macroBase, id: "m1" }, { ...macroBase, id: "m2", sequenceIndex: 2 }], entityRegistry: plan.entityRegistry };
  const result = refineVisualSequences(source, script, "balanced", contractClaims);
  for (const beat of result.visualBeats) {
    assert.notEqual(beat.subject, "ent_narrator_voice", `beat ${beat.id} must never be anchored on the DIAGRAM_SUBJECT entity`);
    assert.ok(!(beat.entities ?? []).includes("ent_narrator_voice"), `beat ${beat.id}'s entities must never include the DIAGRAM_SUBJECT entity`);
  }
});

// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
// buildShotIntent's own visualDelta text ("Establish {subject}...") used
// the RAW subject value (often a real entity id when entityIds[0] won) —
// a leak independent of episodePreflight.ts's focalSubject/displaySubject
// fix, since this text is generated once here and persisted verbatim.
test("buildShotIntent's visualDelta text never contains a raw entity id — always the resolved display name", () => {
  const macro = {
    sequenceIndex: 1, chapterId: "ch1", narrationSegmentIds: ["seg1"], estimatedStartSeconds: 0, estimatedEndSeconds: 10,
    informationToCommunicate: "Introduce the hero.", narrativeFunction: "", revealConstraints: [],
    visualType: "STORY_ILLUSTRATION", shotStrategy: "NEW_SETUP", renderMethod: "GENERATE", shotSize: "MEDIUM",
    continuityGroupId: null, baseSetupKey: "base", deltaInstruction: null, factualVisualConstraints: [], forbiddenElements: [],
    primaryEntityIds: ["ent_hero"], supportingEntityIds: [], locationId: null,
  };
  const script = { narrationSegments: [{ id: "seg1", chapterId: "ch1", text: "Hero Character stands at the harbor and looks out to sea." }] };
  const source = { visualBeats: [macro], entityRegistry: plan.entityRegistry };
  const result = refineVisualSequences(source, script);
  const first = result.visualBeats[0];
  assert.match(first.visualDelta, /Establish Hero Character/);
  assert.doesNotMatch(first.visualDelta, /ent_hero/);
});
