// Blocky Worlds BOARD-ONLY LAUNCH MODE (owner, 2026-11-12): "does this idea / script fit what the board kit can film?"
// One server-side helper on top of the kit manifest (boardKit.js) and the engine side's early check (kitCheck.js); both are
// owned by the engine side: this file only READS them and adds what they don't cover. Pure:
// no I/O, no calls, free. Used by the idea picker (the library filter), the writers (the kit as hard constraints), the
// script checks (boardFitProblems, before anything is charged) and the page ("What we can film").
//
// The manifest lists WHAT the kit can show (places, the 5 monster looks on one tall body, animals, weather, crowds,
// actions, notYet). The WORDS that signal each thing in a script are this file's lexicon (an adapter: the manifest has
// no word lists yet). When the kit grows, the manifest changes and this file follows it automatically for everything
// listed by id (a new place id, animal, weather or monster look); a brand-new KIND of thing needs its words here.
//
// Switches (function secrets, read by the endpoint and passed in):
//   BLOCKY_WORLDS_LAUNCH=board       the picker shows only fitting ideas, the writers get the kit as hard rules, every
//                                    script is checked against the kit before the charge
//   BLOCKY_WORLDS_BOARD_ONLY=on      the render has no old-planner fallback (render.js: job.prepare.storyboard.maxFallback 0;
//                                    any line the board can't film fails as KIT_UNSUPPORTED and is refunded). Implies
//                                    launch mode (a strict render without the pre-charge check would refund far too often).
import { BOARD_KIT } from "./boardKit.js";
import { kitCheck, kitHas, NOT_IN_KIT } from "./kitCheck.js";

/** A line the video can't show (fix "part": Fix it rewrites only that part). */
export const BOARD_PREFIX = "The video can't show";
/** The whole story happens where the board can't go (fix "move": the "Move it to our town" rewrite). */
export const PREMISE_PREFIX = "This story happens where our videos can't go yet";

const on = (v) => ["on", "true", "1", "yes", "board"].includes(String(v ?? "").trim().toLowerCase());
/** BLOCKY_WORLDS_BOARD_ONLY: the strict render (no old-planner lines). get: (name) => string */
export const boardOnlyFrom = (get = () => "") => on(get("BLOCKY_WORLDS_BOARD_ONLY"));
/** Launch mode (the picker filter, the steering, the pre-charge check): BLOCKY_WORLDS_LAUNCH=board, or BOARD_ONLY on. */
export const launchModeFrom = (get = () => "") => String(get("BLOCKY_WORLDS_LAUNCH") ?? "").trim().toLowerCase() === "board" || boardOnlyFrom(get);

