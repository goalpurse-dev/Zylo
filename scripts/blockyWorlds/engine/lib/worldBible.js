// Blocky Worlds: the WORLD BIBLE (owner, 2026-11-06, PERMANENT RULE "world continuity"; docs/blocky-worlds-protocol.md).
// A story feels real only in ONE consistent world. Before any shot is planned, the bible fixes that world once: the host
// creature (species, size, colours, back features), the town on / in it (a seeded layout: streets, named buildings and
// landmarks with positions, palette, building style), the spots every shot may stand in (outside wide, main street,
// deck at the shell edge, stairs, rooftop, school, home...), each character's look (outfit colours, hair, a fixed
// seed), the key props with their looks, and the time-of-day timeline. Every shot then references it; checkTimeline
// fails a shot whose set / spot / cast look / prop / town seed is not the bible's (worldBibleProblems).
// Pure and deterministic (no I/O, no Math.random): the same production + script give the same bible.
//
//   buildWorldBible({ production, script, idea, title }) -> bible              (before shot planning)
//   applyBible(tl, bible) -> { bound, spots }   tl.world = bible; cast looks, shot.worldSpot + shot.onCreature,
//                                               tl.worlds[*].seed / town, prop ids (in place; re-runnable)
//   spotFor(bible, shot) -> spot id            the bible spot a shot stands in (by its set + its words)
//   worldBibleProblems(tl) -> [string]          what does not match the bible ([] = consistent)
//   bibleSummary(bible) -> string               the bible in a few lines (the vision judge's reference)
//   bibleLine(bible, shots) -> string           what one line's shots must look like (place + people)
//   saveWorldBible(dir, tl)                     world-bible.json next to timeline.json (Node only)
import { hashSeed, rng } from "./rng.js";
import { petsOf } from "./pets.js";
import { outfitFor, outfitLook, outfitText, eraOf, OUTFITS } from "../page/kit/outfitsData.js"; // CHARACTERS-V2: cast outfits
import { themeFor, rigFor, storyStyle, MAX_PLACE_SHARE, THEMES } from "./setThemes.js"; // SETS-V2: place themes + rigs

export const BIBLE_VERSION = 1;
const PLAIN_SETS = ["street", "bedroom", "school", "woods"];
const cap1 = (s) => String(s ?? "").replace(/^\w/, (c) => c.toUpperCase());
const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "x";
const low = (s) => ` ${String(s ?? "").toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ")} `;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ------------------------------------------------------------------------------------------------ colour words
export const COLOR_HEX = Object.freeze({
  red: "#d63031", crimson: "#b71c1c", pink: "#fd79a8", orange: "#e67e22", yellow: "#f7d038", gold: "#d4a017", golden: "#d4a017",
  green: "#2e9e4f", lime: "#7bd148", olive: "#708238", teal: "#00a8a8", blue: "#2e86de", navy: "#273c75", sky: "#74b9ff",
  purple: "#6c5ce7", violet: "#8e44ad", brown: "#7b4a2a", tan: "#c8a96a", beige: "#e3d3b0", white: "#f2f2f2", cream: "#f5ecd7",
  grey: "#9a9a9a", gray: "#9a9a9a", silver: "#c0c0c0", black: "#2d3436", floury: "#f2f2f2",
});
const COLOR_RE = new RegExp(`\\b(${Object.keys(COLOR_HEX).join("|")})\\b`, "g");
const colorsIn = (s) => [...String(s ?? "").toLowerCase().matchAll(COLOR_RE)].map((m) => m[1]);

// the host creature's own colours and back features per species (the page's creature kit reads tl.world.creature)
const CREATURE_LOOKS = {
  turtle: { skin: "#7a8f4a", back: "#5b6b3a", belly: "#d8c48a", features: ["domed shell", "shell plates", "shell rim", "long neck", "head", "four flippers", "tail"], backWord: "shell" },
  tortoise: { skin: "#8a7a52", back: "#6b5a3a", belly: "#d8c48a", features: ["high domed shell", "shell rim", "neck", "head", "stumpy legs"], backWord: "shell" },
  whale: { skin: "#4a6a8a", back: "#3a5470", belly: "#d9e2ea", features: ["broad back", "blowhole", "tail flukes", "fins", "head"], backWord: "back" },
  elephant: { skin: "#8d8d8d", back: "#7a7a7a", belly: "#a5a5a5", features: ["broad back", "ears", "trunk", "tusks", "head"], backWord: "back" },
  crab: { skin: "#c0392b", back: "#a93226", belly: "#f0b27a", features: ["wide shell", "shell rim", "claws", "eye stalks", "legs"], backWord: "shell" },
  snail: { skin: "#b9a27a", back: "#8e6e4a", belly: "#d8c8a8", features: ["spiral shell", "neck", "eye stalks"], backWord: "shell" },
  default: { skin: "#7f8c6a", back: "#6a7556", belly: "#cfc39a", features: ["broad back", "neck", "head", "legs", "tail"], backWord: "back" },
};
// building styles: the town's one look (walls, roofs, trim), picked once by the town seed
const STYLES = [
  { id: "cottage", text: "plaster cottages with red tile roofs and wooden trim", walls: ["#f3e3c3", "#e9d2a6", "#f6efe1", "#e7c9a0"], roofs: ["#b5452c", "#a63d2a", "#c4573a"], trim: "#6b4a2b" },
  { id: "timber", text: "timber-frame houses with dark brown roofs and white walls", walls: ["#f4f1ea", "#efe6d6", "#e8dcc6"], roofs: ["#5a3b25", "#6b4630", "#4e3322"], trim: "#3b2a1c" },
  { id: "painted", text: "painted wooden houses (teal, yellow, coral) with grey shingle roofs", walls: ["#7fc8c4", "#f6d365", "#f28b82", "#a5d6a7"], roofs: ["#5f6b73", "#6d7880", "#545e66"], trim: "#ffffff" },
  { id: "stone", text: "stone houses with slate roofs and green shutters", walls: ["#c9c1b3", "#b9b0a1", "#d6cfc2"], roofs: ["#4b5563", "#3f4752", "#56606d"], trim: "#2f6b3a" },
];
// the places a town has (named buildings / landmarks) and what words in a shot stand in them
const PLACES = [
  { kind: "home", name: "my house", words: /\b(home|house|bedroom|bed|kitchen|room|asleep|sleep|slept|attic|window)\b/ },
  { kind: "school", name: "the school", words: /\b(school|class|classroom|teacher|recess|homework|desk|hallway)\b/ },
  { kind: "market", name: "the market", words: /\b(market|shop|shops|store|bakery|baker|bread|grocer|grocery|soup|stall|cafe)\b/ },
  { kind: "square", name: "the town square", words: /\b(square|everyone|everybody|crowd|townsfolk|whole town|meeting|mayor|festival|well)\b/ },
  { kind: "hall", name: "the town hall", words: /\b(town hall|hall|council|bell)\b/ },
];
const JOB_PLACE = { baker: ["market", "the bakery"], teacher: ["school", "the school"], mayor: ["hall", "the town hall"], cook: ["market", "the diner"], chef: ["market", "the diner"], farmer: ["market", "the farm stall"], doctor: ["hall", "the clinic"], nurse: ["hall", "the clinic"], librarian: ["hall", "the library"] };
const BUILDING_WORD = /\b(house|home|school|shop|store|bakery|market|tower|hall|church|library|clinic|inn|mill|barn|lighthouse|door|gate|bridge|well|fountain|statue|stone|clock)\b/;

// ------------------------------------------------------------------------------------------------ people looks
const GARMENT = [
  [/\bhoodie|sweater|jumper|shirt|t-shirt|tee|jacket|coat|vest|apron|robe|uniform|overalls|cardigan\b/, "top"],
  [/\bdress\b/, "dress"], [/\bskirt\b/, "skirt"], [/\bshorts\b/, "shorts"], [/\bpants|trousers|jeans\b/, "pants"],
];
const HAIR_WORDS = [[/\bpigtails?|ponytail\b/, "ponytail"], [/\bbun\b/, "bun"], [/\bbald\b/, "bald"], [/\bafro|curly\b/, "afro"], [/\bspiky|messy\b/, "spiky"], [/\blong hair|braid\b/, "long"], [/\bshort hair|crew cut\b/, "short"]];
const HAIR_COLOR = { grey: "#bfbfbf", gray: "#bfbfbf", white: "#efefef", silver: "#d8d8d8", blonde: "#e8c872", blond: "#e8c872", red: "#b5482a", ginger: "#c1652f", brown: "#5a3b25", black: "#1e1e1e", dark: "#2a2a2a" };
const TOPS = ["#2e86de", "#e74c3c", "#20bf6b", "#f7b731", "#8854d0", "#fa8231", "#0fb9b1", "#eb3b5a"];
const PANTS = ["#2f4f86", "#3b5b8f", "#4b6584", "#5d4037", "#2d3436", "#6d6875"];
const HAIRS = ["#2a1a10", "#5a3b25", "#1e1e1e", "#8a5a2b", "#c99b5b"];

