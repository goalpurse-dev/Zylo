// recipe.js — 2026-10-02 "make the new flow real in the product" pass.
// Deliberately the ONLY pure module in this pair (productionProfile.js holds
// everything that talks to Supabase). Kept separate so this file can be
// imported directly by plain-Node tests (see longFormRecipeAwareFlow.test.mjs)
// without pulling in supabaseClient.ts, which relies on Vite's import.meta.env
// and has no plain-Node equivalent — the same reason this codebase already
// keeps pure logic (visualWorldPlanning.js) separate from its Supabase-backed
// siblings elsewhere in Long Form.
export const STICKMAN_RECIPE = "stickman_doodle_explainer";
export const STICKMAN_RECIPE_VERSION = "STICKMAN_DOODLE_EXPLAINER_V1";

export function isStickmanRecipeProfile(profile) {
  return profile?.visual_recipe === STICKMAN_RECIPE;
}
