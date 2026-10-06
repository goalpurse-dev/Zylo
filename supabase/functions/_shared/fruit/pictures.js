// Scene picture requests for AI Fruit Story v2 (Nano Banana 2 Lite).
// The prompt is built once, stored on the scene/job and sent byte-for-byte.
// It never gets cut: if the full wording would pass the limit, the builder
// switches to a shorter wording (tiers), and tests prove every tier fits.
import { FRUIT_MODELS } from "./models.js";
import { SERVER_LIMITS } from "./limits.js";
import { withSubject } from "./wording.js";
import { shotOf } from "./shots.js";
import { FRUIT_LOOKS } from "./fruitLooks.js";
import { hooksOf } from "./niches/index.js";

export const PICTURE_PROMPT_MAX = SERVER_LIMITS.maxScenePromptChars;   // 2,500 (Nano Banana accepts 45,000)

const SHOT_TEXT = {
  "close-up": "Close-up on the speaker's face and shoulders",
  "medium close-up": "Medium close-up, chest up",
  // The 30 s story showed "medium/waist up" still gave full-body shots: say chest up.
  "chest-up": "Chest-up shot on the speaker in the foreground, never full body",
};

/** Shot line (older rows with wide / over-the-shoulder / two-shot are drawn chest-up). */
const shotText = (shot) => SHOT_TEXT[shotOf(shot)];
// Lip sync needs a big, clear mouth: chest up or closer, the speaker's head
// a quarter to a third of the frame height, face toward the camera. 3d/3g
// showed the model shrinks the speaker when everyone must fit side by side,
// and turns them to profile when they "talk to" someone, so the speaker is
// staged in front, facing the lens, and listeners go behind, smaller.
const FACE = "Framing: chest up or closer on the speaker, never a full-body shot; their head is a quarter to a third of the frame height, eyes and mouth sharp and clearly visible. Keep the room as a soft background.";
const FACE_SHORT = "Chest up on the speaker, never full body; face large, sharp, toward the camera.";

/**
 * Every character's fruit head, named, background ones included ("Caught at
 * Dinner": Piper Pine, a pineapple woman in the background, came out human).
 */
export function fruitHeads(cast, short = false) {
  if (short) return `Fruit heads only: ${cast.map((c) => `${c.name.split(" ")[0]} ${c.fruit}`).join(", ")}; no humans.`;
  const heads = cast.map((c) => {
    const label = FRUIT_LOOKS[c.fruit]?.label ?? c.fruit;
    return `${c.name} has ${/^[aeiou]/i.test(label) ? "an" : "a"} ${label} head`;
  });
  const list = heads.length > 1 ? `${heads.slice(0, -1).join(", ")} and ${heads.at(-1)}` : heads[0];
  return `Every character has a fruit head, in the background too: ${list}. No human heads, faces or hair on anyone.`;
}

/** Speaker in front and facing the camera; listeners behind, smaller. */
function stage(speaker, others, short = false) {
  if (!others.length) return `${speaker.name} is alone in the frame, body and face turned toward the camera.`;
  const names = others.map((c) => c.name).join(" and ");
  if (short) return `${speaker.name} in front, facing the camera; ${names} behind, smaller.`;
  return `Staging: ${speaker.name} stands closest to the camera, body and face turned toward the camera (at most a slight three-quarter turn), large in the frame. ${names} ${others.length > 1 ? "are" : "is"} further back beside or behind ${speaker.name}, smaller and slightly softer, looking at ${speaker.name}.`;
}
const STYLE = "Style: premium 3D animated feature-film look, the same character design as the reference images, soft cinematic lighting, sharp focus, rich color.";
const NEGATIVE = "No text, no captions, no subtitles, no speech bubbles, no readable writing on signs, mugs, screens or clothes, no logos or brand marks (plain unbranded props), no watermark, no extra characters, no human skin, no human heads, no hair.";

/** One sentence per character: which reference image it is and what to keep (or, with an alternate outfit for this story, what to wear instead). */
function referenceLine(c, i, tier, outfits) {
  const kind = `the ${c.fruit} ${c.gender === "female" ? "woman" : "man"}`;
  const alt = outfits?.[c.id];
  // Only the clothes change: the fruit head, the face and the character's colours stay as in the reference.
  if (alt && tier === 2) return `Image ${i + 1} is ${c.name}: same head, face and colours; wears ${alt}.`;
  if (alt) return `Image ${i + 1} is ${c.name}${tier === 0 ? `, ${kind}` : ""}: keep the fruit head, face and body colours exactly as in the reference, but in this story ${c.name} wears ${alt} (not the outfit in the reference).`;
  return tier === 0
    ? `Image ${i + 1} is ${c.name}, ${kind}: keep the fruit head, face and outfit (${c.outfit}) exactly as in the reference.`
    : `Image ${i + 1} is ${c.name}: keep the fruit head, face and outfit exactly as in the reference.`;
}

