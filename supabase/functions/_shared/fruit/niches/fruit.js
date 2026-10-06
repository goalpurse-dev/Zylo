// AI Fruit Story. The engine's built-in wording IS Fruit's, so this niche
// overrides nothing: no picture, clip, writer, series, editor, check, upload
// or plate hooks, and no price keys of its own (models.js holds them).
export const FRUIT = Object.freeze({
  id: "fruit",
  name: "AI Fruit Story",
  /** No flag: live for everyone (the browser's fruit_v2 switch decides v1 or v2). */
  flag: null,
  /** Ideas come from the hand-written library (fruit_ideas, picked by fruit_pick_ideas). */
  ideas: "library",
  ready: true,
});
