// Blocky Worlds: the template's settings, in one place. Every other Blocky Worlds file reads from here.
// Blocky Worlds only: no other template imports this file.

/**
 * The narrator (owner, 2026-11-12): ElevenLabs "Scruffy Duck" (a shared-library voice: TTS works on our key although
 * GET /v1/voices/{id} says not_found, so nothing gates on that lookup) on Eleven v3. Eleven v3 gives word timings on
 * /with-timestamps (checked 2026-11-12) and bills like Little Dude II: ~0.43 credits a character (the owner's test 63
 * credits / 143 characters; our probe 15 / 35; Little Dude II 792 / 1799), so the voice price is unchanged. Eleven v3
 * takes stability 0 / 0.5 / 1 (Creative / Natural / Robust); 0.5. The engine still trims the silences and speeds the
 * take up 1.25x at the same pitch (voice/eleven.mjs).
 * Before (2026-11-03 to 11-12): ElevenLabs "Little Dude II" (a stock library voice; never a
 * clone of a creator), on Multilingual v2. The voice's saved settings in the owner's ElevenLabs library are the same.
 * Ranges (ElevenLabs API reference): stability, similarity_boost, style 0-1; speed 0.7-1.2. voice.js checks them.
 * Speed is already the maximum, so the rest of the reference pace (~260 words a minute) comes from the script (short,
 * punchy lines: script.js PACE) and from trimming the silences between sentences (never a speed-up of the audio).
 */
export const LITTLE_DUDE_II = Object.freeze({
  provider: "elevenlabs",
  voiceId: "fBD19tfE58bkETeiwUoC",
  voiceName: "Little Dude II",
  model: "eleven_multilingual_v2",
  settings: Object.freeze({
    stability: 1.0,
    similarity_boost: 0.7,
    style: 0,
    use_speaker_boost: true, // as saved on the voice in the owner's library
    speed: 1.2,
  }),
  outputFormat: "mp3_44100_128",
});
export const NARRATOR = Object.freeze({
  provider: "elevenlabs",
  voiceId: "8VJBrRk4O7tFoB5kqxa6",
  voiceName: "Scruffy Duck",
  model: "eleven_v3",
  settings: Object.freeze({ stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1.2 }),
  outputFormat: "mp3_44100_128",
});

/**
 * The narrators to choose from: scruffy_duck = NARRATOR, the default (2026-11-12); little_dude_ii, the one before. The
 * engine picks one with BLOCKY_WORLDS_NARRATOR=<key> (voice/eleven.mjs); a take records which voice made it. (The v4
 * option skghcThhrhzKre1Ny7M7 is gone: the voice never reached the account.)
 */
export const NARRATORS = Object.freeze({
  scruffy_duck: NARRATOR,
  little_dude_ii: LITTLE_DUDE_II,
});

/**
 * The pace the script is sized for. The references speak at ~260 words a minute (ANALYSIS.md 2.3), but Little Dude II at
 * its top speed reads ~219 after the pauses are trimmed (first paid test, 2026-11-04: 413 words -> 113 s). Scripts are
 * sized at 220 so a 90 s video lasts ~90 s (owner, 2026-11-04: ~15% shorter scripts). 2026-11-06: the engine measured
 * ~215 on real renders, and a 90 s script ran 95.8 s (342 words, the band then allowed +6%), so scripts are sized at
 * 212 and may not go over the target (script.js BAND): a 1:30 video lasts <= ~90 s. Prices use their own pace
 * (pricing.js PRICED_WPM), unchanged.
 */
export const PACE = Object.freeze({
  // 2026-11-12 (owner, the story formula): the engine speeds the voice up 1.25x and trims it, so the video runs ~4.3 words
  // a second (255-280 a minute, formula.js): scripts are sized at 257 a minute, a 1:30 video is ~385 words, ~70 of them
  // in the first 15 s. 212 was the pace before that speed-up.
  targetWpm: 257,
  // the gap left between sentences after trimming the voice's own pauses (seconds); commas are left as spoken
  sentenceGapSec: 0.1,
});

/**
 * Video lengths the user can pick (seconds): 30 s to 3 min in 10 s steps (the page's slider; owner, 2026-11-05). The
 * references run 66-170 s, median ~131 s. Every length has its own price row (tool_prices, pricing.js PRICE_ROWS).
 */
export const LENGTH_RANGE = Object.freeze({ min: 30, max: 180, step: 10 });
export const LENGTHS = Object.freeze(Array.from({ length: (LENGTH_RANGE.max - LENGTH_RANGE.min) / LENGTH_RANGE.step + 1 }, (_, i) => LENGTH_RANGE.min + i * LENGTH_RANGE.step));
export const DEFAULT_LENGTH = 90;

/** Claude models for the writing steps (the 3D shot plan is the renderer's: not built yet). */
export const MODELS = Object.freeze({
  ideas: "claude-haiku-5-5",     // live ideas for "Your topic" (and a fallback when a user has seen the whole library)
  library: "claude-sonnet-5-5",  // the library batch job: ideas are reused by many users, so the stronger writer
  judge: "claude-sonnet-5-5",    // the AI judge that scores every library idea before anyone sees it
  card: "claude-haiku-5-5",      // a pasted script turned into an idea card
  beats: "claude-sonnet-5-5",    // the beat sheet
  script: "claude-sonnet-5-5",
  opener: "claude-haiku-5-5",
  shots: "claude-sonnet-5-5",    // the shot plan (the renderer's step)
});

/** Words the narration should have for a length: the target pace, rounded to whole words. */
export const targetWords = (lengthSec) => Math.round((lengthSec * PACE.targetWpm) / 60);
