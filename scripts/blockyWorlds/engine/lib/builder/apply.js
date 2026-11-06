// Blocky Worlds builder: from a planned timeline to its needs, and the resolved needs back into the timeline.
//   needsFromTimeline(tl, { kit }) -> needs        tl.needs (plan.mjs collectNeeds) + any object on screen the kit can't
//                                                   build (a safety net: it becomes a need instead of KIT_MISSING)
//   applyResolved(tl, needs, results, { check }) -> { applied, reverted, cards }
//     object need on a picture card (shot.need): built / library / kit -> the card gives its time back to the shot it
//       was cut from and the object stands in that shot (as plan.mjs forceKey does for a kit object); else the card stays
//     object need on an object the kit lacks: the object becomes the built asset; else it goes and, if it was what the
//       shot showed, the shot becomes the card
//     world need: every shot with shot.world -> set "world:<asset id>" (+ worldAliases); else the fallback set stays
//   The PERMANENT RULE holds: after each need is applied, `check(tl)` (checkTimeline + checkVisuals + checkSubjects)
//   runs; if the change added a problem it is undone (the card / the fallback stays). The checks run again in the
//   prepare job before any render, as always.
// The timeline gets `assets`: { [asset id]: { kind, name, aliases, blueprint | spec } } (the engine builds from it).

import { ANIMAL_STATES } from "../catalog.js";
import { badgeWord } from "../planText.js";
import { openingRule } from "../opening.js";
const clone = (o) => JSON.parse(JSON.stringify(o));
const FREE_SPOTS = ["center", "left", "right", "back", "door", "far"];
const freeSpot = (s) => { const taken = new Set([...(s.actors ?? []).map((a) => a.spot), ...(s.objects ?? []).map((o) => o.spot)]); return FREE_SPOTS.find((x) => !taken.has(x)) ?? "far"; };

export function needsFromTimeline(tl, { kit = null } = {}) {
  const needs = [...(tl.needs ?? [])];
  let k = 0;
  (tl.shots ?? []).forEach((s) => {
    for (const o of s.objects ?? []) {
      if (o.asset || !kit?.resolveObject || kit.resolveObject(o.name)) continue;
      const id = `kitneed${++k}`;
      needs.push({ id, kind: "object", name: String(o.name).replace(/_/g, " "), phrase: String(o.name).replace(/_/g, " "), line: s.line, lineText: s.text ?? "", fallbackSet: s.set, onObject: true });
      o.needId = id;
    }
  });
  return needs;
}

/** the timeline entry of a built / library asset */
function addAsset(tl, a) {
  tl.assets ??= {};
  const id = String(a.id);
  tl.assets[id] ??= a.kind === "world" ? { kind: "world", name: a.name, aliases: a.aliases ?? [], spec: a.blueprint } : { kind: "object", name: a.name, aliases: a.aliases ?? [], blueprint: a.blueprint };
  return id;
}

/** the card shots that stand for this need: its own (shot.need) and any other card with its name (a built thing is
 *  shown as itself everywhere: turtle run 1620fc3e built the garden hose, yet two later "GARDEN HOSE" cards stayed) */