export function genderOfPerson(c) {
  const t = low(`${c.name} ${c.look} ${c.id}`);
  if (/\b(mrs|ms|miss|mom|mum|mother|grandma|granny|nana|aunt|sister|queen|princess|lady|girl|woman|old woman|grandmother|shawl|dress|skirt|pigtails?|her|she)\b/.test(t)) return "f";
  if (/\b(mr|dad|father|grandpa|grandad|uncle|brother|king|prince|lord|sir|boy|man|beard|his|he)\b/.test(t)) return "m";
  return null;
}
const ageOf = (c) => (c.role === "kid" || c.role === "baby" || c.role === "elder" ? c.role : /\b(grandma|grandpa|granny|nana|old|elder|grey|gray)\b/.test(low(`${c.name} ${c.look}`)) ? "elder" : c.role === "narrator" ? "kid" : "adult");

/**
 * One character's fixed look: the fields page/kit/people.js lookFor takes as overrides (top, pattern, bottom, pants,
 * hair, hairColor, hat, hatColor, glasses, acc) + age / gender / seed. Colour and garment words in the director's look
 * hint win; anything the hint leaves open is seeded (so it never changes between shots).
 */
export function lookOf(c, seed, era = "modern") {
  const R = rng(seed * 92821 + 13);
  const t = low(c.look);
  const age = ageOf(c), gender = genderOfPerson(c);
  const cols = colorsIn(c.look);
  const look = {};
  // the first colour word goes on the first garment named after it ("green hoodie"), else the top
  let topSet = false, bottomSet = false;
  for (const m of String(c.look ?? "").toLowerCase().matchAll(new RegExp(`\\b(${Object.keys(COLOR_HEX).join("|")})\\s+([a-z-]+)`, "g"))) {
    const hex = COLOR_HEX[m[1]], g = GARMENT.find(([re]) => re.test(m[2]))?.[1];
    if (/hair|bun|beard/.test(m[2])) { look.hairColor = HAIR_COLOR[m[1]] ?? hex; continue; }
    if (/cap|hat|beanie/.test(m[2])) { look.hat = /beanie/.test(m[2]) ? "beanie" : "cap"; look.hatColor = hex; continue; }
    if (g === "top" && !topSet) { look.top = hex; topSet = true; }
    else if ((g === "dress" || g === "skirt") && !topSet) { look.top = hex; look.bottom = g; topSet = true; bottomSet = true; }
    else if (g && !bottomSet) { look.pants = hex; look.bottom = g; bottomSet = true; }
  }
  if (!topSet) look.top = cols[0] && !/hair/.test(t) ? COLOR_HEX[cols[0]] : R.pick(TOPS);
  if (!look.bottom) { const g = GARMENT.slice(1).find(([re]) => re.test(t))?.[1]; look.bottom = g ?? (gender === "f" && R() < 0.5 ? "skirt" : age === "kid" && R() < 0.35 ? "shorts" : "pants"); }
  if (!look.pants) { look.pants = R.pick(PANTS); if (look.pants === look.top) look.pants = PANTS[(PANTS.indexOf(look.pants) + 1) % PANTS.length]; }
  if (look.bottom === "dress") look.pants = look.top;
  look.pattern = /\bstriped|stripes\b/.test(t) ? "stripes" : /\bplaid|checked\b/.test(t) ? "plaid" : /\bdots|spotted|polka\b/.test(t) ? "dots" : "cotton";
  look.hair = HAIR_WORDS.find(([re]) => re.test(t))?.[1] ?? (gender === "f" ? R.pick(age === "elder" ? ["bun", "long"] : ["long", "ponytail", "bun"]) : age === "elder" ? R.pick(["short", "bald"]) : R.pick(["short", "spiky", "short"]));
  look.hairColor ??= age === "elder" ? "#bfbfbf" : (Object.entries(HAIR_COLOR).find(([w]) => new RegExp(`\\b${w}\\b(?= (hair|bun|braid|curls))`).test(t))?.[1] ?? R.pick(HAIRS));
  // hat / glasses / accessories only when the hint names them: otherwise the people kit's own seeded choice (the seed is
  // the bible's, so it is the same in every shot)
  if (!look.hat) { const h = t.match(/\b(cap|beanie|bucket hat|chef hat|white cap|hat)\b/); if (h) { look.hat = /beanie/.test(h[1]) ? "beanie" : /bucket/.test(h[1]) ? "bucket" : "cap"; look.hatColor = COLOR_HEX[colorsIn(t.slice(0, t.indexOf(h[1])).split(" ").slice(-3).join(" ")).at(-1)] ?? "#f2f2f2"; } }
  if (/\b(glasses|spectacles)\b/.test(t)) look.glasses = true;
  const acc = [/\bbackpack\b/.test(t) ? "backpack" : null, /\b(bag|satchel|purse)\b/.test(t) ? "bag" : null, /\btie\b/.test(t) ? "tie" : null].filter(Boolean);
  if (acc.length) look.acc = acc;
  if (gender === "f") look.beard = null;
  const topFromWords = topSet || Boolean(cols[0] && !/hair/.test(t));
  dressLook(look, c, seed, era, age, gender, { top: topFromWords, bottom: bottomSet || Boolean(GARMENT.slice(1).find(([re]) => re.test(t))), hat: Boolean(look.hat), hair: Boolean(HAIR_WORDS.find(([re]) => re.test(t))), glasses: Boolean(look.glasses) });
  return { look, age, gender, words: String(c.look ?? "").slice(0, 120), topFromWords };
}

/**
 * CHARACTERS-V2 (owner: "each named character gets a distinct outfit from its role in the world bible"): the outfit
 * for the role / job / name words and the story's era (page/kit/outfitsData.js outfitFor), its garments, layers and
 * head piece over the seeded look; what the director's words named (a top colour, a skirt, a cap, hair, glasses) stays.
 */
export function dressLook(look, c, seed, era = "modern", age = "adult", gender = null, named = {}, variant = null) {
  const id = outfitFor({ job: c.job, name: c.name, id: c.id, look: c.look, role: c.role, age, gender }, era, seed);
  const ol = outfitLook(id, { seed, age, gender, variant });
  const keep = {};
  if (named.top) keep.top = look.top;
  if (named.bottom) { keep.bottom = look.bottom; keep.pants = look.pants; }
  if (named.hair || !ol.hair) keep.hair = look.hair;
  if (named.hat) { keep.hat = look.hat; keep.hatColor = look.hatColor; keep.ohead = null; }
  if (named.glasses) keep.glasses = look.glasses;
  Object.assign(look, ol, keep);
  if (look.bottom === "dress" && look.top !== "skin") look.pants = look.top;
  return look;
}

// ------------------------------------------------------------------------------------------------ the bible
/** the creature the town lives on / in (the first creature world of the production), else null */
function hostOf(production) {
  const worlds = production?.worlds ?? [];
  const cw = worlds.filter((w) => w.kind === "creature" && w.creature?.species);
  if (!cw.length) return null;
  const species = cw[0].creature.species;
  const rels = new Set(cw.filter((w) => w.creature.species === species).map((w) => (w.creature.relation === "none" ? "on" : w.creature.relation)));
  // the town is IN or ON it (one of them): inside wins when the production says so; outside is only the view of it
  const townView = rels.has("inside") ? "inside" : rels.has("on") ? "on" : null;
  const cr = (production.creatures ?? []).find((c) => c.species === species);
  const heightM = Math.max(...cw.map((w) => w.creature.heightM || 0), cr?.heightM || 0);
  return { species, townView, heightM, look: cr?.look ?? "", name: cr?.name ?? "" };
}

/** the creature world id the planner uses (lib/direction.js worldId) */
export const worldIdOf = (species, view, sea = false) => `${species}_${view}${sea && view !== "inside" ? "_sea" : ""}`.replace(/[^a-z0-9_]/g, "_");

/**
 * The WORLD BIBLE, built once per story before shot planning, from the director's production list (+ the script and
 * the idea card). Deterministic. Shape (CONTRACT.md addendum "the world bible"):
 *   { version, seed, title, kind: "creature" | "town",
 *     creature: { species, name, heightM, townView: "on" | "inside", colors: { skin, back, belly }, backWord, features[] } | null,
 *     town: { name, seed, style: { id, text, walls[], roofs[], trim }, palette[],
 *             streets: [{ id, name, from: [x,z], to: [x,z] }],
 *             buildings: [{ id, name, kind, street, pos: [x,z], wall, roof, floors, sign? }],
 *             landmarks: [{ id, name, pos: [x,z], kind }] },
 *     spots: [{ id, name, kind, view, set, anchor, onCreature: { view, shellEdge, headNeck, walkTilt } | null }],
 *     sets: [set],                         every set a shot may use (creature:<id> views of THIS creature, or the town's plain sets)
 *     cast: { id: { name, role, kind, look: {...}, age, gender, seed, words, from } },
 *     townsfolk: [{ id, look, age, gender, seed }],
 *     creatures: [{ id, species, name, heightM, colors, host }],
 *     props: { id: { name, size, look: { color, material }, heldBy, storyProp } },
 *     time: [{ from, to, light }] }
 * Positions are a town plan in [-1, 1] (x across the back, z along it; +z is the head).
 */
