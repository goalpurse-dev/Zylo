// Blocky Worlds director: the free MOCK director. A rule-based stand-in for the AI: script (or idea card) -> a plausible
// production list, so the matcher, the gap log and the stress run all work for $0. It reads words, not meaning: the
// real director (design.js) is the one that understands "the shell cracked open" means the turtle. The mock's job is to
// exercise every capability path with realistic requests, not to be right about every story.
//   mockProduction({ script, idea }) -> raw production list (validateProduction cleans it like an AI answer)
import { ANIMALS, CREATURE_OBJECTS, CREATURES, HELD } from "../catalog.js";
import { OBJECT_CATALOG, ABSTRACT, heldKind } from "../visuals.js";
import { titleMatchOk } from "../names.js";
import { phraseIndex, findPhrases, ACTION_WORDS, BEHAVIOUR_WORDS, CROWD_ACTION_WORDS, CROWD_NOUNS, NUMBER_WORDS, VEHICLE_WORDS, EFFECT_WORDS, EVENT_WORDS, SCALE_WORDS, TINY_WORDS, POSES_N } from "./vocab.js";

const IDX = {
  action: phraseIndex(ACTION_WORDS), behaviour: phraseIndex(BEHAVIOUR_WORDS), crowdAction: phraseIndex(CROWD_ACTION_WORDS),
  vehicle: phraseIndex(VEHICLE_WORDS), effect: phraseIndex(EFFECT_WORDS), event: phraseIndex(EVENT_WORDS),
};
// every creature word -> its species key (animals first, then small creatures, then monster look words)
const SPECIES = (() => {
  const m = new Map();
  for (const [k, al] of Object.entries(ANIMALS)) for (const a of [k, ...al]) if (!m.has(a) && !/^(animal|animals|pet|pets|critter|critters|livestock|bug|bugs)$/.test(a)) m.set(a, k);
  for (const [k, al] of Object.entries(CREATURE_OBJECTS)) for (const a of [k, ...al]) if (!m.has(a)) m.set(a, k);
  for (const [k, c] of Object.entries(CREATURES)) for (const a of c.words) if (!m.has(a) && /^[a-z]+$/.test(a) && !/^(dark|night|dim|fog|mist|wind|gale|echo|shade|shadow|hush|tree|log|clock|drum|mural|stomach|eraser|vacuum|fridge|refrigerator|mailbox)$/.test(a)) m.set(a, k);
  for (const extra of ["monster", "monsters", "beast", "beasts", "creature", "creatures", "zombie", "zombies", "vampire", "vampires", "werewolf", "werewolves", "mermaid", "mermaids", "kraken", "dinosaur", "dinosaurs", "t-rex", "lion", "lions", "tiger", "tigers", "elephant", "elephants", "shark", "sharks", "crab", "crabs", "giraffe", "giraffes", "monkey", "monkeys", "penguin", "penguins", "ant", "ants", "octopus"]) if (!m.has(extra)) m.set(extra, { werewolves: "werewolf", octopus: "octopus" }[extra] ?? extra.replace(/(?<=[a-z]{3})s$/, ""));
  return m;
})();
const PLURAL = (w) => /s$/.test(w) && !/(ss|us)$/.test(w);
const KNOWN_OBJECT_WORDS = (() => { const s = new Set(); for (const [k, o] of Object.entries(OBJECT_CATALOG)) { s.add(k.replace(/_/g, " ")); for (const a of o.aliases ?? []) s.add(a); } return s; })();
// hand-prop words -> builder (lib/catalog.js HELD + the first kit's BASE_HELD via heldKind); "water", "gold", "paint" are
// substances / places far more often than a held jar, so they are left to the noun pass
const HELD_WORDS = (() => { const m = new Map(); for (const [k, al] of Object.entries(HELD)) for (const a of al) m.set(a, k); for (const w of ["sock", "socks", "flashlight", "torch", "candle", "book", "phone", "bag", "key", "keys", "ball", "box", "bread", "loaf", "whistle", "camera", "notebook", "diary", "map", "umbrella", "lantern", "rope", "cup", "mug"]) { const k = heldKind(w); if (k && !m.has(w)) m.set(w, k); } for (const w of ["water", "gold", "paint", "light", "post", "stick", "list", "page", "pages", "can", "tin", "slice"]) m.delete(w); return m; })();
const PEOPLE = /^(kid|kids|boy|boys|girl|girls|man|men|woman|women|people|person|neighbor|neighbors|neighbour|neighbours|friend|friends|family|teacher|teachers|mayor|baker|farmer|mailman|postman|doctor|dentist|nurse|chef|cook|principal|coach|sheriff|officer|janitor|king|queen|prince|princess|knight|knights|soldier|soldiers|pirate|pirates|wizard|witch|grandma|grandpa|mom|dad|brother|sister|baby|babies|everyone|everybody|townsfolk|villagers|adults|grown-ups|parents|students|class|scientist|scientists|astronaut|astronauts|firefighter|firefighters|captain|lady|guy|guys)$/;
const JOBS = /\b(teacher|mayor|baker|farmer|mailman|postman|doctor|dentist|nurse|chef|cook|principal|coach|sheriff|officer|janitor|king|queen|knight|wizard|witch|pirate|scientist|astronaut|firefighter|captain|librarian|lunch lady|bus driver|zookeeper|lifeguard|mechanic|barber|plumber|judge)\b/;
const FAMILY = { mom: "Mom", mum: "Mom", mother: "Mom", dad: "Dad", father: "Dad", grandma: "Grandma", granny: "Grandma", nana: "Grandma", grandpa: "Grandpa", brother: "my brother", sister: "my sister", baby: "the baby" };
const TITLE_RE = /\b(Mr|Mrs|Ms|Miss|Dr|Coach|Aunt|Uncle|Officer|Principal|Sheriff|Mayor|Captain|Old|Grandma|Grandpa|Lady|Sir|King|Queen|Professor|Nurse|Chef)\.?\s+([A-Z][a-z]+)/g;
const STOP = new Set("the a an and or but so if then than that this these those to of in on at for from with by into onto over under up down out off is are was were be been being has have had do does did not no never i me my we our you your he him his she her it its they them their there here what who when where why how all every each some any one two three just only very too also again still even now then until because while about after before".split(" "));
// the clock moves on only when a line says it does ("at dawn", never "before dawn")
const DAWN = /\b(?<!before )(dawn|sunrise|sunup|daybreak|first light|sunset|dusk)\b/;
const DAY_BACK = /\b(in the morning|next morning|that morning|next day|the day after|sun came up|sun rose|by noon)\b/;
const NIGHT = /\b(night|nights|tonight|dark|midnight|moon|moonlight|asleep|bedtime|stars)\b/;
const ME = /\b(i|me|my|i'm|im|i've|i'd|myself|we|us|our)\b/;
const THEY = /\b(they|them|their|it|its)\b/;

const lc = (s) => ` ${String(s ?? "").toLowerCase().replace(/[“”"]/g, " ").replace(/\s+/g, " ")} `;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "x";
const toks = (low) => low.replace(/[^a-z' -]/g, " ").split(/\s+/).filter(Boolean);

/** the lines the director reads: the script, or the idea card's fields as stand-in lines (topic-only runs) */
export function linesOf({ script, idea }) {
  if (script?.lines?.length) return script.lines.map((l) => ({ part: l.part ?? "", text: String(l.text ?? "") }));
  const i = idea ?? {};
  return [["rule", i.opener], ["tour", i.premise], ["tour", i.price], ...(i.examples ?? []).map((e) => ["tour", e]), ["me", i.narrator], ["me", i.prop ? `I always keep ${i.prop} with me.` : ""], ["discovery", i.teaser], ["climax", i.twist], ["closer", i.closer]]
    .filter(([, t]) => t && String(t).trim()).map(([part, text]) => ({ part, text: String(text) }));
}

// ------------------------------------------------------------------------------------------------ worlds
const PLACE_SETS = [
  [/\b(school|classroom|hallway|cafeteria|gym|library|detention|recess)\b/, "indoor", "school", "the school"],
  [/\b(bedroom|kitchen|living room|attic|basement|house|home|apartment|bathroom|closet)\b/, "indoor", "bedroom", "home"],
  [/\b(woods|forest|farm|barn|field|camp|campsite|mountain|trail|meadow|swamp|jungle)\b/, "outdoor", "woods", "the woods"],
  [/\b(street|town|city|village|neighbou?rhood|square|downtown|park|road|suburb)\b/, "outdoor", "street", "the town"],
];
const EXOTIC = [
  [/\b(?:inside|in the belly of|in the stomach of|within) (?:of )?(?:a|an|the) ((?:[a-z]+ ){0,2}[a-z]+)/, "inside"],
  [/\b(?:on|upon) (?:the )?(?:back|shell|head|tail|belly) of (?:a|an|the) ((?:[a-z]+ ){0,2}[a-z]+)/, "on"],
  [/\b(?:city|town|village|school|house|houses|world|kingdom) (?:built )?on (?:a|an|the) ((?:[a-z]+ ){0,2}[a-z]+)/, "on"],
  [/\b(?:live|lives|living|built|sits|sit) on (?:a|an|the) ((?:[a-z]+ ){0,2}[a-z]+)/, "on"],
];
const SIZE_ADJ = /^(giant|huge|enormous|massive|sleeping|old|great|big|ancient|gigantic|colossal|sea|flying|friendly|grumpy)$/;
const MODIFIER = /^(tin|wooden|golden|gold|silver|glass|magic|paper|stone|metal|plastic|rubber|toy|robot|old|little|broken|rusty|lucky|secret|haunted|talking|flying|glowing|cursed|ice|chocolate|candy|lost)$/;
function exoticWorld(low) {
  for (const [re, rel] of EXOTIC) {
    const m = low.match(re);
    if (!m) continue;
    const ws = m[1].trim().split(" ");
    const species = ws.map((w) => SPECIES.get(w)).find((x) => x && x !== "giant");
    if (species) return { kind: "creature", name: `${rel === "inside" ? "inside" : "on"} a giant ${species}`, relation: rel, species };
    // "inside a giant refrigerator": the words up to the first one that is not a size word
    const k = ws.findIndex((w) => !SIZE_ADJ.test(w));
    const noun = ws[k] ?? ws.at(-1);
    if (rel === "inside" && !STOP.has(noun) && !/^(town|city|house|school|world|room|cave|night|dark|rule|dream)$/.test(noun) && !ABSTRACT.has(noun)) return { kind: "enclosed", name: `inside a ${ws.slice(0, k + 1).join(" ")}`, relation: "none", species: "" };
  }
  if (/\b(on the moon|on mars|in (?:outer )?space|space station|spaceship|on a planet|asteroid town)\b/.test(low)) return { kind: "space", name: (low.match(/on the moon|on mars|space station/) ?? ["space"])[0], relation: "none", species: "" };
  if (/\b(underwater|under the sea|under the ocean|bottom of the (?:sea|ocean|lake)|ocean floor|undersea|under the lake)\b/.test(low)) return { kind: "underwater", name: "under the sea", relation: "none", species: "" };
  if (/\b(in the clouds|on a cloud|sky city|floating island|above the clouds)\b/.test(low)) return { kind: "sky", name: "a town in the clouds", relation: "none", species: "" };
  if (/\b(underground|in a cave|cave town|in the caves|mine shaft|under the ground)\b/.test(low)) return { kind: "enclosed", name: "a cave town", relation: "none", species: "" };
  const place = low.match(/\b(volcano|beach|desert|island|glacier|north pole|candy land|junkyard|zoo|circus|museum|hospital|castle|pyramid|swamp|jungle|arctic|lighthouse|carnival|mall|airport|factory|dentist'?s? office|bakery|aquarium|graveyard|cemetery)\b/);
  if (place) return { kind: /hospital|museum|mall|factory|office|bakery|aquarium/.test(place[1]) ? "indoor" : "outdoor", name: place[1].replace(/'s?$/, ""), relation: "none", species: "" };
  return null;
}
function baseFor(low) { for (const [re, kind, base, name] of PLACE_SETS) if (re.test(low)) return { kind, base, name }; return null; }

// ------------------------------------------------------------------------------------------------ the mock
export function mockProduction({ script = null, idea = null } = {}) {
  const lines = linesOf({ script, idea });
  const card = idea ?? {};
  const head = lc([card.setting, card.opener, card.premise, lines[0]?.text].filter(Boolean).join(" . "));
  const lows = lines.map((l) => lc(l.text));
  const items = { worlds: [], cast: [], creatures: [], crowds: [], vehicles: [], props: [], effects: [], events: [] };
  const byKey = new Map();
  const add = (list, key, obj) => { if (byKey.has(key)) return byKey.get(key); let id = slug(obj.id ?? key), k = 2; while ([...byKey.values()].some((x) => x.id === id)) id = `${slug(key)}_${k++}`; const x = { ...obj, id }; items[list].push(x); byKey.set(key, x); return x; };

  // worlds: the main one from the setting / opener; a second one for lines in another of the 4 sets or "outside" a creature
  const ex = exoticWorld(head) ?? exoticWorld(lc(card.setting));
  const base0 = baseFor(lc(card.setting)) ?? baseFor(head) ?? { kind: "outdoor", base: "street", name: "the town" };
  const main = ex
    ? add("worlds", "w:main", { id: "world_main", name: ex.name, kind: ex.kind, base: ex.kind === "indoor" ? "bedroom" : base0.kind === "indoor" ? "street" : base0.base, description: ex.name, creature: { species: ex.species, relation: ex.relation, heightM: ex.kind === "creature" ? 120 : 0 }, light: "day" })
    : add("worlds", "w:main", { id: "world_main", name: base0.name, kind: base0.kind, base: base0.base, description: "", creature: { species: "", relation: "none", heightM: 0 }, light: "day" });
  if (ex?.kind === "creature") {
    // the creature the town is on / in is itself a character of the story, at true scale
    add("creatures", `cr:${ex.species}`, { id: ex.species, name: `the giant ${ex.species}`, species: ex.species, look: "", scale: "colossal", heightM: 120, count: 1, behaviours: [], monster: false });
  }
  const lineWorld = lows.map((low) => {
    if (ex?.kind === "creature" && /\b(outside|beyond|below us|down below|on the shore|the shore|the beach|the sea|the ocean|the water|the horizon|off the (?:shell|back|edge))\b/.test(low) && main.creature.relation !== "outside") {
      return add("worlds", "w:outside", { id: "world_outside", name: `outside the ${ex.species}`, kind: "creature", base: "street", description: `the land and sea around the giant ${ex.species}`, creature: { species: ex.species, relation: "outside", heightM: 120 }, light: "day" }).id;
    }
    const b = /\b(?:at|in|into|inside|to|through|across|from) (?:the |my |our |his |her )?(?:school|classroom|hallway|cafeteria|gym|bedroom|kitchen|attic|basement|woods|forest|farm|barn|field|street|town square|park)\b/.test(low) ? baseFor(low) : null;
    if (b && main.kind !== "creature" && main.kind !== "enclosed" && b.base !== main.base) return add("worlds", `w:${b.base}`, { id: `world_${b.base}`, name: b.name, kind: b.kind, base: b.base, description: "", creature: { species: "", relation: "none", heightM: 0 }, light: "day" }).id;
    return main.id;
  });

  // cast: the narrator, titled names, family, jobs (a "robot dentist" is a robot with a job)
  const narName = String(card.narrator ?? "").match(/^([A-Z][a-z]+)/)?.[1] ?? "";
  add("cast", "c:me", { id: "me", name: narName, kind: "human", role: "narrator", look: String(card.narrator ?? "").slice(0, 100), job: "" });
  const castIn = lines.map((l, i) => {
    const found = [];
    for (const m of l.text.matchAll(TITLE_RE)) if (titleMatchOk(m[1], m[0].slice(m[1].length, m[0].length - m[2].length), m[2])) found.push(add("cast", `c:${m[2].toLowerCase()}`, { id: m[2].toLowerCase(), name: `${m[1]} ${m[2]}`, kind: "human", role: /^(Old|Grandma|Grandpa)$/.test(m[1]) ? "elder" : "adult", look: "", job: /^(Mr|Mrs|Ms|Miss)$/.test(m[1]) ? "" : m[1].toLowerCase() }).id);
    for (const w of toks(lows[i])) if (FAMILY[w]) found.push(add("cast", `c:${w === "mum" || w === "mother" ? "mom" : w === "father" ? "dad" : w}`, { id: w === "mum" || w === "mother" ? "mom" : w === "father" ? "dad" : w, name: FAMILY[w], kind: "human", role: /grand/.test(w) || w === "nana" || w === "granny" ? "elder" : w === "baby" ? "baby" : /brother|sister/.test(w) ? "kid" : "adult", look: "", job: "" }).id);
    const rj = lows[i].match(/\b(robot|alien|ghost|zombie|skeleton|vampire)s? (teacher|mayor|baker|farmer|mailman|doctor|dentist|nurse|chef|principal|coach|sheriff|janitor|king|queen|librarian|lunch lady|bus driver|lifeguard|barber|judge)\b/);
    if (rj) found.push(add("cast", `c:${rj[1]}_${rj[2]}`, { id: `${rj[1]}_${rj[2]}`.replace(/ /g, "_"), name: `the ${rj[1]} ${rj[2]}`, kind: rj[1] === "robot" ? "robot" : "creature", role: "adult", look: rj[1], job: rj[2] }).id);
    else { const j = lows[i].match(JOBS); if (j && !found.length) found.push(add("cast", `c:${j[1]}`, { id: j[1].replace(/ /g, "_"), name: `the ${j[1]}`, kind: "human", role: /king|queen|knight|wizard|witch|pirate|captain/.test(j[1]) ? "adult" : "adult", look: "", job: j[1] }).id); }
    if (ME.test(lows[i])) found.unshift("me");
    return [...new Set(found)];
  });

  // the monster: a capitalised name in the opener whose last word is a creature ("the Detention Dragon")
  const monsterName = (String(card.opener ?? lines[0]?.text ?? "").match(/\bthe ((?:[A-Z][a-z]+ )*[A-Z][a-z]+)\b/g) ?? []).map((s) => s.slice(4)).find((n) => SPECIES.has(n.split(" ").at(-1).toLowerCase()));

  // creatures, crowds, vehicles, props, effects, events per line
  const needIn = lines.map(() => new Set());
  // the planted prop is one item (story_prop), never also a second "tin whistle" prop
  const storyHead = card.prop ? String(card.prop).toLowerCase().replace(/[.!]$/, "").split(" ").at(-1) : null;
  let lastPlural = null;
  lows.forEach((low, i) => {
    const t = toks(low);
    const needs = needIn[i];
    const behaviours = findPhrases(IDX.behaviour, low).map((h) => h.key);
    const crowdActs = findPhrases(IDX.crowdAction, low).map((h) => h.key);
    // creatures + crowds
    t.forEach((w, k) => {
      const sp = SPECIES.get(w);
      if (!sp) return;
      if (/^giants?$/.test(w) && t[k + 1] && !STOP.has(t[k + 1])) return; // "a giant turtle", "one giant eye": an adjective
      if (/^(rubber|toy|stuffed|paper|chocolate|plastic|wooden|glass|candy|teddy|robot)$/.test(t[k - 1] ?? "") && sp !== "robot") return; // "a rubber duck" is a prop
      const prev = t.slice(Math.max(0, k - 4), k);
      if (CROWD_NOUNS[t[k + 1]] > 0 && !PLURAL(w)) { // "the wolf army", "a robot swarm"
        const cr0 = add("creatures", `cr:${sp}`, { id: sp, name: sp, species: sp, look: "", scale: "human", heightM: 0, count: 1, behaviours: [], monster: false });
        const crowd = add("crowds", `cw:${sp}`, { id: `${sp}_crowd`, name: `${w} ${t[k + 1]}`, member: sp === "robot" ? "robot" : "creature", of: cr0.id, count: CROWD_NOUNS[t[k + 1]], actions: [] });
        crowd.actions = [...new Set([...crowd.actions, ...crowdActs])];
        needs.add(crowd.id); lastPlural = crowd.id;
        return;
      }
      const big = SCALE_WORDS.test(prev.join(" ")) || (ex?.kind === "creature" && ex.species === sp);
      const tiny = TINY_WORDS.test(prev.join(" "));
      const isMonster = monsterName && monsterName.toLowerCase().split(" ").at(-1) === w.replace(/s$/, "");
      const num = prev.map((x) => NUMBER_WORDS[x] ?? (Number.isFinite(Number(x)) ? Number(x) : null)).find((x) => x);
      const crowdWord = prev.find((x) => CROWD_NOUNS[x] > 0);
      if (PLURAL(w) && (crowdWord || (num ?? 0) > 3 || crowdActs.length)) {
        const cr = add("creatures", `cr:${sp}`, { id: sp, name: sp, species: sp, look: "", scale: big ? "giant" : "human", heightM: big ? 20 : 0, count: 1, behaviours: [], monster: false });
        const crowd = add("crowds", `cw:${sp}`, { id: `${sp}_crowd`, name: `${crowdWord ? `${crowdWord} of ` : ""}${w}`, member: "creature", of: cr.id, count: num ?? CROWD_NOUNS[crowdWord] ?? 40, actions: [] });
        crowd.actions = [...new Set([...crowd.actions, ...crowdActs])];
        needs.add(crowd.id); lastPlural = crowd.id;
        return;
      }
      const key = isMonster ? "cr:monster" : `cr:${sp}`;
      const cr = add("creatures", key, { id: isMonster ? slug(monsterName) : sp, name: isMonster ? monsterName : sp, species: sp, look: "", scale: big ? (ex?.species === sp ? "colossal" : "giant") : tiny ? "tiny" : "human", heightM: big ? (ex?.species === sp ? 120 : 25) : 0, count: PLURAL(w) ? Math.min(num ?? 3, 3) : 1, behaviours: [], monster: !!isMonster || (/\b(monster|beast|creature)\b/.test(w) && !big) });
      cr.behaviours = [...new Set([...cr.behaviours, ...behaviours])];
      needs.add(cr.id);
      if (PLURAL(w)) lastPlural = cr.id;
    });
    // people crowds
    for (const [word, n] of Object.entries(CROWD_NOUNS)) {
      if (!n || !low.includes(` ${word} `)) continue;
      const at = t.indexOf(word.split(" ")[0]);
      const of = t[at + 2];
      if ((of && SPECIES.has(of)) || SPECIES.has(t[at - 1] ?? "")) continue; // "an army of wolves", "the wolf army": done above
      const kind = /^(everyone|everybody|whole town|townspeople|villagers|crowd|crowds|mob|parade)$/.test(word) ? "townsfolk" : word;
      const soldiers = /\b(soldiers|knights|robots)\b/.exec(low)?.[1];
      const crowd = add("crowds", `cw:${soldiers ?? kind}`, { id: `${slug(soldiers ?? kind)}_crowd`, name: soldiers ?? kind, member: soldiers === "robots" ? "robot" : "person", of: "", count: n, actions: [] });
      crowd.actions = [...new Set([...crowd.actions, ...crowdActs])];
      needs.add(crowd.id);
      break;
    }
    if (THEY.test(low) && lastPlural && !needs.size && (behaviours.length || crowdActs.length)) { needs.add(lastPlural); const c = items.crowds.find((x) => x.id === lastPlural); if (c) c.actions = [...new Set([...c.actions, ...crowdActs])]; }
    // vehicles
    for (const h of findPhrases(IDX.vehicle, low)) {
      const motion = /\b(flew|flies|fly|flying|soared|took off)\b/.test(low) ? "fly" : /\b(launch|launched|blasted off)\b/.test(low) ? "launch" : /\b(sail|sailed|sails|floated)\b/.test(low) ? "sail" : /\b(crash|crashed|crashes)\b/.test(low) ? "crash" : /\b(drove|drives|drive|driving|rode|raced)\b/.test(low) ? "drive" : "parked";
      const v = add("vehicles", `v:${h.key}`, { id: h.key, name: h.word, kind: h.key, motion });
      if (motion !== "parked") v.motion = motion;
      needs.add(v.id);
    }
    // effects + events
    for (const h of findPhrases(IDX.effect, low)) {
      if (h.key === "grow" && !/\b(grew|grows|grow)\b.*\b(giant|huge|bigger|tall)/.test(low)) continue;
      if (h.key === "vanish" && h.word === "gone") continue;
      const into = h.key === "transformation" ? (low.split(h.word)[1] ?? "").replace(/^\s*(a|an|the)\s+/, "").split(/[ ,.!?]/).filter(Boolean)[0] ?? "" : "";
      const f = add("effects", `f:${h.key}:${into}`, { id: `${h.key}${into ? `_${into}` : ""}`, kind: h.key, target: "", into });
      needs.add(f.id);
    }
    for (const h of findPhrases(IDX.event, low)) {
      if (h.key === "falling" && !/\b(sky|moon|sun|stars?)\b/.test(low) && !/rain(s|ed)? down/.test(low)) continue;
      const what = h.key === "falling" ? (low.match(/\b(?:the )?(moon|sun|stars?|sky|[a-z]+s) (?:falls?|fell|rains? down|rained down|crash(?:es|ed) down)/)?.[0] ?? h.word).trim() : h.word;
      const e = add("events", `e:${h.key}`, { id: h.key, kind: h.key, what, scope: /\b(every|whole|all over|everywhere|the town|the world)\b/.test(low) ? "world" : "shot" });
      needs.add(e.id);
    }
    // props: the story prop, hand props, kit objects, and concrete nouns after a determiner the kit doesn't know
    const DET = /^(a|an|the|my|our|his|her|their|your|every|each|some|two|three|this|that|these|those)$/;
    const afterDet = (k) => DET.test(t[k - 1] ?? "") || (DET.test(t[k - 2] ?? "") && !STOP.has(t[k - 1] ?? "the"));
    const heldHits = t.filter((w, k) => HELD_WORDS.has(w) && afterDet(k) && w !== storyHead && w !== `${storyHead}s`);
    for (const w of heldHits.slice(0, 2)) needs.add(add("props", `p:${HELD_WORDS.get(w)}`, { id: HELD_WORDS.get(w), name: w, size: "hand", heldBy: "", storyProp: false }).id);
    for (const [k, w] of t.entries()) if (afterDet(k) && KNOWN_OBJECT_WORDS.has(w) && !HELD_WORDS.has(w) && !SPECIES.has(w) && !findPhrases(IDX.vehicle, ` ${w} `).length && !EVENT_WORDS_SET.has(w) && !/^(house|home|houses|window|windows|light|lights|game|team|field|shop|store)$/.test(w)) { needs.add(add("props", `p:${w.replace(/s$/, "")}`, { id: w.replace(/s$/, ""), name: w, size: "object", heldBy: "", storyProp: false }).id); break; }
    const det = low.match(/\b(?:a|an|the|my|our|his|her|their) ([a-z]{3,})(?: ([a-z]{3,}))?/g) ?? [];
    for (const d of det) {
      let ws = d.split(" ").slice(1);
      if (!MODIFIER.test(ws[0]) || !ws[1]) ws = ws.slice(0, 1);
      const noun = ws.at(-1);
      if (CROWD_NOUNS[noun] != null || CROWD_NOUNS[ws[0]] != null || noun === storyHead || noun === `${storyHead}s`) continue;
      if (ws.length > 1 && (HELD_WORDS.has(noun) || KNOWN_OBJECT_WORDS.has(noun) || SPECIES.has(noun))) continue;
      if (STOP.has(noun) || ABSTRACT.has(noun) || PEOPLE.test(noun) || SPECIES.has(noun) || KNOWN_OBJECT_WORDS.has(noun) || HELD_WORDS.has(noun) || /(ly|ing|ed)$/.test(noun) || POSES_N.includes(noun) || findPhrases(IDX.vehicle, ` ${noun} `).length || findPhrases(IDX.event, ` ${noun} `).length || findPhrases(IDX.effect, ` ${noun} `).length) continue;
      if (/^(town|city|world|school|street|woods|forest|night|day|rule|end|way|name|names|whole|only|same|first|last|next|other|own|kind|best|worst|new|old|real|big|little|giant|huge|shell|back|edge|top|bottom|middle|sky|ground|air|sun|land|sea|ocean|water)$/.test(noun)) continue;
      const name = ws.length > 1 && !/^(old|little)$/.test(ws[0]) ? ws.join(" ") : noun;
      needs.add(add("props", `p:${name}`, { id: name.replace(/ /g, "_"), name, size: "object", heldBy: "", storyProp: false }).id);
      break; // one unknown thing per line: the mock is a stand-in, not a parser
    }
    for (const c of castIn[i]) if (c !== "me") needs.add(c);
  });
  if (card.prop) {
    const name = String(card.prop).toLowerCase().replace(/^(a|an|the|my|our)\s+/, "").replace(/[.!]$/, "").slice(0, 50);
    const p = add("props", `p:story`, { id: "story_prop", name, size: "hand", heldBy: "me", storyProp: true });
    const head = name.split(" ").at(-1);
    lows.forEach((low, i) => { if (low.includes(` ${head} `) || low.includes(` ${head}s `) || low.includes(` ${head}.`)) needIn[i].add(p.id); });
  }

  // lines
  const isGiant = (id) => items.creatures.some((c) => c.id === id && ["giant", "colossal"].includes(c.scale));
  let clock = null; // the story clock (night carries forward)
  const outLines = lines.map((l, i) => {
    const low = lows[i];
    const needs = [...needIn[i]];
    const who = castIn[i];
    const crowdHere = needs.find((id) => items.crowds.some((c) => c.id === id));
    const creatureHere = needs.find((id) => items.creatures.some((c) => c.id === id));
    const subject = (/^ (i|i'm|my|we) /.test(low) ? "me" : null) ?? who.find((x) => x !== "me") ?? crowdHere ?? creatureHere ?? (who[0] ?? needs[0] ?? "me");
    const action = findPhrases(IDX.action, low)[0]?.key ?? "stand";
    const shake = /\b(stomp|stomped|stomps|explod|boom|blast|earthquake|quake|crash|crashed|erupt|shook|rumbl|slammed)/.test(low) || needs.some((id) => /^(explosion|earthquake|eruption)/.test(id));
    const fight = /\b(charge|charged|charges|attack|attacked|fight|fought|battle|chase|chased|stampede|swarmed|raided|invaded|stormed)\b/.test(low);
    const scale = needs.some(isGiant) || (lineWorld[i] !== main.id && /creature/.test(items.worlds.find((w) => w.id === lineWorld[i])?.kind ?? "")) || (i === 0 && main.kind === "creature");
    const camera = shake ? "shake" : fight ? "action" : scale ? "scale" : l.part === "discovery" && creatureHere ? "reveal" : "normal";
    // the story clock carries forward (turtle run 7b4c0d8b: "one night" ... the climax in daylight ... "at dawn"):
    // night lasts until a line says the day came back; dawn / sunset are warm
    let light;
    if (DAWN.test(low)) light = "warm";
    else if (DAY_BACK.test(low)) light = "day";
    else if (NIGHT.test(low) || (["until", "discovery"].includes(l.part) && card.mood === "horror")) light = "night";
    else light = clock ?? (l.part === "closer" && card.mood !== "horror" ? "warm" : "day");
    if (light === "night") clock = "night"; else if (DAWN.test(low) || DAY_BACK.test(low)) clock = light === "warm" ? "day" : null;
    return { line: i, world: lineWorld[i], subject, who, action, needs, camera, light };
  });
  // every crowd / creature with a charge or attack line keeps those as actions
  const scaleMoments = outLines.filter((l) => l.camera === "scale").map((l) => ({ line: l.line, big: l.needs.find(isGiant) ?? (ex?.kind === "creature" ? ex.species : l.world), small: l.subject === "me" || !l.subject ? "me" : l.subject }));
  return { summary: `(mock) ${card.title ?? script?.title ?? "a story"}: ${main.name}`, bible: mockBible({ lows, ex, items }), ...items, scaleMoments, lines: outLines };
}

/** the mock's world bible hints (lib/worldBible.js builds the full bible): the places the script names, the jobs' places */
function mockBible({ lows, ex, items }) {
  const all = lows.join(" ");
  const places = [];
  for (const [re, kind, name] of [[/\b(school|classroom|teacher)\b/, "school", "the school"], [/\b(bakery|baker|bread)\b/, "shop", "the bakery"], [/\b(market|shop|store|grocer)\b/, "market", "the market"], [/\b(town hall|mayor)\b/, "hall", "the town hall"], [/\b(home|house|bedroom|bed)\b/, "home", "my house"]]) if (re.test(all)) places.push({ name, kind });
  for (const c of items.cast) if (c.job && /baker|teacher|mayor|doctor/.test(c.job)) { const n = { baker: "the bakery", teacher: "the school", mayor: "the town hall", doctor: "the clinic" }[c.job.match(/baker|teacher|mayor|doctor/)[0]]; if (!places.some((p) => p.name === n)) places.push({ name: n, kind: "shop" }); }
  const landmarks = [...new Set((all.match(/\b(?:the )?(bell tower|clock tower|lighthouse|well|fountain|statue|bridge|mill|lookout)\b/g) ?? []).map((x) => x.replace(/^the /, "the ").trim()))].slice(0, 4);
  // the mock reads words, not meaning: no colours or names invented (the bible seeds them)
  return { creature_look: ex?.kind === "creature" ? (all.match(/\b(?:red|green|blue|grey|gray|brown|golden|black|white|mossy)\b[^.]{0,20}\b(?:shell|skin|back|scales)\b/)?.[0] ?? "") : "", town_name: "", building_style: "", palette: [], streets: [], places, landmarks };
}
const EVENT_WORDS_SET = new Set(Object.values(EVENT_WORDS).flatMap((v) => v.split(",").map((x) => x.trim())));
