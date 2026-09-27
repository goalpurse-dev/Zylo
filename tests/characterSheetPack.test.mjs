import test from "node:test";
import assert from "node:assert/strict";
import { compileReferencePrompt, deriveRequiredViews, validateCompiledReferencePrompt, ZYVO_STYLE_SPEC } from "../supabase/functions/_shared/visualWorldStyle.ts";

const hero = { id: "hero", name: "Crew member", category: "CHARACTER", importance: "HERO", referenceNeeded: true };
const recurring = { ...hero, id: "recurring", importance: "RECURRING" };

// Phase 0, Section D — updated for the intentional 2026-09-22 "cheap
// reference system" simplification (see visualWorldStyle.ts's own comment
// on this branch): a real Atlantis incident found this code path had
// drifted back to emitting 10 separate paid generations per HERO character
// (5 structural views + 5 expression views) instead of the one consolidated
// canonical character reference sheet (angle "character_reference_sheet")
// it was always supposed to use. HERO and RECURRING both now get exactly
// ONE view — this test was asserting the OLD 10/5-view behavior the fix
// explicitly removed, not a live regression.
test("character packs are ONE consolidated canonical reference sheet per character, never 10 separate paid views or an AI collage", () => {
  const heroViews = deriveRequiredViews(hero, []);
  const recurringViews = deriveRequiredViews(recurring, []);
  assert.equal(heroViews.length, 1, "HERO must get exactly one consolidated reference sheet, not 10 separate views");
  assert.equal(recurringViews.length, 1, "RECURRING must get exactly one consolidated reference sheet, not 5 separate views");
  assert.equal(heroViews[0].angle, "character_reference_sheet");
  assert.equal(recurringViews[0].angle, "character_reference_sheet");
  assert.equal(heroViews[0].referenceType, "character_reference");
});

test("each character prompt requests one subject, canonical outfit, style lock and no generated text", () => {
  for (const view of deriveRequiredViews(recurring, [])) {
    const prompt = compileReferencePrompt({ styleSpec: ZYVO_STYLE_SPEC, entityName: hero.name, canonicalSpec: "Adult crew member in an olive utility coverall with blank patches.", view });
    if (!["profile", "back", "face_closeup"].includes(view.angle)) validateCompiledReferencePrompt(view, prompt);
    assert.match(prompt, /\[STYLE LOCK\]/);
    assert.match(prompt, /NO collage/);
    assert.match(prompt, /NO readable text/);
    assert.doesNotMatch(prompt, /\[HISTORICAL OR FACTUAL CONSTRAINTS\]/);
  }
});
