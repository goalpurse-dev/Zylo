// Blocky Worlds SHOT GRAMMAR v2 (owner 2026-11-09, "C. shot grammar", "E. hero inserts", "7. lived-in town"). Pure,
// Node + browser (no I/O). planVideo runs shotGrammarPass after the story-shape pass and before the camera moves; every
// change is kept only when the pre-render checks are no worse (the narration rule, the world bible, no cards).
//
// The framing mix per video (targets; the measured mix lands in tl.style.metrics.mix):
//   character  ~40%  a person's close / medium (closeup, medium, low, over the shoulder on a person): the face readable
//   insert     ~20%  a hero insert of a story object: the object alone, whole, 40-70 % of the frame, a slow push in
//   world      ~25%  world / establishing (wide, establish, aerial on the town, the world, a crowd, a lone person small)
//   action     ~15%  action / a group of 2-5 (a group wide, a giant acting, the monster)
// Crowd shots (more than 12 people on screen) max 10 %, and a crowd always DOES something (chatting groups, kids
// running, waving vendors); every other town background holds 3-12 people in small groups doing different things, and
// now and then a dog.
//
//   GRAMMAR                                  the targets and limits
//   classOf(shot)                            -> "character" | "insert" | "world" | "action" | "card"
//   crowdPeople(shot)                        -> how many crowd people the shot shows
//   faceProblem(shot, cast)                  -> null | why the focus person's face is not readable (character shots)
//   mixReport(tl)                            -> { n, counts, share, target, off, crowd, faces, inserts }
//   shotGrammarPass(tl, { check, critical, production }) -> report (tl.shape.grammar)
import { headShare } from "../page/camera.js";
import { OBJECT_CATALOG } from "./visuals.js";
import { designedInsertFor, isDesignedInsert, clockTime } from "./insertKit.js";

export const GRAMMAR = Object.freeze({
  // calibrated 2026-11-09 to the LOOK-TARGET reference (73 frames): face close-up 22 % + medium single 16 %, full-frame
  // insert 21 %, establishing 23 %, group / action of 2-4 16 %, crowd 0 %, no frame with more than 10 people
  targets: Object.freeze({ character: 0.39, insert: 0.21, world: 0.24, action: 0.16 }),
  tol: 0.07,                 // a class within +-7 points of its target is on target
  crowdMax: 0.05,            // crowd shots (> crowdPeople on screen): owner max 10 %, the reference 0 %: 5 %
  crowdPeople: 10,           // more than this many people = a crowd shot (the reference has none)
  life: Object.freeze([3, 8]),  // a town background: 3-8 crowd people (+ the shot's actors: <= 10 on screen)
  crowdKeep: 40,             // a kept crowd shot: at most this many people
  headMin: 0.12,             // a character shot: the head at least 12 % of the frame height
  headMinClose: 0.15,        // a close-up: the head 15-25 % of the frame (the reference median 18 %)
  insertFit: 0.6,            // a hero insert: the object's fit share of the frame at the start of its push in
  insertMinShot: 0.9,        // a split never leaves a shot shorter than this (s); a spare shot is re-dressed first (the
                             // reference holds ~1.8 s a shot: inserts never make the cutting faster than it must)
  maxPerItem: 3,             // hero inserts per story object (first mention + payoff + one more when the mix is short)
  // INSERTS 2026-11-10 (owner: "bold designed props and screens like the reference"): a line that names a time /
  // countdown / sign / poster / screen / notice gets the designed insert (lib/insertKit.js), framed nearly full-frame
  designedFit: 0.85,         // the designed insert's share of the frame at the start of its push in (the clock face fills it)
  designedMax: 4,            // designed inserts per video (one per line)
});

const CLASSES = ["character", "insert", "world", "action"];
/** a recipe's own mix (lib/recipes: recipe.mix) when it is a valid one, else the owner's targets */
export function targetsOf(mix) {
  const ok = mix && CLASSES.every((k) => Number.isFinite(mix[k]) && mix[k] >= 0 && mix[k] <= 1) && Math.abs(CLASSES.reduce((a, k) => a + mix[k], 0) - 1) <= 0.05;
  return ok ? Object.fromEntries(CLASSES.map((k) => [k, mix[k]])) : { ...GRAMMAR.targets };
}
let TG = { ...GRAMMAR.targets }; // the targets of the pass running now
const PERSON_CAMS = new Set(["closeup", "medium", "low", "over_shoulder"]);
const WORLD_CAMS = new Set(["wide", "establish", "aerial", "behind_army"]);
const GIANT_ACTION_CAMS = new Set(["giant_close", "hero_low", "duel", "track"]);
const isCard = (s) => !s || s.camera === "insert" || !!s.insert;
const clone = (x) => JSON.parse(JSON.stringify(x));
const r3 = (v) => Math.round(v * 1000) / 1000;
const dur = (s) => Math.max(0, (s.end ?? 0) - (s.start ?? 0));
const noWorse = (a, b) => !a || !b || Object.keys(b).every((k) => (a[k] ?? 0) <= (b[k] ?? 0));
const hash = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// the poses the page frames as the whole action (page/kit/people.js POSE_FRAME: full body, often side-on): an action shot,
// never a face shot (step-3 #3 s32 "build", s48 "push" rendered as a back / full body)
const POSE_FRAMED = new Set(["hug", "climb", "push", "fall", "jump", "hide", "throw", "fly", "swim", "build", "dig", "dance", "kick", "drive", "ride"]);
// the creature town's street places frame roomier (page/sets/backStreet.js S.framing, outdoor): the head gets smaller
const FRAMING = { closeup: 1.2, medium: 1.8, wide: 1.5 };
const framingOf = (s, cam) => (/^creature:/.test(s.set ?? "") ? FRAMING[cam] ?? 1 : 1);
const isPersonFocus = (s) => !!s.focus && (s.actors ?? []).some((a) => a.id === s.focus);

