// Blocky Worlds director: the shared vocabulary (pure data, Node + browser). The capability registry, the matcher, the
// mock director and the AI prompt all read these lists, so a word means the same thing everywhere.

/** page/kit/people.js POSES / EXPRS (kept in step by dev/director.test.mjs) */
export const POSES_N = Object.freeze(["stand", "walk", "run", "point", "scared", "sit", "carry", "wave", "look_up", "talk", "sleep", "cheer", "yell", "sneeze", "blow", "cover_mouth",
  "hug", "climb", "push", "eat", "fall", "jump", "ride", "hide", "throw", "fly", "swim", "build", "dig", "dance", "kick", "fight", "drive"]);
export const EXPRS_N = Object.freeze(["neutral", "happy", "sad", "scared", "surprised", "angry", "sleepy", "smirk", "cry", "excited", "shush", "yell", "sneeze"]);

/** the production list's closed vocabularies (the AI schema's enums) */
export const WORLD_KINDS = Object.freeze(["outdoor", "indoor", "enclosed", "creature", "underwater", "space", "sky"]);
export const BASE_SETS = Object.freeze(["street", "woods", "bedroom", "school"]);
export const CREATURE_RELATIONS = Object.freeze(["none", "inside", "on", "outside"]);
export const ROLES = Object.freeze(["narrator", "kid", "adult", "elder", "baby"]);
export const CHAR_KINDS = Object.freeze(["human", "robot", "animal", "creature", "object"]);
export const SCALES = Object.freeze(["tiny", "small", "human", "big", "giant", "colossal"]);
export const BEHAVIOURS = Object.freeze(["stand", "idle", "lurk", "reach", "reveal", "flee", "walk", "run", "stomp", "roar", "howl", "attack", "chase", "charge", "fly", "swim", "eat", "carry", "sleep", "dig", "climb", "sit", "sniff", "bark", "hop"]); // sit / sniff / bark / hop: PETS 2026-11-07
export const CROWD_ACTIONS = Object.freeze(["stand", "cheer", "wave", "flee", "run", "walk", "march", "charge", "fight", "swarm", "panic", "chase"]);
export const VEHICLE_MOTIONS = Object.freeze(["parked", "drive", "fly", "sail", "crash", "launch", "float"]);
export const PROP_SIZES = Object.freeze(["hand", "object", "big", "landmark"]);
export const EFFECT_KINDS = Object.freeze(["fire", "explosion", "glow", "magic", "transformation", "grow", "shrink", "vanish", "appear", "smoke", "sparkles"]);
export const EVENT_KINDS = Object.freeze(["rain", "snow", "storm", "fog", "wind", "lightning", "flood", "earthquake", "eruption", "tornado", "falling", "eclipse", "meteor", "heatwave", "hail", "night_falls"]);
export const CAMERA_BEATS = Object.freeze(["normal", "scale", "shake", "action", "reveal"]);
export const LIGHTS = Object.freeze(["day", "night", "warm", "dusk", "dawn"]); // WORLD-FIX 2026-11-07: dusk + dawn (lighting.js has both)

