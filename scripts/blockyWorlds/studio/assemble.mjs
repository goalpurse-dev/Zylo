// STUDIO MODE: the studio plan (the agent's bible + assets + shots) -> a real engine timeline, and every check.
// The base timeline (planVideo with the real word timings) gives the voice, captions, lines, cast, the creature, the
// pets and the production list; its shots are REPLACED by the agent's cuts (set "board", each with `studio: <id>` so the
// page runs its code). Each cut also DECLARES what it puts on screen (people, creature, props, animals, its own built
// things as `shows` words): those declarations become the engine's own shot fields (lib/storyboard.js manifest), so the
// existing checks (checkTimeline, checkVisuals, checkSubjects, checkProduction, the storyboard's rule + action checks)
// run unchanged on it. The declarations are verified against the pixels by the vision review (the agent's own look).
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, "../engine");
const imp = (p) => import(pathToFileURL(path.join(ENGINE, p)).href);
const { checkTimeline, checkVisuals, checkSubjects, checkProduction } = await imp("plan.mjs");
const SB = await imp("lib/storyboard.js");
const { housesAt } = await imp("lib/scenes.js");

const r3 = (x) => Math.round(x * 1000) / 1000;
export const CAM_TYPES = ["wide", "medium", "closeup", "low", "over_shoulder", "insert", "two_shot"];
export const MIN_CUT = 0.5;

/** each line's words with their times (from the captions) */
export const lineWordsOf = (tl) => SB.lineWords(tl);

/** the cut times: shot -> { start, end } from its line + word index `w` (0 = the line's start) */
export function timingOf(tl, shots) {
  const words = SB.lineWords(tl), out = {}, problems = [];
  const sorted = [...shots].sort((a, b) => a.line - b.line || (a.w ?? 0) - (b.w ?? 0));
  const starts = sorted.map((s) => {
    const l = tl.lines[s.line]; if (!l) { problems.push(`${s.id}: no line ${s.line}`); return null; }
    const w = Number(s.w ?? 0);
    if (w === 0) return l.start;
    const W = words[s.line][w];
    if (!W) { problems.push(`${s.id}: line ${s.line} has no word ${w} (it has ${words[s.line].length})`); return null; }
    return W.start;
  });
  sorted.forEach((s, i) => {
    if (starts[i] == null) return;
    let j = i + 1; while (j < sorted.length && starts[j] == null) j++;
    const start = i === 0 ? 0 : starts[i], end = j < sorted.length ? starts[j] : tl.duration;
    out[s.id] = { start: r3(start), end: r3(end), dur: r3(end - start) };
  });
  for (const s of sorted) if (out[s.id] && out[s.id].dur < MIN_CUT - 1e-3) problems.push(`${s.id}: the cut is ${out[s.id].dur.toFixed(2)} s (min ${MIN_CUT} s): cut later or merge it`);
  for (const [n] of (tl.lines ?? []).entries()) if (!shots.some((s) => s.line === n)) problems.push(`line ${n}: no shot`);
  for (const [n] of (tl.lines ?? []).entries()) if (shots.some((s) => s.line === n) && !shots.some((s) => s.line === n && !(s.w > 0))) problems.push(`line ${n}: no shot starts at its first word (w: 0)`);
  const ids = shots.map((s) => s.id); for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) problems.push(`shot id ${id} is used twice`);
  return { timing: out, order: sorted.filter((s) => out[s.id]).map((s) => s.id), problems };
}

