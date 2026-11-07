// Blocky Worlds PETS (2026-11-07, owner: "Animals must also work at NORMAL size in stories: a pet dog that got lost, a
// cat on the roof, a pigeon, not only as giants"). Pure, Node + browser.
//
// A named animal of the director's cast (kind "animal": "my dog Biscuit", "our cat Pepper") is a PET: a character with a
// name and ONE fixed look (species + variant + colours + collar / bell + real-world size), kept in every shot of the
// story (the world-bible continuity rule, docs/blocky-worlds-protocol.md). On screen a pet is a rigged blocky animal of
// page/kit/animals as a scene object (`{ name: <kit object>, state, spot, pet: <id> }`), built from `tl.pets[id]`
// (page/engine.js -> objects.js makeObject(name, { state, pet }) -> things.js rigAnimal), at life size unless the
// script calls it giant / huge (then it is an EPIC giant: lib/epic.js, unchanged).
//
//   petsOf(production, script)  -> { id: Pet }   Pet = { id, name, species, variant, kit, sizeM, params, look, words,
//                                                        nouns, seed }
//   petStateFor(text, pet)      -> a catalog state (lib/catalog.js ANIMAL_STATES) for what the pet does in the text
//   petPass(tl, { lineKeys })   -> the final pass of planVideo: every shot of a pet line shows the pet (first object,
//                                  its state from the line), a pet-subject shot is about the pet (focus "object", a
//                                  low / medium camera at its height, no townsfolk miming its action)
//   petShows(s, id)             -> is the pet on screen and readable in this shot
//   petProblems(tl)             -> checkTimeline's pet rules ("pet: ...")
import { ANIMALS } from "./catalog.js";
import { resolveAnimal, ANIMAL_SPECIES, defaultVariant } from "../page/kit/animals/species.js";

const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const low = (s) => ` ${String(s ?? "").toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ")} `;

/** colour words -> the kit body colour (and belly / accent) */
const COLOURS = {
  brown: ["#6e4423", "#c9a27a", "#4a2c14"] /* darker than it looks: the fur texture + sun lift it (rendered 2026-11-07) */, chocolate: ["#5e3a1a", "#8a5a2b", "#3e2410"], golden: ["#d99a4e", "#f6e2c0", "#9a5a26"], gold: ["#d99a4e", "#f6e2c0", "#9a5a26"],
  black: ["#26262b", "#33333a", "#18181c"], white: ["#f7f5f2", "#ffffff", "#e2ddd6"], grey: ["#8c939c", "#d9dde2", "#5f6670"], gray: ["#8c939c", "#d9dde2", "#5f6670"],
  orange: ["#f08a2c", "#ffe7cc", "#b85a14"], ginger: ["#f08a2c", "#ffe7cc", "#b85a14"], red: ["#b5562a", "#f0c9a0", "#7a3410"], cream: ["#efe0c4", "#fff6e6", "#c9b48f"],
  tan: ["#c8a070", "#f0dcc0", "#8a6a40"], yellow: ["#e8c060", "#fff0c0", "#b08a30"], blue: ["#6a7fa8", "#c8d4e8", "#465a80"], green: ["#5a9a4a", "#c8e8b0", "#3a6a2a"],
};
const COLLARS = { red: "#e53935", blue: "#1e88e5", green: "#2e7d32", yellow: "#fbc02d", pink: "#ec6fa8", purple: "#8e44ad", black: "#26262b", orange: "#f57c00", gold: "#e8b830", white: "#f5f5f5" };
const SMALL = /\b(little|small|tiny|teeny|wee|puppy|puppies|kitten|kittens|pup|chick)\b/;
const BIG = /\b(big|large|huge|giant|enormous)\b/;

/** the catalog object (lib/catalog.js ANIMALS key) that draws a species */
export function kitFor(species, word = "") {
  if (ANIMALS[species]) return species;
  for (const w of [word, species]) for (const [k, al] of Object.entries(ANIMALS)) if (al.includes(String(w).toLowerCase())) return k;
  return null;
}

