// Blocky Worlds SHOT RECIPES, the executor (owner, 2026-11-08). Over a PLANNED timeline (planVideo's content: who, what,
// where per line, already checked against the narration), a recipe re-directs every line: how many shots, where the
// cuts land (on word starts, ~1-1.5 s), and per shot the recipe slot's camera (distance / height / move / speed) and
// subject (creature, town, threat, narrator, neighbour, crowd, prop, place), its time-of-day rule and reaction faces.
//
// The narration rule stays the guard (PERMANENT): a slot only FRAMES what the line's planned shots already hold (it
// never imports a thing the line does not say); a slot whose subject the line lacks yields to the line's own subject
// and action; and every line's change is kept only when the pre-render checks (checkTimeline, checkVisuals,
// checkSubjects, checkProduction) are no worse than before. Order per line: (A) recut + full slots, (B) recut + the
// line's own framing with the slot's camera (action -> reaction faces), (C) the planned shots unchanged (the closest
// real shot). No cards, badges or inserts are ever made here.
//
//   recipePass(tl, { recipe, check, title }) -> report { id, lines, recut, full, yielded, kept, shotsBefore, shotsAfter }
//   check(tl) -> { timeline, visuals, subjects, production }   (problem COUNTS; planVideo passes the real checks)
import { hashSeed } from "../rng.js";
import { beatSlots } from "./schema.js";
import { camMoveOf } from "../camMove.js";

const r3 = (x) => Math.round(x * 1000) / 1000;
const clone = (x) => JSON.parse(JSON.stringify(x));
const STOP = new Set("a an the and but or so of to in on at by for with from into onto over under up down out off is was were are be been being it its it's he she they we i you me my our your his her their them us this that these those then than as just not no never every all some one two three now there here what who when where why how do did does had has have i'm we're they're he's she's can could would will".split(" "));
const TIMED = ["beat", "tethers", "siege", "fx", "acts"];
const isCreatureSet = (set) => /^creature:/.test(set ?? "");
const DAY_WORDS = /\b(morning|day|daytime|sun|sunny|noon|afternoon|breakfast|today|dawn|sunrise)\b/i;
const NIGHT_WORDS = /\b(night|nights|tonight|dark|midnight|moon|evening|dusk|sunset|bedtime)\b/i;

/** the counts of the four pre-render checks are no worse than before */
const noWorse = (a, b) => Object.keys(b).every((k) => (a[k] ?? 0) <= (b[k] ?? 0));
const total = (c) => Object.values(c).reduce((x, y) => x + y, 0);

// ------------------------------------------------------------------------------------------------ timing
/** how many shots a line of `dur` seconds gets in this beat */
export function shotCount(dur, target, { minShot = 0.8, maxPerLine = 4 } = {}) {
  let n = Math.max(1, Math.min(maxPerLine, Math.round(dur / Math.max(0.5, target))));
  while (n > 1 && dur / n < minShot) n--;
  return n;
}

/**
 * Cut [t0, t1) into n pieces at word starts (never inside a word), each >= minShot. A slot that cuts on a noun / verb
 * prefers a content word's start near the ideal point. -> [t0, c1, ..., t1] (fewer pieces when the words do not allow n)
 */
