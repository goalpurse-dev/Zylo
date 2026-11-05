// Blocky Worlds: the story director's production list as the planner's source of truth (owner: INTEGRATION,
// 2026-11-05). Pure (no I/O): Node + tests. plan.mjs calls it when planVideo gets a `direction`
// (lib/director directStory's result: { production, match, provider, fellBack }).
//
//   readDirection(direction, { script, idea, mood, exists }) -> D
//       the production list refined by general rules (below), matched again onto the capability registry
//       (lib/director/match.js), and read per line: worlds, giants, crowds, cast, scenery, verbs, camera hints, light
//   directShots(tl, D, aux)          the overlay on the base plan: worlds per line (creature worlds inside / on / outside,
//                                    the sea once the creature swims), EPIC giants + crowds + beats + cameras, the
//                                    director's light; the stand-ins they replace (a small kit wolf, filler townsfolk,
//                                    a picture card of the army) give way; aliases so checkVisuals sees them
//   compactProduction(D)             what the timeline keeps (tl.production) so the pre-render check needs no match
//   checkProduction(tl, prod?)       STRICT: every line's required items on screen in one of its shots
//                                    -> [{ line, text, missing: [{ id, kind, name, route }] }]
//   fixProduction(tl, D, aux)        re-plans every miss: the item into the line's shot (kit / EPIC / built), else a
//                                    picture card of that very thing (never a failed run)
//
// Refinements (general rules, no special case per story; each one is listed in D.notes):
//   - an adjective / material word the director took for a thing ("massive", "brass", "long") is not a thing
//   - scenery words (streets, hill, shore, sea, ribs, shell...) on a creature-world line are the world's own scenery
//   - a creature called big ("the Big Bad Wolf", "a huge bear") or taller / bigger than a giant is a giant
//   - two crowds of the same soldiers ("soldiers" + "army") are one army; an army that first appears next to a giant
//     is that giant's (wolf -> wolf soldiers)
//   - a crowd word on a line with no crowd ("The knights lined up", "Hundreds of them") gets its crowd
//   - mock only (it reads words, not meaning): a line led by a pronoun ("He was taller...", "It swam.") is about the
//     previous line's subject
import { matchProduction } from "./director/match.js";
import { GIANT_KINDS, CROWD_KINDS, EPIC_CAMERAS, BEATS } from "./epic.js";
import { hashSeed } from "./rng.js";

const clone = (o) => JSON.parse(JSON.stringify(o));
const lc = (s) => ` ${String(s ?? "").toLowerCase().replace(/[“”"’]/g, (c) => (c === "’" ? "'" : " ")).replace(/\s+/g, " ")} `;
const toks = (s) => String(s ?? "").toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(Boolean);
const sing = (w) => (/(ss|us)$/.test(w) ? w : w.replace(/ies$/, "y").replace(/(?<=[a-z]{2})s$/, ""));
const r3 = (x) => Math.round(x * 1000) / 1000;
export const isCreatureSet = (s) => /^creature:/.test(s?.set ?? "");

// ------------------------------------------------------------------------------------------------ word tables
const ADJECTIVES = new Set(("massive huge giant big large small tiny little long short tall old new black white red blue green yellow brown " +
  "grey gray golden gold silver brass wooden iron stone dark bright whole entire enormous ancient great strange scary quiet loud empty " +
  "deep high low far near first last only same other every best worst gigantic colossal mighty secret magic shiny rusty broken lucky " +
  "sleepy angry happy sad furry hairy slimy sticky soft hard cold hot warm wet dry heavy light thin fat round square").split(" "));
const ADJ_SUFFIX = /(ive|ous|ful|less|ish|ible|able)$/;
// scenery: what a creature world's views already show (page/sets/creatureWorld.js)
export const SCENERY = Object.freeze({
  town: ["street", "streets", "road", "roads", "town", "house", "houses", "alley", "alleys", "corner", "square", "market", "lantern", "lanterns", "rooftop", "rooftops", "middle", "city", "village", "home", "homes"],
  land: ["hill", "hills", "field", "fields", "land", "valley", "mountain", "mountains", "horizon", "forest", "trees", "tree", "meadow", "plain", "plains", "ground", "outside", "world"],
  water: ["sea", "ocean", "water", "waves", "wave", "shore", "beach", "coast", "bay", "lake", "seas", "oceans"],
  body: ["shell", "ribs", "rib", "back", "belly", "skin", "scales", "edge", "top", "insides", "heartbeat", "heart"],
});
const SCENERY_OF = (() => { const m = new Map(); for (const [k, ws] of Object.entries(SCENERY)) for (const w of ws) if (!m.has(w)) m.set(w, k); return m; })();
// the creature's own words per species (on screen whenever its world or the giant is)
const BODY_WORDS = { turtle: ["shell", "back", "flippers", "head"], tortoise: ["shell", "back"], snail: ["shell", "back"], crab: ["shell", "claws", "back"], whale: ["back", "tail", "fin", "belly", "mouth"], elephant: ["back", "trunk", "ears", "tusks"], frog: ["back", "belly"], default: ["back", "belly"] };
const BIG_WORDS = /^(big|giant|huge|massive|enormous|colossal|towering|gigantic|mighty|great|titanic|monstrous)$/;
const COMPARE = /\b(taller|bigger|larger|higher|huger|as big as|as tall as|bigger even)\b(?: than)?/;
const PRONOUN_LEAD = /^\s*(?:and |then |but |so )?(he|she|it|they)\b/i;
// crowds by word (EPIC crowd kinds; anything else is asked for by name and logged as a gap by the matcher)
const CROWD_WORD = { knights: "knight", knight: "knight", soldiers: "soldier", soldier: "soldier", army: "soldier", armies: "soldier", troops: "soldier", guards: "soldier", warriors: "soldier", villagers: "townsfolk", townsfolk: "townsfolk", townspeople: "townsfolk", crowd: "townsfolk", everyone: "townsfolk", everybody: "townsfolk" };
const SOLDIERY = /\b(army|armies|soldiers?|troops?|guards?|warriors?|legion|regiment)\b/;