/** the species words a script uses for one pet species (dog: dog, dogs, puppy, pup, doggy...) */
function nounsOf(species, kit) {
  const s = ANIMAL_SPECIES[species];
  const base = new Set([species, ...(ANIMALS[kit] ?? [])]);
  for (const a of s?.aliases ?? []) if (/^[a-z]+$/.test(a)) base.add(a);
  for (const w of ["animal", "animals", "pet", "pets", "critter", "critters", "livestock", "bird", "birds", "bug", "bugs"]) if (species !== "pigeon" || !/^birds?$/.test(w)) base.delete(w);
  return [...base].filter((w) => !/s$/.test(w) || w.endsWith("ss")); // the singular words (a plural is "every dog", not the pet)
}

/** the look of a pet from its description words: { variant, params, sizeM } */
export function petLook(species, words, { bell = false } = {}) {
  const w = low(words);
  const r = resolveAnimal({ species }) ?? { species, variant: defaultVariant(species) };
  let variant = r.variant;
  // a breed / colour word that names a variant (beagle, dalmatian, husky, black lab, tabby, grey, tuxedo, calico, dove)
  for (const t of w.trim().split(" ").reverse()) {
    const v = resolveAnimal(t);
    if (v && v.species === species && v.variant && v.variant !== defaultVariant(species) && /[a-z]/.test(t) && t !== species) { variant = v.variant; break; }
    if (ANIMAL_SPECIES[species]?.variants?.[t] && t !== species) { variant = t; break; }
  }
  const params = {};
  // a colour word before the species noun ("a little brown dog") recolours the body when no variant word did
  const colour = Object.keys(COLOURS).find((c) => new RegExp(` ${c} (?!collar|paws?|socks?|feet|bell|ribbon|bow|scarf|tag)`).test(w));
  if (colour && variant === r.variant && !ANIMAL_SPECIES[species]?.variants?.[colour]) {
    const [body, belly, accent] = COLOURS[colour];
    params.c = { body, belly, accent };
  } else if (colour && ANIMAL_SPECIES[species]?.variants?.[colour]) variant = colour;
  const collar = w.match(/ ([a-z]+) collar /)?.[1];
  if (collar && COLLARS[collar]) params.c = { ...(params.c ?? {}), collar: COLLARS[collar] };
  else if (/ collar /.test(w) && !(ANIMAL_SPECIES[species]?.c?.collar)) params.c = { ...(params.c ?? {}), collar: COLLARS.red };
  const paws = w.match(/ ([a-z]+) (paws|socks|feet) /)?.[1];
  if (paws && COLOURS[paws]) params.pattern = { socks: COLOURS[paws][0] };
  if (bell || / bell /.test(w)) params.extra = { bell: true };
  const life = ANIMAL_SPECIES[species]?.variants?.[variant]?.life ?? ANIMAL_SPECIES[species]?.life ?? 0.6;
  const sizeM = Math.round(life * (SMALL.test(w) ? 0.8 : BIG.test(w) ? 1.25 : 1) * 100) / 100;
  return { variant, params, sizeM };
}

/**
 * The pets of a production list: every cast member of kind "animal" (a named animal character). The species comes from
 * the cast's `species`, else its look / name words; the look from its look words plus the script's sentence that
 * describes it ("Biscuit is a little brown dog with a red collar."); a bell when the script puts one on it.
 */
