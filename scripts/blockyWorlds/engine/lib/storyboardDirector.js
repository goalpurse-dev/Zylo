// Blocky Worlds STORYBOARD DIRECTOR (2026-11-12, owner: "customers get #2 quality AUTOMATICALLY, first try"): the AI
// director writes the storyboard (never by hand), with the owner's #2 storyboard as the few-shot example.
//   1. ONE call: the story's world bible for the board (homes, each house's windows, world-state events, the rule's
//      constraints, each room's furniture), so every scene sees the same world
//   2. one call PER SCENE, IN PARALLEL (the request cached once by a warm call): that scene's lines as storyboard entries
//   3. validateStoryboard (free): every key from the kit vocabulary (BOARD vocab below: places, cameras, people marks,
//      actions), every line covered, the cut words in their lines; ONE repair call for the lines that fail; a line the
//      board kit still can't show falls back to the planned engine shots ({ keep: true }: the engine kit + builder)
//   -> { board, costUsd, ms, fellBack: [lines], problems }   (a story nothing can show: STORYBOARD_FAILED, refunded)
import { BOARD_ACTIONS } from "./boardActions.js";
import { costOf } from "./builder/design.js";
import { KID_NEVER_BLINKS } from "./storyboards/kidNeverBlinks.js";

export const BOARD_MODEL = "claude-sonnet-5-5";
// THE BOARD KIT VOCABULARY (page/simple/board.js): what a storyboard may use
export const BOARD = Object.freeze({
  locs: ["street", "house:<owner>", "room:<owner>"],
  cams: { street: ["town_wide", "street_wide", "street_end", "street_back", "sky_up", "eye_close", "houses:<a>:<b>", "front:<owner>"], house: ["house:<owner>", "front:<owner>", "window:<owner>:<0-3>", "cat:<owner>", "arrive:<owner>"], room: ["room_wide", "room_window", "room_door", "room_side", "face:<person>", "peek:me", "cat_stare", "bed_top", "painting", "behind_window", "huddle_up", "pov_eye", "window_in"] },
  where: ["window:<owner>:<0-3>", "room:window", "room:center", "room:door", "room:painting", "room:bed", "room:huddle0", "room:huddle1", "room:huddle2", "room:huddle3"],
  monsterWhere: ["end", "street:<owner>", "window:<owner>:<0-3>", "roomwindow:<owner>"],
  eyes: ["stare", "squint", "twitch", "blink", "press"],
  poses: ["stand", "walk", "wave", "talk", "point", "scared", "look_up", "sneeze", "carry", "cover_mouth", "sleep", "cheer", "hide"],
  faces: ["neutral", "happy", "grin", "laugh", "sad", "crying", "angry", "surprised", "shocked", "scared", "smirk", "thinking", "sleepy", "worried", "determined", "teary"],
  covers: ["curtained", "bulging", "thin", "sock", "bare", "smeared"],
  roomProps: ["bed", "shelf", "rug", "cat", "painting", "boards", "bricks", "counter", "bowl", "sofa", "lamp", "table", "nightstand"],
  lights: ["dusk", "night", "day"],
});

const BIBLE_SYSTEM = `You set up the WORLD BIBLE of a vertical blocky-cartoon story video built from a fixed 3D kit: one suburban street of up to 7 houses (left to right), each house's front windows (0, 1 ground floor; 2, 3 upstairs) and one room inside each house. Output ONLY compact JSON:
{"homes":{"<cast id>":<house index 0-6>},"houses":{"*":{"cover":..,"bricks":false,"painting":"none","light":"default"},"<owner>":{...}},"events":[{"line":n,"owners":["*"|ids],"except":[ids]?,"set":{"cover"|"bricks"|"painting"|"light":..},"why":".."}],"rule":{"text":"..","constraints":[{"when":["night","dusk"],"outside":"empty","people":"indoors","except":[{"who":id,"fromLine":n}],"why":".."}]},"rooms":{"<owner>":{"props":[...]}}}
covers: curtained | bulging | thin | sock | bare | smeared. light: default | eye | glow_white | dark. room props: bed shelf rug cat painting boards bricks counter bowl sofa lamp table nightstand. The rule's constraints must follow from the story's rule (a rule about staying in after dark = nobody outside after dark except who breaks it, from that line). An event changes the houses from its line on (during that line the change happens on screen). Only cast ids that live on the street get a home.`;

