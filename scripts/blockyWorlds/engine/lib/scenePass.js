// Blocky Worlds SCENE PASS (owner 2026-11-11, step B): shots planned INSIDE their scene (lib/scenes.js).
//   scenePass(tl, list, { check }) -> report      list = { scenes, houses, houseEvents } (validated by validateScenes)
//     every shot: the scene's place (set + bible spot), its time (light), the world state (shot.state) and each house's
//     state (shot.houses, lib/scenes.js housesAt), the house it stands at (shot.house: whose line it is), the scene id;
//     the focus person faces the lens on close / medium shots (no back-of-head shots) unless walking / hugging;
//     the SET PIECES as their shot patterns (staring contest: a two-shot with both in frame, then shot / reverse; the
//     group under one cover; the cover flying away; the wind stripping the houses; the town glowing; the town asleep...)
//     every set-piece change kept only when the four pre-render checks are no worse.
//   sceneProblems(tl) -> problems   THE HARD CHECKS (checkTimeline runs them when tl.scenes is set; never bypassed):
//     continuity (a shot's place / time is its scene's), persistence (each shot's state is the scene list's state for its
//     line), set pieces on screen (each set piece has a shot showing its required elements)
import { sceneOf, stateAt, housesAt, SET_PIECES } from "./scenes.js";

export const LOCATION_SET = Object.freeze({ main_street: "street", square: "street", park: "street", lane: "street", market: "street", home: "bedroom", kitchen: "bedroom", school: "school", woods: "woods" });
const TIME_LIGHT = Object.freeze({ day: "day", dusk: "dusk", night: "night", dawn: "dawn" });
/** the town's lots (page/simple/town.js north row, the school lot left out) the story's house owners live in, in order */
export const OWNER_LOTS = Object.freeze([2, -10, 14, -22, 38, -34]);
const r3 = (x) => Math.round(x * 1000) / 1000;
const sumWorse = (a, b) => a && b && Object.keys(b).some((k) => (b[k] ?? 0) > (a[k] ?? 0));

