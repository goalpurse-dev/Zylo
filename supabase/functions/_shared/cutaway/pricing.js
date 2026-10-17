// Cutaway Explainer: models, our costs and the credit prices, in one place.
//
// The user pays 2x our real cost, rounded up to whole credits (same basis as
// the other templates: Starter = EUR 18 for 750 credits, ECB rate 0.894).
// The credits here must match the tool_prices rows in
// supabase/migrations/20261106100000_cutaway_explainer.sql
// (tests/cutawayPricing.test.mjs holds the two together).
// Cutaway only: no other template imports this file.

export const BASIS = Object.freeze({ markup: 2, eurPerCredit: 18 / 750, eurPerUsd: 0.894 });
export const USD_PER_CREDIT = BASIS.eurPerCredit / BASIS.eurPerUsd; // ~0.02685

export const MODELS = Object.freeze({
  llm: Object.freeze({ provider: "anthropic", model: "claude-sonnet-5" }),
  // Wide images (master + story states as edits of the previous one) and close-up edits.
  image: Object.freeze({ air: "google:nano-banana@2-lite", width: 768, height: 1376, maxReferenceImages: 14 }),
  // Faithful upscale of a crop before it is used as a keyframe.
  upscale: Object.freeze({ air: "runware:504@1" }),
  // First + last frame clips. Duration: whole seconds 1-20 (Runware docs, 2026-10-17).
  // With frameImages the size comes from the stills (9:16 -> 704x1280); width/height are refused.
  clip: Object.freeze({ air: "prunaai:p-video@2", resolution: "720p", fps: 24, minSec: 1, maxSec: 20, promptMax: 2000 }),
  // Josh (the measured voice), fastest model; speed 1.2 is ElevenLabs' maximum.
  // The stitch speeds the voice up further (atempo) to reach the target pace.
  voice: Object.freeze({ voiceId: "TxGEqnHWrfWFTfGW9XjX", model: "eleven_flash_v2_5", speed: 1.2 }),
});

/** What one unit costs us (USD). Measured where a source is given. */
export const COSTS = Object.freeze({
  llmPlanUsd: 0.06,          // one planning call, ~6k in / ~4k out on claude-sonnet-5, rounded up
  ttsUsd: 0.02,              // ~300 characters on eleven_flash_v2_5, rounded up
  imageUsd: 0.0344,          // Nano Banana 2 Lite 768x1376 (measured in Blocky, pricing.js PICTURE)
  upscaleUsd: 0.002,         // runware:504@1, rounded up from the Stickman figure ($0.0006)
  clipUsdPerSec: 0.0252,     // p-video@2 720p (measured in Blocky: $0.151 for 6 s)
  renderUsd: 0.01,           // one performance-4x Fly machine for ~2 min, rounded up
});

export const LENGTHS = Object.freeze([15, 30]);

/** How much work one video of `lengthSec` is, as planned (beats of ~3 s). */
export function workFor(lengthSec) {
  const beats = Math.round(lengthSec / 3);
  return {
    beats,
    wideImages: lengthSec >= 30 ? 5 : 4,      // master + story states
    keyframes: beats + 1,
    keyframeEdits: Math.ceil((beats + 1) / 2), // about half the keyframes need a close-up edit
    clipSeconds: lengthSec,
  };
}

const credits = (usd) => Math.ceil((usd * BASIS.markup) / USD_PER_CREDIT);

/** Step 1 (on Generate): plan + voice + the wide images. */
export function planCostUsd(lengthSec) {
  const w = workFor(lengthSec);
  return COSTS.llmPlanUsd + COSTS.ttsUsd + w.wideImages * COSTS.imageUsd;
}

/** Step 2 (on "Looks good -> make video"): keyframes + clips + the stitch. */
export function videoCostUsd(lengthSec) {
  const w = workFor(lengthSec);
  return w.keyframes * COSTS.upscaleUsd + w.keyframeEdits * COSTS.imageUsd + w.clipSeconds * COSTS.clipUsdPerSec + COSTS.renderUsd;
}

/** The credit prices the user is charged (tool_prices rows). */
export const PRICES = Object.freeze({
  // One flat row per length: cutaway:plan-15, cutaway:plan-30.
  plan: Object.freeze({ toolKey: (s) => `cutaway:plan-${s}`, byLength: Object.freeze(Object.fromEntries(LENGTHS.map((s) => [s, credits(planCostUsd(s))]))) }),
  // One per-second row (2.5 credits/s, durations 15 and 30).
  video: Object.freeze({ toolKey: () => "cutaway:video", creditsPerSecond: 2.5, byLength: Object.freeze(Object.fromEntries(LENGTHS.map((s) => [s, credits(videoCostUsd(s))]))) }),
  regenerate: Object.freeze({ toolKey: () => "cutaway:image", credits: credits(COSTS.imageUsd) }),
});

/** The rows for public.tool_prices, as the migration writes them. */
export const PRICE_ROWS = Object.freeze([
  ...LENGTHS.map((s) => ({ tool_key: PRICES.plan.toolKey(s), flat_credits: PRICES.plan.byLength[s], credits_per_second: null, allowed_durations: null })),
  { tool_key: "cutaway:video", flat_credits: null, credits_per_second: PRICES.video.creditsPerSecond, allowed_durations: [...LENGTHS] },
  { tool_key: "cutaway:image", flat_credits: PRICES.regenerate.credits, credits_per_second: null, allowed_durations: null },
]);

export function totalCredits(lengthSec) {
  return PRICES.plan.byLength[lengthSec] + PRICES.video.byLength[lengthSec];
}