// verbs -> what a giant / a crowd does (first match per mention wins; "stopped walking" is idle)
// 2026-11-05 (GAPS): sleep, reveal, reach, lurk, carry, eat, fly, climb, flee, howl, dig are giant actions now
const GIANT_VERBS = [
  [/^(slept|sleeps|sleep|sleeping|asleep|snored|snores|snoring|dozed|dozes|napped|naps|nap)$/, "sleep"],
  [/^(woke|wakes|wake|awoke|awakes|rose|rises|appeared|appears|emerged|emerges|revealed|surfaced|surfaces|loomed|looms)$/, "reveal"],
  [/^(stopped|stops|stop|halted|froze|stood|stands|rested|sat|did)$/, "idle"],
  [/^(lurk\w*|waited|waits|watched|watches|watching|hid|hides|hiding|peeked|peeks|crouched|crouches|stalked|stalks)$/, "lurk"],
  [/^(reached|reaches|reach|reaching|stretched|stretches)$/, "reach"],
  [/^(carried|carries|carry|carrying|towed|tows|tow|towing|pulled|pulls|pull|hauled|hauls|held|holds|lifted|lifts)$/, "carry"],
  [/^(ate|eats|eat|eating|swallowed|swallows|gobbled|gobbles|devoured|devours|chewed|chews|munched|munches|feeds|fed)$/, "eat"],
  [/^(flew|flies|fly|flying|soared|soars|swooped|swoops|flapped|flaps|hovered|hovers|hover|glided|glides)$/, "fly"],
  [/^(climbed|climbs|climb|climbing|scaled)$/, "climb"],
  [/^(fled|flees|flee|fleeing|escaped|escapes|retreated)$/, "flee"],
  [/^(dug|digs|dig|digging|burrowed|burrows)$/, "dig"],
  [/^(howl\w*)$/, "howl"],
  [/^(roar\w*|growl\w*|bellow\w*|snarl\w*)$/, "roar"],
  [/^(stomp\w*|smash\w*|crush\w*|trampl\w*)$/, "stomp"],
  [/^(fell|falls|fall|falling|tumbled|toppled|sank|sinks)$/, "fall"],
  [/^(swam|swim|swims|swimming|dove|dived|sailed|paddled)$/, "swim"],
  [/^(attack\w*|bit|bites|bite|hit|hits|struck|clawed|lunged|pounced|slammed|grabbed)$/, "attack"],
  [/^(ran|run|runs|running|chased|chases|raced|sprinted|hunted|hunts|hunting)$/, "run"],
  [/^(walk\w*|stepped|steps|crawled|crawls|moved|moves|moving|wandered|came|comes|lumbered|plodded|marched|stalked)$/, "walk"],
];
const CROWD_VERBS = [
  [/^(march\w*|paraded)$/, "march"], [/^(charg\w*|stormed|rushed|attacked|attack|swarmed)$/, "charge"],
  [/^(fled|flee|flees|fleeing|escaped|scattered|panicked|hid)$/, "flee"], [/^(ran|run|runs|running|raced)$/, "run"],
  [/^(cheer\w*|celebrat\w*|danced|clapped|hooray)$/, "cheer"], [/^(fought|fight|fights|fighting|battled|defended)$/, "fight"],
  [/^(wav\w*)$/, "wave"], [/^(stood|stand|stands|lined|waited|gathered|watched|stay\w*)$/, "stand"],
];
const verbOf = (table, w) => table.find(([re]) => re.test(w))?.[1] ?? null;

// ------------------------------------------------------------------------------------------------ 1. refine
/**
 * The production list cleaned by general rules (see the header). Returns { production, notes }.
 * `mock`: the list came from the free mock director (lib/director/mock.js), which reads words, not meaning.
 */