export const SHOT_SYSTEM = `You are the storyboard director of a vertical (9:16) blocky-cartoon story video built from a FIXED 3D kit (a street of houses with real windows, a room in each house, people, one monster with one huge eye, and an action library). For every narration line you write what we SEE happening: place, inside / outside, who (where, pose, face), the visible action of every verb (an animated action from the library, never just a face), and the camera. Follow the owner's example storyboard: its level of detail, its choices of place and camera per line, its use of the world state.

Format per line (compact JSON): {"line":n,"place":"street"|"home:<owner>","shots":[{"at":"<first word of a cut, not on the first shot>","loc":"street"|"house:<owner>"|"room:<owner>","light":"dusk"|"night"|"day","cam":"..","people":[{"id":..,"where":..,"pose"?:..,"face"?:..}],"monster"?:{"where":..,"eye"?:..,"state"?:"lurk"|"flee","turnTo"?:<owner>},"acts":[{"k":<action>,"who"?:id,"at"?:"<word>","only"?:"<owner>:<window>"|"room"}]}]}
- A line that the kit cannot show (another place, vehicles, animals other than a cat, things not in the action library) is {"line":n,"keep":true}: the regular planner shows it.
- Every action verb of the line needs an action whose key matches it. People at windows / in rooms are INSIDE; after dark nobody is outside except the rule's exceptions.
- A line about a person at home happens at THEIR house (house:<owner> outside, room:<owner> inside). Faces toward the camera; 1 shot a line, 2 when the line has two beats (cut on a word); never 3 cameras of one type in a row.
Output ONLY a compact JSON array of line entries for the lines asked.`;

function vocabText() {
  return `KIT VOCABULARY:\nplaces: ${BOARD.locs.join(" | ")}\ncameras: street ${BOARD.cams.street.join(", ")}; at a house ${BOARD.cams.house.join(", ")}; in a room ${BOARD.cams.room.join(", ")}\npeople where: ${BOARD.where.join(", ")}\nmonster where: ${BOARD.monsterWhere.join(", ")}; eye: ${BOARD.eyes.join(", ")}\nposes: ${BOARD.poses.join(", ")}\nfaces: ${BOARD.faces.join(", ")}\nACTIONS (key: what we see):\n${Object.entries(BOARD_ACTIONS).map(([k, v]) => `${k}: ${v}`).join("\n")}`;
}
/** the few-shot: #2's storyboard (its lines with their text) */
export function exampleText() {
  const ex = KID_NEVER_BLINKS, lines = ex.exampleLines ?? [];
  const body = ex.lines.filter((l) => !l.keep || l.replace).map((l) => JSON.stringify({ line: l.line, ...(lines[l.line] ? { text: lines[l.line] } : {}), place: l.place, shots: l.shots ?? undefined, keep: l.keep || undefined, replace: l.replace || undefined }));
  return `THE OWNER'S EXAMPLE ("${ex.title}"; world bible ${JSON.stringify({ homes: ex.bible.homes, houses: ex.bible.houses, events: ex.bible.events, rule: ex.bible.rule })}):\n${body.join("\n")}`;
}

