import { WORDS_PER_MINUTE, RECIPE_BEATS_PER_MINUTE } from "../../../lib/longFormPipelineConstants.ts";

// lengthEstimates.js — 2026-10-02 "Production Setup redesign" pass, Section 10.
// Updated in the "length slider" pass to compute for ANY whole minute in
// [LENGTH_MIN_MINUTES, LENGTH_MAX_MINUTES], not just the 4 preset buttons.
//
// Pure UI/copy estimates only — "these are ESTIMATES, not guaranteed counts.
// Actual visual beats are created later from final narration + TTS
// alignment." The credits reservation itself is computed independently and
// authoritatively by estimateLongFormProjectQuote (longFormProjectQuote.ts,
// via quote-long-form-project) — this file never feeds that calculation, it
// only supplies the friendly "≈1,450 words / ~150-170 visuals" copy shown
// alongside it, deliberately as a RANGE rather than a fake-precise count.
//
// Phase 0, Section C.1/C.2 — both rates now come from the shared
// src/lib/longFormPipelineConstants.ts, replacing two independent local
// guesses that had drifted from the real backend: WORDS_PER_MINUTE_ESTIMATE
// used to be 145 here vs. the real generator's 150 (script targeting has
// since moved to 145 too — see that file); SCENES_PER_MINUTE_ESTIMATE used
// to be 16.25 here (reverse-engineered from an old static lookup table) vs.
// the real credit-quote math's 15 beats/minute for the Stickman recipe (the
// only recipe that exists today) — and the backend audit's own real
// production data point (a real ~13.5-minute episode producing ~7.1
// scenes/minute under the OTHER, legacy pipeline) shows 15 is already the
// closer of the two guesses, not 16.25.
const WORDS_PER_MINUTE_ESTIMATE = WORDS_PER_MINUTE;
const SCENES_PER_MINUTE_ESTIMATE = RECIPE_BEATS_PER_MINUTE.STICKMAN_DOODLE_EXPLAINER_V1;

export const LENGTH_MIN_MINUTES = 8;
export const LENGTH_MAX_MINUTES = 15;

// The 4 preset buttons shown above the slider — unchanged from before.
export const LENGTH_OPTIONS = [{ minutes: 8 }, { minutes: 10 }, { minutes: 12 }, { minutes: 15 }];

export const DEFAULT_LENGTH_MINUTES = 10;

// A ±12% band around the "typical" figure, rounded to the nearest 5 — never
// presented as an exact guaranteed count.
export function visualsRange(typicalScenes) {
  const low = Math.round((typicalScenes * 0.88) / 5) * 5;
  const high = Math.round((typicalScenes * 1.12) / 5) * 5;
  return { low, high };
}

export function visualsRangeLabel(typicalScenes) {
  const { low, high } = visualsRange(typicalScenes);
  return `~${low}–${high} visuals`;
}

// Computes the display estimate for ANY whole minute in range — never a
// table lookup that can silently miss a value. Out-of-range input is clamped
// rather than rejected, since a slider can never actually produce one, but a
// stale persisted draft value theoretically could.
// wordsPerMinute: the selected voice's measured pace (src/lib/voicePace.ts
// wordsPerMinuteFor); WORDS_PER_MINUTE when the voice is uncalibrated.
export function estimateForLength(minutes, wordsPerMinute = WORDS_PER_MINUTE_ESTIMATE) {
  const clamped = Math.min(LENGTH_MAX_MINUTES, Math.max(LENGTH_MIN_MINUTES, Math.round(Number(minutes) || DEFAULT_LENGTH_MINUTES)));
  const estimatedWords = Math.round(clamped * wordsPerMinute);
  const typicalScenes = Math.floor(clamped * SCENES_PER_MINUTE_ESTIMATE);
  return { minutes: clamped, estimatedWords, typicalScenes };
}