/** how many crowd people the shot shows */
export const crowdPeople = (s) => (s?.crowds ?? []).reduce((n, c) => n + (Number(c.count) || 0), 0);
/** how many people the shot shows (actors + crowds) */
const peopleOn = (s) => (s.actors ?? []).length + crowdPeople(s);

/** the shot's class in the framing mix */
export function classOf(s) {
  if (isCard(s)) return "card";
  if (s.hero) return "insert";
  const f = String(s.focus ?? "");
  if (f === "object") return WORLD_CAMS.has(s.camera) && (s.camera !== "wide" || (s.actors ?? []).length) ? "world" : "insert";
  if (/^giant:/.test(f) || f === "monster") return WORLD_CAMS.has(s.camera) ? "world" : "action";
  if (f === "world" || f === "crowd" || f.startsWith("crowd:")) return WORLD_CAMS.has(s.camera) || crowdPeople(s) > GRAMMAR.crowdPeople ? "world" : "action";
  if (isPersonFocus(s) || f === "me") {
    const fa = (s.actors ?? []).find((a) => a.id === s.focus);
    if (fa && POSE_FRAMED.has(fa.pose) && ["closeup", "medium"].includes(s.camera)) return "action";
    if (PERSON_CAMS.has(s.camera)) return "character";
    if (GIANT_ACTION_CAMS.has(s.camera)) return "action";
    const n = (s.actors ?? []).length;
    if (s.camera === "wide") return n >= 2 && n <= 5 && !crowdPeople(s) ? "action" : "world";
    return WORLD_CAMS.has(s.camera) ? "world" : "action";
  }
  // a group
  const n = (s.actors ?? []).length;
  if (WORLD_CAMS.has(s.camera)) return n >= 2 && n <= 5 && s.camera === "wide" && !crowdPeople(s) ? "action" : "world";
  return "action";
}

/** the focus person of a character shot: null when the face reads; else why not */
export function faceProblem(s, cast = {}) {
  if (classOf(s) !== "character") return null;
  const a = (s.actors ?? []).find((x) => x.id === s.focus);
  if (!a) return "no focus person";
  const role = cast[a.id]?.role ?? "adult";
  const H = role === "kid" ? 1.25 : role === "baby" ? 0.7 : 1.75;
  const f = a.facing ?? "camera";
  if (s.camera === "over_shoulder") {
    const near = (s.actors ?? []).find((x) => x.id !== a.id);
    if (!(s.objects ?? []).length && near && f !== near.id && f !== "camera") return `faces ${f}, not the near shoulder (${near.id})`;
    if ((s.objects ?? []).length && f !== "camera") return `faces ${f}, away from the lens`;
  } else if (f !== "camera") return `faces ${f} (profile or back): the face is not front or 3/4`;
  // honest: the head of a blocky person ~0.2 of an adult's height (~0.27 of a kid's), the set's roomier framing applied
  const hs = headShare(s.camera, H, { framing: framingOf(s, s.camera), headFrac: role === "kid" || role === "baby" ? 0.27 : 0.2 });
  const min = s.camera === "closeup" ? GRAMMAR.headMinClose : GRAMMAR.headMin;
  if (hs < min) return `the head is ${(hs * 100).toFixed(0)}% of the frame (want >= ${Math.round(min * 100)}%)`;
  return null;
}

/** the critical story objects that can get a hero insert, with the lines that name them (production.perLine ids) */
function heroItems(critical, production, shots) {
  const out = [], skipped = [];
  for (const it of critical?.items ?? []) {
    if (it.kind !== "object") continue;
    if (!it.source || it.source === "set" || it.source === "creature") { skipped.push({ name: it.name, why: it.source ? `${it.source} piece` : "not built yet (builder need)" }); continue; }
    if (it.kitName === "house_front") { skipped.push({ name: it.name, why: "scenery (the town's houses)" }); continue; }
    const obj = heroObject(it, shots);
    if (!obj) { skipped.push({ name: it.name, why: "no scene object for it" }); continue; }
    const lines = [...new Set((production?.perLine ?? []).filter((L) => (L.required ?? []).some((r) => r.id === it.id)).map((L) => L.line))].sort((a, b) => a - b);
    if (!lines.length) { skipped.push({ name: it.name, why: "no line names it" }); continue; }
    out.push({ id: it.id, name: it.name, why: it.why ?? [], obj, lines, big: isBig(obj, it), row: obj.asset ? it.asset ?? null : null });
  }
  return { items: out, skipped };
}

/** the scene object that shows a critical item (copied from a shot that already shows it, else built from the item) */
function heroObject(it, shots) {
  const assetId = it.asset?.id ?? null;
  const nm = String(it.name ?? "").toLowerCase();
  // INSERTS 2026-11-10: a story's clock (not a clock tower) gets the designed wall clock (its face full-frame)
  if (it.kitName === "clock" && !/\btower\b/.test(nm)) return { name: /\balarm\b/.test(nm) ? "alarm_clock" : "wall_clock", facing: "camera" };
  if (isDesignedInsert(it.kitName)) return { name: it.kitName, facing: "camera" };
  const match = (o) => (assetId && o.asset === assetId) || (it.kitName && (o.name === it.kitName || (o.name === "item" && o.state === it.kitName))) || (!it.kitName && !assetId && String(o.name).toLowerCase() === nm);
  for (const s of shots) for (const o of s.objects ?? []) if (!o.life && match(o)) { const { spot, facing, ...rest } = o; return { ...rest, facing: "camera" }; }
  if (assetId) return { name: nm, asset: assetId, ...(it.asset.aliases?.length ? { aliases: it.asset.aliases } : {}), facing: "camera" };
  if (it.kitName && OBJECT_CATALOG[it.kitName]) return { name: it.kitName, facing: "camera" };
  if (it.kitName && OBJECT_CATALOG.item?.states?.includes(it.kitName)) return { name: "item", state: it.kitName, facing: "camera" }; // a hand prop, big, on its display crate
  return null;
}