export function petsOf(production, script = null) {
  const out = {};
  const lines = (script?.lines ?? []).map((l) => String(l.text ?? l));
  for (const c of production?.cast ?? []) {
    if (c.kind !== "animal" || c.id === "me") continue;
    const r = resolveAnimal(c.species || "") ?? resolveAnimal(`${c.look} ${c.name}`) ?? resolveAnimal(c.id);
    if (!r) continue;
    const kit = kitFor(r.species, c.species);
    if (!kit) continue;
    const name = c.name || c.id;
    const nameLow = name.toLowerCase().replace(/^the\s+/, "");
    // the script's own description of the pet: a line with its name and its species noun ("Biscuit is a brown dog")
    const nouns = nounsOf(r.species, kit);
    const desc = lines.filter((t) => low(t).includes(` ${nameLow} `) && nouns.some((n) => low(t).includes(` ${n} `))).join(" ");
    const bell = lines.some((t) => (low(t).includes(` ${nameLow} `) || / (his|her|its) /.test(low(t))) && / bell /.test(low(t))) && /\bbell/.test(`${c.look} ${desc}`.toLowerCase() + lines.join(" ").toLowerCase());
    const look = petLook(r.species, `${c.look} ${desc}`, { bell });
    out[c.id] = { id: c.id, name, species: r.species, variant: look.variant, kit, sizeM: look.sizeM, params: look.params, look: String(c.look ?? "").slice(0, 120),
      words: [...new Set([c.id, ...nameLow.split(/\s+/)].filter((x) => x && x.length > 1))], nouns, seed: (hash(c.id) % 1000) + 1 };
  }
  return out;
}
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// ------------------------------------------------------------------------------------------------ what it does
// verbs -> the catalog state (lib/catalog.js ANIMAL_STATES; page/kit/animals animates each)
const VERBS = [
  [/\b(chased|chases|chasing|chase)\b/, "chase"], [/\b(fled|flees|fleeing|bolted|scampered)\b/, "flee"],
  [/\b(ran|runs|running|run|raced|races|racing|dashed|dashes|sprinted|zoomed|rushed)\b/, "run"],
  [/\b(flew|flies|flying|fly|flapped|soared|took off)\b/, "fly"], [/\b(swam|swims|swimming|swim|paddled)\b/, "swim"],
  [/\b(sniffed|sniffs|sniffing|sniff|smelled|smells|smelt|nosed|tracked)\b/, "sniff"],
  [/\b(barked|barks|barking|bark|woofed|woof|yapped|meowed|meows|meowing|meow|mewed|hissed|growled|cooed|squawked|chirped|tweeted)\b/, "bark"],
  [/\b(howled|howls|howling|howl)\b/, "howl"],
  [/\b(dug|digs|digging|dig|scratched|pawed)\b/, "dig"], [/\b(climbed|climbs|climbing|climb|clambered|scrambled up)\b/, "climb"],
  [/\b(hopped|hops|hopping|hop|jumped|jumps|jumping|jump|leapt|leaped|leaps|pounced|bounced)\b/, "hop"],
  [/\b(slept|sleeps|sleeping|sleep|asleep|napped|naps|napping|dozed|curled up)\b/, "sleep"],
  [/\b(ate|eats|eating|eat|chewed|chews|gobbled|licked|licks|drank|pecked|pecks)\b/, "eat"],
  [/\b(sat|sits|sitting|sit|waited|waits|waiting|purred|purrs|lay|lies|lying|stayed|perched|perches)\b/, "sit"],
  [/\b(walked|walks|walking|walk|trotted|trots|wandered|wanders|followed|follows|came|comes|went|goes|strolled|padded|tiptoed|landed|lands)\b/, "walk"],
  [/\b(carried|carries|carrying|fetched|fetches|brought)\b/, "carry"],
];
/** the state for what the pet does in a text (the first verb of the text that its plan can do), else "on" (idle) */
export function petStateFor(text, pet, states = null) {
  const t = String(text ?? "").toLowerCase();
  let best = null;
  for (const [re, st] of VERBS) { const m = re.exec(t); if (m && (!best || m.index < best.at)) best = { at: m.index, st }; }
  let st = best?.st ?? "on";
  const plan = ANIMAL_SPECIES[pet?.species]?.plan;
  if (st === "fly" && plan !== "bird") st = "hop";
  if (st === "sniff" && plan === "bird") st = "eat";
  if (states && !states.includes(st)) st = states.includes("walk") && ["hop", "carry"].includes(st) ? "walk" : "on";
  return st;
}

/** an animal object's state -> the person pose it shows for an action rule (lib/visuals.js covers) */
export const ANIMAL_POSE = Object.freeze({ walk: "walk", carry: "carry", run: "run", chase: "run", charge: "run", flee: "run", sit: "sit", sleep: "sleep", bark: "yell", howl: "yell", roar: "yell", hop: "jump", climb: "climb", fly: "fly", swim: "swim", eat: "eat", dig: "dig", sniff: "look" });

// ------------------------------------------------------------------------------------------------ on screen
const FAR = new Set(["establish", "aerial", "track", "behind_army"]);
/** the pet's object in a shot (or null) */
export const petObject = (s, id) => (s.objects ?? []).find((o) => o.pet === id) ?? null;
/**
 * The pet is on screen and readable: its object is in the shot and the camera frames it at a readable size. A pet is
 * ~0.3-1 m tall, so a person-height medium / closeup / over-the-shoulder (aimed at a head ~1.5 m up, a 9:16 frame only
 * ~0.6 m wide there) crops it or leaves it below the frame; it reads with a low camera (ground level) or a wide one
 * (page/engine.js fits the first object, and the people next to it, in a straight view at its height). Far EPIC
 * cameras make it a speck.
 */
