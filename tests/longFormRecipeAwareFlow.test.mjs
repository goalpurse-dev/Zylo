import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isStickmanRecipeProfile, STICKMAN_RECIPE, STICKMAN_RECIPE_VERSION } from "../src/pages/workspace/long-form/recipe.js";

// 2026-10-02 "make the new flow real in the product" pass — the recipe-aware
// branch is the one thing that must NEVER accidentally apply to a legacy/
// Atlantis-style project. These tests cover the pure logic directly and use
// the same source-pattern-safety technique already established this session
// (generateLongFormNarrationAudio.test.mjs) for the parts that are thin
// Supabase Edge Function wrappers rather than pure functions.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("isStickmanRecipeProfile is false for null/legacy profiles and true only for the exact recipe string", () => {
  assert.equal(isStickmanRecipeProfile(null), false);
  assert.equal(isStickmanRecipeProfile(undefined), false);
  assert.equal(isStickmanRecipeProfile({ visual_recipe: "legacy_visual_world" }), false);
  assert.equal(isStickmanRecipeProfile({ visual_recipe: STICKMAN_RECIPE }), true);
});

// state.js itself imports "./discoverIdeas" without an extension, which only
// resolves under Vite, not plain Node ESM — this reads the source directly
// (same established workaround onScreenTextDensity.test.mjs already uses)
// rather than importing it.
test("LONG_FORM_STICKMAN_STAGES replaces Look/Generate with Narration/Visuals, never mutates the legacy 5-stage list", async () => {
  const text = await source("src/pages/workspace/long-form/state.js");
  const legacyBlock = text.slice(text.indexOf("LONG_FORM_STAGES = ["), text.indexOf("];", text.indexOf("LONG_FORM_STAGES = [")));
  const stickmanBlock = text.slice(text.indexOf("LONG_FORM_STICKMAN_STAGES = ["), text.indexOf("];", text.indexOf("LONG_FORM_STICKMAN_STAGES = [")));
  for (const key of ["idea", "story", "look", "generate", "edit"]) assert.match(legacyBlock, new RegExp(`key: "${key}"`));
  for (const key of ["idea", "story", "narration", "visuals", "edit"]) assert.match(stickmanBlock, new RegExp(`key: "${key}"`));
  assert.doesNotMatch(stickmanBlock, /key: "look"|key: "generate"/);
});

test("STICKMAN_RECIPE_VERSION matches the one real recipe registered in the pacing table create-long-form-production-setup reads", async () => {
  // Phase 0, Section C.2 moved the pacing table itself (RECIPE_BEATS_PER_MINUTE)
  // out of this edge function and into the one shared constants module, so the
  // literal recipe-version key no longer appears in the edge function's own
  // text — only its import of, and a live key lookup into, the shared table
  // do. This still proves the same cross-consistency invariant the test's
  // name promises: create-long-form-production-setup reads its pacing rate
  // from the SAME table that registers STICKMAN_RECIPE_VERSION, so the two
  // can never independently drift.
  const setup = await source("supabase/functions/create-long-form-production-setup/index.ts");
  assert.match(setup, /import \{ RECIPE_BEATS_PER_MINUTE \} from "\.\.\/\.\.\/\.\.\/src\/lib\/longFormPipelineConstants\.ts";/);
  assert.match(setup, /RECIPE_BEATS_PER_MINUTE\[recipeVersion\]/);
  const constants = await source("src/lib/longFormPipelineConstants.ts");
  assert.match(constants, new RegExp(`RECIPE_BEATS_PER_MINUTE[\\s\\S]{0,80}${STICKMAN_RECIPE_VERSION}`));
});

test("LongFormProgress/LongFormCreationHeader default to the legacy stage list and only switch on an explicit `stickman` prop — never inferred internally", async () => {
  const text = await source("src/pages/workspace/long-form/shared.jsx");
  assert.match(text, /stickman = false/);
  assert.match(text, /stickman \? LONG_FORM_STICKMAN_STAGES : LONG_FORM_STAGES/);
});

test("script.jsx only offers 'Lock Story' (and only auto-redirects an already-locked script to Narration) when the active profile is the Stickman recipe — a legacy project (profile:null) always keeps 'Continue to Look'", async () => {
  const text = await source("src/pages/workspace/long-form/script.jsx");
  assert.match(text, /isStickmanRecipeProfile\(profile\) \? "Lock Story" : "Continue to Look"/);
  assert.match(text, /isStickmanRecipeProfile\(profile\) && versionRow\.locked_at && versionRow\.locked_generation_profile_id === profile\.id/);
});

test("new.jsx (the legacy Idea page, reverted after the Production Setup redesign) never calls createProductionSetup and always says Create Story Plan — the new Stickman flow lives entirely on ProductionSetup.jsx now", async () => {
  const text = await source("src/pages/workspace/long-form/new.jsx");
  assert.doesNotMatch(text, /createProductionSetup/);
  assert.match(text, /Create Story Plan/);
});

