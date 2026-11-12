// Blocky Worlds STORYBOARD (owner 2026-11-11): a storyboard (lib/storyboards/*.js: per line what we SEE: place,
// inside / outside, who, the visible action verb -> an animated action, the camera) drives the shots. Lines marked
// keep take the planned engine shots (optionally one replaced). Board shots render on the "board" set
// (page/simple/board.js).
//   applyStoryboard(tl, board) -> a new timeline (the voice, captions, cast, audio untouched)
//   THE HARD CHECKS (never bypassed; any problem stops the render):
//     checkRule(tl, board)     the rule's constraints on the world (after dark: nobody outside, people indoors)
//     checkActions(tl, board)  every action verb of a line = an animated action (lib/boardActions.js) in its shots
//     checkPlaces(tl, board)   each shot where its line says (a line about Mr. Hollis at home is at HIS house)
//     checkBoard(tl, board)    every line covered, every key / place / person known
import { BOARD_ACTIONS, verbsOf, actsOfEngineShot } from "./boardActions.js";
import { housesAt as sceneHousesAt, sceneOf } from "./scenes.js";

const r3 = (x) => Math.round(x * 1000) / 1000;
const tok = (s) => String(s).split(/\s+/).filter(Boolean);
const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9']/g, "");

/** each line's words with their times, from the timeline's captions (one caption per spoken word, in order) */
export function lineWords(tl) {
  const caps = tl.captions ?? [];
  let k = 0;
  return (tl.lines ?? []).map((l) => { const n = tok(l.text).length, w = caps.slice(k, k + n); k += n; return w; });
}

/** the storyboard's world state as the scene list's houses (lib/scenes.js): { houses, houseEvents } */
export const sceneHousesOf = (board) => ({ houses: board.bible.houses, houseEvents: board.bible.events ?? [] });
/** the houses' window state at a line (the scene list's: an event changes them from its line on) */
export const housesAt = (board, line) => sceneHousesAt(sceneHousesOf(board), line);
export const houseOf = (houses, id) => houses?.[id] ?? houses?.["*"] ?? null;

/** the scene list from the storyboard: its lines grouped by place + time; kept lines keep their planned scene (and its
 *  set pieces when all their lines are kept) */
export function scenesOf(tl0, board) {
  const out = [], old = tl0.scenes ?? [];
  for (const [n] of (tl0.lines ?? []).entries()) {
    const b = board.lines.find((x) => x.line === n);
    let sc;
    if (b.keep) { const o = sceneOf(old, n); sc = { ...o, id: o.id, location: o.location, time: o.time }; }
    else { const time = b.shots[0].light ?? "night"; sc = { id: `b${n}`, location: b.place ?? "street", time, cast: [], happens: "storyboard", board: true }; }
    const last = out.at(-1);
    const same = last && (sc.board ? last.board && last.location === sc.location && last.time === sc.time : last.id === sc.id);
    if (same) last.to = n; else out.push({ ...sc, from: n, to: n });
  }
  for (const sc of out) { if (sc.board) { sc.id = `b${sc.from}`; sc.setPieces = []; } else sc.setPieces = (sc.setPieces ?? []).filter((p) => p.lines.every((l) => l >= sc.from && l <= sc.to && board.lines.find((x) => x.line === l)?.keep)); }
  return out;
}

