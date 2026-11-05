// Blocky Worlds director: the MATCHER. A production list -> what each item becomes on screen:
//   calls     one per item: the capability it uses, the parameters asked, its status today, and its route:
//               "set"      one of the 4 hand-built sets              "kit"     a kit object / prop / animal / monster look
//               "builder"  a need for lib/builder resolveNeeds        "epic"    an EPIC system that has landed on disk
//               "card"     the last resort: a clear picture card of that very thing
//   builderNeeds  needs in resolveNeeds' shape ({ id, kind: object | world, name, phrase, line, lineText, mood,
//                 fallbackSet } + source "director", item, hint): the builder makes them, or they become cards
//   gaps      every request no system can meet yet: { capability, item, itemKind, name, detail, line, lineText }
//   perLine   for every script line: the items it must show and how each one gets on screen (the planner's checklist)
//   summary   counts
// Never throws: an item nobody understands becomes a card + a gap. No special cases: a turtle city and a wolf army
// come out of the same rules (world.creature + giant + crowd + camera.*).
import { supports, capability } from "../capabilities.js";
import { itemsOf } from "./spec.js";
import { OBJECT_CATALOG, heldKind, objectForNoun, iconFor } from "../visuals.js";
import { ANIMALS, CREATURE_OBJECTS, creatureFor } from "../catalog.js";
import { phraseIndex, findPhrases, VEHICLE_WORDS, ACTION_WORDS, POSES_N } from "./vocab.js";
import { cardLabel } from "../planText.js";

// the settings the 4 hand-built sets show well (a copy of plan.mjs SET_FITS: keep in step)
const SET_FITS = /\b(suburb|street|streets|town square|square|snowy town|neighbou?rhood|village|downtown|main street|road|park|house|home|bedroom|kitchen|living room|attic|basement|apartment|school|classroom|hallway|cafeteria|stage|gym|woods?|forest|farm|canyon|cliff|mountain|trail|castle|town|city)\b/;
const VEHICLE_INDEX = phraseIndex(VEHICLE_WORDS);
const EFFECT_CAP = { fire: ["fx.fire", {}], explosion: ["fx.explosion", {}], glow: ["fx.glow", { kind: "glow" }], sparkles: ["fx.glow", { kind: "sparkles" }], magic: ["fx.glow", { kind: "spell" }],
  transformation: ["fx.transformation", { kind: "morph" }], grow: ["fx.transformation", { kind: "grow" }], shrink: ["fx.transformation", { kind: "shrink" }], vanish: ["fx.transformation", { kind: "vanish" }], appear: ["fx.transformation", { kind: "appear" }],
  smoke: ["weather.event", { kind: "fog" }] };
const EVENT_KIT = { rain: "cloud", snow: "snow_pile", storm: "cloud", fog: "fog_bank", wind: "wind_gust" };
const EVENT_STATE = { rain: "rain", storm: "storm", snow: "on" };
const SKY_EVENTS = new Set(["falling", "eclipse", "meteor"]);
const FX_ICON = { fire: "🔥", explosion: "💥", glow: "✨", sparkles: "✨", magic: "🪄", transformation: "🔄", grow: "⬆️", shrink: "⬇️", vanish: "💨", appear: "✨", smoke: "💨",
  rain: "🌧️", snow: "❄️", storm: "⛈️", fog: "🌫️", wind: "🌬️", lightning: "⚡", flood: "🌊", earthquake: "🫨", eruption: "🌋", tornado: "🌪️", falling: "☄️", eclipse: "🌑", meteor: "☄️", heatwave: "🥵", hail: "🧊", night_falls: "🌙" };
const ENCLOSURE_OF = { enclosed: "cave", underwater: "underwater", space: "space", sky: "sky" };