function cardsOf(tl, need) {
  const names = new Set([need.name, need.phrase].filter(Boolean).map((x) => String(x).toLowerCase().trim()));
  return tl.shots.filter((s) => s.camera === "insert" && s.insert?.kind === "card" && (s.need?.id === need.id || names.has(String(s.insert.text ?? "").toLowerCase().trim())));
}
/** the object entry of a resolved need */
function objectOf(tl, need, r, host) {
  return r.source === "kit" ? { name: r.kitName, spot: freeSpot(host), facing: "camera" }
    : { name: need.name, asset: addAsset(tl, r.asset), aliases: r.asset.aliases ?? [], spot: freeSpot(host), facing: "camera" };
}
const SHOW_CAMS = ["closeup", "medium", "wide"];
function applyObjectOnCard(tl, need, r) {
  let any = false;
  for (const card of cardsOf(tl, need)) {
    const shots = tl.shots, i = shots.indexOf(card);
    const hosts = (card.need?.host === "next" ? [i + 1, i - 1] : [i - 1, i + 1]).map((k) => shots[k]).filter(Boolean);
    const host = hosts.find((h) => h.camera !== "insert" && h.line === card.line && (h.objects ?? []).length < 3);
    if (host) { // the card gives its time back to the shot it was cut from; the thing stands in that shot
      const o = objectOf(tl, need, r, host);
      const about = host.subject === `thing:${need.phrase}` || host.subject === `thing:${need.name}`;
      host.objects = about ? [o, ...(host.objects ?? [])] : [...(host.objects ?? []), o];
      if ((host.focus === "group" && !(host.actors ?? []).length) || about) host.focus = "object";
      host.start = Math.min(host.start, card.start); host.end = Math.max(host.end, card.end);
      host.visuals = [...new Set([...(host.visuals ?? []), ...(card.visuals ?? [])])];
      shots.splice(i, 1);
    } else { // no shot of the line to stand in: the card itself becomes a shot of the built thing
      const o = { ...objectOf(tl, need, r, { actors: [], objects: [] }), spot: "center" };
      const prev = shots.slice(Math.max(0, i - 2), i).map((x) => x.camera);
      const next = shots[i + 1]?.camera;
      const camera = SHOW_CAMS.find((c) => !(prev.length === 2 && prev[0] === c && prev[1] === c) && !(prev.at(-1) === c && next === c)) ?? "medium";
      Object.assign(card, { camera, focus: "object", insert: null, actors: [], objects: [o], marker: null, monsterState: null });
      delete card.markers;
    }
    any = true;
  }
  return any;
}
function applyObjectOnShot(tl, need, r) {
  let any = false;
  for (const s of tl.shots) for (const o of s.objects ?? []) {
    if (o.needId !== need.id) continue;
    delete o.needId; any = true;
    if (r.source === "kit") o.name = r.kitName;
    else if (r.source === "built" || r.source === "cache") { o.asset = addAsset(tl, r.asset); o.aliases = r.asset.aliases ?? []; o.name = need.name; if (!ANIMAL_STATES.includes(o.state)) delete o.state; }
    else {
      s.objects = s.objects.filter((x) => x !== o);
      if (s.focus === "object" && !s.objects.length) Object.assign(s, { camera: "insert", focus: "insert", insert: r.card, actors: [], monsterState: null, marker: null });
      else if ((s.actors ?? []).length) { // the thing stays named on screen: a badge over someone (plan.mjs badge)
        const marks = [...(s.markers ?? (s.marker ? [s.marker] : []))], has = new Set(marks.map((m) => m.on));
        const on = s.actors.find((a) => !has.has(a.id))?.id;
        if (on) { marks.push({ on, kind: "icon", text: `${r.card.icon} ${badgeWord(r.card.text)}` }); s.marker = marks[0]; if (marks.length > 1) s.markers = marks; }
      }
    }
  }
  return any;
}
function applyWorld(tl, need, r) {
  let any = false;
  const id = r.source === "built" || r.source === "cache" ? addAsset(tl, r.asset) : null;
  for (const s of tl.shots) {
    if (s.world !== need.id) continue;
    any = true;
    if (id) { s.worldBase = s.set; s.set = `world:${id}`; s.worldAliases = [need.name, ...(r.asset.aliases ?? [])]; }
    delete s.world;
  }
  return any;
}

export function applyResolved(tl, needs, results, { check = null } = {}) {
  const applied = [], reverted = [], cards = [];
  const count = () => (check ? check(tl).length : 0);
  let base = count();
  for (const need of needs) {
    const r = results[need.id];
    if (!r) continue;
    const snap = { shots: clone(tl.shots), assets: clone(tl.assets ?? {}) };
    const usable = r.source !== "card";
    let changed = false;
    if (need.kind === "world") changed = applyWorld(tl, need, usable ? r : { ...r, source: "card" });
    else if (need.onObject) changed = applyObjectOnShot(tl, need, r);
    else if (usable) changed = applyObjectOnCard(tl, need, r);
    if (!usable) { cards.push({ need: need.name, kind: need.kind, reason: r.reason ?? null }); continue; }
    if (!changed) { cards.push({ need: need.name, kind: need.kind, reason: "no place for it in the plan" }); continue; }
    const now = count();
    if (now > base) {
      tl.shots = snap.shots; tl.assets = snap.assets;
      if (need.kind === "world") applyWorld(tl, need, { source: "card" });
      reverted.push({ need: need.name, kind: need.kind, problems: check(tl).length === base ? now - base : null });
      cards.push({ need: need.name, kind: need.kind, reason: "it would break the narration check: the card / fallback stays" });
    } else { applied.push({ need: need.name, kind: need.kind, source: r.source }); base = now; }
  }
  // tidy: the planner's need markers are not engine fields
  for (const s of tl.shots) { if (s.need) delete s.need; if (s.world) delete s.world; for (const o of s.objects ?? []) delete o.needId; }
  if (tl.assets && !Object.keys(tl.assets).length) delete tl.assets;
  // a built object / world may turn a shot into a card again: the opening stays card- and badge-free (lib/opening.js)
  openingRule(tl.shots, { worlds: tl.worlds ?? null });
  return { applied, reverted, cards };
}
