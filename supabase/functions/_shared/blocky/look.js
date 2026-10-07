// The Blocky Stories look: every sentence a picture or clip prompt says about
// what a character IS and how the world looks. Scope and decisions:
// docs/roblox-scope.md.
//
// Rules that hold in every prompt:
//  - A character is always "a blocky game avatar". Never an age, never a kid or
//    a child, never a man or a woman. Never "toy": the word drew brick-toy
//    minifigures in test 2 (decision 18).
//  - The body is described by what it IS (BLOCKY_BODY, decision 19): a list of
//    things to leave out was not enough to keep minifigure hands, hips and necks away.
//  - No "studs" or "studded bricks" anywhere but in the leave-out list: they
//    drew a brick-toy minifigure and its baseplate in the first test (decision 12).
//  - The library face (decision 10): a solid dark open-mouth shape and oval
//    eyes, a flat decal on a cube head. Flat cartoon teeth are fine; realistic
//    3D teeth, lips, tongue or nose are not (decision 11).
import { toneOf } from "./wording.js";

export const KIND = "a blocky game avatar";
const voiceOf = (c) => c.voice_style ?? c.voiceStyle;

/** How an avatar's body is built, word for word in every reference picture and every scene picture (decision 19). */
export const BLOCKY_BODY = "Body construction: the torso is one plain rectangular box. Each arm is one straight rectangular block with a flat square end — no hands, no fingers, no grip. The two legs are two separate straight rectangular blocks side by side, each half the torso's width, attached flat to the bottom of the torso — no hip piece, no notch between them, no separate feet. The cube head sits directly on top of the torso — no neck.";
/** The same, in one sentence, for the shortest picture wording. */
const BLOCKY_BODY_SHORT = "Bodies: a cube head directly on a plain box torso (no neck), straight block arms with flat square ends (no hands), two separate straight block legs (no hip piece, no feet).";

// Kept tight: with the body text, a two- or three-avatar scene must still fit the picture prompt limit at a full wording.
const STYLE = `Style: 3D classic blocky Roblox-style avatars in smooth matte plastic with flat 2D face decals, in a low-poly world of smooth matte plastic blocks and simple geometric parts. Bright, clean, soft-shadow light. No neon purple or cyan cyberpunk look. ${BLOCKY_BODY}`;
/** What every Blocky picture leaves out of the brick-toy look. minifigure: also name the minifigure parts (the re-test kept them named, decision 24). */
export const noBrickToy = ({ minifigure = true } = {}) => (minifigure
  ? "no studs, no studded baseplates, no round minifigure heads, no neck studs, no claw hands, no brick-toy minifigures"
  : "no studs, no studded baseplates");
const NEGATIVE = `No text, letters or numbers, no captions, name tags or game interface, no logos or brand marks, no watermark, no extra characters, ${noBrickToy()}, no human faces or skin, no realistic 3D teeth, lips, tongue or nose.`;
// The style lock in one line, for the shortest wording: the look is never left to the references alone.
const STYLE_SHORT = `Style: blocky Roblox-style avatars with flat face decals, in a world of smooth matte plastic blocks; bright soft light. ${BLOCKY_BODY_SHORT}`;
const NEGATIVE_SHORT = "No text or readable writing, no logos, no watermark, no extra characters, no studs, no minifigures, no humans.";

/** Scene pictures (pictures.js). */
export const PICTURE = Object.freeze({
  style: STYLE,
  styleShort: STYLE_SHORT,
  negative: NEGATIVE,
  negativeShort: NEGATIVE_SHORT,
  face: "Framing: chest up or closer on the speaker, never full body; the cube head is a quarter to a third of the frame height, the face decal sharp. Keep the place as a soft background.",
  faceShort: "Chest up on the speaker, never full body; the face decal large, sharp, toward the camera.",
  who: (c) => `${c.name} (${KIND})`,
  heads: (cast, short) => (short
    ? "Blocky game avatars only: cube heads with flat face decals; no humans."
    : `Everyone, in the background too, is ${KIND} with a cube head and a flat face decal.`),
  referenceLine: (c, i, tier) => (tier === 0
    ? `Image ${i + 1} is ${c.name}: keep its cube head, face decal (eyes and mouth shape), colours and outfit exactly.`
    : `Image ${i + 1} is ${c.name}: same cube head, face decal and colours.`),
  speaking: (scene) => `looking ${scene.emotion} (flat eyebrow lines may show it), mouth decal open mid-sentence, speaking toward the camera.`,
  editKeep: "the same characters, cube heads, face decals, outfits, poses, background, lighting and framing",
});

/** Clips (clips.js). */
export const CLIP = Object.freeze({
  kind: () => "the blocky game avatar",
  says: (c, scene) => `says in a ${voiceOf(c)} voice, delivered in ${toneOf(scene.emotion)}`,
  speaking: (c) => `Only ${c.name} speaks, the flat mouth decal on ${c.name}'s face changing shape in sync with every word.`,
  silent: (others, listeners) => ` ${listeners} ${others.length > 1 ? "stay" : "stays"} silent with ${others.length > 1 ? "mouth decals" : "the mouth decal"} closed and still, reacting only with small head movements.`,
  keep: "Keep every character, outfit and the setting exactly as in the first frame. The faces stay flat 2D decals on cube heads: no realistic 3D mouth, teeth, lips, tongue or nose. The bodies stay rigid blocky game avatars: no bending, warping or melting, no extra limbs, no human skin.",
  keepShort: "Keep everything exactly as in the first frame: flat face decals, rigid blocky bodies.",
});

/** Location plates (plates.js). */
export const PLATE_STYLE = "Style: a chunky low-poly game world built from smooth matte plastic blocks and simple geometric parts, bright clean soft-shadow light, sharp focus. No studs, no studded baseplates.";