export function refineProduction(production, { script, mock = false } = {}) {
  const p = clone(production), notes = [];
  const texts = (script?.lines ?? []).map((l) => lc(l.text ?? l));
  const lineOf = (i) => p.lines[i];
  const worldById = (id) => p.worlds.find((w) => w.id === id);
  const isCreatureWorld = (i) => worldById(lineOf(i)?.world)?.kind === "creature";
  const replaceId = (from, to) => { for (const l of p.lines) { l.needs = [...new Set(l.needs.map((x) => (x === from ? to : x)))].filter(Boolean); l.who = [...new Set(l.who.map((x) => (x === from ? to : x)))].filter(Boolean); if (l.subject === from) l.subject = to; } };
  const dropFromLines = (id, keepScenery = null) => {
    for (const l of p.lines) {
      if (!l.needs.includes(id) && l.subject !== id) continue;
      if (keepScenery) (l.scenery ??= []).push(keepScenery);
      l.needs = l.needs.filter((x) => x !== id);
      if (l.subject === id) l.subject = l.who.find((x) => x !== id) ?? l.needs[0] ?? "";
    }
  };

  // a. adjective / material words taken for things, and scenery words on creature-world lines
  for (const pr of [...p.props]) {
    if (pr.storyProp) continue;
    const ws = toks(pr.name);
    const adj = ws.length === 1 && (ADJECTIVES.has(ws[0]) || ADJ_SUFFIX.test(ws[0]));
    const modifier = !adj && ws.length === 1 && texts.some((t) => new RegExp(` ${ws[0]} (\\w+)`).test(t) && p.props.some((q) => q !== pr && toks(q.name).at(-1) === t.match(new RegExp(` ${ws[0]} (\\w+)`))[1]));
    if (adj || modifier) { p.props = p.props.filter((x) => x !== pr); dropFromLines(pr.id); notes.push(`"${pr.name}" is a describing word, not a thing`); continue; }
    const sc = ws.length && ws.every((w) => SCENERY_OF.has(w) || SCENERY_OF.has(sing(w)));
    const onCreature = p.lines.filter((l) => l.needs.includes(pr.id) || l.subject === pr.id).every((l) => isCreatureWorld(l.line));
    if (sc && onCreature) { p.props = p.props.filter((x) => x !== pr); dropFromLines(pr.id, pr.name); notes.push(`"${pr.name}" is the creature world's own scenery`); }
  }

  // b. a creature called big, or bigger than a giant, is a giant
  const giantIds = () => new Set(p.creatures.filter((c) => ["giant", "colossal"].includes(c.scale) || c.heightM > 5).map((c) => c.id));
  for (const c of p.creatures) {
    if (giantIds().has(c.id) || c.monster) continue;
    const words = [...new Set([c.species, ...toks(c.name).filter((w) => w !== "the")].filter(Boolean).flatMap((w) => [w, `${w}s`]))];
    let big = false, than = null;
    texts.forEach((t, i) => {
      const ts = toks(t);
      ts.forEach((w, k) => { if (words.includes(w) && ts.slice(Math.max(0, k - 3), k).some((x) => BIG_WORDS.test(x))) big = true; });
      const cmp = t.match(COMPARE);
      if (!cmp) return;
      const about = words.some((w) => toks(t.slice(0, cmp.index + 1)).includes(w)) || (PRONOUN_LEAD.test(t) && i > 0 && words.some((w) => toks(texts[i - 1]).includes(w)));
      if (!about) return;
      big = true;
      const other = p.creatures.find((o) => o !== c && giantIds().has(o.id) && t.slice(cmp.index).includes(` ${o.species}`));
      if (other) than = other;
    });
    if (big) {
      c.scale = "giant"; c.heightM = than ? Math.min(200, Math.max(30, Math.round((than.heightM || 120) * 0.62))) : 40;
      notes.push(`${c.id}: called big${than ? ` (taller than the ${than.species})` : ""} -> a giant, ${c.heightM} m`);
    }
  }

  // c. mock only: a line led by a pronoun is about the previous line's subject
  if (mock) {
    p.lines.forEach((l, i) => {
      const m = (script?.lines?.[i]?.text ?? "").match(PRONOUN_LEAD);
      const prev = p.lines[i - 1];
      if (!m || !prev?.subject) return;
      const pr = m[1].toLowerCase(), ps = prev.subject;
      const kind = p.creatures.some((x) => x.id === ps) ? "creature" : p.crowds.some((x) => x.id === ps) ? "crowd" : p.cast.some((x) => x.id === ps && x.id !== "me") ? "cast" : null;
      const fits = pr === "they" ? kind === "crowd" : pr === "it" ? kind === "creature" : kind === "creature" || kind === "cast";
      if (!fits || l.subject === ps) return;
      notes.push(`line ${i}: "${m[1]}" is ${ps} (the line before)`);
      l.subject = ps; if (!l.needs.includes(ps) && kind !== "cast") l.needs.unshift(ps); if (kind === "cast" && !l.who.includes(ps)) l.who.unshift(ps);
    });
  }

  // d. crowds: the same soldiers twice are one army; an army next to a giant is that giant's
  const kindOfCrowd = (cw) => (cw.member === "person" ? (/knight/.test(cw.name) ? "knight" : SOLDIERY.test(cw.name) ? "soldier" : "townsfolk") : cw.member === "creature" && p.creatures.find((x) => x.id === cw.of)?.species === "wolf" ? "wolf_soldier" : cw.member);
  const armies = p.crowds.filter((cw) => ["soldier", "wolf_soldier"].includes(kindOfCrowd(cw)));
  for (const extra of armies.slice(1)) {
    const keep = armies[0];
    keep.count = Math.max(keep.count, extra.count); keep.actions = [...new Set([...keep.actions, ...extra.actions])];
    if (!/army/.test(keep.name) && /army/.test(extra.name)) keep.name = `${extra.name} of ${keep.name}`;
    p.crowds = p.crowds.filter((x) => x !== extra); replaceId(extra.id, keep.id);
    notes.push(`${extra.id} is the same army as ${keep.id}`);
  }
  // e. a crowd word on a line with no crowd of that kind; "hundreds of them" / "they" go on with the line before's crowd
  texts.forEach((t, i) => {
    const l = lineOf(i); if (!l) return;
    for (const w of toks(t)) {
      const kind = CROWD_WORD[w];
      if (!kind) continue;
      const have = l.needs.map((id) => p.crowds.find((c) => c.id === id)).filter(Boolean).some((c) => kindOfCrowd(c) === kind || (kind === "soldier" && kindOfCrowd(c) === "wolf_soldier"));
      if (have) continue;
      let cw = p.crowds.find((c) => kindOfCrowd(c) === kind || (kind === "soldier" && kindOfCrowd(c) === "wolf_soldier"));
      if (!cw) { cw = { id: `${kind}_crowd`, name: w, member: "person", of: "", count: kind === "townsfolk" ? 60 : 150, actions: [] }; while (p.crowds.some((c) => c.id === cw.id)) cw.id += "_2"; p.crowds.push(cw); notes.push(`line ${i}: "${w}" -> a crowd (${cw.id})`); }
      l.needs.push(cw.id);
      // "The knights lined up": the line is about the crowd, not the narrator it defaulted to
      if ((!l.subject || l.subject === "me") && !/\b(i|i'm|me|my|myself)\b/.test(t)) l.subject = cw.id;
    }
    const prev = lineOf(i - 1);
    const prevCrowd = prev?.needs.find((id) => p.crowds.some((c) => c.id === id));
    if (prevCrowd && !l.needs.some((id) => p.crowds.some((c) => c.id === id)) && /\b(they|them|hundreds|thousands|dozens|rows|ranks)\b/.test(t) && !l.needs.some((id) => p.creatures.some((c) => c.id === id))) {
      l.needs.push(prevCrowd); if (!l.subject || l.subject === "me" && !/\b(i|me|my|we|us|our)\b/.test(t)) l.subject = prevCrowd;
      notes.push(`line ${i}: "them" is ${prevCrowd}`);
    }
  });
  // f. the army's side: next to a giant (its first line or the two before), it is that giant's army
  const giants = giantIds();
  for (const cw of p.crowds) {
    if (!["soldier"].includes(kindOfCrowd(cw)) || cw.of) continue;
    const first = p.lines.findIndex((l) => l.needs.includes(cw.id) || l.subject === cw.id);
    if (first < 0) continue;
    const near = [first, first - 1, first - 2].map((i) => p.lines[i]).filter(Boolean).flatMap((l) => [l.subject, ...l.needs]);
    const g = p.creatures.find((c) => giants.has(c.id) && near.includes(c.id) && !p.worlds.some((w) => w.creature?.species === c.species));
    if (g) { cw.faction = g.id; if (g.species === "wolf") { cw.member = "creature"; cw.of = g.id; } notes.push(`${cw.id} marches for ${g.id}`); }
  }
  // the subject is always one of the line's items
  for (const l of p.lines) if (l.subject && !l.needs.includes(l.subject) && !l.who.includes(l.subject) && l.subject !== l.world && l.subject !== "me") l.needs.unshift(l.subject);
  return { production: p, notes };
}

// ------------------------------------------------------------------------------------------------ 2. read
/** when the caller gives no `exists`: an EPIC route anywhere in the director's match means EPIC's files are there */
const landedFrom = (match) => {
  const epic = (match?.calls ?? []).some((c) => c.route === "epic") || (match?.perLine ?? []).some((l) => (l.extras ?? []).some((e) => e.route === "epic"));
  return (rel) => epic && /(creatureWorld|giants|crowd|cameraEpic|blueprint|worldspec)\.js$/.test(rel);
};

export function readDirection(direction, { script, idea = {}, mood = "horror", exists = null } = {}) {
  if (!direction?.production?.lines) return null;
  const mock = direction.provider === "mock" || direction.fellBack === true || /^\(mock\)/.test(direction.production.summary ?? "");
  const { production, notes } = refineProduction(direction.production, { script, mock });
  const ex = exists ?? direction.exists ?? landedFrom(direction.match);
  const match = matchProduction(production, { exists: ex, script: { lines: (script?.lines ?? []).map((l) => ({ part: l.part, text: l.text ?? String(l) })) }, mood: idea?.mood ?? mood, idea });
  const calls = new Map(match.calls.map((c) => [c.item, c]));
  const P = production;
  // the creature each creature world is (the giant the town lives on / in)
  const worldCreature = new Map();
  for (const w of P.worlds) if (w.kind === "creature" && w.creature?.species) {
    const cr = P.creatures.find((c) => c.species === w.creature.species);
    worldCreature.set(w.id, { species: w.creature.species, relation: w.creature.relation === "none" ? "on" : w.creature.relation, size: Math.max(30, Math.min(200, w.creature.heightM || cr?.heightM || 120)), creatureId: cr?.id ?? null });
  }
  const worldSpecies = new Set([...worldCreature.values()].map((w) => w.species));
  // EPIC giants: the creatures routed to "epic" that are not a world the town lives on
  const giants = {};
  for (const c of P.creatures) {
    const call = calls.get(c.id);
    if (call?.route !== "epic" || call.capability !== "giant" || worldSpecies.has(c.species)) continue;
    const kind = /^(human|man|woman|person|people|giant|giants|titan|ogre)$/.test(c.species) ? "giant_human" : c.species;
    giants[c.id] = { behaviours: (c.behaviours ?? []).filter((b) => !["stand", "idle"].includes(b)), kind, size: Math.max(5, Math.min(200, Math.round(c.heightM || call.epic?.size || 40))), ...(GIANT_KINDS.includes(kind) ? {} : { params: {} }), ...(kind === "wolf" ? { armour: true } : {}), name: c.name || c.species, aliases: aliasesOf(c.name, c.species) };
  }
  // crowds: EPIC kinds, sides, sizes
  const crowds = {};
  for (const cw of P.crowds) {
    const call = calls.get(cw.id);
    let kind = call?.crowdKind ?? "townsfolk";
    if (kind === "kid") kind = "townsfolk";
    const epicKind = CROWD_KINDS.includes(kind) ? kind : null;
    const member = cw.of ? calls.get(cw.of) : null;
    const town = epicKind === "townsfolk" || epicKind === "knight";
    crowds[cw.id] = { id: cw.id, kind: epicKind, memberGiant: !epicKind && cw.of && giants[cw.of] ? cw.of : null, memberKit: !epicKind && member?.route === "kit" ? member.kitName : null, count: Math.max(12, Math.min(town ? 160 : 400, Math.round(cw.count || 60))), town, faction: cw.faction ?? (cw.of && giants[cw.of] ? cw.of : null), name: cw.name, aliases: aliasesOf(cw.name, kind === "wolf_soldier" ? "wolf soldiers army" : epicKind === "soldier" ? "soldiers army troops" : epicKind === "knight" ? "knights" : epicKind === "townsfolk" ? "people townsfolk crowd everyone everybody town" : cw.of || "") };
  }
  const lines = P.lines.map((l, i) => {
    const per = match.perLine[i];
    const text = script?.lines?.[i]?.text ?? "";
    const wcall = calls.get(l.world);
    return { i, text, low: lc(text), world: l.world, worldCall: wcall, creatureWorld: wcall?.route === "epic" ? worldCreature.get(l.world) ?? null : null, subject: l.subject, who: l.who, action: l.action, camera: l.camera, light: l.light, needs: l.needs, scenery: l.scenery ?? [], required: per?.required ?? [], extras: per?.extras ?? [] };
  });
  return { production: P, match, calls, notes, lines, giants, crowds, worldCreature, mock, provider: direction.provider ?? null, cast: P.cast };
}
function aliasesOf(...parts) { return [...new Set(parts.flatMap((p) => toks(p)).filter((w) => w.length > 2 && !/^(the|and|of|our|his|her|their|big|bad|giant|huge|little)$/.test(w)).flatMap((w) => [w, sing(w), `${sing(w)}s`]))]; }

// ------------------------------------------------------------------------------------------------ 3. the overlay
/** which world id (timeline.worlds) shows this creature from this view */
function worldId(tl, wc, view, water) {
  const sea = water && view !== "inside";
  const id = `${wc.species}_${view}${sea ? "_sea" : ""}`.replace(/[^a-z0-9_]/g, "_");
  tl.worlds ??= {};
  tl.worlds[id] ??= { creature: wc.species, view, size: wc.size, seed: (hashSeed(wc.species) % 89) + 3, ...(sea ? { water: true } : {}) };
  return id;
}
export function worldAliasesFor(wc, view, water) {
  const body = BODY_WORDS[wc.species] ?? BODY_WORDS.default;
  const town = view === "inside" || view === "on" ? SCENERY.town : [];
  const land = view === "outside" ? (water ? [...SCENERY.water, "hill", "hills", "horizon", "outside", "world"] : [...SCENERY.land]) : view === "on" ? ["land", "ground", "horizon", "world", "outside", ...(water ? SCENERY.water : [])] : ["world"];
  const inner = view === "inside" ? ["ribs", "rib", "insides", "belly", "skylight", "sunlight", "cracks", "crack", "heartbeat", "heart"] : [];
  return [...new Set([wc.species, `${wc.species}s`, ...["giant", "massive", "huge", "enormous", "big", "colossal", "gigantic"].map((a) => `${a} ${wc.species}`), ...body, ...town, ...land, ...inner, "edge", "top"])];
}

/** a line's verbs, given to the giant / crowd mentioned before each one (pronouns: the line's subject) */
function verbsOfLine(L, D) {
  const ws = toks(L.text);
  const mentions = [];
  const giantWords = Object.entries(D.giants).map(([id, g]) => [id, g.aliases]);
  const wc = L.creatureWorld;
  const crowdWords = L.needs.filter((id) => D.crowds[id]).map((id) => [id, D.crowds[id].aliases]);
  ws.forEach((w, k) => {
    for (const [id, al] of giantWords) if (al.includes(w)) mentions.push({ k, id, kind: "giant" });
    if (wc && (w === wc.species || w === `${wc.species}s`)) mentions.push({ k, id: "world", kind: "giant" });
    const giantHere = mentions.some((x) => x.k === k);
    if (!giantHere) for (const [id, al] of crowdWords) if (al.includes(w) || /^(they|them)$/.test(w)) mentions.push({ k, id, kind: "crowd" });
    if (/^(he|she|it)$/.test(w)) {
      const s = L.subject;
      if (D.giants[s]) mentions.push({ k, id: s, kind: "giant" });
      else if (wc && D.worldCreature && [...D.worldCreature.values()].some((x) => x.creatureId === s)) mentions.push({ k, id: "world", kind: "giant" });
    }
  });
  const out = { giant: {}, crowd: {} };
  ws.forEach((w, k) => {
    // "never stops moving": a negated verb says nothing; "Behind him marched an army": the verb before its doer
    if (ws.slice(Math.max(0, k - 2), k).some((x) => /^(never|not|no|didn't|doesn't|don't|can't|won't|cannot|couldn't|wasn't)$/.test(x))) return;
    const m = mentions.filter((x) => x.k < k).at(-1) ?? mentions.find((x) => x.k > k && x.kind === "crowd");
    if (!m) return;
    const v = verbOf(m.kind === "giant" ? GIANT_VERBS : CROWD_VERBS, w);
    if (v && !out[m.kind][m.id]) out[m.kind][m.id] = v;
  });
  // the director's own action for the subject, when the words gave none
  const sa = L.action;
  if (D.giants[L.subject] && !out.giant[L.subject]) out.giant[L.subject] = verbOf(GIANT_VERBS, sa) ?? null;
  if (D.crowds[L.subject] && !out.crowd[L.subject]) out.crowd[L.subject] = verbOf(CROWD_VERBS, sa) ?? null;
  return out;
}

/** the view each primary shot of a creature-world line needs: "outside" | "on" | the world's own relation */
function viewsFor(L, D, shots, aux) {
  const wc = L.creatureWorld;
  const giantsHere = L.needs.filter((id) => D.giants[id]);
  const armies = L.needs.filter((id) => D.crowds[id] && !D.crowds[id].town);
  const townCrowds = L.needs.filter((id) => D.crowds[id]?.town);
  const sc = L.scenery.flatMap((x) => toks(x)).map((w) => SCENERY_OF.get(w) ?? SCENERY_OF.get(sing(w)));
  const worldItem = wc.creatureId && (L.needs.includes(wc.creatureId) || L.subject === wc.creatureId);
  const worldSubject = wc.creatureId && L.subject === wc.creatureId;
  const onPhrase = /\b(on|onto|top of|edge of|up on|up to the top of) (the|its|our|their) (shell|back)\b/.test(L.low);
  const outside = giantsHere.length > 0 || armies.length > 0 || sc.includes("land") || sc.includes("water") || wc.relation === "outside"
    || (worldSubject && L.camera !== "normal") || (worldItem && L.camera === "scale") || (worldItem && /\b(outside|from outside)\b/.test(L.low)) || (worldSubject && /\b(swam|swims|swim|walks|walked|walking|stopped|moving|moves)\b/.test(L.low) && !townCrowds.length);
  const town = townCrowds.length > 0 || sc.includes("town");
  const own = wc.relation === "outside" ? "outside" : wc.relation;
  if (onPhrase && !giantsHere.length) return shots.map(() => "on");
  if (!outside) return shots.map(() => own);
  if (!town) return shots.map(() => "outside");
  // both: the first shot outside (the giants, the army, the creature), the rest in the town; one short shot: on the back
  if (shots.length >= 2) return shots.map((_, k) => (k === 0 ? "outside" : own === "outside" ? "on" : own));
  return shots.map(() => "on");
}

const CAM_ALT = { establish: ["aerial", "hero_low"], aerial: ["establish", "track"], track: ["behind_army", "establish"], behind_army: ["track", "establish"], hero_low: ["giant_close", "establish"], giant_close: ["hero_low", "establish"], duel: ["establish", "giant_close"] };

/**
 * The overlay (mutates tl). aux: { lines (plan.mjs timed lines), W (word timings), used (cast ids), recam(shots, i, not),
 * split(shots, i, t) -> bool }
 */
export function directShots(tl, D, aux) {
  tl.giants = Object.fromEntries(Object.entries(D.giants).map(([id, g]) => [id, { kind: g.kind, size: g.size, ...(g.params ? { params: g.params } : {}), ...(g.armour ? { armour: true } : {}) }]));
  if (!Object.keys(tl.giants).length) delete tl.giants;
  const shots = tl.shots;
  const worldState = new Map();   // world creature: "walk" | "idle" | "swim" carried line to line
  let water = false;
  const touched = new Set();
  for (const L of D.lines) {
    const prim = () => shots.filter((s) => s.line === L.i && s.camera !== "insert");
    let own = prim();
    // the first line shown only by the rule sign: the sign, then the world it is about (an EPIC line needs its shot)
    if (!own.length && L.i === 0 && (L.creatureWorld || L.needs.some((id) => D.giants[id] || D.crowds[id]?.kind))) {
      const k = shots.findIndex((s) => s.line === 0);
      if (k >= 0 && aux.split(shots, k, shots[k].start + (shots[k].end - shots[k].start) * 0.45)) {
        const r = shots[k + 1];
        Object.assign(r, { camera: "wide", focus: "group", insert: null, actors: [], marker: null, subject: r.subject ?? null });
        delete r.markers; delete r.objects;
        own = prim();
      }
    }
    if (!own.length) continue;
    const V = verbsOfLine(L, D);
    const wc = L.creatureWorld;
    // the light per line (the director's), on every shot of the line
    for (const s of shots.filter((x) => x.line === L.i)) if (["day", "night", "warm"].includes(L.light)) s.light = L.light;
    const giantsHere = L.needs.filter((id) => D.giants[id]);
    const crowdsHere = L.needs.filter((id) => D.crowds[id]?.kind);
    if (!wc && !giantsHere.length && !crowdsHere.length) continue;
    // the world creature's state, line to line ("stopped walking" holds until it moves again; once it swims: the sea)
    if (wc) {
      const v = V.giant.world;
      if (v === "swim" || /\b(swam|swims|swimming)\b/.test(L.low) && (L.subject === wc.creatureId || V.giant.world)) water = true;
      if (L.scenery.some((x) => toks(x).some((w) => SCENERY.water.includes(w)))) water = true;
      if (v) worldState.set(wc.species, v === "idle" ? "idle" : v);
    }
    let views = wc ? viewsFor(L, D, own, aux) : own.map(() => null);
    // two views needed in one short-enough shot: split it at the word nearest its middle
    if (wc && own.length === 1 && views[0] === "on" && (giantsHere.length || crowdsHere.some((id) => !D.crowds[id].town)) && crowdsHere.some((id) => D.crowds[id].town)) {
      const s = own[0], mid = (s.start + s.end) / 2;
      if (s.end - s.start >= 2 * 0.8 + 0.2 && aux.split(shots, shots.indexOf(s), mid)) { own = prim(); views = viewsFor(L, D, own, aux); }
    }
    own.forEach((s, k) => {
      touched.add(s);
      let view = views[k];
      // people never stand in the open sea: a shot with someone in it at sea is on the creature's back
      // (a line about the town / the creature at sea, "Now we live far out at sea": the creature swimming, no people)
      // ("we" / everyone at sea: the town's crowd on the creature's back)
      const townCrowd = Object.keys(D.crowds).find((id) => D.crowds[id].kind === "townsfolk");
      if (wc && water && (view === "outside" || view === "on") && !(s.subject && (s.actors ?? []).some((a) => a.id === s.subject && !/^town\d$/.test(a.id)))) {
        dropActors(s, () => true);
        view = "outside";
        if (s.subject === "group" && townCrowd) { view = "on"; if (!crowdsHere.includes(townCrowd)) s._townCrowd = townCrowd; }
      }
      if (wc && view === "outside" && water && (s.actors ?? []).some((a) => !/^town\d$/.test(a.id))) view = "on";
      // the set
      if (wc) {
        const indoorBase = s.set === "bedroom" || s.set === "school";
        if (!(indoorBase && view === wc.relation && view === "inside")) {
          s.worldBase = s.worldBase ?? s.set;
          s.set = `creature:${worldId(tl, wc, view, water)}`;
          s.worldAliases = [...new Set([...(s.worldAliases ?? []), ...worldAliasesFor(wc, view, water && view !== "inside")])];
        }
      } else if ((giantsHere.length || crowdsHere.some((id) => !D.crowds[id].town)) && (s.set === "bedroom" || s.set === "school")) {
        s.set = ["street", "woods"].includes(L.worldCall?.set) ? L.worldCall.set : "street";
      }
      const outsideView = isCreatureSet(s) && /_(outside|outside_sea)$/.test(s.set) || isCreatureSet(s) && tl.worlds[s.set.slice(9)]?.view === "outside";
      const onView = isCreatureSet(s) && tl.worlds[s.set.slice(9)]?.view === "on";
      const insideView = isCreatureSet(s) && tl.worlds[s.set.slice(9)]?.view === "inside";
      // giants (never inside the creature: they are outside it)
      const G = [];
      if (wc && (outsideView || onView)) {
        const st = V.giant.world ?? worldState.get(wc.species) ?? (water ? "swim" : "walk");
        G.push({ id: "world", action: water && outsideView && st === "walk" ? "swim" : st === "run" ? "walk" : st, aliases: worldAliasesFor(wc, outsideView ? "outside" : "on", water) });
      }
      if (!insideView) giantsHere.forEach((id, n) => {
        // the line's verb, else the giant's own state (the director's behaviours: a sleeping moose sleeps), else walk
        const own = D.giants[id].behaviours.map((b) => verbOf(GIANT_VERBS, b)).find((b) => ["sleep", "lurk", "reach", "carry", "eat", "fly", "dig", "climb"].includes(b));
        const act = V.giant[id] ?? own ?? (D.giants[id].kind === "wolf" ? "idle" : "walk");
        const spot = outsideView ? (n === 0 ? "giant_left" : "giant_right") : onView ? "horizon" : "far";
        G.push({ id, spot, action: act, facing: act === "walk" || act === "run" || act === "carry" ? "right" : act === "flee" ? "away" : "camera", aliases: D.giants[id].aliases });
      });
      if (G.length) s.giants = G; else delete s.giants;
      // crowds: town crowds in the town views (and on standard sets), armies outside / on standard sets
      const C = [];
      for (const id of [...crowdsHere, ...(s._townCrowd ? [s._townCrowd] : [])]) {
        const c = D.crowds[id];
        if (insideView && !c.town) continue;
        if (outsideView && c.town && own.length > 1) continue;
        const act = V.crowd[id] ?? (L.subject === id ? verbOf(CROWD_VERBS, L.action) : null) ?? "stand";
        const formation = act === "march" ? "march" : act === "charge" ? "wedge" : /\bline(s|d)?\b/.test(L.low) && !c.town ? "line" : c.town && c.kind === "townsfolk" ? "scatter" : "block";
        const faction = c.kind === "wolf_soldier" ? "wolf" : c.faction ? "wolf" : c.town ? "town" : undefined;
        const entry = { kind: c.kind, count: c.kind === "townsfolk" ? Math.min(Math.max(c.count, onView ? 120 : 0), insideView ? 60 : 160) : c.count, formation, action: act, spot: "back",
          facing: act === "march" ? "right" : act === "charge" || act === "stand" && !c.town ? "far" : "camera", seed: (hashSeed(id) % 40) + 2, item: id, aliases: c.aliases };
        if (faction) entry.faction = faction;
        if (c.kind === "townsfolk") entry.spacing = 2.2;
        if (onView) entry.onWorld = true;
        C.push(entry);
      }
      delete s._townCrowd;
      if (C.length) s.crowds = C; else delete s.crowds;
      // the stand-ins the EPIC things replace: the giant's / the creature's / a crowd member's small kit object, filler
      // townsfolk when a town crowd is there
      const replaced = new Set([...giantsHere.map((id) => D.giants[id].kind), ...(wc ? [wc.species] : []), ...G.flatMap((g) => g.aliases ?? []).filter((w) => !SCENERY_OF.has(w))]);
      // (and a kit object put in for a noun the creature world itself shows: a porthole for "the sea")
      const lineWords = new Set(toks(L.text).flatMap((w) => [w, sing(w)]));
      const sceneryOnly = (o) => isCreatureSet(s) && (s.worldAliases ?? []).length && (() => { const al = aux.objectAliases?.(o.name) ?? []; const said = al.filter((a) => lineWords.has(a)); return said.length > 0 && said.every((a) => s.worldAliases.includes(a)); })();
      if (s.objects) { s.objects = s.objects.filter((o) => !replaced.has(String(o.name).replace(/_creature$/, "")) && !(isCreatureSet(s) && o.name === "house_front") && !sceneryOnly(o)); if (!s.objects.length) delete s.objects; }
      const subjIsPerson = s.subject && (s.actors ?? []).some((a) => a.id === s.subject && !/^town\d$/.test(a.id));
      // filler townsfolk give way to a town crowd, and to the giants / the creature / an army when the line is about them
      if (C.some((c) => c.kind === "townsfolk" || c.kind === "knight") || (!subjIsPerson && (G.length || C.length) && !/^(group|someone)$/.test(s.subject ?? ""))) dropActors(s, (a) => /^town\d$/.test(a.id));
      if (s.focus === "object" && !s.objects?.length) s.focus = s.actors?.[0]?.id ?? "group";
      if (s.focus === "monster" && !s.monsterState) s.focus = s.actors?.[0]?.id ?? "group";
      // the beat (one per shot), from the line's hint and its verbs
      const attacker = G.find((g) => g.id !== "world" && g.action === "attack");
      const charging = C.find((c) => c.action === "charge");
      const falling = G.find((g) => g.action === "fall"), stomping = G.find((g) => g.action === "stomp"), roaring = G.find((g) => g.action === "roar");
      const swimming = G.find((g) => g.id === "world" && g.action === "swim" && /\b(swam|swim|swims)\b/.test(L.low));
      const cheering = C.find((c) => c.action === "cheer"), fleeing = C.find((c) => c.action === "flee" || c.action === "run"), marching = C.find((c) => c.action === "march");
      let beat = null;
      if (attacker && G.some((g) => g.id === "world")) { beat = { type: "attack" }; attacker.role = "attacker"; G.find((g) => g.id === "world").role = "target"; }
      else if (falling) { beat = { type: "fall" }; falling.role = "faller"; }
      else if (stomping) { beat = { type: "stomp" }; stomping.role = "giant"; }
      else if (roaring) { beat = { type: "roar" }; roaring.role = "giant"; }
      else if (swimming) { beat = { type: "swim_away" }; swimming.role = "swimmer"; }
      else if (charging) { beat = { type: "charge" }; charging.role = "army"; if (G.some((g) => g.id === "world")) G.find((g) => g.id === "world").role = "target"; }
      else if (L.camera === "shake" || /\b(boom|shook|shakes|shake|quake|rattled|rumbled)\b/.test(L.low)) beat = { type: "impact" };
      else if (marching) { beat = { type: "march" }; marching.role = "army"; }
      else if (cheering) { beat = { type: "cheer" }; cheering.role = "crowd"; }
      else if (fleeing) { beat = { type: "flee" }; fleeing.role = "crowd"; }
      if (beat && BEATS[beat.type]) s.beat = beat; else delete s.beat;
      if (!beat && /\b(sways?|swayed|rocks?|rocked|tilts?|tilted)\b/.test(L.low)) s.shake = "rumble"; else delete s.shake;
      // people face the giant they see
      const enemy = G.find((g) => g.id !== "world");
      for (const a of s.actors ?? []) if (enemy) { a.facing = enemy.id; if (a.pose === "stand" || a.pose === "talk") { a.pose = "scared"; a.expr = "scared"; } }
      // the camera and its focus
      const person = (s.actors ?? []).find((a) => a.id === s.subject) ?? ((s.actors ?? []).length && s.subject && !/^(thing:|group|monster)/.test(s.subject) ? null : null);
      const subjPerson = s.subject && (s.actors ?? []).some((a) => a.id === s.subject) ? s.subject : null;
      let cam = null, focus = null;
      // a person under a giant / before an army: the low hero shot (the creature they live on is no giant to look up at)
      if (subjPerson && (G.some((g) => g.id !== "world") || C.some((c) => !c.town))) { cam = "hero_low"; focus = subjPerson; }
      else if (subjPerson && onView) { cam = "wide"; focus = subjPerson; }
      else if (subjPerson) { cam = null; }
      else if (charging && (stomping || roaring) && own.length > 1) { const g = stomping ?? roaring; if (k === 0) { cam = "establish"; focus = `giant:${g.id}`; } else { cam = "behind_army"; focus = "crowd"; } }
      else if (beat?.type === "attack" && charging) { cam = "behind_army"; focus = "crowd"; }
      else if (beat?.type === "attack") { cam = "duel"; focus = `giant:${attacker.id}`; }
      else if (charging && G.some((g) => g.id === "world" || g.id !== "world")) { cam = "behind_army"; focus = "crowd"; }
      else if (beat?.type === "fall" || beat?.type === "stomp" || beat?.type === "roar") { const g = falling ?? stomping ?? roaring; cam = beat.type === "fall" ? "establish" : beat.type === "roar" ? "giant_close" : "hero_low"; focus = g.id === "world" ? "world" : `giant:${g.id}`; if (cam === "hero_low" && !(s.actors ?? []).length) cam = "giant_close"; }
      else if ((marching && marching.kind !== "townsfolk") || C.some((c) => c.kind !== "townsfolk" && (c.action === "charge" || c.action === "run"))) { cam = "track"; focus = "crowd"; }
      else if (wc && L.subject === wc.creatureId && G.some((g) => g.id === "world") && !(s.actors ?? []).length) { cam = "establish"; focus = "world"; }
      else if ((L.camera === "reveal" || enemy?.action === "reveal" || enemy?.action === "reach") && enemy) { cam = "giant_close"; focus = `giant:${enemy.id}`; }
      else if (enemy && !(s.actors ?? []).length) { cam = "establish"; focus = `giant:${enemy.id}`; }
      else if (G.some((g) => g.id === "world") && !(s.actors ?? []).length && !C.length) { cam = "establish"; focus = "world"; }
      else if (C.length && !(s.actors ?? []).some((a) => !/^town\d$/.test(a.id))) { cam = C[0].town && !onView ? (C[0].action === "cheer" || C[0].action === "fight" ? "aerial" : "wide") : onView ? "aerial" : "establish"; focus = "crowd"; }
      if (cam) { s.camera = cam; s.focus = focus; }
      else if ((s.actors ?? []).length === 0 && (G.length || C.length)) { s.camera = G.length ? "establish" : "aerial"; s.focus = G.length ? (G.some((g) => g.id === "world") ? "world" : `giant:${G[0].id}`) : "crowd"; }
      // a standard camera on an ordinary set with only giants / crowds in view frames them
      if (!EPIC_CAMERAS.includes(s.camera) && !(s.actors ?? []).length && !(s.objects ?? []).length && !s.monsterState && (G.length || C.length)) { s.camera = "establish"; s.focus = G.length ? (G[0].id === "world" ? "world" : `giant:${G[0].id}`) : "crowd"; }
      // on the creature's back a giant is far off at the horizon: frame the creature (or the crowd) instead
      if (onView && /^giant:/.test(s.focus ?? "")) { s.focus = C.length ? "crowd" : "world"; if (["giant_close", "duel", "hero_low"].includes(s.camera) && !(s.actors ?? []).length) s.camera = "establish"; }
      if (s.camera === "closeup" && C.length) s.camera = "medium";
      // on the creature's back a medium / closeup sees only shell: wide shows the town, the creature and the land or sea
      if (onView && ["medium", "closeup", "over_shoulder"].includes(s.camera)) s.camera = "wide";
      void person;
    });
  }
  epicVariety(shots, aux.recam);
  return touched;
}

function dropActors(s, fn) {
  const gone = new Set((s.actors ?? []).filter(fn).map((a) => a.id));
  if (!gone.size) return;
  s.actors = (s.actors ?? []).filter((a) => !gone.has(a.id));
  const ms = [...(s.markers ?? []), ...(s.marker ? [s.marker] : [])].filter((m, i, a) => !gone.has(m.on) && a.findIndex((x) => x.on === m.on && x.text === m.text) === i);
  if (ms.length > 1) s.markers = ms; else delete s.markers;
  s.marker = ms[0] ?? null;
  if (gone.has(s.focus)) s.focus = s.actors[0]?.id ?? "group";
}

/** the variety rule (never the same camera 3 times in a row), EPIC cameras included; the video opens wide / establishing */
export function epicVariety(shots, recam) {
  shots.forEach((s, i) => {
    if (i < 2 || s.camera !== shots[i - 1].camera || s.camera !== shots[i - 2].camera) return;
    const alts = CAM_ALT[s.camera];
    if (alts) {
      const ok = alts.find((c) => c !== shots[i + 1]?.camera && !(c === "hero_low" && !(s.actors ?? []).length && !s.giants?.length) && !(c === "giant_close" && !s.giants?.some((g) => g.id !== "world")) && !(c === "track" && !s.crowds?.some((x) => x.kind !== "townsfolk") && !s.giants?.some((g) => g.id !== "world")) && !(c === "behind_army" && !s.crowds?.some((x) => x.kind !== "townsfolk")));
      if (ok) { s.camera = ok; if (ok === "giant_close" && !/^giant:/.test(s.focus)) s.focus = `giant:${s.giants.find((g) => g.id !== "world").id}`; return; }
    }
    s.camera = recam(shots, i, s.camera);
  });
  if (!["wide", "insert", "establish", "aerial"].includes(shots[0].camera)) shots[0].camera = isCreatureSet(shots[0]) || shots[0].giants?.length || shots[0].crowds?.length ? "establish" : "wide";
  if (shots[0].camera === "establish" && !(shots[0].giants?.length || shots[0].crowds?.length || isCreatureSet(shots[0]))) shots[0].camera = "wide";
  if (shots[0].camera === "establish" && isCreatureSet(shots[0]) && !/^(giant:|crowd|world)/.test(shots[0].focus) && !(shots[0].actors ?? []).some((a) => a.id === shots[0].focus)) shots[0].focus = "world";
  return shots;
}

// ------------------------------------------------------------------------------------------------ 4. the check
/** what the timeline keeps: per line the required items (enough to check without the match), the gaps, the notes */
export function compactProduction(D) {
  const wcIds = new Set([...D.worldCreature.values()].map((w) => w.creatureId).filter(Boolean));
  const worldOf = (id) => [...D.worldCreature.entries()].find(([, w]) => w.creatureId === id);
  return {
    version: 1, provider: D.provider, summary: D.production.summary ?? "", notes: D.notes,
    perLine: D.lines.map((L) => ({ line: L.i, subject: L.subject, camera: L.camera, light: L.light,
      // the narrator is required only when the line says I / me / my ("we" / "our" is the town)
      required: L.required.filter((r) => !(r.kind === "cast" && r.id === "me" && L.subject !== "me" && (!L.who.includes("me") || !/\b(i|i'm|im|me|my|myself|mine|i've|i'd|i'll)\b/.test(L.low)))).map((r) => {
        const out = { id: r.id, kind: r.kind ?? "thing", name: r.name ?? r.id, route: r.route };
        for (const k of ["kitName", "needId", "set", "card", "capability"]) if (r[k] != null) out[k] = r[k];
        if (D.giants[r.id]) out.giant = true;
        if (wcIds.has(r.id)) { out.worldCreature = true; out.species = worldOf(r.id)?.[1].species; }
        if (r.kind === "world" && L.creatureWorld) out.species = L.creatureWorld.species;
        if (D.crowds[r.id]) { out.crowdKind = D.crowds[r.id].kind; out.memberKit = D.crowds[r.id].memberKit; if (D.crowds[r.id].memberGiant) out.memberGiant = D.crowds[r.id].memberGiant; out.aliases = D.crowds[r.id].aliases; }
        return out;
      }) })),
    gaps: D.match.gaps, summaryCounts: D.match.summary,
  };
}

const NW = (s) => toks(String(s ?? "").replace(/_/g, " ")).filter((w) => w.length > 2 && !/^(the|and|for|with|our|his|her|its)$/.test(w));
const markersOf = (s) => [...(s.markers ?? []), ...(s.marker ? [s.marker] : [])];

/** is this required item on screen in shot s? (strict: a missing id never matches a missing id) */
export function onScreen(r, s, tl = {}) {
  const name = NW(r.name);
  // the item's own picture card (its text), or a card / badge naming it
  const cardWords = r.card?.text ? NW(r.card.text) : [];
  const cardSays = !!s.insert && (["card", "sign", "note"].includes(s.insert.kind) && NW(s.insert.text).some((w) => name.includes(w) || name.includes(sing(w)) || name.map(sing).includes(sing(w))) || (r.card?.text && s.insert.text === r.card.text));
  const badge = markersOf(s).some((m) => NW(m.text).some((w) => name.includes(w) || name.map(sing).includes(sing(w)) || cardWords.at(-1) === w));
  const objs = s.objects ?? [];
  const objHit = objs.some((o) => (r.needId && (o.needId === r.needId)) || (r.kitName && o.name === r.kitName) || (o.asset && [o.name, ...(o.aliases ?? [])].some((a) => NW(a).some((w) => name.includes(w)))) || NW(o.name).join(" ") === name.join(" "));
  const giants = s.giants ?? [], crowds = s.crowds ?? [];
  const actors = s.actors ?? [];
  if (s.camera === "insert") return cardSays || (r.kind === "world" && r.route === "set");
  switch (r.kind) {
    case "world":
      if (r.route === "epic") return isCreatureSet(s) && tl.worlds?.[s.set.slice(9)]?.creature === r.species;
      if (r.route === "builder") return s.world === r.needId || /^world:/.test(s.set ?? "") || s.set === r.set || ["street", "woods", "bedroom", "school"].includes(s.set) || isCreatureSet(s);
      return true; // a hand-built set: the place words themselves are checkVisuals' business
    case "cast":
      if (r.route === "kit" && r.kitName === "person") return actors.some((a) => a.id === r.id || a.hold === r.id);
      return objHit || badge;
    case "creature":
      if (r.worldCreature) return isCreatureSet(s) && tl.worlds?.[s.set.slice(9)]?.creature === r.species || giants.some((g) => g.id === "world");
      if (r.giant) return giants.some((g) => g.id === r.id);
      if (String(r.kitName ?? "").startsWith("monster:")) return !!s.monsterState;
      return objHit || badge || giants.some((g) => g.id === r.id);
    case "crowd":
      if (crowds.some((c) => c.item === r.id)) return true;
      if (r.memberGiant && giants.some((g) => g.id === r.memberGiant)) return true;
      if (r.memberKit && objs.some((o) => o.name === r.memberKit)) return true;
      if (!r.crowdKind && r.route !== "card") return actors.length >= 3 || objHit;
      return false;
    case "prop": case "vehicle":
      if (String(r.kitName ?? "").startsWith("held:")) { const h = r.kitName.slice(5); return actors.some((a) => a.hold === h || NW(a.hold).some((w) => name.includes(w))) || objs.some((o) => o.name === "item" && o.state === h) || objHit || badge; }
      if (r.kitName === "bus (street set)") return s.set === "street" || badge;
      return objHit || actors.some((a) => a.hold && NW(a.hold).some((w) => name.includes(w) || name.includes(sing(w)))) || badge;
    case "effect": case "event":
      if (r.kitName === "light:night") return s.light === "night";
      if (r.kitName === "marker:ring") return markersOf(s).some((m) => m.kind === "ring");
      if (r.kitName && objs.some((o) => o.name === r.kitName)) return true;
      return badge || (r.kind === "event" && /shake|quake/.test(r.name) && (!!s.beat || !!s.shake));
    default:
      return objHit || badge;
  }
}

/** STRICT production check: [{ line, text, missing: [{ id, kind, name, route }] }] for every line missing an item */
export function checkProduction(tl, prod = tl?.production) {
  const out = [];
  if (!prod?.perLine) return out;
  const shots = tl.shots ?? [];
  for (const L of prod.perLine) {
    const mine = shots.filter((s) => (s.lines ?? [s.line]).includes(L.line));
    const missing = (L.required ?? []).filter((r) => !mine.some((s) => onScreen(r, s, tl))).map((r) => ({ id: r.id, kind: r.kind, name: r.name, route: r.route }));
    if (missing.length) out.push({ line: L.line, text: tl.lines?.[L.line]?.text ?? "", missing });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ 5. re-plan a miss
/**
 * Every item still missing goes into the line's best shot by its own system (kit object, hand prop, actor, EPIC giant /
 * crowd, the world), else a picture card of that very thing is cut into the line (aux.card(shots, lineIdx, card,
 * need?) -> bool), else a badge. -> [{ line, id, how }]
 */
export function fixProduction(tl, D, aux) {
  const done = [];
  const prod = tl.production;
  for (let pass = 0; pass < 2; pass++) {
    const miss = checkProduction(tl, prod);
    if (!miss.length) break;
    for (const m of miss) {
      const L = prod.perLine[m.line];
      for (const mi of m.missing) {
        const r = L.required.find((x) => x.id === mi.id);
        const mine = tl.shots.filter((s) => (s.lines ?? [s.line]).includes(m.line) && s.camera !== "insert");
        const host = mine.find((s) => s.line === m.line) ?? mine[0];
        if (!host) continue;
        let how = null;
        const freeSpot = () => { const t = new Set([...(host.actors ?? []).map((a) => a.spot), ...(host.objects ?? []).map((o) => o.spot)]); return ["center", "left", "right", "back", "door", "far"].find((x) => !t.has(x)) ?? "far"; };
        if (pass === 0) {
          if (r.kind === "cast" && r.kitName === "person" && (host.actors ?? []).length < 4) {
            host.actors = [...(host.actors ?? []), { id: r.id, spot: freeSpot(), pose: "stand", expr: "neutral", facing: host.giants?.find((g) => g.id !== "world")?.id ?? "camera", hold: null }];
            aux.used.add(r.id); how = "actor";
            if (EPIC_CAMERAS.includes(host.camera) && host.camera !== "hero_low" && (host.giants?.length || host.crowds?.length)) { host.camera = "hero_low"; host.focus = r.id; }
          } else if (r.giant && D?.giants[r.id] && !(isCreatureSet(host) && tl.worlds[host.set.slice(9)]?.view === "inside")) {
            host.giants = [...(host.giants ?? []), { id: r.id, spot: "far", action: "idle", facing: "camera", aliases: D.giants[r.id].aliases }]; how = "giant";
          } else if (r.kind === "crowd" && r.crowdKind && D?.crowds[r.id]) {
            const c = D.crowds[r.id];
            host.crowds = [...(host.crowds ?? []), { kind: c.kind, count: Math.min(c.count, 120), formation: c.town ? "scatter" : "block", action: "stand", spot: "back", facing: "camera", seed: (hashSeed(r.id) % 40) + 2, item: r.id, aliases: c.aliases, ...(c.town ? { spacing: 2.2 } : {}), ...(isCreatureSet(host) && tl.worlds[host.set.slice(9)]?.view === "on" ? { onWorld: true } : {}) }];
            if (isCreatureSet(host) && tl.worlds[host.set.slice(9)]?.view === "inside" && !c.town) { delete host.crowds; how = null; }
            else { how = "crowd"; if (c.town) host.actors = (host.actors ?? []).filter((a) => !/^town\d$/.test(a.id)); }
          } else if (r.memberGiant && D?.giants[r.memberGiant] && !(isCreatureSet(host) && tl.worlds[host.set.slice(9)]?.view === "inside")) {
            host.giants = [...(host.giants ?? []), { id: r.memberGiant, spot: "far", action: "idle", facing: "camera", aliases: D.giants[r.memberGiant].aliases }]; how = "giant";
          } else if (r.kitName === "marker:ring") {
            const a = (host.actors ?? []).find((x) => x.id === host.subject) ?? (host.actors ?? [])[0];
            if (a) { const ms = [...(host.markers ?? []), ...(host.marker ? [host.marker] : [])].filter((m, i, l) => l.findIndex((x) => x.on === m.on && x.text === m.text) === i); ms.push({ on: a.id, kind: "ring", text: "" }); if (ms.length > 1) host.markers = ms; host.marker = ms[0]; how = "ring"; }
          } else if (r.memberKit && (host.objects ?? []).length < 3) {
            host.objects = [...(host.objects ?? []), { name: r.memberKit, spot: freeSpot(), facing: "camera" }]; how = "member";
          } else if (r.kitName && String(r.kitName).startsWith("held:")) {
            const a = (host.actors ?? []).find((x) => !x.hold && x.id === host.subject) ?? (host.actors ?? []).find((x) => !x.hold);
            if (a) { a.hold = r.kitName.slice(5); if (!["blow", "yell", "point", "sit", "run", "walk"].includes(a.pose)) a.pose = "carry"; how = "hold"; }
          } else if (r.kitName === "light:night") { host.light = "night"; how = "light"; }
          else if (r.kitName && aux.isObject(r.kitName) && (host.objects ?? []).length < 3 && !(host.objects ?? []).some((o) => o.name === r.kitName)) {
            host.objects = [...(host.objects ?? []), { name: r.kitName, spot: freeSpot(), facing: "camera", ...(aux.stateOf?.(r) ? { state: aux.stateOf(r) } : {}) }]; how = "object";
            if (EPIC_CAMERAS.includes(host.camera) && !["hero_low"].includes(host.camera)) { /* an EPIC wide still shows the ground */ }
          } else if (r.kind === "world" && r.route === "epic" && D?.lines[m.line]?.creatureWorld) {
            const wc = D.lines[m.line].creatureWorld;
            host.worldBase ??= host.set; host.set = `creature:${worldId(tl, wc, wc.relation === "outside" ? "outside" : wc.relation, false)}`; how = "world";
          }
        }
        if (!how) {
          const card = r.card ?? { kind: "card", text: String(r.name ?? r.id).toUpperCase().replace(/[^A-Z0-9' ]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ") || "?", icon: "✨" };
          if (aux.card(tl.shots, m.line, card, r)) how = "card";
          else if (aux.badge(host, card)) how = "badge";
        }
        if (how) done.push({ line: m.line, id: r.id, how });
      }
    }
  }
  return done;
}
