// ╔════════════════════════════════════════════════════════════════════════╗
// ║ BLOCKY STORIES — MODELS AND PRICES, THE ONE PLACE (decision 73)        ║
// ║                                                                        ║
// ║ Which model makes what, which model is tried next when one fails,      ║
// ║ what each costs US, and what the user pays in credits.                 ║
// ║                                                                        ║
// ║   models.js       reads the models and the fallback chains from here   ║
// ║   spendGuard.js   reads our costs from here (the daily cap)            ║
// ║   the page        reads the tiers from here (pricing/blockyEstimates)  ║
// ║   tool_prices     the database rows the user is CHARGED from must say  ║
// ║                   the same credits as PRICE_ROWS below                 ║
// ║                   (tests/blockyPricing.test.mjs, and the live smoke    ║
// ║                   check compares the real rows)                        ║
// ║                                                                        ║
// ║ Blocky only. AI Fruit Story's models and price rows are its own, and   ║
// ║ none of AI Fruit Story's code imports this file (the same test proves  ║
// ║ it). This file imports nothing. Changing one product can't move the    ║
// ║ other.                                                                 ║
// ║                                                                        ║
// ║ To change a credit price: change it here AND in a migration that       ║
// ║ updates the tool_prices row. The test fails until both say the same.   ║
// ╚════════════════════════════════════════════════════════════════════════╝

const seconds = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * What every credit price is worked out from (owner, 2026-10-08): the user pays 2× our real cost.
 *   eurPerCredit   the Starter plan: €18 for 750 credits. No VAT in it (it will be added on top later).
 *   eurPerUsd      our costs are in dollars: the ECB reference rate of 2026-10-08.
 *   clipChecksUsd  per clip: the words (speech-to-text), the last-frame machine and its check. Measured.
 *   storyOverheadUsd  per story: the final render and the upload text. Measured, rounded up.
 * A price is the smallest whole number of credits (a rate: the smallest step the page can read back) that
 * is at least 2× the cost. tests/blockyPricing.test.mjs holds every price to that.
 */
export const BASIS = Object.freeze({ markup: 2, eurPerCredit: 18 / 750, eurPerUsd: 0.894, clipChecksUsd: 0.0018, storyOverheadUsd: 0.004, scenesPer30s: 6 });

/**
 * The clip models (image-to-video with the scene picture as the first frame, sound made by the model).
 *   air           Runware's model id
 *   request       which request shape the model takes (clips.js#clipTask)
 *   resolution    for models that take a resolution name and their size from the frame image
 *   durations     clip lengths in seconds we ask for (never under 4)
 *   costPerSec    what one second costs us, measured (USD)
 *   camera        the camera wording the model needs (clips.js): "move" follows the shot, "gentle" barely
 *                 moves and keeps everyone in frame, "locked" keeps the first frame's framing
 *   promptMax     the longest prompt the model takes
 */
export const CLIP_MODELS = Object.freeze({
  // Owner's choice for V2 (2026-10-08): the best voice of the three tested and good lip sync, at its native
  // 720p (704×1280 from a 9:16 picture; the final render fills 720×1280). Measured on one 6 s clip: $0.19.
  // At "480p" it cost $0.0217 a second and came back 400×736, clearly softer: the owner chose 720p.
  "grok-1.5-lite": Object.freeze({ name: "Grok Imagine Video 1.5 Lite", air: "xai:grok-imagine@video-1.5-lite", request: "grok", resolution: "720p", durations: seconds(4, 15), costPerSec: 0.0317, camera: "gentle", promptMax: 1500 }),
  // The second try on every tier: another provider, fast (19 s for 6 s), calm camera. Measured: $0.151 for 6 s at 720p (704×1280).
  "p-video-2": Object.freeze({ name: "P-Video-2", air: "prunaai:p-video@2", request: "pvideo", resolution: "720p", durations: seconds(4, 15), costPerSec: 0.0252, camera: "gentle", promptMax: 1500 }),
  // V3. Measured: $0.30 for 6 s at 720p. It re-frames and changes faces unless told not to (camera "locked").
  "veo-3.1-lite": Object.freeze({ name: "Veo 3.1 Lite", air: "google:veo@3.1-lite", request: "veo-lite", durations: Object.freeze([4, 6, 8]), costPerSec: 0.05, camera: "locked", promptMax: 3000 }),
  // V4, unchanged since the first bake-off (2026-09-30): $0.15 a second at 720p.
  "veo-3.1-fast": Object.freeze({ name: "Veo 3.1 Fast", air: "google:3@3", request: "google", durations: Object.freeze([4, 6, 8]), costPerSec: 0.15, camera: "move", promptMax: 3000 }),
});

/**
 * The quality tiers. chain: the model that makes the clip, then the ones tried in turn when a clip fails,
 * times out or comes back with drawn subtitles. The user pays the tier's price whichever model made the clip.
 */