/** a big thing (a house, a tower): framed whole with the "wide" object framing */
function isBig(obj, it) {
  if (obj.asset) {
    const parts = it.asset?.blueprint?.parts ?? [];
    const top = parts.reduce((m, p) => Math.max(m, (p.pos?.[1] ?? 0) + (p.size?.[1] ?? 0) / 2), 0);
    return top > 3.2 || /\b(house|houses|tower|towers|cottage|stilt|stilts|building|castle|hall|pipe|pipes|bakery|shop|mill|bridge|wall)\b/i.test(it.name);
  }
  return !!OBJECT_CATALOG[obj.name]?.big || /^(house_front|stairs|bell)$/.test(obj.name);
}

const isHeroOf = (s, item) => !!s.hero && s.hero.item === item.id;
const shotsOfLine = (tl, li) => tl.shots.map((s, i) => [s, i]).filter(([s]) => (s.lines ?? [s.line]).includes(li));

/** the words of a line that name the item (its head word, aliases) */
function itemWords(item) {
  const ws = new Set();
  for (const w of String(item.name).toLowerCase().split(/[^a-z]+/)) if (w.length > 2) ws.add(w.replace(/s$/, ""));
  for (const a of item.obj.aliases ?? []) for (const w of String(a).toLowerCase().split(/[^a-z]+/)) if (w.length > 2) ws.add(w.replace(/s$/, ""));
  if (item.obj.state) ws.add(String(item.obj.state).replace(/_/g, " ").split(" ").at(-1));
  return ws;
}

/** a cut time inside shot s on a word start: the item's own word when it sits clear of both ends, else the onset nearest the middle */
function cutIn(tl, s, words) {
  const min = GRAMMAR.insertMinShot, caps = (tl.captions ?? []).filter((c) => c.start >= s.start + min - 1e-6 && c.start <= s.end - min + 1e-6);
  if (!caps.length) return null;
  const own = caps.find((c) => words.has(String(c.word).toLowerCase().replace(/[^a-z]+/g, "").replace(/s$/, "")));
  if (own) return own.start;
  const mid = (s.start + s.end) / 2;
  return caps.reduce((b, c) => (Math.abs(c.start - mid) < Math.abs(b.start - mid) ? c : b)).start;
}

/** dress shot s as the hero insert of item (the object alone, whole, centred, a slow push in from GRAMMAR.insertFit) */
function dressInsert(s, item, at, camera, lineText = null) {
  const keep = (s.objects ?? []).find((o) => o.name === item.obj.name && (o.asset ?? null) === (item.obj.asset ?? null) && (o.state ?? null) === (item.obj.state ?? null));
  s.objects = [{ ...item.obj, ...designedContent(item.obj, lineText), spot: keep?.spot ?? "center", facing: "camera" }];
  s.actors = [];
  s.focus = "object";
  s.camera = camera;
  s.subject = null;
  for (const k of ["subjectWith", "subjectAbsent", "markers", "crowds", "giants", "beat", "tethers", "siege", "fx", "acts", "move", "shake", "tilt", "seq", "monsterState"]) delete s[k];
  s.monsterState = null; s.marker = null; s.insert = null;
  s.visuals = [];
  s.hero = { item: item.id, name: item.name, at, ...(isDesignedInsert(item.obj.name) ? { designed: item.obj.name } : {}) };
  s.camMove = { type: "push_in", speed: "slow", fit: isDesignedInsert(item.obj.name) ? GRAMMAR.designedFit : GRAMMAR.insertFit };
}

/** a designed insert's content from its line (the clock's time, the countdown, the screen's words); the object's own
 *  content (a designed-pass item) wins; a clock with no time in the line shows 7:00 */
function designedContent(obj, lineText) {
  if (!isDesignedInsert(obj.name) || obj.text != null || obj.secs != null) return {};
  const d = lineText ? designedInsertFor(lineText) : null;
  if (d && d.name === obj.name) return { ...(d.text != null ? { text: d.text } : {}), ...(d.secs != null ? { secs: d.secs } : {}), ...(d.state ? { state: d.state } : {}) };
  if (/clock$/.test(obj.name)) return { text: clockTime(lineText ?? "") ?? "7:00" };
  return {};
}

/** shots of `item` already framed as its hero (or a lone object shot of it that can simply be marked) */
function markExisting(tl, item, li) {
  for (const [s] of shotsOfLine(tl, li)) {
    if (isHeroOf(s, item)) return true;
    const o = s.objects?.[0];
    const des = isDesignedInsert(item.obj.name);
    if (!isCard(s) && s.focus === "object" && !(s.actors ?? []).length && o && o.name === item.obj.name && (o.asset ?? null) === (item.obj.asset ?? null) && (des ? s.camera === "wide" : ["medium", "wide"].includes(s.camera))) {
      s.hero = { item: item.id, name: item.name, at: "marked", ...(des ? { designed: o.name } : {}) }; s.camMove = { type: "push_in", speed: "slow", fit: des ? GRAMMAR.designedFit : GRAMMAR.insertFit }; delete s.move;
      if (des) Object.assign(o, designedContent(o, tl.lines?.[li]?.text ?? null));
      return true;
    }
  }
  return false;
}

