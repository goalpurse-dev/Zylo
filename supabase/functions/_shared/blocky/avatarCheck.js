// The check of an avatar REFERENCE picture (the library's full-body picture of one avatar on white), by the
// same cheap vision model that checks scene pictures. A reference is made several times and the best one is
// kept: this file asks the questions, turns the answers into a score, and picks.
//
// What a reference must be (roster.mjs#avatarPrompt): one blocky game avatar, whole body, seen straight from
// the front on plain white; a cube head with flat faces; no neck; block arms with flat ends; two separate
// block legs; a flat face decal with no teeth, tongue, lips or nose; the avatar's own colours; its one
// accessory, built from simple blocks; no text, no logo, nothing of a brick toy.
import { callLlm } from "./llm.js";
import { BLOCKY_MODELS } from "./models.js";

export const AVATAR_CHECK_PURPOSE = "avatar_check";

export const AVATAR_CHECK_SYSTEM = "You inspect one reference picture of a 3D blocky game avatar and answer plain questions about what is drawn. Answer only from what you can see. When unsure, answer as if the flaw is there.";

/** avatar: {name, head, torso, legs, accessory|null, face} (roster.mjs). */
export function avatarCheckPrompt(avatar) {
  return [
    `This should be a full-body reference picture of ONE blocky game avatar called ${avatar.name}, standing on a plain white background, seen straight from the front.`,
    `It should have: a ${avatar.head} cube head and ${avatar.head} block arms; ${avatar.torso}; ${avatar.legs} block legs; ${avatar.accessory ? `and ${avatar.accessory}` : "and no hat, hair or accessory at all"}.`,
    `The face should be a flat decal printed on the front of the cube head: ${avatar.face}.`,
    "Answer every question about the picture as it is drawn.",
  ].join(" ");
}

const bool = (description) => ({ type: "boolean", description });
const FIELDS = {
  figures: { type: "integer", description: "How many characters are in the picture." },
  fullBody: bool("The whole body is in the picture, from the top of the head (and anything on it) to the bottom of the legs."),
  frontView: bool("The avatar is seen straight from the front: the front face of the head is square to the camera, not turned to a side, not seen from above or below."),
  cubeHead: bool("The head is a cube (a box) with flat faces and straight edges. False if it is a sphere, a cylinder, an egg, or a box so rounded it has no flat sides."),
  neck: bool("There is a neck or a neck piece between the head and the torso."),
  boxTorso: bool("The torso is one plain rectangular box."),
  blockArms: bool("Each arm is one straight rectangular block with a flat end."),
  hands: bool("An arm ends in a hand, fingers, a claw, a round grip or a separate hand piece."),
  twoLegBlocks: bool("There are two separate straight rectangular leg blocks side by side."),
  hipOrFeet: bool("There is a separate hip piece, a notch block between the legs, or separate feet or shoes."),
  flatFace: bool("The face is flat, printed on the head like a decal: nothing on it sticks out or is carved in."),
  teethTongueLipsNose: bool("The face has teeth, a tongue, lips, a nose or a mouth with depth."),
  headColourRight: bool("The head and the arms have the colour they should have."),
  torsoRight: bool("The torso has the colour it should have, and the one shape it should have (or none)."),
  legsRight: bool("The legs have the colour they should have."),
  faceRight: bool("The eyes and the mouth are the shapes they should be."),
  accessoryRight: bool("The accessory it should have is there and is the right thing and colour. When it should have none: true only if there is none."),
  accessoryBlocky: bool("Hair, hats and accessories are built from simple solid blocks with flat faces: no strands of hair, no fur, no cloth folds, no fine detail. True when there is none."),
  extras: { type: "string", description: "Anything on or with the avatar that it should not have (a second accessory, a prop, a weapon, a pet, a base plate). Empty when there is nothing." },
  readableText: { type: "string", description: "Any letters, numbers or words in the picture, exactly as written. Empty when there are none." },
  logos: bool("There is a logo or a brand mark."),
  brickToyLook: bool("It looks like a brick-building toy figure: studs, a round minifigure head, claw hands, a studded base."),
  humanLook: bool("It has human skin, a human face or a human body shape."),
  plainWhiteBackground: bool("The background is plain white or near white, with at most a soft shadow under the feet."),
  sharpness: { type: "integer", description: "1 to 5: how clean and sharp the picture is (5 = crisp edges, no smears or broken shapes)." },
  notes: { type: "string", description: "One short sentence on the biggest flaw, or empty." },
};
export const avatarCheckSchema = () => ({ type: "object", additionalProperties: false, properties: FIELDS, required: Object.keys(FIELDS) });

