// The Blocky Stories avatar library, as text: 24 avatars with a locked look
// and a voice (docs/roblox-scope.md C3 and decisions 10, 13, 16).
//
// Rules every entry follows:
//  - a one-word name; no age and no gender anywhere;
//  - face B: a flat decal on a cube head, oval eyes and ONE solid dark
//    open-mouth shape. The eye shape and the mouth shape are the avatar's own
//    and never change; a scene may add flat eyebrow lines for emotion;
//  - a head/arm colour, a torso with ONE simple shape (no words, no logos),
//    legs, and ONE signature accessory, chosen so that any two avatars differ
//    in colour AND in silhouette;
//  - the voice says only how it SOUNDS; the scene decides the emotion;
//  - the classic noob (decision 13): yellow cube head and arms, blue torso,
//    green legs, face B, no cap and no accessory.
// Reference pictures are made from avatarPrompt() below (tests 2 and the library run).
import { BLOCKY } from "../../supabase/functions/_shared/fruit/niches/blocky.js";

const EYES = {
  oval: "two solid black upright oval eyes",
  round: "two solid black round eyes",
  wide: "two solid black oval eyes set wide apart",
  close: "two small solid black oval eyes set close together",
  tall: "two tall narrow solid black oval eyes",
};
const MOUTHS = {
  half: "one solid dark half-circle open mouth",
  wide: "one wide solid dark rounded-rectangle open mouth",
  small: "one small solid dark oval open mouth",
  wedge: "one solid dark open mouth shaped like a wide wedge, higher on one side",
  drop: "one solid dark open mouth shaped like a rounded triangle, point down",
};

/** id, name, head (cube head and block arms), torso, legs, accessory, eyes, mouth, voice, tag, role, tags */
const ROWS = [
  ["noob", "Noob", "bright yellow", "a plain royal blue torso with no shape on it", "green", null, "oval", "half", "bright, small, slightly wobbly", "New player", "Lost, honest and luckier than they look", ["new player", "innocent", "underdog"]],
  ["vex", "Vex", "white", "a crimson red torso with one yellow lightning-bolt shape", "black", "a tall black top hat", "tall", "wide", "low, slow, flat", "Admin", "Cold rule keeper who enjoys the power", ["admin", "villain", "rule keeper"]],
  ["taz", "Taz", "orange", "a navy blue torso with one white circle shape", "grey", "green headphones", "wide", "wedge", "raspy, loud, fast", "Trader", "Hot-headed deal maker who can't walk away", ["trader", "hothead", "rival"]],
  ["lux", "Lux", "sky blue", "a hot pink torso with one white diamond shape", "white", "a small gold crown", "round", "small", "bright, clipped, polished", "Collector", "Owns every rare item and wants one more", ["rich", "collector", "show-off"]],
  ["kodo", "Kodo", "forest green", "a sand yellow torso with one brown triangle shape", "brown", "a round orange backpack", "oval", "wide", "warm, steady, unhurried", "Explorer", "Knows every hidden room on the map", ["explorer", "helper", "guide"]],
  ["rook", "Rook", "charcoal grey", "a black torso with one white square shape", "dark red", "a black hood pulled up over the head", "close", "small", "quiet, breathy, even", "Exploiter", "Finds the glitch nobody else can see", ["hacker", "mystery", "loner"]],
  ["pixi", "Pixi", "pink", "a white torso with one yellow sun shape", "mint green", "two short pink pigtail blocks", "round", "half", "high, bubbly, fast", "Prankster", "Starts the joke and can't stop it", ["prankster", "friend", "chaos"]],
  ["tank", "Tank", "red", "a grey torso with one black shield shape", "black", "a silver open-face knight helmet", "close", "wide", "deep, booming, slow", "Guard", "Blocks the door and follows orders", ["guard", "muscle", "loyal"]],
  ["zip", "Zip", "lime green", "a white torso with one black upward arrow shape", "black", "an orange sweatband", "wide", "drop", "quick, breathless, light", "Obby runner", "Fastest on the tower and knows it", ["obby runner", "speedrunner", "pro"]],
  ["coral", "Coral", "coral red", "a teal torso with one white wave shape", "navy blue", "a white captain's cap", "oval", "wedge", "clear, firm, crisp", "Owner", "Runs the server like a ship", ["owner", "boss", "leader"]],
  ["byte", "Byte", "pale grey", "a dark blue torso with one green square shape", "grey", "one thin antenna with a red ball on top", "round", "small", "flat, even, slightly metallic", "NPC", "Says the same line until something breaks", ["npc", "bot", "shopkeeper"]],
  ["blaze", "Blaze", "black", "an orange torso with one yellow flame shape", "red", "a block of spiky orange hair", "tall", "wedge", "rough, growly, slow", "Bully", "Takes the spawn pad and dares you to complain", ["bully", "villain", "rival"]],
  ["frost", "Frost", "ice blue", "a navy blue torso with one white snowflake shape", "light grey", "a long blue scarf", "tall", "small", "soft, cool, measured", "Pro", "Never loses and never explains how", ["pro", "rival", "mystery"]],
  ["mint", "Mint", "mint green", "a white torso with one green leaf shape", "dark green", "a round straw hat", "round", "half", "soft, slow, sing-song", "Helper", "Gives away items and asks one small favour", ["helper", "kind", "secret"]],
  ["onyx", "Onyx", "deep purple", "a black torso with one white crescent-moon shape", "black", "a long dark cape", "close", "drop", "smooth, low, whispery", "Secret admin", "Watches every server and never types", ["secret admin", "shadow", "mystery"]],
  ["dash", "Dash", "royal blue", "a white torso with one red circle shape", "red", "white goggles pushed up on the forehead", "wide", "wide", "sharp, punchy, quick", "Show-off", "Bets everything on being first", ["pro", "show-off", "gambler"]],
  ["quill", "Quill", "teal", "a yellow torso with one black star shape", "black", "big round glasses", "close", "half", "thin, precise, nasal", "Strategist", "Reads every rule and finds the loophole", ["strategist", "nerd", "rule lawyer"]],
  ["jinx", "Jinx", "magenta", "a black torso with one pink zigzag shape", "grey", "a black cat-ear headband", "tall", "wedge", "silky, lilting, sing-song", "Trickster", "Makes a deal that sounds too good", ["trickster", "scammer", "prankster"]],
  ["flint", "Flint", "slate blue", "a brown torso with one orange gear shape", "dark grey", "a yellow hard hat", "oval", "wide", "gruff, plain, steady", "Builder", "Built the map and hid something in it", ["builder", "worker", "secret"]],
  ["nova", "Nova", "lavender", "a white torso with one yellow ring shape", "silver grey", "a headband with two silver star antennae", "round", "drop", "airy, light, slow", "Newcomer", "Just joined and already knows too much", ["newcomer", "dreamer", "mystery"]],
  ["patch", "Patch", "turquoise", "a red torso with one white pocket-square shape", "blue", "a tall white chef hat", "wide", "half", "round, bouncy, rolling", "Shopkeeper", "Sells anything and remembers every debt", ["shopkeeper", "trader", "gossip"]],
  ["baron", "Baron", "maroon", "a gold torso with one black bow-tie shape", "black", "a gold chain with one big plain round medallion", "oval", "small", "plummy, slow, rounded", "Rich trader", "Buys the server and reads nobody the terms", ["rich", "scammer", "boss"]],
  ["echo", "Echo", "navy blue", "a pale yellow torso with one navy spiral shape", "white", "a white bandana tied around the head", "tall", "half", "hollow, even, distant", "Ghost player", "Was banned long ago and is still here", ["ghost", "mystery", "friend"]],
  ["rex", "Rex", "dark green", "a yellow torso with three green stripe shapes", "brown", "a green dinosaur tail with small back spikes", "wide", "wide", "loud, cracking, rubbery", "Clown", "Presses every button, especially the red one", ["clown", "chaos", "friend"]],
];