/** the mix: counts, shares, distance from the targets, crowd share, faces, inserts */
export function mixReport(tl) {
  const shots = (tl?.shots ?? []).filter((s) => !isCard(s));
  const n = shots.length || 1;
  const counts = Object.fromEntries(CLASSES.map((c) => [c, 0]));
  for (const s of shots) counts[classOf(s)] = (counts[classOf(s)] ?? 0) + 1;
  const share = Object.fromEntries(CLASSES.map((c) => [c, +(counts[c] / n).toFixed(2)]));
  const tg = targetsOf(tl?.shape?.grammar?.targets);
  const off = Object.fromEntries(CLASSES.map((c) => [c, +(share[c] - tg[c]).toFixed(2)]));
  const crowdShots = (tl?.shots ?? []).map((s, i) => [s, i]).filter(([s]) => !isCard(s) && crowdPeople(s) > GRAMMAR.crowdPeople);
  const standing = crowdShots.filter(([s]) => (s.crowds ?? []).filter((c) => (c.count ?? 0) > 3).every((c) => (c.action ?? "stand") === "stand")).map(([, i]) => i);
  const bigTown = (tl?.shots ?? []).map((s, i) => [s, i]).filter(([s]) => !isCard(s) && (s.crowds ?? []).some((c) => c.kind === "townsfolk") && crowdPeople(s) > GRAMMAR.life[1]).map(([, i]) => i);
  const charShots = (tl?.shots ?? []).map((s, i) => [s, i]).filter(([s]) => classOf(s) === "character");
  const badFaces = charShots.map(([s, i]) => ({ shot: i, why: faceProblem(s, tl.cast ?? {}) })).filter((x) => x.why);
  const heroes = (tl?.shots ?? []).map((s, i) => [s, i]).filter(([s]) => s.hero);
  const byItem = {};
  for (const [s, i] of heroes) (byItem[s.hero.name] ??= []).push(i);
  return {
    n: shots.length, counts, share, target: tg, off,
    onTarget: CLASSES.every((c) => Math.abs(off[c]) <= GRAMMAR.tol + 1e-9),
    crowd: { shots: crowdShots.length, share: +(crowdShots.length / n).toFixed(2), max: GRAMMAR.crowdMax, standing, bigTownBackgrounds: bigTown },
    faces: { shots: charShots.length, ok: charShots.length - badFaces.length, bad: badFaces },
    inserts: { shots: heroes.length, byItem },
  };
}

const dist = (counts, n) => CLASSES.reduce((a, c) => a + Math.abs(counts[c] / Math.max(1, n) - TG[c]), 0);
const mixCounts = (tl) => { const c = Object.fromEntries(CLASSES.map((k) => [k, 0])); let n = 0; for (const s of tl.shots) { if (isCard(s)) continue; n++; c[classOf(s)]++; } return { c, n }; };

// ------------------------------------------------------------------------------------------------ lived-in town
const GROUP_WORDS = /\b(everyone|everybody|crowds?|whole town|townsfolk|people|neighbou?rs|all of us|the town|families|villagers|the street|whole street)\b/i;
const CROWD_VERBS = [[/\b(cheer\w*|celebrat\w*|hooray|clap\w*|danc\w*|part(y|ied))\b/i, "cheer"], [/\b(fle[de]\w*|flee|panic\w*|scream\w*|scatter\w*|escap\w*|ran away|run away)\b/i, "flee"], [/\b(wav\w*|hello|greet\w*)\b/i, "wave"], [/\b(march\w*)\b/i, "march"]];
const STILL = /(stop(?:ped|s)?|still|froze|freezes?|frozen|wait(?:ed|s|ing)?|hid(?:es|ing)?|hide|sle(?:pt|eps?|eping)|asleep|rest(?:ed|s|ing)?|lay|lying|stood|sat|watch(?:ed|es|ing)?|stare[ds]?|staring|silent|quiet)/i;
const OUTDOOR = (s) => s.set === "street" || s.set === "woods" || /^creature:/.test(s.set ?? "") || /^world:/.test(s.set ?? "");

/** the crowd action the shot's own words ask for (null: none) */
function wordAction(text) { for (const [re, a] of CROWD_VERBS) if (re.test(text ?? "")) return a; return null; }

/** small groups doing different things: 3-12 people (n: how many groups, seeded) */
export function lifeGroups(base, seed, { total = null, action = null, outdoor = true } = {}) {
  const R = (k) => (hash(`${seed}:${k}`) % 1000) / 1000;
  const keep = {};
  for (const k of ["kind", "faction", "item", "aliases", "spacing", "onWorld", "onGround"]) if (base[k] !== undefined) keep[k] = base[k];
  keep.kind ??= "townsfolk";
  const sd = (k) => ((Number(base.seed) || 3) + k * 11) % 997 + 1;
  if (action && action !== "stand") {
    // the line's own crowd action (cheer, flee, wave, march): everyone does it, in two groups
    const n = Math.max(GRAMMAR.life[0], Math.min(GRAMMAR.life[1], total ?? 8));
    const a = Math.ceil(n / 2);
    return [
      { ...keep, count: a, formation: "scatter", action, spot: "back", facing: base.facing ?? "camera", seed: sd(1), life: "crowd" },
      { ...keep, count: n - a, formation: "scatter", action, spot: R("s") < 0.5 ? "left" : "right", facing: base.facing ?? "camera", seed: sd(2), life: "crowd" },
    ].filter((g) => g.count > 0);
  }
  const chat = { ...keep, count: 3 + Math.floor(R("c") * 2), formation: "ring", action: "stand", spot: "back", facing: "camera", seed: sd(1), life: "chat" };
  const opts = outdoor
    ? [
      { ...keep, count: 2 + Math.floor(R("k") * 2), formation: "scatter", action: "run", spot: "left", facing: R("kd") < 0.5 ? "right" : "left", seed: sd(2), life: "kids" },
      { ...keep, count: 2, formation: "line", action: "wave", spot: "right", facing: "camera", seed: sd(3), life: "vendors" },
      { ...keep, count: 2 + Math.floor(R("w") * 2), formation: "scatter", action: "wave", spot: "far", facing: "camera", seed: sd(4), life: "wave" },
    ]
    : [{ ...keep, count: 2, formation: "line", action: "wave", spot: "right", facing: "camera", seed: sd(3), life: "wave" }];
  const first = Math.floor(R("o") * opts.length);
  const groups = [chat, opts[first], ...(outdoor && R("t") < 0.6 ? [opts[(first + 1) % opts.length]] : [])];
  // never past the town-background limit
  let n = groups.reduce((a, g) => a + g.count, 0);
  while (n > GRAMMAR.life[1]) { const g = groups.find((x) => x.count > 2); if (!g) break; g.count--; n--; }
  return groups;
}

