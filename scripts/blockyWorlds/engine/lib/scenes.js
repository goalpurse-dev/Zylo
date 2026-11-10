// Blocky Worlds SCENES + WORLD STATE (owner 2026-11-10, after #2: "the shots don't follow it as ONE continuous story:
// shots are planned line by line with no memory of what already happened"). A layer between the script and the shots:
//   1. the SCENE LIST: the script split into scenes (several lines each): location, time of day, who is there and where
//      they stand, what happens, the WORLD STATE at its start and end, its SET PIECES
//   2. the STATE is persistent: an event changes the world and it stays changed until the story changes it back
//      (stateAt(scenes, line) -> the state for any line; the renderer applies it per shot)
//   3. SET PIECES (big story moments) are planned as scenes with a fixed shot pattern (SET_PIECES), never one generic shot
// General for every story: closed vocabularies the renderer knows (STATE_KEYS, SET_PIECES) + free text the checks keep.
//   sceneSchema() / validateScenes(raw, { lines, cast, places }) -> { scenes, problems }   (never throws)
//   scenePrompt({ script, cast, places, premise })                -> { system, user }
//   anthropicScenes({ apiKey, model }) -> { direct({ ... }) -> { data, costUsd, usage, model } }   (paid; capped tokens)
//   mockScenes({ script, cast, places })                          -> raw (a free rule-based stand-in, tests / other stories)
//   stateAt(scenes, line) -> { key: value }   sceneOf(scenes, line) -> scene   formatScenes(scenes, script) -> plain text
import { PRICE } from "./builder/design.js";