export function petShows(s, id) {
  const o = petObject(s, id);
  if (!o || s.camera === "insert" || FAR.has(s.camera)) return false;
  return s.camera === "low" || s.camera === "wide";
}

/**
 * Puts the pet in a shot (or keeps it there) as the first object, at a free spot next to whoever is there. `about`: the
 * shot is about the pet (its subject): focus on it, a low / medium camera. Returns the object.
 */
export function ensurePet(s, pet, { state = null, about = false } = {}) {
  s.objects ??= [];
  let o = petObject(s, pet.id);
  if (!o) {
    // the same species already planned there without a name (the director's "dog" object): that one is the pet
    o = s.objects.find((x) => x.name === pet.kit && !x.pet) ?? null;
    if (o) o.pet = pet.id;
    else { o = { name: pet.kit, state: state ?? "on", spot: "center", facing: "camera", pet: pet.id }; s.objects.unshift(o); }
  }
  if (state) o.state = state;
  if (s.objects[0] !== o) { s.objects.splice(s.objects.indexOf(o), 1); s.objects.unshift(o); }
  // its spot: the middle when it is the point of the shot, else beside the people (never on top of someone)
  const taken = new Set((s.actors ?? []).map((a) => a.spot));
  if (taken.has(o.spot) || (!about && (s.actors ?? []).length && o.spot === "center")) o.spot = ["right", "left", "center", "back"].find((x) => !taken.has(x)) ?? "back";
  if (["walk", "run", "chase", "flee", "carry"].includes(o.state) && o.facing === "camera") o.facing = "right";
  return o;
}

/** the camera of a shot about a pet: ground level for motion, a medium at its height otherwise (variety kept) */
function petCamera(shots, i, moving) {
  // (a person-height medium / closeup aims ~1.3 m up and crops a 0.6 m dog in a 9:16 frame: rendered stills 2026-11-07)
  const prefs = moving ? ["low", "wide"] : ["wide", "low"];
  const c1 = shots[i - 1]?.camera, c2 = shots[i - 2]?.camera, n1 = shots[i + 1]?.camera, n2 = shots[i + 2]?.camera;
  const ok = (c) => !(c === c1 && c === c2) && !(c === c1 && c === n1) && !(c === n1 && c === n2);
  return prefs.find(ok) ?? prefs[0];
}

/**
 * The final pet pass (planVideo, after the director's passes): for every pet and every line that names it (a pet key),
 * or is about it (the line's subject), each real shot of the line shows it; a shot about the pet focuses it with a pet
 * camera and drops the townsfolk the planner put there to act the line out ("Biscuit was sitting" is the dog sitting,
 * not two neighbours); every pet object takes the pet's state from its own words. Mutates tl; returns { shots, added }.
 */
export function petPass(tl, { lineKeys = [], subjectOf = null } = {}) {
  const pets = tl.pets ?? {};
  const ids = Object.keys(pets);
  let touched = 0, added = 0;
  const shots = tl.shots;
  const textOf = (s) => String(s.text ?? "");
  touched += animalSubjects(shots);
  if (!ids.length) return { shots: touched, added: 0 };
  shots.forEach((s, i) => {
    if (s.camera === "insert" || s.insert) return;
    for (const id of ids) {
      const pet = pets[id];
      const lines = s.lines ?? [s.line];
      const named = lines.some((li) => (lineKeys[li] ?? []).some((k) => k.kind === "pet" && k.id === id && !k.neg));
      const about = s.subject === `thing:${id}` || (subjectOf && subjectOf(s) === id);
      const already = !!petObject(s, id) || (s.objects ?? []).some((o) => o.name === pet.kit && !o.pet && lines.some((li) => (lineKeys[li] ?? []).some((k) => k.kind === "pet" && k.id === id)));
      if (!named && !about && !already) continue;
      const had = !!petObject(s, id);
      const state = petStateFor(textOf(s), pet);
      if (about) {
        // the planner's stand-ins doing the pet's action go (the narrator / named people the line names stay)
        const keep = new Set(lines.flatMap((li) => (lineKeys[li] ?? []).filter((k) => k.kind === "person").map((k) => k.id)));
        const before = (s.actors ?? []).length;
        s.actors = (s.actors ?? []).filter((a) => !/^town\d$/.test(a.id) || keep.has(a.id));
        if (s.actors.length !== before) touched++;
        for (const m of [s.marker, ...(s.markers ?? [])]) if (m && m.on && !s.actors.some((a) => a.id === m.on) && m.on !== "all") m.on = s.actors[0]?.id ?? "all";
      }
      ensurePet(s, pet, { state, about });
      if (!had) added++;
      // a person miming the pet's action ("Pepper jumped into my arms": the kid stands, the cat hops)
      if (about) for (const a of s.actors ?? []) if (ANIMAL_POSE[state] && a.pose === ANIMAL_POSE[state]) a.pose = "stand";
      if (about) {
        s.focus = "object";
        if (!["low", "wide"].includes(s.camera)) s.camera = petCamera(shots, i, ["walk", "run", "chase", "flee", "fly", "hop"].includes(state));
      } else if (!petShows(s, id)) {
        // a person's shot that shows the pet beside them: ground level, else wide (the engine frames both)
        s.camera = shots[i - 1]?.camera === "low" && shots[i + 1]?.camera === "low" ? "wide" : "low";
        if (!s.actors?.length) s.focus = "object";
      }
      touched++;
    }
  });
  return { shots: touched, added };
}