// ---------------------------------------------------------------- the kit, as the server reads it
/** Short names for the page and the prompts; an id the kit adds later is shown by its id ("town_day" -> "town day"). */
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
export function canFilm(kit = BOARD_KIT) {
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
export const canFilmLine = (kit = BOARD_KIT) => list(canFilm(kit).map((x) => x.label));
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

/**
 * What an idea card says. CORE: the world and the story's spine (a miss here means the idea can't be filmed). DETAIL: the
 * examples, the narrator line, the teaser and the closer (a miss there is a word the writer replaces with a kit thing; the
 * script check catches it if it stays). The setting field is read on its own: it names one of formulas.js SETTINGS.
 */
const coreText = (idea) => [idea?.opener, idea?.title, idea?.premise, idea?.price, idea?.twist].filter(Boolean).join("\n");
const detailText = (idea) => [...(Array.isArray(idea?.examples) ? idea.examples : []), idea?.narrator, idea?.teaser, idea?.closer].filter(Boolean).join("\n");
/** formulas.js SETTINGS -> the place it needs (null = fine with the kit's places). */
const SETTING_NEEDS = [
  [/^farm/i, "farm"], [/canyon|cliff/i, "canyon"], [/castle/i, "castle"], [/underground|cave/i, "cave"], [/underwater|submarine/i, "underwater"], [/inside something giant/i, "inside_giant"],
];
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Whether a thing (a planted object: "A roll of masking tape") is one the board can film: the kit's own answer first
 * (kitCheck.js kitHas: a prop, animal or place of the manifest), then the props the kit's actions and room use.
 */
export function propFilmable(prop, kit = BOARD_KIT) {
  // the thing itself, not where it is kept or what it holds ("A stale bagel in her backpack" is a bagel, "a jar of pepper"
  // is pepper: the climax shows the pepper): the phrase's last noun
  const p = propHead(prop);
  if (!p) return true;
  if (kit === BOARD_KIT && kitHas(p)) return true;
  return kitView(kit).props.some((x) => x.words.some((w) => w && new RegExp(`\\b${esc(lower(w).replace(/_/g, " "))}(?:e?s)?\\b`).test(p)));
}

// ---------------------------------------------------------------- on top of the engine side's kitCheck.js
// kitCheck (the engine side's early check: vehicles, places, creatures and props NOT in the kit, a must-have rule) is THE
// check; this file adds only what it doesn't cover (weather, crowds at night, the monster looks, other animals, a town
// inside a giant thing, the sky, flying, transformations, actions the board can't animate) with the SAME must-have rule.
const KIT_CHECK_WORDS = new Set(Object.values(NOT_IN_KIT).flat().map(lower));
const singular = (w) => w.replace(/(?:es|s)$/, "");
/** A word kitCheck itself judges (its NOT_IN_KIT list, with its own plural rule: one trailing "s"). */
const judgedByKitCheck = (word) => { const w = lower(word).trim(); return KIT_CHECK_WORDS.has(w) || KIT_CHECK_WORDS.has(w.replace(/s$/, "")); };
/** A word kitCheck judges, or a single word the kit has (kitHas): never an extra miss. */
const coveredByKitCheck = (word) => judgedByKitCheck(word) || (!/\s/.test(lower(word).trim()) && kitHas(lower(word).trim()) != null);
/**
 * kitCheck's must-have misses, as this file uses them. Two adapters: kitCheck strips one trailing "s" from every word, so
 * "bus" comes back as "bu" (the word is put back from its NOT_IN_KIT list); and kitCheck always judges the real kit, so
 * for another kit (a what-if: a kit that grew a cave) a word that kit lists as a place, animal or prop is not a miss.
 */
function kitCheckMisses(scriptOrLines, kit = BOARD_KIT) {
  const v = kitView(kit);
  const listed = new Set([...v.places.map((p) => p.id), ...v.animals, ...v.props.flatMap((p) => p.words)].map(lower));
  return kitCheck(scriptOrLines).missing
    .map((m) => ({ ...m, word: KIT_CHECK_WORDS.has(m.word) ? m.word : KIT_CHECK_WORDS.has(`${m.word}s`) ? `${m.word}s` : m.word }))
    .filter((m) => kit === BOARD_KIT || !listed.has(m.word));
}
/** kitCheck's must-have rule (kitCheck.js): named in lines 0-1, in the last two lines, or in two lines. */
const mustHave = (lines, count) => lines.length >= 2 || lines.some((i) => i <= 1 || i >= count - 2);

/** The thing a planted-object phrase names ("A roll of masking tape" -> "tape", "A paper sign reading ASK FIRST" -> "sign"). */
const propCore = (prop) => String(prop ?? "").replace(/\b(that|which|with|reading|from|in|on|for|to|tucked|hidden|kept)\b.*$/i, "").trim();
export function propHead(prop) {
  const words = propCore(prop).replace(/[^A-Za-z' -]/g, " ").trim().split(/\s+/).filter(Boolean);
  const w = lower(words.at(-1) ?? "").replace(/'s$/, "");
  return w.length >= 3 ? w : null;
}

/**
 * Does an idea fit the board kit? -> { fit, need: [{ kind, value, words }], soft: [...same], tags, version }.
 * need: the misses in the idea's core (its world, rule, price, twist, setting and planted object): fit is false.
 * soft: misses only in its details (examples, narrator, teaser, closer): the writer swaps those words; fit stays true.
 * A stored tag set on the idea (idea.kit = { need, soft, version }) is used only while it was made for this kit's version;
 * otherwise it is recomputed (the kit grows weekly: a stored yes/no goes stale).
 */
export function kitFit(ideaOrText, kit = BOARD_KIT) {
  const v = kitView(kit);
  if (ideaOrText && typeof ideaOrText === "object" && ideaOrText.kit?.version === v.version && Array.isArray(ideaOrText.kit.need)) {
    return { fit: ideaOrText.kit.need.length === 0, need: ideaOrText.kit.need, soft: ideaOrText.kit.soft ?? [], tags: ideaOrText.kit.tags ?? {}, version: v.version, stored: true };
  }
  const idea = typeof ideaOrText === "string" ? { premise: ideaOrText } : ideaOrText ?? {};
  const all = scanText(`${coreText(idea)}\n${detailText(idea)}`, kit);
  // kitCheck on one line = every hit counts (an idea's core is all "must-have"); then this file's extras on top
  const misses = (text) => [
    ...kitCheckMisses([text], kit).map((m) => ({ kind: m.kind, value: m.kind, word: m.word })),
    ...scanText(text, kit, { creature: all.tags.creature != null }).needs.filter((n) => !coveredByKitCheck(n.word)),
  ];
  const core = misses(coreText(idea)), detail = misses(detailText(idea));
  const placeIds = new Set(v.places.map((p) => p.id));
  for (const [re, id] of SETTING_NEEDS) if (re.test(idea.setting ?? "") && !placeIds.has(id)) core.push({ kind: id === "inside_giant" ? "world" : "place", value: id, word: idea.setting });
  if (idea.prop && !propFilmable(idea.prop, kit)) core.push({ kind: "prop", value: "prop", word: idea.prop });
  // grouped by kind + value (the words that signal each)
  const group = (xs) => { const out = []; for (const n of xs) { const g = out.find((x) => x.kind === n.kind && x.value === n.value); if (g) { if (!g.words.includes(n.word)) g.words.push(n.word); } else out.push({ kind: n.kind, value: n.value, words: [n.word] }); } return out; };
  const need = group(core), soft = group(detail).filter((s) => !need.some((n) => n.kind === s.kind && n.value === s.value));
  return { fit: need.length === 0, need, soft, tags: all.tags, version: v.version };
}
/** The boardFit tag of a library row or an idea card (computed at read time). */
export const boardFitOf = (idea, kit = BOARD_KIT) => kitFit(idea, kit);
/** Only the ideas that fit (rows of { idea } or bare idea cards), in their order. */
export const fittingOnly = (rows, kit = BOARD_KIT) => (rows ?? []).filter((r) => kitFit(r?.idea ?? r, kit).fit);

// ---------------------------------------------------------------- script checks (free, before the charge)
const WHY = {
  place: (v) => `our videos are filmed on ${placesLine(v)}`,
  world: () => "towns inside or on a giant thing aren't in our block world yet",
  creature: (v) => `our one creature is a tall figure with ${list(v.creatures.map((c) => c.label), "or")}; describe it as one of those`,
  creature_look: (v) => `no monster look can show that; our creature has ${list(v.creatures.map((c) => c.label), "or")}`,
  animal: (v) => `the animals we can film are ${list(v.animals)}`,
  weather: (v) => `the weather we can film is ${list(v.weather)} (falling snow, not snow on the ground)`,
  vehicle: () => "vehicles aren't in our block world yet",
  sky: () => "sky events aren't in our block world yet",
  flight: () => "people or things flying or floating away aren't in our block world yet",
  transform: () => "things turning into other things aren't in our block world yet",
  crowd_night: () => "crowds can be filmed by day only; at night show two or three named people",
  action: () => "riding, swimming and digging aren't in our block world yet",
  prop: (v) => `it isn't in our props kit (we have ${v.props.filter((p) => !p.fromActions).slice(0, 8).map((p) => `${p.what}s`).join(", ")} and more)`,
};
/** The kinds that make a miss in the first line a whole-premise miss (the world itself, not one line's detail). */
const PREMISE_KINDS = new Set(["place", "world", "creature"]);
/** More than this share of the lines missing: the story itself is somewhere else (a premise miss). */
export const PREMISE_SHARE = 0.34;

/**
 * Every thing a script needs that the board kit can't film, as check problems (free; same words in, same problems out).
 * The engine side's kitCheck(script) is the base (its NOT_IN_KIT words and its must-have rule); this file adds the kinds it
 * doesn't cover (scanText) and the card's planted object, with the same must-have rule. card: the idea card (its creature
 * words count for the whole story). Returns { problems, warnings, premise, missing: [{ word, kind, lines, source }] }:
 *   - a must-have miss: `The video can't show "<word>" (line N[, M]): <why>.` (problemSpots -> that line's part, Fix it)
 *   - a whole-premise miss (a place, world or creature miss in the opener lines 0-1, or misses in more than PREMISE_SHARE
 *     of the lines): ONE problem that starts with PREMISE_PREFIX (problemSpots -> fix "move": "Move it to our town")
 *   - a mention that is not a must-have (once, mid-story): a warning only (the advisory notes), never a block
 */
export function boardFitProblems(script, card = null, kit = BOARD_KIT) {
  const v = kitView(kit), lines = script?.lines ?? [], n = lines.length;
  const entries = new Map();
  const add = (kind, word, i, source) => { const k = lower(singular(lower(word).trim())) || lower(word); const e = entries.get(k) ?? { word: lower(word).trim(), kind, lines: [], source }; if (!e.lines.includes(i)) e.lines.push(i); entries.set(k, e); };
  // 1. the engine side's check (only its must-have misses come back)
  for (const m of kitCheckMisses(script, kit)) for (const i of m.lines) add(m.kind, m.word, i, "kitCheck");
  // 2. what it doesn't cover
  const all = lines.map((l) => l.text).join("\n") + "\n" + [card?.premise, card?.opener].filter(Boolean).join("\n");
  const creature = scanText(all, kit).tags.creature != null;
  // (a word kitCheck judges but didn't return is a mention it decided is not a must-have: a warning only)
  lines.forEach((l, i) => { for (const x of scanText(l.text, kit, { creature }).needs) if (judgedByKitCheck(x.word)) add(x.kind, x.word, i, "seen"); else if (!coveredByKitCheck(x.word)) add(x.kind, x.word, i, "boardFit"); });
  // 3. the card's planted object (a library idea's or a pasted script's card) must be filmable: the lines that name it
  const head = card?.prop && !propFilmable(card.prop, kit) ? propHead(card.prop) : null;
  if (head && !coveredByKitCheck(head)) lines.forEach((l, i) => { if (new RegExp(`\\b${esc(head)}(?:e?s)?\\b`, "i").test(l.text)) add("prop", head, i, "card"); });
  const missing = [], warnings = [];
  for (const e of entries.values()) { e.lines.sort((a, b) => a - b); (e.source === "kitCheck" || (e.source !== "seen" && mustHave(e.lines, n)) ? missing : warnings).push(e); }
  const badLines = new Set(missing.flatMap((e) => e.lines));
  const opener = missing.filter((e) => PREMISE_KINDS.has(e.kind) && e.lines.some((i) => i <= 1));
  const premise = n > 0 && (opener.length > 0 || badLines.size / n > PREMISE_SHARE);
  const why = (e) => WHY[e.kind]?.(v) ?? "it isn't in our block world yet";
  const at = (e) => (e.lines.length === 1 ? `line ${e.lines[0] + 1}` : `lines ${list(e.lines.slice(0, 4).map((i) => String(i + 1)))}`);
  const warn = warnings.map((e) => `Our block world can't show "${e.word}" (${at(e)}): ${why(e)}. It's only mentioned once, so that shot shows the closest thing we have.`);
  if (premise) {
    const words = [...new Set((opener.length ? opener : missing).map((e) => e.word))].slice(0, 4).map((w) => `"${w}"`);
    return { premise: true, problems: [`${PREMISE_PREFIX} (${list(words)}). "Move it to our town" keeps your rule and films it on ${placesLine(v)}.`], warnings: warn, missing };
  }
  return { premise: false, problems: missing.map((e) => `${BOARD_PREFIX} "${e.word}" (${at(e)}): ${why(e)}.`), warnings: warn, missing };
}
/** The lines a board problem is about (0-based), [] for anything else. */
export function boardProblemLines(p) {
  const m = String(p).startsWith(BOARD_PREFIX) ? String(p).match(/\((lines? [^)]*)\):/) : null;
  return m ? [...m[1].matchAll(/\d+/g)].map((x) => Number(x[0]) - 1) : [];
}
export const isPremiseProblem = (p) => String(p).startsWith(PREMISE_PREFIX);

// ---------------------------------------------------------------- the kit as HARD rules for the writers
/**
 * The kit as a prompt block (the same text for the same kit: the prompts that carry it stay cacheable). who: "ideas"
 * (topic and batch ideas), "plan" (the hybrid planner), "lines" (the line writer).
 */
export function kitBlock(kit = BOARD_KIT, who = "plan") {
  const v = kitView(kit);
  const rows = [
    `THE WORLD WE CAN FILM (a HARD rule: every video is built only from this kit; a line that needs anything else can't be filmed and the video is refused):`,
    `- PLACES (every scene happens in one of these): ${v.places.map((p) => `${p.label} (${p.what})`).join("; ")}.`,
    v.creatures.length ? `- THE CREATURE: at most one, always the same tall body in ONE of these looks: ${v.creatures.map((c) => `${c.id} = ${c.what} (${c.signature})`).join("; ")}. It ${v.creatureMoves}. Pick one look and describe the creature ONLY with that look's words (the eye, the shadow, the grin, the hat or the eyes), never wings, tentacles, slime, fur, scales or a different body; a name is fine ("the Porch Watcher") but the words that describe it must be its look.` : "",
    v.animals.length ? `- ANIMALS (only these): ${list(v.animals)}.` : "",
    v.weather.length ? `- WEATHER (only these): ${list(v.weather)} (falling snow; never snow on the ground, a snowman, fog or a storm).` : "",
    v.crowds ? `- CROWDS: ${v.crowds}.${v.crowdsAtNight ? "" : " Crowds by DAY only: at night, show two or three named people, never a crowd."}` : "",
    `- PROPS held or set down (only these): ${list(v.props.map((p) => p.what))}.`,
    v.notYet.length ? `- NOT YET (never write these): ${v.notYet.join("; ")}; flying or floating away, sky events, things turning into other things.` : "",
  ];
  const tail = {
    ideas: "Every idea must be filmable with this kit alone. If the user's idea needs something outside it, MOVE it into the kit and keep the user's rule and hook: a cave town becomes our street at night, a dragon becomes the tall creature with one huge eye, a spaceship becomes a shop window full of blinking lights, an underwater school becomes a classroom where the rain never stops. Name the moved world plainly in the opener.",
    plan: "Plan the whole story inside this kit: the setting, the rule visual, every beat's \"shows\", the neighbours, the adults' failed attempts and the save must all be filmable with the places, the creature looks, the animals, the weather and the props listed. Anything the topic needs outside the kit is MOVED into it (keep the rule and the hook; change the place or the body): a cave town becomes our street at night, a dragon becomes the tall creature with one huge eye. If the story has a creature, name its look in the rule visual's description.",
    lines: "Every line must be filmable with this kit: never name a place, creature body, animal, weather, vehicle or prop outside it, even in a joke or a comparison. Describe the creature only with the look the plan gave it.",
  }[who] ?? "";
  return [...rows.filter(Boolean), tail].filter(Boolean).join("\n");
}

/** The note for "Move it to our town" (the writer's rewrite note): the rule and the hook stay, the world moves into the kit. */
export function moveNote(problems = [], kit = BOARD_KIT) {
  const v = kitView(kit);
  const words = [...new Set((problems ?? []).flatMap((p) => [...String(p).matchAll(/"([^"]{1,40})"/g)].map((m) => m[1])).filter((w) => !/^move it/i.test(w)))].slice(0, 6);
  const head = `Move the story into the world we can film: ${placesLine(v)}.${words.length ? ` Replace: ${words.join(", ")}.` : ""} Keep the rule, the hook, the names and the ending.`;
  const creature = v.creatures.length ? ` At most one tall creature (${list(v.creatures.map((c) => c.label), "or")}).` : "";
  return (head.length + creature.length <= 300 ? head + creature : head).slice(0, 300);
}
