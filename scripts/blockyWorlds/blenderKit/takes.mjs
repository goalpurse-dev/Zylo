// ROUND 8 (owner 2026-11-23): ONE CONTINUOUS TAKE PER SCENE. Pure (no I/O).
//   lockLooks(cast)                 the cast's looks, locked once per story (one bold colour each, never changes)
//   initialState(plan)              the scene state of every place from the plan's stage map
//   applyCard(state, card, line)    a line card's actions -> the next state (+ the problems: a card that contradicts the
//                                   state is rejected in code before anything renders)
//   compileTakes(...)               every scene -> ONE take function (the place, the cast, the props, the light built once,
//                                   every line's actions on one timeline) + the camera cuts (shots) that look at it
// A card no longer builds anything: it adds actions to the running scene and says which camera looks at it, when.
import { THINGS } from "../../../supabase/functions/_shared/blockyWorlds/engineKit.js";

const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const low = (s) => String(s ?? "").trim().toLowerCase();
export const ident = (s) => (low(s).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "x");

export const MARKS8 = Object.freeze(["left", "center", "right", "back_left", "back", "back_right", "front_left", "front", "front_right"]);
export const SIDE_DEG = Object.freeze({ front: 0, front_left: 28, front_right: -28 });
export const TIMES8 = Object.freeze(["day", "sunset", "night", "storm", "morning"]);
export const SHOTS8 = Object.freeze(["wide", "medium", "two", "close", "insert", "low", "top"]);
export const MOVES8 = Object.freeze(["push_in", "tilt_up", "track", "top_down", "static"]);
export const FACES8 = Object.freeze(["neutral", "happy", "laughing", "sad", "crying", "scared", "terrified", "shocked", "surprised", "angry", "confused", "smirk", "determined", "panic"]);
// the line-card actions (each maps to ONE engine call in compileTakes; the generator lists them for the writer)
export const ACTIONS8 = Object.freeze({
  enter: "comes into the scene (walks in) to a mark", exit: "walks out of the scene", walk_to: "walks to a mark / a person / a thing", run_to: "runs to a mark / a person / a thing",
  turn_to: "turns to face someone / something", follow: "follows someone",
  point: "points at someone / something", wave: "waves", cheer: "cheers (arms up)", laugh: "laughs", scream: "screams (hands on head)", cry: "cries", shiver: "shivers with fear",
  shrug: "shrugs", facepalm: "facepalm", think: "thinks", nod: "nods", shake_head: "shakes the head", jump: "jumps", stomp: "stomps", roar: "roars", talk: "talks",
  hug: "hugs someone", fall: "falls over", sit: "sits down", stand_up: "stands up", lie_down: "lies down", look_around: "looks around",
  pick_up: "picks up a thing (then holds it)", give: "gives the held thing to someone", drop: "drops the held thing", throw: "throws the held thing to a mark",
  kick: "kicks a thing", read: "reads (a book)", phone: "looks at a phone",
  appear: "a THING appears (pops in) at a mark / next to someone", disappear: "a THING disappears", move: "a THING moves to a mark / a person",
  turn_on: "a THING switches on (glows)", turn_off: "a THING switches off", open: "a door opens", close: "a door closes",
  climb_out: "the MONSTER climbs out of a drain (big, in the open)", dive_in: "the MONSTER dives down the drain (gone)",
  switch_on: "ONE named lamp / window / porch light goes on", switch_off: "ONE named lamp / window / porch light goes off",
  switch_all_on: "ALL the street lamps (target lamps) or ALL the windows (target windows) go on at once", switch_all_off: "ALL the lamps / windows go off at once",
  windows_open: "the houses' windows open (shutters swing out)",
  rule_effect: "THE TOWN'S RULE happens on this person (the story's rule effect, with a pop)",
  star_eyes: "star eyes (amazed / in love)", x_eyes: "X eyes (knocked out)", sweat: "a sweat drop (nervous)", splat: "a paint / goo splat on someone's face", sign: "holds up a sign with BIG text (text = up to 18 letters)",
});
const PEOPLE_ACTIONS = new Set(["enter", "exit", "walk_to", "run_to", "turn_to", "follow", "point", "wave", "cheer", "laugh", "scream", "cry", "shiver", "shrug", "facepalm", "think", "nod", "shake_head", "jump", "stomp", "talk", "hug", "fall", "sit", "stand_up", "lie_down", "look_around", "pick_up", "give", "drop", "throw", "kick", "read", "phone", "rule_effect", "star_eyes", "x_eyes", "sweat", "splat", "sign", "roar"]);
const THING_ACTIONS = new Set(["appear", "disappear", "move", "turn_on", "turn_off", "open", "close"]);
const WORLD_ACTIONS = new Set(["switch_on", "switch_off", "switch_all_on", "switch_all_off", "windows_open"]);
const MONSTER_ONLY = new Set(["climb_out", "dive_in", "roar"]);
// (round 8 first test: "Grandma turns on the bell" made a white glare blob)
export const GLOW_THINGS = Object.freeze(["light_bulb", "lamp_bulb", "flashlight", "nightlight", "star", "phone"]);
export const SWITCH_TARGETS =Object.freeze(["lamp", "window", "porch_light", "lamps", "windows"]);

