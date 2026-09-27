// sceneGenerationPricing.ts — pure per-tier credit-cost mirror of the SQL
// pricing functions (long_form_tier_generate_credits / long_form_tier_edit_
// credits in 20260930160000_long_form_scene_generation_pricing.sql, kept
// current by 20260930180000/20260930190000). Same disclosed duplication
// pattern this codebase already uses for stylePresets.js mirroring
// visualWorldStyle.ts — Postgres cannot import a Deno module, so a read-only
// JS-side estimate (e.g. a sample-scene quote shown before any charge
// exists) mirrors the authoritative SQL by hand rather than calling it.
// NEVER the source of truth for an actual charge — every real charge is
// still computed and enforced by the SQL RPC alone.

// Phase 0, Section C.4 — this mirror had gone stale (v4 was 5, edit was 2)
// relative to the REAL, live SQL functions, which a direct query against the
// linked database confirmed return v2=2/v3=3/v4=4 (long_form_tier_generate_
// credits, latest definition in 20260930180000) and 1 for every tier
// (long_form_tier_edit_credits, latest definition in 20260930190000) — the
// exact same values src/lib/providers.ts's image:flux2.klein9bkv/kling.o3/
// seedream5lite/qwen.image-edit-plus entries already use. There was never a
// real disagreement between the two BILLING-authoritative sources (SQL and
// providers.ts always agreed); only this disclosed-non-authoritative
// estimate mirror had drifted. See tests/productionSetupUxRework.test.mjs's
// "scene pricing mirror matches the latest SQL + providers.ts" test, which
// now fails loudly if this ever happens again.
export function tierGenerateCredits(tier: string): number {
  return tier === "v2" ? 2 : tier === "v4" ? 4 : 3;
}

export function tierEditCredits(_tier: string): number {
  return 1;
}

export function estimatedCreditsForRenderStrategy(renderStrategy: string, tier: string): number {
  if (renderStrategy === "GENERATE") return tierGenerateCredits(tier);
  if (renderStrategy === "EDIT") return tierEditCredits(tier);
  return 0;
}
