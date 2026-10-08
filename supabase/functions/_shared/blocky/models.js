// Every Blocky Stories model choice, in one place. Switching a model is a
// one-line change here (plus a tool_prices row if the price changes).
// Runware facts checked against runware.ai/docs on 2026-09-27.

export const BLOCKY_MODELS = Object.freeze({
  // Story + series planner. Blind test 2026-09-30 (stage 3c): Claude Sonnet 5 won
  // 2 of 3 rounds (idea + prompt; the script round only compared staging) and
  // costs ~$0.01 per 15 s story vs ~$0.026 for GPT-5.6 Sol.
  planner: { provider: "anthropic", model: "claude-sonnet-5" },
  plannerCandidates: Object.freeze([
    { provider: "anthropic", model: "claude-sonnet-5" },
    { provider: "openai", model: "gpt-5.6-sol" },
  ]),
  // Script editor: reads every finished script once before pictures are paid for
  // (scriptReview.js). A different, cheaper model than the writer: about $0.003 per review.
  // Blocky (2026-10-08): the editor is the writer's model, not the cheaper one. In the first real story the
  // cheaper editor failed a working reveal and its "fix" removed the twist; judging a story is the hard part.
  // About $0.01 per check instead of $0.005.
  review: { provider: "anthropic", model: "claude-sonnet-5" },
  // The twist plan (twists.js): three complete plans for one story, before any dialogue. The twist is the
  // one thing a story lives on, and three rounds on the writer's model averaged 5.6 to 6 of 10, so this one
  // step runs on the strongest model (owner, 2026-10-08). It is a few hundred words out, so the dearer
  // model adds about 3 cents a script. The judge that picks among the three is the review model above.
  twistPlan: { provider: "anthropic", model: "claude-opus-5-5" },
  // Small tasks: edit-instruction cleanup, content-policy rewrite.
  small: { provider: "openai", model: "gpt-5-mini" },

  // Scene pictures, edits and regenerations.
  image: Object.freeze({
    air: "google:nano-banana@2-lite",
    toolKey: "image:blocky-story",
    sizes: { "9:16": [768, 1376], "16:9": [1376, 768] },
    maxReferenceImages: 14,
    providerPromptMax: 45000,
    outputFormat: "JPG",
  }),

  // Clips: image-to-video, the scene picture as the first frame, native audio.
  // None of these models accepts frameImages together with referenceImages.
  video: Object.freeze({
    // Decided after the 3e bake-off (2026-09-30): measured $0.0504/s Wan2.6 Flash,
    // $0.0817/s Seedance 2.0 Mini, $0.15/s Veo 3.1 Fast (720p, i2v, audio).
    v2: Object.freeze({
      air: "alibaba:wan@2.6-flash",
      toolKey: "video:blocky-story-v2",
      sizes: { "9:16": [720, 1280], "16:9": [1280, 720] },
      durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],   // Wan accepts 2-15; clips are never under 4 s
      audio: "alibaba",             // providerSettings.alibaba.audio = true
      providerPromptMax: 1500,
      fallback: "v2-fallback",      // a failed Wan clip is re-sent once on Seedance 2.0 Mini (same price to the user)
    }),
    "v2-fallback": Object.freeze({
      air: "bytedance:seedance@2.0-mini",
      toolKey: "video:blocky-story-v2",
      sizes: { "9:16": [720, 1280], "16:9": [1280, 720] },
      durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      audio: "settings",            // settings.audio = true
      providerPromptMax: 10000,
    }),
    v3: Object.freeze({
      air: "bytedance:seedance@2.0-mini",
      toolKey: "video:blocky-story-v3",
      sizes: { "9:16": [720, 1280], "16:9": [1280, 720] },
      durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      audio: "settings",
      providerPromptMax: 10000,
    }),
    v4: Object.freeze({
      air: "google:3@3",            // Veo 3.1 Fast
      toolKey: "video:blocky-story-v4",
      sizes: { "9:16": [720, 1280], "16:9": [1280, 720] },
      durations: [4, 6, 8],
      audio: "google",              // providerSettings.google.generateAudio = true
      providerPromptMax: 3000,
    }),
  }),
});

export const videoModel = (quality) => {
  const m = BLOCKY_MODELS.video[quality];
  if (!m) throw new Error(`unknown quality ${quality}`);
  return m;
};