/** a kept crowd shot: the crowd split into groups doing different things (never 40 x stand) */
function busyCrowd(base, seed, total) {
  const n = Math.min(GRAMMAR.crowdKeep, Math.max(GRAMMAR.life[1] + 1, total));
  const keep = {};
  for (const k of ["kind", "faction", "item", "aliases", "spacing", "onWorld", "onGround"]) if (base[k] !== undefined) keep[k] = base[k];
  const sd = (k) => ((Number(base.seed) || 3) + k * 13) % 997 + 1;
  const chat = Math.round(n * 0.45), wave = Math.round(n * 0.25), kids = Math.max(2, Math.round(n * 0.15));
  return [
    { ...keep, count: chat, formation: "scatter", action: "stand", spot: "back", facing: "camera", seed: sd(1), life: "chat" },
    { ...keep, count: wave, formation: "scatter", action: "wave", spot: "far", facing: "camera", seed: sd(2), life: "wave" },
    { ...keep, count: kids, formation: "scatter", action: "run", spot: "left", facing: hash(`${seed}`) % 2 ? "right" : "left", seed: sd(3), life: "kids" },
    { ...keep, count: Math.max(1, n - chat - wave - kids), formation: "line", action: "cheer", spot: "right", facing: "camera", seed: sd(4), life: "cheer" },
  ].filter((g) => g.count > 0);
}

/** the lived-in town: crowd shots capped at GRAMMAR.crowdMax and busy; every other town background 3-12 people in groups */
function townLife(tl, tryChange, report) {
  const shots = tl.shots;
  const N = shots.filter((s) => !isCard(s)).length;
  const cap = Math.max(1, Math.floor(N * GRAMMAR.crowdMax));
  const town = shots.map((s, i) => [s, i]).filter(([s]) => !isCard(s) && (s.crowds ?? []).some((c) => c.kind === "townsfolk"));
  // the crowd shots worth keeping: the line is about everyone / the crowd acts; the opener; then the biggest
  const score = (s, i) => (GROUP_WORDS.test(s.text ?? "") ? 4 : 0) + (wordAction(s.text) ? 3 : 0) + (i === 0 ? 2 : 0) + (String(s.focus).startsWith("crowd") ? 1 : 0);
  const big = town.filter(([s]) => crowdPeople(s) > GRAMMAR.crowdPeople).sort(([a, i], [b, j]) => score(b, j) - score(a, i) || i - j);
  const others = shots.filter((s) => !isCard(s) && crowdPeople(s) > GRAMMAR.crowdPeople && !(s.crowds ?? []).some((c) => c.kind === "townsfolk")).length; // armies (kept as the story's)
  void others;
  // armies (soldiers, wolf soldiers: the story's own crowd) share the same cap: the shots whose line names them keep the
  // whole army; elsewhere it is a squad of 12 in the background. Standing armies march unless the line says they stop.
  const armyNamed = (s) => (s.crowds ?? []).some((c) => c.kind !== "townsfolk" && [c.item, ...(c.aliases ?? [])].filter((w) => w && String(w).length > 2).some((w) => new RegExp(`\\b${String(w).replace(/[^a-z ]/gi, "")}\\b`, "i").test(s.text ?? "")));
  const allBig = shots.map((s, i) => [s, i]).filter(([s]) => !isCard(s) && crowdPeople(s) > GRAMMAR.crowdPeople)
    .sort(([a, i], [b, j]) => (score(b, j) + (armyNamed(b) ? 4 : 0)) - (score(a, i) + (armyNamed(a) ? 4 : 0)) || i - j);
  const kept = new Set(allBig.slice(0, cap).filter(([s, i]) => score(s, i) + (armyNamed(s) ? 4 : 0) > 0).map(([, i]) => i));
  void big;
  shots.forEach((s, i) => {
    const army = (s.crowds ?? []).filter((c) => c.kind !== "townsfolk");
    if (isCard(s) || !army.length) return;
    const still = STILL.test(s.text ?? "");
    const ok = tryChange(() => {
      for (const c of tl.shots[i].crowds ?? []) {
        if (c.kind === "townsfolk") continue;
        if (!kept.has(i) && (c.count ?? 0) > GRAMMAR.life[1]) c.count = GRAMMAR.life[1];
        if ((c.action ?? "stand") === "stand" && !still) c.action = "march";
      }
      return true;
    });
    if (ok) report.town.army++; else report.town.reverted++;
  });
  for (const [s, i] of town) {
    const tf = (s.crowds ?? []).filter((c) => c.kind === "townsfolk");
    if (!tf.length || tf.every((c) => c.life)) continue;
    const total = tf.reduce((a, c) => a + (c.count ?? 0), 0);
    const act = wordAction(s.text) ?? (tf.find((c) => c.action && c.action !== "stand")?.action ?? null);
    const ok = tryChange(() => {
      const x = tl.shots[i], rest = (x.crowds ?? []).filter((c) => c.kind !== "townsfolk");
      const groups = kept.has(i) ? (act ? lifeGroups(tf[0], x.seed ?? i, { total: Math.min(GRAMMAR.crowdKeep, total), action: act }).map((g, k) => ({ ...g, count: k ? g.count : Math.max(g.count, Math.min(GRAMMAR.crowdKeep, total) - 6) })) : busyCrowd(tf[0], x.seed ?? i, total))
        : lifeGroups(tf[0], x.seed ?? i, { total: Math.min(total, 10), action: act, outdoor: OUTDOOR(x) });
      x.crowds = [...rest, ...groups];
      return true;
    });
    if (ok) report.town[kept.has(i) ? "busy" : "life"]++; else report.town.reverted++;
  }
  // a dog now and then in the world shots of the town (never in a pet story or where a dog is the story's)
  const dogStory = !!(tl.pets && Object.keys(tl.pets).length) || shots.some((s) => (s.objects ?? []).some((o) => o.name === "dog" || o.pet));
  if (!dogStory) {
    let last = -99;
    shots.forEach((s, i) => {
      if (isCard(s) || s.set !== "street" || classOf(s) !== "world" || i - last < 3) return;
      if (!["crowd", "world", "group"].includes(String(s.focus).replace(/:.*/, ""))) return;
      if ((s.objects ?? []).some((o) => o.spot === "far")) return;
      const ok = tryChange(() => {
        const x = tl.shots[i];
        x.objects = [...(x.objects ?? []), { name: "dog", state: ["run", "walk", "sniff"][hash(`dog${i}`) % 3], spot: "far", facing: hash(`dogf${i}`) % 2 ? "left" : "right", life: "dog" }];
        return true;
      });
      if (ok) { report.town.dogs++; last = i; }
    });
  }
}

