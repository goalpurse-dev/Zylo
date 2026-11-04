// Blocky Worlds: the CAPABILITY REGISTRY (owner: DIRECTOR, 2026-11-05). Pure data + two helpers, Node + browser.
//
// The owner's goal: whatever the user types, the engine builds the whole world and video for it, as a COMBINATION of
// general systems, never one special case at a time. The story director (lib/director/) writes a production list; the
// matcher (lib/director/match.js) turns every item of it into calls on the systems below. What no system can do yet is
// logged as a capability gap (lib/gaps.js) and shown by the clearest fallback (a picture card of that thing): never a
// failed run (docs/blocky-worlds-protocol.md, PERMANENT RULE).
//
//   CAPABILITIES[id] = {
//     id, group, does,                    what the system does, in one line
//     status: "ready" | "partial" | "planned"   honest, today (2026-11-05)
//     module,                             the file(s) that implement it (or will)
//     owner,                              the agent / system that builds it
//     params: { name: { ready: [...], partial?: [...], planned?: [...] } | { readyMax, plannedMax } | "text" }
//                                         what the director may ask for, and which values work today
//     fallback,                           what the engine shows when a request can't be met (always the thing itself
//                                         or a clear picture card of it)
//     via?: "builder",                    a capability the real-time builder (lib/builder) can meet at runtime
//     files?: [...]                       engine files whose presence means the module has landed (installedStatus)
//   }
// supports(id, params) -> { ok, status, unsupported: ["action=charge", ...] } (per-parameter honesty)
// When EPIC / BUILDER finish a system, flip its status here (and the params' ready lists) in the same commit: the
// matcher, the gap log and the stress report follow on their own.

import { POSES_N, EXPRS_N } from "./director/vocab.js";
// EPIC's own vocabulary (lib/epic.js, pure): what its giants / crowds / creature worlds / cameras really do
import { GIANT_KINDS, GIANT_ACTIONS, CROWD_ACTIONS as EPIC_CROWD_ACTIONS, CROWD_KINDS, WORLD_VIEWS, SHAKES, BEAT_TYPES, EPIC_CAMERAS } from "./epic.js";

const P = (ready, planned = [], partial = [], other = null) => ({ ready: [...ready], partial: [...partial], planned: [...planned], ...(other ? { other } : {}) });
const GIANT_SPECIES = GIANT_KINDS.filter((k) => k !== "generic" && k !== "giant_human");

export const STATUS = Object.freeze(["ready", "partial", "planned"]);
const RANK = { ready: 0, partial: 1, planned: 2 };
export const worse = (a, b) => (RANK[a] >= RANK[b] ? a : b);

