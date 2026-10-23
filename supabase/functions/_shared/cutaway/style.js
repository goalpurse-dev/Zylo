// Cutaway Explainer: the locked look, restated in full in every image and clip
// prompt (research/seamless-niche/TEST1_REVIEW.md, rules R1-R21).

export const STYLE_BLOCK =
  "Vertical 9:16. Stylised-realistic 3D architectural cutaway diorama, clean premium game-art look, " +
  "soft even lighting, saturated but clean colours, medium detail that reads at phone size. " +
  "The world runs to the frame edges: no floating base, no empty void, no big empty sky.";

// R14-R17: water must never read as glass or pipes. Test 3: rain drawn on a cut face reads as a leak.
export const WATER_RULES =
  "All water is tinted light blue or cyan. Water falling off an edge is a curtain of separate drops that splash where they land. " +
  "Water soaking into ground shows as the soil turning darker and shinier. " +
  "The cut-away soil faces stay dry: no rain, drips or water on or running down them.";

// No drawn explainers for now (owner, 2026-10-19): AI-drawn arrows and dots look cheap
// (test 3's floating arrow). Clean ones will be graphics drawn in the stitch later.
export const OVERLAYS = Object.freeze({});

// No negative prompt on the video models or the image model: the "never" list is part of the prompt.
export const NEVER =
  "Never: text, captions, labels, logos, people, arrows, dots, symbols, icons, diagram overlays, glass tubes, solid columns of water, clear transparent water, camera shake, new objects that were not described.";

export const IMAGE_SIZE = Object.freeze({ width: 768, height: 1376 });