const words = (s) => String(s ?? "").toLowerCase().replace(/[^a-z' -]/g, " ").split(/[\s-]+/).filter(Boolean);
const label = (s) => cardLabel(s);
/**
 * The EPIC crowd kind closest to what was asked: a kind EPIC has stays; a crowd whose id / name says army (soldiers,
 * troops, guards, warriors) is "soldier" whatever its members are made of (robot soldiers); people-like members are
 * "townsfolk"; anything else stays as asked (no EPIC kind: the members' kit object or a picture card shows it).
 */
export function nearestCrowdKind(kind, words = "") {
  if (["townsfolk", "soldier", "knight", "wolf_soldier", "kid"].includes(kind)) return kind;
  const w = ` ${String(words).toLowerCase().replace(/[^a-z]+/g, " ")} `;
  if (/ knights? /.test(w)) return "knight";
  if (/ (soldiers?|army|armies|troops?|guards?|warriors?|legion|regiment|marchers) /.test(w)) return "soldier";
  if (/^(people|person|human|humans|man|men|woman|women|villager|villagers|townsfolk|citizens?|kids?|children|students?)$/.test(String(kind ?? ""))) return "townsfolk";
  return kind;
}
const cardOf = (name, key = null) => ({ kind: "card", text: label(name) || "?", icon: FX_ICON[key] ?? words(name).map((w) => iconFor(w)).find((i) => i !== "✨") ?? "✨" });

/** The Node view of the kit: a scene object / hand prop / animal / creature look by name (whole name, then head noun). */
export function nodeKit() {
  const objectFor = (name) => {
    const ws = words(name);
    if (!ws.length) return null;
    const joined = ws.join(" "), under = ws.join("_");
    if (OBJECT_CATALOG[under]) return { name: under, via: "name" };
    for (const [k, o] of Object.entries(OBJECT_CATALOG)) if ((o.aliases ?? []).includes(joined)) return { name: k, via: "alias" };
    const head = objectForNoun(ws.at(-1));
    return head ? { name: head, via: ws.length > 1 ? "head noun" : "noun" } : null;
  };
  const heldFor = (name) => { const ws = words(name); const h = heldKind(ws.join(" ")) ?? heldKind(ws.at(-1)); return h ? { name: h } : null; };
  const animalFor = (species) => { for (const w of words(species).reverse()) for (const [k, al] of Object.entries(ANIMALS)) if (k === w || al.includes(w)) return k; return null; };
  const smallCreatureFor = (name) => { for (const w of words(name).reverse()) for (const [k, al] of Object.entries(CREATURE_OBJECTS)) if (k === w || al.includes(w)) return `${k}_creature`; return null; };
  const lookFor = (name, about = "") => creatureFor(words(name), about);
  return { objectFor, heldFor, animalFor, smallCreatureFor, lookFor };
}

/**
 * matchProduction(production, { kit, exists, script, mood, idea }) -> { calls, builderNeeds, gaps, perLine, summary }
 *   exists(relPath) -> bool: which EPIC / BUILDER files have landed (installedStatus); default: nothing extra
 */
export function matchProduction(production, { kit = nodeKit(), exists = () => false, script = null, mood = "horror", idea = null } = {}) {
  const p = production;
  const lineText = (i) => script?.lines?.[i]?.text ?? "";
  const firstLine = new Map();
  for (const l of p.lines) for (const id of [l.world, l.subject, ...l.who, ...l.needs]) if (id && !firstLine.has(id)) firstLine.set(id, l.line);
  const worldOfLine = (i) => p.worlds.find((w) => w.id === p.lines[i]?.world) ?? p.worlds[0];
  const calls = new Map(), builderNeeds = [], gaps = [];
  const landed = (capId) => { const fl = capability(capId)?.files ?? []; return fl.length > 0 && fl.every((f) => exists(f)); };

  const need = (kind, name, item, extra = {}) => {
    const line = firstLine.get(item.id) ?? 0;
    const n = { id: `dir${builderNeeds.length + 1}`, kind, name: String(name).toLowerCase().slice(0, 60), phrase: String(name).toLowerCase().slice(0, 60), line, lineText: lineText(line), mood, fallbackSet: worldOfLine(line).base, source: "director", item: item.id, ...extra };
    builderNeeds.push(n);
    return n;
  };
  const gap = (capId, item, itemKind, name, detail) => {
    const line = firstLine.get(item.id) ?? null;
    gaps.push({ capability: capId, item: item.id, itemKind, name: String(name || item.id), detail: detail || capability(capId)?.status || "planned", line, lineText: line == null ? "" : lineText(line) });
  };
  /** check a capability with params; log one gap per unsupported param (or the capability itself when planned) */
  const ask = (capId, params, item, itemKind, name) => {
    const s = supports(capId, params);
    const status = s.status === "planned" && !s.unsupported.length && landed(capId) ? "partial" : s.status;
    if (s.unsupported.length) for (const u of s.unsupported) gap(capId, item, itemKind, name, u);
    else if (status === "planned") gap(capId, item, itemKind, name, "planned");
    return { capability: capId, params, status: s.unsupported.length ? "planned" : status, unsupported: s.unsupported };
  };
  const put = (item, kind, name, c) => calls.set(item.id, { item: item.id, kind, name, ...c });

  // ---------------------------------------------------------------- worlds
  let builtWorlds = 0;
  for (const w of p.worlds) {
    const name = w.name || "the town";
    if (w.kind === "outdoor" || w.kind === "indoor") {
      const capId = w.kind === "outdoor" ? "world.outdoor" : "world.indoor";
      if (!w.name || SET_FITS.test(name.toLowerCase())) { put(w, "world", name, { ...ask(capId, { set: w.base, light: w.light }, w, "world", name), route: "set", set: w.base }); continue; }
      const n = need("world", name, w, { hint: { kind: w.kind, description: w.description } });
      builtWorlds++;
      put(w, "world", name, { ...ask(capId, { set: "built", light: w.light }, w, "world", name), route: "builder", needId: n.id, set: w.base, fallback: `the ${w.base} set` });
    } else if (w.kind === "creature") {
      const rel = w.creature.relation === "none" ? "on" : w.creature.relation;
      const c = ask("world.creature", { relation: rel, species: w.creature.species || "turtle", scaleM: w.creature.heightM || 60 }, w, "world", name);
      // EPIC builds it (creatureWorld.js takes { creature, view } or the builder's creature_world spec); the builder need
      // is sent only when EPIC is not there, so the builder's inside_creature enclosure stands in
      const epic = landed("world.creature");
      const n = epic ? null : need("world", name, w, { hint: { kind: "creature_world", description: w.description, creature: { species: w.creature.species || "turtle", scale: w.creature.heightM || 60, city: rel === "inside" ? "inside" : "on" } } });
      builtWorlds++;
      const route = epic ? "epic" : "builder";
      put(w, "world", name, { ...c, route, ...(n ? { needId: n.id } : {}), ...(epic ? { epic: { creature: w.creature.species || "turtle", view: rel, size: w.creature.heightM || 120 } } : {}), set: w.base, fallback: rel === "inside" ? "a built inside_creature enclosure" : `the ${w.base} set + a picture card of the ${w.creature.species || "creature"}`, card: rel === "inside" ? null : cardOf(w.creature.species || name) });
    } else {
      const enclosure = ENCLOSURE_OF[w.kind] ?? "cave";
      const c = ask("world.enclosed", { enclosure }, w, "world", name);
      const n = need("world", name, w, { hint: { kind: "enclosure", enclosure, description: w.description } });
      builtWorlds++;
      put(w, "world", name, { ...c, route: "builder", needId: n.id, set: w.base, fallback: `the ${w.base} set + a picture card of the place`, card: cardOf(name) });
    }
  }
  if (p.worlds.length > 1 || builtWorlds > 1) {
    // the views of one creature (inside / on / outside the same turtle) are one creature world, not several built places
    const distinctBuilt = new Set(p.worlds.filter((w) => !((w.kind === "outdoor" || w.kind === "indoor") && (!w.name || SET_FITS.test(w.name.toLowerCase())))).map((w) => (w.kind === "creature" ? `creature:${w.creature.species}` : `${w.kind}:${w.name}`))).size;
    const s = supports("world.travel", { worlds: p.worlds.length, built: distinctBuilt });
    for (const u of s.unsupported) gap("world.travel", p.worlds[1] ?? p.worlds[0], "world", p.worlds.map((w) => w.name).join(" + "), u);
  }

  // ---------------------------------------------------------------- one thing that has to be a visible object
  const asObject = (item, kind, name, capIfKit, paramsIfKit = {}) => {
    const k = kit.objectFor(name);
    if (k) return put(item, kind, name, { ...ask(capIfKit, paramsIfKit, item, kind, name), route: "kit", kitName: k.name, via: k.via });
    const n = need("object", name, item, {});
    put(item, kind, name, { ...ask("object.built", { name }, item, kind, name), route: "builder", needId: n.id, card: cardOf(name) });
  };

  // ---------------------------------------------------------------- cast
  for (const c of p.cast) {
    const name = c.name || c.job || c.id;
    if (c.kind === "human") { put(c, "cast", name, { ...ask("character", { role: c.role }, c, "cast", name), route: "kit", kitName: "person" }); continue; }
    // a robot / creature / animal / talking object in the cast: the thing itself (robot dentist -> robot + dentist hint)
    const thing = [c.kind === "robot" ? "robot" : "", c.look, c.job, c.name].filter(Boolean).join(" ");
    const small = kit.smallCreatureFor(`${c.kind} ${c.look} ${c.name}`) ?? (c.kind === "animal" ? kit.animalFor(`${c.look} ${c.name}`) : null);
    const full = [c.kind === "robot" ? "robot" : c.look, c.job].filter(Boolean).join(" ").trim() || name;
    if (small && !c.job) { put(c, "cast", name, { ...ask(c.kind === "animal" ? "creature.animal" : "creature.small", {}, c, "cast", name), route: "kit", kitName: small }); continue; }
    asObject(c, "cast", full || thing, "object.built");
  }

  // ---------------------------------------------------------------- creatures
  for (const cr of p.creatures) {
    const name = cr.name || cr.species;
    const giant = ["giant", "colossal"].includes(cr.scale) || cr.heightM > 5;
    if (giant) {
      const species = /^(human|man|woman|person|people|giant|giants|titan)$/.test(cr.species) ? "human" : cr.species;
      const c = ask("giant", { species, behaviour: cr.behaviours.filter((b) => b !== "stand" && b !== "idle"), heightM: cr.heightM || (cr.scale === "colossal" ? 100 : 25) }, cr, "creature", name);
      if (landed("giant")) { put(cr, "creature", name, { ...c, route: "epic", epic: { kind: species === "human" ? "giant_human" : species, size: cr.heightM || (cr.scale === "colossal" ? 100 : 25), actions: cr.behaviours } }); continue; }
      // today: a static giant blueprint from the builder (spec.js allows giant: true up to 200 m), else a card
      const n = need("object", cr.species || name, cr, { giant: true, heightM: cr.heightM || (cr.scale === "colossal" ? 100 : 25) });
      put(cr, "creature", name, { ...c, route: "builder", needId: n.id, fallback: "a static giant blueprint far off, low camera", card: cardOf(cr.species || name) });
      continue;
    }
    if (cr.monster) {
      const look = kit.lookFor(name, `${cr.species} ${cr.look}`) ?? kit.lookFor(cr.species);
      const c = ask("creature.monster", { behaviour: cr.behaviours.filter((b) => !["stand", "idle"].includes(b)), scale: cr.scale === "tiny" || cr.scale === "small" ? "human" : cr.scale }, cr, "creature", name);
      put(cr, "creature", name, { ...c, route: "kit", kitName: `monster:${look ?? (/(furry|hairy|fur|big)/.test(cr.look) ? "furry" : "tall")}`, look });
      continue;
    }
    const animal = kit.animalFor(cr.species) ?? kit.animalFor(name);
    const small = animal ? null : kit.smallCreatureFor(`${cr.species} ${name}`);
    const capId = animal ? "creature.animal" : small ? "creature.small" : "creature.animal";
    const params = capId === "creature.animal" ? { behaviour: cr.behaviours, count: cr.count } : {};
    if (animal || small) { put(cr, "creature", name, { ...ask(capId, params, cr, "creature", name), route: "kit", kitName: animal ?? small }); continue; }
    const n = need("object", cr.species || name, cr, {});
    const c = ask("creature.built", { behaviour: cr.behaviours }, cr, "creature", name);
    put(cr, "creature", name, { ...c, route: "builder", needId: n.id, card: cardOf(cr.species || name) });
  }

  // ---------------------------------------------------------------- crowds
  for (const cw of p.crowds) {
    // a crowd the director left unnamed is called by its id ("soldiers"), never "crowd": its card / badge must say what it is
    const name = cw.name || cw.of || String(cw.id ?? "").replace(/_/g, " ").trim() || "crowd";
    const member = cw.of ? calls.get(cw.of) : null;
    const species = cw.of ? (p.creatures.find((x) => x.id === cw.of)?.species ?? cw.of) : "";
    // EPIC's crowd kinds: townsfolk | soldier | knight | wolf_soldier; anything else is asked for by name (a gap)
    const kind = cw.member === "person" ? (/knight/.test(name) ? "knight" : /soldier|army|troop|guard/.test(name) ? "soldier" : /kid|kids|children|students|class/.test(name) ? "kid" : "townsfolk")
      : cw.member === "creature" ? (species === "wolf" ? "wolf_soldier" : (species || "creature")) : cw.member;
    const c = ask("crowd", { kind, action: cw.actions, count: cw.count }, cw, "crowd", name);
    const route = landed("crowd") ? "epic" : "kit";
    // the gap keeps the kind asked for (robot); the plan shows the nearest crowd EPIC has (an army of robot soldiers is
    // an army), else the members / a card (THE PERMANENT RULE: a missing kind never fails a run; run 707609b1)
    put(cw, "crowd", name, { ...c, route, crowdKind: nearestCrowdKind(kind, `${cw.id ?? ""} ${name}`), ...(nearestCrowdKind(kind, `${cw.id ?? ""} ${name}`) !== kind ? { askedKind: kind } : {}), of: cw.of || null, memberRoute: member?.route ?? (cw.member === "person" ? "kit" : null), fallback: cw.member === "person" ? `a group of up to 6 + a x${cw.count} badge` : `3 copies of the ${member?.kitName ?? cw.of ?? "member"} + a x${cw.count} badge` });
  }

  // ---------------------------------------------------------------- vehicles
  for (const v of p.vehicles) {
    const name = v.name || v.kind;
    const kind = findPhrases(VEHICLE_INDEX, ` ${String(v.kind || name).toLowerCase()} `)[0]?.key ?? (String(v.kind || name).toLowerCase().split(" ").at(-1));
    const c = ask("vehicle", { kind, motion: v.motion }, v, "vehicle", name);
    if (v.motion === "fly" || v.motion === "launch") ask("flying", { who: "vehicle" }, v, "vehicle", name);
    const k = kit.objectFor(name) ?? kit.objectFor(kind);
    if (k) { put(v, "vehicle", name, { ...c, route: "kit", kitName: k.name }); continue; }
    if (kind === "bus") { put(v, "vehicle", name, { ...c, route: "set", set: "street", kitName: "bus (street set)" }); continue; }
    const n = need("object", name, v, {});
    put(v, "vehicle", name, { ...c, route: "builder", needId: n.id, card: cardOf(name) });
  }

  // ---------------------------------------------------------------- props
  for (const pr of p.props) {
    const name = pr.name || pr.id;
    if (pr.size === "hand" || pr.heldBy) {
      const h = kit.heldFor(name);
      if (h) { put(pr, "prop", name, { ...ask("prop.held", { name }, pr, "prop", name), route: "kit", kitName: `held:${h.name}`, heldBy: pr.heldBy || null }); continue; }
    }
    asObject(pr, "prop", name, "object");
  }

  // ---------------------------------------------------------------- effects
  for (const f of p.effects) {
    const [capId, params] = EFFECT_CAP[f.kind] ?? ["fx.glow", { kind: f.kind }];
    const name = `${f.kind}${f.target ? ` (${f.target})` : ""}`;
    const c = ask(capId, params, f, "effect", name);
    if (f.kind === "smoke") { put(f, "effect", name, { ...c, route: "kit", kitName: "fog_bank" }); continue; }
    if (c.status === "ready" || c.status === "partial") { put(f, "effect", name, { ...c, route: "kit", kitName: f.kind === "glow" ? "marker:ring" : "marker:ring" }); continue; }
    // transformation: the AFTER form must exist (cheese, a frog, stone) -> the kit or the builder makes it
    if (f.into) { const k = kit.objectFor(f.into) ?? kit.heldFor(f.into); if (!k) need("object", f.into, f, {}); }
    put(f, "effect", name, { ...c, route: "card", card: cardOf(f.kind === "transformation" && f.into ? `${f.target} into ${f.into}` : `${f.kind} ${f.target}`, f.kind) });
  }

  // ---------------------------------------------------------------- events
  for (const e of p.events) {
    const name = e.what || e.kind;
    if (SKY_EVENTS.has(e.kind)) {
      const c = ask("event.sky", { kind: e.kind }, e, "event", name);
      const what = e.what && e.kind === "falling" ? e.what.replace(/\b(falls?|fell|falling|from the sky|into .*)\b/g, "").trim() : "";
      const k = what ? kit.objectFor(what) : null;
      if (what && !k) need("object", what, e, {});
      put(e, "event", name, { ...c, route: "card", card: cardOf(name, e.kind), thing: k?.name ?? (what || null) });
      continue;
    }
    if (e.kind === "night_falls") { put(e, "event", name, { ...ask("light", { light: "night" }, e, "event", name), route: "kit", kitName: "light:night" }); continue; }
    const c = ask("weather.event", { kind: e.kind, scope: e.scope }, e, "event", name);
    const kitName = EVENT_KIT[e.kind];
    if (kitName) put(e, "event", name, { ...c, route: "kit", kitName, state: EVENT_STATE[e.kind] ?? "on" });
    else put(e, "event", name, { ...c, route: "card", card: cardOf(name, e.kind) });
  }

  // ---------------------------------------------------------------- per line: actions, camera beats
  const lineAsks = [];
  for (const l of p.lines) {
    const subj = p.cast.find((c) => c.id === l.subject && c.kind === "human");
    const extras = [];
    // the verb belongs to a person only when nothing else on the line does it ("our bus flew": the bus flies)
    const doneByThing = l.needs.some((id) => { const v = p.vehicles.find((x) => x.id === id); const cr = p.creatures.find((x) => x.id === id) ?? p.crowds.find((x) => x.id === id);
      return (v && v.motion !== "parked" && ["fly", "drive", "ride"].includes(l.action)) || (cr && [...(cr.behaviours ?? []), ...(cr.actions ?? [])].includes(l.action)); });
    if (subj && !doneByThing && l.action && !POSES_N.includes(l.action) && ACTION_WORDS[l.action]) {
      const s = supports("character.action", { action: l.action });
      if (s.unsupported.length) { gaps.push({ capability: "character.action", item: subj.id, itemKind: "cast", name: `${subj.name || subj.id} ${l.action}`, detail: s.unsupported[0], line: l.line, lineText: lineText(l.line) }); extras.push({ capability: "character.action", status: "planned", detail: s.unsupported[0], fallback: capability("character.action").fallback }); }
    }
    // the beat the line's own items imply: a stomping giant, a charging crowd, an explosion, an earthquake
    const here = [l.subject, ...l.needs].map((id) => p.creatures.find((x) => x.id === id) ?? p.crowds.find((x) => x.id === id) ?? p.effects.find((x) => x.id === id) ?? p.events.find((x) => x.id === id)).filter(Boolean);
    const acts = here.flatMap((x) => [...(x.behaviours ?? []), ...(x.actions ?? []), x.kind ?? ""]);
    const pick = (list, d) => list.find((a) => acts.includes(a)) ?? d;
    const beat = { shake: ["camera.shake", { preset: acts.includes("explosion") ? "impact" : pick(["stomp", "roar", "fall"], acts.includes("earthquake") ? "rumble" : "impact") }],
      action: ["camera.action", { beat: pick(["charge", "chase", "attack", "flee", "march", "cheer", "stomp", "roar"], acts.includes("fight") ? "fight" : "charge") }],
      reveal: ["camera.scale", { move: "giant_close" }], scale: ["camera.scale", { move: here.some((x) => ["giant", "colossal"].includes(x.scale)) || l.world !== p.worlds[0]?.id || p.worlds[0]?.kind === "creature" ? "establish" : "low" }] }[l.camera];
    if (beat) {
      const [capId, params] = beat;
      const s = supports(capId, params);
      const st = s.unsupported.length ? "planned" : s.status === "planned" && landed(capId) ? "partial" : s.status;
      if (s.unsupported.length || st === "planned") gaps.push({ capability: capId, item: `line${l.line}`, itemKind: "camera", name: l.camera, detail: s.unsupported[0] ?? "planned", line: l.line, lineText: lineText(l.line) });
      extras.push({ capability: capId, status: st, params, route: st !== "planned" && landed(capId) ? "epic" : "fallback", fallback: capability(capId).fallback });
    }
    lineAsks.push(extras);
  }

  // ---------------------------------------------------------------- the planner's checklist per line
  const perLine = p.lines.map((l, i) => {
    const ids = [...new Set([l.world, l.subject, ...l.who, ...l.needs].filter(Boolean))];
    const required = ids.map((id) => {
      const c = calls.get(id);
      if (!c) return { id, route: "card", status: "planned", card: cardOf(id) };
      return { id, kind: c.kind, name: c.name, capability: c.capability, status: c.status, route: c.route, ...(c.kitName ? { kitName: c.kitName } : {}), ...(c.set ? { set: c.set } : {}), ...(c.needId ? { needId: c.needId } : {}), ...(c.card ? { card: c.card } : {}), ...(c.unsupported?.length ? { unsupported: c.unsupported } : {}) };
    });
    return { line: l.line, text: lineText(l.line), world: l.world, subject: l.subject, action: l.action, camera: l.camera, light: l.light, required, extras: lineAsks[i] };
  });

  const all = [...calls.values()];
  const count = (f) => all.reduce((m, c) => ((m[f(c)] = (m[f(c)] ?? 0) + 1), m), {});
  const req = perLine.flatMap((l) => l.required);
  const summary = {
    items: all.length, byStatus: count((c) => c.status), byRoute: count((c) => c.route), builderNeeds: builderNeeds.length, gaps: gaps.length,
    gapCapabilities: [...new Set(gaps.map((g) => g.capability))],
    lineItems: req.length, lineItemsCard: req.filter((r) => r.route === "card").length,
    // share of what the lines need that a real system shows today (set, kit, epic) or can build now (builder)
    shownShare: req.length ? Number((req.filter((r) => r.route !== "card").length / req.length).toFixed(3)) : 1,
    // ...and of those, met in full (no planned parameter: the wolves are there AND charging)
    fullShare: req.length ? Number((req.filter((r) => r.route !== "card" && r.status !== "planned").length / req.length).toFixed(3)) : 1,
  };
  return { calls: all, builderNeeds, gaps, perLine, summary };
}