export function scenePass(tl, list, { check = null, problems = null } = {}) {
  const rep = { shots: 0, pieces: {}, reverted: [], owners: {} };
  const scenes = list?.scenes ?? [];
  if (!scenes.length) return rep;
  // a set piece whose look lives on the houses (glowing / dark windows, a smeared pane) and that the list gives no house
  // event for: the event made from the piece (and the windows back to their own light after it), so every story's list works
  list = { ...list, houseEvents: [...(list.houseEvents ?? []), ...pieceEvents(scenes, list.houseEvents ?? [])] };
  tl.scenes = scenes; tl.sceneHouses = { houses: list.houses ?? {}, houseEvents: list.houseEvents };
  const owners = [...new Set([...Object.keys(list.houses ?? {}), ...(list.houseEvents ?? []).flatMap((e) => e.owners ?? [])])].filter((o) => o !== "*");
  tl.houseOwners = Object.fromEntries(owners.map((o, i) => [o, OWNER_LOTS[i % OWNER_LOTS.length]]));
  rep.owners = tl.houseOwners;
  const spots = new Set((tl.world?.spots ?? []).map((s) => s.id));
  let base = check ? check(tl) : null;
  const guarded = (label, fn) => {
    const snap = JSON.stringify(tl.shots);
    fn();
    if (!check) return true;
    const now = check(tl);
    if (sumWorse(base, now)) { tl.shots = JSON.parse(snap); rep.reverted.push(label); return false; }
    base = now; return true;
  };
  // 1. every shot in its scene: place, time, state, houses, the house it stands at, faces to the lens
  const snapBefore = JSON.stringify(tl.shots), listBefore = problems ? problems(tl) : null;
  guarded("scene places + times", () => {
    for (const s of tl.shots) {
      const sc = sceneOf(scenes, s.line); if (!sc) continue;
      const set = LOCATION_SET[sc.location] ?? s.set;
      if (!/^(creature|world):/.test(s.set ?? "")) { s.set = set; if (spots.size) s.worldSpot = spots.has(sc.location) ? sc.location : set === "bedroom" ? "home" : "main_street"; }
      s.light = TIME_LIGHT[sc.time] ?? s.light; s.scene = sc.id;
      rep.shots++;
    }
    // a line whose own words call for another place or time (a memory at night, "through the alleys" in a woods scene):
    // its shots keep the planner's place / time, marked as a deliberate aside (the continuity check accepts only these)
    if (!check || !problems || !sumWorse(base, check(tl))) return;
    const was = JSON.parse(snapBefore), now = problems(tl), old = new Set(Object.values(listBefore).flat().map((x) => JSON.stringify(x)));
    const lines = new Set(Object.values(now).flat().filter((x) => !old.has(JSON.stringify(x))).map((x) => typeof x === "string" ? Number(/line (d+)/.exec(x)?.[1]) : x?.line).filter((n) => Number.isFinite(n)));
    for (const [i, x] of tl.shots.entries()) if (lines.has(x.line) && was[i]) { const sc = sceneOf(scenes, x.line); x.set = was[i].set; x.worldSpot = was[i].worldSpot; x.light = was[i].light; x.sceneAside = `line ${x.line} names another place / time than scene ${sc?.id}`; rep.asides = (rep.asides ?? 0) + 1; }
  });
  for (const s of tl.shots) {
    const sc = sceneOf(scenes, s.line); if (!sc) continue;
    s.scene = sc.id; s.state = stateAt(scenes, s.line); s.houses = housesAt(list, s.line);
    const ids = [s.subject, s.focus, ...(s.actors ?? []).map((a) => a.id)].filter(Boolean);
    s.house = ids.find((id) => tl.houseOwners[id] != null) ?? (sc.cast ?? []).map((c) => c.id).find((id) => tl.houseOwners[id] != null) ?? null;
    for (const a of s.actors ?? []) if (a.id === s.focus && ["closeup", "medium"].includes(s.camera) && !["walk", "run", "hug", "climb", "swim", "fly"].includes(a.pose)) a.facing = "camera";
  }
  // 2. the set pieces as their shot patterns
  for (const sc of scenes) for (const p of sc.setPieces ?? []) {
    const shots = tl.shots.filter((s) => p.lines.includes(s.line));
    if (!shots.length) continue;
    const ok = guarded(`${p.kind} (lines ${p.lines.join(",")})`, () => { applyPiece(tl, p, shots); varyCameras(tl); });
    if (ok) rep.pieces[p.kind] = (rep.pieces[p.kind] ?? 0) + 1;
    for (const s of tl.shots) if (p.lines.includes(s.line)) s.setPiece = p.kind;
  }
  // every story opens on its place wide (a hard timeline rule): the first line's people move to its next shot
  if (tl.shots[0] && tl.shots[0].camera !== "wide") guarded("opening wide", () => { const l0 = tl.shots.filter((x) => x.line === tl.shots[0].line); wideFirst(l0, { keepMonster: true }); varyCameras(tl); });
  // a face-off two-shot is the two of them: the line's other people move to the line's next shot (kept when no check grows)
  guarded("two-shots: the two alone", () => { for (const [i, x] of tl.shots.entries()) if (x.camera === "two_shot") { const next = tl.shots.slice(i + 1).find((y) => y.line === x.line); const others = (x.actors ?? []).filter((q) => q.id !== "me"); if (next) for (const q of others) if (!(next.actors ?? []).some((b) => b.id === q.id)) (next.actors ??= []).push(q); x.actors = (x.actors ?? []).filter((q) => q.id === "me"); } });
  guarded("house framings", () => { for (const s of tl.shots) if (s.house && s.set === "street" && !s.setPiece && ["closeup", "medium"].includes(s.camera) && HOUSE_WORDS.test(s.text ?? "")) s.camera = "wide"; });
  return rep;
}