export function buildWorldBible({ production = null, script = null, idea = null, title = null } = {}) {
  const P = production ?? {};
  const name = title ?? script?.title ?? idea?.title ?? "story";
  const host = hostOf(P);
  // the town's seed: the planner's creature worlds all take it (applyBible), so the inside, on-back and outside views
  // build the same town
  // (each story its own town: species + title; applyBible gives every creature world this seed)
  const seed = (hashSeed(`${host ? host.species : "town"}:${name}`) % 89) + 3;
  const R = rng(seed * 7717 + 3);
  // the director's hints (production.bible, lib/director/spec.js) win; everything they leave open is seeded
  const H = P.bible ?? {};
  const hs = String(H.building_style ?? "").toLowerCase();
  const styleBase = STYLES.find((st) => hs && ({ cottage: /cottage|plaster|tile/, timber: /timber|half-timber|beam/, painted: /painted|colou?rful|wooden|clapboard/, stone: /stone|slate|brick/ })[st.id].test(hs)) ?? STYLES[seed % STYLES.length];
  const palette = (H.palette ?? []).flatMap((w) => colorsIn(w)).map((w) => COLOR_HEX[w]);
  const style = { ...styleBase, text: H.building_style || styleBase.text, walls: palette.length >= 2 ? palette.slice(0, 4) : styleBase.walls };
  const allText = low([...(script?.lines ?? []).map((l) => l.text ?? l), idea?.setting, idea?.premise].join(" "));

  // the creature
  let creature = null;
  if (host) {
    const base = CREATURE_LOOKS[host.species] ?? CREATURE_LOOKS.default;
    const cols = colorsIn(`${H.creature_look ?? ""} ${host.look}`);
    creature = { species: host.species, name: host.name || `the giant ${host.species}`, heightM: Math.max(120, Math.round(host.heightM || 0)), townView: host.townView ?? "on",
      colors: { skin: cols[0] ? COLOR_HEX[cols[0]] : base.skin, back: cols[1] ? COLOR_HEX[cols[1]] : base.back, belly: base.belly }, backWord: base.backWord, features: [...base.features] };
  }

  // the town: its named places (the production's landmarks / buildings, the cast's jobs, the places the script names)
  const townName = (() => {
    if (H.town_name) return cap1(H.town_name);
    const w = (P.worlds ?? []).find((x) => x.name && !/^(the )?town$/i.test(x.name) && !/\b(inside|outside|on|around|beside|near|under|giant)\b/i.test(x.name) && !(host && x.name.toLowerCase().includes(host.species)));
    if (w) return cap1(w.name.replace(/^the /i, ""));
    return host ? `${cap1(host.species)}${host.townView === "inside" ? "hollow" : "back"} Town` : `${cap1(String(name).split(/\s+/).find((x) => x.length > 3 && !/^(the|this|town|world)$/i.test(x)) ?? "Maple")} Town`;
  })();
  const placeKinds = new Map([["home", "my house"], ["square", "the town square"]]);
  for (const p of PLACES) if (p.words.test(allText)) placeKinds.set(p.kind, placeKinds.get(p.kind) ?? p.name);
  for (const c of P.cast ?? []) { const j = JOB_PLACE[String(c.job ?? "").toLowerCase()] ?? JOB_PLACE[String(c.id).replace(/^(mr|mrs|ms)_/, "")]; if (j && !placeKinds.has(`${j[0]}:${j[1]}`)) placeKinds.set(`${j[0]}:${j[1]}`, j[1]); }
  const HINT_KIND = { home: "home", house: "home", school: "school", market: "market", shop: "market", store: "market", hall: "hall" };
  for (const p of H.places ?? []) { const k = HINT_KIND[p.kind] ?? "landmark"; if (![...placeKinds.values()].includes(p.name)) placeKinds.set(k === "landmark" || placeKinds.has(k) ? `${k}:${p.name}` : k, p.name); }
  placeKinds.set("school", placeKinds.get("school") ?? "the school"); // every town has one (R2: a real town, a school)
  const named = [...placeKinds.entries()].map(([k, n]) => ({ kind: k.split(":")[0], name: n })).filter((p) => p.kind !== "square"); // the square is a landmark
  for (const p of P.props ?? []) if ((p.size === "landmark" || p.size === "big") && BUILDING_WORD.test(low(p.name))) named.push({ kind: "landmark", name: p.name, prop: p.id });
  // the plan: a main street along the back (z), a cross street, a lane; buildings on both sides, then plain houses
  const streets = [
    { id: "main_street", name: H.streets?.[0] || "Main Street", from: [0, -0.9], to: [0, 0.9] },
    { id: "cross_street", name: H.streets?.[1] || `${cap1(R.pick(["Shell", "Ridge", "Spine", "Mill", "Lantern", "Hill"]))} Street`, from: [-0.8, 0.1], to: [0.8, 0.1] },
    { id: "back_lane", name: H.streets?.[2] || `${cap1(R.pick(["Rim", "Moss", "Pebble", "Willow"]))} Lane`, from: [-0.6, -0.5], to: [0.6, -0.5] },
  ];
  const slots = [];
  for (let k = 0; k < 9; k++) { const z = -0.75 + k * 0.19; slots.push({ street: "main_street", pos: [-0.22, +z.toFixed(2)] }, { street: "main_street", pos: [0.22, +z.toFixed(2)] }); }
  for (const x of [-0.6, -0.4, 0.4, 0.6]) slots.push({ street: "cross_street", pos: [x, 0.28] }, { street: "cross_street", pos: [x, -0.08] }, { street: "back_lane", pos: [x, -0.65] });
  // the named places get the central slots, by a seeded shuffle of the first 10
  const R2 = rng(seed * 131 + 17);
  const order = slots.slice(0, 10).map((s) => [s, R2()]).sort((a, b) => a[1] - b[1]).map(([s]) => s).concat(slots.slice(10));
  const buildings = [];
  named.forEach((p, i) => {
    const sl = order[i]; if (!sl) return;
    buildings.push({ id: slug(p.name.replace(/^(the|my) /, "")), name: p.name, kind: p.kind, street: sl.street, pos: sl.pos, wall: style.walls[i % style.walls.length], roof: style.roofs[i % style.roofs.length], floors: p.kind === "school" || p.kind === "hall" ? 2 : 1 + (hashSeed(p.name) % 2), ...(p.kind === "school" ? { sign: "SCHOOL" } : {}), ...(p.prop ? { prop: p.prop } : {}) });
  });
  for (let i = named.length; i < Math.min(order.length, named.length + 12); i++) buildings.push({ id: `house_${i}`, name: "a house", kind: "house", street: order[i].street, pos: order[i].pos, wall: style.walls[(i * 3) % style.walls.length], roof: style.roofs[i % style.roofs.length], floors: 1 + (hashSeed(`${seed}:h${i}`) % 2) });
  const ids = new Set(); for (const b of buildings) { let id = b.id, k = 2; while (ids.has(id)) id = `${b.id}_${k++}`; b.id = id; ids.add(id); }
  const landmarks = [
    { id: "square", name: "the town square", kind: "square", pos: [0, 0.1] },
    ...(H.landmarks ?? []).map((n, i) => ({ id: slug(n.replace(/^the /i, "")), name: n, kind: "landmark", pos: [[-0.5, 0.6], [0.5, 0.6], [-0.5, -0.85], [0.5, -0.85], [0, 0.75], [0, -0.95]][i % 6] })),
    ...(creature ? [{ id: "lookout", name: `the lookout at the ${creature.backWord} edge`, kind: "deck", pos: [0.85, 0.35] }, { id: "stairs", name: `the stairs down the ${creature.backWord}`, kind: "stairs", pos: [-0.85, -0.2] }, { id: "head_end", name: `the ${creature.species}'s head`, kind: "head", pos: [0, 1.2] }] : [{ id: "woods_edge", name: "the edge of the woods", kind: "woods", pos: [0, -1] }]),
  ];
  const town = { name: townName, seed, style: { ...style, walls: [...style.walls], roofs: [...style.roofs] }, palette: [...new Set([...style.walls, ...style.roofs, style.trim])], streets, buildings, landmarks };

  // the spots: every place a shot can stand in, all in this one town
  const spots = [];
  const bld = (k) => buildings.find((b) => b.kind === k)?.id ?? null;
  if (creature && !host.townView) {
    // the creature is only seen from outside (a giant beside the town): the town is an ordinary one, the views of the
    // creature are its outside views
    creature.townView = null;
    spots.push(
      { id: "outside_wide", name: `the giant ${creature.species} beside ${town.name}`, kind: "outside", view: "outside", set: `creature:${worldIdOf(creature.species, "outside")}`, anchor: null, onCreature: null },
      { id: "outside_coast", name: `the giant ${creature.species} at the coast`, kind: "outside", view: "outside", set: `creature:${worldIdOf(creature.species, "outside", true)}`, anchor: null, onCreature: null },
    );
  }
  if (creature?.townView) {
    const tv = creature.townView;
    const tset = `creature:${worldIdOf(creature.species, tv)}`;
    const cue = (o) => ({ view: tv, shellEdge: true, headNeck: tv === "on", walkTilt: true, ...o });
    spots.push(
      { id: "outside_wide", name: `the ${creature.species} walking through the land, ${town.name} on its ${creature.backWord}`, kind: "outside", view: "outside", set: `creature:${worldIdOf(creature.species, "outside")}`, anchor: null, onCreature: null },
      { id: "outside_coast", name: `the ${creature.species} at the coast, ${town.name} on its ${creature.backWord}`, kind: "outside", view: "outside", set: `creature:${worldIdOf(creature.species, "outside", true)}`, anchor: null, onCreature: null },
      { id: "main_street", name: `Main Street, ${town.name}`, kind: "street", view: tv, set: tset, anchor: "main_street", onCreature: cue({}) },
      { id: "square", name: `the town square, ${town.name}`, kind: "square", view: tv, set: tset, anchor: "square", onCreature: cue({}) },
      { id: "deck", name: `the lookout at the ${creature.backWord} edge`, kind: "deck", view: tv, set: tset, anchor: "lookout", onCreature: cue({ headNeck: tv !== "inside" }) },
      { id: "stairs", name: `the stairs down the ${creature.backWord}`, kind: "stairs", view: tv, set: tset, anchor: "stairs", onCreature: cue({}) },
      { id: "rooftop", name: `the rooftops of ${town.name}`, kind: "rooftop", view: tv, set: tset, anchor: bld("home"), onCreature: cue({ headNeck: tv !== "inside" }) },
      { id: "school", name: `${town.buildings.find((b) => b.kind === "school")?.name ?? "the school"}, ${town.name}`, kind: "school", view: tv, set: tset, anchor: bld("school"), onCreature: cue({ headNeck: false }) },
      { id: "market", name: `${town.buildings.find((b) => b.kind === "market")?.name ?? "the market"}, ${town.name}`, kind: "market", view: tv, set: tset, anchor: bld("market"), onCreature: cue({}) },
      { id: "home", name: "inside my house", kind: "home", view: tv, set: tset, anchor: bld("home"), onCreature: cue({ shellEdge: false, headNeck: false }) },
    );
    if (tv === "on") spots.push({ id: "outside_on", name: `${town.name} seen on the ${creature.species}'s ${creature.backWord}`, kind: "outside", view: "on", set: `creature:${worldIdOf(creature.species, "on", true)}`, anchor: null, onCreature: cue({}) });
  }
  if (!creature?.townView) {
    spots.push(
      { id: "main_street", name: `Main Street, ${town.name}`, kind: "street", view: "town", set: "street", anchor: "main_street", onCreature: null },
      { id: "school", name: `the school, ${town.name}`, kind: "school", view: "town", set: "school", anchor: bld("school"), onCreature: null },
      { id: "home", name: "my room at home", kind: "home", view: "town", set: "bedroom", anchor: bld("home"), onCreature: null },
      { id: "woods", name: `the woods by ${town.name}`, kind: "woods", view: "town", set: "woods", anchor: "woods_edge", onCreature: null },
      // PLANNER-FIX 2026-11-07 (dog run: a bell festival shot in a school hallway): every town has its square (the
      // street set's "square" place: cobbles, stalls, lantern strings, a bell tower), and a town whose story names a
      // tower gets the top of it (the street set's "belfry" place: the great bell, the town below)
      { id: "square", name: `the town square, ${town.name}${/\bfestival\b/.test(allText) ? " (the festival)" : ""}`, kind: "square", view: "town", set: "street", place: "square", anchor: "square", onCreature: null },
      ...(/\b(tower|belfry|steeple|bell)\b/.test(allText) || named.some((p) => /tower|belfry|steeple/i.test(p.name)) ? [{ id: "tower", name: `the top of the bell tower, ${town.name}`, kind: "tower", view: "town", set: "street", place: "belfry", anchor: "square", onCreature: null }] : []),
      // SETS-V2 2026-11-09 (owner D: "a story moves through 3-6 different places, so no single room dominates"): the
      // town park (the street set's "park" place: lawn, trees, a fountain, benches, flower beds) and the home's second
      // room (the bedroom set's "kitchen" place: counters, stove, fridge, table, sofa); placeBalance spreads lines on them
      { id: "park", name: `the park in ${town.name}`, kind: "park", view: "town", set: "street", place: "park", anchor: "square", onCreature: null },
      { id: "lane", name: `a back lane in ${town.name}`, kind: "lane", view: "town", set: "street", place: "lane", anchor: "back_lane", onCreature: null },
      { id: "kitchen", name: "the kitchen at home", kind: "kitchen", view: "town", set: "bedroom", place: "kitchen", anchor: bld("home"), onCreature: null },
    );
  }
  const sets = [...new Set(spots.map((s) => s.set))];

  // the people: the director's cast, each with a fixed look; a pool of townsfolk for the crowd / filler shots
  const cast = {};
  // PLANNER-BUGS 2026-11-08 (#4: Biscuit the dog got a human outfit): an animal of the cast gets an animal look (species,
  // variant, colours, collar, size: the same as tl.pets, lib/pets.js), never a top / pants / hair
  const pets = petsOf({ cast: (P.cast ?? []).filter((c) => c.kind === "animal") }, script);
  // CHARACTERS-V2: the story's era (stone age, castle, pirate, wild west, space, modern) dresses every person in it
  const era = eraOf([P.summary, H.building_style, ...(P.worlds ?? []).flatMap((w) => [w?.name, w?.description]), ...(P.cast ?? []).flatMap((c) => [c.name, c.job, c.look]), idea?.setting, idea?.premise, allText].filter((x) => typeof x === "string").join(" "));
  for (const c of P.cast ?? []) {
    const s = hashSeed(`${seed}:cast:${c.id}`) % 1000;
    if (c.kind === "animal") {
      const p = pets[c.id];
      cast[c.id] = { name: c.name || "", role: "animal", kind: "animal", look: { animal: true, species: p?.species ?? (c.species || null), variant: p?.variant ?? null, kit: p?.kit ?? null, sizeM: p?.sizeM ?? null, ...(p?.params ?? {}) }, age: null, gender: null, seed: s, words: String(c.look ?? ""), from: "director" };
      continue;
    }
    const L = lookOf(c, s, era);
    cast[c.id] = { name: c.name || "", role: c.role === "narrator" ? "kid" : c.role || "adult", kind: c.kind || "human", look: L.look, age: L.age, gender: L.gender, seed: s, words: L.words, from: "director", ...(L.topFromWords ? { topFromWords: true } : {}) };
  }
  if (!cast.me) { const s = hashSeed(`${seed}:cast:me`) % 1000; const L = lookOf({ id: "me", role: "narrator", look: "" }, s, era); cast.me = { name: "", role: "kid", kind: "human", look: L.look, age: L.age, gender: L.gender, seed: s, words: "", from: "bible" }; }
  distinctLooks(cast); // CHARACTERS-V2: named people differ from the start (two bakers: two aprons)
  const townsfolk = [];
  for (let k = 0; k < 6; k++) { const s = hashSeed(`${seed}:town:${k}`) % 1000; const L = lookOf({ id: `town${k + 1}`, role: k === 4 ? "elder" : "adult", look: "" }, s, era); townsfolk.push({ id: `town${k + 1}`, look: L.look, age: L.age, gender: L.gender, seed: s }); }

  // the creatures (the host + any rival giants), the props with their looks
  const creatures = (P.creatures ?? []).filter((c) => c.scale === "giant" || c.scale === "colossal" || c.species === host?.species).map((c) => {
    const cols = colorsIn(c.look), base = CREATURE_LOOKS[c.species] ?? CREATURE_LOOKS.default;
    return { id: c.id, species: c.species, name: c.name || c.species, heightM: c.heightM || 0, colors: { skin: cols[0] ? COLOR_HEX[cols[0]] : base.skin, back: cols[1] ? COLOR_HEX[cols[1]] : base.back }, host: c.species === host?.species };
  });
  if (creature && !creatures.some((c) => c.host)) creatures.unshift({ id: slug(creature.species), species: creature.species, name: creature.name, heightM: creature.heightM, colors: { skin: creature.colors.skin, back: creature.colors.back }, host: true });
  const MATERIAL = /\b(wood|wooden|metal|iron|brass|stone|glass|rubber|paper|cloth|plastic|clay|gold|silver)\b/;
  const props = {};
  for (const p of P.props ?? []) {
    const t = low(p.name), cols = colorsIn(p.name);
    props[p.id] = { name: p.name, size: p.size, look: { color: cols[0] ? COLOR_HEX[cols[0]] : p.size === "landmark" ? null : TOPS[hashSeed(`${seed}:prop:${p.id}`) % TOPS.length], material: t.match(MATERIAL)?.[1] ?? (/hose|tube/.test(t) ? "rubber" : /pot|pan|kettle/.test(t) ? "metal" : /bread|loaf|cake|soup/.test(t) ? "food" : "painted") }, heldBy: p.heldBy || "", storyProp: !!p.storyProp };
  }

  // the clock: the director's light per line, corrected by the script's own time words (storyClock)
  const { lights, fixedLines } = storyClock(P.lines ?? [], script?.lines ?? []);
  const time = [];
  lights.forEach((light, line) => { const last = time.at(-1); if (last && last.light === light && last.to === line - 1) last.to = line; else time.push({ from: line, to: line, light }); });
  // the line's place in the town (town stories): the director's world for the line -> a spot kind
  const worldPlace = Object.fromEntries((P.worlds ?? []).map((w) => [w.id, worldPlaceKind(w)])); // SETS-V2: name first
  const linePlace = {};
  for (const l of P.lines ?? []) if (worldPlace[l.world]) linePlace[l.line] = worldPlace[l.world];

  // LOOK-LEFTOVERS 2026-11-08 (lead: "snow must switch on from the story"): the world's weather / season from the
  // director's list + the script (page/winter.js reads world.weather / world.season)
  const wx = weatherOf({ production: P, script, idea });
  // SETS-V2 2026-11-09 (owner D): every place a theme preset (palette, signature props, lighting rig, density) from its
  // kind + the story's era / style (castle, cave, desert, neon city, harbour) + the weather
  const eraStyle = storyStyle(allText, [H.building_style, H.town_name, ...(H.landmarks ?? []), ...(P.worlds ?? []).flatMap((w) => [w?.name, w?.description])].filter((x) => typeof x === "string").join(" "));
  const places = placesOf(spots, { style: eraStyle, weather: wx?.weather ?? null, onCreature: !!creature?.townView, townText: style.text });
  return { version: BIBLE_VERSION, seed, title: name, kind: creature ? "creature" : "town", creature, town, spots, sets, cast, townsfolk, creatures, props, time, lights, fixedLines, linePlace, style: eraStyle, places, outfitEra: era, ...(wx ?? {}) };
}