// Credits a second: 2× our real cost (BASIS above), so V2 2.4, V3 3.75 and V4 11.25 (owner, 2026-10-08; they
// were 4, 8 and 16 for a few hours as "option A", and 5, 9 and 16 with the old models). A clip is charged
// CEIL(rate × seconds). Each rate times the length the page quotes it at (V2 5 s, V3 and V4 4 s) is a whole
// number, so the page reads the exact rate back from the server's quote.
export const TIERS = Object.freeze({
  v2: Object.freeze({ toolKey: "video:blocky-story-v2", creditsPerSec: 2.4, minPlan: "starter", chain: Object.freeze(["grok-1.5-lite", "p-video-2"]) }),
  v3: Object.freeze({ toolKey: "video:blocky-story-v3", creditsPerSec: 3.75, minPlan: "pro", chain: Object.freeze(["veo-3.1-lite", "p-video-2"]) }),
  // Two more tries, the last one at another provider: a Google outage never leaves V4 without one.
  v4: Object.freeze({ toolKey: "video:blocky-story-v4", creditsPerSec: 11.25, minPlan: "generative", chain: Object.freeze(["veo-3.1-fast", "veo-3.1-lite", "p-video-2"]) }),
});
export const TIER_IDS = Object.freeze(Object.keys(TIERS));

/** The size a finished clip is priced and delivered at (the final render brings every clip to it). */
export const CLIP_SIZES = Object.freeze({ "9:16": Object.freeze([720, 1280]), "16:9": Object.freeze([1280, 720]) });

/** Scene pictures, edits and regenerations. costUsd is measured; the daily cap counts a rounded-up guardUsd. */
export const PICTURE = Object.freeze({ name: "Nano Banana 2 Lite", air: "google:nano-banana@2-lite", toolKey: "image:blocky-story", credits: 3, costUsd: 0.0344, checkUsd: 0.0018, guardUsd: 0.04 });

/** The script's share of the picture step: three plans, three versions, the polish (decision 69). */
export const SCRIPT = Object.freeze({ toolKey: "script:blocky-story", credits: 13, costUsd: 0.17 });

/**
 * What a paid thing really costs us (USD), with everything that comes with it:
 *   a picture: the picture and its check;
 *   a clip: its seconds on the tier's own model, its checks (the words, the last frame) and its share of the
 *     final render and the upload text;
 *   the script: the plan, the three versions and the polish.
 * Not in here, because no single price can carry them: clips and pictures made twice (a failed check, a
 * fallback model), writing sessions nobody picks, and idea batches.
 */
export const realCostUsd = Object.freeze({
  picture: () => PICTURE.costUsd + PICTURE.checkUsd,
  script: () => SCRIPT.costUsd,
  clip: (tierId, seconds) => CLIP_MODELS[TIERS[tierId].chain[0]].costPerSec * seconds + BASIS.clipChecksUsd + BASIS.storyOverheadUsd / BASIS.scenesPer30s,
  /** A story of `seconds` in clips of `clipSec` each: the script, a picture and a clip per scene. */
  story: (tierId, seconds = 30, clipSec = 5) => { const scenes = Math.round(seconds / clipSec); return SCRIPT.costUsd + scenes * (PICTURE.costUsd + PICTURE.checkUsd) + scenes * realCostUsd.clip(tierId, clipSec); },
});
/** What the user pays for the same things, in credits (the same arithmetic as compute_tool_price). */
export const priceCredits = Object.freeze({
  picture: () => PICTURE.credits,
  script: () => SCRIPT.credits,
  clip: (tierId, seconds) => Math.ceil(TIERS[tierId].creditsPerSec * seconds - 1e-9),
  story: (tierId, seconds = 30, clipSec = 5) => { const scenes = Math.round(seconds / clipSec); return SCRIPT.credits + scenes * PICTURE.credits + scenes * priceCredits.clip(tierId, clipSec); },
});
/** Credits as euros at the basis' credit value, and how many times our real cost a price is. */
export const creditsToEur = (credits, eurPerCredit = BASIS.eurPerCredit) => credits * eurPerCredit;
export const markupOf = (credits, costUsd, eurPerCredit = BASIS.eurPerCredit) => creditsToEur(credits, eurPerCredit) / (costUsd * BASIS.eurPerUsd);

/** The model that makes a tier's clips. */
export const tierModel = (tierId) => CLIP_MODELS[TIERS[tierId]?.chain[0]] ?? null;
export const modelByAir = (air) => Object.values(CLIP_MODELS).find((m) => m.air === air) ?? null;
/** The model tried after this one, or null. Every chain that has a model agrees on what comes next (tested). */
export function nextModel(air) {
  for (const tier of Object.values(TIERS)) {
    const at = tier.chain.findIndex((key) => CLIP_MODELS[key].air === air);
    if (at >= 0 && at < tier.chain.length - 1) return CLIP_MODELS[tier.chain[at + 1]];
  }
  return null;
}
/** The dearest second a tier can cost us: what the daily cap counts before a clip is made. */
export const tierGuardPerSec = (tierId) => Math.max(...TIERS[tierId].chain.map((key) => CLIP_MODELS[key].costPerSec));

/** What the tool_prices rows must say: one row per key, a flat price or a price per second. */
export const PRICE_ROWS = Object.freeze([
  Object.freeze({ toolKey: PICTURE.toolKey, flatCredits: PICTURE.credits, minPlan: "starter" }),
  Object.freeze({ toolKey: SCRIPT.toolKey, flatCredits: SCRIPT.credits, minPlan: "starter" }),
  ...TIER_IDS.map((id) => Object.freeze({ toolKey: TIERS[id].toolKey, creditsPerSecond: TIERS[id].creditsPerSec, minPlan: TIERS[id].minPlan })),
]);
