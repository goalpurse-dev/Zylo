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

// ---------- the 3D video: one price per video, premade or custom (the owner's credit rule, 2026-10-24) ----------
// ONE PLACE for the price: when our costs change, change MEASURED (and RUNTIME_RATES) and re-run the tests; the
// migration's tool_prices rows must match PRICE_ROWS (tests/cutaway.test.mjs holds them together).
//
// The rule: 1 credit = $0.01 of OUR cost. The user pays $0.02 a credit, so the price is always 2x our cost.
//   credits for a video = our full real cost of one delivered video in USD / $0.01, rounded up.
// "Full real cost" counts everything: the planning, the voice (and its word check's second take), the checks, the post
// text, the GPU (it waits on the planner, then renders), storage, AND the attempts that fail and are refunded: each
// delivered video carries (1 - pass rate) / pass rate of a failed attempt.
//   premade: a topic with an owner-approved layout (cutaway_layouts.approved): the scene is reused, the script is new,
//            only the changed sentences are checked
//   custom:  a new layout: the script and its fact-check, the scene plan, the solver, the preview gate with repairs
export const MODELS_3D = Object.freeze({ planner: "claude-sonnet-5-5", strong: "claude-opus-5-5", small: "claude-haiku-5-5", kitCheck: "claude-haiku-5-5" });
export const CREDIT = Object.freeze({ ourUsd: 0.01, userUsd: 0.02 });

/** what the provider time costs us (USD a second): the RunPod 16 GB tier, a Fly performance-8x machine */
export const RUNTIME_RATES = Object.freeze({ runpodUsdPerSec: 0.00016, flyUsdPerSec: 0.0000957 });

/**
 * Our cost per attempt, by kind and length (USD), and the pass rate, MEASURED (sources in each note). attempt: what one
 * attempt that delivers costs; failed: what one that fails costs us on average (it stops early, before the render).
 */
export const MEASURED = Object.freeze({
  premade: Object.freeze({
    30: Object.freeze({ attempt: { script: 0.09, voice: 0.05, checks: 0.04, post: 0.002, gpu: 0.05, storage: 0.002 }, failed: 0.15, passRate: 0.95 }),
    60: Object.freeze({ attempt: { script: 0.13, voice: 0.1, checks: 0.06, post: 0.002, gpu: 0.09, storage: 0.004 }, failed: 0.22, passRate: 0.95 }),
  }),
  custom: Object.freeze({
    // plan: measured 2026-10-24 on 8 topics, at the live (not batch) price: script $0.046 + fact research $0.112 +
    // fact-check $0.026 + scene plan $0.215 + scene repair $0.130 = $0.53. checks: the car wash's two preview checks
    // ($0.22 and $0.13). passRate: still the estimate (no topic has run the whole path in production yet)
    // design (2026-10-26): a part the kit lacks, designed from building blocks: the NEW PARTS instructions (~1,400 tokens
    // in, twice: plan and repair, $0.008) and the recipe written out (~1,000 tokens out, twice, $0.03); counted on every
    // custom video (most topics design one) and on its failed attempts
    30: Object.freeze({ attempt: { plan: 0.53, design: 0.04, voice: 0.05, checks: 0.18, post: 0.002, kitCheck: 0.0005, gpu: 0.09, storage: 0.002 }, failed: 0.69, passRate: 0.6 }),
    60: Object.freeze({ attempt: { plan: 0.78, design: 0.05, voice: 0.1, checks: 0.24, post: 0.002, kitCheck: 0.0005, gpu: 0.14, storage: 0.004 }, failed: 0.95, passRate: 0.6 }),
  }),
});
export const KINDS = Object.freeze(["premade", "custom"]);

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
/** our full real cost of one delivered video (USD): its attempt plus its share of the failed attempts we refund */
export function fullCostUsd(kind, lengthSec) {
  const m = MEASURED[kind]?.[lengthSec];
  if (!m) throw new Error(`no Cutaway cost for ${kind} ${lengthSec} s`);
  return Number((sum(m.attempt) + (m.failed * (1 - m.passRate)) / m.passRate).toFixed(4));
}
/** what one attempt is expected to cost us: the caps check this before a start (guard.js) */
export const costBasisUsd = (kind, lengthSec) => Number(sum(MEASURED[kind][lengthSec].attempt).toFixed(4));

/** The credit prices the user is charged (tool_prices rows). */
export const PRICES = Object.freeze({
  // One flat row per kind and length: cutaway:premade-30, cutaway:premade-60, cutaway:custom-30, cutaway:custom-60.
  video: Object.freeze({
    toolKey: (kind, s) => `cutaway:${kind}-${s}`,
    credits: Object.freeze(Object.fromEntries(KINDS.map((k) => [k, Object.freeze(Object.fromEntries(LENGTHS.map((s) => [s, Math.ceil(fullCostUsd(k, s) / CREDIT.ourUsd - 1e-9)])))]))),
  }),
});

/** Credits for one video: the server charges this, from the topic it classified itself (topics.js). */
export function videoCredits(kind, lengthSec) {
  const c = PRICES.video.credits[kind]?.[lengthSec];
  if (!Number.isInteger(c)) throw new Error(`no Cutaway price for ${kind} ${lengthSec} s`);
  return c;
}

/** The rows for public.tool_prices, as the migration writes them. */
export const PRICE_ROWS = Object.freeze(KINDS.flatMap((k) => LENGTHS.map((s) => ({ tool_key: PRICES.video.toolKey(k, s), flat_credits: PRICES.video.credits[k][s], credits_per_second: null, allowed_durations: null }))));
