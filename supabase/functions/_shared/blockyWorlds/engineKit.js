// WHAT THE BLENDER ENGINE CAN SHOW (owner 2026-11-21, round 2): one list for the writer (every line must be showable)
// and the director (every shot card may only use these). Keep it in step with scripts/blockyWorlds/blenderKit/worlds/
// worlds.py (places, monsters, faces) and worlds/acts.py (actions, things, effects).
import { LOCATIONS } from "./locations.js";
// round 7 (owner): the lists come FROM THE CODE (scripts/blockyWorlds/blenderKit/genEngineKit.mjs writes this file)
import { GEN_THINGS, GEN_ACTIONS, GEN_PLACES, GEN_RECIPES } from "./engineKitGenerated.js";

export const PLACES = LOCATIONS.filter((l) => GEN_PLACES.includes(l.id)).map((l) => ({ id: l.id, label: l.label, about: l.about }));
/** places a story may use outdoors / indoors (the kit's plane, moon and school sets only when the story is there) */
export const STREET_PLACES = ["downtown_street", "downtown_plaza", "downtown_landmark", "suburb_street", "suburb_porch", "brick_street", "brick_alley"];

/** what people (and monsters) can DO: the card verbs; each maps to one engine helper (cards.mjs) */
const ACTION_TEXT = Object.freeze({
  stand: "stand still (idle)", walk: "walk to a spot / a person / a thing", run_away: "run away from someone or something",
  fall: "fall down and stay down", sit: "sit down (on a bench / chair / the ground)", point: "point at someone or something",
  stomp: "stomp a foot", grab: "grab a thing (it stays in the hand)", throw: "throw a thing at a spot / someone",
  hug: "hug someone", reach: "reach toward someone or something", jump: "jump up", wave: "wave", cheer: "cheer with both arms up",
  shrug: "shrug", facepalm: "hand on face", think: "hand on chin, thinking", hands_head: "hands on head (oh no)",
  talk: "talk (lips move on the line)", laugh: "laugh out loud", cry: "cry", scream: "scream", hide: "hide behind something",
  follow: "follow someone", climb_out: "(monster) climb out of a drain / a hole / the ground", roar: "(monster) roar",
  // round 4: the motion library (worlds/motion.py)
  turn: "turn around (the head first)", look_around: "look around", stand_up: "stand up from sitting", lie_down: "lie down",
  read: "read a book", phone: "look at a phone", kick: "kick a ball", catch: "catch a ball", nod: "nod yes", shake_head: "shake the head no",
  pick_up: "pick a thing up", carry: "carry a thing somewhere", open_door: "open a door", close_door: "close a door", peek: "hide behind something and peek out",
  shiver: "shake with fear",
  // round 6: full actions
  play: "kids play: tag (running round each other) or kick a ball to each other (target = the other kid)", give: "give / sell a thing to someone (target = the person who gets it; the thing in a frame's props)",
  sell: "sell a thing to someone (as give)",
  // round 7: the town's rule + switches
  rule_effect: "THE TOWN'S RULE HAPPENS to this person (the plan's rule effect appears with a pop)", switch_on: "switch ONE chosen lamp / window / porch light on (target = lamp / window / porch_light; who = the person it is near)", switch_off: "switch ONE chosen lamp / window / porch light off",
});
/** what people (and monsters) can DO: only the verbs the card compiler really turns into engine code (generated) */
export const ACTIONS = Object.freeze(Object.fromEntries(GEN_ACTIONS.map((k) => [k, ACTION_TEXT[k] ?? k.replace(/_/g, " ")])));
/** the things the engine can build and animate (worlds/acts.py zw_thing kinds) */
export const THINGS = GEN_THINGS;   // (generated from the prop builders)
/** what can happen to things */
export const EFFECTS = Object.freeze({ pop: "a thing pops into the scene", grow: "a thing grows bigger", shrink: "a thing shrinks",
  rain: "many things fall from the sky", glow: "lamps / windows / signs glow at night",
  rule_effect: "the town's rule: the plan's thing appears with impact (over a head / at the feet / in the hand / from the sky)", switch: "ONE chosen street lamp / window / porch light goes off or on on a word" });
export const RECIPES = GEN_RECIPES;
export const MONSTERS = Object.freeze({ horns: "purple, horns, glowing yellow eyes", slime: "green slime monster, red eyes",
  ember: "red fire monster, yellow eyes", frost: "icy blue monster, pink eyes" });
export const FACES = Object.freeze(["happy", "laughing", "sad", "crying", "scared", "terrified", "shocked", "surprised", "angry", "confused", "smirk", "determined", "neutral"]);
export const TIMES = Object.freeze(["day", "sunset", "night"]);

/** the list as one short text block for a prompt */
export function engineKitText() {
  return [
    "WHAT OUR ENGINE CAN SHOW (every line must be something these can show; nothing else):",
    `- PLACES: ${PLACES.map((p) => `${p.id} (${p.label})`).join("; ")}.`,
    `- TIME: ${TIMES.join(", ")} (night: dark sky, warm street lamps, lit windows, glowing signs).`,
    `- PEOPLE: blocky Roblox-style kids and adults (any colours, hair, hats); faces: ${FACES.join(", ")}.`,
    `- ACTIONS: ${Object.entries(ACTIONS).map(([k, v]) => `${k} (${v})`).join("; ")}.`,
    `- THINGS: ${THINGS.join(", ")} (any of them can be big or small, many or one).`,
    `- EFFECTS: ${Object.entries(EFFECTS).map(([k, v]) => `${k} (${v})`).join("; ")}.`,
    `- MONSTERS (kid-safe, 3-4x a person): ${Object.entries(MONSTERS).map(([k, v]) => `${k}: ${v}`).join("; ")}.`,
    `- SHOT RECIPES: ${RECIPES.join(", ")} (window_lookout: a kid at a window looking out at the street; porch: people on a porch seen from the front yard).`,
    "- NOT POSSIBLE: written text that must be read, tiny details, liquids, fire spreading, flying people, transformations into other shapes, fast fights.",
    "- ONLY THESE. A thing, action or effect that is not on these lists is never written: swap it for the closest thing on the list (a trumpet -> a kazoo), or name it as a NEW PROP (it gets built before the video).",
  ].join("\n");
}
