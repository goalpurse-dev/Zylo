// Blocky Stories: blocky game-avatar characters acting out a story and talking.
// Scope and decisions: docs/roblox-scope.md. Only what differs from the
// engine's built-in (Fruit) wording is here.
//
// Rules that hold in every prompt:
//  - A character is always "a blocky toy avatar". Never an age, never a kid or
//    a child, never a man or a woman.
//  - The style lock below, word for word, in every picture. No "studs" or
//    "studded bricks" anywhere: they drew a brick-toy minifigure and its
//    baseplate in the first test (decision 12).
//  - The library face (decision 10): a solid dark open-mouth shape and oval
//    eyes, a flat decal on a cube head. Flat cartoon teeth are fine; realistic
//    3D teeth, lips, tongue or nose are not (decision 11).
import { BLOCKY_STORIES_NAME } from "./names.js";

const KIND = "a blocky toy avatar";
const voiceOf = (c) => c.voice_style ?? c.voiceStyle;
const toneOf = (emotion) => { const e = String(emotion ?? "").trim().toLowerCase(); return `${/^[aeiou]/.test(e) ? "an" : "a"} ${e} tone`; };

const STYLE = "Style: 3D classic blocky Roblox-style avatars: cube heads, rectangular torsos, block arms and legs, smooth matte plastic, simple flat 2D face decals. A chunky low-poly world built from smooth matte plastic blocks and simple geometric parts. Bright, clean, soft-shadow lighting, playful game-world look. Identical proportions and outfits throughout, no extra limbs. No neon purple or cyan cyberpunk look.";
const NO_BRICK_TOY = "no studs, no studded baseplates, no round minifigure heads, no neck studs, no claw hands, no brick-toy minifigures";
const NEGATIVE = `No text, no letters, no numbers, no captions, no speech bubbles, no name tags, no game interface, no readable writing anywhere, no logos or brand marks (plain unbranded props), no watermark, no extra characters, ${NO_BRICK_TOY}, no human faces or skin, no realistic 3D teeth, lips, tongue or nose.`;
// The style lock in one line, for the shortest wording: the look is never left to the references alone.
const STYLE_SHORT = "Style: blocky Roblox-style avatars with cube heads and flat face decals, in a world of smooth matte plastic blocks; bright soft light.";
const NEGATIVE_SHORT = "No text or readable writing, no logos, no watermark, no extra characters, no studs, no minifigures, no humans.";

export const BLOCKY = Object.freeze({
  id: "blocky",
  name: BLOCKY_STORIES_NAME,
  /** Hidden until launch: the browser and the API both check this flag. */
  flag: "blocky_v1",
  /** Ideas are written per batch from the 10 story engines (scope C1). Not built yet. */
  ideas: "engine",
  /** False until the writer, the series planner and the script editor have their Blocky rules: no story can be made before that. */
  ready: false,

  toolKeys: Object.freeze({ image: "image:blocky-story", v2: "video:blocky-story-v2", v3: "video:blocky-story-v3", v4: "video:blocky-story-v4" }),

  // pictures.js
  picture: Object.freeze({
    style: STYLE,
    styleShort: STYLE_SHORT,
    negative: NEGATIVE,
    negativeShort: NEGATIVE_SHORT,
    face: "Framing: chest up or closer on the speaker, never a full-body shot; the cube head is a quarter to a third of the frame height, the face decal sharp and clearly visible. Keep the place as a soft background.",
    faceShort: "Chest up on the speaker, never full body; the face decal large, sharp, toward the camera.",
    who: (c) => `${c.name} (${KIND})`,
    heads: (cast, short) => (short
      ? "Blocky toy avatars only: cube heads with flat face decals; no humans."
      : `Every character is ${KIND} with a cube head and a flat 2D face decal, in the background too.`),
    referenceLine: (c, i, tier) => (tier === 2
      ? `Image ${i + 1} is ${c.name}: same cube head, face decal and colours.`
      : `Image ${i + 1} is ${c.name}${tier === 0 ? `, ${KIND}` : ""}: keep the cube head, the face decal (eyes and mouth shape), the colours and the outfit exactly as in the reference.`),
    speaking: (scene) => `looking ${scene.emotion} (flat eyebrow lines on the decal may show it), the mouth decal open mid-sentence, speaking toward the camera.`,
    editKeep: "the same characters, cube heads, face decals, outfits, poses, background, lighting and framing",
  }),

  // clips.js
  clip: Object.freeze({
    kind: () => "the blocky toy avatar",
    says: (c, scene) => `says in a ${voiceOf(c)} voice, delivered in ${toneOf(scene.emotion)}`,
    speaking: (c) => `Only ${c.name} speaks, the flat mouth decal on ${c.name}'s face changing shape in sync with every word.`,
    silent: (others, listeners) => ` ${listeners} ${others.length > 1 ? "stay" : "stays"} silent with ${others.length > 1 ? "mouth decals" : "the mouth decal"} closed and still, reacting only with small head movements.`,
    keep: "Keep every character, outfit and the setting exactly as in the first frame. The faces stay flat 2D decals on cube heads: no realistic 3D mouth, teeth, lips, tongue or nose. The bodies stay rigid blocky toys: no bending, warping or melting, no extra limbs, no human skin.",
    keepShort: "Keep everything exactly as in the first frame: flat face decals, rigid blocky bodies.",
  }),

  // plates.js
  plate: Object.freeze({
    style: "Style: a chunky low-poly game world built from smooth matte plastic blocks and simple geometric parts, bright clean soft-shadow light, sharp focus. No studs, no studded baseplates.",
  }),

  // castRules.js: avatars are told apart by colour and silhouette in the library itself.
  cast: Object.freeze({ lookAlikeMessage: () => null }),

  // Not written yet (they need their own rules, not Fruit's drama rules):
  writer: null,   // planner.js: {system, characterBlock}
  series: null,   // series.js: {system, characterLine}
  review: null,   // scriptReview.js: {system, kind}
  check: null,    // pictureCheck.js: {system, prompt, schema, verdict}
  upload: null,   // uploadPackage.js: {system}
});
