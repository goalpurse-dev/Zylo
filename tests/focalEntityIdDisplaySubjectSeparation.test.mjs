import test from "node:test";
import assert from "node:assert/strict";
import { preflightEpisode } from "../supabase/functions/_shared/episodePreflight.ts";

// 2026-09-22 "FINAL stabilization pass" §6 (architecture piece) — the
// contract split the spec asks for: focalEntityId (authoritative, stable
// entity id, used by any future reference resolver) vs displaySubject
// (free text, UI/prompt only). focalEntityId is populated ONLY when the
// upstream-authored subject value is itself already a real registry entity
// id — never derived by matching free text against entity names/aliases
// (that alias-resolution piece needs a Visual-Plan-side schema addition
// this pass doesn't build — see final report). This still closes half of
// the real gap: when the beat's own subject IS a resolvable entity id, the
// contract now carries that authoritatively instead of only a free-text
// string with no id path at all.

function fixture() {
  const claim = {
    claimId: "c1", narrationSegmentIds: ["s1"], narrationText: "A landmark is described.",
    primarySubject: "the narrated subject", visualCommunicationGoal: "Show the landmark.", preferredVisualForms: ["ENVIRONMENT"],
    requiredVisualFacts: [], forbiddenVisualFacts: [], forbiddenEntities: [], comparisonClaims: [], causeEffectClaims: [], textOverlayCandidate: null,
  };
  const beat = { id: "b1", sequenceIndex: 1, chapterId: "ch1", narrationSegmentIds: ["s1"], narrationClaimId: "c1", renderMethod: "GENERATE", shotSize: "WIDE", baseSetupKey: "base", primaryEntityIds: [] };
  return {
    project: { current_script_version_id: "script", visual_style_preset: "bold_cartoon_documentary:v1", scene_generation_tier: "v3" },
    contract: { id: "contract", status: "ready", script_version_id: "script", claims: [claim] },
    plan: { narrationContractVersionId: "contract", entityRegistry: [{ id: "landmark_entity", name: "Some Landmark", category: "LOCATION", referenceNeeded: false }], visualBeats: [beat] },
    world: { reference_plan: { entities: [] } },
    assets: [],
  };
}

test("§6: when beat.subject IS a real, resolvable entity registry id, director.focalEntityId carries it authoritatively and focalSubject/displaySubject both carry the entity's human-readable name", () => {
  const f = fixture();
  f.plan.visualBeats[0].subject = "landmark_entity";
  const r = preflightEpisode(f);
  assert.equal(r.ok, true);
  assert.equal(r.compiled[0].director.focalEntityId, "landmark_entity");
  assert.equal(r.compiled[0].director.displaySubject, "Some Landmark");
  // 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
  // leaving focalSubject as the raw id fed a meaningless token straight
  // into the compiled image prompt's [SUBJECT] line for any entity with no
  // reference/physical description (a real incident: "ent_timaeus" as the
  // bare subject, with nothing to visually ground it, produced an invented
  // blob character). focalEntityId remains the one place for actual id-
  // based lookups; focalSubject/displaySubject are documented as "free text
  // for UI and prompt use" and must always be presentable text.
  assert.equal(r.compiled[0].director.focalSubject, "Some Landmark", "focalSubject must never leak the raw entity id into prompt/UI text");
});

test("§6: when beat.subject is a free-text string with NO matching registry entity, focalEntityId is null (never guessed via string matching) and displaySubject falls back to the same free text", () => {
  const f = fixture();
  f.plan.visualBeats[0].subject = "Pillars of Heracles";
  const r = preflightEpisode(f);
  assert.equal(r.ok, true);
  assert.equal(r.compiled[0].director.focalEntityId, null);
  assert.equal(r.compiled[0].director.displaySubject, "Pillars of Heracles");
});

test("§6: with no beat.subject at all, falls back to the claim's own primarySubject exactly as before (no focalEntityId, since claim.primarySubject is never a registry id)", () => {
  const r = preflightEpisode(fixture());
  assert.equal(r.ok, true);
  assert.equal(r.compiled[0].director.focalSubject, "the narrated subject");
  assert.equal(r.compiled[0].director.focalEntityId, null);
  assert.equal(r.compiled[0].director.displaySubject, "the narrated subject");
});
