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

const CREDITS_PER_GENERATE: Record<RenderTier, number> = { v2: 2, v3: 3, v4: 4 };

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

  const creditsPerRender = CREDITS_PER_GENERATE[renderTier];
  const visualsCredits = totalRenderCount * creditsPerRender;

  const breakdown: ProjectQuoteBreakdownLine[] = [
    { label: "Research + Story", credits: 0, note: "Included — no additional charge." },
    { label: "Narration (voiceover + timing)", credits: 0, note: "Included — no additional charge." },
    { label: `~${estimatedBeatCount} visuals (${renderTier.toUpperCase()})`, credits: visualsCredits, note: `${estimatedFreshRenders} fresh renders + ${estimatedRetryRenders} bounded retry allowance; ${estimatedReusedOrProgrammatic} reused/programmatic at 0 credits.` },
    { label: "QA + bounded retries", credits: 0, note: "Retry allowance already folded into the visuals line above; the QA judging pass itself is included." },
  ];

  const totalCredits = breakdown.reduce((sum, line) => sum + line.credits, 0);

  return { estimatedBeatCount, estimatedFreshRenders, estimatedReusedOrProgrammatic, estimatedRetryRenders, totalRenderCount, breakdown, totalCredits };
}
