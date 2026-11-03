// Blocky Worlds: our costs and the credit prices, in one place. Blocky Worlds only.
//
// The rule (the same as Cutaway's, the owner's credit rule of 2026-10-24):
//   1 credit = $0.01 of OUR full real cost; the user pays $0.02 a credit, so the price is always 2x our cost.
//   credits for a video = our full real cost of one delivered video / $0.01, rounded up.
// "Full real cost" counts the writing (idea batches and script rewrites nobody pays for separately), the voice and its
// check, the shot plan, the GPU render, storage, and the attempts that fail and are refunded.
//
// ESTIMATES until the owner's paid tests (2026-11-03: no paid run yet). After the tests, replace each ESTIMATE with what
// the runs measured (the cost ledger: blocky_worlds_cost_ledger) and keep the migration's tool_prices rows equal to
// PRICE_ROWS (tests/blockyWorlds.test.mjs holds them together).
import { LENGTHS, NARRATOR, targetWords } from "./config.js";

export const CREDIT = Object.freeze({ ourUsd: 0.01, userUsd: 0.02 });

/** Provider rates (USD). Sources in each note. */
export const RATES = Object.freeze({
  // ElevenLabs: ~0.44 credits a character on Multilingual v2 on the owner's plan (measured in Cutaway, 2026-10-28);
  // one ElevenLabs credit = $0.0002. ESTIMATE for this voice until a take is billed.
  voiceUsdPerChar: 0.44 * 0.0002,
  charsPerWord: 5.6, // a word plus its space, from the example script
  voiceRetakeShare: 0.15, // a take that fails the word check is made again (ESTIMATE)
  // RunPod 16 GB tier, per second (Cutaway's RUNTIME_RATES); the render runs ~2.5x the video length (ESTIMATE)
  gpuUsdPerSec: 0.00016,
  renderSecPerVideoSec: 2.5,
  gpuStartUsd: 0.01, // cold start + scene load (ESTIMATE)
  finishUsd: 0.01, // captions, mix and upload on the Fly finisher (Cutaway's renderUsd)
  storageUsd: 0.003,
});

/** One delivered video's cost per part (USD), by length. ESTIMATES (see the top of the file). */
export function attemptCost(lengthSec) {
  const words = targetWords(lengthSec), chars = words * RATES.charsPerWord;
  return {
    // ~2 script writes (Sonnet 5.5, ~9k cached prompt + ~2.5k out with thinking: ~$0.05 each) + ~2 idea batches
    // (Haiku 5.5, well under a cent) per delivered video
    writing: Number((0.1 + lengthSec / 3000).toFixed(4)),
    voice: Number((chars * RATES.voiceUsdPerChar * (1 + RATES.voiceRetakeShare)).toFixed(4)),
    // the shot plan (Sonnet 5.5, one shot per sentence): ~$0.08 a minute of video
    shotPlan: Number((0.08 * (lengthSec / 60) + 0.02).toFixed(4)),
    gpu: Number((RATES.gpuStartUsd + lengthSec * RATES.renderSecPerVideoSec * RATES.gpuUsdPerSec).toFixed(4)),
    finish: RATES.finishUsd,
    storage: RATES.storageUsd,
  };
}
/** A failed attempt usually stops before the render: about the writing, the voice and the plan (ESTIMATE). */
export const PASS_RATE = 0.85;
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
export function failedCost(lengthSec) {
  const a = attemptCost(lengthSec);
  return a.voice + a.shotPlan + a.gpu * 0.5;
}

/** Our full real cost of one delivered video (USD): its attempt plus its share of the refunded failures. */
export function fullCostUsd(lengthSec) {
  if (!LENGTHS.includes(lengthSec)) throw new Error(`no Blocky Worlds cost for ${lengthSec} s`);
  return Number((sum(attemptCost(lengthSec)) + (failedCost(lengthSec) * (1 - PASS_RATE)) / PASS_RATE).toFixed(4));
}
/** What one attempt is expected to cost us: the emergency cap counts this before a start (guard.js). */
export const costBasisUsd = (lengthSec) => Number(sum(attemptCost(lengthSec)).toFixed(4));

export const toolKey = (lengthSec) => `blocky-worlds:video-${lengthSec}`;
export const PRICES = Object.freeze(Object.fromEntries(LENGTHS.map((s) => [s, Math.ceil(fullCostUsd(s) / CREDIT.ourUsd - 1e-9)])));

/** Credits for one video of `lengthSec`: the server charges this (compute_tool_price reads the same number). */
export function videoCredits(lengthSec) {
  const c = PRICES[lengthSec];
  if (!Number.isInteger(c)) throw new Error(`no Blocky Worlds price for ${lengthSec} s`);
  return c;
}

/** The rows for public.tool_prices, as the migration writes them. */
export const PRICE_ROWS = Object.freeze(LENGTHS.map((s) => Object.freeze({ tool_key: toolKey(s), flat_credits: PRICES[s], credits_per_second: null, allowed_durations: null })));

/** The narrator the price assumes (a different voice model changes the voice cost). */
export const PRICED_VOICE_MODEL = NARRATOR.model;