const WINTER_WORDS = /\b(snow\w*|winter\w*|frost\w*|frozen|freez\w*|blizzards?|icy|icicles?|sleet|christmas|yule|ice(?! ?cream))\b/gi;
const WINTER_STRONG = /^(snow|winter|blizzard|frost|icicle|frozen)/i;
/**
 * The story's weather, or null: { weather: "snow", season: "winter" } when the director's list (building style, places,
 * worlds, events, summary, palette) names snow / winter / frost / ice / a blizzard, or the script does (two such words, or
 * one strong one: snow, winter, blizzard, frost, frozen)   (pure, tested)
 */
export function weatherOf({ production = null, script = null, idea = null } = {}) {
  const P = production ?? {}, H = P.bible ?? {};
  const dirText = [P.summary, H.building_style, H.town_name, ...(H.palette ?? []), ...(H.landmarks ?? []), ...(H.places ?? []).map((p) => p?.name), ...(P.worlds ?? []).flatMap((w) => [w?.name, w?.description]), ...(P.events ?? []).map((e) => `${e?.kind ?? ""} ${e?.what ?? ""}`), idea?.setting].filter((x) => typeof x === "string").join(" ");
  const dirHits = dirText.match(WINTER_WORDS) ?? [];
  const lineHits = (script?.lines ?? []).map((l) => (typeof l === "string" ? l : l?.text ?? "")).join(" ").match(WINTER_WORDS) ?? [];
  const winter = dirHits.length > 0 || lineHits.length >= 2 || lineHits.some((w) => WINTER_STRONG.test(w));
  return winter ? { weather: "snow", season: "winter" } : null;
}

