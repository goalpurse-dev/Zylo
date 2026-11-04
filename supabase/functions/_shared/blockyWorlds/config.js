// Blocky Worlds: the template's settings, in one place. Every other Blocky Worlds file reads from here.
// Blocky Worlds only: no other template imports this file.

/**
 * The narrator: the owner's pick and test (2026-11-03). ElevenLabs "Little Dude II" (a stock library voice; never a
 * clone of a creator), on Multilingual v2. The voice's saved settings in the owner's ElevenLabs library are the same.
 * Ranges (ElevenLabs API reference): stability, similarity_boost, style 0-1; speed 0.7-1.2. voice.js checks them.
 * Speed is already the maximum, so the rest of the reference pace (~260 words a minute) comes from the script (short,
 * punchy lines: script.js PACE) and from trimming the silences between sentences (never a speed-up of the audio).
 */
export const NARRATOR = Object.freeze({
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

/**
 * The pace the script is sized for. The references speak at ~260 words a minute (ANALYSIS.md 2.3), but Little Dude II at
 * its top speed reads ~219 after the pauses are trimmed (first paid test, 2026-11-04: 413 words -> 113 s). Scripts are
 * sized at 220 so a 90 s video lasts ~90 s (owner, 2026-11-04: ~15% shorter scripts).
 */
export const PACE = Object.freeze({
  targetWpm: 220,
  // the gap left between sentences after trimming the voice's own pauses (seconds); commas are left as spoken
  sentenceGapSec: 0.1,
});

/** Video lengths the user can pick (seconds). The references run 66-170 s, median ~131 s. */
export const LENGTHS = Object.freeze([60, 90, 120]);
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