test("ProductionSetup.jsx (the new /long-form/create page) always freezes the Production Profile and reserves credits via createProductionSetup before navigating to Story, and only ever offers a Generate CTA (never Create Story Plan)", async () => {
  const text = await source("src/pages/workspace/long-form/ProductionSetup.jsx");
  assert.match(text, /await createProductionSetup\(/);
  // Final-polish pass: the CTA's own copy is now "Generate video" (mixed
  // case, no baked-in credit count) rather than the old literal
  // "GENERATE VIDEO · N CREDITS" — see GenerateButton.
  assert.match(text, /Generate video/);
  assert.doesNotMatch(text, /Create Story Plan/);
});

test("ProductionSetup.jsx never lets a non-production-ready Visual Style be selected — isStyleSelectable gates the click handler", async () => {
  const text = await source("src/pages/workspace/long-form/ProductionSetup.jsx");
  assert.match(text, /disabled={!selectable}/);
  assert.match(text, /selectable && onSelect\(style\.id\)/);
});

test("visualStyles.js: only classic_flat_stickman is production-ready, and every non-production-ready style carries no visualRecipe/recipeVersion at all (nothing for the UI to silently fall back to)", async () => {
  const { VISUAL_STYLES, isStyleSelectable } = await import("../src/pages/workspace/long-form/visualStyles.js");
  assert.equal(VISUAL_STYLES.length, 10);
  const ready = VISUAL_STYLES.filter((s) => s.productionReady);
  assert.deepEqual(ready.map((s) => s.id), ["classic_flat_stickman"]);
  for (const style of VISUAL_STYLES) {
    if (style.id === "classic_flat_stickman") {
      assert.equal(isStyleSelectable(style), true);
      assert.equal(style.visualRecipe, "stickman_doodle_explainer");
    } else {
      assert.equal(isStyleSelectable(style), false);
      assert.equal(style.visualRecipe, null);
      assert.equal(style.recipeVersion, null);
    }
  }
});

test("every style has a distinct previewAssetUrl at the /images/styles/<slug>.webp static convention, and a real file exists on disk for all 10", async () => {
  const { VISUAL_STYLES } = await import("../src/pages/workspace/long-form/visualStyles.js");
  const { existsSync, statSync } = await import("node:fs");
  const urls = new Set();
  for (const style of VISUAL_STYLES) {
    assert.match(style.previewAssetUrl, /^\/images\/styles\/[a-z0-9_]+\.webp$/);
    assert.equal(urls.has(style.previewAssetUrl), false, `duplicate preview URL for ${style.id}`);
    urls.add(style.previewAssetUrl);
    const onDisk = new URL(`../public${style.previewAssetUrl}`, import.meta.url);
    assert.ok(existsSync(onDisk), `expected a real file at public${style.previewAssetUrl}`);
    assert.ok(statSync(onDisk).size > 1000, `${style.id}'s preview file looks empty/corrupt`);
  }
});

test("niches.js: recommended-style rankings never restrict selection — every referenced style id is real, and niche ids stay stable/machine-readable", async () => {
  const { ALL_NICHES, RECOMMENDED_STYLES_BY_NICHE, DEFAULT_RECOMMENDED_STYLE_ORDER } = await import("../src/pages/workspace/long-form/niches.js");
  const { VISUAL_STYLES } = await import("../src/pages/workspace/long-form/visualStyles.js");
  const validStyleIds = new Set(VISUAL_STYLES.map((s) => s.id));
  for (const id of DEFAULT_RECOMMENDED_STYLE_ORDER) assert.ok(validStyleIds.has(id));
  for (const [nicheId, styleIds] of Object.entries(RECOMMENDED_STYLES_BY_NICHE)) {
    assert.ok(ALL_NICHES.some((n) => n.id === nicheId), `${nicheId} must be a real niche id`);
    for (const styleId of styleIds) assert.ok(validStyleIds.has(styleId), `${styleId} referenced by ${nicheId} must be a real style id`);
  }
  // Every real niche id is a stable lowercase_snake_case machine key, never a display label.
  for (const niche of ALL_NICHES) assert.match(niche.id, /^[a-z0-9_]+$/);
});

test("generate-style-preview-asset never creates a jobs row or charges credits — it's an internal product-asset generator, not a user generation path", async () => {
  const text = await source("supabase/functions/generate-style-preview-asset/index.ts");
  assert.doesNotMatch(text, /from\("jobs"\)|charge_|credits_charged|deduct/i);
});

test("nicheHint threads through to the real idea-generation prompt as free-text context, never validated against the closed CATEGORY_VALUES enum", async () => {
  const engineText = await source("src/pages/workspace/long-form/ideaEngine.js");
  assert.match(engineText, /nicheHint/);
  const fnText = await source("supabase/functions/generate-long-form-ideas/index.ts");
  assert.match(fnText, /NICHE FOCUS/);
  assert.match(fnText, /nicheHint\?: string/);
});

test("quote-long-form-project is pure computation — it never touches the database (no createClient, no .from(), no service-role key)", async () => {
  const text = await source("supabase/functions/quote-long-form-project/index.ts");
  assert.doesNotMatch(text, /createClient|\.from\(/);
  assert.match(text, /estimateLongFormProjectQuote/);
});

test("get-long-form-project-profile and update-long-form-narration-voice both verify project ownership before returning/changing anything", async () => {
  for (const fn of ["get-long-form-project-profile", "update-long-form-narration-voice"]) {
    const text = await source(`supabase/functions/${fn}/index.ts`);
    assert.match(text, /project\.user_id !== user\.id/, `${fn} must check ownership`);
    assert.match(text, /requireUser\(req\)/, `${fn} must require auth`);
  }
});

test("update-long-form-narration-voice only ever writes voice_id/voice_model — it cannot be used to change render_tier or target_duration_minutes behind the frozen reservation's back", async () => {
  const text = await source("supabase/functions/update-long-form-narration-voice/index.ts");
  const updateCall = text.match(/\.update\(\{[^}]*\}\)/)?.[0] ?? "";
  assert.match(updateCall, /voice_id/);
  assert.match(updateCall, /voice_model/);
  assert.doesNotMatch(updateCall, /render_tier|target_duration_minutes/);
});

test("none of the three new edge functions call any image/video provider", async () => {
  for (const fn of ["get-long-form-project-profile", "quote-long-form-project", "update-long-form-narration-voice"]) {
    const text = await source(`supabase/functions/${fn}/index.ts`);
    assert.doesNotMatch(text, /runware|kling|elevenlabs/i);
  }
});
