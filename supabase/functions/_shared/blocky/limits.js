// Limits for Blocky Stories, enforced by the server. Must equal the UI's
// src/components/viral-tools/blocky-stories/api/limits.js (a test checks).
export const LIMITS = Object.freeze({
  maxCastSingle: 3,
  minCastSeries: 2,
  maxCastSeries: 5,
  maxCharactersPerScene: 3,
  maxPromptChars: 1000,
  minLengthSec: 15,
  maxLengthSec: 120,
  lengthStepSec: 5,
  minEpisodes: 3,
  maxEpisodes: 10,
  ideasPerCall: 5,
});

// Server-only limits.
export const SERVER_LIMITS = Object.freeze({
  maxScriptLines: 24,          // 2 min at ~5 s per line
  maxLineChars: 300,
  maxEditChars: 500,           // "change X" instruction
  maxScenePromptChars: 2500,   // the editable picture prompt (also the builder's hard limit)
  maxClipPromptChars: 1500,    // clip prompt builder's hard limit (Veo accepts 3,000)
  picturesInFlightPerStory: 6,   // a 30 s story's pictures in one wave
  clipsInFlightPerStory: 6,      // was 3: 6-clip stories waited 55–100 s for a second wave
  jobsInFlightGlobal: 24,
});
