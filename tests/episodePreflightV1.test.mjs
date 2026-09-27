import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { alignReferenceLookupsToWorld, preflightEpisode, selectIsolatedReference } from "../supabase/functions/_shared/episodePreflight.ts";
import { bindEpisodeSemantics, canonicalizePlanCast, resolveCanonicalCast, sequenceEpisode } from "../supabase/functions/_shared/visualDirectorReliability.js";
import { supportsExactText } from "../supabase/functions/_shared/sceneCompositor.ts";
import { compositeExactTextLabel } from "../supabase/functions/_shared/graphicTemplates.ts";
import { customerVisualMessage } from "../src/pages/workspace/long-form/customerVisualMessage.js";

function fixture() {
  const claim = { claimId: "c1", narrationSegmentIds: ["s1"], narrationText: "The farmer checks the greenhouse crop.", primarySubject: "crop", visualCommunicationGoal: "Show the farmer inspecting the crop.", preferredVisualForms: ["CHARACTER_ACTION"], requiredVisualFacts: ["farmer checking crop"], forbiddenVisualFacts: [], forbiddenEntities: [], comparisonClaims: [], causeEffectClaims: [], textOverlayCandidate: { recommended: true, importance: "HIGH", semanticText: "DAY 14" } };
  const beat = { id: "b1", sequenceIndex: 1, chapterId: "ch1", narrationSegmentIds: ["s1"], narrationClaimId: "c1", renderMethod: "GENERATE", shotSize: "MEDIUM", baseSetupKey: "base", primaryEntityIds: ["agri"] };
  return { project: { current_script_version_id: "script", visual_style_preset: "bold_cartoon_documentary:v1", scene_generation_tier: "v3" }, contract: { id: "contract", status: "ready", script_version_id: "script", claims: [claim] }, plan: { narrationContractVersionId: "contract", entityRegistry: [{ id: "agri", name: "agricultural specialist", category: "CHARACTER", importance: "RECURRING", referenceNeeded: true }], visualBeats: [beat] }, world: { reference_plan: { entities: [{ entityId: "agri", requiredViews: [{ angle: "three_quarter", referenceType: "character_reference" }], characterIdentitySpec: { hairColor: "black", hairstyle: "braided", skinTone: "brown", outfitSpec: { colors: "green" } } }] } }, assets: [{ id: "ref", entity_id: "agri", angle_or_view: "three_quarter", status: "succeeded", qa_status: "approved", result_url: "https://example.invalid/ref.png" }] };
}
test("the actual deterministic compiler produces a complete, style-locked exact-text plan", () => {
  const f = fixture(); const r = preflightEpisode(f);
  assert.deepEqual(r.errors, []); assert.equal(r.ok, true);
  const p = r.compiled[0];
  for (const part of ["Linework:", "Shading:", "Texture:", "Palette:", "Proportions:", "Lighting:", "Perspective:", "TEXT-SAFE", "black", "braided"]) assert.ok(p.imagePrompt.includes(part), part);
  assert.ok(p.imagePrompt.length <= 1900); assert.equal(p.exactText, "DAY 14"); assert.deepEqual(p.referenceAssetIds, ["ref"]);
});
test("missing and stale contracts, false claim IDs, and wrong segment bindings fail closed", () => {
  for (const mutate of [f => f.contract = null, f => f.contract.script_version_id = "old", f => f.plan.visualBeats[0].narrationClaimId = "fake", f => f.contract.claims[0].narrationSegmentIds = ["other"]]) {
    const f = fixture(); mutate(f); assert.equal(preflightEpisode(f).ok, false);
  }
});
// 2026-09-21 "graphics are not a quota" pass, Section H: a claim that
// genuinely doesn't fit any of the 11 graphic templates no longer blocks
// the whole plan — it gracefully downgrades to a normal illustrated
// GENERATE scene (real Atlantis incident: a long multi-item checklist claim
// hard-failed finalization for the entire episode over one beat).
test("a graphic whose claim can't fit any template downgrades to a normal GENERATE scene instead of blocking the plan", () => {
  const f = fixture(); f.plan.visualBeats[0].renderMethod = "PROGRAMMATIC_GRAPHIC";
  f.contract.claims[0].textOverlayCandidate = null;
  f.contract.claims[0].preferredVisualForms = ["CHART"];
  f.contract.claims[0].narrationText = "An explanation requiring more structured facts. ".repeat(40);
  f.contract.claims[0].visualCommunicationGoal = f.contract.claims[0].narrationText;
  // 2026-09-23 "systemic production stabilization" pass, Item B: this
  // scenario means to simulate a claim with NOTHING usable anywhere —
  // compileGraphicSpec now also consults the beat's own per-beat assigned
  // requiredVisualFacts (assignSpanRequirements, called from
  // preparePlanForCompilation) BEFORE falling through to whole-claim
  // pattern matching, so a claim that still carries a short, real, assigned
  // fact ("farmer checking crop") correctly builds a real BULLET_LIST from
  // it now, rather than declaring the claim unrepresentable — that is the
  // intended fix, not a regression. Clearing requiredVisualFacts too keeps
  // this fixture genuinely "nothing usable anywhere," matching its own name.
  f.contract.claims[0].requiredVisualFacts = [];
  const r = preflightEpisode(f);
  assert.equal(r.ok, true);
  assert.equal(r.compiled[0].renderStrategy, "GENERATE");
  assert.ok(r.compiled[0].imagePrompt);
});
// 2026-09-20 "fix isolated character reference availability" pass updated
// this: a full multi-pose sheet is no longer a HARD block — real Mars
// finding, no single-pose isolated asset has ever existed for any real
// character (deriveRequiredViews only ever produces the one canonical
// sheet), so the old hard block failed 54 real beats. Per the explicit
// product decision ("preflight must not fail simply because... lacks the
// exact isolated extraction artifact"), a full sheet is now an ALLOWED
// FALLBACK (still ok:true), reported via isolationWarnings and an explicit
// single-pose disambiguation instruction in the compiled prompt — never
// silently indistinguishable from a real isolated reference. Rejected and
// superseded (replaces_asset_id-chained) views are UNCHANGED by this fix —
// still never usable at all.
test("a full sheet falls back safely (ok:true, named warning, disambiguation instruction) — rejected and superseded views are still never usable", () => {
  const f = fixture(); f.assets[0].angle_or_view = "character_reference_sheet";
  const sheetResult = preflightEpisode(f);
  assert.equal(sheetResult.ok, true, "a full sheet must no longer hard-block the beat");
  assert.deepEqual(sheetResult.isolationWarnings, ["ISOLATED_REFERENCE_FALLBACK_TO_SHEET:agri"]);
  assert.match(sheetResult.compiled[0].imagePrompt, /ONLY ONE consistent single pose/i);

  f.assets[0].angle_or_view = "three_quarter"; f.assets[0].qa_status = "rejected";
  assert.equal(preflightEpisode(f).ok, false, "a rejected view must still never condition a scene, sheet fallback or not");

  f.assets[0].qa_status = "approved"; f.assets.push({ ...f.assets[0], id: "new", replaces_asset_id: "ref", status: "pending" });
  assert.equal(selectIsolatedReference(f.assets, "agri", "three_quarter", true).id, "ref", "a pending regeneration must leave its accepted predecessor usable");
});
test("canonical domain roles resolve independently of chapter and replace invented aliases", () => {
  const cast = [{ id: "agri", name: "agricultural specialist", category: "CHARACTER" }, { id: "power", name: "power officer", category: "CHARACTER" }, { id: "tech", name: "maintenance technician", category: "CHARACTER" }];
  assert.deepEqual(resolveCanonicalCast("farmer in greenhouse", cast), ["agri"]);
  assert.deepEqual(resolveCanonicalCast("battery solar electricity", cast), ["power"]);
  assert.deepEqual(resolveCanonicalCast("suit mechanical repair", cast), ["tech"]);
  const p = canonicalizePlanCast({ entityRegistry: [{ id: "invented", name: "farmer", category: "CHARACTER" }], visualBeats: [{ primaryEntityIds: ["invented"] }] }, cast);
  assert.deepEqual(p.visualBeats[0].primaryEntityIds, ["agri"]);
  const f = fixture(); f.plan.visualBeats.push({ ...f.plan.visualBeats[0], id: "b2", chapterId: "ch7" });
  const ledger = bindEpisodeSemantics(f.plan.visualBeats, f.plan.entityRegistry, f.contract.claims);
  assert.deepEqual(ledger.agri.chapters, ["ch1", "ch7"]);
});
test("nine graphic proposals become spaced illustrations without unbounded comparison exemptions", () => {
  // entities/locationId set on every beat — a real compiled beat always
  // carries these from buildShotIntent (visualShotPlanning.js); the pacing
  // guard added in the 2026-09-23 "root-contract stabilization" pass only
  // allows a downgrade when the beat actually has something illustratable
  // to fall back to, so this fixture must reflect that to keep testing pure
  // pacing behavior rather than accidentally testing the new safety guard.
  const beats = Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, sequenceIndex: i + 1, renderMethod: "PROGRAMMATIC_GRAPHIC", intentionalVisualComparison: false, visualType: "DIAGRAM", entities: ["some_entity"] }));
  sequenceEpisode(beats);
  assert.deepEqual(beats.flatMap((b, i) => b.renderMethod === "PROGRAMMATIC_GRAPHIC" ? [i] : []), [0, 4, 8]);
  beats.forEach(b => { b.renderMethod = "PROGRAMMATIC_GRAPHIC"; b.intentionalVisualComparison = true; });
  sequenceEpisode(beats);
  assert.ok(!beats.some((b, i) => i > 1 && beats.slice(i - 2, i + 1).every(x => x.renderMethod === "PROGRAMMATIC_GRAPHIC")));
});
test("trivial EDITs and unbounded temporal chains are rejected by the final sequencer", () => {
  const beats = Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, sequenceIndex: i + 1, renderMethod: i ? "EDIT" : "GENERATE", baseSetupKey: "s", hasContractStateChange: true, continuityRequirement: "HIGH", hasTemporalProgression: true }));
  sequenceEpisode(beats);
  assert.ok(!beats.some((b, i) => i > 1 && beats.slice(i - 2, i + 1).every(x => x.renderMethod === "EDIT")));
  beats[1].renderMethod = "EDIT"; beats[1].hasContractStateChange = false; sequenceEpisode(beats); assert.notEqual(beats[1].renderMethod, "EDIT");
});
test("critical labels have real glyphs and produce pixels, including temperature and money", () => {
  for (const text of ["DAY 14", "7 PM", "1990", "30 DAYS", "-20°C", "17 HOURS", "NO INTERNET", "$1,000,000"]) {
    assert.equal(supportsExactText(text), true, text);
    const base = { width: 640, height: 360, data: new Uint8Array(640 * 360 * 4) };
    assert.ok(compositeExactTextLabel(base, text).data.some(v => v !== 0), text);
  }
  assert.equal(supportsExactText("漢字"), false);
});
test("provider error payloads cannot leak through customer copy", () => {
  for (const raw of ["FLUX failed", "image:unknown", "gpt-5-mini timeout", "Qwen", "Runware", "Kling", "Seedream", "OpenAI"]) assert.equal(customerVisualMessage(raw), "This visual needs another try. Please retry or review its plan.");
  assert.equal(customerVisualMessage("Please replan."), "Please replan.");
});
test("scene preflight only requests adopted-world required slots and aligns legacy angle aliases", () => {
  const world = { reference_plan: { entities: [{ entityId: "Sun", requiredViews: [{ angle: "canonical_celestial_view" }] }] } };
  assert.deepEqual(alignReferenceLookupsToWorld([
    { entityId: "Sun", angle: "three_quarter_hero" },
    { entityId: "optional_character", angle: "three_quarter" },
  ], world), [{ entityId: "Sun", angle: "canonical_celestial_view" }]);
});
test("critical scientific approximation text is supported exactly", () => {
  assert.equal(supportsExactText("≈8 min 19 s"), true);
  assert.equal(supportsExactText("Earth speed ≈29.8 km/s"), true);
});
test("billing invokes deterministic preflight first and carries a snapshot for the locked SQL check", () => {
  const src = fs.readFileSync(new URL("../supabase/functions/charge-long-form-episode-generation/index.ts", import.meta.url), "utf8");
  assert.ok(src.indexOf("await loadEpisodePreflight") < src.indexOf('admin.rpc("charge_long_form_episode_generation"'));
  assert.match(src, /if \(!preflight\.ok\)/); assert.match(src, /plan: preflight.context.plan/);
});
