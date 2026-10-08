// The Blocky Stories avatar library, as text: 52 avatars with a locked look
// and a voice (docs/roblox-scope.md C3 and decisions 10, 13, 16).
//
// Rules every entry follows:
//  - a one-word name; no age and no gender anywhere;
//  - face B: a flat decal on a cube head, oval eyes and ONE solid dark
//    open-mouth shape. The eye shape and the mouth shape are the avatar's own
//    and never change; a scene may add flat eyebrow lines for emotion;
//  - a head/arm colour, a torso with ONE simple shape (no words, no logos),
//    legs, and ONE signature accessory, chosen so that any two avatars differ
//    in colour AND in silhouette: no two share a head colour or an accessory, and an accessory is
//    worn, never held, and never a weapon;
//  - the voice says only how it SOUNDS; the scene decides the emotion;
//  - the classic noob (decision 13): yellow cube head and arms, blue torso,
//    green legs, face B, no cap and no accessory.
// Reference pictures are made from avatarPrompt() below (tests 2 and the library run).
import { BLOCKY_BODY, noBrickToy } from "../../supabase/functions/_shared/blocky/look.js";

const EYES = {
  oval: "two solid black upright oval eyes",
  round: "two solid black round eyes",
  wide: "two solid black oval eyes set wide apart",
  close: "two small solid black oval eyes set close together",
  tall: "two tall narrow solid black oval eyes",
  square: "two solid black rounded-square eyes",
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
  // The 28 added on 2026-10-08 (the owner approved the list of 52; Glitch's legs are orange, not magenta:
  // cyan with magenta is the neon pair that is banned everywhere else).
  ["moxie", "Moxie", "salmon pink", "a white torso with one red heart shape", "navy blue", "a big red bow block on top of the head", "round", "wide", "bright, bold, bouncy", "Streamer", "Films everything and narrates it wrong", ["streamer", "show-off", "friend"]],
  ["bolt", "Bolt", "cobalt blue", "a silver grey torso with one orange hexagon shape", "dark grey", "a red propeller cap", "tall", "wide", "buzzy, eager, quick", "Mechanic", "Fixes the game and breaks it better", ["mechanic", "tinkerer", "helper"]],
  ["sable", "Sable", "chocolate brown", "a cream torso with one orange egg shape", "dark brown", "two tall brown rabbit-ear blocks", "close", "small", "soft, hushed, careful", "Pet collector", "Hatches every egg and trades none", ["pet collector", "hoarder", "kind"]],
  ["tusk", "Tusk", "rust orange", "a dark brown torso with one white tooth shape", "black", "a grey helmet with two white horn blocks", "close", "wide", "big, hoarse, hearty", "Clan leader", "Recruits everyone and promotes nobody", ["clan leader", "boss", "loud"]],
  ["marlo", "Marlo", "sand tan", "a brown torso with one gold horseshoe shape", "dark blue", "a wide brown cowboy hat", "oval", "wedge", "slow, dry, drawling", "Sheriff", "Appointed to the job by nobody and takes it seriously", ["sheriff", "rule keeper", "self-appointed"]],
  ["brine", "Brine", "seafoam green", "a black torso with one white anchor shape", "dark red", "a black three-cornered pirate hat", "wide", "wedge", "gravelly, sing-song, loud", "Treasure hunter", "Digs up the whole map for one chest", ["treasure hunter", "greedy", "explorer"]],
  ["fizz", "Fizz", "violet", "an orange torso with one white rectangle shape", "purple", "a tall pointed purple cone hat", "round", "drop", "sparkly, fast, breathless", "Event host", "Starts the countdown and changes the rules mid-round", ["event host", "countdown", "chaos"]],
  ["pebble", "Pebble", "khaki", "a grey torso with two white dot shapes", "olive green", "a grey beanie with a white pom-pom block", "oval", "small", "sleepy, slow, mumbly", "AFK player", "Never moves and somehow wins", ["afk", "lucky", "mystery"]],
  ["ziggy", "Ziggy", "chartreuse", "a black torso with one white chevron shape", "purple", "a tall green mohawk block", "round", "wedge", "sharp, cocky, clipped", "Racer", "Takes every shortcut, including the banned one", ["racer", "cheater", "rival"]],
  ["opal", "Opal", "cream", "a pale blue torso with one gold drop shape", "white", "a gold halo ring floating above the head", "round", "wedge", "clear, even, bell-like", "Honest trader", "Gives fair deals and nobody believes it", ["honest", "trader", "too good"]],
  ["grim", "Grim", "brick red", "a black torso with one orange X shape", "dark grey", "two small black horn blocks", "close", "wedge", "sneering, nasal, quick", "Griefer", "Breaks what others build and calls it art", ["griefer", "villain", "troublemaker"]],
  ["lark", "Lark", "periwinkle", "a white torso with one blue cloud shape", "light grey", "two small white block wings on the back", "tall", "small", "airy, high, floating", "Fly hacker", "Floats over every wall and says it's lag", ["fly hacker", "cheater", "liar"]],
  ["orbit", "Orbit", "silver", "a navy blue torso with one orange rocket shape", "white", "a red jetpack with two nozzles", "wide", "half", "crisp, bright, radio-like", "Beta tester", "Plays the update before it exists", ["beta tester", "insider", "pro"]],
  ["basil", "Basil", "olive green", "a cream torso with one brown book shape", "brown", "a flat square black graduation cap", "close", "half", "patient, precise, kindly", "Tutorial guide", "Explains every step and skips the one that matters", ["tutorial guide", "teacher", "helper"]],
  ["glitch", "Glitch", "cyan", "a black torso with one white hourglass shape", "orange", "an orange traffic cone on the head", "wide", "drop", "stuttering, jumpy, bright", "Lagger", "Arrives three seconds after everything happened", ["lagger", "glitch", "unlucky"]],
  ["pogo", "Pogo", "mustard yellow", "a red torso with one white target shape", "blue", "an upside-down silver bucket on the head", "round", "wide", "loud, bright, tumbling", "First-day player", "Presses the wrong button with full confidence", ["new player", "clumsy", "lucky"]],
  ["wren", "Wren", "peach", "a teal torso with one white double-arrow shape", "black", "a long dark red ponytail block", "tall", "drop", "tight, focused, fast", "Speedrunner", "Knows the record to the hundredth and hates yours", ["speedrunner", "pro", "rival"]],
  ["clove", "Clove", "plum", "a white torso with one orange paint-drop shape", "dark grey", "a black beret", "oval", "drop", "slow, warm, drawn-out", "Decorator", "Redesigns your base while you're still in it", ["decorator", "artist", "bossy"]],
  ["comet", "Comet", "indigo", "a white torso with one gold starburst shape", "pale blue", "one gold spiral horn on the forehead", "tall", "drop", "sparkling, proud, quick", "Rare hunter", "Owns the rarest pet and keeps checking it's still there", ["rare hunter", "collector", "anxious"]],
  ["mako", "Mako", "denim blue", "a pale grey torso with two white triangle shapes", "dark blue", "a grey shark fin on the back", "close", "wedge", "low, hungry, grinning", "Tagger", "Always 'it', always right behind you", ["tagger", "chaser", "hunter"]],
  ["knox", "Knox", "emerald green", "a tan torso with one brown tower shape", "dark green", "a brown turtle-shell block on the back", "oval", "drop", "slow, stubborn, steady", "Defender", "Guards one spot all game and calls it strategy", ["defender", "camper", "stubborn"]],
  ["twig", "Twig", "bronze", "a dark green torso with one white tree shape", "brown", "two branching brown antler blocks", "close", "drop", "woody, slow, creaky", "Forest guide", "Leads you the long way on purpose", ["guide", "nature", "trickster"]],
  ["morel", "Morel", "copper", "a white torso with one red dot shape", "tan", "a wide red mushroom-cap hat with white dots", "square", "small", "tiny, squeaky, polite", "Secret keeper", "Knows the hidden room and whispers the wrong way", ["secret", "shy", "mystery"]],
  ["ruse", "Ruse", "pale lemon", "a black torso with one white coin shape", "grey", "a grey-and-black ringed tail", "square", "wedge", "smooth, quick, too friendly", "Scammer", "Trust-trades first and logs off second", ["scammer", "thief", "liar"]],
  ["zen", "Zen", "gold", "a white torso with one black mountain shape", "black", "a black top-knot bun block", "square", "half", "quiet, level, unhurried", "Parkour master", "Has never fallen and has never explained", ["parkour", "master", "mentor"]],
  ["cog", "Cog", "dusty lilac", "a grey torso with one yellow key shape", "dark grey", "a big brass wind-up key on the back", "wide", "small", "ticking, even, flat", "Bot", "Farms coins all night and says 'gg' at random", ["bot", "afk farmer", "npc"]],
  ["widget", "Widget", "wine red", "a white torso with one yellow lightbulb shape", "grey", "a glowing yellow lightbulb block on top of the head", "tall", "half", "squeaky, rapid, breathless", "Inventor", "Has a plan, a backup plan and no brakes", ["inventor", "schemer", "friend"]],
  ["petal", "Petal", "amber", "a green torso with one pink flower shape", "dark green", "a pink flower block with five petal blocks on top of the head", "wide", "small", "sweet, light, humming", "Gardener", "Grows the best base and guards it like a dragon", ["gardener", "builder", "protective"]],
];

