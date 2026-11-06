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
// the target-video capabilities (CAPABILITIES agent, 2026-11-06): lib/caps.js vocabulary, page/capsLayer.js
import { MOVES, TETHER_KINDS, TETHER_STATES, SIEGE_KINDS, SIEGE_PLACES, PAYLOADS, FX_KINDS, ACT_KINDS, TOWN_STYLES, LANDMARKS, GRADES } from "./caps.js";

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
  { id: "world.coast", group: "world", status: "partial",
    does: "around a creature seen from outside: a big hill sloping down to the sea (the creature on the hill), the hill turned to shiny mud, the creature sliding down it on its belly, splashing into the sea and floating there (since 2026-11-06; planned per line from the words: hill, sea, mud, spray, slid, splash, float)",
    module: "page/sets/creatureWorld.js addCoastStage (shot.stage) + lib/coast.js coastPass + page/kit/giants.js slide / float", owner: "ENGINE",
    params: { ground: P(["land", "hill", "sea"]), mud: P([true, false]), action: P(["slide", "float", "fall", "walk"]) },
    fallback: "the creature walking on the plain fields + a picture card of the hill / sea", files: ["lib/coast.js"] },
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
  { id: "character.action", group: "people", status: "ready",
    does: "what a person does in a line: a pose cycle (walk, run, point, carry, cheer, yell, sleep, sit...) and, since 2026-11-05, hug (a pair face to face), climb (a ladder), push, eat, fall, jump, ride (on the shot's animal / vehicle / built thing), hide (behind the shot's object), throw (the thing flies), fly, swim (in a patch of water), build (a growing wall), dig (a hole + pile), dance, kick, fight, drive (a little kart)",
    module: "page/kit/people.js POSES + page/engine.js (hug pairs, riders on their mount, hiders, pushers)", owner: "KIT + GAPS",
    params: { action: P(POSES_N) },
    fallback: "the nearest pose (stand / point / scared) + the thing acted on in frame; ride with nothing to ride: walk" },

  // ------------------------------------------------------------------ creatures
  { id: "creature.monster", group: "creatures", status: "ready",
    does: "the story's monster: a tall or furry rig dressed as one of 15 looks (dragon, bird, serpent, squid, fish, goblin, stump, giant, scarecrow, beast, boxy, yeti, troll, ghost, mannequin) or a species",
    module: "page/kit/monsters.js (makeMonster, animateMonster) + lib/catalog.js CREATURES", owner: "KIT",
    params: { behaviour: P(["lurk", "reach", "reveal", "flee"], ["walk", "stomp", "roar", "attack", "chase", "fly", "swim", "eat", "carry", "sleep", "howl", "run"], []), scale: P(["human", "big"], ["giant", "colossal"], []) },
    fallback: "the closest look, in its lurk / reveal state" },
  { id: "creature.animal", group: "creatures", status: "ready",
    does: "an animal as a scene object (31 species: dog, cat, wolf, turtle, whale, bear, pigeon...) in the shot, up to 3 per shot; since 2026-11-05 moving: walking, running (chasing, charging, fleeing), flying, swimming (in water), sleeping (Z z z), eating, howling, carrying a crate, climbing, digging",
    module: "page/kit/things.js (ANIMALS) + page/kit/motion.js (the shared body motions) + lib/catalog.js ANIMAL_STATES", owner: "COVERAGE + GAPS",
    params: { behaviour: P(["stand", "idle", "walk", "run", "attack", "howl", "fly", "swim", "eat", "sleep", "charge", "chase", "flee", "carry", "climb", "dig", "lurk", "reach", "stomp", "roar"], [], []), count: { readyMax: 3, plannedMax: 2000 } },
    fallback: "the animal standing (no motion) + the action named on a badge" },
  { id: "creature.small", group: "creatures", status: "ready",
    does: "a small creature that is not the monster (dragon, goblin, yeti, troll, ghost, giant, scarecrow, robot, alien, mannequin, unicorn) as a scene object",
    module: "page/kit/things.js (CREATURE_OBJECTS)", owner: "COVERAGE",
    params: { kind: P(["dragon", "goblin", "yeti", "troll", "ghost", "giant", "scarecrow", "robot", "alien", "mannequin", "unicorn"]) },
    fallback: "a built blueprint of it, else a picture card", via: "builder" },
  { id: "creature.built", group: "creatures", status: "partial",
    does: "a creature the kit has no look for (a zombie, a mermaid, a vampire, a jellyfish) as a builder blueprint, with simple loop anims (bob, wobble, blink) and, since 2026-11-05, the shared body motions (page/kit/motion.js): walking, running, flying, swimming, sleeping, eating, carrying, reaching (no limb rig)",
    module: "lib/builder (blueprint) + page/kit/blueprint.js animateBlueprint", owner: "BUILDER",
    params: { behaviour: P(["stand", "idle", "lurk", "walk", "run", "attack", "chase", "charge", "fly", "swim", "eat", "carry", "sleep", "reach", "flee", "dig", "climb", "howl", "stomp", "roar"], ["reveal"]) },
    fallback: "the built creature standing in frame (+ the action named on a badge), else a picture card", via: "builder" },
  { id: "giant", group: "creatures", status: "partial",
    does: "a creature or person at giant scale (10-200 m): any animal, walking, stomping, roaring, attacking, seen from street level; since 2026-11-05 also reaching, sleeping (eyes shut, Z z z), lurking (crouched), revealing (rising + roar), carrying (a crate), eating, flying, climbing, fleeing, howling, digging; species families with their own look (ghost, goblin, troll, yeti, snowman, robot, alien, owl and other birds, shark and fish, octopus and squid, moose, horse, giraffe, mouse, rabbit...)",
    module: "page/kit/giants.js (makeGiant / animateGiant: 12 presets, any other species as the generic giant; landed 2026-11-05, being wired into plan.mjs); a giant builder blueprint (static) otherwise", owner: "EPIC",
    params: { species: P(GIANT_SPECIES.concat(["human"]), [], [], "partial"), behaviour: P([...GIANT_ACTIONS, "stand", "charge", "chase"]), heightM: { readyMax: 200, plannedMax: 200 } },
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
  { id: "fx.water", group: "effects", status: "partial",
    does: "water effects: a hose spraying water from a person's hand (the person holds a garden hose), a giant splash (white water bursting up, a foam ring) where a creature hits the sea (since 2026-11-06, outside a creature world)",
    module: "page/sets/creatureWorld.js addCoastStage (shot.stage.fx spray | splash) + page/kit/heldMore.js hose", owner: "ENGINE",
    params: { kind: P(["spray", "splash"], ["rain", "fountain", "wave", "flood"]) },
    fallback: "the hose in the person's hand / the creature at the shore; else a picture card: SPLASH 💦" },
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

  // ------------------------------------------------------------------ the target-video capabilities (2026-11-06)
  // shot fields of lib/caps.js, drawn by page/capsLayer.js (loaded by the EPIC layer); examples are timeline JSON
  { id: "tether", group: "things", status: "ready",
    does: "chains, ropes, cables and rope bridges between any two anchors (giant to giant, a giant's leg to a ground stake, soldiers holding lines, a hook fired and catching, a bridge between two creatures' backs): taut, slack, swinging, fired (the hook flies and catches with a jolt) or SNAP (it breaks, the halves whip down, links fly, the camera shakes, SFX chain_snap)",
    module: "page/kit/tether.js + page/capsLayer.js (shot.tethers) + lib/caps.js tetherState", owner: "CAPABILITIES",
    params: { kind: P(TETHER_KINDS), state: P(TETHER_STATES) },
    examples: [
      `tethers: [{ from: "giant:wolf.leg0", to: [-100, 0, -150], kind: "chain", state: "snap", at: 0.4 }]  (the chain on his leg snapped)`,
      `tethers: [{ from: "crowd:0", to: "giant:wolf.leg1", kind: "rope", state: "fire", at: 0.05, until: 0.5 }]  (the soldiers threw their ropes)`,
      `tethers: [{ from: "world.back", to: "giant:elephant.back", kind: "bridge", state: "slack" }]  (a bridge joins our two towns)`,
      `anchors: giant:<id>.<head|jaw|neck|body|back|tail|leg0-7|front|rear|left|right>, world.<part>, actor:<id>, crowd:<i>, siege:<i>, spot:<name>, [x,y,z], { at, off: [x,y,z] }`,
    ],
    fallback: "the two things in frame without the line", files: ["page/kit/tether.js", "page/capsLayer.js"] },
  { id: "siege", group: "things", status: "ready",
    does: "cannons, ballistae and catapults as kit objects (on the ground, a wall, a creature's back, or a row held by an army; count 1-12) that FIRE: recoil + muzzle flash + smoke, the projectile on its arc with a trail (a ball, a bolt, a rock, or a hook dragging a chain that catches the target), the IMPACT (debris blocks, dust, camera shake, SFX cannon_fire / impact_boom)",
    module: "page/kit/siege.js + page/capsLayer.js (shot.siege)", owner: "CAPABILITIES",
    params: { kind: P(SIEGE_KINDS), place: P(SIEGE_PLACES), payload: P(PAYLOADS), count: { readyMax: 12, plannedMax: 12 } },
    examples: [
      `siege: [{ kind: "cannon", at: [-20, 0, 2], aim: "giant:wolf.body", count: 3, fireAt: 0.15 }]  (fire the cannons!)`,
      `siege: [{ kind: "ballista", at: "giant:wolf.back", place: "back", aim: "world.body", payload: "hook", chain: true }]  (his city fired hooks into our shell)`,
      `siege: [{ kind: "catapult", at: "spot:back", aim: "giant:wolf.body", fireAt: 0.3 }]`,
    ],
    fallback: "the weapon standing in frame (no fire), else a picture card", files: ["page/kit/siege.js", "page/capsLayer.js"] },
  { id: "world.backtown", group: "world", status: "ready",
    does: "a town or a city on ANY creature's back, scaled to it (a turtle's shell, a wolf, a whale, an elephant, a bird...): dozens to hundreds of houses on streets (terraced down a steep shell), landmark buildings with readable signs (SCHOOL, GROCERY, a hospital cross...), and for a villain the lit castle-city (dark spired towers with window grids, a crenellated wall round the edge); windows and lamps light up at night; it rides the body so it walks with the creature. Chosen on its own for a creature world seen from outside whose kind carries no town",
    module: "page/kit/backTown.js + page/capsLayer.js decorateGiant / decorateWorld", owner: "CAPABILITIES",
    params: { style: P(TOWN_STYLES), landmarks: P(LANDMARKS) },
    examples: [
      `giants: { wolf: { kind: "wolf", size: 130, backTown: { style: "castle", lit: true } } }  (his city glows on his back)`,
      `worlds: { turtle_out: { creature: "turtle", view: "outside", size: 120, backTown: { style: "town", landmarks: ["school", "grocery", "hospital"] } } }`,
    ],
    fallback: "the kind's own little town (turtle / whale / elephant / snail), else the creature alone", files: ["page/kit/backTown.js"] },
  { id: "camera.move", group: "camera", status: "ready",
    does: "camera moves on any subject (a giant, the world creature and its town, a crowd, a person): tilt_up (feet to head / the city on top), orbit (round it), flyover (high across it), fpv (a fast first-person flight down the street on its back), top_down (straight down on a person in bed / fallen), low_hero (worm's-eye at its feet)",
    module: "page/cameraMoves.js applyMove (via page/epicLayer.js frame + page/capsLayer.js)", owner: "CAPABILITIES",
    params: { move: P(MOVES) },
    examples: [
      `{ camera: "giant_close", focus: "giant:wolf", move: "tilt_up" }  (from his paws up to his towers)`,
      `{ camera: "establish", focus: "world", move: "orbit" }  (every town lives on a turtle)`,
      `{ camera: "aerial", focus: "world", move: "fpv" }  (we flew down our own street)`,
      `{ camera: "medium", focus: "me", move: "top_down" }  (I was asleep when it began)`,
    ],
    fallback: "the shot's own camera (push / drift)", files: ["page/cameraMoves.js"] },
  { id: "fx.caps", group: "effects", status: "ready",
    does: "sound-wave rings from a horn (toward a target), a glassy hex shield dome over a shell / town (flashes when struck), a burst of leaves, debris blocks, dust or sparks at any anchor",
    module: "page/kit/fxCaps.js + page/kit/siege.js makeBurst + page/capsLayer.js (shot.fx)", owner: "CAPABILITIES",
    params: { kind: P(FX_KINDS) },
    examples: [
      `fx: [{ kind: "sound_rings", at: "actor:me", to: "giant:wolf.head", t0: 0.1 }]  (I blew the horn)`,
      `fx: [{ kind: "shield_dome", at: "world.body", hitAt: 0.6 }]  (a shield went up over the shell)`,
      `fx: [{ kind: "debris", at: "giant:wolf.leg0", t0: 0.5 }]`,
    ],
    fallback: "no effect (the cause and the target stay in frame)", files: ["page/kit/fxCaps.js"] },
  { id: "giant.act", group: "creatures", status: "ready",
    does: "giant interactions: eat_tree (a big tree in front of the mouth tips into the jaws, leaves burst, SFX big_chomp), nuzzle (one giant presses its head to the other's head / shell, eyes half shut), headbutt (a lunge into the other, then contact)",
    module: "page/capsLayer.js place (shot.acts) + page/kit/fxCaps.js makeBlockTree", owner: "CAPABILITIES",
    params: { kind: P(ACT_KINDS) },
    examples: [
      `acts: [{ kind: "eat_tree", giant: "deer", at: 0.5 }]  (with giants: [{ id: "deer", action: "eat" }])`,
      `acts: [{ kind: "nuzzle", giant: "wolf", to: "world", part: "shell" }]  (he pressed his head to her shell)`,
    ],
    fallback: "the giant's own eat / idle action" },
  { id: "grade.flashback", group: "light", status: "ready",
    does: "the flashback / memory look on a shot: washed sepia colours and a soft dark vignette (the same character earlier: a young white wolf)",
    module: "page/capsLayer.js (the post grade per shot) + page/kit/fxCaps.js makeVignette", owner: "CAPABILITIES",
    params: { grade: P(GRADES) },
    examples: [`{ grade: "flashback", giants: [{ id: "pup", action: "walk" }] }  (long ago, he was just a pup)`],
    fallback: "the normal grade (day / night / warm)" },
  { id: "world.tilt", group: "events", status: "ready",
    does: "the world tips (the street on the shell tilts as the creature stumbles): the frame rolls in and the crowds slide downhill, with a rumble",
    module: "page/capsLayer.js after (shot.tilt)", owner: "CAPABILITIES",
    params: { slide: P([true, false]) },
    examples: [`{ set: "creature:turtle_on", tilt: { deg: 16, at: 0.1, slide: true }, crowds: [{ kind: "townsfolk", action: "flee", onWorld: true }] }  (the whole street tipped, and we slid)`],
    fallback: "a rumble shake" },
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
    return `- ${id}: ${c.does}${ps ? ` [${ps}]` : ""}${c.examples?.length ? ` e.g. ${c.examples[0]}` : ""}`;
  }).join("\n");
}