/**
 * The prompt for the ONE automatic redraw after a failed picture check: the
 * same prompt plus what to fix (pictureCheck.js#verdictOf's fixes). Returns the
 * prompt unchanged when the extra sentences wouldn't fit.
 */
export function withRedrawHint(prompt, fixes) {
  const hint = (fixes ?? []).filter(Boolean).join(" ");
  if (!hint || prompt.includes(hint)) return prompt;
  const next = `${prompt} Fix from the last attempt: ${hint}`;
  return next.length <= PICTURE_PROMPT_MAX ? next : prompt;
}

const NEGATIVE_SHORT = "No text or readable writing, no logos, no watermark, no extra characters, no humans, no hair.";

const who = (c) => `${c.name} (the ${c.fruit} ${c.gender === "female" ? "woman" : "man"})`;

/**
 * Everything in a picture prompt that depends on the template. These are
 * Fruit's; another niche overrides what differs (niches/<id>.js#picture):
 *   style, styleShort, negative, negativeShort, face, faceShort, editKeep: sentences (the Short ones are for the shortest wording)
 *   who(c): the character named with what it is
 *   heads(cast, short): the rule about every character's head
 *   referenceLine(c, i, tier, outfits): which reference image is who, and what to keep
 *   speaking(scene): how the speaker looks while saying the line
 */
const FRUIT_PICTURE = {
  style: STYLE, styleShort: "Same look as the references.", negative: NEGATIVE, negativeShort: NEGATIVE_SHORT, face: FACE, faceShort: FACE_SHORT,
  who, heads: fruitHeads, referenceLine,
  speaking: (scene) => `looking ${scene.emotion}, mouth open mid-sentence, speaking toward the camera.`,
  editKeep: "the same characters, fruit heads, faces, outfits, poses, background, lighting and framing",
};
const lookOf = (story) => ({ ...FRUIT_PICTURE, ...(hooksOf(story, "picture") ?? {}) });

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
  const look = lookOf(story);
  const listeners = others.map(look.who).join(" and ");
  const aspect = story.aspect === "16:9" ? "Wide 16:9 frame" : "Vertical 9:16 frame";
  const time = location.timeOfDay
    ? `Time of day: ${location.timeOfDay}${location.lighting ? `; lighting: ${location.lighting}` : ""}.${tier === 2 ? "" : " Keep exactly this time of day and lighting."}`
    : "";
  const parts = [
    `${aspect}. ${shotText(scene.shot)}. ${tier === 2 ? look.faceShort : look.face}`,
    `${withSubject(look.who(speaker), speaker, scene.action)}, ${look.speaking(scene)}`,
    stage(speaker, others, tier === 2),
    look.heads(cast, tier === 2),
    others.length ? `${tier === 2 ? others.map((c) => c.name.split(" ")[0]).join(" and ") : listeners} ${others.length > 1 ? "listen and react" : "listens and reacts"} silently, mouth${others.length > 1 ? "s" : ""} closed.` : "",
    scene.placement ? `Positions: ${scene.placement.replace(/\.$/, "")}.` : "",
    `Setting: ${String(location.description).replace(/\.+$/, "")}.`,
    time,
    cast.map((c, i) => look.referenceLine(c, i, tier, story.outfits)).join(" "),
    location.plateUrl ? (tier === 2 ? `Image ${cast.length + 1} is the empty set: keep its layout.` : `Image ${cast.length + 1} is the empty set of this place: keep its layout, furniture and colors; the characters stand in it.`) : "",
    `Only these ${cast.length} character${cast.length > 1 ? "s" : ""} in the frame.`,
    tier <= 1 ? look.style : look.styleShort,
    tier === 2 ? look.negativeShort : look.negative,
  ];
  return parts.filter(Boolean).join(" ");
}

/** Lengths of the three wordings (for tests and diagnostics). */
export function scenePromptLengths({ story, scene, library }) {
  const cast = frameCharacters(scene, library);
  const location = (story.locations ?? []).find((l) => l.id === scene.locationId) ?? { description: "a simple indoor room" };
  return [0, 1, 2].map((tier) => build(tier, { story, scene, cast, location }).length);
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

/** Edit keeps everything and changes only what the user asked (image 1 = current picture). story picks the niche's wording. */
export function buildEditPrompt(instruction, story) {
  const look = lookOf(story);
  const prompt = `Edit image 1. Change only this: ${instruction} Keep everything else exactly the same: ${look.editKeep}. The other images are the character references; keep them consistent. ${look.negative}`;
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
  // Characters first, then the series location plate (same place in every episode).
  const location = (story.locations ?? []).find((l) => l.id === scene.locationId);
  const refs = [...frameCharacters(scene, library).map((c) => c.ref_image_url ?? c.refImageUrl), ...(location?.plateUrl ? [location.plateUrl] : [])]
    .slice(0, FRUIT_MODELS.image.maxReferenceImages);
  let sent;
  let saved;
  let referenceImages = refs;
  if (mode === "edit") {
    if (!scene.imageUrl) throw new Error("edit needs a current picture");
    sent = buildEditPrompt(instruction, story);
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