// ------------------------------------------------------------------------------------------------ hero inserts
/** split shot i at time t into two shots (same content) -> index of the second */
function splitAt(tl, i, t) {
  const s = tl.shots[i];
  const b = clone(s); b.start = r3(t); s.end = r3(t);
  for (const k of ["beat", "tethers", "siege", "fx", "acts"]) delete b[k];
  b.seed = ((s.seed ?? 1) * 7 + 3) % 1000;
  tl.shots.splice(i + 1, 0, b);
  return i + 1;
}

/** one hero insert of item on line li: split the line's longest shot at the item's word (else re-dress a spare shot) */
function heroInsert(tl, item, li, at, tryChange) {
  if (markExisting(tl, item, li)) return "marked";
  const words = itemWords(item);
  // a designed insert: only the "wide" object framing (it centres on the face at fitY; the medium one on fitH / 2)
  const cams = isDesignedInsert(item.obj.name) ? ["wide"] : item.big ? ["wide", "medium"] : ["medium", "wide"];
  const lineText = tl.lines?.[li]?.text ?? null;
  const own = shotsOfLine(tl, li).filter(([s]) => !isCard(s) && !s.hero && s.seq !== "threat");
  // 1. a spare shot of the line (the line keeps another shot for its people)
  if (own.length >= 2) {
    for (const [, i0] of [...own].filter(([, i]) => i > 0).sort(([a], [b]) => (classOf(a) === "character") - (classOf(b) === "character"))) {
      for (const cam of cams) if (tryChange(() => { dressInsert(tl.shots[i0], item, at, cam, lineText); return true; })) return "converted";
    }
  }
  // 2. split the longest shot of the line (the cut on the item's word)
  const longest = [...own].sort(([a], [b]) => dur(b) - dur(a));
  for (const [s0, i0] of longest) {
    if (dur(s0) < 2 * GRAMMAR.insertMinShot) continue;
    const t = cutIn(tl, s0, words); if (t == null) continue;
    for (const cam of cams) {
      if (tryChange(() => { const j = splitAt(tl, i0, t); dressInsert(tl.shots[j], item, at, cam, lineText); return true; })) return "split";
    }
  }
  return null;
}

