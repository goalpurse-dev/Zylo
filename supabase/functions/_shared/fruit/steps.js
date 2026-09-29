// Turns a user action into one atomic charge: which items, at what price
// input, with which exact provider request. Pure: the API loads the story,
// calls planStep, then passes the result to the fruit_charge_step RPC.
//
// builders (stage 3d/3e):
//   picture({story, scene, scenes, library, mode, instruction?, prompt?}) -> {prompt, request, priceInput}
//   clip({story, scene, library}) -> {prompt, request, priceInput}
// Each builder returns the EXACT prompt that goes into request.positivePrompt;
// the scene stores that same string, so what is saved is what is sent.
import { FruitError } from "./errors.js";
import { STEPS, stepBlocker } from "./storyState.js";
import { FRUIT_MODELS, videoModel } from "./models.js";

const blocked = (message) => new FruitError("VALIDATION", message, 409);

/**
 * @param {"pictures"|"edit"|"regenerate"|"retry_picture"|"animate"|"reclip"} step
 * @param {{story: object, scenes: object[], sceneId?: string, instruction?: string, prompt?: string, library: Map, builders: object}} ctx
 *   story/scenes are contract-shaped (toStory)
 */
export function planStep(step, { story, scenes, sceneId, instruction, prompt, library, builders }) {
  const scene = sceneId ? scenes.find((s) => s.id === sceneId) : null;
  if (sceneId && !scene) throw new FruitError("NOT_FOUND", "This scene doesn't exist anymore.", 404);
  const reason = stepBlocker(step, story, scenes, scene);
  if (reason) throw blocked(reason);
  const rule = STEPS[step];

  const pictureItem = (s, mode) => {
    const built = builders.picture({ story, scene: s, scenes, library, mode, instruction, prompt });
    return { scene_id: s.id, kind: "image", tool_key: FRUIT_MODELS.image.toolKey, price_input: built.priceInput, request: built.request, prompt: built.prompt };
  };
  const clipItem = (s) => {
    const built = builders.clip({ story, scene: s, library });
    return { scene_id: s.id, kind: "clip", tool_key: videoModel(story.quality).toolKey, price_input: built.priceInput, request: built.request, prompt: built.prompt };
  };

  let items;
  if (step === "pictures") items = scenes.map((s) => pictureItem(s, "new"));
  else if (step === "edit") items = [pictureItem(scene, "edit")];
  else if (step === "regenerate") items = [pictureItem(scene, "regenerate")];
  else if (step === "retry_picture") items = [pictureItem(scene, "retry")];
  else if (step === "animate") items = scenes.map(clipItem);
  else if (step === "reclip") items = [clipItem(scene)];
  else throw blocked("Unknown step.");

  for (const it of items) {
    if (it.request?.positivePrompt !== it.prompt) throw new Error(`builder broke saved==sent for scene ${it.scene_id}`);
  }
  return { step, from: rule.from, to: rule.to, items };
}

/** Stage 3b placeholder builders: every paid step refuses until 3d/3e. */
export const NOT_READY_BUILDERS = Object.freeze({
  picture() { throw new FruitError("STAGE_NOT_READY", "Scene pictures aren't switched on yet.", 501); },
  clip() { throw new FruitError("STAGE_NOT_READY", "Clips aren't switched on yet.", 501); },
});