// the words a shot's board staging draws (a trimmed copy of lib/storyboard.js showsOf, which is not exported)
const PLACE_WORDS = { school: ["school", "classroom", "class", "desk", "desks", "teacher"], woods: ["woods", "forest", "trees", "tree", "path"], park: ["park", "trees", "bench", "pond", "grass", "square"], shop: ["shop", "store", "counter", "shelves", "till"] };
function showsOf(b, declared) {
  const out = new Set(["window", "windows"]);
  if (b.loc === "street" || b.loc.startsWith("house:")) ["street", "house", "houses", "town", "road"].forEach((w) => out.add(w));
  if (/^room:/.test(b.loc)) ["room", "house", "home"].forEach((w) => out.add(w));
  if (/^place:/.test(b.loc)) for (const w of PLACE_WORDS[b.loc.slice(6)] ?? []) out.add(w);
  for (const a of b.animals ?? []) [a.species, `${a.species}s`].forEach((w) => out.add(w));
  for (const pr of [...(b.props ?? []).map((x) => x.name), ...(b.people ?? []).map((x) => x.hold).filter(Boolean)]) { out.add(pr); out.add(`${pr}s`); }
  if (b.weather) [b.weather, `${b.weather}y`].forEach((w) => out.add(w));
  for (const w of declared ?? []) out.add(String(w).toLowerCase());
  return [...out];
}

