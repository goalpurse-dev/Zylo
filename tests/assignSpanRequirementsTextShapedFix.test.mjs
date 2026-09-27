import test from "node:test";
import assert from "node:assert/strict";
import { assignSpanRequirements } from "../supabase/functions/_shared/visualShotPlanning.js";

// 2026-09-23 "systemic production stabilization" pass, Item B/H — real
// Atlantis finding: a genuine multi-item visual-content fact ("on-screen
// bullet list: 'beyond the Pillars of Heracles', 'fertile plains',
// 'harbors/walls/canals', '9000' chronological marker', 'earthquake and
// flood'") was misrouted to beat.overlayRequirement (a raster safe-area
// reservation hint) instead of beat.shotRequiredVisualFacts (real graphic
// content) purely because the old TEXT_SHAPED_REQUIREMENT regex treated ANY
// digit anywhere in a fact as proof it was "text-shaped." This is the exact
// reason 5 sibling PROGRAMMATIC_GRAPHIC beats sharing this claim still
// compiled to one identical card even after compileGraphicSpec itself was
// fixed to prefer per-beat facts (graphicSpecPerBeatAndLayoutEscalation.
// test.mjs) — assignSpanRequirements never gave any of them a distinct fact
// to consume in the first place.

test("a genuine multi-item visual-content fact that merely mentions a number is no longer misrouted to overlayRequirement", () => {
  const beats = [{ id: "b1", narrationClaimId: "c1", shotNarrationText: "the island beyond the pillars" }];
  const claim = {
    claimId: "c1",
    requiredVisualFacts: ["on-screen bullet list: 'beyond the Pillars of Heracles', 'fertile plains', 'harbors/walls/canals', '9000' chronological marker', 'earthquake and flood'"],
  };
  assignSpanRequirements(beats, [claim]);
  assert.equal(beats[0].shotRequiredVisualFacts.length, 1, "must land in shotRequiredVisualFacts, not be silently dropped");
  assert.equal(beats[0].overlayRequirement, undefined);
});

test("a genuinely text/caption/label-shaped fact is still routed to overlayRequirement — the fix narrows a false positive, it doesn't remove the real signal", () => {
  const beats = [{ id: "b1", narrationClaimId: "c1", shotNarrationText: "captions appear" }];
  const claim = { claimId: "c1", requiredVisualFacts: ["captions read '8:19 remaining'"] };
  assignSpanRequirements(beats, [claim]);
  assert.equal(beats[0].shotRequiredVisualFacts.length, 0);
  assert.ok(beats[0].overlayRequirement?.text.includes("captions"));
});

test("a fact that is ONLY digits with no other text-shaped keyword is a real visual fact, never an overlay requirement", () => {
  const beats = [{ id: "b1", narrationClaimId: "c1", shotNarrationText: "nine thousand years pass" }];
  const claim = { claimId: "c1", requiredVisualFacts: ["a timeworn stone marker dated 9000 years ago"] };
  assignSpanRequirements(beats, [claim]);
  assert.equal(beats[0].shotRequiredVisualFacts.length, 1);
  assert.equal(beats[0].overlayRequirement, undefined);
});