export function applyStoryboard(tl00, board) {
  // bible.drop: people the planner invented who are not in the story (#2: "Pell" is Dottie's surname, not a kid)
  const tl0 = JSON.parse(JSON.stringify(tl00));
  for (const id of board.bible.drop ?? []) {
    delete tl0.cast?.[id];
    for (const k of ["people", "gender"]) if (tl0.visualWorld?.[k]) delete tl0.visualWorld[k][id];
    if (Array.isArray(tl0.visualWorld?.looseNames)) tl0.visualWorld.looseNames = tl0.visualWorld.looseNames.filter((x) => x !== id);
    for (const s of tl0.shots) { s.actors = (s.actors ?? []).filter((a) => a.id !== id); if (s.focus === id) s.focus = s.actors[0]?.id ?? "group"; if (s.subject === id) s.subject = s.actors[0]?.id ?? null; }
    for (const sc of tl0.scenes ?? []) sc.cast = (sc.cast ?? []).filter((c) => c.id !== id);
    if (tl0.production?.perLine) for (const l of tl0.production.perLine) l.required = (l.required ?? []).filter((r) => r.id !== id);
  }
  const tl = JSON.parse(JSON.stringify(tl0));
  const words = lineWords(tl);
  const total = words.reduce((a, w) => a + w.length, 0);
  if (total !== (tl.captions ?? []).length) throw new Error(`storyboard: the lines have ${total} words, the captions ${(tl.captions ?? []).length}`);
  const shots = [];
  for (const [n, l] of tl.lines.entries()) {
    const b = board.lines.find((x) => x.line === n);
    if (!b) throw new Error(`storyboard: line ${n} has no entry`);
    const old = tl0.shots.filter((s) => s.line === n).map((s) => { const c = JSON.parse(JSON.stringify(s)); for (const f of b.drop ?? []) delete c[f]; return c; }); // drop: e.g. the crowds of a kept night street shot (the rule: people indoors)
    if (b.keep) {
      old.forEach((s, k) => {
        const rep = b.replace?.[k];
        if (rep) { const reps = Array.isArray(rep) ? rep : [rep], d = (s.end - s.start) / reps.length; reps.forEach((r, j) => shots.push(boardShot(r, { n, l, t0: s.start + j * d, t1: s.start + (j + 1) * d, words: words[n], board, seed: (s.seed ?? 1) + j, part: s.part, subjects: [s.subject] }))); return; } // several board shots: quick cuts in the old shot's time
        const c = JSON.parse(JSON.stringify(s));
        // faces: the storyboard's expression for a person on this line (Nell DETERMINED in the face-off)
        for (const a of c.actors ?? []) if (b.shotFaces?.[k]?.[a.id] ?? b.faces?.[a.id]) { const fc = b.shotFaces?.[k]?.[a.id] ?? b.faces[a.id]; a.face = fc; a.expr = ({ teary: "sad", determined: "angry", worried: "scared", shocked: "surprised", grin: "happy" })[a.face] ?? a.face; delete a.faces; } // expr: the planner's word; face: the drawn face
        shots.push(c);
      });
      continue;
    }
    const W = words[n];
    const starts = b.shots.map((s, i) => {
      if (!i) return l.start;
      const w = W.find((x) => norm(x.word) === norm(s.at));
      if (!w) throw new Error(`storyboard line ${n}: no word "${s.at}"`);
      return w.start;
    });
    b.shots.forEach((s, i) => shots.push(boardShot(s, { n, l, t0: starts[i], t1: i + 1 < starts.length ? starts[i + 1] : l.end, words: W, board, seed: 700 + n * 7 + i, part: old[0]?.part ?? "tour", subjects: old.map((x) => x.subject) })));
  }
  // the shots tile the voice: each starts where the one before ended
  for (let i = 1; i < shots.length; i++) shots[i].start = shots[i - 1].end;
  shots[0].start = 0; shots.at(-1).end = tl.duration;
  tl.shots = shots;
  // the storyboard drives the scene list and the world state: every shot in its scene, with the houses of its line
  tl.scenes = scenesOf(tl0, board);
  tl.sceneHouses = sceneHousesOf(board);
  for (const s of tl.shots) { s.scene = sceneOf(tl.scenes, s.line)?.id ?? null; s.houses = sceneHousesAt(tl.sceneHouses, s.line); if (s.board) s.board.houses = s.houses; }
  // THE CREATURE: the variant the director picked, made to match how the SCRIPT describes it (creatureCheck)
  if (tl.monster) { const c = creatureCheck(tl.lines ?? [], board.bible.monster?.variant); tl.monster = { ...tl.monster, variant: c.variant }; tl.creature = c; }
  tl.storyboard = { id: board.id, rule: board.bible.rule, homes: board.bible.homes, rooms: board.bible.rooms ?? {} }; // rooms: each room's furniture (page/simple/board.js)
  if (Array.isArray(tl.world?.sets) && !tl.world.sets.includes("board")) tl.world.sets.push("board"); // the storyboard's own town joins the world bible
  // the production list's items as the storyboard shows them (board.kit: id -> { kitName, crowdKind }): the same
  // required items per line, checked on the storyboard's shots (an item never drops out of the list)
  if (board.kit && tl.production?.perLine) for (const l of tl.production.perLine) l.required = (l.required ?? []).map((r) => (board.kit[r.id] ? { ...r, ...board.kit[r.id], route: board.kit[r.id].route ?? (r.route === "card" ? "kit" : r.route) } : r));
  return tl;
}

