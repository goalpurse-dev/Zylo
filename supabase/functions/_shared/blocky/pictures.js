// Scene picture requests for Blocky Stories (Nano Banana 2 Lite).
// The prompt is built once, stored on the scene/job and sent byte-for-byte.
// It never gets cut: if the full wording would pass the limit, the builder
// switches to a shorter wording (tiers), and tests prove every tier fits.
// What a character is and how the world looks comes from look.js.
import { BLOCKY_MODELS } from "./models.js";
import { SERVER_LIMITS } from "./limits.js";
import { withSubject } from "./wording.js";
import { inFrameIds, shotSpec } from "./shots.js";
import { PICTURE as LOOK } from "./look.js";

export const PICTURE_PROMPT_MAX = SERVER_LIMITS.maxScenePromptChars;   // 2,500 (Nano Banana accepts 45,000)

/** The shot line of a scene (shots.js), with the speaker's and the first listener's names in it. */
const shotText = (shot, speaker, others) => shotSpec(shot).picture.replace("{speaker}", speaker.name).replace("{listener}", others[0]?.name ?? "the listener");

// Lip sync needs a clear mouth: in every shot the speaker's face is toward the
// camera. The picture model shrinks the speaker when everyone must fit side by
// side, and turns them to profile when they "talk to" someone, so the speaker
// is staged in front, facing the lens, and listeners go behind (or, in an
// over-the-shoulder shot, in front with their back to the camera).
/** Who stands where, for the scene's shot. */
function stage(speaker, others, short = false, shot = "chest-up") {
  if (!others.length) return `${speaker.name} is alone in the frame, body and face turned toward the camera.`;
  const names = others.map((c) => c.name).join(" and ");
  if (shot === "wide") {
    if (short) return `${speaker.name} in front, facing the camera; ${names} a step behind, whole in the frame.`;
    return `Staging: ${speaker.name} stands in front, body and face turned toward the camera. ${names} ${others.length > 1 ? "stand" : "stands"} a step behind and to the side, whole in the frame, looking at ${speaker.name}.`;
  }
  if (shot === "over-the-shoulder") {
    const [near, ...rest] = others;
    const far = rest.length ? ` ${rest.map((c) => c.name).join(" and ")} ${rest.length > 1 ? "stand" : "stands"} further back behind ${speaker.name}, smaller.` : "";
    if (short) return `${near.name} at the near edge with its back to the camera; ${speaker.name} beyond, facing the camera.${far}`;
    return `Staging: ${near.name} stands at the near edge of the frame with its back to the camera, so only the back of its cube head and one block shoulder are seen, out of focus. ${speaker.name} stands beyond, body and face turned toward the camera.${far}`;
  }
  if (short) return `${speaker.name} in front, facing the camera; ${names} behind, smaller.`;
  return `Staging: ${speaker.name} stands closest to the camera, body and face turned toward the camera (at most a slight three-quarter turn), large in the frame. ${names} ${others.length > 1 ? "are" : "is"} further back beside or behind ${speaker.name}, smaller and slightly softer, looking at ${speaker.name}.`;
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

/** Characters in frame, speaker first (image 1): everyone present, or the speaker alone in a reaction shot. */
export function frameCharacters(scene, library) {
  const ids = inFrameIds(scene);
  return ids.map((id) => {
    const c = library.get(id);
    if (!c) throw new Error(`unknown character ${id}`);
    return c;
  });
}

function build(tier, { story, scene, cast, location }) {
  const [speaker, ...others] = cast;
  const listeners = others.map(LOOK.who).join(" and ");
  const aspect = story.aspect === "16:9" ? "Wide 16:9 frame" : "Vertical 9:16 frame";
  const time = location.timeOfDay
    ? `Time of day: ${location.timeOfDay}${location.lighting ? `; lighting: ${location.lighting}` : ""}.${tier === 2 ? "" : " Keep exactly this time of day and lighting."}`
    : "";
  const parts = [
    `${aspect}. ${shotText(scene.shot, speaker, others)}. ${tier === 2 ? shotSpec(scene.shot).framingShort : shotSpec(scene.shot).framing}`,
    `${withSubject(LOOK.who(speaker), speaker, scene.action)}, ${LOOK.speaking(scene)}`,
    stage(speaker, others, tier === 2, scene.shot),
    LOOK.heads(cast, tier === 2),
    others.length ? `${tier === 2 ? others.map((c) => c.name.split(" ")[0]).join(" and ") : listeners} ${others.length > 1 ? "listen and react" : "listens and reacts"} silently, mouth${others.length > 1 ? "s" : ""} closed.` : "",
    scene.placement ? `Positions: ${scene.placement.replace(/\.$/, "")}.` : "",
    `Setting: ${String(location.description).replace(/\.+$/, "")}.`,
    time,
    cast.map((c, i) => LOOK.referenceLine(c, i, tier)).join(" "),
    location.plateUrl ? (tier === 2 ? `Image ${cast.length + 1} is the empty set: keep its layout.` : `Image ${cast.length + 1} is the empty set of this place: keep its layout, furniture and colors; the characters stand in it.`) : "",
    `Only these ${cast.length} character${cast.length > 1 ? "s" : ""} in the frame.`,
    tier <= 1 ? LOOK.style : LOOK.styleShort,
    tier === 2 ? LOOK.negativeShort : LOOK.negative,
  ];
  return parts.filter(Boolean).join(" ");
}

/** Lengths of the three wordings (for tests and diagnostics). */
export function scenePromptLengths({ story, scene, library }) {
  const cast = frameCharacters(scene, library);
  const location = (story.locations ?? []).find((l) => l.id === scene.locationId) ?? { description: "a simple indoor room" };
  return [0, 1, 2].map((tier) => build(tier, { story, scene, cast, location }).length);
}

/** The scene description prompt (tiers: full, shorter reference lines, minimal). Never cut. */
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
  const prompt = `Edit image 1. Change only this: ${instruction} Keep everything else exactly the same: ${LOOK.editKeep}. The other images are the character references; keep them consistent. ${LOOK.negative}`;
  if (prompt.length > PICTURE_PROMPT_MAX) throw new Error("edit prompt over limit");   // validation caps the instruction at 500 chars
  return prompt;
}

/**
 * Builder for steps.js. Returns {prompt (saved on the scene, null = keep the
 * scene's description), sent (the exact positivePrompt), request, priceInput}.
 * mode: new | retry | regenerate (user's edited prompt, sent exactly) | edit (current picture + instruction)
 */
export function buildPictureRequest({ story, scene, library, mode, instruction, prompt: userPrompt }) {
  const m = BLOCKY_MODELS.image;
  const [width, height] = m.sizes[story.aspect];
  // Characters first, then the location plate (the same place in every scene and episode).
  const location = (story.locations ?? []).find((l) => l.id === scene.locationId);
  const refs = [...frameCharacters(scene, library).map((c) => c.ref_image_url ?? c.refImageUrl), ...(location?.plateUrl ? [location.plateUrl] : [])]
    .slice(0, BLOCKY_MODELS.image.maxReferenceImages);
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
