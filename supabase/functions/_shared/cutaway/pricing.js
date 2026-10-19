// Cutaway Explainer: models, our costs and the credit prices, in one place.
//
// The user pays 2x our real cost, rounded up to whole credits (same basis as
// the other templates: Starter = EUR 18 for 750 credits, ECB rate 0.894).
// The credits here must match the tool_prices rows in
// supabase/migrations/20261106100000_cutaway_explainer.sql
// (tests/cutaway.test.mjs holds the two together).
// Cutaway only: no other template imports this file.

export const BASIS = Object.freeze({ markup: 2, eurPerCredit: 18 / 750, eurPerUsd: 0.894 });
export const USD_PER_CREDIT = BASIS.eurPerCredit / BASIS.eurPerUsd; // ~0.02685

export const MODELS = Object.freeze({
  // Planner, critic and the vision check on the wide images.
  llm: Object.freeze({ provider: "anthropic", model: "claude-sonnet-5" }),
  // Wide images (master + story states as edits of the previous one) and close-up edits.
  image: Object.freeze({ air: "google:nano-banana@2-lite", width: 768, height: 1376, maxReferenceImages: 14 }),
  // Faithful upscale of a crop before it is used as a keyframe.
  upscale: Object.freeze({ air: "runware:504@1" }),
  // First + last frame clips. Duration: whole seconds 1-20 (Runware docs, 2026-10-17).
  // With frameImages the size comes from the stills (9:16 -> 704x1280); width/height are refused.
  clip: Object.freeze({ air: "prunaai:p-video@2", resolution: "720p", fps: 24, minSec: 1, maxSec: 20, promptMax: 2000 }),
  // The voice speaks at its own pace: never sped up in the stitch (owner, 2026-10-19), ElevenLabs speed <= 1.1.
  // wpm = the voice's measured pace; the planner sizes the script to it. voiceId: the owner's pick of voice A/B/C.
  voice: Object.freeze({ voiceId: "TxGEqnHWrfWFTfGW9XjX", model: "eleven_flash_v2_5", speed: 1.0, maxSpeed: 1.1, wpm: 170 }),
  // Sound effects (ElevenLabs text-to-sound), cached by cue so a repeat costs nothing.
  sfx: Object.freeze({ provider: "elevenlabs", promptInfluence: 0.5 }),
});

/** What one unit costs us (USD). Measured where a source is given. */
export const COSTS = Object.freeze({
  llmPlanUsd: 0.08,          // one planning call (~7k in / ~6k out on claude-sonnet-5), rounded up
  llmCriticUsd: 0.08,        // one critic call (the plan in, a revised plan out)
  visionUsd: 0.01,           // one image check (~1.6k image tokens + the checklist)
  ttsUsd: 0.03,              // ~600 characters on eleven_flash_v2_5, rounded up
  imageUsd: 0.0344,          // Nano Banana 2 Lite 768x1376 (measured in Blocky; test 2: $0.034)
  upscaleUsd: 0.002,         // runware:504@1 (test 2: about $0.001 each)
  clipUsdPerSec: 0.0252,     // p-video@2 720p (measured: $0.43 for 17 s in test 2)
  sfxUsdPerSec: 0.008,       // ElevenLabs sound effects: 40 credits a second at $0.0002 a credit
  renderUsd: 0.01,           // one performance-4x Fly machine for ~2 min, rounded up
});

export const LENGTHS = Object.freeze([30, 60]);
export const DEFAULT_LENGTH = 30;

/** How much work one video of `lengthSec` is, as planned (beats of ~3 s). */
export function workFor(lengthSec) {
  const beats = Math.round(lengthSec / 3);
  return {
    beats,
    wideImages: lengthSec >= 60 ? 7 : 5,       // master + story states
    keyframes: beats + 1 + Math.ceil(beats / 5), // + about one in five beats routed through a wider frame
    keyframeEdits: Math.ceil((beats + 1) / 2),  // about half the keyframes get a close-up edit
    clipSeconds: lengthSec,
    sfxSeconds: Math.ceil(beats * 0.6) * 2.5,   // about 6 cues in 10 beats, ~2.5 s each, half new (cached after)
  };
}

const credits = (usd) => Math.ceil((usd * BASIS.markup) / USD_PER_CREDIT);

/** Step 1 (on Generate): plan + critic + voice + the wide images and their checks (one regenerate each allowed). */
export function planCostUsd(lengthSec) {
  const w = workFor(lengthSec);
  const images = w.wideImages * 1.4; // vision failures regenerate about 2 in 5
  return COSTS.llmPlanUsd + COSTS.llmCriticUsd + COSTS.ttsUsd * (lengthSec / 30) + images * (COSTS.imageUsd + COSTS.visionUsd);
}

/** Step 2 (on "Looks good -> make video"): keyframes + clips + sound + the stitch. */
export function videoCostUsd(lengthSec) {
  const w = workFor(lengthSec);
  return w.keyframes * COSTS.upscaleUsd + w.keyframeEdits * COSTS.imageUsd + w.clipSeconds * COSTS.clipUsdPerSec + w.sfxSeconds * COSTS.sfxUsdPerSec / 2 + COSTS.renderUsd;
}

const VIDEO_CREDITS_PER_SECOND = 3; // 30 s: 90 credits ($2.42) for ~$1.06 of cost; 60 s: 180 for ~$2.07

/** The credit prices the user is charged (tool_prices rows). */
export const PRICES = Object.freeze({
  // One flat row per length: cutaway:plan-30, cutaway:plan-60.
  plan: Object.freeze({ toolKey: (s) => `cutaway:plan-${s}`, byLength: Object.freeze(Object.fromEntries(LENGTHS.map((s) => [s, credits(planCostUsd(s))]))) }),
  // One per-second row (durations 30 and 60).
  video: Object.freeze({ toolKey: () => "cutaway:video", creditsPerSecond: VIDEO_CREDITS_PER_SECOND, byLength: Object.freeze(Object.fromEntries(LENGTHS.map((s) => [s, Math.ceil(VIDEO_CREDITS_PER_SECOND * s)]))) }),
  regenerate: Object.freeze({ toolKey: () => "cutaway:image", credits: credits(COSTS.imageUsd + COSTS.visionUsd) }),
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
