// PROPOSED, NOT APPROVED: 28 more avatars, to grow the library from 24 to 52 (owner, 2026-10-08: "50+
// avatars: each needs its own name, role and personality, a clearly different main colour and silhouette
// (signature accessory), and they must never look like real Roblox characters or real creators. Propose the
// list for me to approve before making the pictures").
//
// Nothing here is used by the product. No picture is made from this file until the owner approves the list;
// approved rows then move into roster.mjs.
//
// Same rules as the 24 (roster.mjs): a one-word name, no age and no gender anywhere; the library face (two
// solid eyes and ONE solid dark mouth shape, a flat decal); one head/arm colour that no other avatar has; a
// torso with ONE simple shape (no words, no logos); ONE signature accessory that no other avatar has, worn on
// the avatar (never held), so every silhouette is its own; a voice that says only how it SOUNDS.
// Names: invented or everyday words, checked against the banned real names (safety.js) and against each other.
import { ROSTER, toAvatar } from "./roster.mjs";

/** id, name, head (cube head and block arms), torso, legs, accessory, eyes, mouth, voice, tag, role, tags */
const ROWS = [
  ["moxie", "Moxie", "salmon pink", "a white torso with one red heart shape", "navy blue", "a big red bow block on top of the head", "round", "half", "bright, bold, bouncy", "Streamer", "Films everything and narrates it wrong", ["streamer", "show-off", "friend"]],
  ["bolt", "Bolt", "cobalt blue", "a silver grey torso with one orange hexagon shape", "dark grey", "a red propeller cap", "wide", "wide", "buzzy, eager, quick", "Mechanic", "Fixes the game and breaks it better", ["mechanic", "tinkerer", "helper"]],
  ["sable", "Sable", "chocolate brown", "a cream torso with one orange egg shape", "dark brown", "two tall brown rabbit-ear blocks", "close", "small", "soft, hushed, careful", "Pet collector", "Hatches every egg and trades none", ["pet collector", "hoarder", "kind"]],
  ["tusk", "Tusk", "rust orange", "a dark brown torso with one white tooth shape", "black", "a grey helmet with two white horn blocks", "close", "wide", "big, hoarse, hearty", "Clan leader", "Recruits everyone and promotes nobody", ["clan leader", "boss", "loud"]],
  ["marlo", "Marlo", "sand tan", "a brown torso with one gold horseshoe shape", "dark blue", "a wide brown cowboy hat", "oval", "wedge", "slow, dry, drawling", "Sheriff", "Appointed to the job by nobody and takes it seriously", ["sheriff", "rule keeper", "self-appointed"]],
  ["brine", "Brine", "seafoam green", "a black torso with one white anchor shape", "dark red", "a black three-cornered pirate hat", "wide", "wedge", "gravelly, sing-song, loud", "Treasure hunter", "Digs up the whole map for one chest", ["treasure hunter", "greedy", "explorer"]],
  ["fizz", "Fizz", "violet", "an orange torso with one white rectangle shape", "purple", "a tall pointed purple cone hat", "round", "drop", "sparkly, fast, breathless", "Event host", "Starts the countdown and changes the rules mid-round", ["event host", "countdown", "chaos"]],
  ["pebble", "Pebble", "khaki", "a grey torso with two white dot shapes", "olive green", "a grey beanie with a white pom-pom block", "oval", "small", "sleepy, slow, mumbly", "AFK player", "Never moves and somehow wins", ["afk", "lucky", "mystery"]],
  ["ziggy", "Ziggy", "chartreuse", "a black torso with one white chevron shape", "purple", "a tall green mohawk block", "tall", "wedge", "sharp, cocky, clipped", "Racer", "Takes every shortcut, including the banned one", ["racer", "cheater", "rival"]],
  ["opal", "Opal", "cream", "a pale blue torso with one gold drop shape", "white", "a gold halo ring floating above the head", "round", "half", "gentle, clear, even", "Honest trader", "Gives fair deals and nobody believes it", ["honest", "trader", "too good"]],
  ["grim", "Grim", "brick red", "a black torso with one orange X shape", "dark grey", "two small black horn blocks", "close", "wedge", "sneering, nasal, quick", "Griefer", "Breaks what others build and calls it art", ["griefer", "villain", "troublemaker"]],
  ["lark", "Lark", "periwinkle", "a white torso with one blue cloud shape", "light grey", "two small white block wings on the back", "tall", "small", "airy, high, floating", "Fly hacker", "Floats over every wall and says it's lag", ["fly hacker", "cheater", "liar"]],
  ["orbit", "Orbit", "silver", "a navy blue torso with one orange rocket shape", "white", "a red jetpack with two nozzles", "wide", "half", "crisp, bright, radio-like", "Beta tester", "Plays the update before it exists", ["beta tester", "insider", "pro"]],
  ["basil", "Basil", "olive green", "a cream torso with one brown book shape", "brown", "a flat square black graduation cap", "close", "half", "patient, precise, kindly", "Tutorial guide", "Explains every step and skips the one that matters", ["tutorial guide", "teacher", "helper"]],
  ["glitch", "Glitch", "cyan", "a black torso with one white hourglass shape", "magenta", "an orange traffic cone on the head", "wide", "drop", "stuttering, jumpy, bright", "Lagger", "Arrives three seconds after everything happened", ["lagger", "glitch", "unlucky"]],
  ["pogo", "Pogo", "mustard yellow", "a red torso with one white target shape", "blue", "an upside-down silver bucket on the head", "round", "wide", "loud, cheerful, clumsy", "First-day player", "Presses the wrong button with full confidence", ["new player", "clumsy", "lucky"]],
  ["wren", "Wren", "peach", "a teal torso with one white double-arrow shape", "black", "a long dark red ponytail block", "tall", "small", "tight, focused, fast", "Speedrunner", "Knows the record to the hundredth and hates yours", ["speedrunner", "pro", "rival"]],
  ["clove", "Clove", "plum", "a white torso with one orange paint-drop shape", "dark grey", "a black beret", "oval", "drop", "dreamy, slow, warm", "Decorator", "Redesigns your base while you're still in it", ["decorator", "artist", "bossy"]],
  ["comet", "Comet", "indigo", "a white torso with one gold starburst shape", "pale blue", "one gold spiral horn on the forehead", "round", "small", "sparkling, proud, quick", "Rare hunter", "Owns the rarest pet and keeps checking it's still there", ["rare hunter", "collector", "anxious"]],
  ["mako", "Mako", "denim blue", "a pale grey torso with two white triangle shapes", "dark blue", "a grey shark fin on the back", "close", "wide", "low, hungry, grinning", "Tagger", "Always 'it', always right behind you", ["tagger", "chaser", "hunter"]],
  ["knox", "Knox", "emerald green", "a tan torso with one brown tower shape", "dark green", "a brown turtle-shell block on the back", "oval", "wide", "slow, stubborn, steady", "Defender", "Guards one spot all game and calls it strategy", ["defender", "camper", "stubborn"]],
  ["twig", "Twig", "bronze", "a dark green torso with one white tree shape", "brown", "two branching brown antler blocks", "wide", "half", "calm, woody, slow", "Forest guide", "Leads you the long way on purpose", ["guide", "nature", "trickster"]],
  ["morel", "Morel", "copper", "a white torso with one red dot shape", "tan", "a wide red mushroom-cap hat with white dots", "close", "small", "tiny, squeaky, polite", "Secret keeper", "Knows the hidden room and whispers the wrong way", ["secret", "shy", "mystery"]],
  ["ruse", "Ruse", "pale lemon", "a black torso with one white coin shape", "grey", "a grey-and-black ringed tail", "tall", "wedge", "smooth, quick, too friendly", "Scammer", "Trust-trades first and logs off second", ["scammer", "thief", "liar"]],
  ["zen", "Zen", "gold", "a white torso with one black mountain shape", "black", "a black top-knot bun block", "close", "small", "calm, quiet, certain", "Parkour master", "Has never fallen and has never explained", ["parkour", "master", "mentor"]],
  ["cog", "Cog", "dusty lilac", "a grey torso with one yellow key shape", "dark grey", "a big brass wind-up key on the back", "round", "small", "ticking, even, flat", "Bot", "Farms coins all night and says 'gg' at random", ["bot", "afk farmer", "npc"]],
  ["widget", "Widget", "wine red", "a white torso with one yellow lightbulb shape", "grey", "a glowing yellow lightbulb block on top of the head", "wide", "half", "excited, squeaky, rapid", "Inventor", "Has a plan, a backup plan and no brakes", ["inventor", "schemer", "friend"]],
  ["petal", "Petal", "amber", "a green torso with one pink flower shape", "dark green", "a pink flower block with five petal blocks on top of the head", "round", "half", "sweet, light, humming", "Gardener", "Grows the best base and guards it like a dragon", ["gardener", "builder", "protective"]],
];

/** The 28 proposed avatars, in roster.mjs's shape. */
export const PROPOSED = ROWS.map(toAvatar);
/** The library as it would be: the 24 in the roster, then the 28 proposed. */
export const FULL_ROSTER = [...ROSTER, ...PROPOSED];
