// productionProfile.js — 2026-10-02 "make the new flow real in the product"
// pass. Client for the read-only get-long-form-project-profile endpoint (see
// that function's own comment for why a direct table read isn't possible)
// plus the pure helpers every recipe-aware page/component uses to decide
// "is this a new Stickman-flow project, or a legacy one" — the ONLY signal
// that decision is allowed to depend on (never a project column, never a
// route guess), so Atlantis and every other pre-existing project keeps
// showing the old 5-stage Idea/Story/Look/Generate/Edit flow unchanged.
import { supabase } from "../../../lib/supabaseClient";

export { STICKMAN_RECIPE, STICKMAN_RECIPE_VERSION, isStickmanRecipeProfile } from "./recipe";

export async function fetchActiveGenerationProfile(projectId) {
  if (!projectId) return null;
  const { data, error } = await supabase.functions.invoke("get-long-form-project-profile", { body: { projectId } });
  if (error || !data?.ok) return null;
  return data.profile;
}

// Deno's estimateLongFormProjectQuote is the only source of truth for the
// actual number reserved — this is just a live PREVIEW of that same
// computation, shown before any commitment exists (see quote-long-form-project).
export async function fetchProjectQuote({ recipeVersion, renderTier, targetDurationMinutes }) {
  const { data, error } = await supabase.functions.invoke("quote-long-form-project", { body: { recipeVersion, renderTier, targetDurationMinutes } });
  if (error || typeof data?.totalCredits !== "number") return null;
  return data;
}

// The real commitment: freezes the Production Profile snapshot and reserves
// credits against it, all in one idempotent server call (see
// create-long-form-production-setup's own header comment). Only ever called
// once per project — a second call with the same profile settings for a
// project that already has an active reservation is a no-op reservation
// read-back, never a double reserve.
export async function createProductionSetup({
  projectId,
  visualRecipe,
  recipeVersion,
  renderTier,
  targetDurationMinutes,
  researchDepth,
  explanationDepth,
  voiceProvider,
  voiceId,
  voiceModel,
  pacingProfile,
  niche,
}) {
  const { data, error } = await supabase.functions.invoke("create-long-form-production-setup", {
    body: { projectId, visualRecipe, recipeVersion, renderTier, targetDurationMinutes, researchDepth, explanationDepth, voiceProvider, voiceId, voiceModel, pacingProfile, niche },
  });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, status: context?.status ?? 500, message: payload?.error ?? "Couldn't reserve credits for this video.", quote: payload?.quote ?? null };
  }
  return { ok: true, ...data };
}