export const CAPABILITIES = Object.freeze(Object.fromEntries([
  // ------------------------------------------------------------------ worlds
  { id: "world.outdoor", group: "world", status: "ready",
    does: "an outdoor place: the hand-built street and woods sets; any other outdoor place (a beach, a volcano, a farm field) as a built world spec",
    module: "page/sets/street.js, page/sets/woods.js; page/sets/worldspec.js (built places)", owner: "SETS + BUILDER",
    params: { set: P(["street", "woods"], [], ["built"]), ground: P(["grass", "asphalt", "dirt"], [], ["sand", "rock", "snow", "gravel", "water", "moon"]), light: P(["day", "night", "warm"]) },
    fallback: "the nearest of the 4 sets (street / woods)", via: "builder" },
  { id: "world.indoor", group: "world", status: "ready",
    does: "an indoor place: the hand-built bedroom (home) and school sets; any other room (a dentist's office, a bakery inside) as a built world spec",
    module: "page/sets/bedroom.js, page/sets/school.js; page/sets/worldspec.js", owner: "SETS + BUILDER",
    params: { set: P(["bedroom", "school"], [], ["built"]), light: P(["day", "night", "warm"]) },
    fallback: "the nearest of the 4 sets (bedroom / school)", via: "builder" },
  { id: "world.enclosed", group: "world", status: "partial",
    does: "an enclosed place built at runtime from a world spec: cave, room, sky, underwater, space, inside a creature (walls with ribs/scales)",
    module: "page/sets/worldspec.js + lib/builder (validateWorld)", owner: "BUILDER",
    params: { enclosure: P([], [], ["cave", "room", "sky", "inside_creature", "underwater", "space"]), particles: P([], [], ["dust", "bubbles", "snow", "spores"]) },
    fallback: "the nearest of the 4 sets + a picture card of the place on its first line", via: "builder", files: ["page/sets/worldspec.js"] },
  { id: "world.creature", group: "world", status: "partial",
    does: "a town that IS a creature: inside it, on its back, or outside next to it (a city on a whale, a town inside a giant turtle), at true scale",
    module: "page/sets/creatureWorld.js (buildCreatureWorld inside | on, buildCreatureOutside) + page/kit/giants.js; landed 2026-11-05, being wired into plan.mjs", owner: "EPIC",
    params: { relation: P(WORLD_VIEWS), species: P(GIANT_SPECIES, [], [], "partial"), scaleM: { readyMax: 200, plannedMax: 200 } },
    fallback: "inside: a built enclosure (inside_creature walls); on / outside: the nearest set + a picture card of the creature", files: ["page/sets/creatureWorld.js"] },
  { id: "world.travel", group: "world", status: "partial",
    does: "several places in one video, each line in its own place",
    module: "plan.mjs (a set per shot); lib/builder (one built world per video today)", owner: "PLANNER + BUILDER",
    params: { worlds: { readyMax: 4, plannedMax: 6 }, built: { readyMax: 1, plannedMax: 3 } },
    fallback: "the extra places on the nearest of the 4 sets" },

  // ------------------------------------------------------------------ people
  { id: "character", group: "people", status: "ready",
    does: "a blocky person (kid, adult, elder, baby) with seeded clothes/hair, a pose and a face sticker",
    module: "page/kit/people.js (makePerson, posePerson, setFace)", owner: "KIT",
    params: { role: P(["narrator", "kid", "adult", "elder", "baby"]), pose: P(POSES_N), expr: P(EXPRS_N), look: P([], ["costume", "uniform", "robot", "animal_head", "giant"], ["seeded"]) },
    fallback: "a townsperson in the nearest pose; the name on a tag" },
  { id: "character.action", group: "people", status: "partial",
    does: "what a person does in a line: a pose cycle (walk, run, point, carry, cheer, yell, sleep, sit...)",
    module: "page/kit/people.js POSES", owner: "KIT",
    params: { action: P(POSES_N, ["fly", "swim", "climb", "dig", "fight", "throw", "dance", "ride", "push", "hug", "fall", "jump", "eat", "kick", "hide", "build", "drive"], []) },
    fallback: "the nearest pose (stand / point / scared) + the thing acted on in frame" },

  // ------------------------------------------------------------------ creatures
  { id: "creature.monster", group: "creatures", status: "ready",
    does: "the story's monster: a tall or furry rig dressed as one of 15 looks (dragon, bird, serpent, squid, fish, goblin, stump, giant, scarecrow, beast, boxy, yeti, troll, ghost, mannequin) or a species",
    module: "page/kit/monsters.js (makeMonster, animateMonster) + lib/catalog.js CREATURES", owner: "KIT",
    params: { behaviour: P(["lurk", "reach", "reveal", "flee"], ["walk", "stomp", "roar", "attack", "chase", "fly", "swim", "eat", "carry", "sleep"], []), scale: P(["human", "big"], ["giant", "colossal"], []) },
    fallback: "the closest look, in its lurk / reveal state" },
  { id: "creature.animal", group: "creatures", status: "ready",
    does: "an animal as a scene object (31 species: dog, cat, wolf, turtle, whale, bear, pigeon...) standing in the shot, up to 3 per shot",
    module: "page/kit/things.js (ANIMALS) + lib/catalog.js", owner: "COVERAGE",
    params: { behaviour: P(["stand", "idle"], ["walk", "run", "attack", "howl", "fly", "swim", "eat", "sleep", "charge", "chase"], []), count: { readyMax: 3, plannedMax: 2000 } },
    fallback: "the animal standing (no motion) + the action named on a badge" },
  { id: "creature.small", group: "creatures", status: "ready",
    does: "a small creature that is not the monster (dragon, goblin, yeti, troll, ghost, giant, scarecrow, robot, alien, mannequin, unicorn) as a scene object",
    module: "page/kit/things.js (CREATURE_OBJECTS)", owner: "COVERAGE",
    params: { kind: P(["dragon", "goblin", "yeti", "troll", "ghost", "giant", "scarecrow", "robot", "alien", "mannequin", "unicorn"]) },
    fallback: "a built blueprint of it, else a picture card", via: "builder" },
  { id: "creature.built", group: "creatures", status: "partial",
    does: "a creature the kit has no look for (a zombie, a mermaid, a vampire, a jellyfish) as a builder blueprint: standing, with simple loop anims (bob, wobble, blink); no walking or attacking rig",
    module: "lib/builder (blueprint) + page/kit/blueprint.js animateBlueprint", owner: "BUILDER",
    params: { behaviour: P(["stand", "idle", "lurk"], ["walk", "run", "stomp", "roar", "attack", "chase", "charge", "fly", "swim", "eat", "carry", "sleep", "reach", "reveal", "flee", "dig", "climb", "howl"]) },
    fallback: "the built creature standing in frame (+ the action named on a badge), else a picture card", via: "builder" },
  { id: "giant", group: "creatures", status: "partial",
    does: "a creature or person at giant scale (10-200 m): any animal, walking, stomping, roaring, attacking, seen from street level",
    module: "page/kit/giants.js (makeGiant / animateGiant: 12 presets, any other species as the generic giant; landed 2026-11-05, being wired into plan.mjs); a giant builder blueprint (static) otherwise", owner: "EPIC",
    params: { species: P(GIANT_SPECIES.concat(["human"]), [], [], "partial"), behaviour: P([...GIANT_ACTIONS, "stand", "charge", "chase"], ["fly", "eat", "sleep", "dig", "climb", "carry", "howl"]), heightM: { readyMax: 200, plannedMax: 200 } },
    fallback: "a built giant blueprint standing far off (static), else the monster rig at its largest, else a picture card", via: "builder", files: ["page/kit/giants.js"] },

  // ------------------------------------------------------------------ crowds
  { id: "crowd", group: "crowds", status: "partial",
    does: "many of one kind at once (1-2000, instanced): townsfolk, soldiers, knights, wolf soldiers; standing, marching, charging, fleeing, cheering, fighting",
    module: "page/kit/crowd.js (makeCrowd / updateCrowd; landed 2026-11-05, being wired into plan.mjs); plan.mjs group shots (up to ~6 people) before that", owner: "EPIC",
    params: { kind: P(CROWD_KINDS, ["animal", "robot", "creature", "vehicle", "kid"]), action: P([...EPIC_CROWD_ACTIONS, "walk", "panic"], ["swarm", "chase", "fly", "swim", "dance"]), count: { readyMax: 2000, plannedMax: 2000 } },
    fallback: "the nearest crowd kind (townsfolk / soldier) or 3 copies of the creature + a count badge (x100)", files: ["page/kit/crowd.js"] },

  // ------------------------------------------------------------------ things
  { id: "object", group: "things", status: "ready",
    does: "a scene object from the kit catalog (~110 names: buildings, weather objects, furniture, farm, underground, town things)",
    module: "page/kit/objects.js + page/kit/things.js; lib/visuals.js OBJECT_CATALOG", owner: "OBJECTS + COVERAGE",
    params: { name: "text", state: "text" }, fallback: "a built blueprint, else a picture card" },
  { id: "object.built", group: "things", status: "partial",
    does: "any object the kit lacks, designed at runtime as a block blueprint, checked by a still + an AI vision check, saved to the shared library",
    module: "lib/builder (resolveNeeds) + page/kit/blueprint.js", owner: "BUILDER",
    params: { name: "text", giant: P([false], [], [true]) },
    fallback: "a picture card of that thing", via: "builder", files: ["page/kit/blueprint.js"] },
  { id: "prop.held", group: "things", status: "ready",
    does: "a hand prop in a person's hand (~60 builders, ~400 words: sock, key, tape, wand, lantern, letter, sandwich...)",
    module: "page/kit/props.js makeHeld + page/kit/heldMore.js; lib/catalog.js HELD", owner: "KIT + COVERAGE",
    params: { name: "text" }, fallback: "the prop as a built blueprint on a crate (item), else a picture card", via: "builder" },
  { id: "vehicle", group: "things", status: "partial",
    does: "a vehicle: car, bus, ice cream truck, tractor / cart / wagon, skateboard / scooter today (parked); any other (boat, train, rocket, plane) as a built blueprint",
    module: "page/kit/objects.js (car, ice_cream_truck), page/sets/street.js (bus), page/kit/things.js (tractor)", owner: "OBJECTS",
    params: { kind: P(["car", "bus", "truck", "tractor", "cart", "wagon", "skateboard", "scooter", "bike"], [], ["boat", "ship", "train", "plane", "rocket", "helicopter", "submarine", "sled", "spaceship", "balloon"]), motion: P(["parked"], ["drive", "fly", "sail", "crash", "launch", "float"]) },
    fallback: "the vehicle parked (built blueprint if not in the kit), else a picture card", via: "builder" },
  { id: "flying", group: "motion", status: "planned",
    does: "people, creatures or vehicles off the ground: flying, floating, falling from the sky, with the camera following",
    module: "(planned) a motion path per actor in the timeline + page/engine.js", owner: "EPIC / RENDER",
    params: { who: P([], ["person", "creature", "vehicle", "object"]) },
    fallback: "the thing in frame with pose look_up from the others; a card for the act if nothing else" },
  { id: "underwater", group: "motion", status: "planned",
    does: "swimming people and creatures, bubbles, a water surface seen from below",
    module: "world.enclosed underwater (BUILDER, partial) + (planned) swim poses", owner: "BUILDER + KIT",
    params: { action: P([], ["swim", "dive", "sink", "float"]) },
    fallback: "an underwater built world with everyone standing; else the porthole object" },

  // ------------------------------------------------------------------ effects
  { id: "fx.fire", group: "effects", status: "planned",
    does: "fire and flames on a thing or a place (a burning house, a dragon's breath, a campfire)",
    module: "(planned) page/fx/fire.js", owner: "unassigned",
    params: { target: "text", size: P([], ["small", "big", "huge"]) }, fallback: "a picture card: FIRE 🔥 (+ the target)" },
  { id: "fx.explosion", group: "effects", status: "planned",
    does: "an explosion, blast or burst (flash, debris blocks, a shockwave ring)",
    module: "(planned) page/fx/explosion.js + camera.shake", owner: "unassigned",
    params: { target: "text", size: P([], ["small", "big", "huge"]) }, fallback: "a picture card: BOOM 💥 (+ the target)" },
  { id: "fx.glow", group: "effects", status: "partial",
    does: "glow and magic light: glowing eyes, a halo ring, a glowing object (blueprint glow material), sparkles",
    module: "page/kit/monsters.js (glow), page/kit/props.js makeMarker ring, page/kit/blueprint.js glow material", owner: "KIT + BUILDER",
    params: { kind: P(["glow", "halo", "eyes"], ["spell", "beam", "portal", "aura", "sparkles"], []) },
    fallback: "a glowing halo ring over the target" },
  { id: "fx.transformation", group: "effects", status: "planned",
    does: "a thing or a person turning into something else (into cheese, a frog, stone), growing, shrinking or vanishing, on screen",
    module: "(planned) a before/after cross-fade in page/engine.js + the target form (kit or builder)", owner: "unassigned",
    params: { kind: P([], ["morph", "grow", "shrink", "vanish", "appear", "swap"]) },
    fallback: "a hard cut from before to after (the after form built or on a picture card)" },
  { id: "weather.event", group: "events", status: "partial",
    does: "weather and natural events: rain, snow, storm clouds, fog, wind as objects in the shot today; world-wide weather, lightning flashes, floods, earthquakes, eruptions planned",
    module: "lib/catalog.js THINGS (cloud states, fog_bank, wind_gust, snow_pile), worldspec particles", owner: "COVERAGE + BUILDER",
    params: { kind: P(["rain", "snow", "storm", "fog", "wind"], ["lightning", "flood", "earthquake", "eruption", "tornado", "heatwave", "hail", "tsunami"], []), scope: P(["shot"], ["world"]) },
    fallback: "the weather object in the shot (cloud / fog / snow), else a picture card of the event" },
  { id: "event.sky", group: "events", status: "planned",
    does: "something big happening in the sky: the moon falls, a meteor, an eclipse, the sun goes out, things raining down",
    module: "(planned) a sky-object path + camera.scale", owner: "unassigned",
    params: { kind: P([], ["falling", "eclipse", "meteor", "sun_out", "raining_things"]) },
    fallback: "the falling thing (kit / built) in the sky of a wide shot, else a picture card" },

  // ------------------------------------------------------------------ camera
  { id: "camera.basic", group: "camera", status: "ready",
    does: "wide, medium, close-up, low, over-the-shoulder and insert shots with a slow push or drift",
    module: "page/camera.js frameShot", owner: "SETS",
    params: { type: P(["wide", "medium", "closeup", "low", "over_shoulder", "insert"]) }, fallback: "medium" },
  { id: "camera.scale", group: "camera", status: "partial",
    does: "selling size: a low angle (ready), establish / hero_low / aerial / giant_close / duel scale shots (EPIC)",
    module: "page/camera.js (low, wide) + page/cameraEpic.js frameEpic (landed 2026-11-05, being wired)", owner: "SETS + EPIC",
    params: { move: P(["low", "wide", ...EPIC_CAMERAS], ["crane", "dolly_zoom"]) }, fallback: "a low wide shot", files: ["page/cameraEpic.js"] },
  { id: "camera.shake", group: "camera", status: "partial",
    does: "camera shake on impacts: impact, stomp, rumble, roar, fall (deterministic)",
    module: "page/cameraEpic.js applyShake + lib/epic.js SHAKE_PRESETS (landed 2026-11-05, being wired)", owner: "EPIC",
    params: { preset: P(SHAKES.filter((x) => x !== "none"), ["explosion"]) }, fallback: "a hard cut to a close-up (no shake)", files: ["page/cameraEpic.js"] },
  { id: "camera.action", group: "camera", status: "partial",
    does: "action beats timed to the words: chase, attack, impact, fall, stomp, roar, charge, flee, cheer, march, swim away (moves + shake + SFX)",
    module: "lib/epic.js BEATS / beatPlan + page/cameraEpic.js (landed 2026-11-05, being wired)", owner: "EPIC",
    params: { beat: P(BEAT_TYPES, ["fight", "whip", "explosion", "dogfight"]) }, fallback: "quicker cuts between wide and close-up", files: ["page/cameraEpic.js"] },

  // ------------------------------------------------------------------ text, light, sound
  { id: "sign.card", group: "text", status: "ready",
    does: "a sign, a note, a picture card (text + icon), a price tag / halo / badge over someone",
    module: "page/kit/props.js (makeInsert, makeMarker)", owner: "KIT",
    params: { kind: P(["sign", "note", "card", "tag", "ring", "icon"]) }, fallback: "(this is the fallback)" },
  { id: "light", group: "light", status: "ready",
    does: "day, night (moonlight + warm practicals) and golden-hour light, per shot",
    module: "page/lighting.js applyLight", owner: "SETS",
    params: { light: P(["day", "night", "warm"], ["storm", "underwater", "fire_glow"]) }, fallback: "day / night" },
  { id: "sound.sfx", group: "sound", status: "ready",
    does: "sparse sound effects on key moments (a scream, a sneeze, a growl, a crowd)",
    module: "lib/sfx.js", owner: "AUDIO",
    params: { cue: "text" }, fallback: "no sound effect" },
].map((c) => [c.id, Object.freeze(c)])));

