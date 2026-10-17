// Cutaway Explainer: the locked look, restated in full in every image and clip
// prompt (research/seamless-niche/TEST1_REVIEW.md, rules R1-R21).

export const STYLE_BLOCK =
  "Vertical 9:16. Stylised-realistic 3D architectural cutaway diorama, clean premium game-art look, " +
  "soft even lighting, saturated but clean colours, medium detail that reads at phone size. " +
  "The world runs to the frame edges: no floating base, no empty void, no big empty sky.";

// R14-R17: water must never read as glass or pipes.
export const WATER_RULES =
  "All water is tinted light blue or cyan. Rain is many thin short motion-blurred streaks. " +
  "Water falling off an edge is a curtain of separate drops along the whole edge that splash where they land. " +
  "Water soaking into ground shows as the soil turning darker and shinier. Water in a pipe is shown by white dots moving inside it.";

// R11: the overlay vocabulary the planner may use (built into the 3D scene).
export const OVERLAYS = Object.freeze({
  arrows: "bold white 3D arrows showing direction or pressure",
  flow_dots: "white dots moving through the pipe or channel, showing the flow",
  soak: "soil turning darker and shinier, with small white arrows pointing down",
  dust: "a small puff of grey dust",
  glow: "a soft glow marking heat, gas or electricity",
  sparkle: "a few small sparkles marking the clean, finished part",
});

// No negative prompt on p-video or Nano Banana 2 Lite: the "never" list is part of the prompt.
export const NEVER =
  "Never: text, captions, labels, logos, people, glass tubes, solid columns of water, clear transparent water, camera shake, new objects that were not described.";

export const IMAGE_SIZE = Object.freeze({ width: 768, height: 1376 });