/** a director world / a line's words -> the town spot kind it is (null = no place named) */
export function placeKindOf(text) {
  const t = low(text);
  if (/\b(bell tower|belfry|steeple|clock tower|tower|spire)\b/.test(t)) return "tower";
  if (/\b(square|plaza|festival|fair|market|marketplace|fountain|parade)\b/.test(t)) return "square";
  if (/\b(school|class|classroom|hallway)\b/.test(t)) return "school";
  if (/\b(kitchen|living room|dinner table|breakfast table)\b/.test(t)) return "kitchen"; // SETS-V2: the home's second room
  if (/\b(bedroom|my room|attic)\b/.test(t)) return "home";
  if (/\b(woods|forest)\b/.test(t)) return "woods";
  if (/\b(park|playground|picnic|meadow)\b/.test(t)) return "park"; // SETS-V2: the town park (street set place "park")
  return null;
}
/**
 * SETS-V2 2026-11-09 (step-3 #4 / #5: "the belfry room took over"): a director world's place kind by its id + NAME first
 * ("Town square", "Chimewick square by day"); its description only when the name says nothing. The description of a
 * square that mentions "the bell tower" behind it made every square line a belfry line (92% of #5 in the belfry).
 */
export function worldPlaceKind(w) {
  const nm = `${String(w?.id ?? "").replace(/_/g, " ")} ${w?.name ?? ""}`;
  return placeKindOf(nm) ?? (/\b(house|home|cottage|apartment|flat)\b/.test(low(nm)) ? "home" : null) ?? placeKindOf(w?.description ?? "");
}
/** a line may stand on the top of the tower only when its own words are about the tower / the bell up there */
const TOWER_LINE = /\b(tower|belfry|steeple|spire|bells?|rang|ring|rings|ringing|rope|climb\w*|stairs?|top|up there|clapper)\b/;

/**
 * The story's clock (PLANNER-FIX 2026-11-07, turtle run: daylight for "every night" / "one night"): the director's
 * light per line, then the script's words win: "one night" / "that night" (outside the rule / tour) starts a night that
 * lasts until morning words or the closer; "every night" / "nightly" / "tonight" make that line night; "evening" /
 * "sunset" dusk; "at dawn" / "sunrise" dawn. -> { lights[line], fixedLines[] (the lines the words changed) }
 */
export function storyClock(dirLines = [], scriptLines = []) {
  const n = Math.max(scriptLines.length, ...dirLines.map((l) => l.line + 1), 0);
  const lights = Array.from({ length: n }, (_, i) => dirLines.find((l) => l.line === i)?.light ?? "day");
  const dir = [...lights];
  const text = (i) => low(scriptLines[i]?.text ?? scriptLines[i] ?? "");
  const part = (i) => String(scriptLines[i]?.part ?? "");
  let night = false;
  for (let i = 0; i < n; i++) {
    const t = text(i);
    if (night && (/\b(morning|dawn|sunrise|sun came up|sun rose|next day|sunup)\b/.test(t) || part(i) === "closer")) night = false;
    if (!/^(rule|tour)$/.test(part(i)) && /\b(one night|that night|until one night|at midnight|one dark night|late at night)\b/.test(t)) night = true;
    if (night || /\b(every night|every single night|each night|nightly|tonight|at night|midnight|one night)\b/.test(t)) lights[i] = "night";
    if (/\b(evening|sunset|dusk)\b/.test(t)) lights[i] = "dusk";
    if (!/^(rule|tour)$/.test(part(i)) && /\b(at dawn|by dawn|sunrise|sun came up|sun rose)\b/.test(t)) lights[i] = "warm"; // the closer's / the morning's warm light (the clock test: "at dawn" is warm)
  }
  return { lights, fixedLines: lights.map((l, i) => (l !== dir[i] ? i : -1)).filter((i) => i >= 0) };
}

/** every named cast member a look of its own: two people with the same top colour (Nell and Mrs. Pell) differ */
export function distinctLooks(cast) {
  const used = new Set();
  const sig = (l) => `${l.top}|${l.bottom}`;
  const rank = ([id, b]) => (id === "me" ? 0 : b.from === "director" ? 1 : b.from === "townsfolk" ? 3 : 2);
  const named = new Set();
  // CHARACTERS-V2: dressed people differ by outfit + its main colour first (two bakers: two apron colours / cuts)
  const osig = (l) => `${l.outfit}|${l.outfitVariant ?? ""}|${l.oc?.a}|${l.oc?.c}|${l.top}`;
  const usedO = new Set();
  for (const [id, b] of Object.entries(cast).sort((x, y) => rank(x) - rank(y))) {
    if (!b.look?.outfit || b.look.animal || b.from === "townsfolk") continue;
    for (let k = 1; usedO.has(osig(b.look)) && k < 12; k++) {
      const keepTop = b.topFromWords ? b.look.top : null;
      const ol = outfitLook(b.look.outfit, { seed: b.seed + k * 7919, age: b.age, gender: b.gender });
      Object.assign(b.look, { oc: ol.oc, parts: ol.parts, ohead: b.look.ohead === null && b.look.hat ? null : ol.ohead, outfitVariant: ol.outfitVariant, top: keepTop ?? ol.top, pants: ol.pants, bottom: ol.bottom, shoes: ol.shoes });
      if (b.look.bottom === "dress" && b.look.top !== "skin") b.look.pants = b.look.top;
    }
    usedO.add(osig(b.look));
    void id;
  }
  for (const [id, b] of Object.entries(cast).sort((x, y) => rank(x) - rank(y))) {
    if (!b.look || b.look.animal) continue;
    if (b.look.outfit && b.from !== "townsfolk" && OUTFITS[b.look.outfit] && !["kid_casual", "adult_casual"].includes(b.look.outfit)) { used.add(b.look.top); used.add(sig(b.look)); named.add(b.look.top); continue; } // a costume keeps its colours
    // townsfolk may share a colour with each other, never with a named person
    if (b.from === "townsfolk") { if (!named.has(b.look.top)) continue; }
    else if (!used.has(b.look.top) && !used.has(sig(b.look))) { used.add(b.look.top); used.add(sig(b.look)); named.add(b.look.top); continue; }
    // the top colour is the first thing a viewer tells people apart by: the later of two people with one top colour
    // (even when the director's words named it: Bo's yellow hoodie and Pea's yellow raincoat) gets a free colour
    void id;
    const free = TOPS.find((x) => !used.has(x)) ?? TOPS[hashSeed(id) % TOPS.length];
    b.look.top = free; if (b.look.bottom === "dress") b.look.pants = free;
    used.add(free); used.add(sig(b.look)); if (b.from !== "townsfolk") named.add(free);
  }
  return cast;
}