export const ROSTER = ROWS.map(([id, name, head, torso, legs, accessory, eyes, mouth, voice, tag, role, tags]) => {
  const face = `${EYES[eyes]} and ${MOUTHS[mouth]}`;
  // The locked look, in the order the scope lists it: colour, face decal, shirt with a simple shape, legs, the one accessory.
  const look = `a ${head} cube head and ${head} block arms, ${torso}, ${legs} block legs${accessory ? `, and ${accessory}` : ""}`;
  return { id, name, head, torso, legs, accessory, eyes, mouth, face, look, voice, tag, role, tags };
});

/** The two wordings test 2 compares for the reference pictures. */
export const REF_STYLES = {
  roblox: "Style: a 3D classic blocky Roblox-style avatar: cube head, rectangular torso, block arms and legs, smooth matte plastic, a simple flat 2D face decal.",
  toy: "Style: a 3D blocky toy figure: cube head, rectangular torso, block arms and legs, smooth matte plastic, a simple flat 2D face decal.",
};

/** The reference picture of one avatar: full body, plain white background, like the Fruit library's references. */
export function avatarPrompt(a, style = "roblox") {
  return [
    `Full-body 3D character reference of ${a.name}, a blocky toy avatar. Centered on a pure white background, entire body visible from head to feet, standing straight facing the camera, block arms relaxed at the sides.`,
    `${a.name} has ${a.look}.`,
    `The face is a flat decal printed on the front of the cube head: ${a.face}. No nose, no eyebrows, no ears.`,
    "The torso shape is a plain flat print, no words.",
    REF_STYLES[style],
    "Soft even studio lighting, a subtle contact shadow under the feet, a clean readable silhouette, 9:16 vertical framing.",
    `No text, no letters, no numbers, no logos, no background, no props, no extra characters, no extra limbs, ${BLOCKY_NO_BRICK_TOY}, no human face or skin, no realistic 3D teeth, lips, tongue or nose.`,
  ].join(" ");
}
// The same "leave out" list every Blocky picture carries (decision 12), read from the niche so there is one wording.
const BLOCKY_NO_BRICK_TOY = BLOCKY.picture.negative.match(/no studs.*?minifigures/)[0];