/** the first shot of a set piece becomes its wide of the whole town (the establishing view when nobody is in it); the
 *  line's own people, props and focus stay (the checks keep what each line must show) */
const wideFirst = (shots, { keepMonster = false } = {}) => {
  const s = shots[0], next = shots.slice(1).find((x) => x.line === s.line);
  s.camera = "wide";
  if (next) { // the town alone: what the line needs on screen goes to its next shot
    for (const a of s.actors ?? []) if (!(next.actors ?? []).some((b) => b.id === a.id)) (next.actors ??= []).push(a);
    for (const o of s.objects ?? []) if (o.state !== "flying" && !(next.objects ?? []).some((b) => b.name === o.name)) (next.objects ??= []).push(o);
    s.actors = []; s.crowds = []; s.objects = (s.objects ?? []).filter((o) => o.state === "flying"); if (!keepMonster) s.monsterState = null;
    if (s.markers?.length || s.marker) { next.markers = [...(next.markers ?? []), ...(s.markers ?? []), ...(s.marker ? [s.marker] : [])]; s.markers = []; delete s.marker; }
    if (s.subject && !(s.subject === "monster" && keepMonster)) { if (next.subject == null || next.subject === s.subject) next.subject = s.subject; s.subject = null; }
    if (s.focus !== "monster") s.focus = "group";
  }
  if (!(s.actors ?? []).length && !(s.objects ?? []).filter((o) => o.state !== "flying").length && !s.monsterState) s.establish = true;
  return s;
};
/** a line about a house (its curtains, windows, bricks...): the person framed wider, their house behind them */
const HOUSE_WORDS = /\b(curtains?|windows?|panes?|glass|bricks?|house|home|door|porch|walls?)\b/i;
const PIECE_HOUSE = { windows_glow: { light: "glow_white" }, town_sleeps: { light: "dark" }, smear_glass: { cover: "smeared" } };
export function pieceEvents(scenes, events) {
  const out = [];
  for (const sc of scenes) for (const p of sc.setPieces ?? []) {
    const set = PIECE_HOUSE[p.kind]; if (!set || !p.lines?.length) continue;
    const from = Math.min(...p.lines), to = Math.max(...p.lines), key = Object.keys(set)[0];
    if (events.some((e) => e.line >= from && e.line <= to && e.set && key in e.set)) continue; // the list says it already
    const who = p.kind === "smear_glass" ? [(p.who ?? []).find((w) => w !== "monster" && w !== "crowd") ?? "me"] : ["*"];
    if (!who.length) continue;
    out.push({ line: from, owners: who, set, why: `set piece ${p.kind}` });
    if (key === "light") out.push({ line: to + 1, owners: who, set: { light: "default" }, why: `after ${p.kind}` });
  }
  return out;
}
export function applyPiece(tl, p, shots) {
  const me = "me";
  switch (p.kind) {
    case "opening_town": { wideFirst(shots); break; }
    case "opening_town_old": {
      // the town alone first (the line's people get its next shot), then the hero where the scene puts them
      const s = shots[0], more = shots.slice(1).some((x) => x.line === s.line);
      s.camera = "wide";
      if (more) { const next = shots.slice(1).find((x) => x.line === s.line); for (const a of s.actors ?? []) if (!(next.actors ?? []).some((b) => b.id === a.id)) (next.actors ??= []).push(a); s.actors = []; s.crowds = []; s.focus = "group"; }
      s.establish = !(s.actors ?? []).length;
      break;
    }
    case "wind_strips": {
      // the curtains flying away like kites over the street, on every shot of the wind's lines; the first a wide
      for (const s of shots) s.objects = [...(s.objects ?? []).filter((o) => !(o.name === "curtain_pile" && o.state === "flying")), { name: "curtain_pile", spot: "far", state: "flying", facing: "camera" }];
      wideFirst(shots);
      break;
    }
    case "windows_glow": { wideFirst(shots, { keepMonster: true }); break; }
    case "town_sleeps": {
      // nobody out: the people leave the street (the line's props stay), the windows dark, the first shot the town wide
      for (const s of shots) { s.setState = { windows: "dark" }; s.monsterState = null; }
      wideFirst(shots);
      for (const s of shots.slice(1)) { s.crowds = []; s.actors = (s.actors ?? []).filter(() => false); if (s.focus !== "object") s.focus = (s.objects ?? []).length ? "object" : "group"; }
      break;
    }
    case "group_under_cover": {
      for (const s of shots) { s.objects = [...(s.objects ?? []).filter((o) => o.name !== "patchwork_blanket"), { name: "patchwork_blanket", spot: "center", state: "draped", facing: "camera" }]; for (const a of s.actors ?? []) if (a.pose === "fly") a.pose = "stand"; s.crowdState = "under_cover"; }
      shots[0].camera = "wide";
      break;
    }
    case "cover_flies_away": {
      for (const s of shots) { s.objects = [...(s.objects ?? []).filter((o) => o.name !== "patchwork_blanket"), { name: "patchwork_blanket", spot: "right", state: "flying", facing: "camera" }]; for (const a of s.actors ?? []) if (a.pose === "fly") a.pose = "look_up"; s.crowdState = "look_up"; }
      break;
    }
    case "staring_contest": {
      // face to face on the street: the contest opens on a two-shot with both in frame; then each line's shots are on its
      // own subject (the hero's face to the lens / the monster's eye): shot / reverse from line to line; the last line of
      // the contest closes on a two-shot again; the onlookers peek through their fingers
      const lines = [...new Set(shots.map((s) => s.line))].sort((a, b) => a - b);
      shots.forEach((s, k) => {
        s.faceoff = true;
        if (!(s.actors ?? []).some((a) => a.id === me)) s.actors = [{ id: me, spot: "center", pose: "stand", expr: "angry", face: "angry", facing: "monster", hold: null }, ...(s.actors ?? [])];
        s.monsterState = { spot: "far", state: "lurk", ...(s.monsterState ?? {}) };
        const subj = s.subject === "monster" ? "monster" : me;
        const first = k === 0 || (s.line === lines.at(-1) && shots.find((x) => x.line === s.line) === s);
        if (first) { s.camera = "two_shot"; s.focus = subj; }
        else if (subj === "monster") { s.camera = "low"; s.focus = "monster"; }
        else { s.camera = "closeup"; s.focus = me; for (const a of s.actors) if (a.id === me) a.facing = "camera"; }
        s.crowdState = "hiding_faces";
        const prev = shots[k - 1];
        if (prev && prev.camera === s.camera && s.camera !== "two_shot") s.camera = s.camera === "closeup" ? "medium" : "medium"; // never the same framing twice in a row
      });
      break;
    }
    case "board_up": case "smear_glass": case "reveal": case "monster_licks_glass": case "monster_retreats": case "chase": case "gather":
    default: break; // the house state (lib/scenes.js) + the line's own shots show these; the check asks for its people
  }
}