function heroPass(tl, items, tryChange, report) {
  const done = new Map(items.map((it) => [it.id, 0]));
  const failedAt = {};
  const add = (it, li, at) => {
    const how = heroInsert(tl, it, li, at, tryChange);
    if (how) {
      // a library / built object the builder has not placed yet: its timeline asset entry now (the builder's own shape)
      if (it.obj.asset && it.row?.blueprint) { tl.assets ??= {}; tl.assets[it.obj.asset] ??= { kind: "object", name: it.row.name ?? it.name, aliases: it.row.aliases ?? [], blueprint: it.row.blueprint }; }
      done.set(it.id, done.get(it.id) + 1); report.inserts.made.push({ item: it.name, line: li, at, how }); return true; }
    report.inserts.failed.push({ item: it.name, line: li, at, why: report.lastWhy ?? "no shot of the line can be split or spared" });
    (failedAt[it.id] ??= new Set()).add(li);
    return false;
  };
  const partOf = (li) => tl.lines?.[li]?.part ?? "";
  // first mention + payoff for every critical object
  // (a line whose only shot is too short to split: the item's next naming line for the first mention, the one before
  // for the payoff; the report keeps the line it could not take)
  for (const it of items) {
    let firstAt = null;
    for (const li of it.lines.slice(0, 3)) if (add(it, li, "first")) { firstAt = li; break; }
    const late = [...it.lines].reverse().filter((li) => li !== firstAt && li > (firstAt ?? -1));
    const pays = [...late.filter((li) => ["discovery", "climax", "closer"].includes(partOf(li))), ...late.filter((li) => !["discovery", "climax", "closer"].includes(partOf(li)))].slice(0, 3);
    for (const li of pays) if (add(it, li, "payoff")) break;
  }
  // short of the ~20 % insert share: one more on another line of the most important objects
  const PRI = { planted: 5, twist: 4, rule: 3, setpiece: 2, recurring: 1 };
  const order = [...items].sort((a, b) => b.why.reduce((s, w) => s + (PRI[w] ?? 0), 0) - a.why.reduce((s, w) => s + (PRI[w] ?? 0), 0));
  for (let round = 0; round < 3; round++) {
    for (const it of order) {
      const { c, n } = mixCounts(tl);
      if (c.insert / Math.max(1, n) >= TG.insert - GRAMMAR.tol / 2) return;
      if (done.get(it.id) >= GRAMMAR.maxPerItem) continue;
      const usedLines = new Set(tl.shots.filter((s) => isHeroOf(s, it)).flatMap((s) => s.lines ?? [s.line]));
      const li = it.lines.find((x) => !usedLines.has(x) && !failedAt[it.id]?.has(x));
      if (li != null) add(it, li, "extra");
    }
  }
}

/**
 * INSERTS 2026-11-10: the designed inserts (lib/insertKit.js designedInsertFor): one per line that names a time, a
 * countdown, days left, a screen with words, a wanted / missing poster, a notice, carved words or a sign with words
 * (at most GRAMMAR.designedMax a video, never on a line that already has a hero insert, never past the insert share
 * target + tol). Made like a hero insert (a spare shot of the line, else a split at a word), kept only when the checks
 * are no worse. -> report.inserts.designed [{ item, line, why, text, how }]
 */
function designedPass(tl, tryChange, report) {
  report.inserts.designed = [];
  const heroLines = new Set(tl.shots.filter((s) => s.hero).flatMap((s) => s.lines ?? [s.line]));
  let made = 0;
  (tl.lines ?? []).forEach((L, li) => {
    if (made >= GRAMMAR.designedMax || heroLines.has(li)) return;
    const d = designedInsertFor(L?.text, { cast: tl.cast });
    if (!d) return;
    const { c, n } = mixCounts(tl);
    if (c.insert / Math.max(1, n) > TG.insert + GRAMMAR.tol) { report.inserts.failed.push({ item: d.name, line: li, at: "designed", why: "the insert share is already over its target" }); return; }
    const obj = { name: d.name, state: d.state, facing: "camera", ...(d.text != null ? { text: d.text } : {}), ...(d.secs != null ? { secs: d.secs } : {}), ...(d.look ? { look: d.look } : {}) };
    const item = { id: `designed:${d.name}:${li}`, name: d.name.replace(/_/g, " "), why: [d.why], obj, lines: [li], big: false, row: null };
    const how = heroInsert(tl, item, li, "designed", tryChange);
    if (how) { made++; report.inserts.designed.push({ item: d.name, line: li, why: d.why, text: d.text ?? (d.secs != null ? `${d.secs}s` : null), how }); }
    else report.inserts.failed.push({ item: d.name, line: li, at: "designed", why: report.lastWhy ?? "no shot of the line can be split or spared" });
  });
}

// ------------------------------------------------------------------------------------------------ faces
/** the focus person of every character shot faces the lens (front; the over-shoulder: the near shoulder) */
function facePass(tl) {
  let fixed = 0;
  for (const s of tl.shots) {
    if (classOf(s) !== "character") continue;
    const a = (s.actors ?? []).find((x) => x.id === s.focus);
    if (!a || ["hug", "ride"].includes(a.pose)) continue;
    const near = (s.actors ?? []).find((x) => x.id !== a.id);
    const want = s.camera === "over_shoulder" && near && !(s.objects ?? []).length ? near.id : "camera";
    if ((a.facing ?? "camera") !== want) { a.facing = want; fixed++; }
  }
  return fixed;
}

// ------------------------------------------------------------------------------------------------ the mix
/** the longest time (s) without a wide of the world / town (lib/shotFlow.js recurring wide; hero inserts don't count) */
export function wideGap(tl) {
  const W = new Set(["aerial", "establish", "behind_army", "wide"]);
  const T = tl.duration ?? tl.shots.at(-1)?.end ?? 0;
  const marks = [0, ...tl.shots.filter((s) => !isCard(s) && !s.hero && W.has(s.camera)).map((s) => s.start), T];
  let g = 0;
  for (let k = 1; k < marks.length; k++) g = Math.max(g, marks[k] - marks[k - 1]);
  return g;
}

