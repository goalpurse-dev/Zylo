// Scene picture requests for AI Fruit Story v2 (Nano Banana 2 Lite).
// The prompt is built once, stored on the scene/job and sent byte-for-byte.
// It never gets cut: if the full wording would pass the limit, the builder
// switches to a shorter wording (tiers), and tests prove every tier fits.
import { FRUIT_MODELS } from "./models.js";
import { SERVER_LIMITS } from "./limits.js";
import { withSubject } from "./wording.js";

export const PICTURE_PROMPT_MAX = SERVER_LIMITS.maxScenePromptChars;   // 2,500 (Nano Banana accepts 45,000)

const SHOT_TEXT = {
  "close-up": "Close-up on the speaker's face and shoulders",
  "medium close-up": "Medium close-up, chest up",
  "medium two-shot": "Medium two-shot, waist up, both faces clearly visible",
  "over-the-shoulder": "Over-the-shoulder shot from behind the listener, speaker facing camera",
  wide: "Wide shot showing the characters head to toe and the room",
};
// Lip sync needs a big, clear mouth: waist up or closer, the speaker's head
// about a quarter of the frame height (or more), face toward the camera.
const FACE = "Framing: waist up or closer; the speaker's head fills at least a quarter of the frame height, face sharp and turned toward the camera. Show only as much of the room as fits around them.";
const STYLE = "Style: premium 3D animated feature-film look, the same character design as the reference images, soft cinematic lighting, sharp focus, rich color.";
const NEGATIVE = "No text, no captions, no subtitles, no speech bubbles, no logos, no watermark, no extra characters, no human skin, no human heads.";

const who = (c) => `${c.name} (the ${c.fruit} ${c.gender === "female" ? "woman" : "man"})`;

/** Characters in frame, speaker first (image 1). */
export function frameCharacters(scene, library) {
  const ids = [scene.speakerId, ...scene.presentIds.filter((id) => id !== scene.speakerId)];
  return ids.map((id) => {
    const c = library.get(id);
    if (!c) throw new Error(`unknown character ${id}`);
    return c;
  });
}

function build(tier, { story, scene, cast, location }) {
  const [speaker, ...others] = cast;
  const listeners = others.map(who).join(" and ");
  const aspect = story.aspect === "16:9" ? "Wide 16:9 frame" : "Vertical 9:16 frame";
  const time = location.timeOfDay
    ? `Time of day: ${location.timeOfDay}${location.lighting ? `; lighting: ${location.lighting}` : ""}. Keep exactly this time of day and lighting.`
    : "";
  const parts = [
    `${aspect}. ${SHOT_TEXT[scene.shot] ?? SHOT_TEXT["medium two-shot"]}. ${FACE}`,
    `${withSubject(who(speaker), speaker, scene.action)}, looking ${scene.emotion}, mouth open mid-sentence${others.length ? `, talking to ${listeners}` : ""}.`,
    others.length ? `${listeners} ${others.length > 1 ? "listen and react" : "listens and reacts"} silently, mouth${others.length > 1 ? "s" : ""} closed.` : "",
    scene.placement ? `Positions: ${scene.placement.replace(/\.$/, "")}.` : "",
    `Setting: ${location.description}.`,
    time,
    cast.map((c, i) => tier === 0
      ? `Image ${i + 1} is ${c.name}, the ${c.fruit} ${c.gender === "female" ? "woman" : "man"}: keep the fruit head, face and outfit (${c.outfit}) exactly as in the reference.`
      : `Image ${i + 1} is ${c.name}: keep the fruit head, face and outfit exactly as in the reference.`).join(" "),
    `Only these ${cast.length} character${cast.length > 1 ? "s" : ""} in the frame.`,
    tier <= 1 ? STYLE : "Same look as the references.",
    NEGATIVE,
  ];
  return parts.filter(Boolean).join(" ");
}

/** The scene description prompt (tiers: full, no outfits, minimal). Never cut. */
export function buildScenePrompt({ story, scene, library }) {
  const cast = frameCharacters(scene, library);
  const location = (story.locations ?? []).find((l) => l.id === scene.locationId) ?? { description: "a simple indoor room" };
  for (const tier of [0, 1, 2]) {
    const prompt = build(tier, { story, scene, cast, location });
    if (prompt.length <= PICTURE_PROMPT_MAX) return prompt;
  }
  throw new Error(`scene prompt over ${PICTURE_PROMPT_MAX} chars even at the shortest tier`);
}

/** Edit keeps everything and changes only what the user asked (image 1 = current picture). */
export function buildEditPrompt(instruction) {
  const prompt = `Edit image 1. Change only this: ${instruction} Keep everything else exactly the same: the same characters, fruit heads, faces, outfits, poses, background, lighting and framing. The other images are the character references; keep them consistent. ${NEGATIVE}`;
  if (prompt.length > PICTURE_PROMPT_MAX) throw new Error("edit prompt over limit");   // validation caps the instruction at 500 chars
  return prompt;
}

/**
 * Builder for steps.js. Returns {prompt (saved on the scene, null = keep the
 * scene's description), sent (the exact positivePrompt), request, priceInput}.
 * mode: new | retry | regenerate (user's edited prompt, sent exactly) | edit (current picture + instruction)
 */
export function buildPictureRequest({ story, scene, library, mode, instruction, prompt: userPrompt }) {
  const m = FRUIT_MODELS.image;
  const [width, height] = m.sizes[story.aspect];
  const refs = frameCharacters(scene, library).map((c) => c.ref_image_url ?? c.refImageUrl);
  let sent;
  let saved;
  let referenceImages = refs;
  if (mode === "edit") {
    if (!scene.imageUrl) throw new Error("edit needs a current picture");
    sent = buildEditPrompt(instruction);
    saved = null;                                   // the scene keeps its description
    referenceImages = [scene.imageUrl, ...refs];
  } else if (mode === "regenerate") {
    sent = userPrompt;                              // exactly as the user edited it
    saved = userPrompt;
  } else if (mode === "retry" && scene.imagePrompt) {
    sent = scene.imagePrompt;                       // retry re-sends the stored prompt
    saved = scene.imagePrompt;
  } else {
    sent = buildScenePrompt({ story, scene, library });
    saved = sent;
  }
  if (sent.length > PICTURE_PROMPT_MAX) throw new Error("picture prompt over limit");
  const request = {
    taskType: "imageInference",
    model: m.air,
    positivePrompt: sent,
    width,
    height,
    numberResults: 1,
    outputType: "URL",
    outputFormat: m.outputFormat,
    outputQuality: 90,
    inputs: { referenceImages },
  };
  return { prompt: saved, sent, request, priceInput: { width, height } };
}
