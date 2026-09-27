import test from "node:test";
import assert from "node:assert/strict";
import { selectIsolatedReference, compileEpisodeBeat, preflightEpisode } from "../supabase/functions/_shared/episodePreflight.ts";

// 2026-09-20 "fix isolated character reference availability" pass — real
// Mars finding: deriveRequiredViews only ever produces ONE canonical
// multi-pose character_reference_sheet per character; no single-pose
// isolated asset has ever existed for any real character. The old hard
// block (ISOLATED_CHARACTER_REFERENCE_REQUIRED) failed 54 beats across
// every HERO/RECURRING character. Per the explicit product decision:
// "preflight must not fail simply because... lacks the exact isolated
// extraction artifact" — this now falls back to the canonical sheet
// (still the real source of truth) with a clearly-named warning and an
// explicit single-pose disambiguation instruction, rather than blocking.

function sheetAsset(overrides = {}) {
  return { id: "sheet-1", entity_id: "e_protagonist", angle_or_view: "character_reference_sheet", status: "succeeded", result_url: "https://x/sheet.png", qa_status: "approved", stale: false, created_at: "2026-09-15T00:00:00Z", ...overrides };
}
function minimalClaim(overrides = {}) {
  return { claimId: "c1", primarySubject: "protagonist", visualCommunicationGoal: "Show the protagonist waking up.", preferredVisualForms: ["CHARACTER_ACTION"], narrationSegmentIds: ["s1"], requiredVisualFacts: [], forbiddenVisualFacts: [], forbiddenEntities: [], comparisonClaims: [], causeEffectClaims: [], ...overrides };
}

test("selectIsolatedReference falls back to the canonical sheet (marked isolatedFallback) when no single-pose asset exists for a character", () => {
  const asset = selectIsolatedReference([sheetAsset()], "e_protagonist", "three_quarter_hero", true);
  assert.equal(asset.id, "sheet-1");
  assert.equal(asset.isolatedFallback, true);
});

test("a genuine single-pose asset is still strictly preferred over the sheet fallback", () => {
  const isolated = { id: "iso-1", entity_id: "e_protagonist", angle_or_view: "three_quarter_hero", status: "succeeded", result_url: "https://x/iso.png", qa_status: "approved", stale: false, created_at: "2026-09-18T00:00:00Z" };
  const asset = selectIsolatedReference([sheetAsset(), isolated], "e_protagonist", "three_quarter_hero", true);
  assert.equal(asset.id, "iso-1");
  assert.equal(asset.isolatedFallback, undefined);
});

test("with truly nothing available (no sheet, no isolated asset), it still throws ISOLATED_CHARACTER_REFERENCE_REQUIRED — 'clearly name that entity'", () => {
  assert.throws(() => selectIsolatedReference([], "e_protagonist", "three_quarter_hero", true), /ISOLATED_CHARACTER_REFERENCE_REQUIRED:e_protagonist/);
});

test("a non-character (location/object) lookup is unaffected — no sheet-fallback logic applies to it", () => {
  assert.throws(() => selectIsolatedReference([sheetAsset({ entity_id: "l_greenhouse", angle_or_view: "wide" })], "l_greenhouse", "three_quarter_hero", false), /CANONICAL_REFERENCE_NOT_READY/);
});

test("compileEpisodeBeat: a GENERATE beat that falls back to the sheet still compiles successfully (never blocked) and reports the fallback by entity id", () => {
  const context = {
    plan: {
      entityRegistry: [{ id: "e_protagonist", category: "CHARACTER", name: "Protagonist", importance: "HERO", referenceNeeded: true }],
      continuityGroups: [],
    },
    contract: { id: "contract-1", claims: [minimalClaim()] },
    project: { visual_style_preset: "bold_cartoon_documentary", scene_generation_tier: "v3" },
    world: { reference_plan: { entities: [{ entityId: "e_protagonist", canonicalSpec: "A tall figure" }] } },
    assets: [sheetAsset()],
  };
  const beat = { id: "b1", renderMethod: "GENERATE", shotSize: "MEDIUM", narrationClaimId: "c1", primaryEntityIds: ["e_protagonist"], supportingEntityIds: [], locationId: null };
  const compiled = compileEpisodeBeat(beat, context);
  assert.ok(compiled.imagePrompt, "must still produce a real prompt, not block");
  assert.deepEqual(compiled.isolationWarnings, ["ISOLATED_REFERENCE_FALLBACK_TO_SHEET:e_protagonist"]);
  assert.match(compiled.imagePrompt, /ONLY ONE consistent single pose/i, "the compiled prompt must carry the disambiguation instruction");
});

test("preflightEpisode aggregates isolationWarnings across all beats, separate from hard errors", () => {
  const context = {
    plan: {
      narrationContractVersionId: "contract-1",
      visualBeats: [{ id: "b1", renderMethod: "GENERATE", shotSize: "MEDIUM", narrationClaimId: "c1", narrationSegmentIds: ["s1"], chapterId: null, primaryEntityIds: ["e_protagonist"], supportingEntityIds: [], locationId: null }],
      entityRegistry: [{ id: "e_protagonist", category: "CHARACTER", name: "Protagonist", importance: "HERO", referenceNeeded: true }],
      continuityGroups: [],
    },
    contract: { id: "contract-1", status: "ready", script_version_id: "s1", claims: [minimalClaim()] },
    project: { visual_style_preset: "bold_cartoon_documentary", scene_generation_tier: "v3", current_script_version_id: "s1" },
    world: { reference_plan: { entities: [{ entityId: "e_protagonist", canonicalSpec: "A tall figure" }] } },
    assets: [sheetAsset()],
  };
  const result = preflightEpisode(context);
  assert.equal(result.totalBeats, 1);
  assert.equal(result.compiled.length, 1);
  assert.equal(result.errors.length, 0, "a sheet fallback must never appear in errors — it's a warning, not a compile failure");
  assert.deepEqual(result.isolationWarnings, ["ISOLATED_REFERENCE_FALLBACK_TO_SHEET:e_protagonist"]);
});