/** the world-state keys the renderer applies per shot (value lists closed; "default" = the place as built) */
export const STATE_KEYS = Object.freeze({
  windows_cover: ["default", "curtained", "bulging_curtains", "bare", "boarded", "smeared", "sock"],   // what is IN / ON the windows
  windows_light: ["default", "lit", "dark", "glow_white"],                                            // how the windows shine (night)
  crowd: ["none", "indoors", "on_street", "under_cover", "hiding_faces", "asleep"],                   // the townsfolk / grown-ups
  monster: ["absent", "lurking", "at_window", "on_street", "face_to_face", "gone"],                    // the threat
  hero: ["inside", "at_window", "outside", "on_street"],                                               // where the narrator is
});
export const STATE_DEFAULT = Object.freeze({ windows_cover: "default", windows_light: "default", crowd: "none", monster: "absent", hero: "inside" });
/** set pieces: big moments with their own shot pattern (what the planner cuts, what the checks require on screen) */
export const SET_PIECES = Object.freeze({
  group_under_cover: { shots: ["wide: the whole group under the one cover", "medium: faces under the cover, eyes shut", "insert: who holds the cover"], needs: ["group", "cover object"] },
  cover_flies_away: { shots: ["medium: the cover lifts off the group", "wide: the cover flying up and away, the group exposed"], needs: ["group", "cover object flying"] },
  board_up: { shots: ["medium: hammering a board over the thing", "insert: the boards in place"], needs: ["person", "boards"] },
  smear_glass: { shots: ["medium: the person smearing the glass", "insert: the smeared window"], needs: ["person", "window smeared"] },
  monster_licks_glass: { shots: ["close: the monster at the glass, licking it clean", "insert: the clean window"], needs: ["monster at window"] },
  wind_strips: { shots: ["wide: the wind tearing things off every house", "wide: things flying away like kites", "wide: the houses left bare"], needs: ["wind", "flying things"] },
  windows_glow: { shots: ["wide: the street, every window glowing white", "medium: the monster turning toward the hero's house"], needs: ["windows glowing white"] },
  staring_contest: { shots: ["two-shot: the hero and the monster face to face, both in frame", "close: the hero's face (shot)", "close: the monster's eye (reverse)", "wide: onlookers peeking through fingers"], needs: ["hero", "monster", "both in one frame"] },
  monster_retreats: { shots: ["close: the monster blinks", "wide: it backs away into the dark"], needs: ["monster"] },
  town_sleeps: { shots: ["wide: the street at night, every window dark, nobody out"], needs: ["windows dark", "empty street"] },
  reveal: { shots: ["wide: the thing revealed", "close: the reaction"], needs: ["thing", "reaction"] },
  chase: { shots: ["wide: the chaser and the chased", "medium: the chased running toward the lens"], needs: ["chaser", "chased"] },
  gather: { shots: ["wide: everybody gathered in one place", "medium: the leader"], needs: ["group"] },
  opening_town: { shots: ["wide: the town at the scene's time, the world's rule visible (curtains shutting, the eye in one window)", "medium: the hero where the scene puts them"], needs: ["town wide"] },
});
export const TIMES = Object.freeze(["day", "dusk", "night", "dawn"]);
export const SCENES_MODEL = "claude-sonnet-5-5";
const clean = (s, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function sceneSchema() {
  const stateObj = { type: "object", additionalProperties: false, required: Object.keys(STATE_KEYS), properties: Object.fromEntries(Object.keys(STATE_KEYS).map((k) => [k, { type: "string" }])) };
  const who = { type: "object", additionalProperties: false, required: ["id", "where"], properties: { id: { type: "string" }, where: { type: "string" } } };
  const piece = { type: "object", additionalProperties: false, required: ["kind", "lines", "who", "what"], properties: { kind: { type: "string" }, lines: { type: "array", items: { type: "integer" } }, who: { type: "array", items: { type: "string" } }, what: { type: "string" } } };
  const scene = { type: "object", additionalProperties: false, required: ["id", "from", "to", "location", "time", "cast", "happens", "stateStart", "stateEnd", "setPieces"],
    properties: { id: { type: "string" }, from: { type: "integer" }, to: { type: "integer" }, location: { type: "string" }, time: { type: "string" }, cast: { type: "array", items: who }, happens: { type: "string" }, stateStart: stateObj, stateEnd: stateObj, setPieces: { type: "array", items: piece } } };
  return { type: "object", additionalProperties: false, required: ["scenes"], properties: { scenes: { type: "array", items: scene } } };
}

/** repairs and checks the scene list: scenes tile every line in order, known places / cast / state values, state chained */
export function validateScenes(raw, { lines = [], cast = [], places = [] } = {}) {
  const problems = [], N = lines.length, castIds = new Set(cast), placeIds = new Set(places);
  let scenes = Array.isArray(raw?.scenes) ? raw.scenes : (problems.push("no scenes"), []);
  scenes = scenes.map((s, i) => ({
    id: clean(s?.id, 40) || `s${i + 1}`,
    from: Math.max(0, Math.min(N - 1, Math.round(Number(s?.from) || 0))), to: Math.max(0, Math.min(N - 1, Math.round(Number(s?.to) || 0))),
    location: placeIds.size && !placeIds.has(s?.location) ? (problems.push(`scene ${i + 1}: unknown location "${s?.location}" -> ${places[0]}`), places[0]) : clean(s?.location, 40),
    time: TIMES.includes(s?.time) ? s.time : (problems.push(`scene ${i + 1}: time "${s?.time}" -> night`), "night"),
    cast: (Array.isArray(s?.cast) ? s.cast : []).filter((c) => !castIds.size || castIds.has(c?.id) || c?.id === "monster" || c?.id === "crowd" || (problems.push(`scene ${i + 1}: unknown cast "${c?.id}"`), false)).map((c) => ({ id: c.id, where: clean(c.where, 80) })),
    happens: clean(s?.happens, 300),
    stateStart: fixState(s?.stateStart, `scene ${i + 1} start`, problems), stateEnd: fixState(s?.stateEnd, `scene ${i + 1} end`, problems),
    setPieces: (Array.isArray(s?.setPieces) ? s.setPieces : []).filter((p) => SET_PIECES[p?.kind] || (problems.push(`scene ${i + 1}: unknown set piece "${p?.kind}"`), false))
      .map((p) => ({ kind: p.kind, lines: (p.lines ?? []).map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x < N), who: (p.who ?? []).filter((w) => !castIds.size || castIds.has(w) || w === "monster" || w === "crowd"), what: clean(p.what, 200) })),
  })).sort((a, b) => a.from - b.from);
  // tile: the first scene starts at line 0, each starts right after the one before, the last ends at the last line
  for (let i = 0; i < scenes.length; i++) {
    const want = i === 0 ? 0 : scenes[i - 1].to + 1;
    if (scenes[i].from !== want) { problems.push(`scene ${scenes[i].id}: starts at line ${scenes[i].from}, set to ${want}`); scenes[i].from = want; }
    if (scenes[i].to < scenes[i].from) scenes[i].to = scenes[i].from;
  }
  scenes = scenes.filter((s) => s.from < N);
  if (scenes.length && scenes.at(-1).to !== N - 1) { problems.push(`the last scene ends at line ${scenes.at(-1).to}, set to ${N - 1}`); scenes.at(-1).to = N - 1; }
  // persistence: a scene starts in the state the one before ended in (a jump is the planner's mistake, never a cut)
  for (let i = 1; i < scenes.length; i++) for (const k of Object.keys(STATE_KEYS)) if (scenes[i].stateStart[k] !== scenes[i - 1].stateEnd[k]) { problems.push(`scene ${scenes[i].id}: ${k} starts "${scenes[i].stateStart[k]}" but the scene before ended "${scenes[i - 1].stateEnd[k]}" (kept the earlier end)`); scenes[i].stateStart[k] = scenes[i - 1].stateEnd[k]; }
  return { scenes, problems };
}
function fixState(st, at, problems) {
  const out = { ...STATE_DEFAULT };
  for (const [k, vals] of Object.entries(STATE_KEYS)) { const v = st?.[k]; if (v == null) continue; if (vals.includes(v)) out[k] = v; else problems.push(`${at}: ${k} "${v}" unknown`); }
  return out;
}

