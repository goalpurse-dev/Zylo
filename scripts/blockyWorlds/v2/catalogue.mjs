// IN THIS TOWN v2, NIGHT BUILD: THE CATALOGUE (generated). Everything that PASSED its free checks and its test sheet,
// one line each: towns, side sets, big things, times, weathers, raining things, people, animals, entities, props,
// effects. The writer and the planner read it live (catalogueMenu). The pass list is places/passed.json (an item is
// added there only after its sheet passed; a half-built item is never in it).
//   node scripts/blockyWorlds/v2/catalogue.mjs        -> writes v2/catalogue.json + v2/catalogue.md
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allPlaces, loadPlace } from "./placeKit.mjs";
import { BIG_THINGS } from "./places/bigthings.mjs";
import { CHARACTERS, NEIGHBOURS, EXTRA_SPECS, ANIMALS, ENTITIES, ENTITY_TONE } from "./characters.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PASSED_FILE = path.join(HERE, "places", "passed.json");
export const TIMES = { day: "bright midday", golden: "golden hour, long warm light", dusk: "dusk, purple sky, lights coming on", night: "night, lit windows and lamps", storm: "storm light, dark and cold", morning: "soft early morning" };
export const WEATHERS = { clear: "clear", rain: "rain falling", storm: "heavy storm with lightning", snow: "snow falling and lying", fog: "thick fog", wind: "wind with blowing leaves", danger: "red danger sky, pulsing red light", eclipse: "an eclipse: a black sun with a glowing ring" };
export const RAIN_THINGS = { key: "golden keys", coin: "gold coins", frog: "frogs", pillow: "pillows", letter: "letters", phone: "phones", box: "parcels" };
export const PROPS = { phone: "a phone with a readable screen (text)", key: "a key (small in a hand, readable in close-up, a number tag)", clock: "a clock", money: "money notes", food: "a burger", book: "a book", pencil: "a pencil", backpack: "a backpack", ball: "a ball", sign: "a hand sign with text", umbrella: "an umbrella", bike: "a bike", coin: "a gold coin", frog: "a frog", letter: "a letter", car: "a car (parked or driving)", bus: "a bus (text on its side)", seccam: "a security camera on a pole", screen: "a big screen with text", billboard: "a billboard with text" };
export const EFFECTS = { lava: "lava covering the street", water: "water covering the street", grow: "a thing growing giant", glow: "a glow", smoke: "smoke", sparks: "sparks", confetti: "confetti", lights_out: "the lights going out one by one" };

export function readPassed() { return fs.existsSync(PASSED_FILE) ? JSON.parse(fs.readFileSync(PASSED_FILE, "utf8")) : {}; }
export function markPassed(kind, ids) {
  const p = readPassed();
  p[kind] = [...new Set([...(p[kind] ?? []), ...ids])];
  fs.writeFileSync(PASSED_FILE, JSON.stringify(p, null, 1));
  return p;
}

export async function buildCatalogue() {
  const P = readPassed(), places = await allPlaces();
  const place = (id) => { const S = loadPlace(places[id]); return { id, name: S.name, look: S.look, spots: Object.fromEntries(Object.entries(S.spots).map(([k, v]) => [k, v.tag ?? ""])), creature_spots: Object.keys(S.creature_spots ?? {}),
    cameras: Object.fromEntries(Object.entries(S.cameras).map(([k, c]) => [k, { shot: c.shot === "top" ? "aerial" : c.shot, people: c.people, creature: c.creature ?? null }])), times: S.times, big_spot: S.big ? S.big.note : null,
    texts: [...new Set(S.prims.filter((q) => q.key).map((q) => q.key))] }; };
  const specs = { ...CHARACTERS, ...NEIGHBOURS, ...EXTRA_SPECS };
  return {
    towns: (P.towns ?? []).filter((id) => places[id]).map(place),
    side_sets: (P.side_sets ?? []).filter((id) => places[id]).map(place),
    big_things: (P.big_things ?? []).filter((k) => BIG_THINGS[k]).map((k) => ({ id: k, look: BIG_THINGS[k].look, states: Object.keys(BIG_THINGS[k].states), close_camera: `${k}_close` })),
    times: (P.times ?? []).map((k) => ({ id: k, look: TIMES[k] })), weathers: (P.weathers ?? []).map((k) => ({ id: k, look: WEATHERS[k] })),
    rain_things: (P.rain_things ?? []).map((k) => ({ id: k, look: RAIN_THINGS[k] ?? k })),
    people: (P.people ?? []).filter((k) => specs[k]).map((k) => ({ id: k, role: specs[k].role })),
    animals: (P.animals ?? []).map((k) => ({ id: k, look: ANIMALS[k] })), entities: (P.entities ?? []).map((k) => ({ id: k, tone: ENTITY_TONE[k] ?? "scary", look: ENTITIES[k], states: ["stand", "walk", "reach", "peek", "loom", "eyes"], show: ["full", "silhouette", "eyes"] })),
    props: (P.props ?? []).map((k) => ({ id: k, look: PROPS[k] ?? k })), effects: (P.effects ?? []).map((k) => ({ id: k, look: EFFECTS[k] ?? k })),
    skipped: P.skipped ?? {},
  };
}

/** one line per item (what the writer reads) */
export function catalogueLines(C) {
  const L = [];
  for (const t of C.towns) L.push(`TOWN ${t.id}: ${t.name}: ${t.look}. Middle spot for a big thing: ${t.big_spot}.`);
  for (const s of C.side_sets) L.push(`SIDE SET ${s.id}: ${s.name}: ${s.look}.`);
  for (const b of C.big_things) L.push(`BIG THING ${b.id}: ${b.look} (states: ${b.states.join(", ")}).`);
  L.push(`TIMES: ${C.times.map((x) => x.id).join(", ")}. WEATHER: ${C.weathers.map((x) => x.id).join(", ")}. RAINING THINGS (any amount, starts/stops per shot): ${C.rain_things.map((x) => x.id).join(", ")}.`);
  for (const p of C.people) L.push(`PERSON ${p.id}: ${p.role}.`);
  for (const a of C.animals) L.push(`ANIMAL ${a.id}: ${a.look}.`);
  for (const e of C.entities) L.push(`ENTITY ${e.id} (${e.tone}): ${e.look} (states ${e.states.join("/")}; shown full, as a silhouette or eyes only).`);
  L.push(`PROPS: ${C.props.map((p) => p.id).join(", ")}. EFFECTS: ${C.effects.map((p) => p.id).join(", ")}.`);
  return L;
}

if (process.argv[1]?.endsWith("catalogue.mjs")) {
  const C = await buildCatalogue();
  fs.writeFileSync(path.join(HERE, "catalogue.json"), JSON.stringify(C, null, 1));
  const lines = catalogueLines(C);
  fs.writeFileSync(path.join(HERE, "catalogue.md"), `# In This Town v2: the catalogue (generated by catalogue.mjs; only items that passed)\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\n## Skipped\n${Object.entries(C.skipped).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- none"}\n`);
  console.log(`catalogue: ${C.towns.length} towns, ${C.side_sets.length} side sets, ${C.big_things.length} big things, ${C.times.length} times, ${C.weathers.length} weathers, ${C.people.length} people, ${C.animals.length} animals, ${C.entities.length} entities, ${C.props.length} props, ${C.effects.length} effects`);
}