/** a storyboard shot shows: "house:<id>" (the house, or its room) | "cover:<c>" (a house in view with that cover) */
export function boardHas(s, what) {
  const b = s.board;
  if (!b) return what === "window" && (s.objects ?? []).some((o) => o.name === "house_front"); // an engine shot: its house front
  const [k, v] = String(what).split(":");
  const inView = housesInView(b);
  if (k === "house") return inView.includes(v);
  if (k === "window") return !/^(sky_up|eye_close)$/.test(b.cam); // every board place shows a house window (a room's own window)
  if (k === "cover") return inView.some((h) => houseOf(b.houses, h)?.cover === v || (v === "bricks" && houseOf(b.houses, h)?.bricks));
  return false;
}

// the camera type of a board camera preset (the planner's variety + framing checks read it)
const CAM_TYPE = [[/^(face|eye_close|peek|window_in)/, "closeup"], [/^(cat)/, "low"], [/^(town_wide|street_wide|street_back|house:|arrive:|front:)/, "wide"], [/^(street_end|sky_up|pov_window|pov_eye)/, "low"], [/^(room_window|behind_window)/, "over_shoulder"], [/^(room_wide)/, "wide"]];
const camTypeOf = (cam) => CAM_TYPE.find(([re]) => re.test(cam))?.[1] ?? "medium";
// the words a board shot draws (windows everywhere outside and in every room; the actions' things)
const ACT_SHOWS = { "fly:curtains": ["curtains", "kites", "kite"], "rip:curtains": ["curtains", "wind"], "smear:batter": ["batter", "pancake"], "lick:glass": ["batter", "tongue"], "bulge:curtains": ["curtains", "cloud"], "poke_out:cat": ["curtains"], "stack:bricks": ["bricks", "wall"], "nail:boards": ["boards", "painting", "boat"], "grab:boards": ["boards", "hammer"], "huddle:blanket": ["blanket"], "blow_off:blanket": ["blanket"], "peek:sock": ["sock", "hole"], "pull:sock": ["sock"] };
function showsOf(b) {
  const out = new Set(["window", "windows", "glass", "pane", "panes"]);
  if (b.loc === "street" || b.loc.startsWith("house:")) ["street", "house", "houses", "town"].forEach((w) => out.add(w));
  const PLACE_WORDS = { school: ["school", "classroom", "class", "desk", "desks", "teacher"], woods: ["woods", "forest", "trees", "tree", "path"], park: ["park", "trees", "bench", "pond", "grass", "square"], shop: ["shop", "store", "counter", "shelves", "till"] };
  if (/^place:/.test(b.loc)) for (const w of PLACE_WORDS[b.loc.slice(6)] ?? []) out.add(w);
  for (const a of b.animals ?? []) [a.species, `${a.species}s`].forEach((w) => out.add(w));
  if (b.weather) [b.weather, `${b.weather}y`].forEach((w) => out.add(w));
  for (const a of b.acts) for (const w of ACT_SHOWS[a.k] ?? []) out.add(w);
  for (const h of housesInView(b)) { const c = houseOf(b.houses, h)?.cover; if (c && c !== "bare") (c === "sock" ? ["sock", "hole"] : ["curtains", "curtain"]).forEach((w) => out.add(w)); if (houseOf(b.houses, h)?.bricks) ["bricks", "wall"].forEach((w) => out.add(w)); }
  return [...out];
}