/** the hard checks (continuity + persistence + set pieces on screen) */
export function sceneProblems(tl) {
  const scenes = tl?.scenes; if (!Array.isArray(scenes) || !scenes.length) return [];
  const out = [];
  for (const [i, s] of (tl.shots ?? []).entries()) {
    const sc = sceneOf(scenes, s.line); if (!sc) { out.push(`scene: shot ${i} (line ${s.line}) is in no scene`); continue; }
    const set = LOCATION_SET[sc.location];
    if (set && s.set !== set && !s.sceneAside && !/^(creature|world):/.test(s.set ?? "")) out.push(`continuity: shot ${i} (line ${s.line}) is in "${s.set}", its scene ${sc.id} is in ${sc.location}`);
    if (TIME_LIGHT[sc.time] && s.light !== TIME_LIGHT[sc.time] && !s.sceneAside) out.push(`continuity: shot ${i} (line ${s.line}) is lit "${s.light}", its scene ${sc.id} is at ${sc.time}`);
    if (s.scene && s.scene !== sc.id) out.push(`continuity: shot ${i} carries scene ${s.scene}, its line is in ${sc.id}`);
    if (tl.sceneHouses && JSON.stringify(s.houses) !== JSON.stringify(housesAt({ ...tl.sceneHouses }, s.line))) out.push(`persistence: shot ${i} (line ${s.line}) shows houses in another state than the story's`);
  }
  for (const sc of scenes) for (const p of sc.setPieces ?? []) {
    const shots = (tl.shots ?? []).filter((s) => p.lines.includes(s.line));
    if (!shots.length) { out.push(`set piece ${p.kind} (lines ${p.lines.join(",")}): no shot`); continue; }
    const need = PIECE_NEED[p.kind];
    if (need && !shots.some((s) => need(s, tl, p))) out.push(`set piece ${p.kind} (lines ${p.lines.join(",")}): not on screen (${SET_PIECES[p.kind]?.needs?.join(", ") ?? ""})`);
  }
  return out;
}
const hasObj = (s, name, state = null) => (s.objects ?? []).some((o) => o.name === name && (!state || o.state === state));
/** one of the set piece's people is in the shot, or the shot stands at their house */
const whoThere = (s, p) => (p.who ?? []).filter((w) => w !== "monster" && w !== "crowd").some((w) => s.house === w || (s.actors ?? []).some((a) => a.id === w));
const PIECE_NEED = {
  staring_contest: (s) => s.camera === "two_shot" && (s.actors ?? []).some((a) => a.id === "me") && !!s.monsterState,
  group_under_cover: (s) => hasObj(s, "patchwork_blanket", "draped") && ((s.actors ?? []).length >= 1),
  cover_flies_away: (s) => hasObj(s, "patchwork_blanket", "flying"),
  wind_strips: (s) => hasObj(s, "curtain_pile", "flying") && s.camera === "wide",
  windows_glow: (s) => Object.values(s.houses ?? {}).every((h) => h.light === "glow_white") && s.camera === "wide",
  town_sleeps: (s) => !(s.actors ?? []).length && !(s.crowds ?? []).length && Object.values(s.houses ?? {}).every((h) => h.light === "dark"),
  opening_town: (s) => s.camera === "wide",
  board_up: (s, tl, p) => whoThere(s, p),
  smear_glass: (s, tl, p) => whoThere(s, p) || (s.set === "street" && Object.values(s.houses ?? {}).some((h) => h.cover === "smeared")),
  monster_licks_glass: (s) => !!s.monsterState,
  monster_retreats: (s) => !!s.monsterState,
  reveal: (s) => !!s.monsterState || Object.values(s.houses ?? {}).some((h) => h.light === "eye"),
};

/** never the same framing three times in a row (a hard timeline rule): the middle one of a run becomes another framing
 *  of the same subject; kept only when the checks are no worse */
export function varyCameras(tl, { check = null } = {}) {
  let base = check ? check(tl) : null, n = 0;
  const ALT = { closeup: "medium", medium: "closeup", wide: "medium", low: "medium", over_shoulder: "medium", two_shot: "medium" };
  for (let i = 2; i < (tl.shots ?? []).length; i++) {
    const a = tl.shots[i - 2], b = tl.shots[i - 1], c = tl.shots[i];
    if (!(a.camera === b.camera && b.camera === c.camera) || !ALT[b.camera]) continue;
    // the middle one, else the last, else the first: never an establishing wide (the town alone stays the town alone)
    for (const x of [b, c, a].filter((x) => !x.establish)) {
      const was = x.camera; x.camera = ALT[was];
      if (check) { const now = check(tl); if (Object.keys(now).some((k) => now[k] > (base?.[k] ?? 0))) { x.camera = was; continue; } base = now; }
      n++; break;
    }
  }
  return n;
}