// A hard fault makes a picture unusable as a reference; a soft one only costs points.
const HARD = [
  ["figures", (a) => a.figures !== 1, "not exactly one avatar"],
  ["fullBody", (a) => !a.fullBody, "the body is cut off"],
  ["cubeHead", (a) => !a.cubeHead, "the head is not a cube with flat faces"],
  ["neck", (a) => a.neck, "a neck"],
  ["hands", (a) => a.hands, "hands or claws"],
  ["twoLegBlocks", (a) => !a.twoLegBlocks, "not two separate leg blocks"],
  ["teethTongueLipsNose", (a) => a.teethTongueLipsNose, "teeth, a tongue, lips or a nose"],
  ["flatFace", (a) => !a.flatFace, "the face is not a flat decal"],
  ["readableText", (a) => Boolean(String(a.readableText ?? "").trim()), "text"],
  ["logos", (a) => a.logos, "a logo"],
  ["brickToyLook", (a) => a.brickToyLook, "a brick-toy look"],
  ["humanLook", (a) => a.humanLook, "a human look"],
  ["headColourRight", (a) => !a.headColourRight, "the wrong head or arm colour"],
];
const SOFT = [
  ["frontView", (a) => !a.frontView, 12, "not seen straight from the front"],
  ["boxTorso", (a) => !a.boxTorso, 8, "the torso is not one plain box"],
  ["blockArms", (a) => !a.blockArms, 8, "the arms are not straight blocks"],
  ["hipOrFeet", (a) => a.hipOrFeet, 10, "a hip piece or feet"],
  ["torsoRight", (a) => !a.torsoRight, 10, "the wrong torso colour or shape"],
  ["legsRight", (a) => !a.legsRight, 8, "the wrong leg colour"],
  ["faceRight", (a) => !a.faceRight, 8, "the wrong eyes or mouth"],
  ["accessoryRight", (a) => !a.accessoryRight, 12, "the accessory is missing or wrong"],
  ["accessoryBlocky", (a) => !a.accessoryBlocky, 8, "hair or an accessory that is not built from blocks"],
  ["extras", (a) => Boolean(String(a.extras ?? "").trim()), 8, "something extra"],
  ["plainWhiteBackground", (a) => !a.plainWhiteBackground, 6, "the background is not plain white"],
];

/**
 * The answers as a verdict. score: 100 minus the soft faults, minus up to 8 for a soft render; a hard fault
 * caps it at 40 minus 5 for each further one, so a usable picture always beats an unusable one.
 * @returns {{ok: boolean, score: number, hard: string[], soft: string[], problems: string[]}}
 */
export function avatarVerdict(answer) {
  const a = answer ?? {};
  const hard = HARD.filter(([, bad]) => bad(a)).map(([, , text]) => text);
  const softHits = SOFT.filter(([, bad]) => bad(a));
  const sharp = Math.min(5, Math.max(1, Number(a.sharpness) || 1));
  let score = 100 - softHits.reduce((n, [, , points]) => n + points, 0) - (5 - sharp) * 2;
  if (hard.length) score = Math.min(score, 40) - (hard.length - 1) * 5;
  score = Math.max(0, Math.round(score));
  const soft = softHits.map(([, , , text]) => text);
  return { ok: hard.length === 0 && score >= 70, score, hard, soft, problems: [...hard, ...soft] };
}

/** The best of several checked pictures: the highest score; a tie goes to the earlier one. -1 for none. */
export function pickBest(verdicts) {
  let best = -1;
  verdicts.forEach((v, i) => { if (v && (best < 0 || v.score > verdicts[best].score)) best = i; });
  return best;
}

/**
 * Checks one reference picture. Logged to blocky_ai_calls with its cost. Throws when the check can't run.
 * @returns {Promise<{answer: object, verdict: object, costUsd: number}>}
 */
export async function checkAvatar({ admin, apiKey, imageUrl, avatar, fetchLlm = callLlm }) {
  const model = BLOCKY_MODELS.small;
  const t0 = Date.now();
  const user = [{ type: "input_text", text: avatarCheckPrompt(avatar) }, { type: "input_image", image_url: imageUrl, detail: "high" }];
  const log = (row) => admin.from("blocky_ai_calls").insert({ provider: model.provider, model: model.model, purpose: AVATAR_CHECK_PURPOSE, request: { imageUrl, avatar: avatar.name }, completed_at: new Date().toISOString(), ...row });
  try {
    const r = await fetchLlm({ provider: model.provider, model: model.model, apiKey, system: AVATAR_CHECK_SYSTEM, user, schema: avatarCheckSchema(), name: "avatar_check", maxOutputTokens: 2500, timeoutMs: 45_000 });
    const verdict = avatarVerdict(r.data);
    await log({ response: { answer: r.data, verdict }, http_status: r.httpStatus, ok: true, cost_usd: r.costUsd, input_tokens: r.usage?.inputTokens ?? null, output_tokens: r.usage?.outputTokens ?? null, latency_ms: r.latencyMs ?? null });
    return { answer: r.data, verdict, costUsd: r.costUsd };
  } catch (e) {
    const d = e?.details;
    await log({ response: d?.response ?? null, http_status: d?.httpStatus ?? null, ok: false, error: String(e?.message ?? e).slice(0, 300), cost_usd: d?.costUsd ?? 0, latency_ms: Date.now() - t0 });
    throw e;
  }
}