/** One row as an avatar. */
export const toAvatar = ([id, name, head, torso, legs, accessory, eyes, mouth, voice, tag, role, tags]) => {
  if (!EYES[eyes] || !MOUTHS[mouth]) throw new Error(`${id}: unknown eyes or mouth`);
  const face = `${EYES[eyes]} and ${MOUTHS[mouth]}`;
  // The locked look, in the order the scope lists it: colour, face decal, shirt with a simple shape, legs, the one accessory.
  const look = `a ${head} cube head and ${head} block arms, ${torso}, ${legs} block legs${accessory ? `, and ${accessory}` : ""}`;
  return { id, name, head, torso, legs, accessory, eyes, mouth, face, look, voice, tag, role, tags };
};
export const ROSTER = ROWS.map(toAvatar);

/**
 * The reference picture of one avatar: full body on plain white, like the Fruit
 * library's references. The wording is the one test 2 and its re-test settled
 * (decisions 18 to 20): "blocky game avatar" (never "toy"), the "Roblox-style"
 * style line, and the body described by what it IS (BLOCKY_BODY).
 *   template: Image 1 is a body to copy (the Lite Noob reference); the caller sends that picture first.
 *   minifigure: also name the minifigure parts in the leave-out list.
 */
export function avatarPrompt(a, { template = REF_DEFAULTS.template, minifigure = REF_DEFAULTS.minifigure } = {}) {
  return [
    `Full-body 3D character reference of ${a.name}, a blocky game avatar. Centered on a pure white background, entire body visible from head to feet, standing straight, ${FRONT_VIEW}, block arms relaxed at the sides.`,
    template ? BODY_TEMPLATE_LINE : "",
    `${a.name} has ${a.look}.`,
    CUBE_HEAD,
    `The face is a flat decal printed on the front of the cube head: ${a.face}. ${FLAT_MOUTH} No nose, no eyebrows, no ears.`,
    ...(a.accessory ? [BLOCKY_PARTS] : []),
    "The torso shape is a plain flat print, no words.",
    BLOCKY_BODY,
    REF_STYLE,
    "Soft even studio lighting, a subtle contact shadow under the feet, a clean readable silhouette, 9:16 vertical framing.",
    `No text, no letters, no numbers, no logos, no background, no props, no extra characters, no extra limbs, ${noBrickToy({ minifigure })}, no human face or skin, no realistic 3D teeth, lips, tongue or nose.`,
  ].filter(Boolean).join(" ");
}
// The four fixes from the owner's review of the first Pro references (2026-10-06; wording 2026-10-08):
/** Front view. */
export const FRONT_VIEW = "seen straight from the front at eye level, the head square to the camera, not turned";
/** The head: a cube with flat faces (one Pro reference came out with a rounded head). */
export const CUBE_HEAD = "The head is a cube: six flat faces and straight edges, not a sphere, a cylinder or a rounded blob.";
/** The mouth: one flat printed shape. */
export const FLAT_MOUTH = "The mouth is one flat printed shape: no teeth, no tongue, no lips, no depth.";
/** Hair and accessories are blocks too, never strands, fur or cloth. */
export const BLOCKY_PARTS = "Hair, hats and every accessory are built from a few simple solid blocks with flat faces and straight edges: no hair strands, no fur, no cloth folds.";
export const REF_STYLE = "Style: a 3D classic blocky Roblox-style avatar in smooth matte plastic with a simple flat 2D face decal.";
/** How the body template is labelled when it is sent as the first reference image (decision 20). */
export const BODY_TEMPLATE_LINE = "Image 1 shows the body construction to copy exactly; ignore its colours, face and outfit.";
/**
 * The combination the library is drawn with, from the re-test (2026-10-06):
 *   template false: with the Lite Noob as a body template the picture copied the Noob's own
 *     flaws (a rounded head, small hand blocks, the notch between the legs);
 *   minifigure true: the one picture that left the minifigure parts unnamed still had the hip
 *     notch, and the four that named them did not, so naming them does not prime them.
 */
export const REF_DEFAULTS = { template: false, minifigure: true };
