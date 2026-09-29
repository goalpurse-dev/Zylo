// deno-lint-ignore-file no-explicit-any
// longFormProjectQuote.ts — 2026-10-02 "one project commitment" pass,
// Section 6/9.
//
// Deterministic, zero-provider-cost estimate of a WHOLE project's expected
// cost at Setup time, before script/TTS/Beat Director exist and the real
// beat count is known. This is the number shown on the single "CREATE VIDEO
// · N credits" commitment and the amount reserve_long_form_project_credits
// actually reserves — it must be a real, defensible upper bound, never a
// guess dressed up as one.
//
// Recipe-agnostic by construction: beatsPerMinute (the pacing density) is a
// parameter supplied by whichever recipe is selected, never hardcoded here.
// Confirmed real pricing (this session's own renderer/pricing audit):
// GENERATE v2=2cr / v3=3cr / v4=4cr; REUSE/PROGRAMMATIC_GRAPHIC=0cr.

export type RenderTier = "v2" | "v3" | "v4";

const CREDITS_PER_GENERATE: Record<RenderTier, number> = { v2: 1, v3: 4, v4: 5 };
// Phase 7: the video is a FIXED price per minute (~2x our real cost incl. overhead,
// at the cheapest $/credit we sell) — see docs/phase7/pricing-proposal.md.
export const CREDITS_PER_MINUTE: Record<RenderTier, number> = { v2: 25, v3: 75, v4: 90 };

export type ProjectQuoteInput = {
  targetDurationMinutes: number;
  renderTier: RenderTier;
  // The recipe's own pacing density — e.g. Stickman targets 3-5 seconds per
  // beat (this session's Stickman Beat Director audit), a midpoint of ~4s
  // yields 15 beats/minute. A future recipe with a different rhythm supplies
  // its own value; this function never assumes one.
  beatsPerMinute: number;
  // The fraction of beats expected to resolve as REUSE/PROGRAMMATIC_GRAPHIC
  // (zero-cost) rather than a fresh GENERATE — a real, disclosed assumption,
  // not a hidden one. Defaults to 0.12, matching the prior Stickman cost
  // model's own render-mix assumption.
  reuseShare?: number;
  // Bounded retry allowance as a fraction of fresh renders — matches the
  // existing recipe QA design's "retries may not exceed ~20% of beats"
  // ceiling; defaulted lower (0.15) since not every fresh render retries.
  retryUpliftShare?: number;
};

export type ProjectQuoteBreakdownLine = { label: string; credits: number; note: string };

export type ProjectQuote = {
  estimatedBeatCount: number;
  estimatedFreshRenders: number;
  estimatedReusedOrProgrammatic: number;
  estimatedRetryRenders: number;
  totalRenderCount: number;
  breakdown: ProjectQuoteBreakdownLine[];
  totalCredits: number;
};

// Every line item the user's quote shows, even the ones currently absorbed
// by Zyvo at $0 — Section 9: "the PRODUCT quote shown to the user must
// represent the full expected user charge," which means being explicit
// about what's included at no extra cost, never silently omitting a real
// pipeline stage from the picture.
export function estimateLongFormProjectQuote(input: ProjectQuoteInput): ProjectQuote {
  const { targetDurationMinutes, renderTier, beatsPerMinute } = input;
  if (targetDurationMinutes <= 0) throw new Error("INVALID_TARGET_DURATION");
  if (beatsPerMinute <= 0) throw new Error("INVALID_PACING_DENSITY");
  const reuseShare = input.reuseShare ?? 0.12;
  const retryUpliftShare = input.retryUpliftShare ?? 0.15;

  const estimatedBeatCount = Math.round(targetDurationMinutes * beatsPerMinute);
  const estimatedReusedOrProgrammatic = Math.round(estimatedBeatCount * reuseShare);
  const estimatedFreshRenders = estimatedBeatCount - estimatedReusedOrProgrammatic;
  const estimatedRetryRenders = Math.round(estimatedFreshRenders * retryUpliftShare);
  const totalRenderCount = estimatedFreshRenders + estimatedRetryRenders;

  void CREDITS_PER_GENERATE; // per-scene prices now apply to scene REGENERATE only (stickman/scenes.ts)
  const videoCredits = Math.ceil(CREDITS_PER_MINUTE[renderTier] * targetDurationMinutes);

  const breakdown: ProjectQuoteBreakdownLine[] = [
    { label: `${targetDurationMinutes}-min video (${renderTier.toUpperCase()})`, credits: videoCredits, note: `${CREDITS_PER_MINUTE[renderTier]} credits per minute — a fixed price: research, script, ~${estimatedBeatCount} scenes with QA and retries, voiceover, 1080p render, 3 thumbnails and the YouTube text are all included.` },
  ];

  const totalCredits = breakdown.reduce((sum, line) => sum + line.credits, 0);

  return { estimatedBeatCount, estimatedFreshRenders, estimatedReusedOrProgrammatic, estimatedRetryRenders, totalRenderCount, breakdown, totalCredits };
}