/** move the mix toward the targets: a person's wide -> their medium / closeup, a group wide -> the subject's medium, and back */
function balance(tl, tryChange, report, { maxGap = 12 } = {}) {
  const limit = maxGap + 1.5;
  for (let guard = 0; guard < 80; guard++) {
    const gap0 = Math.max(limit, wideGap(tl));
    const anchorGapOk = () => wideGap(tl) <= gap0 + 1e-6;
    const { c, n } = mixCounts(tl);
    const share = (k) => c[k] / Math.max(1, n);
    const before = dist(c, n);
    const under = CLASSES.filter((k) => share(k) < TG[k] - GRAMMAR.tol / 2).sort((a, b) => (share(a) - TG[a]) - (share(b) - TG[b]));
    const over = CLASSES.filter((k) => share(k) > TG[k] + GRAMMAR.tol / 2);
    if (!under.length && !over.length) break;
    let moved = false;
    // every (from, to) pair, the most-over source and the most-under target first; a change is kept only when the
    // distance to the targets shrinks (inserts are made by the hero pass, never by re-framing a person)
    const excess = (k) => share(k) - TG[k];
    const froms = CLASSES.filter((k) => k !== "insert").sort((a, b) => excess(b) - excess(a));
    const tos = CLASSES.filter((k) => k !== "insert").sort((a, b) => excess(a) - excess(b));
    void under; void over;
    for (const from of froms) {
      for (const to of tos) {
        if (from === to || excess(from) <= excess(to)) continue;
        const cands = tl.shots.map((s, i) => [s, i]).filter(([s, i]) => i > 0 && !isCard(s) && !s.hero && classOf(s) === from && !["threat", "reveal"].includes(s.seq) && !s.move && !s.beat);
        for (const [s, i] of cands) {
          const conv = convert(s, to);
          if (!conv) continue;
          const ok = tryChange(() => {
            const x = tl.shots[i];
            conv(x);
            if (classOf(x) !== to) return false;
            const m = mixCounts(tl);
            return dist(m.c, m.n) < before - 1e-9 && anchorGapOk();
          });
          if (ok) { report.balance.push({ shot: i, from, to, camera: tl.shots[i].camera }); moved = true; break; }
        }
        if (moved) break;
      }
      if (moved) break;
    }
    if (!moved) break;
  }
}

/** a function that turns shot s into class `to` (null when it can't) */
function convert(s, to) {
  const actors = s.actors ?? [];
  const persons = actors.filter((a) => a.id);
  const subj = actors.find((a) => a.id === s.subject) ?? actors.find((a) => a.id === s.focus) ?? actors.find((a) => a.id === "me") ?? actors[0];
  const epicFocus = /^(giant:|crowd|world$)/.test(String(s.focus)) || s.focus === "monster";
  if (to === "character") {
    if (!subj || epicFocus || s.focus === "object") return null;
    return (x) => { x.focus = subj.id; x.camera = (x.actors ?? []).length >= 2 ? "medium" : "closeup"; delete x.camMove; };
  }
  if (to === "world") {
    if (s.focus === "object" || /^giant:/.test(String(s.focus))) return null;
    if (persons.length > 1 && !(s.crowds ?? []).length) return null; // a group wide is "action"
    return (x) => { x.camera = "wide"; delete x.camMove; };
  }
  if (to === "action") {
    if (persons.length < 2 || persons.length > 5 || s.focus === "object" || epicFocus) return null;
    return (x) => { x.camera = "wide"; x.focus = "group"; if (x.subject && persons.some((a) => a.id === x.subject)) x.focus = x.subject; delete x.camMove; };
  }
  return null;
}

/**
 * The pass. check(tl) -> { name: count } (planVideo's four pre-render checks); a change is kept only when no count grows.
 * -> report { town, inserts, balance, faces, mix }
 */
export function shotGrammarPass(tl, { check = null, critical = null, production = null, targets = null } = {}) {
  TG = targetsOf(targets);
  const report = { targets: { ...TG }, town: { busy: 0, life: 0, army: 0, dogs: 0, reverted: 0 }, inserts: { made: [], failed: [], skipped: [] }, balance: [], faces: 0, reverted: 0 };
  if (!tl?.shots?.length) return report;
  let base = check ? check(tl) : null;
  const tryChange = (fn) => {
    const snap = clone(tl.shots);
    let ok = false;
    try { ok = fn(); } catch { ok = false; }
    if (!ok) { tl.shots = snap; report.lastWhy = "the framing rule (mix / wide gap / face)"; return false; }
    const now = check ? check(tl) : null;
    if (noWorse(now, base)) { base = now; report.lastWhy = null; return true; }
    report.lastWhy = `checks: ${Object.keys(now).filter((k) => (now[k] ?? 0) > (base[k] ?? 0)).join(", ")}`;
    tl.shots = snap; report.reverted++; return false;
  };
  // 1. the lived-in town (crowd cap + busy crowds + small life groups + a dog)
  townLife(tl, tryChange, report);
  // 2. hero inserts of every story-critical object (first mention + payoff)
  const { items, skipped } = heroItems(critical, production ?? tl.production, tl.shots);
  report.inserts.skipped = skipped;
  const tryHero = (fn) => { const g0 = Math.max(13.5, wideGap(tl)); return tryChange(() => fn() && wideGap(tl) <= g0 + 1e-6); };
  heroPass(tl, items, tryHero, report);
  // 2b. designed inserts (INSERTS 2026-11-10): a line naming a time / countdown / sign / poster / screen / notice
  designedPass(tl, tryHero, report);
  // 3. the framing mix toward the targets
  balance(tl, tryChange, report);
  // 4. faces: every character shot's focus person faces the lens (kept only when the checks are no worse)
  tryChange(() => { report.faces = facePass(tl); return true; });
  tl.shots.forEach((s, i) => {
    const why = faceProblem(s, tl.cast ?? {});
    if (!why || !/the head is/.test(why)) return;
    for (const cam of ["medium", "closeup"]) {
      if (cam === s.camera) continue;
      if (tryChange(() => { tl.shots[i].camera = cam; facePass(tl); return !faceProblem(tl.shots[i], tl.cast ?? {}); })) { report.faceCams = (report.faceCams ?? 0) + 1; break; }
    }
  });
  report.mix = mixReport(tl);
  report.after = base;
  delete report.lastWhy;
  return report;
}