// ------------------------------------------------------------------------------------------------ shots -> spots
const STILL = /\b(stop|stops|stopped|still|stood still|sleep|sleeps|slept|asleep|rest|rested|froze|frozen|hid|hide|hides|wait|waited)\b/;
/** the bible spot a shot stands in: its set picks the view; its words (and the base set it replaced) the place */
export function spotFor(bible, shot) {
  if (!bible || !shot) return null;
  const set = String(shot.set ?? "");
  const own = bible.spots.filter((s) => s.set === set);
  if (!own.length) return null;
  if (own.length === 1) return own[0].id;
  const t = low(shot.text);
  const has = (k) => own.find((s) => s.kind === k)?.id;
  // the shot's own words first, then the base set the planner first read for it (worldBase), then the street
  const byWords = /\b(bed|bedroom|asleep|slept|kitchen|my room|attic|pillow|drawer)\b/.test(t) ? "home" : PLACES[1].words.test(t) ? "school"
    : /\b(roof|rooftop|rooftops|chimney)\b/.test(t) ? "rooftop" : /\b(stairs|steps|ladder|climb|climbed|climbing|down to)\b/.test(t) ? "stairs"
    : /\b(edge|rim|lookout|look out|looked out|below|horizon|far away|neck|head|over the side|peek|peeked)\b/.test(t) ? "deck"
    : PLACES[2].words.test(t) ? "market" : PLACES[3].words.test(t) ? "square" : null;
  const byBase = { bedroom: "home", school: "school", woods: "deck" }[shot.worldBase] ?? null;
  const crowd = (shot.crowds ?? []).length || (shot.actors ?? []).length >= 3 ? "square" : null;
  for (const k of [byWords, byBase, crowd, "street"]) if (k && has(k)) return has(k);
  return own[0].id;
}

/** the cast id of the bible a planner cast member is (same id, "mrs_pell" for "pell", the same name) */
function bibleIdFor(bible, id, spec) {
  if (bible.cast[id]) return id;
  const ids = Object.keys(bible.cast);
  const byEnd = ids.find((b) => b.endsWith(`_${id}`) || b.startsWith(`${id}_`));
  if (byEnd) return byEnd;
  const nm = low(spec?.name).trim();
  if (nm) { const byName = ids.find((b) => bible.cast[b].name && low(bible.cast[b].name).trim() === nm) ?? ids.find((b) => nm.split(" ").some((w) => w.length > 2 && b.split("_").includes(w))); if (byName) return byName; }
  return null;
}

/**
 * Binds the planned timeline to the bible (in place; safe to run again after a re-plan): tl.world = the bible; every
 * cast member gets its bible look + seed (a planner-only person, a townsfolk or family member, joins the bible with a
 * seeded look); every shot gets worldSpot (+ onCreature cues on a street-level creature shot: shellEdge, headNeck,
 * walkTilt, tiltDeg); every creature world gets the bible's town seed; objects that are bible props get propId.
 */
export function applyBible(tl, bible) {
  if (!tl || !bible) return { bound: 0, spots: {} };
  tl.world = bible;
  let bound = 0;
  let townK = 0;
  for (const [id, spec] of Object.entries(tl.cast ?? {})) {
    let bid = bibleIdFor(bible, id, spec);
    if (!bid) {
      // a townsfolk from the pool, else a new entry with its own seeded look (a family member the director missed)
      const pool = /^town\d$/.test(id) ? bible.townsfolk.find((t) => t.id === id) ?? bible.townsfolk[townK++ % bible.townsfolk.length] : null;
      const s = pool?.seed ?? hashSeed(`${bible.seed}:cast:${id}`) % 1000;
      const L = pool ? { look: pool.look, age: pool.age, gender: pool.gender, words: "" } : lookOf({ id, name: spec.name, role: spec.role, look: "" }, s, bible.outfitEra ?? "modern");
      bible.cast[id] = { name: spec.name ?? "", role: spec.role ?? "adult", kind: "human", look: clone(L.look), age: L.age, gender: L.gender, seed: s, words: L.words ?? "", from: pool ? "townsfolk" : "planner" };
      bid = id;
    }
    const b = bible.cast[bid];
    if (spec.baby || spec.role === "baby") { spec.bibleId = bid; spec.seed = b.seed; bound++; continue; } // a baby keeps the onesie kit look
    spec.bibleId = bid; spec.seed = b.seed; spec.look = clone(b.look);
    if (b.gender && !spec.gender) spec.gender = b.gender;
    if (!b.name && spec.name) b.name = spec.name;
    bound++;
  }
  // every named cast member a look of their own (Nell and Mrs. Pell shared one): then the shots take the bible looks
  distinctLooks(bible.cast);
  for (const spec of Object.values(tl.cast ?? {})) { const b = bible.cast[spec.bibleId]; if (b && !(spec.baby || spec.role === "baby")) spec.look = clone(b.look); }
  // the creature worlds: the same town (seed) in every view
  if (bible.creature) for (const w of Object.values(tl.worlds ?? {})) if (w?.creature === bible.creature.species) { w.seed = bible.town.seed; w.town = bible.town.name; }
  const count = {};
  const shots = tl.shots ?? [];
  const homed = homeShots(shots, bible);
  // TOWN PLACES (PLANNER-FIX 2026-11-07): in a town story every shot stands in the place its line is in: the line's own
  // place words first ("climbed the tower", "in class"), else the director's world for the line (festival square, bell
  // tower), never a school / bedroom the line does not name; the set + the street set's place follow the spot
  const townStory = !bible.creature?.townView;
  const spotOfKind = (k) => bible.spots.find((x) => x.kind === k);
  if (townStory) shots.forEach((s) => {
    if (/^world:/.test(s.set ?? "") || s.set === "woods") return;
    const own = placeKindOf(s.text ?? "");
    const named = own && spotOfKind(own) ? own : null;
    const fromDirector = (s.lines ?? [s.line]).map((li) => bible.linePlace?.[li]).find((k) => k && spotOfKind(k)) ?? null;
    // a plain set the line does not name (the "bell" in a line once made a school hallway)
    const unnamed = (s.set === "school" && !/\b(school|class|classroom|teacher|hallway|lockers?|desks?|recess|homework)\b/.test(low(s.text))) || (s.set === "bedroom" && !/\b(bed|bedroom|room|kitchen|at home|closet|pillow|blanket|crib|upstairs|bathroom|asleep|tucked)\b/.test(low(s.text)));
    // a school / room the line names wins; then the director's place for the line; then the line's own tower / square words
    const explicit = named === "school" || named === "home" || named === "kitchen" ? named : null;
    // SETS-V2 (step-3 #4 / #5): the director's tower world takes only the lines about the tower / its bell; the rest of
    // its lines stand in the square below it (the tower is in the square's picture)
    const fromDir = fromDirector === "tower" && named !== "tower" && !TOWER_LINE.test(low(s.text)) && spotOfKind("square") ? "square" : fromDirector;
    const kind = explicit ?? fromDir ?? named ?? (unnamed ? "street" : null);
    const sp = kind && (spotOfKind(kind) ?? (kind === "street" ? spotOfKind("street") : null));
    if (!sp) return;
    if (PLAIN_SETS.includes(s.set) && s.set !== sp.set) s.worldBase ??= s.set;
    s.set = sp.set; s.worldSpot = sp.id; s._townSpot = true;
    // the director's world for the line is this town place now (the square, the belfry): no builder world for it
    if (typeof s.world === "string" && fromDirector && kind === fromDirector) delete s.world;
    if (sp.place) s.place = sp.place; else delete s.place;
  });
  // THE CLOCK: a line the script's time words changed ("one night", "every night", "Evening, sir") takes the bible's light
  const fixedLines = new Set(bible.fixedLines ?? []);
  for (const s of shots) { const li = s.line; if (fixedLines.has(li) && bible.lights?.[li] && s.light !== bible.lights[li]) s.light = bible.lights[li]; }
  shots.forEach((s, i) => {
    if (s._townSpot) { delete s._townSpot; count[s.worldSpot] = (count[s.worldSpot] ?? 0) + 1; return; }
    let sp = spotFor(bible, s);
    if (!sp && s.camera === "insert") { const host = shots.slice(0, i).reverse().find((x) => x.worldSpot && x.set === s.set); sp = host?.worldSpot ?? null; }
    if (sp) { s.worldSpot = sp; count[sp] = (count[sp] ?? 0) + 1; } else delete s.worldSpot;
    // WORLD-FIX: the line's own place words pick the place in the town ("on the stairs", "in class") when the spot did not
    if (!s.place && /^creature:/.test(s.set ?? "") && s.camera !== "insert" && (s.actors ?? []).length) { const pl = placeFor(s.text ?? ""); if (pl !== "street") s.place = pl; }
    const spot = bible.spots.find((x) => x.id === sp);
    if (spot?.onCreature && s.camera !== "insert") {
      const still = STILL.test(low(s.text));
      s.onCreature = { ...spot.onCreature, walkTilt: spot.onCreature.walkTilt && !still, tiltDeg: still ? 0 : 1.5 + (hashSeed(`${bible.seed}:${i}`) % 3) * 0.75 };
    } else delete s.onCreature;
    for (const o of s.objects ?? []) { const pid = propIdFor(bible, o.name, o.aliases); if (pid) o.propId = pid; }
  });
  // SETS-V2: no single place holds more than ~40% of the story when its lines allow it; then every shot its place's
  // theme + rig (the page dresses the place and layers the rig; post grades toward the rig's target)
  const balanced = balancePlaces(tl, bible);
  themeShots(tl, bible);
  if (balanced) { for (const k of Object.keys(count)) delete count[k]; for (const s of shots) if (s.worldSpot) count[s.worldSpot] = (count[s.worldSpot] ?? 0) + 1; }
  return { bound, spots: count, homed, balanced };
}