function boardShot(s, { n, l, t0, t1, words, board, seed, part, subjects = [] }) {
  const inShot = words.filter((w) => w.start >= t0 - 1e-3 && w.start < t1 - 1e-3);
  const at = (word) => { if (!word) return 0; const w = inShot.find((x) => norm(x.word) === norm(word)) ?? words.find((x) => norm(x.word) === norm(word)); return w ? r3(Math.max(0, w.start - t0)) : 0; };
  const camType = camTypeOf(s.cam);
  const houses = housesAt(board, n);
  const shot = {
    start: r3(t0), end: r3(t1), line: n, lines: [n], part, set: "board", light: s.light ?? "night", camera: camType,
    insert: null, marker: null, seed,
    text: inShot.map((w) => w.word).join(" ") || l.text,
    board: { loc: s.loc, cam: s.cam, people: s.people ?? [], monster: s.monster ?? null, acts: (s.acts ?? []).map((a) => ({ ...a, at: at(a.at) })), houses, before: housesAt(board, n - 1), homes: board.bible.homes }, // before: the houses as the line starts (what the wind rips off, the sock pulled)
  };
  Object.assign(shot, manifest(shot.board));
  shot.board.shows = showsOf(shot.board);
  // the line's subject (as planned), when this shot shows it
  const ids = shot.actors.map((a) => a.id);
  shot.subject = subjects.find((x) => x && ((x === "monster" && shot.monsterState) || ids.includes(x) || (x === "group" && ids.length > 1) || /^thing:/.test(x))) ?? null;
  if (shot.subject === "monster" || ids.includes(shot.subject)) shot.focus = shot.subject; // the camera is on the line's subject
  return shot;
}

// what a board shot puts on screen, in the engine's own terms (actors, objects by kit name, the monster, the
// windows): the planner's visuals / subjects / production checks read these. page/simple/board.js draws exactly
// these things for the same spec (people, the monster, every house's windows in view, each action's props).
const HOLD = { "grab:boards": "hammer", "nail:boards": "hammer", "smear:batter": "pancake", "pull:sock": "sock" };
const ACT_OBJ = {
  "rip:curtains": [{ name: "curtain_pile", state: "flying" }, { name: "wind_gust" }], "fly:curtains": [{ name: "curtain_pile", state: "flying" }],
  "poke_out:cat": [{ name: "cat", state: "on", pet: "cat" }], "stare:cat": [{ name: "cat", state: "on", pet: "cat" }], "peek:sock": [{ name: "item", state: "sock" }, { name: "hole" }],
  "catch:peeking": [{ name: "item", state: "sock" }], "pull:sock": [], "huddle:blanket": [{ name: "patchwork_blanket", state: "draped" }],
  "blow_off:blanket": [{ name: "patchwork_blanket", state: "flying" }], "nail:boards": [{ name: "boat_painting", state: "boarded" }], "stack:bricks": [{ name: "wall" }],
  "bulge:curtains": [{ name: "cloud", state: "plain" }],
};
const COVER_OBJ = { curtained: { name: "curtain_pile", state: "window" }, bulging: { name: "curtain_pile", state: "window" }, thin: { name: "curtain_pile", state: "thin" }, sock: { name: "item", state: "sock" } };
/** the houses a camera shows (lib side of page/simple/board.js camFor): all on a street view, one at a house / room */
export function housesInView(b) {
  if (b.loc === "street") return /^(houses|front):/.test(b.cam) ? b.cam.split(":").slice(1) : /^(eye_close|sky_up)$/.test(b.cam) ? [] : Object.keys(b.homes);
  if (/^place:/.test(b.loc)) return []; // a school / woods / park / shop: no houses in view
  const h = b.loc.split(":")[1];
  return h ? [h] : [];
}
export function manifest(b) {
  const keys = new Set(b.acts.map((a) => a.k));
  const actors = b.people.map((p) => {
    const act = b.acts.find((a) => a.who === p.id && HOLD[a.k]);
    return { id: p.id, spot: "center", pose: ({ cover_mouth: "scared" })[p.pose] ?? p.pose ?? (p.where === "room:bed" && !p.awake ? "sleep" : "stand"), expr: ({ worried: "scared", thinking: "neutral", grin: "happy", shocked: "surprised" })[p.face] ?? p.face ?? "neutral", facing: "camera", hold: act ? HOLD[act.k] : null, face: p.face ?? "neutral" };
  });
  const objects = [];
  const add = (o) => { if (!objects.some((x) => x.name === o.name && x.state === o.state)) objects.push({ ...o, facing: "camera", spot: "back" }); };
  if (b.loc === "street" || b.loc.startsWith("house:")) add({ name: "house_front" });
  const inView = housesInView(b);
  // inside a room: its own window (the house's cover: the sock, the curtains, the bricks)
  const changing = [...keys].some((k) => /^(rip:curtains|pull:sock|lick:glass)$/.test(k)); // the line's change happens on screen: the old state is drawn too
  for (const h of inView) for (const st of [houseOf(b.houses, h), ...(changing ? [houseOf(b.before, h)] : [])]) { if (!st) continue; if (COVER_OBJ[st.cover]) add(COVER_OBJ[st.cover]); if (st.bricks) add({ name: "wall" }); }
  for (const k of keys) for (const o of ACT_OBJ[k] ?? []) add(o);
  const m = b.monster;
  const monsterState = m ? { spot: "back", state: m.state === "flee" ? "flee" : m.state === "lurk" ? "lurk" : "reveal", eye: m.eye ?? "stare", eyeAt: b.acts.find((a) => /:eye$/.test(a.k))?.at ?? 0 } : null;
  const setState = keys.has("glow:windows") || keys.has("lights_on:windows") ? { windows: "lit" } : keys.has("dark:windows") ? { windows: "dark" } : null;
  const ids = actors.map((a) => a.id);
  const focus = ids.length === 1 ? ids[0] : ids.length > 1 ? "group" : m ? "monster" : objects.length ? "object" : "group";
  return { actors, objects, monsterState, ...(setState ? { setState } : {}), focus };
}

