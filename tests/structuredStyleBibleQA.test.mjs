import test from "node:test";
import assert from "node:assert/strict";
import { buildSceneQAPrompt } from "../supabase/functions/_shared/sceneQA.ts";

// 2026-09-22 "FINAL stabilization pass" §1 — real Atlantis finding: shots
// that materially changed linework/shading model/rendering realism (a
// monochrome engraved/cross-hatched shot among flat-color-cartoon
// siblings) were still scored styleMismatchSeverity:"none" — the old
// prompt asked one vague "how well does this match the style" question
// with no concrete axis to compare against. Fixed by asking about the
// ACTUAL structured Style Bible dimensions (linework/shading/texture/
// palette/negativeConstraints) and naming concrete violation categories.
// Tests #15/#16 from the regression list.

function baseArgs(overrides = {}) {
  return {
    requiredCharacterNames: [], locationName: null, shotSize: "MEDIUM", expectedAction: "A scene.",
    styleName: "Classic 2D Documentary",
    styleDimensions: {
      linework: "Thick, confident black outlines on every silhouette edge, with minimal interior detail lines.",
      shading: "Flat cel-shading only, 1-2 tonal steps per surface.",
      texture: "A light, uniform paper/canvas grain overlay.",
      palette: "Flat, readable hues — 2-4 dominant hues plus neutrals.",
      negativeConstraints: ["not hyper-realistic / photographic", "no 3D-render look", "no anime/manga stylization"],
    },
    ...overrides,
  };
}

test("§1: the style prompt names the ACTUAL structured dimensions (linework/shading/texture/palette), not just the style's display name", () => {
  const prompt = buildSceneQAPrompt(baseArgs());
  assert.match(prompt, /Thick, confident black outlines/);
  assert.match(prompt, /Flat cel-shading only, 1-2 tonal steps/);
  assert.match(prompt, /paper\/canvas grain overlay/);
  assert.match(prompt, /2-4 dominant hues plus neutrals/);
});

test("§1: the prompt explicitly names monochrome engraving/cross-hatching and photorealistic/painterly rendering as MAJOR violations — the exact real Atlantis failure mode", () => {
  const prompt = buildSceneQAPrompt(baseArgs());
  assert.match(prompt, /monochrome engraving\/etching\/cross-hatching/i);
  assert.match(prompt, /photorealistic or painterly rendering/i);
  assert.match(prompt, /Score "major" for a technique\/medium change/);
});

test("§1: the style's own negativeConstraints are surfaced verbatim in the prompt", () => {
  const prompt = buildSceneQAPrompt(baseArgs());
  assert.match(prompt, /not hyper-realistic \/ photographic; no 3D-render look; no anime\/manga stylization/);
});

test("§1: a scene with no style specified at all still degrades gracefully (answer 'none'), never crashes on missing styleDimensions", () => {
  const prompt = buildSceneQAPrompt(baseArgs({ styleName: null, styleDimensions: null }));
  assert.match(prompt, /no style was specified — answer "none"/);
});

test("§1: styleDimensions with only SOME fields populated (real-world partial data) never crashes and only includes the fields that exist", () => {
  const prompt = buildSceneQAPrompt(baseArgs({ styleDimensions: { linework: "Thin outlines only." } }));
  assert.match(prompt, /Thin outlines only\./);
  assert.doesNotMatch(prompt, /Shading model: undefined/);
});

test("§1: a style_reference (already-approved same-episode frame) is surfaced as STYLE-ONLY evidence, never folded into the identity/location 'canonical references' language", () => {
  const prompt = buildSceneQAPrompt(baseArgs({ referenceImages: [{ url: "https://x/style.png", label: "approved frame", kind: "style_reference" }] }));
  assert.match(prompt, /supplied ONLY as visual-STYLE continuity evidence — never compare it for character\/location identity/);
  assert.doesNotMatch(prompt, /CANONICAL Visual World references — the scene MUST visually match these/, "with zero identity refs, the identity-reference preamble must not fire just because a style reference exists");
});

test("§1: when both an identity reference and a style_reference are supplied, the style reference is indexed AFTER the identity refs and referenced explicitly in the style question", () => {
  const prompt = buildSceneQAPrompt(baseArgs({
    referenceImages: [
      { url: "https://x/hero.png", label: "hero", kind: "character_reference" },
      { url: "https://x/style.png", label: "approved frame", kind: "style_reference" },
    ],
  }));
  assert.match(prompt, /CANONICAL Visual World references/);
  assert.match(prompt, /IMAGE 3 \(the approved same-episode style-continuity frame\)/);
});
