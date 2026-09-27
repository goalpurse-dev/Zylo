import { supabase } from "../../../lib/supabaseClient";

// estimateLongFormSceneCredits — the ONE authoritative price the Generate
// workspace displays. It is a thin wrapper around estimate_long_form_
// episode_credits (SQL, supabase/migrations/20260930160000_long_form_scene_
// generation_pricing.sql) — a pure, side-effect-free function that
// categorizes every VisualBeat in the project's CURRENT visual plan by its
// own already-decided renderMethod and prices it against the selected
// tier. This is the SAME function charge_long_form_episode_generation calls
// server-side before ever touching a credit balance, so the number shown
// here and the number actually charged can never drift apart — there is
// exactly one place this math lives, not a duplicated client-side estimate.
export async function estimateLongFormSceneCredits(projectId, tier) {
  const { data, error } = await supabase.rpc("estimate_long_form_episode_credits", { p_project_id: projectId, p_tier: tier });
  if (error) throw error;
  return {
    totalCredits: data.totalCredits,
    tier: data.tier,
    creditsPerFreshGeneration: data.creditsPerFreshGeneration,
    creditsPerEdit: data.creditsPerEdit,
    breakdown: {
      freshGenerations: data.breakdown.freshGenerations,
      edits: data.breakdown.edits,
      reused: data.breakdown.reused,
      crops: data.breakdown.crops,
      graphics: data.breakdown.graphics,
    },
  };
}

// Read-only authoritative Generate-page state. The Edge function runs the
// exact compiler preflight used by charging, then asks Postgres for the
// episode or next-chapter outstanding-work quote. React never rebuilds
// readiness or pricing from historical rows.
export async function quoteLongFormGeneration(projectId, tier, chapterMode = false) {
  const { data, error } = await supabase.functions.invoke("quote-long-form-generation", { body: { projectId, tier, chapterMode } });
  if (error) {
    const context = error?.context;
    let payload = null;
    try { payload = context && typeof context.json === "function" ? await context.json() : null; } catch { payload = null; }
    throw new Error(payload?.error || "Couldn't load the generation quote.");
  }
  return data;
}

// estimateSceneOperationCredits — the ONE authoritative per-scene-operation
// price (Regenerate / Edit Scene buttons in the scene modal). Thin wrapper
// around estimate_scene_operation_credits (SQL, supabase/migrations/
// 20260930190000_long_form_scene_operation_pricing.sql), the SAME function
// retry_long_form_scene/edit_long_form_scene consult before actually
// charging — so the badge shown on a button and the amount really debited
// can never drift apart. Read-only, no provider call, safe to call on
// every scene modal open.
export async function estimateSceneOperationCredits(sceneId, operation) {
  const { data, error } = await supabase.rpc("estimate_scene_operation_credits", { p_scene_id: sceneId, p_operation: operation });
  if (error) throw error;
  return { credits: data.credits, tier: data.tier, operation: data.operation, model: data.model, freeRetry: Boolean(data.freeRetry) };
}

// User-facing tier catalog — mirrors supabase/functions/_shared/
// sceneRendererTiers.ts's SCENE_TIER_LABELS/SCENE_TIER_PRIMARY_TOOL_KEY in
// spirit (same disclosed cross-runtime duplication this codebase already
// uses for stylePresets.js). Never expose the raw provider tool_key
// (image:kling.o3, etc.) OR the underlying provider/model name (Kling,
// Qwen, Seedream, FLUX, Runware) in the UI — these display fields (name/
// quality/tagline/description) are the ONLY thing a user ever sees. The
// provider/model mapping stays entirely inside sceneRendererTiers.ts.
export const SCENE_GENERATION_TIERS = [
  { id: "v2", name: "V2", quality: "Fast", tagline: "Lowest cost", description: "Fastest turnaround — a good pick for drafting a full episode cheaply." },
  { id: "v3", name: "V3", quality: "High Quality", tagline: "Recommended", description: "The main Long Form scene renderer — the best balance of quality and cost." },
  { id: "v4", name: "V4", quality: "Ultra", tagline: "Premium", description: "The highest-fidelity renderer for a premium episode." },
];
export const DEFAULT_SCENE_GENERATION_TIER = "v3";