/** the scene a line belongs to */
export const sceneOf = (scenes, line) => scenes.find((s) => line >= s.from && line <= s.to) ?? null;
/**
 * the world state for a line: its scene's start state, changed to the scene's end state from the first line of the scene's
 * set piece that changes it (else the scene's middle line). Persistent across scenes by construction (validateScenes).
 */
export function stateAt(scenes, line) {
  const s = sceneOf(scenes, line);
  if (!s) return { ...STATE_DEFAULT };
  const turn = Math.min(...(s.setPieces ?? []).flatMap((p) => p.lines ?? []).filter((x) => x >= s.from), Math.floor((s.from + s.to + 1) / 2));
  return line >= turn ? { ...s.stateEnd } : { ...s.stateStart };
}

export const SCENES_SYSTEM = `You are the story director of a 9:16 blocky-avatar narrated story video. Split the narration into SCENES so the pictures follow ONE continuous story with memory:
- A scene spans several consecutive lines in one location at one time of day, with the same people in the same places, unless the narration moves us. A tour of neighbours ("X has..., Y has...") is one street scene. Every line belongs to exactly one scene; scenes tile the script in order.
- WORLD STATE: give each scene's state at its start and its end with these keys and values only: ${Object.entries(STATE_KEYS).map(([k, v]) => `${k}: ${v.join("|")}`).join("; ")}. The state is PERSISTENT: once curtains are torn off the windows stay bare; glowing windows stay white until the story says they went dark; a scene starts exactly as the previous one ended.
- SET PIECES: mark the big story moments with one of these kinds (and the lines they cover, who is in them, what happens): ${Object.keys(SET_PIECES).join(", ")}. A staring contest is always face to face (both in one frame, then shot / reverse).
- cast: the ids given, each with where they stand ("on her doorstep", "at the bedroom window", "in the middle of the street"); "monster" and "crowd" may be used in set pieces.
- location: one of the places given. time: day|dusk|night|dawn.
Answer with JSON only.`;