/** the studio plan -> the timeline */
export function assemble(tl0, plan) {
  const tl = JSON.parse(JSON.stringify(tl0));
  const bible = plan.bible ?? {};
  const homes = bible.homes ?? {};
  const { timing, order, problems } = timingOf(tl, plan.shots);
  const byId = Object.fromEntries(plan.shots.map((s) => [s.id, s]));
  const sceneHouses = { houses: bible.houses ?? {}, houseEvents: bible.events ?? [] };
  const words = SB.lineWords(tl);
  const shots = order.map((id, i) => {
    const s = byId[id], T = timing[id], n = s.line;
    const inShot = words[n].filter((w) => w.start >= T.start - 1e-3 && w.start < T.end - 1e-3);
    const atOf = (word) => { if (!word) return 0; const w = inShot.find((x) => x.word.toLowerCase().replace(/[^a-z']/g, "") === String(word).toLowerCase()); return w ? r3(Math.max(0, w.start - T.start)) : 0; };
    const board = {
      loc: s.loc ?? "street", cam: s.cam ?? "street_wide", people: (s.people ?? []).map((p) => ({ ...p })), monster: s.monster ?? null,
      acts: (s.acts ?? []).map((a) => ({ ...a, at: atOf(a.at) })), ...(s.animals?.length ? { animals: s.animals.map((a) => ({ ...a })) } : {}),
      ...(s.props?.length ? { props: s.props } : {}), ...(s.weather ? { weather: s.weather } : {}),
      houses: housesAt(sceneHouses, n), before: housesAt(sceneHouses, n - 1), homes,
    };
    const shot = { start: T.start, end: T.end, line: n, lines: [n], part: tl0.lines[n]?.part ?? "tour", set: "board", light: s.light ?? "day", camera: CAM_TYPES.includes(s.camType) ? s.camType : "medium", insert: null, marker: null, seed: 900 + i, text: inShot.map((w) => w.word).join(" ") || tl.lines[n].text, studio: id, board };
    Object.assign(shot, SB.manifest(board));
    // the code's own things: the people it shows (beyond the staging), the creature (engine monster or a built one), pets
    // (a code-driven pose / face / held prop replaces the staged one: the checks see what the code draws)
    const EXPR = { worried: "scared", grin: "happy", shocked: "surprised", laugh: "happy", crying: "cry", teary: "sad", determined: "neutral", thinking: "neutral", wink: "happy" };
    for (const pid of s.codePeople ?? []) {
      const info = s.codeInfo?.[pid] ?? {};
      let a = shot.actors.find((x) => x.id === pid);
      if (!a) { a = { id: pid, spot: "center", pose: "stand", expr: "neutral", facing: "camera", hold: null, face: "neutral" }; shot.actors.push(a); }
      if (info.pose) a.pose = info.pose;
      if (info.face) { a.face = info.face; a.expr = EXPR[info.face] ?? info.face; }
      if (info.hold) a.hold = info.hold;
    }
    if ((s.creature || s.codeMonster) && !shot.monsterState) shot.monsterState = { spot: "back", state: "reveal", eye: "stare", eyeAt: 0 };
    for (const a of s.animals ?? []) if (a.pet) { const o = shot.objects.find((x) => x.name === a.species && !x.petSet); if (o) { o.pet = a.pet; o.petSet = true; } }
    for (const a of s.codeAnimals ?? []) if (a.pet && !shot.objects.some((x) => x.pet === a.pet)) shot.objects.push({ name: a.species, state: "on", pet: a.pet, facing: "camera", spot: "back" });
    for (const o of shot.objects) delete o.petSet;
    board.shows = showsOf(board, s.shows);
    // the line's subject, when this shot shows it (as lib/storyboard.js boardShot)
    const subjects = tl0.shots.filter((x) => x.line === n).map((x) => x.subject);
    const ids = shot.actors.map((a) => a.id);
    shot.subject = subjects.find((x) => x && ((x === "monster" && shot.monsterState) || ids.includes(x) || (x === "group" && ids.length > 1) || /^thing:/.test(x))) ?? null;
    if (shot.subject === "monster" || ids.includes(shot.subject)) shot.focus = shot.subject;
    // a cut ABOUT a pet that draws it: the pet is the focus (lib/pets.js: focus "object", the pet first in objects)
    const petId = String(shot.subject ?? "").replace(/^thing:/, "");
    const po = shot.objects.findIndex((o) => o.pet === petId);
    if (tl.pets?.[petId] && po >= 0) { const [o] = shot.objects.splice(po, 1); shot.objects.unshift(o); shot.focus = "object"; }
    // the story's opening world object (plan.mjs openingWorldProblems) declared on screen by the cut's code: recorded as
    // a met need (the page never reads needs; an unknown name in objects would break the page's object kit)
    const wo = tl.openingWorld;
    if (wo && (s.shows ?? []).some((w) => String(w).toLowerCase() === String(wo.name).toLowerCase())) shot.needs = [{ item: wo.id, name: wo.name, by: "studio" }];
    return shot;
  });
  tl.shots = shots;
  tl.storyboard = { id: "studio", rule: bible.rule ?? null, homes, rooms: bible.rooms ?? {} };
  tl.sceneHouses = sceneHouses;
  tl.scenes = [];
  if (tl.monster) { const c = SB.creatureCheck(tl.lines ?? [], bible.monsterVariant ?? null); tl.monster = { ...tl.monster, variant: c.variant }; tl.creature = c; }
  if (Array.isArray(tl.world?.sets) && !tl.world.sets.includes("board")) tl.world.sets.push("board");
  return { tl, timing, problems };
}

/** every check on an assembled timeline; `gate` = the ones that must be empty before the final render */
export function allChecks(tl, script, plan) {
  const board = { bible: { rule: plan.bible?.rule ?? { constraints: [] } } };
  // checkTimeline also fails the base plan's PRODUCTION LIST items ("line n misses the production items"): that list is
  // the free mock director's (studio mode has no paid director: the agent is the director), so its items are reported
  // with checkProduction and not gated; every other timeline problem (incl. its visuals pass) is gated
  const tlAll = checkTimeline(tl).filter((p) => !/unknown built asset/.test(p));
  const c = {
    timeline: tlAll.filter((p) => !/misses the production items/.test(p)),
    timelineProduction: tlAll.filter((p) => /misses the production items/.test(p)),
    visuals: checkVisuals(tl, script),
    subjects: checkSubjects(tl),
    production: checkProduction(tl),
    actions: SB.checkActions(tl),
    rule: SB.checkRule(tl, board),
  };
  const gate = ["timeline", "visuals", "subjects", "actions", "rule"].reduce((n, k) => n + c[k].length, 0);
  return { checks: c, gate, cuts: SB.cutStats(tl) };
}
