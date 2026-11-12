// Blocky Worlds KIT CHECK v2 (2026-11-12): does the board kit have what a SCRIPT can't be told without? ONE check for
// the server (the quote / start, before the charge; _shared/blockyWorlds/boardFit.js calls it) and the worker (before the
// voice). Pure, instant, free. A story that leans on a thing the kit can't show goes to "Fix it", never a paid failure.
//   kitCheck(script | lines, { card }) -> { ok, missing: [{ word, kind, lines }], warnings: [...], found: [{ id, kind, lines }],
//                                          premise (the opener / a third of the lines need what we can't film) }
//   scanText(text, kit?, { creature }) -> { needs: [{ kind, value, word }], tags }   (one text, every mention)
//   kitHas(name) -> the kit id a name means (a prop / animal / place) or null;  kitView(kit) -> the kit as lists
//   singular(word);  NOT_IN_KIT (things the kit can't show, by kind);  PHRASE_RULES (ambiguous words, in context only)
// A mention is a MUST-HAVE when the story leans on it: in the opener (lines 0-1), in the last two lines, or in two lines;
// one other mention is a warning (that shot shows the closest thing we have).
import { BOARD_KIT } from "./boardKit.js";

/** a real singular: bus / buses, glass / glasses, berry / berries, leaf / leaves, box / boxes (never "bu") */
export function singular(w) {
  const s = String(w ?? "").toLowerCase();
  if (s.length < 4 || /(ss|us|is|ous)$/.test(s)) return s;
  if (/ies$/.test(s)) return s.slice(0, -3) + "y";
  if (/(knives|wives|lives)$/.test(s)) return s.slice(0, -3) + "fe";
  if (/(leaves|loaves|wolves|calves|halves|shelves|scarves|thieves|elves)$/.test(s)) return s.slice(0, -3) + "f";
  if (/(sses|shes|ches|xes|zes|uses)$/.test(s)) return s.slice(0, -2);
  if (/oes$/.test(s) && !/^(shoes|toes|tiptoes|hoes|does|floes|canoes|oboes|horseshoes|snowshoes)$/.test(s)) return s.slice(0, -2); // potatoes, tomatoes, heroes (but shoe, toe)
  if (/s$/.test(s)) return s.slice(0, -1);
  return s;
}
const words = (s) => String(s ?? "").toLowerCase().replace(/[^a-z' -]/g, " ");
const ALIAS = new Map();
for (const p of BOARD_KIT.props ?? []) for (const a of [p.id, ...(p.aliases ?? [])]) ALIAS.set(a, { id: p.id, kind: "prop" });
for (const a of BOARD_KIT.animals ?? []) ALIAS.set(a, { id: a, kind: "animal" });
for (const p of BOARD_KIT.places ?? []) for (const a of [p.id, ...(p.aliases ?? [])]) ALIAS.set(a, { id: p.id, kind: "place" });
// things the kit can NOT show yet, by kind (single words / two-word phrases; the ambiguous ones are in PHRASE_RULES)
export const NOT_IN_KIT = Object.freeze({
  vehicle: ["car", "bus", "truck", "train", "boat", "ship", "plane", "airplane", "rocket", "bicycle", "tractor", "helicopter", "submarine", "spaceship", "taxi", "van", "motorcycle", "sled", "skateboard", "scooter", "wagon"],
  place: ["beach", "ocean", "castle", "planet", "city", "mountain", "cave", "desert", "jungle", "underwater", "island", "volcano", "farm", "barn", "zoo", "museum", "hospital", "library", "airport", "pool", "lake", "river"],
  creature: ["dragon", "robot", "alien", "mermaid", "unicorn", "dinosaur", "spider", "octopus", "zombie", "vampire", "witch", "troll", "goblin", "fairy"],
  prop: ["sword", "shield", "laptop", "computer", "tablet", "television", "guitar", "piano", "trumpet", "telescope", "microscope", "rope", "ladder", "fishing rod", "magnifying glass", "potion", "cauldron", "treasure", "slingshot"],
});
// ambiguous words: only these phrases count ("bike helmet", "parking space", "a chest of drawers" do not)
export const PHRASE_RULES = Object.freeze([
  { word: "bike", kind: "vehicle", re: /\b(?:rode|ride|rides|riding|on (?:my|his|her|a|the) bike|bike ride|bikes? (?:down|up|along|across|through))\b|\bbikes?\b(?! (?:helmet|lock|shed|bell|rack|shop))/i, needs: /\bbikes?\b(?! (?:helmet|lock|shed|bell|rack|shop))/i },
  { word: "space", kind: "place", re: /\b(?:outer space|in space|into space|to space|from space|space station)\b/i },
  { word: "sea", kind: "place", re: /\b(?:the sea|at sea|by the sea|under the sea|sea monster)\b/i },
  { word: "treasure chest", kind: "prop", re: /\btreasure chests?\b/i },
  { word: "tv", kind: "prop", re: /\b(?:tv|telly)\b/i },
]);
const NOT = new Map(); for (const [kind, list] of Object.entries(NOT_IN_KIT)) for (const w of list) NOT.set(w, kind);
/** every word a kit names (its places, props + aliases, animals, weather, creature ids): a NOT_IN_KIT word in it is covered */
function coveredBy(kit) {
  const out = new Set();
  const put = (w) => { const x = String(w ?? "").toLowerCase().trim(); if (x) { out.add(x); out.add(singular(x)); } };
  for (const p of kit?.places ?? []) { put(p.id ?? p); for (const a of p.aliases ?? []) put(a); }
  for (const p of kit?.props ?? []) { put(p.id ?? p); for (const a of p.aliases ?? []) put(a); }
  for (const a of kit?.animals ?? []) put(a);
  for (const w of kit?.weather ?? []) put(w);
  for (const c of kit?.creatures ?? []) put(c.id ?? c);
  return out;
}
export function kitHas(name) {
  const w = words(name).trim().split(/\s+/);
  for (let n = Math.min(3, w.length); n >= 1; n--) for (let i = 0; i + n <= w.length; i++) { const k = w.slice(i, i + n).join(" "); const hit = ALIAS.get(k) ?? ALIAS.get(singular(k)); if (hit) return hit.id; }
  return null;
}

// ------------------------------------------------------------------------------------------------ the lexicon + scanText (from boardFit.js)
const PLACE_LABELS = Object.freeze({ street: "streets", room: "inside houses", park: "a park / town square", woods: "the woods", school: "a school classroom", shop: "a shop" });
const placeLabel = (id) => PLACE_LABELS[id] ?? String(id).replace(/_/g, " ");
const CREATURE_LABELS = Object.freeze({ peeker: "one huge eye", shadow: "a faceless shadow", grin: "a wide grin", hat: "a tall hat", many_eyes: "many eyes" });
/**
 * Things the board shows besides the props kit: the props its ACTIONS use (grab:boards, nail:boards, pull:sock, huddle:blanket,
 * smear:batter, stack:bricks, the curtains; the hammer of nail:boards) and the room's furniture (the room place's "what").
 * ADAPTER: boardKit.js lists these inside actions / the room's text, not as props; they count as filmable things here.
 */
const ACTION_PROPS = Object.freeze(["hammer", "boards", "brick", "bricks", "curtains", "blanket", "sock", "socks", "batter", "bowl", "window"]);
const ROOM_THINGS = (kit) => String((kit.places ?? []).find((p) => p.id === "room")?.what ?? "").replace(/^[^(]*\(|\)[^)]*$/g, "").replace(/^[^:]*:/, "").split(/,\s*/).map((s) => s.trim()).filter((s) => /^[a-z ]{2,20}$/.test(s));

/** The kit in one shape (props normalised, labels added). Pure; the same kit always gives the same view. */
export function kitView(kit = BOARD_KIT) {
  const fromKit = Array.isArray(kit.props) && kit.props.length
    ? kit.props.map((p) => (typeof p === "string" ? { id: p, what: p, words: [p] } : { id: String(p.id), what: String(p.what ?? p.id), words: [p.id, ...(Array.isArray(p.aliases) ? p.aliases : []), ...(Array.isArray(p.words) ? p.words : [])].map(String) }))
    : [];
  const extra = [...ACTION_PROPS, ...ROOM_THINGS(kit)].filter((w, i, a) => a.indexOf(w) === i && !fromKit.some((p) => p.words.includes(w)) && !(kit.animals ?? []).includes(w)).map((w) => ({ id: w, what: w, words: [w], fromActions: true }));
  const props = [...fromKit, ...extra];
  return {
    version: kit.version ?? 0,
    places: (kit.places ?? []).map((p) => ({ id: p.id, what: p.what, outdoor: Boolean(p.outdoor), label: placeLabel(p.id) })),
    creatures: (kit.creatures ?? []).map((c) => ({ id: c.id, what: c.what, signature: c.signature ?? "", label: CREATURE_LABELS[c.id] ?? c.what })),
    creatureMoves: kit.creatureMoves ?? "",
    animals: [...(kit.animals ?? [])],
    weather: [...(kit.weather ?? [])],
    crowds: kit.crowds ?? "",
    // owner, 2026-11-12: crowds by day only (a night-rule story shows a few named people at night); a kit that can light
    // a crowd at night says crowdsAtNight: true
    crowdsAtNight: Boolean(kit.crowdsAtNight),
    props, propsFromKit: fromKit.length > 0,
    actions: [...(kit.actions ?? [])],
    notYet: [...(kit.notYet ?? [])],
  };
}

const list = (xs, last = "and") => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${last} ${xs.at(-1)}`);
const MONSTER = (v) => `${v.creatures.length} monster looks`;

/** "What we can film", for the page (under the topic box): generated from the kit, never hand-written. */
function canFilm(kit = BOARD_KIT) {
  const v = kitView(kit);
  return [
    ...v.places.map((p) => ({ id: `place:${p.id}`, label: p.label, what: p.what })),
    ...v.weather.map((w) => ({ id: `weather:${w}`, label: w, what: `${w} in any outdoor place` })),
    ...(v.animals.length ? [{ id: "animals", label: `${v.animals.length} animals`, what: list(v.animals) }] : []),
    ...(v.crowds ? [{ id: "crowds", label: v.crowdsAtNight ? "crowds" : "crowds by day", what: v.crowds }] : []),
    ...(v.creatures.length ? [{ id: "creatures", label: MONSTER(v), what: `one tall creature: ${list(v.creatures.map((c) => c.what), "or")}` }] : []),
    ...(v.propsFromKit ? [{ id: "props", label: "everyday props", what: list(v.props.filter((p) => !p.fromActions).map((p) => p.what)) }] : []),
  ];
}
/** One short line of the same ("streets, inside houses, a park / town square, ..."), for messages. */
const canFilmLine = (kit = BOARD_KIT) => list(canFilm(kit).map((x) => x.label));
const placesLine = (v) => list(v.places.map((p) => p.label), "or");

// ---------------------------------------------------------------- the lexicon (this file's adapter)
const W = (src) => new RegExp(`\\b(?:${src})\\b`, "gi");
/** Words of each place id the kit may list (when the kit lists the id, its words are fine; otherwise they are a miss). */
const PLACE_WORDS = Object.freeze({
  street: "streets?|sidewalks?|porch(?:es)?|curbs?|driveways?|front (?:yard|lawn|door|step)s?|lawns?|mailbox(?:es)?|neighbou?rhood",
  room: "bedrooms?|kitchens?|living room|closets?|attic|basement|bathroom|hallway at home|under (?:the|my) bed",
  park: "park|town square|the square|benches|bench|pond",
  woods: "woods|forest|trees",
  school: "school|classrooms?|teachers?|desks?|chalkboard|blackboard",
  shop: "shops?|stores?|bakery|counter|shelves|till",
});
/** Places the kit has no id for: always a miss (unless a later kit lists the id named on the left). */
const UNSUPPORTED_PLACES = Object.freeze({
  cave: "caves?|caverns?|(?:the|a|old|deep) mine|mine (?:tunnels?|shafts?|carts?)|tunnels?|underground (?:town|city)|underground",
  canyon: "canyons?|cliffs?|cliff-?top|gorge|rope bridges?",
  farm: "farms?|barns?|barnyard|haystacks?|cornfields?|pasture|windmill|scarecrows?",
  castle: "castles?|drawbridge|moat|throne room|dungeon|clock towers?|bell towers?|water towers?|watchtowers?",
  underwater: "underwater|under the sea|ocean|seabed|sea floor|reef|portholes?|submarine",
  beach: "beach|seaside|shore|island|lake|river|sea",
  space: "outer space|in space|space station|on the moon|planets?|mars",
  city: "city|downtown|skyscrapers?|airport|train station|subway",
  wild: "desert|jungle|glacier|mountains?|mountaintop|volcano(?:es)?|swamp|junkyard|zoo|circus|hospital|museum|library|stadium|arena|playground|cafeteria|gym|auditorium",
  building: "carnivals?|fairground|funfair|amusement park|theme park|lighthouses?|factory|factories|malls?|swimming pool|town pool|the pool|cinema|movie theat(?:er|re)|restaurants?|prisons?|jail|hotels?|church(?:es)?|harbou?r|docks?|pier|bridges?",
});
/** A whole town inside or on a giant thing (a world kind the kit doesn't have yet). */
const GIANT_WORLD = /\b(?:live|lives|living|town|built)\s+(?:inside|in|on(?: the back of)?)\s+(?:a|an|one|the|our)\s+(?:giant|huge|enormous|massive|hollow|gigantic)\s+[a-z-]+|\binside (?:a|an|one|the) (?:giant|huge|enormous|gigantic) [a-z-]+|\b(?:town|school|house|street|world) (?:is )?(?:built )?(?:inside|on the back of) (?:a|an|the|one) [a-z-]+|\bon (?:a|an|the) [a-z-]+ that (?:walks|swims|flies|moves)\b/gi;
/** The engine's monster-variant words (engine lib/storyboard.js VARIANT_CUES; the test keeps the two in step). */
export const VARIANT_CUES = Object.freeze({
  peeker: /\b(one|single|giant|huge|big|glowing)\s+eye\b|\beyes? (presses|pressed|filled|blinked|stared|twitched)\b|\beyelid\b/i,
  shadow: /\b(shadow|faceless|no face|dark shape|shape in the dark)\b/i,
  grin: /\b(grin|grins|grinning|smile|smiling|teeth)\b/i,
  hat: /\b(top hat|tall hat|its hat|his hat)\b/i,
  many_eyes: /\b(many|hundred|dozen|six|seven|eight|so many) eyes\b/i,
});
/** Creature words no monster look can show (engine lib/storyboard.js NO_VARIANT): a miss in a story with a creature. */
export const NO_VARIANT = /\b(tentacles?|wings|slime|slimy|eight legs|spider|invisible|swims|flying (thing|monster))\b/i;
/** Creatures that are not the tall body (fantasy bodies): a miss. */
const FANTASY = "mumm(?:y|ys|ies)|dragons?|yetis?|trolls?|goblins?|ogres?|worms?|serpents?|snakes?|mermaids?|unicorns?|robots?|aliens?|ghosts?|vampires?|werewol(?:f|ves)|zombies?|fairies|fairy|gnomes?|elves|elf|pixies?|krakens?|sea monsters?|dinosaurs?|t-rex|mummy|mummies|skeletons?|genies?|giant squid|beetles?|bugs?";
/** Generic words that mean the story has a creature (the tall body stands in). */
const CREATURE_WORDS = /\b(monsters?|creatures?|tall figure|something tall|beast|presence)\b/i;
/** Animal synonyms the kit's animals cover (left: what a script says; right: the kit's animal). */
const ANIMAL_SYNONYMS = Object.freeze({ puppy: "dog", puppies: "dog", pup: "dog", kitten: "cat", kitty: "cat", bunny: "rabbit", bunnies: "rabbit", pigeon: "bird", crow: "bird", raven: "bird", parrot: "bird", seagull: "bird", sparrow: "bird", robin: "bird", eagle: "bird", hawk: "bird", goose: "bird", geese: "bird", hen: "chicken", rooster: "chicken", chick: "chicken", calf: "cow", lamb: "sheep", piglet: "pig", fawn: "deer", toad: "frog", rat: "mouse", mice: "mouse", tortoise: "turtle", wolves: "wolf", foxes: "fox", sheep: "sheep" });
/** Animals with no model yet (a miss when the kit doesn't list them). */
const OTHER_ANIMALS = "moles|whales?|sharks?|squids?|octop(?:us|uses|i|uss)|jellyfish|crabs?|lobsters?|fish|goldfish|horses?|ponies|pony|donkeys?|camels?|elephants?|giraffes?|lions?|tigers?|monkeys?|apes?|gorillas?|zebras?|hippos?|rhinos?|kangaroos?|pandas?|penguins?|walrus(?:es)?|dolphins?|moose|squirrels?|raccoons?|hedgehogs?|beavers?|bats|moths?|butterfl(?:y|ies)|bees?|ants?|lizards?|crocodiles?|alligators?|snails?|slugs?|hamsters?|guinea pigs?|ferrets?|llamas?|alpacas?|ostrich(?:es)?|flamingos?|peacocks?|bears?";
/** Weather the kit lists is fine; these never are (yet). */
const OTHER_WEATHER = Object.freeze({
  fog: "fog|foggy|mist|misty",
  storm: "storms?|stormy|thunder(?:storm)?s?|lightning|tornado(?:es)?|hurricanes?|hail|blizzards?|floods?|flooded|flooding|earthquakes?|erupt(?:s|ed|ion)?",
  snow_ground: "snowm[ae]ns?|snowdrifts?|snow-covered|snowbanks?|igloos?|sleds?|sledding|frozen lake|icicles?",
});
/** Weather words for the kit's weather ids (rain / snow / wind), to tag them. */
const WEATHER_WORDS = Object.freeze({ rain: "rain|rains|raining|rained|rainy|drizzle", snow: "snow|snows|snowing|snowed|snowy|snowflakes?", wind: "wind|winds|windy|breeze|gusts?" });
const VEHICLES = "cars?|bus(?:es)?|school bus|trucks?|vans?|taxis?|train|the trains|trams?|tractors?|planes?|airplanes?|jets?|helicopters?|boats?|ships?|submarines?|rockets?|spaceships?|ufos?|hot air balloons?|blimps?|motorcycles?|scooters?|bicycles?|bikes?(?! helmet)|sleighs?";
const SKY = "meteors?|comets?|asteroids?|eclipse|aurora|northern lights|rainbows?|the sky (?:turns?|turned|cracks?|cracked|opens?|opened|falls?|fell)|the (?:moon|sun) (?:is made of|was made of|falls?|fell|crash(?:es|ed)?|cracks?|cracked|vanish(?:es|ed)|disappear(?:s|ed)|catch(?:es)? fire|melts?|melted)|shooting stars?|stars fall|falling stars?|(?:snows?|snowed|rains?|rained|falls?|fell) upwards?|upside[- ]down";
/** Actions the board can't animate (its actions are in the kit: walk, run, wave, cheer, look up, ...). */
const ACTIONS_NOT = "rid(?:e|es|ing)|rode|swim(?:s|ming)?|swam|dig(?:s|ging)?|dug|we mine";
const FLIGHT = /\b(?:float(?:s|ed|ing)?|flew|flies|fly|flying|lifted|levitat\w*|hover(?:s|ed|ing)?)\b[^.!?]{0,24}?\b(?:up|away|into the (?:sky|air|clouds)|off the ground|over the (?:town|roofs|rooftops|houses|street))\b/gi;
const FLIGHT_OK = /\b(birds?|owls?|ducks?|pigeons?|crows?|curtains?|hat|hats|blankets?|leaves|paper|kites?|balloons?|sparks?|dust)\b/i;
const TRANSFORM = /\b(?:turn(?:s|ed|ing)? into\b|transform(?:s|ed)?|shr[iu]nk|shrank|shrinks|grew to the size of|grows to the size of|melt(?:s|ed)? into|turn(?:s|ed)? to stone|turn(?:s|ed)? invisible|catch(?:es|ing)? fire|caught fire|on fire|explod(?:e|es|ed|ing)|explosions?|burst(?:s)? into|vanish(?:es|ed)?|lava)/gi;
const CROWD = /\b(?:crowds?|mobs?|parades?|townsfolk|the whole (?:town|street|school|class|neighbou?rhood)|(?:everyone|everybody|all the (?:kids|neighbou?rs|grown-?ups|adults|people|families))\s+(?:gathered|came out|ran|cheered|screamed|lined up|stood|waited|marched|danced|watched|stared|crowded|rushed|showed up|was there|were there))\b/gi;
const NIGHT = /\b(night|nights|tonight|midnight|after dark|moonlight|moonlit|bedtime|nightfall|sundown)\b/i;

const lower = (s) => String(s ?? "").toLowerCase();
const hitsOf = (re, text) => [...String(text ?? "").matchAll(re)].map((m) => m[0]);

/**
 * Everything the kit can't show in one piece of text, plus what it uses: { needs: [{ kind, value, word }], tags }.
 * kinds: place, world, creature, creature_look, animal, weather, vehicle, sky, flight, transform, crowd_night.
 * opts.creature: the story has a creature (the look words are checked); detected from the text when not given.
 */
export function scanText(text, kit = BOARD_KIT, opts = {}) {
  const v = kitView(kit), t = String(text ?? ""), needs = [];
  const placeIds = new Set(v.places.map((p) => p.id));
  const tags = { places: [], creature: null, looks: [], animals: [], weather: [], crowd: false, night: NIGHT.test(t) };
  const need = (kind, value, word) => { if (!needs.some((n) => n.kind === kind && lower(n.word) === lower(word))) needs.push({ kind, value, word }); };
  for (const [id, src] of Object.entries(PLACE_WORDS)) if (hitsOf(W(src), t).length) (placeIds.has(id) ? tags.places : null)?.push(id);
  for (const [id, src] of Object.entries(PLACE_WORDS)) if (!placeIds.has(id)) for (const w of hitsOf(W(src), t)) need("place", id, w);
  for (const [id, src] of Object.entries(UNSUPPORTED_PLACES)) if (!placeIds.has(id)) for (const w of hitsOf(W(src), t)) need("place", id, w);
  for (const w of hitsOf(GIANT_WORLD, t)) need("world", "inside_giant", w);
  // the creature: the tall body in one of the kit's looks
  const looks = v.creatures.map((c) => c.id).filter((id) => VARIANT_CUES[id]?.test(t));
  const fantasy = hitsOf(W(FANTASY), t);
  const hasCreature = opts.creature ?? (looks.length > 0 || CREATURE_WORDS.test(t) || fantasy.length > 0);
  if (hasCreature) { tags.creature = looks[0] ?? "any"; tags.looks = looks; }
  for (const w of fantasy) need("creature", "fantasy", w);
  if (hasCreature && v.creatures.length) { const m = t.match(NO_VARIANT); if (m) need("creature_look", "none", m[0]); }
  // animals: the kit's, their synonyms, and everything else
  const kitAnimals = new Set(v.animals.map(lower));
  const animalRe = W([...v.animals.map((a) => `${a}s?`), ...Object.keys(ANIMAL_SYNONYMS)].join("|"));
  for (const w of hitsOf(animalRe, t)) { const base = ANIMAL_SYNONYMS[lower(w)] ?? lower(w).replace(/s$/, ""); if (kitAnimals.has(base) && !tags.animals.includes(base)) tags.animals.push(base); }
  for (const w of hitsOf(W(OTHER_ANIMALS), t)) { const base = lower(w).replace(/(es|s)$/, ""); if (!kitAnimals.has(base) && !kitAnimals.has(lower(w))) need("animal", base, w); }
  // weather
  for (const [id, src] of Object.entries(WEATHER_WORDS)) if (hitsOf(W(src), t).length) (v.weather.includes(id) ? tags.weather.push(id) : need("weather", id, hitsOf(W(src), t)[0]));
  for (const [id, src] of Object.entries(OTHER_WEATHER)) if (!v.weather.includes(id)) for (const w of hitsOf(W(src), t)) need("weather", id, w);
  // vehicles, the sky, flight, transformations
  for (const w of hitsOf(W(VEHICLES), t)) need("vehicle", "vehicle", w);
  for (const w of hitsOf(W(SKY), t)) need("sky", "sky", w);
  for (const s of t.split(/(?<=[.!?])\s+/)) { if (FLIGHT_OK.test(s)) continue; for (const w of hitsOf(FLIGHT, s)) need("flight", "flight", w); }
  for (const w of hitsOf(TRANSFORM, t)) need("transform", "transform", w);
  for (const w of hitsOf(W(ACTIONS_NOT), t)) need("action", "action", w);
  // crowds: by day only (per sentence: a crowd and the night in the same sentence)
  for (const s of t.split(/(?<=[.!?])\s+/)) {
    const c = hitsOf(CROWD, s);
    if (c.length) { tags.crowd = true; if (!v.crowdsAtNight && NIGHT.test(s)) need("crowd_night", "crowd", c[0]); }
  }
  return { needs, tags };
}

// ------------------------------------------------------------------------------------------------ unknown nouns
// A concrete noun the kit doesn't know (not a kit thing, not in NOT_IN_KIT): found after a determiner, a possessive or a
// number ("the gate", "his leash", "a hundred leashes", "the rusty key"), skipping up to two adjectives. Everyday words the
// board never has to build are not nouns to film: people, the body, time, places the kit has, abstract words.
const DETS = new Set("the a an his her my their our your its these those every each two three four five six seven eight nine ten twelve hundred thousand dozen some any another".split(" ")); // not that / this / one / no / all / both: mostly pronouns there ("no one", "all of", "that the")
const FUNCTION = new Set("and or but with without who whom whose which what when where why how the a an that this than then has have had get gets got keep keeps follow follows step steps stand stands fall falls roll rolls topple can could will would must should may might shall is are was were be been being do does did not of for from into onto upon about above below under over across through around near behind beside between against along among within".split(" "));
const ADJS = new Set("big small little tiny huge giant enormous long short tall low high old new young rusty shiny dusty dirty clean empty full broken open closed shut wooden metal iron golden silver plastic paper glass stone red blue green yellow orange purple pink white black brown grey gray dark bright light heavy soft hard warm cold hot wet dry quiet loud secret magic strange weird odd funny scary spooky creepy angry happy sad sleepy lazy brave nosy shortest longest tallest biggest smallest best worst first last next only same other whole entire extra spare favorite favourite own real fake round square flat thin fat thick wide narrow deep sharp sticky fluffy fuzzy hairy bald striped spotted lucky unlucky special normal ordinary single double half front back top bottom left right middle inner outer upper lower north south east west main local entire every very so too more most much many few out up off down away over just still even almost nearly really quite wild grown grown-up rude youngest oldest".split(" "));
const EVERYDAY = new Set(("rule rules law laws town towns city time times day days night nights week weeks month months year years morning mornings evening afternoon noon midnight minute minutes second seconds hour hours moment moments age " +
  "way ways thing things stuff end ends start beginning part parts side sides rest top bottom middle edge kind sort lot lots bit bits piece pieces number numbers amount " +
  "idea ideas plan plans problem problems trouble answer question reason secret secrets truth joke jokes word words name names story stories life lives luck deal deals trick tricks game games turn turns chance point points " +
  "line lines list job jobs work fun fear rule's price cost rent fine prize reward punishment promise mistake mess noise noises sound sounds voice voices breath shout scream silence song songs laugh laughter smile " +
  "people person persons kid kids child children boy boys girl girls man men woman women mom mum mother dad father parent parents grandpa grandma gran granny grandad grandfather grandmother brother brothers sister sisters baby babies " +
  "family families friend friends neighbour neighbours neighbor neighbors teacher teachers coach mayor everyone everybody nobody somebody someone anyone guy guys lady ladies folks crowd crowds owner owners stranger strangers " +
  "head heads hand hands face faces eye eyes nose noses mouth mouths ear ears arm arms leg legs foot feet finger fingers hair belly bellies tummy chin chins knee knees shoulder shoulders toe toes tongue tongues teeth tooth tail tails paw paws body back neck cheek cheeks lip lips heart " +
  "house houses home homes room rooms window windows door doors wall walls floor floors roof roofs street streets road roads yard yards garden gardens porch porches kitchen kitchens bedroom bedrooms bed beds sofa couch table tables chair chairs lamp lamps light lights " +
  "school schools class classroom shop shops store stores park parks square woods forest tree trees grass path paths pond bench benches sky moon sun star stars cloud clouds ground air water dark darkness shadow shadows " +
  "turn way place places spot spots inside outside corner corners front everything nothing something anything ones bunch group team " +
  "dog dogs cat cats pane panes glass inch inches mile miles meter meters grown-up grown-ups grownup grownups adult adults").split(/\s+/));
// words a determiner can precede that are not nouns (adverbs, past-tense verbs after "that")
const NOT_NOUN = /^(?:fast|slow|slowly|quickly|soon|now|then|here|there|again|ever|never|always|once|twice|already|yet)$|ed$/;
const NOUN_MAX = 3; // a noun phrase head within 3 words of its determiner
function nounCandidates(text) {
  const t = words(text).split(/\s+/).filter(Boolean), out = [];
  for (let i = 0; i < t.length; i++) {
    if (!DETS.has(t[i])) continue;
    let j = i + 1, skipped = 0;
    while (j < t.length && (ADJS.has(t[j]) || DETS.has(t[j]) || (/est$/.test(t[j]) && t[j].length > 5)) && skipped < NOUN_MAX - 1) { j++; skipped++; } /* superlatives (rudest, youngest) are adjectives */
    const w = t[j]; if (!w || w.length < 3 || /'/.test(w) || NOT_NOUN.test(w) || FUNCTION.has(w) || DETS.has(w) || /^(?:one|all|no|that|this|both)$/.test(w) || /(?:ing|less|ful|ous|ive|able|ible|ant)$/.test(w)) continue; /* adjectives by their ending (glowing, cloudless, important) */
    out.push(w);
  }
  return out;
}
/** the unknown concrete nouns of the lines: [{ word, lines }] (kit things, NOT_IN_KIT words, names and everyday words left out) */
export function unknownNouns(lines, kit = BOARD_KIT) {
  const covered = coveredBy(kit), v = kitView(kit);
  const known0 = [...covered, ...v.props.flatMap((p) => p.words.map((w) => String(w).toLowerCase())), ...v.animals, ...v.weather, ...v.places.map((p) => p.id)];
  const known = new Set([...known0, ...known0.map((w) => singular(w))]);
  const names = new Set(lines.flatMap((l) => [...String(l).matchAll(/(?<![.!?]\s|^)\b([A-Z][a-z]+)\b/g)].map((m) => m[1].toLowerCase())));
  const seen = new Map();
  lines.forEach((text, i) => {
    for (const w of nounCandidates(text)) {
      const k = singular(w);
      if (EVERYDAY.has(w) || EVERYDAY.has(k) || known.has(w) || known.has(k) || NOT.has(w) || NOT.has(k) || names.has(w) || kitHas(w) || ANIMAL_SYNONYMS[w]) continue;
      const e = seen.get(k) ?? { word: k, kind: "unknown", lines: [] }; if (!e.lines.includes(i)) e.lines.push(i); seen.set(k, e);
    }
  });
  return [...seen.values()];
}

// ------------------------------------------------------------------------------------------------ the one check
const MUST = (lines, n) => lines.length >= 2 || lines.some((i) => i <= 1 || i >= n - 2);
export const PREMISE_SHARE = 0.34;
const PREMISE_KINDS = new Set(["place", "world", "creature"]);
export function kitCheck(scriptOrLines, { card = null, kit = BOARD_KIT, boardOnly = false } = {}) {
  const raw = Array.isArray(scriptOrLines) ? scriptOrLines : scriptOrLines?.lines ?? [];
  const lines = raw.map((l) => String(l?.text ?? l));
  const n = lines.length, seen = new Map();
  const covered = coveredBy(kit);
  const add = (kind, word, i) => { const k = singular(String(word).toLowerCase().trim()); const e = seen.get(k) ?? { word: k, kind, lines: [] }; if (!e.lines.includes(i)) e.lines.push(i); seen.set(k, e); };
  const all = lines.join("\n") + "\n" + [card?.premise, card?.opener].filter(Boolean).join("\n");
  const creature = scanText(all, kit).tags.creature != null;
  lines.forEach((text, i) => {
    const t = words(text).split(/\s+/).filter(Boolean);
    for (let k = 0; k < t.length; k++) for (const g of [t[k], t.slice(k, k + 2).join(" ")]) { const kind = NOT.get(g) ?? NOT.get(singular(g)); if (kind && !covered.has(g) && !covered.has(singular(g))) add(kind, g, i); }
    for (const r of PHRASE_RULES) if (r.re.test(text) && (!r.needs || r.needs.test(text)) && !covered.has(r.word)) add(r.kind, r.word, i);
    for (const x of scanText(text, kit, { creature }).needs) if (!covered.has(singular(String(x.word).toLowerCase())) && !covered.has(String(x.value ?? "").toLowerCase())) add(x.kind, x.word, i);
  });
  const missing = [], warnings = [];
  for (const e of seen.values()) { e.lines.sort((a, b) => a - b); (MUST(e.lines, n) ? missing : warnings).push(e); }
  const found = []; lines.forEach((l, i) => { for (const tok of words(l).split(/\s+/)) { const id = kitHas(tok); if (!id) continue; const f = found.find((x) => x.id === id); if (f) { if (!f.lines.includes(i)) f.lines.push(i); } else found.push({ id, kind: (ALIAS.get(tok) ?? ALIAS.get(singular(tok)))?.kind ?? "prop", lines: [i] }); } });
  // UNKNOWN NOUNS (2026-11-12): a noun the kit doesn't know in a must-have position (the first / last 2 lines, the
  // escalation, or on 2+ lines) is a warning, "unknown - not in kit"; board-only (boardOnly: true) makes it a hard miss
  const escal = new Set(raw.map((l, i) => (/^(until|escalation|adults|trigger)$/.test(String(l?.part ?? l?.beat ?? "")) ? i : -1)).filter((i) => i >= 0));
  const unknown = unknownNouns(lines, kit).filter((e) => !seen.has(e.word) && (MUST(e.lines, n) || e.lines.some((i) => escal.has(i))));
  for (const e of unknown) (boardOnly ? missing : warnings).push({ ...e, why: "unknown - not in kit" });
  const bad = new Set(missing.flatMap((e) => e.lines));
  const premise = n > 0 && (missing.some((e) => PREMISE_KINDS.has(e.kind) && e.lines.some((i) => i <= 1)) || bad.size / n > PREMISE_SHARE);
  return { ok: !missing.length, missing, warnings, found, premise, unknown };
}