// ---------------------------------------------------------------- 6. CAST LOOKS, LOCKED ONCE PER STORY (in code)
export const PALETTE = Object.freeze([
  ["#FF3B30", "#1E3A8A"], ["#FFD60A", "#2F4F4F"], ["#34C759", "#3A2A1A"], ["#AF52DE", "#1C1C3A"], ["#FF9500", "#24324A"], ["#0A84FF", "#3B2314"],
]);
const SKINS = ["#F2C9A0", "#8D5524", "#E0AC69", "#C68642", "#FFDBAC", "#6B4226"];
const HAIRS = ["spiky", "messy", "long", "bun", "short", "curly"];
/** one bold colour per character (never two the same), skin / hair from the plan when given; the narrator first */
export function lockLooks(cast = []) {
  const out = {};
  const sorted = [...cast].sort((a, b) => (/^me$/i.test(a.name) ? -1 : 0) - (/^me$/i.test(b.name) ? -1 : 0));
  sorted.forEach((c, k) => {
    const [shirt, pants] = PALETTE[k % PALETTE.length];
    out[low(c.name)] = { name: c.name, kid: c.kid !== false, skin: /^#[0-9a-f]{6}$/i.test(c.skin ?? "") ? c.skin : SKINS[k % SKINS.length], shirt, pants,
      hair: HAIRS.includes(c.hair) ? c.hair : HAIRS[k % HAIRS.length], hair_color: /^#[0-9a-f]{6}$/i.test(c.hair_color ?? "") ? c.hair_color : ["#3B2314", "#5A3A1E", "#E8C26A", "#1A1A1A"][k % 4], face: /^me$/i.test(c.name) ? "hero" : "kid" };
  });
  return out;
}

// ---------------------------------------------------------------- 4. THE SCENE STATE (saved after every line)
const clone = (x) => JSON.parse(JSON.stringify(x));
/** the state of every place: who is where (mark), facing, pose, holding; things here / held / on-off; the monster; lamps,
 * windows. From the plan's stage map: everyone the map puts in a place starts there. */
export function initialState(plan) {
  const S = {};
  for (const [place, st] of Object.entries(plan.stage ?? {})) {
    const marks = st.marks ?? {};
    const P = { people: {}, things: {}, monster: { here: false, mark: null }, lamps: null, windows: null };
    for (const [who, mark] of Object.entries(marks)) {
      const k = low(who);
      if (k === "monster") { P.monster = { here: Boolean(st.monster_starts_here), mark }; continue; }
      if ((plan.cast ?? []).some((c) => low(c.name) === k)) P.people[k] = { here: true, mark, pose: "stand", holding: null, face: "neutral" };
      else if (THINGS.includes(k)) P.things[k] = { here: true, mark, held_by: null, state: null };
    }
    // the rule object (item 10): in the hand of its person / beside them / on the ground at its mark, from the start
    const ro = plan.rule?.object;
    const rw = low(ro?.who);
    if (ro?.thing && THINGS.includes(ro.thing)) {
      if (ro.where === "in_hand" && P.people[rw]) { P.things[ro.thing] = { here: true, mark: null, held_by: rw, state: null }; P.people[rw].holding = ro.thing; }
      else if (["next_to", "at_feet"].includes(ro.where) && P.people[rw]) P.things[ro.thing] ??= { here: true, mark: P.people[rw].mark, held_by: null, state: null };
    }
    S[place] = P;
  }
  return S;
}
const marksTaken = (P) => new Set(Object.values(P.people).filter((p) => p.here).map((p) => p.mark));
const freeMark = (P, prefer = "center") => { const used = marksTaken(P); return [prefer, ...MARKS8].find((m) => !used.has(m)) ?? prefer; };

/** the words of a line with their word index (0-based in the line) */
const wordsOfLine = (text) => String(text ?? "").split(/\s+/).filter(Boolean);
const nounRe = (k) => new RegExp(`\\b${k.replace(/_/g, " ")}(s|es)?\\b`, "i");
/** the things a line NAMES (rule 4: named = seen): people, the monster, things on the list, lamps / windows */
export function namedIn(text, plan) {
  const t = String(text ?? "");
  const out = [];
  for (const c of plan.cast ?? []) if (!/^me$/i.test(c.name) && new RegExp(`\\b${c.name}\\b`, "i").test(t)) out.push(low(c.name));
  if (/\b(I|me|my)\b/.test(t) && (plan.cast ?? []).some((c) => /^me$/i.test(c.name))) out.push("me");
  if (plan.monster?.present && /\b(monster|it|shadow|thing|creature)\b/i.test(t) && /\b(monster|shadow|creature)\b/i.test(t)) out.push("monster");
  for (const k of THINGS) if (nounRe(k).test(t)) out.push(k);
  return [...new Set(out)];
}

/**
 * one line card -> { state, problems, applied }. The card: { actions: [{ who, do, target, to, on_word, text }],
 * faces: { name: face }, cuts: [{ from_word, shot, show: [..], move }] }. A problem = the card contradicts the state
 * (someone acts who is not there, a thing given that nobody holds, the monster dives where there is no drain...).
 */
export function applyCard(state, card, { place, line, plan, time = null } = {}) {
  const S = clone(state);
  S[place] ??= { people: {}, things: {}, monster: { here: false, mark: null }, lamps: null, windows: null };
  const P = S[place];
  const problems = [];
  const nW = wordsOfLine(line.text).length;
  const castNames = new Set((plan.cast ?? []).map((c) => low(c.name)));
  const isPerson = (k) => castNames.has(k);
  const here = (k) => (k === "monster" ? P.monster.here : isPerson(k) ? Boolean(P.people[k]?.here) : Boolean(P.things[k]?.here));
  const applied = [];
  const acts = [...(card.actions ?? [])].sort((a, b) => (Number(a.on_word) || 0) - (Number(b.on_word) || 0));
  for (const a0 of acts) {
    const a = { ...a0, who: low(a0.who), target: low(a0.target), to: low(a0.to) };
    const bad = (why) => problems.push(`"${a0.who} ${a0.do}${a0.target ? " " + a0.target : ""}" (word ${a0.on_word}): ${why}`);
    if (!(a.do in ACTIONS8)) { bad("not an action the engine has"); continue; }
    if (!(Number(a.on_word) >= 0 && Number(a.on_word) < nW)) { bad(`on_word must be 0-${nW - 1}`); continue; }
    if (MONSTER_ONLY.has(a.do) && a.do !== "roar" && a.who !== "monster") { bad("only the monster does that"); continue; }
    if (PEOPLE_ACTIONS.has(a.do) || MONSTER_ONLY.has(a.do)) {
      if (a.who === "monster") {
        if (!plan.monster?.present) { bad("this story has no monster"); continue; }
        if (a.do === "climb_out") { if (P.monster.here) { bad("the monster is already here"); continue; } P.monster = { here: true, mark: P.things.drain_grate?.here ? P.things.drain_grate.mark : MARKS8.includes(a.to) ? a.to : "back", via: "drain" }; applied.push(a); continue; }
        if (!P.monster.here) { bad("the monster is not in the scene (it must climb_out first)"); continue; }
        if (a.do === "dive_in") { P.monster = { here: false, mark: null }; applied.push(a); continue; }
        if (["walk_to", "run_to"].includes(a.do)) { P.monster.mark = MARKS8.includes(a.to) ? a.to : (P.people[a.to]?.mark ?? P.monster.mark); applied.push(a); continue; }
        if (!["roar", "point", "stomp", "jump", "turn_to", "follow", "look_around"].includes(a.do)) { bad("the monster can walk_to / run_to / roar / stomp / jump / turn_to / follow / point / climb_out / dive_in"); continue; }
        applied.push(a); continue;
      }
      if (!isPerson(a.who)) { bad(`"${a0.who}" is not in the cast (${[...castNames].join(", ")})`); continue; }
      const me = (P.people[a.who] ??= { here: false, mark: null, pose: "stand", holding: null, face: "neutral" });
      if (a.do === "enter") { if (me.here) { bad(`${a0.who} is already in the scene (at ${me.mark})`); continue; } me.here = true; me.mark = MARKS8.includes(a.to) ? a.to : freeMark(P); me.pose = "stand"; applied.push(a); continue; }
      if (!me.here) { bad(`${a0.who} is not in this scene (${place}): enter first`); continue; }
      const T = a.target;
      if (["hug", "follow", "give"].includes(a.do) && !(isPerson(T) && here(T))) { bad(`the target "${a0.target}" must be a person in the scene`); continue; }
      if (["turn_to", "point"].includes(a.do) && T && !here(T) && !SWITCH_TARGETS.includes(T)) { bad(`"${a0.target}" is not in the scene`); continue; }
      switch (a.do) {
        case "exit": me.here = false; me.mark = null; if (me.holding) { P.things[me.holding] = { ...(P.things[me.holding] ?? {}), here: false, held_by: a.who }; } break;
        case "walk_to": case "run_to": {
          if (MARKS8.includes(a.to)) me.mark = a.to;
          else if (here(a.to)) me.mark = isPerson(a.to) ? P.people[a.to].mark : a.to === "monster" ? P.monster.mark : P.things[a.to].mark;
          else { bad(`walk_to needs a mark (${MARKS8.join(", ")}) or someone / something in the scene, got "${a0.to}"`); continue; }
          me.pose = "stand"; break;
        }
        case "sit": me.pose = "sit"; break;
        case "lie_down": me.pose = "lie"; break;
        case "stand_up": if (me.pose === "stand") { bad(`${a0.who} is already standing`); continue; } me.pose = "stand"; break;
        case "fall": me.pose = "lie"; break;
        case "pick_up": {
          const th = P.things[T];
          if (!th?.here) { bad(`"${a0.target}" is not in the scene to pick up (appear it first)`); continue; }
          if (th.held_by) { bad(`"${a0.target}" is held by ${th.held_by}`); continue; }
          if (me.holding) { bad(`${a0.who} already holds ${me.holding}`); continue; }
          th.held_by = a.who; th.mark = null; me.holding = T; break;
        }
        case "give": {
          if (!me.holding) { bad(`${a0.who} holds nothing to give`); continue; }
          const taker = P.people[T];
          if (taker.holding) { bad(`${a0.target} already holds ${taker.holding}`); continue; }
          P.things[me.holding].held_by = T; taker.holding = me.holding; a.thing = me.holding; me.holding = null; break;
        }
        case "drop": case "throw": {
          if (!me.holding) { bad(`${a0.who} holds nothing to ${a.do}`); continue; }
          a.thing = me.holding; P.things[me.holding].held_by = null; P.things[me.holding].mark = a.do === "throw" && MARKS8.includes(a.to) ? a.to : me.mark; me.holding = null; break;
        }
        case "kick": if (!(P.things[T]?.here) || P.things[T].held_by) { bad(`"${a0.target}" must be a thing on the ground in the scene`); continue; } P.things[T].mark = MARKS8.includes(a.to) ? a.to : P.things[T].mark; break;
        case "sign": if (!String(a0.text ?? "").trim() || String(a0.text).length > 18) { bad("a sign needs text of 1-18 letters"); continue; } break;
        case "splat": if (T && !(isPerson(T) && here(T))) { bad(`a splat lands on a person in the scene, not "${a0.target}"`); continue; } break;
        default: break;
      }
      applied.push(a); continue;
    }
    if (THING_ACTIONS.has(a.do)) {
      const T = a.target || a.who;
      if (!THINGS.includes(T)) { bad(`"${T}" is not a thing the engine has`); continue; }
      const th = (P.things[T] ??= { here: false, mark: null, held_by: null, state: null });
      if (a.do === "appear") {
        if (th.here) { bad(`"${T}" is already in the scene`); continue; }
        th.here = true; th.held_by = null;
        th.mark = MARKS8.includes(a.to) ? a.to : (isPerson(a.to) && here(a.to) ? P.people[a.to].mark : "center");
        th.near = isPerson(a.to) && here(a.to) ? a.to : null;
        applied.push({ ...a, target: T }); continue;
      }
      if (!th.here) { bad(`"${T}" is not in the scene (appear it first)`); continue; }
      if (a.do === "disappear") { if (th.held_by && P.people[th.held_by]) P.people[th.held_by].holding = null; th.here = false; th.held_by = null; }
      else if (["turn_on", "turn_off"].includes(a.do) && !GLOW_THINGS.includes(T)) { bad(`only a light switches on / off (${GLOW_THINGS.join(", ")}), not "${T}"`); continue; }
      else if (a.do === "move") { if (th.held_by) { bad(`"${T}" is held: give / drop it instead`); continue; } th.mark = MARKS8.includes(a.to) ? a.to : (isPerson(a.to) && here(a.to) ? P.people[a.to].mark : th.mark); }
      else th.state = { turn_on: "on", turn_off: "off", open: "open", close: "closed" }[a.do];
      applied.push({ ...a, target: T }); continue;
    }
    if (WORLD_ACTIONS.has(a.do)) {
      const T = a.target;
      if (a.do === "windows_open") { P.windows = "open"; applied.push(a); continue; }
      if (a.do.startsWith("switch_all")) { if (!["lamps", "windows"].includes(T)) { bad('switch_all_on / off: target "lamps" or "windows"'); continue; } P[T] = a.do.endsWith("_on") ? (T === "windows" ? "lit" : "on") : (T === "windows" ? "dark" : "off"); applied.push(a); continue; }
      if (!["lamp", "window", "porch_light"].includes(T)) { bad('switch_on / off: target "lamp", "window" or "porch_light" (the one nearest who)'); continue; }
      if (a.who && a.who !== "monster" && !(isPerson(a.who) && here(a.who))) { bad(`the switch happens near ${a0.who}, who is not in the scene`); continue; }
      applied.push(a); continue;
    }
  }
  // the faces (the line's end faces)
  for (const [who, face] of Object.entries(card.faces ?? {})) { const k = low(who); if (P.people[k]?.here) P.people[k].face = FACES8.includes(face) ? face : "neutral"; }
  void time;
  return { state: S, problems, applied };
}

/**
 * the cuts of a line: 1-3 (about one every 1.4 s, on the start of a word), each ONE thing (rule 11); every thing the
 * line names gets its own clear shot (rule 4 wins); every shot shows something new (rule 12: never the same shot +
 * subject twice in a row, also across lines). -> [problem]
 */
export function cutProblems(card, { line, plan, stateBefore, stateAfter, place, dur, prevCut = null }) {
  const out = [];
  const cuts = card.cuts ?? [];
  const nW = wordsOfLine(line.text).length;
  const want = Math.max(1, Math.min(3, Math.round(dur / 1.4)));
  if (cuts.length < Math.max(1, want - 1) || cuts.length > Math.min(3, want + 1)) out.push(`this line is ${dur.toFixed(1)} s: give it ${want} cut(s) (about one every 1.4 s), not ${cuts.length}`);
  if (cuts.length && Number(cuts[0].from_word) !== 0) out.push("the first cut starts on word 0");
  for (let i = 1; i < cuts.length; i++) if (!(Number(cuts[i].from_word) > Number(cuts[i - 1].from_word))) out.push(`cut ${i + 1} must start after cut ${i} (a later word)`);
  for (const c of cuts) if (!(Number(c.from_word) >= 0 && Number(c.from_word) < nW)) out.push(`a cut starts on word ${c.from_word}: the line has words 0-${nW - 1}`);
  const castNames = new Set((plan.cast ?? []).map((c) => low(c.name)));
  const B = stateBefore?.[place] ?? { people: {}, things: {}, monster: {} }, A = stateAfter?.[place] ?? B;
  const inScene = (k) => k === "monster" ? Boolean(B.monster?.here || A.monster?.here) : castNames.has(k) ? Boolean(B.people?.[k]?.here || A.people?.[k]?.here) : Boolean(B.things?.[k]?.here || A.things?.[k]?.here || B.things?.[k]?.held_by || A.things?.[k]?.held_by);
  for (const c of cuts) {
    if (!SHOTS8.includes(c.shot)) out.push(`shot "${c.shot}" is not one of ${SHOTS8.join(", ")}`);
    if (!MOVES8.includes(c.move)) out.push(`move "${c.move}" is not one of ${MOVES8.join(", ")}`);
    const show = (c.show ?? []).map(low);
    if (!show.length) out.push("every cut shows something (show: who / what)");
    for (const k of show) if (!inScene(k) && !["lamps", "windows", "lamp", "window", "porch_light"].includes(k)) out.push(`a cut shows "${k}", which is not in the scene during this line`);
  }
  // rule 4 wins: everything the line names is in a cut's show
  const shown = new Set(cuts.flatMap((c) => (c.show ?? []).map(low)));
  for (const k of namedIn(line.text, plan)) if (inScene(k) && !shown.has(k)) out.push(`the line names "${k}" but no cut shows it (rule 4: every noun gets its own clear shot)`);
  // rule 12: every shot shows something new
  const sig = (c) => `${c.shot}|${(c.show ?? []).map(low).sort().join(",")}`;
  const all = [prevCut, ...cuts].filter(Boolean);
  for (let i = 1; i < all.length; i++) if (sig(all[i]) === sig(all[i - 1])) out.push(`cut ${i}${all[0] === prevCut ? "" : " + 1"}: the same shot of the same thing as the cut before (every shot shows something new)`);
  return out;
}

/** ONE THING PER CUT (rule 14; round 8 first test: cuts of 3-4 people made everyone tiny in 9:16): a cut other than the
 * wide frames at most 2 subjects, the ones the line names first */
export function trimShow(cut, text, plan) {
  const show = [...new Set((cut.show ?? []).map(low))];
  if (cut.shot === "wide" || show.length <= 2) return show;
  const named = new Set(namedIn(text, plan));
  return [...show.filter((k) => named.has(k)), ...show.filter((k) => !named.has(k))].slice(0, 2);
}

// ---------------------------------------------------------------- 1-3, 5, 7. THE TAKES (one per scene) + THE SHOTS
/**
 * plan.scenes [{ id, lines: [a, b], place, time }], cards [{ line, actions, faces, cuts }] (the APPLIED actions),
 * states: the state BEFORE each line (states[line]) and after the last; lines: [{ text, speaker, start, end, words:
 * [{ start }], w0 }] (w0 = the line's first global word index). -> { header, takes: { id: python }, shots: [{ id,
 * scene, line, w0, w1, t0, t1, body(o) }] }
 */
export function compileTakes({ plan, cards, states, lines, looks }) {
  const takes = {}, shots = [];
  const tOf = (L, wi) => (L.words[Math.max(0, Math.min(L.words.length - 1, Number(wi) || 0))]?.start ?? L.start);
  const scenes = plan.scenes ?? [];
  const rule = plan.rule?.object ?? null;
  scenes.forEach((sc, si) => {
    const [la, lb] = sc.lines;
    const place = sc.place;
    const S0 = states[la]?.[place] ?? { people: {}, things: {}, monster: { here: false } };
    const myLines = lines.filter((L, i) => i + 1 >= la && i + 1 <= lb);
    const T0 = si === 0 ? 0 : myLines[0].start, T1 = si + 1 < scenes.length ? lines[scenes[si + 1].lines[0] - 1].start : myLines.at(-1).end + 0.25;
    const myCards = cards.filter((c) => c.line >= la && c.line <= lb);
    // everyone who is in this place at any point of the scene (here at the start, or entering)
    const people = new Set(Object.entries(S0.people).filter(([, p]) => p.here).map(([k]) => k));
    for (const c of myCards) for (const a of c.actions ?? []) if (a.do === "enter") people.add(low(a.who));
    const things = new Set(Object.entries(S0.things).filter(([, t]) => t.here || t.held_by).map(([k]) => k));
    for (const c of myCards) for (const a of c.actions ?? []) if (["appear"].includes(a.do) && a.target) things.add(low(a.target));
    if (rule && THINGS.includes(rule.thing) && rule.where !== "over_head_pop") things.add(rule.thing);
    const monUsed = plan.monster?.present && (S0.monster?.here || myCards.some((c) => (c.actions ?? []).some((a) => low(a.who) === "monster")));
    const L = [];
    const time = TIMES8.includes(sc.time) ? sc.time : "day";
    const dress = { time: time === "storm" ? "night" : time === "morning" ? "day" : time, ...(time === "storm" ? { weather: "rain" } : {}), faces: "dot", busy: sc.busy ?? "empty", walkers: sc.busy && sc.busy !== "empty" ? "walking" : "none", cars: sc.cars ?? "parked", extras: [], windows: S0.windows === "dark" ? "dark" : "lit", curtains: "open", threat: "none" };
    L.push(`def take_${sc.id}(o):`);
    const I = (s) => L.push(`    ${s}`);
    I(`T0, T1 = o + ${T0.toFixed(3)}, o + ${T1.toFixed(3)}`);
    I(`ZS["place"] = ${py(place)}`);
    I(`ZS["side"] = ${SIDE_DEG[plan.stage?.[place]?.camera_side] ?? 0}`);
    I(`ZW_INFO = zw_build(${py(place)}, T0 - 0.3, T1 + 0.3, zs_quiet(${py(dress)}))`);
    I(`zs_light(${py(time)}, T0, T1)`);
    I(`zs_clear_stage(${py(place)})`);
    I(`st_c, st_d, st_r, st_rot = zw_stage(${py(place)})`);
    I("H = {}");
    const used = {};
    const markAt = (m) => { const k = used[m] = (used[m] ?? -1) + 1; return `zw_mark(${py(place)}, ${py(MARKS8.includes(m) ? m : "center")}, ${k})`; };
    // the cast, at their marks as the state has them, the locked looks
    for (const k of people) {
      const p = S0.people[k];
      const look = looks[k] ?? { name: k };
      I(`H[${py(k)}] = zw_person(${py(look.name ?? k)}, ${py(look)}, ${markAt(p?.here ? p.mark : "center")}, st_rot, T0 - 0.5)`);
      if (!p?.here) I(`H[${py(k)}].set_visible(-10.0, False)`);
      else if (p.pose === "sit") I(`zw_posed(H[${py(k)}], T0 - 0.4, "sit")`);
      else if (p.pose === "lie") I(`zm_lie(H[${py(k)}], T0 - 0.9)`);
    }
    // the things: here at the start where the state has them, the ones that appear later hidden until they do
    const ruleWho = rule?.who && people.has(low(rule.who)) ? low(rule.who) : null;
    for (const k of things) {
      const t = S0.things[k];
      const isRule = rule?.thing === k && rule.where !== "over_head_pop";
      const size = (plan.props ?? []).find((x) => x.kind === k)?.size ?? 1.2;
      const named = myLines.some((Ln) => nounRe(k).test(Ln.text));
      // the rule object READABLE in every shot (round 8 first test: a bell in a hand at 1.5x was "not visible" in 30 stills)
      const sz = `zw_tsize(${py(k)}, ${size})${isRule ? " * 1.8" :k === "drain_grate" ? " * 2.2" : named ? (monUsed ? " * 2.4" : " * 1.5") : ""}`;
      const mk = t?.mark ?? (isRule ? (plan.stage?.[place]?.marks?.[k] ?? "front") : "center");
      I(`_p = ${markAt(mk)}`);
      // the drain in the open, ON its mark (item 18); the rule object beside / at the feet of its person; other things
      // a step in front of their mark (nobody stands on them)
      const at = k === "drain_grate" ? "_p" : isRule && ruleWho && ["next_to", "at_feet"].includes(rule.where) && !t?.mark
        ? `zs_beside(H[${py(ruleWho)}], T0, -1)` : "(_p[0] - st_d.x * 1.0 + st_r.x * 1.0, _p[1] - st_d.y * 1.0 + st_r.y * 1.0, 0.0)";
      I(`H[${py(k)}] = zw_thing(${py(k)}, ${at}, size=${sz})`);
      // the drain is BIG and in the open: the dark hole + grate on its mark (a small flat thing was invisible from the street)
      if (k === "drain_grate") I("zs_hole(_p)");
      if (!(t?.here || t?.held_by) && !isRule) I(`zs_hide(H[${py(k)}])`);
      if (t?.held_by && people.has(t.held_by)) I(`zw_grab(H[${py(t.held_by)}], T0 - 0.3, H[${py(k)}])`);
      else if (isRule && rule.where === "in_hand" && ruleWho && !t?.mark) I(`zw_grab(H[${py(ruleWho)}], T0 - 0.3, H[${py(k)}])`);
    }
    if (monUsed) {
      const size = Math.min(4, Math.max(3, Number(plan.monster.size) || 3.6));
      I(`H["monster"] = zw_monster("Monster", ${markAt(S0.monster?.mark ?? "back")}, rot=st_rot, size=${size}, style=${py(plan.monster.style || "shadow")})`);
      if (!S0.monster?.here) I(`H["monster"].set_visible(-10.0, False)`);
    }
    if (S0.lamps === "off") I(`zs_switch_all("lamps", T0 - 1.0, False, stagger=0.0)`);
    if (S0.windows === "open") I(`zs_windows_open(T0 - 1.0, stagger=0.0)`);
    // the timeline: every line's actions at their word times, the faces per line
    for (const c of myCards) {
      const Ln = lines[c.line - 1];
      const la0 = Ln.start, la1 = lines[c.line]?.start ?? Ln.end + 0.25;
      I(`# line ${c.line}: ${JSON.stringify(Ln.text).slice(1, -1).slice(0, 90)}`);
      const sp = Ln.speaker && !/^(narrator|me|)$/i.test(Ln.speaker) ? low(Ln.speaker) : null;
      for (const k of people) {
        const face = Object.entries(c.faces ?? {}).find(([w]) => low(w) === k)?.[1];
        if (face || k === sp) I(`if H[${py(k)}] is not None: zw_emote(H[${py(k)}], o + ${la0.toFixed(3)}, o + ${la1.toFixed(3)}, ${py(FACES8.includes(face) ? face : "neutral")}${k === sp ? ", talk=True" : ""})`);
      }
      for (const a of c.actions ?? []) {
        const who = low(a.who), T = low(a.target), to = low(a.to);
        const ta = `o + ${tOf(Ln, a.on_word).toFixed(3)}`;
        const tb = `o + ${Math.max(tOf(Ln, a.on_word) + 0.8, la1 - 0.05).toFixed(3)}`;
        const W = `H.get(${py(who)})`, TT = `H.get(${py(T)})`;
        const toPt = MARKS8.includes(to) ? markAt(to) : to && (people.has(to) || things.has(to) || to === "monster") ? `zs_beside(H.get(${py(to)}), ${ta}, 1)` : null;
        switch (a.do) {
          case "enter": I(`zs_enter(${W}, ${ta}, ${tb}, ${toPt ?? markAt("center")})`); break;
          case "exit": I(`zs_exit(${W}, ${ta}, ${tb})`); break;
          // the monster comes up BEHIND a person (round 8 first test: beside Max, its legs filled every other shot)
          case "walk_to": case "run_to": if (who === "monster" || toPt) I(`zm_walk(${W}, ${ta}, ${tb}, ${who === "monster" && people.has(to) ? `zs_behind(H.get(${py(to)}), ${ta})` : toPt ?? markAt("center")}, run=${a.do === "run_to" ? "True" : "False"})`); break;
          case "turn_to": if (TT !== "H.get(\"\")") I(`zm_turn(${W}, ${ta}, za_yaw(za_here(${W}, ${ta}), za_pos(${TT})))`); break;
          case "follow": I(`zw_follow(${W}, ${TT}, ${ta}, ${tb})`); break;
          case "point": I(`zw_point(${W}, ${ta}, ${T ? TT : "None"})`); break;
          case "wave": I(`zm_wave(${W}, ${ta}, ${tb})`); break;
          case "cheer": case "laugh": I(`zm_cheer(${W}, ${ta})`); break;
          case "scream": I(`${W}.act(${ta}, "hands_head")`); break;
          case "cry": I(`zm_cry(${W}, ${ta}, ${tb})`); break;
          case "shiver": I(`zm_shiver(${W}, ${ta}, ${tb})`); break;
          case "shrug": case "facepalm": case "think": I(`${W}.act(${ta}, ${py(a.do)})`); break;
          case "nod": I(`zm_nod(${W}, ${ta})`); break;
          case "shake_head": I(`zm_shake_head(${W}, ${ta})`); break;
          case "jump": I(`zm_jump(${W}, ${ta})`); break;
          case "stomp": I(`zw_stomp(${W}, ${ta})`); break;
          case "roar": I(`${W}.act(${ta}, "fists")`); break;
          case "talk": I(`zm_talk(${W}, ${ta}, ${tb})`); break;
          case "hug": I(`zm_hug(${W}, ${TT}, ${ta}, ${tb})`); break;
          case "fall": I(`zm_fall(${W}, ${ta})`); break;
          case "sit": I(`zw_sit(${W}, ${ta})`); break;
          case "stand_up": I(`zm_stand_up(${W}, ${ta})`); break;
          case "lie_down": I(`zm_lie(${W}, ${ta})`); break;
          case "look_around": I(`zm_look_around(${W}, ${ta}, ${tb})`); break;
          case "pick_up": I(`zm_pick_up(${W}, ${ta}, ${TT})`); break;
          case "give": I(`zm_give(${W}, ${TT}, H.get(${py(a.thing)}), ${ta}, ${tb})`); break;
          case "drop": I(`zo_drop(${W}, H.get(${py(a.thing)}), ${ta})`); break;
          case "throw": I(`zw_throw(${W}, ${ta}, ${tb}, H.get(${py(a.thing)}), ${toPt ?? markAt("front")})`); break;
          case "kick": I(`zm_kick(${W}, ${ta}, ${TT}, ${toPt ?? markAt("front")})`); break;
          case "read": I(`zm_read(${W}, ${ta}, ${tb}, H.get("book"))`); break;
          case "phone": I(`zm_phone(${W}, ${ta}, ${tb}, H.get("phone"))`); break;
          case "appear": I(`zo_appear(H.get(${py(T)}), ${ta}${toPt ? `, at=${people.has(to) ? `zs_beside(H.get(${py(to)}), ${ta}, -1)` : toPt}` : ""})`); break;
          case "disappear": I(`zo_disappear(H.get(${py(T)}), ${ta})`); break;
          case "move": I(`zo_move(H.get(${py(T)}), ${ta}, ${tb}, ${toPt ?? markAt("center")}, h=1.5)`); break;
          case "turn_on": case "turn_off": I(`zo_state(H.get(${py(T)}), ${ta}, ${py(a.do === "turn_on" ? "on" : "off")})`); break;
          case "open": case "close": I(`zo_state(H.get(${py(T)}), ${ta}, ${py(a.do === "open" ? "open" : "closed")})`); break;
          case "climb_out": { const hole = things.has("drain_grate") ? `(H["drain_grate"].location.x, H["drain_grate"].location.y)` : `zs_hole(${toPt ?? markAt("front")})`; I(`H["monster"].set_visible(${ta} - 0.9, True)`); I(`zw_climb_out(H["monster"], ${ta} - 0.9, ${ta} + 0.4, hole=${hole})`); break; }
          case "dive_in": { const hole = things.has("drain_grate") ? `(H["drain_grate"].location.x, H["drain_grate"].location.y)` : `zs_hole(${markAt("front")})`; I(`zs_dive(H["monster"], ${ta}, ${tb}, ${hole})`); break; }
          case "switch_on": case "switch_off": I(`zw_switch(${py(T)}, ${who && who !== "monster" ? W : `za_here(H["monster"], ${ta}) if H.get("monster") else (st_c.x, st_c.y)`}, ${ta}, ${a.do === "switch_on" ? "True" : "False"})`); break;
          case "switch_all_on": case "switch_all_off": I(`zs_switch_all(${py(T === "windows" ? "windows" : "lamps")}, ${ta}, ${a.do === "switch_all_on" ? "True" : "False"})`); break;
          case "windows_open": I(`zs_windows_open(${ta})`); break;
          case "rule_effect": I(`zw_rule_effect(${W}, ${ta})`); break;
          case "star_eyes": I(`zf_star_eyes(${W}, ${ta}, ${tb})`); break;
          case "x_eyes": I(`zf_x_eyes(${W}, ${ta}, ${tb})`); break;
          case "sweat": I(`zf_sweat(${W}, ${ta})`); break;
          case "splat": I(`zf_splat(${T ? TT : W}, ${ta})`); break;
          case "sign": I(`zf_sign(${W}, ${ta}, ${tb}, ${py(String(a.text ?? "").slice(0, 18))})`); break;
          default: break;
        }
      }
    }
    I("return H");
    takes[sc.id] = L.join("\n");
    // the shots: the line's cuts on the running scene
    for (const c of myCards) {
      const Ln = lines[c.line - 1];
      (c.cuts ?? []).forEach((cut, ci) => {
        const fw = Math.max(0, Math.min(Ln.words.length - 1, Number(cut.from_word) || 0));
        shots.push({ scene: sc.id, line: c.line, cut: ci, w0: Ln.w0 + fw, t0: tOf(Ln, fw), shot: cut.shot, show: trimShow(cut, Ln.text, plan), move: cut.move });
      });
    }
  });
  shots.sort((a, b) => a.w0 - b.w0);
  // the shots tile the timeline (a cut on the same word as the one before moves a word on)
  for (let k = 1; k < shots.length; k++) if (shots[k].w0 <= shots[k - 1].w0) shots[k].w0 = shots[k - 1].w0 + 1;
  if (shots.length) shots[0].w0 = 0;
  shots.forEach((s, k) => { s.id = k + 1; s.w1 = k + 1 < shots.length ? shots[k + 1].w0 : null; });
  return { takes, shots, cutCall: (s, t0 = "t0", t1 = "t1") => `zc_cut(${t0}, ${t1}, ${py(s.shot)}, [${s.show.filter((k) => !THINGS.includes(k) && !SWITCH_TARGETS.includes(k)).map((k) => `H.get(${py(k)})`).join(", ")}], [${s.show.filter((k) => THINGS.includes(k)).map((k) => `H.get(${py(k)})`).join(", ")}], ${py(s.move)})` };
}
