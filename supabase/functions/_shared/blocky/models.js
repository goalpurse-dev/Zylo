// Every Blocky Stories model choice, in one place. The writing models are
// chosen here; the picture model, the clip models, their fallback chains and
// every price are in pricing.js and only shaped here for the builders.
// Runware facts checked against runware.ai/docs on 2026-09-27; the clip models
// against one real 6-second clip each on 2026-10-08.
import { CLIP_MODELS, CLIP_SIZES, PICTURE, TIERS, TIER_IDS, modelByAir, nextModel } from "./pricing.js";

/** A clip model as the builders use it: pricing.js's facts plus the size a clip is priced at. */
const clipModel = (m, toolKey) => Object.freeze({ ...m, toolKey, sizes: CLIP_SIZES, providerPromptMax: m.promptMax });

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
  // effort: how hard it thinks before it answers (its thinking is billed as output). LOW since 2026-10-08:
  // on the same five ideas the judge scored low-effort plans 31.2 of 35 on average and medium ones 30.0,
  // for about $0.03 instead of $0.09 and 21 seconds instead of 46 (scripts/blocky/comparePlans.mjs).
  twistPlan: { provider: "anthropic", model: "claude-opus-5-5", effort: "low" },
  // Small tasks: edit-instruction cleanup, content-policy rewrite.
  small: { provider: "openai", model: "gpt-5-mini" },

  // Scene pictures, edits and regenerations.
  image: Object.freeze({
    air: PICTURE.air,
    toolKey: PICTURE.toolKey,
    sizes: { "9:16": [768, 1376], "16:9": [1376, 768] },
    maxReferenceImages: 14,
    providerPromptMax: 45000,
    outputFormat: "JPG",
  }),

  // Clips: image-to-video, the scene picture as the first frame, native audio.
  // None of these models accepts frameImages together with referenceImages.
  // One entry per tier: the model that makes the tier's clips (pricing.js#TIERS, the first of its chain).
  video: Object.freeze(Object.fromEntries(TIER_IDS.map((id) => [id, clipModel(CLIP_MODELS[TIERS[id].chain[0]], TIERS[id].toolKey)]))),
});

/** The model tried after the one that made (or failed to make) this request, or null: pricing.js's chains. */
export const nextVideoModel = (air) => { const m = nextModel(air); return m ? clipModel(m, null) : null; };
/** The clip model behind a Runware id, or null. */
export const videoModelByAir = (air) => { const m = modelByAir(air); return m ? clipModel(m, null) : null; };

export const videoModel = (quality) => {
  const m = BLOCKY_MODELS.video[quality];
  if (!m) throw new Error(`unknown quality ${quality}`);
  return m;
};
