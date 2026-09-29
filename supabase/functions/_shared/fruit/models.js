// Every AI Fruit Story v2 model choice, in one place. Switching a model is a
// one-line change here (plus a tool_prices row if the price changes).
// Runware facts checked against runware.ai/docs on 2026-09-27.

export const FRUIT_MODELS = Object.freeze({
  // Story + series planner. Decided by the blind test in stage 3c.
  planner: { provider: "anthropic", model: "claude-sonnet-5" },
  plannerCandidates: Object.freeze([
    { provider: "anthropic", model: "claude-sonnet-5" },
    { provider: "openai", model: "gpt-5.6-sol" },
  ]),
  // Small tasks: edit-instruction cleanup, content-policy rewrite.
  small: { provider: "openai", model: "gpt-5-mini" },

  // Scene pictures, edits and regenerations.
  image: Object.freeze({
    air: "google:nano-banana@2-lite",
    toolKey: "image:fruit-story",
    sizes: { "9:16": [768, 1376], "16:9": [1376, 768] },
    maxReferenceImages: 14,
    providerPromptMax: 45000,
    outputFormat: "JPG",
  }),

  // Clips: image-to-video, the scene picture as the first frame, native audio.
  // None of these models accepts frameImages together with referenceImages.
  video: Object.freeze({
    v2: Object.freeze({
      air: "bytedance:seedance@2.0-mini",
      toolKey: "video:fruit-story-v2",
      sizes: { "9:16": [720, 1280], "16:9": [1280, 720] },
      durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      audio: "settings",            // settings.audio = true
      providerPromptMax: 10000,
    }),
    v3: Object.freeze({
      air: "bytedance:seedance@2.0-fast",
      toolKey: "video:fruit-story-v3",
      sizes: { "9:16": [720, 1280], "16:9": [1280, 720] },
      durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      audio: "settings",
      providerPromptMax: 10000,
    }),
    v4: Object.freeze({
      air: "google:3@3",            // Veo 3.1 Fast
      toolKey: "video:fruit-story-v4",
      sizes: { "9:16": [720, 1280], "16:9": [1280, 720] },
      durations: [4, 6, 8],
      audio: "google",              // providerSettings.google.generateAudio = true
      providerPromptMax: 3000,
    }),
  }),
});

export const videoModel = (quality) => {
  const m = FRUIT_MODELS.video[quality];
  if (!m) throw new Error(`unknown quality ${quality}`);
  return m;
};
