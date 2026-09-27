import test from "node:test";
import assert from "node:assert/strict";
import { preflightEpisode } from "../supabase/functions/_shared/episodePreflight.ts";

// 2026-09-22 "FINAL stabilization pass" §13 — real Atlantis finding:
// several Pillars-of-Heracles scenes were rejected for "No characters
// present as required" even though the Scene Director's chosen focal
// subject was the landmark, no character reference was routed for anyone,
// and the shot concept never called for a visible character —
// qa_expectations (built from characterNames) and the actual render/
// reference contract (requiredReferenceLookups) disagreed about who counts.
// Root cause: characterNames was every CHARACTER-category entity merely
// TAGGED on the beat, with no importance gate — while reference routing
// only ever considers HERO/RECURRING relevant enough to this shot. Fixed by
// aligning both to the SAME gate, so QA can never be told to require a
// character that reference routing itself considered irrelevant to this
// shot. Deliberately generic (no Atlantis/Pillars/Plato string anywhere) —
// exercised via preflightEpisode's own real fixture shape.

function fixture() {
  const claim = {
    claimId: "c1", narrationSegmentIds: ["s1"], narrationText: "A landmark is described in the narration.",
    primarySubject: "landmark", visualCommunicationGoal: "Show the landmark.", preferredVisualForms: ["ENVIRONMENT"],
    requiredVisualFacts: [], forbiddenVisualFacts: [], forbiddenEntities: [], comparisonClaims: [], causeEffectClaims: [],
    textOverlayCandidate: null,
  };
  const beat = {
    id: "b1", sequenceIndex: 1, chapterId: "ch1", narrationSegmentIds: ["s1"], narrationClaimId: "c1",
    renderMethod: "GENERATE", shotSize: "WIDE", baseSetupKey: "base",
    // The beat still carries a LOW-importance/incidental character tag
    // alongside the landmark — a real, legitimate upstream shape (the
    // character is narratively "in the episode" even though this specific
    // shot's visual subject is the landmark) that this fix must not require
    // Script/Storyboard changes to handle correctly.
    primaryEntityIds: ["landmark_entity", "incidental_character"],
  };
  return {
    project: { current_script_version_id: "script", visual_style_preset: "bold_cartoon_documentary:v1", scene_generation_tier: "v3" },
    contract: { id: "contract", status: "ready", script_version_id: "script", claims: [claim] },
    plan: {
      narrationContractVersionId: "contract",
      entityRegistry: [
        { id: "landmark_entity", name: "Some Landmark", category: "LOCATION", referenceNeeded: false },
        { id: "incidental_character", name: "Background Character", category: "CHARACTER", importance: "LOW" },
      ],
      visualBeats: [beat],
    },
    world: { reference_plan: { entities: [] } },
    assets: [],
  };
}

test("§13: a LOW-importance character merely tagged on a beat is NOT reported as a required character when it was never relevant enough to route a reference for", () => {
  const r = preflightEpisode(fixture());
  assert.equal(r.ok, true);
  assert.deepEqual(r.compiled[0].characterNames, [], "incidental_character (LOW importance) must not appear — it was never a reference-routing candidate for this shot");
});

test("§13: a HERO/RECURRING character genuinely tagged on the beat still correctly appears as required — the fix narrows a false positive, it never hides a real one", () => {
  const f = fixture();
  f.plan.entityRegistry[1].importance = "RECURRING";
  const r = preflightEpisode(f);
  assert.equal(r.ok, true);
  assert.deepEqual(r.compiled[0].characterNames, ["Background Character"]);
});
