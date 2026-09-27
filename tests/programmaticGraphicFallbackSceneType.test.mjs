import test from "node:test";
import assert from "node:assert/strict";
import { preflightEpisode } from "../supabase/functions/_shared/episodePreflight.ts";

// 2026-09-22 "FINAL stabilization pass" §7 — real, LIVE Atlantis finding
// (confirmed via a live compile-only dry run against the real project):
// two Chapter 1 beats persisted scene_type=PROGRAMMATIC_GRAPHIC alongside
// render_strategy=GENERATE — a direct architecture violation (a
// PROGRAMMATIC_GRAPHIC must never invoke the image provider). Root cause:
// when compileGraphicSpec fails to fit a claim into any of the 11 graphic
// templates ("graphics are not a quota" pass, Section H), the beat
// correctly falls back to an illustrated GENERATE scene, but sceneType —
// computed once, earlier, from the beat's original visualType — was never
// recomputed to match. Fixed by downgrading sceneType in lockstep with
// renderStrategy at the exact fallback site.

function fixture() {
  const claim = {
    claimId: "c1", narrationSegmentIds: ["s1"], narrationText: "An explanation requiring more structured facts. ".repeat(40),
    primarySubject: "crop", visualCommunicationGoal: "An explanation requiring more structured facts. ".repeat(40),
    preferredVisualForms: ["CHART"], requiredVisualFacts: [], forbiddenVisualFacts: [], forbiddenEntities: [],
    comparisonClaims: [], causeEffectClaims: [], textOverlayCandidate: null,
  };
  const beat = { id: "b1", sequenceIndex: 1, chapterId: "ch1", narrationSegmentIds: ["s1"], narrationClaimId: "c1", renderMethod: "PROGRAMMATIC_GRAPHIC", visualType: "PROGRAMMATIC_GRAPHIC", shotSize: "MEDIUM", baseSetupKey: "base", primaryEntityIds: [] };
  return {
    project: { current_script_version_id: "script", visual_style_preset: "bold_cartoon_documentary:v1", scene_generation_tier: "v3" },
    contract: { id: "contract", status: "ready", script_version_id: "script", claims: [claim] },
    plan: { narrationContractVersionId: "contract", entityRegistry: [], visualBeats: [beat] },
    world: { reference_plan: { entities: [] } },
    assets: [],
  };
}

test("§7: when a graphic claim can't fit any template and downgrades to GENERATE, sceneType downgrades too — never left as PROGRAMMATIC_GRAPHIC alongside a GENERATE render strategy", () => {
  const r = preflightEpisode(fixture());
  assert.equal(r.ok, true);
  assert.equal(r.compiled[0].renderStrategy, "GENERATE");
  assert.equal(r.compiled[0].sceneType, "STORY_SCENE", "scene_type must never disagree with render_strategy about whether the image provider runs");
});

// The second, actually-live-reproducing cause: the upstream-authored beat
// itself already carries renderMethod:"GENERATE" alongside
// visualType:"PROGRAMMATIC_GRAPHIC" (confirmed directly against the real
// Atlantis Chapter 1 data, predating this pass) — no template-fit fallback
// involved at all. The compiler must catch this unconditionally, not only
// inside the one fallback branch that happens to also produce it.
test("§7: a beat whose OWN upstream renderMethod/visualType already disagree (renderMethod=GENERATE, visualType=PROGRAMMATIC_GRAPHIC) is still corrected, with no template-fit fallback involved", () => {
  const f = fixture();
  f.plan.visualBeats[0].visualType = "PROGRAMMATIC_GRAPHIC";
  f.plan.visualBeats[0].renderMethod = "GENERATE"; // disagreement authored upstream, not decided by this compiler
  f.contract.claims[0].preferredVisualForms = ["CHARACTER_ACTION"]; // would fit a template fine — the mismatch isn't about template fit here
  f.contract.claims[0].narrationText = "A short claim.";
  f.contract.claims[0].visualCommunicationGoal = "A short claim.";
  const r = preflightEpisode(f);
  assert.equal(r.ok, true);
  assert.equal(r.compiled[0].renderStrategy, "GENERATE");
  assert.equal(r.compiled[0].sceneType, "STORY_SCENE");
});