export const capability = (id) => CAPABILITIES[id] ?? null;
export const CAPABILITY_IDS = Object.freeze(Object.keys(CAPABILITIES));

/**
 * Does a capability support these parameters today? Every parameter is checked against its ready / partial / planned
 * lists (unknown values count as planned: nobody builds them yet). Counts check readyMax / plannedMax.
 * -> { ok, status, unsupported: ["action=charge"], known }
 */
export function supports(id, params = {}) {
  const c = CAPABILITIES[id];
  if (!c) return { ok: false, status: "planned", unsupported: [`unknown capability ${id}`], known: false };
  let status = c.status;
  const unsupported = [];
  for (const [k, v] of Object.entries(params ?? {})) {
    const spec = c.params?.[k];
    if (spec == null || spec === "text" || v == null || v === "") continue;
    const vals = Array.isArray(v) ? v : [v];
    for (const val of vals) {
      if (typeof spec.readyMax === "number") {
        const n = Number(val);
        if (!Number.isFinite(n) || n <= spec.readyMax) continue;
        unsupported.push(`${k}=${n}`);
        status = worse(status, n <= (spec.plannedMax ?? Infinity) ? "planned" : "planned");
        continue;
      }
      const s = typeof val === "boolean" ? val : String(val).toLowerCase();
      if (spec.ready?.includes(s)) continue;
      if (spec.partial?.includes(s) || spec.other === "partial") { status = worse(status, "partial"); continue; }
      unsupported.push(`${k}=${s}`);
      status = worse(status, "planned");
    }
  }
  return { ok: unsupported.length === 0 && status !== "planned", status, unsupported, known: true };
}