export function cutTimes(t0, t1, n, words, { minShot = 0.8, shares = null, cutOn = [] } = {}) {
  const starts = words.filter((w) => w.start > t0 + 1e-3 && w.start < t1 - 1e-3);
  const cuts = [t0];
  let acc = 0;
  for (let k = 1; k < n; k++) {
    acc += shares ? shares[k - 1] : 1 / n;
    const ideal = t0 + (t1 - t0) * acc;
    const lo = cuts.at(-1) + minShot, hi = t1 - (n - k) * minShot;
    const cand = starts.filter((w) => w.start >= lo - 1e-6 && w.start <= hi + 1e-6);
    if (!cand.length) continue;
    const wantContent = ["noun", "verb"].includes(cutOn[k]);
    const best = cand.map((w) => ({ t: w.start, cost: Math.abs(w.start - ideal) - (wantContent && !STOP.has(String(w.word).toLowerCase().replace(/[^a-z']/g, "")) ? 0.18 : 0) })).sort((a, b) => a.cost - b.cost)[0];
    cuts.push(best.t);
  }
  cuts.push(t1);
  return cuts.map(r3);
}

// ------------------------------------------------------------------------------------------------ slots
/** which recipe slot each piece of a line takes */
function slotsForLine(recipe, beat, pieces, beatSpan, state) {
  const slots = beatSlots(recipe, beat);
  if (!slots.length) return pieces.map(() => null);
  const B = recipe.beats[beat];
  if (B.mode === "per_line") return pieces.map((_, k) => ({ slot: slots[k % slots.length], idx: k % slots.length }));
  // flow: the piece's midpoint on the beat's time line -> the slot whose share range holds it; never the same slot twice
  const cum = []; let c = 0; for (const s of slots) { c += s.share; cum.push(c); }
  const [b0, b1] = beatSpan, D = Math.max(1e-3, b1 - b0);
  return pieces.map(([p0, p1]) => {
    const f = Math.min(0.9999, Math.max(0, ((p0 + p1) / 2 - b0) / D));
    let idx = cum.findIndex((x) => f < x + 1e-9); if (idx < 0) idx = slots.length - 1;
    if (state.beat === beat && idx === state.last && slots.length > 1) idx = idx + 1 < slots.length ? idx + 1 : idx - 1;
    state.last = idx; state.beat = beat;
    return { slot: slots[idx], idx };
  });
}

/** what a planned shot holds that a slot can frame */
function present(s, tl) {
  const view = isCreatureSet(s.set) ? tl.worlds?.[s.set.slice(9)]?.view ?? null : null;
  const actors = s.actors ?? [];
  const named = actors.filter((a) => !/^town\d/.test(a.id));
  return {
    view,
    world: !!view && ((s.giants ?? []).some((g) => g.id === "world") || s.focus === "world"),
    threat: (s.giants ?? []).find((g) => g.id !== "world")?.id ?? null,
    monster: !!s.monsterState,
    crowd: (s.crowds ?? []).length > 0,
    me: actors.some((a) => a.id === "me"),
    other: named.find((a) => a.id !== "me")?.id ?? null,
    townsfolk: actors.filter((a) => /^town\d/.test(a.id)).length,
    named: named.length,
    object: (s.objects ?? []).length > 0,
    holder: actors.find((a) => a.hold)?.id ?? null,
  };
}

/** the focus a slot asks for, among what the shot holds (null = yield to the line's own focus) */
export function slotFocus(s, slot, tl) {
  const P = present(s, tl);
  switch (slot?.subject) {
    case "creature": return P.world && P.view === "outside" ? "world" : P.monster ? "monster" : null;
    case "town": return P.world && P.view !== "inside" && !P.named ? "world" : !P.named && !P.monster && !P.object ? (s.focus === "world" ? "world" : s.focus) : null;
    case "threat": return P.threat ? `giant:${P.threat}` : P.monster ? "monster" : P.crowd ? "crowd" : null;
    case "crowd": return P.crowd ? "crowd" : P.townsfolk + P.named >= 2 ? "group" : null;
    case "narrator": return P.me ? "me" : null;
    case "sidekick": case "neighbour": return P.other ?? (P.townsfolk ? (s.actors.find((a) => /^town\d/.test(a.id))?.id ?? null) : null);
    case "prop": return P.object ? "object" : P.holder;
    case "place": return s.focus;
    default: return null;
  }
}

const focusKind = (focus, s, tl) => {
  const f = String(focus ?? "");
  if (f === "world") { const v = tl.worlds?.[String(s.set).slice(9)]?.view; return v === "outside" ? "world" : v === "on" ? "town_on" : "inside"; }
  if (f.startsWith("giant:")) return "giant";
  if (f === "crowd" || f.startsWith("crowd:")) return "crowd";
  if (f === "monster") return "monster";
  if (f === "object") return "object";
  if (f === "group") return "group";
  return "person";
};

/** the slot's abstract camera -> the engine's camera (+ a caps move) for this focus */
export function engineCamera(cam, kind, s, slot = {}) {
  const d = cam?.distance ?? "medium", h = cam?.height ?? "eye_level", m = cam?.move ?? "push_in", sp = cam?.speed ?? "medium";
  const close = d === "close" || d === "extreme_close", wide = d === "wide" || d === "extreme_wide";
  const orbit = { type: "orbit", deg: (sp === "fast" ? 110 : sp === "slow" ? 40 : 70) * (((s.seed ?? 1) % 2) ? 1 : -1) };
  let camera, move = null;
  if (kind === "world") {
    // probed 2026-11-08 (dev/recipesProbe.mjs, turtle story): on the world creature giant_close frames the OTHER giant
    // and an orbit on a close camera loses the creature; a close slot is the low hero angle at its feet instead, an
    // orbit rides only on the establishing / aerial framings
    camera = h === "aerial" || (h === "high" && wide) ? "aerial" : h === "ground_low" || close ? "hero_low" : m === "track" || m === "pan" ? "track" : "establish";
    if (m === "orbit" && (camera === "establish" || camera === "aerial")) move = orbit;
    else if (m === "tilt_up" && camera === "hero_low") move = "tilt_up";
    else if (m === "flyover" && camera === "aerial") move = "flyover";
  } else if (kind === "giant") {
    // a rival giant next to the world creature: aerial / giant_close / track framings end inside a body (probe: blank
    // frames); the establishing wide and the low hero angle are the ones that hold it
    camera = h === "ground_low" || close ? "hero_low" : "establish";
  } else if (kind === "town_on") {
    camera = "aerial";
    if (m === "fpv" || (m === "track" && sp === "fast")) move = "fpv";
    else if (m === "flyover" || m === "track" || m === "pan") move = "flyover";
    else if (m === "orbit") move = orbit;
  } else if (kind === "crowd") {
    const moving = (s.crowds ?? []).some((c) => ["march", "charge", "run"].includes(c.action));
    camera = h === "aerial" || h === "high" ? "aerial" : moving && wide && (m === "push_in" || m === "track") ? "behind_army" : m === "track" && moving ? "track" : wide ? "establish" : "medium";
  } else {
    // people, a group, an object, the monster, a place inside the creature: the normal cameras
    const giantNear = isCreatureSet(s.set) && (s.giants ?? []).length > 0;
    camera = wide ? "wide" : close ? (kind === "object" ? "medium" : "closeup") : "medium";
    if (h === "ground_low" && !close) camera = kind === "person" && giantNear && (slot.scale ?? []).includes("creature") ? "hero_low" : "low";
    if (camera === "medium" && (slot.role === "threat" || slot.role === "reaction") && (s.monsterState || (s.actors ?? []).length >= 2) && kind !== "object") camera = "over_shoulder";
    if (kind === "group" && camera === "closeup") camera = "medium";
    if (m === "orbit" && (kind === "person" || kind === "group") && !close) move = orbit;
    if (h === "aerial" && kind === "person" && (s.actors ?? []).some((a) => ["sleep", "fall", "sit"].includes(a.pose))) move = "top_down";
  }
  return { camera, move };
}

const REACT = { reacts_scared: "scared", reacts_surprised: "surprised", reacts_happy: "happy" };

/** one piece of a planned shot dressed as a recipe slot (full: the slot's subject; yield: the line's own focus) */
function dress(src, piece, slot, ctx, { full, timedHere, idx, beat, lineText }) {
  const s = clone(src);
  s.start = piece[0]; s.end = piece[1];
  if (!timedHere) { for (const k of TIMED) delete s[k]; for (const g of s.giants ?? []) delete g.move; }
  else if (s.beat && src.end > src.start) {
    const atAbs = src.start + (src.beat.at ?? 0.55) * (src.end - src.start);
    s.beat = { ...s.beat, at: r3(Math.min(0.9, Math.max(0.1, (atAbs - s.start) / Math.max(1e-3, s.end - s.start)))) };
  }
  s.seed = hashSeed(`${ctx.title}:recipe:${src.line}:${piece[0]}`) % 1000;
  if (!slot) return s;
  const want = full ? slotFocus(s, slot, ctx.tl) : null;
  if (want && want !== s.focus) s.focus = want;
  const kind = focusKind(s.focus, s, ctx.tl);
  const { camera, move } = engineCamera(slot.cam, kind, s, slot);
  // EPIC cameras need giants / crowds / a creature world (lib/epic.js); a plain set keeps its own camera family
  const epicOk = isCreatureSet(s.set) || (s.giants ?? []).length || (s.crowds ?? []).length;
  if (["establish", "aerial", "hero_low", "track", "giant_close", "duel", "behind_army"].includes(camera) && !epicOk) s.camera = camera === "giant_close" ? "closeup" : camera === "hero_low" ? "low" : "wide";
  else s.camera = camera;
  if (move) s.move = move; else if (s.move && (typeof s.move === "string" ? s.move : s.move.type) !== "on_back" && full) delete s.move;
  // VISUAL-FIX 2026-11-08: the slot's move reaches EVERY shot (push in / pull out / track / pan / tilt on any framing:
  // lib/camMove.js); a caps move above already moves the camera
  if (s.move) delete s.camMove; else s.camMove = camMoveOf(slot.cam?.move ?? "push_in", slot.cam?.speed ?? "medium");
  // a person framed close on a reaction slot shows it on the face (only over a neutral face: the line's own feeling wins)
  const face = REACT[slot.action];
  if (face) for (const a of s.actors ?? []) if (a.id === s.focus && (!a.expr || a.expr === "neutral")) a.expr = face;
  if (slot.action === "looks_up") for (const a of s.actors ?? []) if (a.id === s.focus && a.pose === "stand") a.pose = "look_up";
  // the beat's time of day, never against the line's own time words
  const L = ctx.recipe.beats?.[beat]?.light;
  if (L && L !== "keep" && !DAY_WORDS.test(lineText) && !NIGHT_WORDS.test(lineText) && s.light !== L && !(L === "night" && s.part === "closer")) s.light = L;
  // "~": the slot's subject is not in the line's shot, so the shot keeps the line's own subject (narration rule)
  s.recipe = `${beat}:${idx}:${slot.role}${full && !want && !["line", "place"].includes(slot.subject) ? "~" : ""}`;
  return s;
}

/** the planned shots of one line, re-cut and dressed; null when the line can't be re-cut (shared shots) */
function recutLine(tl, li, ctx, full) {
  const L = tl.lines[li];
  const own = tl.shots.map((s, i) => [s, i]).filter(([s]) => s.line === li && (s.lines ?? [li]).every((x) => x === li));
  const shared = tl.shots.some((s) => (s.lines ?? [s.line]).includes(li) && (s.lines ?? [s.line]).some((x) => x !== li));
  if (!own.length || shared) return null;
  const idx = own.map(([, i]) => i);
  if (idx.some((v, k) => k && v !== idx[k - 1] + 1)) return null; // not back to back
  const t0 = own[0][0].start, t1 = own.at(-1)[0].end;
  const beat = L.part, B = ctx.recipe.beats?.[beat];
  if (!B) return null;
  const target = B.targetShot ?? ctx.recipe.pace.targetShot;
  const n = shotCount(t1 - t0, target, { minShot: ctx.recipe.pace.minShot, maxPerLine: ctx.recipe.pace.maxPerLine ?? 4 });
  const words = ctx.words.filter((w) => w.start >= t0 - 1e-3 && w.start < t1);
  // the pieces' slots first (per_line shares shape the cut points)
  const slotsAll = beatSlots(ctx.recipe, beat);
  const per = B.mode === "per_line" ? Array.from({ length: n }, (_, k) => slotsAll[k % slotsAll.length]) : null;
  const shares = per ? (() => { const tot = per.reduce((a, s) => a + s.share, 0) || 1; return per.map((s) => s.share / tot); })() : null;
  const cuts = cutTimes(t0, t1, n, words, { minShot: ctx.recipe.pace.minShot, shares, cutOn: per ? per.map((s) => s.cutOn) : [] });
  const pieces = cuts.slice(0, -1).map((c, k) => [c, cuts[k + 1]]);
  const state = { ...ctx.flow };
  const picks = slotsForLine(ctx.recipe, beat, pieces, ctx.beatSpan[beat], state);
  // each piece's content: the planned shot it overlaps most; the timed fields (beat, tethers, fx...) ride on one piece
  const srcOf = ([p0, p1]) => own.map(([s]) => s).reduce((b, s) => { const ov = Math.min(p1, s.end) - Math.max(p0, s.start); return ov > b.ov ? { s, ov } : b; }, { s: own[0][0], ov: -1 }).s;
  const timedPiece = new Map();
  for (const [s] of own) {
    if (!TIMED.some((k) => s[k] != null && (!Array.isArray(s[k]) || s[k].length))) continue;
    const tAbs = s.start + (s.beat?.at ?? 0.55) * (s.end - s.start);
    const k = pieces.findIndex(([p0, p1]) => tAbs >= p0 - 1e-6 && tAbs < p1 + 1e-6);
    timedPiece.set(s, k < 0 ? 0 : k);
  }
  const out = pieces.map((p, k) => {
    const src = srcOf(p);
    const timedHere = timedPiece.has(src) ? timedPiece.get(src) === k : true;
    return dress(src, p, picks[k]?.slot, ctx, { full, timedHere, idx: picks[k]?.idx ?? 0, beat, lineText: L.text ?? "" });
  });
  return { from: idx[0], count: idx.length, shots: out, state };
}

/** the line's shots kept as cut, each dressed by the beat's slots (lines whose shots also carry another line) */
function skinLine(tl, li, ctx, full) {
  const L = tl.lines[li];
  const idx = tl.shots.map((s, i) => [s, i]).filter(([s]) => s.line === li).map(([, i]) => i);
  if (!idx.length || idx.some((v, k) => k && v !== idx[k - 1] + 1)) return null;
  const beat = L.part; if (!ctx.recipe.beats?.[beat]) return null;
  const pieces = idx.map((i) => [tl.shots[i].start, tl.shots[i].end]);
  const state = { ...ctx.flow };
  const picks = slotsForLine(ctx.recipe, beat, pieces, ctx.beatSpan[beat], state);
  const out = idx.map((i, k) => { const s = dress(tl.shots[i], pieces[k], picks[k]?.slot, ctx, { full, timedHere: true, idx: picks[k]?.idx ?? 0, beat, lineText: L.text ?? "" }); s.seed = tl.shots[i].seed; return s; });
  return { from: idx[0], count: idx.length, shots: out, state };
}

/**
 * The recipe over a planned timeline (mutates tl.shots). Deterministic. Every line's change is kept only when the
 * four pre-render checks are no worse (counts); else the next variant; else the line stays as planned.
 */
export function recipePass(tl, { recipe, check, title = tl?.title ?? "" } = {}) {
  const report = { id: recipe?.id ?? null, lines: 0, recut: 0, full: 0, yielded: 0, kept: 0, skinned: 0, shotsBefore: tl?.shots?.length ?? 0, shotsAfter: 0, problems: [] };
  if (!recipe || !tl?.shots?.length || !tl.lines?.length) return report;
  const words = (tl.captions ?? []).map((w) => ({ word: w.word, start: w.start }));
  const beatSpan = {};
  for (const L of tl.lines) { const b = beatSpan[L.part]; beatSpan[L.part] = b ? [Math.min(b[0], L.start), Math.max(b[1], L.end)] : [L.start, L.end]; }
  const ctx = { tl, recipe, words, beatSpan, title, flow: { last: null, beat: null } };
  let base = check ? check(tl) : null;
  report.before = base;
  for (let li = 0; li < tl.lines.length; li++) {
    report.lines++;
    let done = false;
    for (const [mode, full] of [["recut", true], ["recut", false], ["skin", true], ["skin", false]]) {
      const r = mode === "recut" ? recutLine(tl, li, ctx, full) : skinLine(tl, li, ctx, full);
      if (!r) continue;
      const old = tl.shots.splice(r.from, r.count, ...r.shots);
      const now = check ? check(tl) : null;
      if (!check || noWorse(now, base)) {
        base = now; ctx.flow = r.state; done = true;
        if (mode === "recut") report.recut++; else report.skinned++;
        if (full) report.full++; else report.yielded++;
        break;
      }
      tl.shots.splice(r.from, r.shots.length, ...old);
    }
    if (!done) report.kept++;
  }
  report.after = base;
  report.shotsAfter = tl.shots.length;
  report.slotShots = tl.shots.filter((s) => s.recipe).length;
  report.slotYields = tl.shots.filter((s) => String(s.recipe ?? "").endsWith("~")).length;
  if (base && report.before && total(base) > total(report.before)) report.problems.push("checks worse than before (should never happen)");
  return report;
}

/** the rhythm of a timeline per beat (for comparing with the recipe's source): shots, median shot, cameras, moves */
export function rhythm(tl) {
  const out = {};
  for (const s of tl.shots ?? []) {
    const b = (out[s.part] ??= { shots: 0, durs: [], cams: {}, moves: {} });
    b.shots++; b.durs.push(s.end - s.start);
    b.cams[s.camera] = (b.cams[s.camera] ?? 0) + 1;
    const m = s.move ? (typeof s.move === "string" ? s.move : s.move.type) : "-"; b.moves[m] = (b.moves[m] ?? 0) + 1;
  }
  for (const b of Object.values(out)) { const d = b.durs.sort((x, y) => x - y); b.medianShot = r3(d[Math.floor((d.length - 1) / 2)]); delete b.durs; }
  return out;
}