// ------------------------------------------------------------------------------------------------ places + themes (SETS-V2)
/**
 * Every bible spot a PLACE with a theme preset (lib/setThemes.js): { id (= spot id), name, kind, set, place, theme,
 * density, palette, props, indoor }. Pure.
 */
export function placesOf(spots, { style = null, weather = null, onCreature = false, townText = "" } = {}) {
  return spots.map((sp) => {
    const kind = sp.kind === "kitchen" ? "home" : sp.kind;
    const theme = sp.kind === "kitchen" ? "home_interior" : themeFor(kind, { style, text: `${sp.name} ${townText}`, weather, onCreature: onCreature && sp.view !== "outside" });
    const th = THEMES[theme];
    return { id: sp.id, name: sp.name, kind: sp.kind, set: sp.set, place: sp.place ?? null, theme, density: th.density, indoor: th.indoor, palette: { walls: [...th.palette.walls], accents: [...th.palette.accents] }, props: [...th.props] };
  });
}

// what a line's words make it belong to (a line that names its own place never moves; one with a pull to another place
// of its pool moves there first)
const PULL = {
  square: /\b(everyone|everybody|crowds?|townsfolk|market|festival|mayor|announc\w*|gathered|whole town|stalls?|shops?|fair)\b/,
  park: /\b(played|playing|friends?|trees?|grass|bench|picnic|kites?|birds?|flowers?|ball)\b/,
  main_street: /\b(street|road|doors?|houses?|neighbou?rs?|corner|mailbox|cars?|sidewalk|porch)\b/,
  kitchen: /\b(kitchen|dinner|breakfast|lunch|table|cook\w*|ate|eat|eating|plates?|soup|cookies?|fridge|stove|oven)\b/,
  home: /\b(bed|beds|bedroom|sleep\w*|slept|asleep|pillow|blankets?|toys?|dream\w*|closet)\b/,
  deck: /\b(edge|view|below|horizon|sea|ocean|land|looked out|far away|rail)\b/,
  rooftop: /\b(roofs?|rooftops?|sky|stars|moon|chimney)\b/,
  lane: /\b(alley|lane|path|sneak\w*|snuck|hid|hiding|shortcut|fence|gate)\b/,
};
const POOLS = { town: [["main_street", "square", "park", "lane"], ["home", "kitchen"]], creature: [["main_street", "square", "deck", "rooftop"]] };
/**
 * PLACE BALANCE (owner D: "a story moves through 3-6 different places, so no single room dominates"; max ~40%): while a
 * place of a pool (interchangeable places on ONE set: the town's street / square / park; the home's bedroom / kitchen;
 * the creature town's street / yard / deck / rooftop) holds more than MAX_PLACE_SHARE of the video's time, its lines
 * that name no place (and have no pull to it) move to the pool's least used place, a line with a pull to another place
 * there first, neighbouring lines together. The opening two lines never move. -> how many lines moved. In place.
 */
export function balancePlaces(tl, bible, max = MAX_PLACE_SHARE) {
  const shots = tl.shots ?? [];
  const dur = (s) => Math.max(0, (s.end ?? 0) - (s.start ?? 0));
  const total = shots.reduce((a, s) => a + dur(s), 0);
  if (!total || !bible?.spots) return 0;
  const spotById = new Map(bible.spots.map((x) => [x.id, x]));
  const pools = (bible.creature?.townView ? POOLS.creature : POOLS.town).map((p) => p.filter((id) => spotById.has(id))).filter((p) => p.length > 1);
  const share = (id) => shots.reduce((a, s) => a + (s.worldSpot === id ? dur(s) : 0), 0) / total;
  const lineText = new Map();
  for (const s of shots) lineText.set(s.line, `${lineText.get(s.line) ?? ""} ${s.text ?? ""}`);
  let moved = 0;
  for (const pool of pools) {
    const set = spotById.get(pool[0]).set;
    if (!pool.every((id) => spotById.get(id).set === set)) continue;
    for (let guard = 0; guard < 6; guard++) {
      const B = [...pool].sort((a, b) => share(b) - share(a) || pool.indexOf(a) - pool.indexOf(b))[0];
      if (share(B) <= max) break;
      // its movable lines, in time order
      const lines = [...new Set(shots.filter((s) => s.worldSpot === B).map((s) => s.line))].filter((li) => {
        if (!(li >= 2)) return false;
        const t = low(lineText.get(li));
        if (placeKindOf(t) || (bible.creature?.townView && placeFor(t) !== "street")) return false;
        if (PULL[B]?.test(t)) return false;
        return shots.every((s) => s.line !== li || s.worldSpot !== B || (s.set === set && !/^world:/.test(s.set ?? "")));
      }).sort((a, b) => a - b);
      if (!lines.length) break;
      // order: lines pulled elsewhere first; then every other pair of lines (a block of two moves, a block stays)
      const pulled = lines.filter((li) => pool.some((id) => id !== B && PULL[id]?.test(low(lineText.get(li)))));
      const rest = lines.filter((li) => !pulled.includes(li));
      const order = [...pulled, ...rest.filter((_, k) => (k >> 1) % 2 === 1), ...rest.filter((_, k) => (k >> 1) % 2 === 0)];
      let prev = null, any = false;
      for (const li of order) {
        if (share(B) <= max) break;
        const t = low(lineText.get(li));
        const others = pool.filter((id) => id !== B);
        const pull = others.filter((id) => PULL[id]?.test(t));
        const byShare = (arr) => [...arr].sort((a, b) => share(a) - share(b) || pool.indexOf(a) - pool.indexOf(b));
        let to = pull.length ? byShare(pull)[0] : prev && prev.line === li - 1 && share(prev.to) < max ? prev.to : byShare(others)[0];
        if (share(to) >= max && !pull.length) to = byShare(others)[0];
        if (share(to) >= max) continue;
        const sp = spotById.get(to);
        for (const s of shots) {
          if (s.line !== li || s.worldSpot !== B) continue;
          s.worldSpot = to;
          if (sp.place) s.place = sp.place; else delete s.place;
          if (s.onCreature && sp.onCreature) s.onCreature = { ...sp.onCreature, walkTilt: s.onCreature.walkTilt, tiltDeg: s.onCreature.tiltDeg };
          s.placeMoved = B; // the planner's place before the balance (for the report / the judge)
        }
        if (!bible.creature?.townView && bible.linePlace) bible.linePlace[li] = sp.kind; // the bible's town has this place: no builder world for it
        prev = { line: li, to }; moved++; any = true;
      }
      if (!any) break;
    }
  }
  return moved;
}

const WORLD_KIND_WORDS = [["cave", /\b(caves?|cavern|tunnels?|mines?|underground)\b/], ["desert", /\b(desert|pyramids?|tomb|dunes?|egypt\w*|ruins?)\b/], ["city", /\b(neon|city|cyber\w*|futur\w*)\b/], ["harbour", /\b(harbou?r|docks?|pier|port|boats?)\b/], ["workshop", /\b(workshop|garage|forge|lab)\b/], ["bakery", /\b(bakery|bakehouse)\b/]];
/**
 * Every shot its place, theme and rig (in place): shot.placeId (the bible place = its spot, or the built world id),
 * shot.theme (lib/setThemes.js THEMES id, or none for a built world whose words fit no theme), shot.rig (RIGS id from
 * the theme, the shot's light and its line's words: an alarm line is red).
 */