/**
 * The status with what has landed on disk: a planned capability whose module files now exist reads "partial" (built,
 * not yet wired into the planner). exists(relPath) -> bool is injected (Node: fs.existsSync under the engine folder).
 */
export function installedStatus(id, exists = () => false) {
  const c = CAPABILITIES[id];
  if (!c) return "planned";
  if (c.status === "planned" && (c.files ?? []).length && c.files.every((f) => exists(f))) return "partial";
  return c.status;
}

/** The registry as table rows (the report, the stress run, the docs). */
export function registryTable(exists = null) {
  return CAPABILITY_IDS.map((id) => {
    const c = CAPABILITIES[id];
    return { id, group: c.group, status: exists ? installedStatus(id, exists) : c.status, owner: c.owner, does: c.does, module: c.module, fallback: c.fallback };
  });
}

/** A compact text of the registry for the director's prompt (what it may ask for). */
export function registryForPrompt() {
  return CAPABILITY_IDS.map((id) => {
    const c = CAPABILITIES[id];
    const ps = Object.entries(c.params ?? {}).map(([k, v]) => (v === "text" ? `${k}: text` : typeof v.readyMax === "number" ? `${k}: number` : `${k}: ${[...v.ready, ...(v.partial ?? []), ...(v.planned ?? [])].join("|")}`)).join("; ");
    return `- ${id}: ${c.does}${ps ? ` [${ps}]` : ""}`;
  }).join("\n");
}