// ------------------------------------------------------------------------------------------------ the hard checks
const NIGHT = (light) => ["night", "dusk"].includes(light);
const outsidePeople = (s) => {
  if (s.board) return s.board.loc === "street" || s.board.loc.startsWith("house:") || /^place:(woods|park)$/.test(s.board.loc) ? s.board.people.filter((p) => !/^(window|room):/.test(p.where)).map((p) => p.id) : [];
  if (s.set !== "street") return [];
  return [...(s.actors ?? []).map((a) => a.id), ...((s.crowds ?? []).length ? ["crowd"] : [])];
};

export function checkRule(tl, board) {
  const out = [];
  for (const c of board.bible.rule?.constraints ?? []) {
    tl.shots.forEach((s, i) => {
      if (!c.when.includes(s.light)) return;
      if (c.outside === "empty" || c.people === "indoors") {
        const bad = outsidePeople(s).filter((id) => !(c.except ?? []).some((e) => e.who === id && s.line >= (e.fromLine ?? 0)));
        if (bad.length) out.push(`shot ${i} (line ${s.line}, ${s.light}): ${bad.join(", ")} outside after dark breaks the rule (${c.why})`);
      }
    });
  }
  return out;
}

export function checkActions(tl) {
  const out = [];
  for (const [n, l] of (tl.lines ?? []).entries()) {
    const shots = tl.shots.filter((s) => s.line === n);
    const acts = new Set(shots.flatMap((s) => (s.board ? s.board.acts.map((a) => a.k) : actsOfEngineShot(s))));
    for (const v of verbsOf(l.text)) if (!v.keys.some((k) => acts.has(k))) out.push(`line ${n}: "${v.verb}" is not animated on screen (wants ${v.keys.join(" | ")}; the shots animate ${[...acts].join(", ") || "nothing"})`);
  }
  for (const [i, s] of tl.shots.entries()) for (const a of s.board?.acts ?? []) if (!BOARD_ACTIONS[a.k]) out.push(`shot ${i}: unknown action "${a.k}"`);
  return out;
}

