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

// ---------- the 3D video: one price per video, premade or custom (research/seamless-niche/M2_PLAN.md, section 4) ----------
// Our cost per video (USD), from the M2 plan's figures: Claude Opus 5.5 at $4/$20 per 1M tokens, web search $0.01
// a search, Eric ~$0.045 per 30 s, new sound effects $0.007-0.03, a GPU render ~$0.03 per 30 s (M3 to confirm).
//  premade: a saved layout and saved facts: script, timeline + one repair round, the preview-frame vision check,
//    voice, render. A premade topic without a saved layout yet (septic, pool, well, road, gutter, sewer) is charged
//    the same: we absorb its first build (about the custom cost), and its layout is saved for everyone after it.
//  custom: a new layout: the same steps plus the fact-check and the scene plan, planned with Claude Sonnet 5.5
//    (about half the Opus cost), plus a 20% buffer for the plans that fail the checks and are re-planned on Opus,
//    plus the kit check (Haiku 5.5, ~$0.0005).
export const MODELS_3D = Object.freeze({ premade: "claude-opus-5-5", custom: "claude-sonnet-5-5", customFallback: "claude-opus-5-5", kitCheck: "claude-haiku-5-5" });
export const COSTS_3D = Object.freeze({
  premade: Object.freeze({ 30: 0.38, 60: 0.59 }),
  custom: Object.freeze({ 30: Number((0.52 * 1.2 + 0.0005).toFixed(4)), 60: Number((0.755 * 1.2 + 0.0005).toFixed(4)) }),
});
// 2.5-3x our cost (owner, 2026-10-21): 2.8x, rounded up to whole credits.
export const MARKUP_3D = 2.8;
const credits3d = (usd) => Math.ceil((usd * MARKUP_3D) / USD_PER_CREDIT);
export const KINDS = Object.freeze(["premade", "custom"]);

/** The credit prices the user is charged (tool_prices rows). */
export const PRICES = Object.freeze({
  // One flat row per kind and length: cutaway:premade-30, cutaway:premade-60, cutaway:custom-30, cutaway:custom-60.
  video: Object.freeze({
    toolKey: (kind, s) => `cutaway:${kind}-${s}`,
    credits: Object.freeze(Object.fromEntries(KINDS.map((k) => [k, Object.freeze(Object.fromEntries(LENGTHS.map((s) => [s, credits3d(COSTS_3D[k][s])])))]))),
  }),
  // The old AI-video pipeline's "regenerate one wide image" (still in the engine until M2 replaces it).
  regenerate: Object.freeze({ toolKey: () => "cutaway:image", credits: credits(COSTS.imageUsd + COSTS.visionUsd) }),
});

/** Credits for one video: the server charges this, from the topic it classified itself (topics.js). */
export function videoCredits(kind, lengthSec) {
  const c = PRICES.video.credits[kind]?.[lengthSec];
  if (!Number.isInteger(c)) throw new Error(`no Cutaway price for ${kind} ${lengthSec} s`);
  return c;
}

/** The rows for public.tool_prices, as the migration writes them. */
export const PRICE_ROWS = Object.freeze([
  ...KINDS.flatMap((k) => LENGTHS.map((s) => ({ tool_key: PRICES.video.toolKey(k, s), flat_credits: PRICES.video.credits[k][s], credits_per_second: null, allowed_durations: null }))),
  { tool_key: "cutaway:image", flat_credits: PRICES.regenerate.credits, credits_per_second: null, allowed_durations: null },
]);