/**
 * A normal-size animal that is the subject of a shot without being a pet ("A pigeon landed next to her", "The pigeon
 * hopped along the edge"): its object does the shot's own verb, the shot is about it (focus, a camera at its height),
 * and the townsfolk the planner put there to act the verb out go. Returns how many shots changed.
 */
function animalSubjects(shots) {
  let n = 0;
  shots.forEach((s, i) => {
    if (s.camera === "insert" || s.insert) return;
    const sid = String(s.subject ?? "");
    if (!sid.startsWith("thing:")) return;
    const kit = kitFor(sid.slice(6), sid.slice(6));
    const o = kit ? (s.objects ?? []).find((x) => x.name === kit && !x.pet) : null;
    if (!o) return;
    const r = resolveAnimal(sid.slice(6));
    const st = petStateFor(s.text, { species: r?.species ?? kit });
    if (st !== "on") o.state = st;
    s.objects.splice(s.objects.indexOf(o), 1); s.objects.unshift(o);
    s.actors = (s.actors ?? []).filter((a) => !(/^town\d$/.test(a.id) && (a.pose === "stand" || a.pose === ANIMAL_POSE[o.state])));
    s.focus = "object";
    if (!["low", "wide"].includes(s.camera)) s.camera = petCamera(shots, i, ["walk", "run", "chase", "flee", "fly", "hop"].includes(o.state));
    n++;
  });
  return n;
}

/** checkTimeline's pet rules: ["pet: ..."] */
export function petProblems(tl) {
  const out = [];
  const pets = tl?.pets ?? {};
  for (const [id, p] of Object.entries(pets)) {
    if (!ANIMAL_SPECIES[p.species]) out.push(`pet: ${id} has an unknown species "${p.species}"`);
    if (!ANIMALS[p.kit]) out.push(`pet: ${id} has no kit object "${p.kit}"`);
    if (!(p.sizeM > 0.1 && p.sizeM < 4)) out.push(`pet: ${id} is not at a real-world size (${p.sizeM} m)`);
  }
  (tl?.shots ?? []).forEach((s, i) => {
    for (const o of s.objects ?? []) {
      if (!o.pet) continue;
      const p = pets[o.pet];
      if (!p) { out.push(`pet: shot ${i} has pet "${o.pet}" that is not in tl.pets`); continue; }
      if (o.name !== p.kit) out.push(`pet: shot ${i} draws ${o.pet} as a ${o.name}, not its ${p.kit}`);
    }
    if (s.camera === "insert" || s.insert) return;
    const sid = String(s.subject ?? "");
    if (sid.startsWith("thing:") && pets[sid.slice(6)] && !s.subjectAbsent) {
      const id = sid.slice(6);
      if (!petShows(s, id)) out.push(`pet: shot ${i} is about ${pets[id].name} but it is not on screen at a readable size`);
      else if (s.focus !== "object" || s.objects[0]?.pet !== id) out.push(`pet: shot ${i} is about ${pets[id].name} but the focus is ${s.focus}`);
    }
  });
  return out;
}