export function scenePrompt({ script, cast = [], places = [], premise = "" }) {
  const lines = (script?.lines ?? []).map((l, i) => `${i} [${l.part ?? ""}] ${l.text}`).join("\n");
  return { system: SCENES_SYSTEM, user: `PREMISE: ${clean(premise, 400)}\nPLACES: ${places.join(", ")}\nCAST: ${cast.join(", ")}\nLINES:\n${lines}` };
}
/** token + USD estimate (no call) */
export function estimateScenes({ script, cast, places, premise, model = SCENES_MODEL, maxTokens = 7000 }) {
  const { system, user } = scenePrompt({ script, cast, places, premise });
  const p = PRICE[model] ?? PRICE[SCENES_MODEL], inTok = Math.ceil((system.length + user.length) / 3.8) + 500;
  const typicalOut = 900 + (script?.lines?.length ?? 30) * 60;
  return { input: inTok, typicalOut, usd: +((inTok * p.input + typicalOut * p.output) / 1e6).toFixed(4), worstUsd: +((inTok * p.input + maxTokens * p.output) / 1e6).toFixed(4) };
}
export function anthropicScenes({ apiKey, model = SCENES_MODEL, fetchFn = fetch, maxTokens = 7000, effort = "low" } = {}) {
  if (!apiKey) throw new Error("anthropicScenes: no apiKey");
  const P = PRICE[model] ?? PRICE[SCENES_MODEL];
  return {
    model,
    async direct({ script, cast, places, premise }) {
      const t0 = Date.now(), { system, user } = scenePrompt({ script, cast, places, premise });
      const res = await fetchFn("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: [{ type: "text", text: system }], messages: [{ role: "user", content: user }], output_config: { effort, format: { type: "json_schema", schema: sceneSchema() } } }) });
      const body = await res.json().catch(() => null), u = body?.usage ?? {};
      const costUsd = +(((u.input_tokens ?? 0) * P.input + (u.output_tokens ?? 0) * P.output + (u.cache_read_input_tokens ?? 0) * P.cacheRead + (u.cache_creation_input_tokens ?? 0) * P.cacheWrite) / 1e6).toFixed(6);
      if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { costUsd });
      const text = (body?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
      return { data: JSON.parse(text), costUsd, usage: u, model: body?.model ?? model, ms: Date.now() - t0 };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------- the free stand-in
const LOC_WORDS = [[/\b(bedroom|my room|my window|in bed|under my bed)\b/, "home"], [/\b(school|class(room)?)\b/, "school"], [/\b(woods?|forest)\b/, "woods"], [/\b(walked outside|went outside|outside|street|every (?:house|window|curtain)|whole street|the town|neighbou?rs?)\b/, "main_street"]];
const EVENTS = [
  [/\b(ripped|tore|torn|blew|wind)\b.*\bcurtains?\b|\bcurtains?\b.*\b(ripped|torn|flew)\b|\bwent bare\b/, { windows_cover: "bare" }, "wind_strips"],
  [/\bglow(ed|s)? white\b/, { windows_light: "glow_white" }, "windows_glow"],
  [/\bwent dark\b|\blights? (went )?out\b/, { windows_light: "dark" }, null],
  [/\bfinally slept\b|\btown slept\b/, { crowd: "asleep" }, "town_sleeps"],
  [/\bbatter\b|\bsmear\w*\b|\bslapped\b.*\b(pane|glass|window)/, { windows_cover: "smeared" }, "smear_glass"],
  [/\blicked\b.*\b(glass|pane|window)/, { windows_cover: "bare" }, "monster_licks_glass"],
  [/\bnail\w*\b|\bboard\w*\b/, { windows_cover: "boarded" }, "board_up"],
  [/\bunder (one|a|the) (blanket|sheet|tarp|quilt)/, { crowd: "under_cover" }, "group_under_cover"],
  [/\b(blanket|sheet|quilt)\b.*\bflew\b/, { crowd: "on_street" }, "cover_flies_away"],
  [/\bhiding their faces|peeked through fingers\b/, { crowd: "hiding_faces" }, null],
  [/\bstar(ed|ing)\b.*\b(at it|contest)|\blooked right at it\b|\bI stared\b/, { monster: "face_to_face", hero: "on_street" }, "staring_contest"],
  [/\bwalked outside|went outside\b/, { hero: "on_street" }, null],
  [/\b(eye|it)\b.*\b(filled|pressed|presses)\b.*\bwindow|\bwindow\b.*\bfilled with\b/, { monster: "at_window" }, null],
  [/\bbacked away|ran away|fled|vanished\b/, { monster: "gone" }, "monster_retreats"],
];
/** a free rule-based scene list: scenes split on part / place / time changes and on events; the state carried forward */
export function mockScenes({ script, cast = [], places = [] } = {}) {
  const L = script?.lines ?? [], scenes = [];
  let state = { ...STATE_DEFAULT, windows_cover: "curtained" }, cur = null, night = false;
  const placeOf = (t, prev) => { for (const [re, p] of LOC_WORDS) if (re.test(t)) return places.includes(p) || !places.length ? p : prev; return prev; };
  L.forEach((l, i) => {
    const t = String(l.text).toLowerCase();
    if (/\b(night|dark|midnight)\b/.test(t)) night = true;
    const loc = placeOf(t, cur?.location ?? "main_street");
    const ev = EVENTS.filter(([re]) => re.test(t));
    const newScene = !cur || l.part !== L[i - 1]?.part || loc !== cur.location || (ev.some((e) => e[2]) && i - cur.from >= 2);
    if (newScene) { if (cur) scenes.push(cur); cur = { id: `s${scenes.length + 1}`, from: i, to: i, location: loc, time: night ? "night" : "day", cast: [], happens: clean(l.text, 120), stateStart: { ...state }, stateEnd: { ...state }, setPieces: [] }; }
    cur.to = i;
    for (const [, change, piece] of ev) {
      Object.assign(state, change); cur.stateEnd = { ...state };
      if (piece && !cur.setPieces.some((p) => p.kind === piece)) cur.setPieces.push({ kind: piece, lines: [i], who: [], what: clean(l.text, 120) });
    }
    for (const c of cast) if (new RegExp(`\\b${c}\\b`, "i").test(l.text) && !cur.cast.some((x) => x.id === c)) cur.cast.push({ id: c, where: cur.location === "home" ? "in the room" : "on the street" });
    if (/\b(i|me|my)\b/.test(t) && cast.includes("me") && !cur.cast.some((x) => x.id === "me")) cur.cast.push({ id: "me", where: state.hero === "on_street" ? "in the street" : cur.location === "home" ? "at the window" : "on the sidewalk" });
  });
  if (cur) scenes.push(cur);
  return { scenes, mock: true };
}

/** plain text for the owner */
export function formatScenes(scenes, script) {
  const L = script?.lines ?? [];
  const st = (s) => Object.entries(s).filter(([k, v]) => v !== STATE_DEFAULT[k]).map(([k, v]) => `${k}=${v}`).join(", ") || "as built";
  return scenes.map((s, i) => [
    `SCENE ${i + 1} (${s.id}): lines ${s.from}-${s.to}, ${s.location}, ${s.time}`,
    `  cast: ${s.cast.map((c) => `${c.id} (${c.where})`).join("; ") || "-"}`,
    `  happens: ${s.happens}`,
    `  state: ${st(s.stateStart)}  ->  ${st(s.stateEnd)}`,
    ...(s.setPieces.length ? s.setPieces.map((p) => `  SET PIECE ${p.kind} (lines ${p.lines.join(",")}${p.who.length ? `; ${p.who.join(", ")}` : ""}): ${p.what}`) : []),
    ...L.slice(s.from, s.to + 1).map((l, k) => `    ${s.from + k}: ${l.text}`),
  ].join("\n")).join("\n\n");
}

// ---------------------------------------------------------------------------------------------------------------- per house
/** each house's own state (owner 2026-11-11: "world state per HOUSE and per CHARACTER, not global"): what is on its
 *  windows, bricks in front, a boarded painting on the wall, how its windows shine. "*" = every other house */
export const HOUSE_KEYS = Object.freeze({
  cover: ["default", "curtained", "bulging", "thin", "sock", "bare", "smeared"],
  bricks: [false, true],
  painting: ["none", "boarded"],
  light: ["default", "lit", "dark", "glow_white", "eye"],
});
export const HOUSE_DEFAULT = Object.freeze({ cover: "default", bricks: false, painting: "none", light: "default" });
const fixHouse = (h) => { const o = { ...HOUSE_DEFAULT }; for (const [k, vals] of Object.entries(HOUSE_KEYS)) if (h && vals.includes(h[k])) o[k] = h[k]; return o; };
/** the houses' states for a line: the starting map, then every houseEvent up to that line in order */
export function housesAt(list, line) {
  const out = {};
  for (const [owner, h] of Object.entries(list?.houses ?? {})) out[owner] = fixHouse(h);
  out["*"] ??= { ...HOUSE_DEFAULT };
  for (const ev of [...(list?.houseEvents ?? [])].sort((a, b) => a.line - b.line)) {
    if (ev.line > line) break;
    const targets = (ev.owners ?? []).includes("*") ? Object.keys(out).filter((o) => !(ev.except ?? []).includes(o)) : ev.owners ?? [];
    for (const o of targets) out[o] = fixHouse({ ...(out[o] ?? out["*"]), ...ev.set });
  }
  return out;
}