// ------------------------------------------------------------------------------------------------ validation (free)
const tok = (s) => String(s).split(/\s+/).filter(Boolean), norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9']/g, "");
const CAM_RE = { street: /^(town_wide|street_wide|street_end|street_back|sky_up|eye_close|houses:[a-z0-9_]+(:[a-z0-9_]+)+|front:[a-z0-9_]+)$/, house: /^(house|front|cat|arrive):[a-z0-9_]+$|^window:[a-z0-9_]+:[0-3]$/, room: /^(room_wide|room_window|room_door|room_side|peek:me|cat_stare|bed_top|painting|behind_window|huddle_up|pov_eye|window_in|face:[a-z0-9_]+|room_me)$/ };
export function validateStoryboard(board, { lines, cast }) {
  const out = [], homes = board.bible?.homes ?? {}, isOwner = (o) => o in homes;
  const P = (n, m) => out.push({ line: n, problem: m });
  for (const [n, text] of lines.entries()) {
    const b = (board.lines ?? []).find((x) => x.line === n);
    if (!b) { P(n, "no entry"); continue; }
    if (b.keep) continue;
    if (!Array.isArray(b.shots) || !b.shots.length) { P(n, "no shots"); continue; }
    const words = tok(text).map(norm);
    b.shots.forEach((s, i) => {
      if (i && !words.includes(norm(s.at))) P(n, `shot ${i}: cut word "${s.at}" is not in the line`);
      const [kind, owner] = String(s.loc).split(":");
      if (!["street", "house", "room"].includes(kind) || (kind !== "street" && !isOwner(owner))) P(n, `shot ${i}: unknown place "${s.loc}"`);
      if (!CAM_RE[kind]?.test(String(s.cam))) P(n, `shot ${i}: camera "${s.cam}" not usable at ${kind}`);
      if (!BOARD.lights.includes(s.light ?? "night")) P(n, `shot ${i}: light "${s.light}"`);
      for (const p of s.people ?? []) {
        if (!cast[p.id]) P(n, `shot ${i}: unknown person "${p.id}"`);
        const w = String(p.where);
        if (!(/^window:[a-z0-9_]+:[0-3]$/.test(w) && isOwner(w.split(":")[1])) && !BOARD.where.includes(w)) P(n, `shot ${i}: ${p.id} where "${w}"`);
        if (/^room:/.test(w) && kind !== "room") P(n, `shot ${i}: ${p.id} in a room on a ${kind} shot`);
        if (p.pose && !BOARD.poses.includes(p.pose)) P(n, `shot ${i}: pose "${p.pose}"`);
        if (p.face && !BOARD.faces.includes(p.face)) P(n, `shot ${i}: face "${p.face}"`);
      }
      for (const a of s.acts ?? []) { if (!BOARD_ACTIONS[a.k]) P(n, `shot ${i}: unknown action "${a.k}"`); if (a.at && !words.includes(norm(a.at))) P(n, `shot ${i}: action word "${a.at}" not in the line`); }
      if (s.monster) { const w = String(s.monster.where); if (!(w === "end" || (/^(street|roomwindow):[a-z0-9_]+$/.test(w) && isOwner(w.split(":")[1])) || (/^window:[a-z0-9_]+:[0-3]$/.test(w) && isOwner(w.split(":")[1])))) P(n, `shot ${i}: monster where "${w}"`); }
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the calls
async function call({ apiKey, system, content, maxTokens, fetchFn }) {
  const t0 = Date.now();
  const res = await fetchFn("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: BOARD_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content }], output_config: { effort: "low" } }), signal: AbortSignal.timeout(180000) });
  const body = await res.json().catch(() => null);
  const costUsd = costOf(body?.model ?? BOARD_MODEL, body?.usage);
  if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 200)}`), { costUsd });
  const text = (body.content ?? []).filter((x) => x.type === "text").map((x) => x.text).join("").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let data = null; try { data = JSON.parse(text); } catch { /* the caller sees null */ }
  return { data, costUsd, ms: Date.now() - t0, stop: body.stop_reason };
}

/** the whole automatic storyboard: bible, then every scene in parallel, validation, one repair, the engine fallback */
export async function directStoryboard({ apiKey, script, cast, scenes, title = "", fetchFn = fetch, log = () => {}, capUsd = 0.25 }) {
  const t0 = Date.now(), lines = script.lines.map((l) => String(l.text ?? l));
  const castText = Object.entries(cast).map(([id, c]) => `${id}: ${c.name} (${c.role})`).join("; ");
  const numbered = lines.map((t, i) => `#${i} ${t}`).join("\n");
  let costUsd = 0;
  const spend = (r) => { costUsd += r.costUsd ?? 0; if (costUsd > capUsd) throw Object.assign(new Error(`storyboard director over its cap $${capUsd}`), { code: "STORYBOARD_FAILED" }); return r; };
  // 1. the world bible
  const bib = spend(await call({ apiKey, fetchFn, maxTokens: 1500, system: BIBLE_SYSTEM, content: `STORY "${title}"\nCAST: ${castText}\nLINES:\n${numbered}\n\n${exampleText()}` }));
  if (!bib.data?.homes) throw Object.assign(new Error("the storyboard bible was not usable"), { code: "STORYBOARD_FAILED", costUsd });
  const bible = { ...bib.data, drop: [] };
  log(`storyboard bible: ${Object.keys(bible.homes).length} homes, ${(bible.events ?? []).length} events (${bib.ms} ms)`);
  // 2. the scenes in parallel: one cached prefix (the vocabulary, the example, the story, the bible), a warm call writes it
  const prefix = `${vocabText()}\n\n${exampleText()}\n\nSTORY "${title}"\nCAST: ${castText}\nWORLD BIBLE: ${JSON.stringify(bible)}\nSCENES: ${JSON.stringify((scenes ?? []).map((s) => ({ id: s.id, lines: [s.from, s.to], location: s.location, time: s.time })))}\nLINES:\n${numbered}`;
  const ask = (ids, extra = "") => [{ type: "text", text: prefix, cache_control: { type: "ephemeral" } }, { type: "text", text: `Write the storyboard entries for lines ${ids.join(", ")} only.${extra}` }];
  const groups = (scenes?.length ? scenes.map((s) => Array.from({ length: s.to - s.from + 1 }, (_, k) => s.from + k)) : [lines.map((_, i) => i)]).filter((g) => g.length);
  spend(await call({ apiKey, fetchFn, maxTokens: 1, system: SHOT_SYSTEM, content: ask([0]) })); // the warm call: writes the cache
  const parts = await Promise.all(groups.map((g) => call({ apiKey, fetchFn, maxTokens: 450 * g.length + 300, system: SHOT_SYSTEM, content: ask(g) }).catch((e) => ({ data: null, costUsd: e.costUsd ?? 0, error: e.message }))));
  parts.forEach(spend);
  const board = { id: "auto", title, bible, kit: {}, lines: parts.flatMap((p) => (Array.isArray(p.data) ? p.data : [])) };
  log(`storyboard scenes: ${groups.length} calls in parallel, ${board.lines.length} lines (${Math.max(...parts.map((p) => p.ms ?? 0))} ms)`);
  // 3. validation + one repair of the failing lines, then the engine fallback
  let problems = validateStoryboard(board, { lines, cast });
  if (problems.length) {
    const bad = [...new Set(problems.map((p) => p.line))];
    const rep = spend(await call({ apiKey, fetchFn, maxTokens: 450 * bad.length + 300, system: SHOT_SYSTEM, content: ask(bad, ` Fix these problems (use ONLY the kit vocabulary; a line the kit can't show is {"line":n,"keep":true}): ${JSON.stringify(problems)}`) }).catch((e) => ({ data: null, costUsd: e.costUsd ?? 0 })));
    for (const e of Array.isArray(rep.data) ? rep.data : []) { board.lines = board.lines.filter((l) => l.line !== e.line); board.lines.push(e); }
    problems = validateStoryboard(board, { lines, cast });
  }
  const fellBack = [...new Set(problems.map((p) => p.line))];
  for (const n of fellBack) { board.lines = board.lines.filter((l) => l.line !== n); board.lines.push({ line: n, keep: true, fallback: problems.filter((p) => p.line === n).map((p) => p.problem) }); }
  board.lines.sort((a, b) => a.line - b.line);
  if (fellBack.length > lines.length / 2) throw Object.assign(new Error(`the board kit can't show ${fellBack.length} of ${lines.length} lines`), { code: "KIT_UNSUPPORTED", costUsd });
  return { board, costUsd: +costUsd.toFixed(6), ms: Date.now() - t0, fellBack, problems };
}
