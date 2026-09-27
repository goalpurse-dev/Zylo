import test from "node:test";
import assert from "node:assert/strict";
import { preflightEpisode } from "../supabase/functions/_shared/episodePreflight.ts";

// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
// the compiled GENERATE prompt's [SUBJECT] line and "Focal point:" sentence
// contained the raw entity id verbatim (e.g. "ent_timaeus") whenever
// beat.subject was an id with no reference/physical description to ground
// it — the image model had nothing but a meaningless token to work from and
// invented an unrelated character. Generic fixture (no Atlantis names).

function fixture() {
  const claim = {
    claimId: "c1", narrationSegmentIds: ["s1"], narrationText: "A dialogue voice explains something.",
    primarySubject: "the narrated subject", visualCommunicationGoal: "Explain the point.", preferredVisualForms: ["STORY_ILLUSTRATION"],
    requiredVisualFacts: [], forbiddenVisualFacts: [], forbiddenEntities: [], comparisonClaims: [], causeEffectClaims: [], textOverlayCandidate: null,
  };
  const beat = {
    id: "b1", sequenceIndex: 1, chapterId: "ch1", narrationSegmentIds: ["s1"], narrationClaimId: "c1",
    renderMethod: "GENERATE", shotSize: "WIDE", baseSetupKey: "base", primaryEntityIds: [],
    subject: "ent_some_opaque_id", actionOrState: "The dialogue voice explains something important.",
  };
  return {
    project: { current_script_version_id: "script", visual_style_preset: "bold_cartoon_documentary:v1", scene_generation_tier: "v3" },
    contract: { id: "contract", status: "ready", script_version_id: "script", claims: [claim] },
    plan: { narrationContractVersionId: "contract", entityRegistry: [{ id: "ent_some_opaque_id", name: "A Dialogue Voice", category: "DIAGRAM_SUBJECT", referenceNeeded: true }], visualBeats: [beat] },
    world: { reference_plan: { entities: [] } },
    assets: [],
  };
}

test("a beat whose subject resolves to a real entity id never leaks that raw id into the compiled image prompt — the human-readable name is used instead", () => {
  const r = preflightEpisode(fixture());
  assert.equal(r.ok, true);
  const prompt = r.compiled[0].imagePrompt;
  assert.ok(prompt, "expected a compiled image prompt for this GENERATE beat");
  assert.doesNotMatch(prompt, /\bent_some_opaque_id\b/, "the raw entity id must never appear verbatim in the compiled prompt");
  assert.match(prompt, /A Dialogue Voice/, "the human-readable entity name should appear instead");
});