const homeOf = (loc) => (/^(house|room):/.test(loc) ? loc.split(":")[1] : null);
export function checkPlaces(tl, board) {
  const out = [], homes = board.bible.homes ?? {}, cast = tl.cast ?? {};
  for (const b of board.lines) {
    if (b.keep && !b.replace) continue;
    const l = tl.lines[b.line], shots = tl.shots.filter((s) => s.line === b.line && s.board);
    // the line's own subject (a house owner named at its start) does it at home
    const named = Object.keys(homes).filter((id) => cast[id]?.name && new RegExp(`^(${String(cast[id].name).replace(/[.]/g, "\\.")}|${String(cast[id].name).split(/\s+/).at(-1)})\\b`, "i").test(l.text.trim()));
    for (const id of named) if (b.place && b.place !== `home:${id}` && !b.away) out.push(`line ${b.line}: about ${cast[id].name} but placed at ${b.place} (their scene is at their own house)`);
    for (const s of shots) {
      const want = b.place ?? "street", h = homeOf(s.board.loc);
      if (want.startsWith("home:") && h !== want.slice(5)) out.push(`line ${b.line}: shot at ${s.board.loc}, the line happens at ${want}`);
      if (want === "street" && !(s.board.loc === "street" || s.board.loc.startsWith("house:"))) out.push(`line ${b.line}: shot at ${s.board.loc}, the line happens on the street`);
      for (const p of s.board.people) {
        const w = String(p.where);
        if (w.startsWith("window:") && !homes[w.split(":")[1]] && homes[w.split(":")[1]] !== 0) out.push(`line ${b.line}: ${p.id} at the window of an unknown house ${w}`);
        if (!cast[p.id] && !/^extra\d$/.test(p.id)) out.push(`line ${b.line}: unknown person ${p.id}`);
      }
    }
  }
  return out;
}

export function checkBoard(tl, board) {
  const out = [];
  for (const n of tl.lines.keys()) if (!board.lines.some((b) => b.line === n)) out.push(`line ${n}: no storyboard entry`);
  if (!tl.shots.length) out.push("no shots");
  for (const [i, s] of tl.shots.entries()) if (!(s.end > s.start)) out.push(`shot ${i}: empty (${s.start}-${s.end})`);
  return out;
}

// the monster variants (page/simple/monsters.js MONSTER_VARIANTS) and the words a script uses for each
const VARIANT_CUES = { peeker: /\b(one|single|giant|huge|big|glowing)\s+eye\b|\beyes? (presses|pressed|filled|blinked|stared|twitched)\b|\beyelid\b/i, shadow: /\b(shadow|faceless|no face|dark shape|shape in the dark)\b/i, grin: /\b(grin|grins|grinning|smile|smiling|teeth)\b/i, hat: /\b(top hat|tall hat|its hat|his hat)\b/i, many_eyes: /\b(many|hundred|dozen|six|seven|eight|so many) eyes\b/i };
const NO_VARIANT = /\b(tentacles?|wings|slime|slimy|eight legs|spider|invisible|swims|flying (thing|monster))\b/i;
/** the creature the video draws matches the script: the variant the words describe wins over the director's pick;
 *  words no variant can show are a problem (a clean failure) */
export function creatureCheck(lines, pick) {
  const text = lines.map((l) => l.text ?? l).join(" ");
  const said = Object.entries(VARIANT_CUES).filter(([, re]) => re.test(text)).map(([v]) => v);
  const variant = said.length === 1 ? said[0] : said.includes(pick) ? pick : said[0] ?? (pick ?? "shadow");
  const problems = NO_VARIANT.test(text) ? [`the script describes the creature with "${text.match(NO_VARIANT)[0]}": no monster variant can show it`] : [];
  return { variant, said, pick: pick ?? null, fixed: !!pick && variant !== pick, problems };
}
export const storyboardChecks = (tl, board) => ({ creature: tl.creature?.problems ?? [], board: checkBoard(tl, board), rule: checkRule(tl, board), actions: checkActions(tl), places: checkPlaces(tl, board) });