export function themeShots(tl, bible) {
  const places = new Map((bible?.places ?? []).map((p) => [p.id, p]));
  for (const s of tl.shots ?? []) {
    let theme = null;
    if (/^world:/.test(s.set ?? "")) {
      s.placeId = s.set;
      const a = tl.assets?.[s.set.slice(6)], txt = low(`${s.set} ${a?.name ?? ""} ${a?.spec?.name ?? ""} ${typeof s.world === "string" ? s.world : ""}`);
      const k = WORLD_KIND_WORDS.find(([, re]) => re.test(txt))?.[0];
      theme = k ? themeFor(k, { style: bible?.style, text: txt }) : null;
      if (!theme && a?.spec?.enclosure?.type === "room") theme = "home_interior";
    } else {
      s.placeId = s.worldSpot ?? s.place ?? s.set;
      theme = places.get(s.worldSpot)?.theme ?? null;
    }
    if (theme) s.theme = theme; else delete s.theme;
    s.rig = rigFor({ theme, light: s.light, text: s.text });
  }
}

/** the bible set a foreign set is re-homed to: in a creature story the town's view (a plain or another creature's set;
 *  an outside-ish one to the outside view), in a town story the plain set of the same place (else the street) */
export function bibleSetFor(bible, set) {
  const sets = bible.sets ?? [];
  if (sets.includes(set)) return set;
  const town = bible.spots.find((s) => s.kind === "street")?.set ?? sets[0];
  if (/_outside(_sea)?$/.test(String(set))) return bible.spots.find((s) => s.set.endsWith(/_sea$/.test(set) ? "_outside_sea" : "_outside"))?.set ?? town;
  return town;
}
/**
 * The planner's last word on places: a shot whose set is not a bible set moves into the bible's world (worldBase keeps
 * the place word it covered; the world's aliases come from a shot already there, so the noun check still sees them).
 * A built world ("world:...") stays. -> how many shots moved
 */
export function homeShots(shots, bible) {
  let n = 0;
  const sets = new Set(bible.sets ?? []);
  shots.forEach((s) => {
    if (sets.has(s.set) || /^world:/.test(s.set ?? "")) return;
    const to = bibleSetFor(bible, s.set);
    if (!to || to === s.set) return;
    const host = shots.find((x) => x.set === to && x.worldAliases);
    if (PLAIN_SETS.includes(s.set)) s.worldBase ??= s.set;
    s.set = to; n++;
    if (host) s.worldAliases = [...new Set([...(s.worldAliases ?? []), ...host.worldAliases])];
  });
  return n;
}
function propIdFor(bible, name, aliases = []) {
  const words = [name, ...(aliases ?? [])].map((x) => low(String(x).replace(/_/g, " ")).trim()).filter(Boolean);
  for (const [id, p] of Object.entries(bible.props ?? {})) {
    const pn = low(p.name).trim(), last = pn.split(" ").at(-1);
    if (words.some((w) => w === pn || w === last || w === id.replace(/_/g, " ") || pn.endsWith(` ${w}`))) return id;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ the check
/**
 * The world continuity check (checkTimeline runs it whenever tl.world is set): [] when every shot lives in the bible's
 * world. Problems: a set that is not a bible set (another street / map / creature, a plain kit set in a creature story),
 * a worldSpot that is not a bible spot or not of the shot's set, an actor with no bible look (or a look / seed that
 * drifted from it), a creature world of another species or another town seed, an object tagged as a prop the bible
 * does not have. A built world ("world:<id>", the builder's place for a line) is allowed: it is that line's own place.
 */
export function worldBibleProblems(tl) {
  const B = tl?.world;
  if (!B || typeof B !== "object" || B.version !== BIBLE_VERSION) return B ? ["the world bible has an unknown version"] : [];
  const out = [];
  const sets = new Set(B.sets ?? []);
  const spots = new Map((B.spots ?? []).map((s) => [s.id, s]));
  (tl.shots ?? []).forEach((s, i) => {
    const at = `shot ${i}`;
    const built = /^world:/.test(s.set ?? "");
    if (!built && !sets.has(s.set)) out.push(`${at}: set ${s.set} is not in the world bible (${[...sets].join(", ")})`);
    if (s.worldSpot != null) {
      const sp = spots.get(s.worldSpot);
      if (!sp) out.push(`${at}: spot ${s.worldSpot} is not in the world bible`);
      else if (!built && sp.set !== s.set) out.push(`${at}: spot ${s.worldSpot} belongs to ${sp.set}, not ${s.set}`);
    }
    for (const a of s.actors ?? []) {
      const c = tl.cast?.[a.id];
      if (!c) continue; // checkTimeline reports a missing cast member itself
      const b = B.cast?.[c.bibleId];
      if (!b) { out.push(`${at}: ${a.id} has no look in the world bible`); continue; }
      if (c.seed !== b.seed || (c.look && JSON.stringify(c.look) !== JSON.stringify(b.look))) out.push(`${at}: ${a.id}'s look is not the world bible's`);
    }
    for (const o of s.objects ?? []) if (o.propId && !B.props?.[o.propId]) out.push(`${at}: prop ${o.propId} is not in the world bible`);
  });
  for (const [id, w] of Object.entries(tl.worlds ?? {})) {
    if (!B.creature) { out.push(`world ${id}: a creature world in a story whose bible has no creature`); continue; }
    if (w.creature !== B.creature.species) out.push(`world ${id}: a ${w.creature} world, but the bible's creature is the ${B.creature.species}`);
    else if (w.seed !== B.town.seed) out.push(`world ${id}: town seed ${w.seed} is not the bible's ${B.town.seed}`);
  }
  // an animal of the cast has an animal look, never a human outfit (PLANNER-BUGS 2026-11-08, #4 Biscuit)
  for (const [id, b] of Object.entries(B.cast ?? {})) if (b.kind === "animal" && (!b.look?.animal || b.look.top)) out.push(`cast ${id}: an animal with a human outfit in the world bible`);
  return out;
}

// ------------------------------------------------------------------------------------------------ for the vision judge
const lookText = (b) => b.look?.animal ? [b.look.species, b.look.variant, b.words].filter(Boolean).join(", ") : [b.age, b.look?.outfit ? outfitText(b.look) : "", b.gender === "f" ? "female" : b.gender === "m" ? "male" : "", b.words || `${b.look.bottom === "dress" ? "dress" : "top"} ${b.look.top}`, b.look.hair ? `${b.look.hair} hair` : ""].filter(Boolean).join(", ");
/** the bible in a few lines: the judge compares every frame with it */
export function bibleSummary(bible) {
  if (!bible) return "";
  const c = bible.creature, t = bible.town;
  const people = Object.entries(bible.cast).filter(([, b]) => b.from !== "townsfolk").slice(0, 8).map(([id, b]) => `${b.name || id}: ${lookText(b)}`);
  return [
    "THE WORLD BIBLE (every shot must be this one world):",
    c ? `- the creature: a giant ${c.species} (${c.features.slice(0, 4).join(", ")}), the town ${c.townView === "inside" ? "INSIDE it (under the shell / within its body)" : c.townView === "on" ? `ON its ${c.backWord}` : "beside it (an ordinary town)"}${c.townView ? "; outside shots always show this town on it" : ""}` : "- an ordinary town (no creature)",
    `- the town "${t.name}": ${t.style.text}; ${t.streets.map((s) => s.name).join(", ")}; places: ${t.buildings.filter((b) => b.kind !== "house").map((b) => b.name).join(", ")}`,
    c?.townView ? `- street-level shots still feel on the creature: the ${c.backWord} edge, the ${c.townView === "on" ? "head or neck in the background, " : ""}the ground tilting as it walks` : "",
    people.length ? `- the people: ${people.join("; ")}` : "",
  ].filter(Boolean).join("\n");
}
/** what one line's shots must look like in the bible's world (place + the people's looks) */
export function bibleLine(bible, shots = []) {
  if (!bible) return "";
  const sp = [...new Set(shots.map((s) => s.worldSpot).filter(Boolean))].map((id) => bible.spots.find((x) => x.id === id)?.name).filter(Boolean);
  return sp.length ? `world: ${sp.join(" / ")}` : "";
}

/** world-bible.json next to timeline.json (Node only; never throws: bookkeeping never fails a run) */
export async function saveWorldBible(dir, tl) {
  if (!tl?.world) return null;
  try {
    const [fs, path] = await Promise.all([import("node:fs"), import("node:path")]);
    const f = path.join(dir, "world-bible.json");
    fs.writeFileSync(f, JSON.stringify(tl.world, null, 1));
    return f;
  } catch { return null; }
}

// WORLD-FIX 2026-11-07 (moved from page/sets/backStreet.js, re-exported there): a line's place words -> the street-level
// place in the creature's town (deck, stairs, rooftop, school yard, room, classroom); applyBible sets shot.place with it
/** words in a line -> a place (the planner's hint; pure) */
export function placeFor(text = "") {
  const t = String(text).toLowerCase();
  if (/\bclass(room)?\b|\blesson|\bteacher|\bdesk/.test(t)) return "classroom";
  if (/\bschool\b/.test(t)) return "school";
  if (/\bstairs?\b|\bladder|\bclimb/.test(t)) return "stairs";
  if (/\broof(top)?s?\b|\bwalkway|\bbalcony|\boverlook/.test(t)) return "rooftop";
  if (/\bporch|\bdeck\b|\bveranda/.test(t)) return "deck";
  if (/\bbed(room)?\b|\bkitchen|\bhome\b|\binside (the|our|my) house|\broom\b|\basleep|\bwoke/.test(t)) return "room";
  return "street";
}