/** a verb in a line -> a character action (character.action params) */
export const ACTION_WORDS = Object.freeze({
  walk: "walk,walks,walked,walking,stroll,strolls,wander,wandered,went,goes,go", run: "run,runs,ran,running,raced,race,races,sprint,sprinted,rush,rushed,escaped,escape",
  point: "point,points,pointed,showed", scared: "scared,afraid,froze,freeze,shook,shaking,trembled,screamed,hid", sit: "sit,sits,sat,sitting,seated",
  carry: "carry,carries,carried,hold,holds,held,grab,grabbed,grabs,took,brought", wave: "wave,waves,waved", look_up: "look up,looked up,stared up,gazed up",
  talk: "talk,talks,talked,said,says,told,whispered,asked,called", sleep: "sleep,sleeps,slept,asleep,nap,napped", cheer: "cheer,cheers,cheered,celebrated,clapped",
  yell: "yell,yells,yelled,shout,shouted,scream,screams,roared at", sneeze: "sneeze,sneezes,sneezed", blow: "blew,blow,blows,whistled",
  fly: "fly,flies,flew,flying,soared,floated,float", swim: "swim,swims,swam,swimming,dove,dived,dive", climb: "climb,climbs,climbed,climbing",
  dig: "dig,digs,dug,digging", fight: "fight,fights,fought,punched,battle,battled,wrestled", throw: "throw,throws,threw,tossed,hurled",
  dance: "dance,dances,danced,dancing", ride: "ride,rides,rode,riding", push: "push,pushed,pushes,shoved", hug: "hug,hugs,hugged",
  fall: "fall,falls,fell,tripped,tumbled", jump: "jump,jumps,jumped,leapt,leaped,hopped", eat: "eat,eats,ate,eating,bit,chewed,swallowed,gobbled",
  kick: "kick,kicked,kicks", hide: "hid,hide,hides,hiding", build: "build,built,builds,building", drive: "drive,drove,drives,driving,steered",
});
/** creature behaviour words */
export const BEHAVIOUR_WORDS = Object.freeze({
  stomp: "stomp,stomps,stomped,stomping,trampled,crushed", roar: "roar,roars,roared,growled,growl,bellowed", howl: "howl,howls,howled,howling",
  attack: "attack,attacks,attacked,bit,bite,bites,clawed,snapped,pounced", chase: "chase,chases,chased,hunted,hunts,followed",
  charge: "charge,charges,charged,stampeded,rushed", fly: "fly,flies,flew,flying,swooped,soared", swim: "swim,swims,swam,swimming,surfaced,dove",
  eat: "eat,eats,ate,swallowed,gobbled,devoured,chewed", sleep: "sleep,sleeps,slept,asleep,snored,naps", walk: "walk,walks,walked,wandered,crawled,crawls,lumbered",
  lurk: "lurk,lurks,lurked,watches,watched,waits,waited,hides", reach: "reach,reaches,reached,grabbed,grabs", flee: "fled,flee,ran away,retreated",
  dig: "dig,digs,dug,burrowed", climb: "climb,climbs,climbed",
});
export const CROWD_ACTION_WORDS = Object.freeze({
  march: "march,marches,marched,marching,lined up,parade,paraded", charge: "charge,charges,charged,stampeded,swarmed,attacked,raided,invaded,stormed",
  flee: "fled,flee,ran away,scattered,evacuated,escaped", cheer: "cheer,cheered,cheers,celebrated,clapped,partied", fight: "fight,fought,battle,battled",
  panic: "panic,panicked,screamed", run: "run,ran,raced", chase: "chased,chase,hunted",
});
export const CROWD_NOUNS = Object.freeze({
  army: 200, armies: 400, horde: 150, hordes: 300, pack: 12, packs: 30, herd: 25, herds: 50, flock: 30, flocks: 60, swarm: 200, swarms: 400,
  crowd: 40, crowds: 80, mob: 40, parade: 60, colony: 80, fleet: 12, school: 0, team: 11, everyone: 30, everybody: 30, "whole town": 60, townspeople: 40, villagers: 40, legion: 300, troop: 20, troops: 60,
});
export const NUMBER_WORDS = Object.freeze({ two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20, fifty: 50, hundred: 100, hundreds: 300, thousand: 1000, thousands: 2000, million: 2000, millions: 2000, dozen: 12, dozens: 40 });
export const VEHICLE_WORDS = Object.freeze({
  car: "car,cars,taxi,taxis", bus: "bus,buses,school bus", truck: "truck,trucks,van,vans,ice cream truck,firetruck,fire truck", tractor: "tractor,tractors",
  cart: "cart,carts,wheelbarrow", wagon: "wagon,wagons", skateboard: "skateboard,skateboards", scooter: "scooter,scooters", bike: "bike,bikes,bicycle,bicycles,tricycle",
  boat: "boat,boats,canoe,canoes,raft,rafts,rowboat", ship: "ship,ships,pirate ship,ferry", train: "train,trains,subway,tram", plane: "plane,planes,airplane,airplanes,jet,jets",
  rocket: "rocket,rockets", helicopter: "helicopter,helicopters", submarine: "submarine,submarines", sled: "sled,sleds,sleigh", spaceship: "spaceship,spaceships,ufo,ufos,flying saucer",
  balloon: "hot air balloon,hot-air balloon,blimp",
});
export const EFFECT_WORDS = Object.freeze({
  fire: "fire,fires,flame,flames,burn,burns,burned,burning,blaze,on fire,lava,campfire,bonfire,breathes fire", explosion: "explode,explodes,exploded,explosion,explosions,boom,blast,blew up,burst,kaboom",
  glow: "glow,glows,glowed,glowing,shine,shines,shone,shining", magic: "magic,magical,spell,spells,curse,cursed,enchanted,wizard,witch,potion,portal,portals",
  transformation: "turn into,turns into,turned into,turning into,transform,transforms,transformed,became a,become a,becomes a", grow: "grow,grows,grew,growing,bigger,got huge",
  shrink: "shrink,shrinks,shrank,shrunk,tiny", vanish: "vanish,vanishes,vanished,disappear,disappears,disappeared,gone", appear: "appear,appears,appeared,popped out,pops out",
  smoke: "smoke,smoking,smoky", sparkles: "sparkle,sparkles,sparkled,glitter,glittered",
});
export const EVENT_WORDS = Object.freeze({
  rain: "rain,rains,rained,raining,downpour,drizzle", snow: "snow,snows,snowed,snowing,blizzard", storm: "storm,storms,stormy,thunder,thunderstorm", fog: "fog,foggy,mist,misty",
  wind: "wind,windy,gust,gale", lightning: "lightning,lightning bolt", flood: "flood,flooded the,flooding,water rose,tidal wave,tsunami", earthquake: "earthquake,quake,ground shook,rumble,rumbled",
  eruption: "erupt,erupts,erupted,eruption,lava poured", tornado: "tornado,tornadoes,twister,whirlwind", falling: "falls from the sky,fell from the sky,falls into,fell into,falling sky,raining,rains down,rained down,crashes down,crashed down,the moon falls,the moon fell",
  eclipse: "eclipse,the sun goes out,sun went out", meteor: "meteor,meteors,asteroid,comet,shooting star", heatwave: "heatwave,heat wave,scorching", hail: "hail,hailstorm", night_falls: "night fell,nightfall,sunset,the sun set",
});
export const SCALE_WORDS = /\b(giant|giants|gigantic|huge|enormous|colossal|massive|titanic|towering|mountain-sized|size of a (?:house|mountain|city|building|bus)|bigger than (?:a|the) (?:house|town|mountain|city|school))\b/;
export const TINY_WORDS = /\b(tiny|teeny|miniature|mini|ant-sized|thumb-sized|pocket-sized)\b/;

/** "a,b,c" -> word -> key map (multi-word phrases kept, longest first) */
export function phraseIndex(table) {
  const out = [];
  for (const [k, v] of Object.entries(table)) for (const w of String(v).split(",").map((x) => x.trim()).filter(Boolean)) out.push([w, k]);
  return out.sort((a, b) => b[0].length - a[0].length);
}
const RE_CACHE = new Map();
export const phraseRe = (w) => { if (!RE_CACHE.has(w)) RE_CACHE.set(w, new RegExp(`(?:^|[^a-z'])${w.replace(/[-]/g, "[- ]?").replace(/ /g, "\\s+")}(?![a-z])`)); return RE_CACHE.get(w); };
/** every key of a phrase table found in a (lower-case) text, in order of first appearance */
export function findPhrases(index, low) {
  const hits = [];
  for (const [w, k] of index) { const m = low.match(phraseRe(w)); if (m && !hits.some((h) => h.key === k)) hits.push({ key: k, word: w, at: m.index }); }
  return hits.sort((a, b) => a.at - b.at);
}
