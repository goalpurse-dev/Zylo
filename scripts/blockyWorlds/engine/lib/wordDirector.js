// Blocky Worlds WORD DIRECTOR (owner 2026-11-10, step 5d; EXPERIMENTAL): an alternative to the rule planner's shots:
// the AI director writes the shot parameters per word directly — where each shot starts (a word index), what the lens
// looks at (target), distance, yaw, pitch, the move, and each actor's pose + face. The planner still supplies the world
// (bible, cast, sets, objects / monster per line), the captions and the checks; this replaces only the cutting and the
// camera / acting. Built for a side-by-side with the planner on ONE script; the paid call waits for the owner's OK.
// Tested with fakes / recorded fixtures only (fakeWordDirector, fixtureWordDirector). No API call is made here unless
// anthropicWordDirector is called with a key (never by the tests or the dev tools without --paid --yes).
//   wordDirectorPrompt({ tl }) -> { system, user }       the indexed words + the cast, places, objects per line
//   wordDirectorSchema()                                   the structured-output schema
//   validateWordDirection(raw, { tl }) -> { shots, problems }   never throws; clamps, drops bad ids, fixes order
//   applyWordDirection(tl, dir) -> timeline                a copy of the planner's timeline with the director's shots
//   estimateWordDirector({ tl, model }) -> { system, user, output, usd, usdCached }  tokens + USD (no call)
//   fakeWordDirector(tl) -> raw                            a free stand-in derived from the planner's plan (tests)
import { PRICE } from "./builder/design.js";

export const WD_VERSION = 1;
export const WD_MODEL = "claude-sonnet-5-5";
export const WD_MOVES = Object.freeze(["push_in", "pull_out", "pan", "track", "orbit", "tilt_up", "static"]);
export const WD_TARGETS_FIXED = Object.freeze(["group", "object", "monster", "place"]);
const POSES = ["stand", "walk", "run", "point", "scared", "sit", "carry", "wave", "look_up", "talk", "sleep", "cheer", "yell", "hug", "hide", "jump", "dance", "fight"];
const FACES = ["neutral", "happy", "grin", "laugh", "sad", "crying", "angry", "surprised", "shocked", "scared", "smirk", "wink", "thinking", "sleepy", "worried"];
const clamp = (x, a, b, d) => (Number.isFinite(Number(x)) ? Math.min(b, Math.max(a, Number(x))) : d);
const r3 = (x) => Math.round(x * 1000) / 1000;

export const WD_SYSTEM = `You are the camera director of a 9:16 blocky-avatar story video (TikTok style). You get the narration as indexed words with times, the cast, the places of the story's one world, and what each line must show. Write the SHOTS directly, word by word:
- A shot starts on a word (startWord = that word's index). Shots tile the video: the first starts at word 0, each runs to the next one's start. Average about 1.4 s; never under 0.6 s; cut on phrase ends.
- Per shot: set (one of the places given), light (day | night | warm | dusk | dawn), target (a cast id, "group", "object", "monster" or "place"), distance (metres from the target, 0.8-30), yaw (degrees round the target, -60..60, 0 = the place's usual camera side), pitch (degrees, -10 = looking up from below .. 45 = from above), fov (degrees 25-70), move (push_in | pull_out | pan | track | orbit | tilt_up; never static), and actors: [{ id, pose, face }] (poses and faces from the lists; the subject faces the lens).
- THE PERMANENT RULE: every line's subject, nouns and action are on screen during that line: use the line's own cast / objects / monster in its shots. Never a sign, card or word on screen.
- ~40 % close / medium shots with a readable face, ~25 % wides of the world, the rest action. The opening shows the world.
Poses: ${POSES.join(", ")}. Faces: ${FACES.join(", ")}.
Answer with JSON only: { "shots": [ { "startWord", "set", "light", "target", "distance", "yaw", "pitch", "fov", "move", "actors": [ { "id", "pose", "face" } ] } ] }`;

export function wordDirectorSchema() {
  const actor = { type: "object", additionalProperties: false, required: ["id", "pose", "face"], properties: { id: { type: "string" }, pose: { type: "string" }, face: { type: "string" } } };
  const shot = { type: "object", additionalProperties: false, required: ["startWord", "set", "light", "target", "distance", "yaw", "pitch", "fov", "move", "actors"],
    properties: { startWord: { type: "integer" }, set: { type: "string" }, light: { type: "string" }, target: { type: "string" }, distance: { type: "number" }, yaw: { type: "number" }, pitch: { type: "number" }, fov: { type: "number" }, move: { type: "string" }, actors: { type: "array", items: actor } } };
  return { type: "object", additionalProperties: false, required: ["shots"], properties: { shots: { type: "array", items: shot } } };
}

/** the user message: indexed words (with line breaks), the cast, the places, each line's must-show items */
export function wordDirectorPrompt({ tl }) {
  const words = (tl.captions ?? []).map((w, i) => `${i}:${w.word}@${w.start.toFixed(2)}`);
  const lines = (tl.lines ?? []).map((L, i) => {
    const shots = (tl.shots ?? []).filter((s) => (s.lines ?? [s.line]).includes(i));
    const objs = [...new Set(shots.flatMap((s) => (s.objects ?? []).map((o) => o.name)))], who = [...new Set(shots.flatMap((s) => (s.actors ?? []).map((a) => a.id)))];
    return `line ${i} (${L.start.toFixed(2)}-${L.end.toFixed(2)} s, ${L.part}): "${L.text}" | subject ${L.subject ?? "-"} | people ${who.join(", ") || "-"} | objects ${objs.join(", ") || "-"}${shots.some((s) => s.monsterState) ? " | the monster" : ""}`;
  });
  const cast = Object.entries(tl.cast ?? {}).map(([id, c]) => `${id}: ${c.name || id} (${c.role}${c.look?.outfit ? `, ${c.look.outfit}` : ""})`);
  const sets = [...new Set((tl.shots ?? []).map((s) => s.set))];
  return { system: WD_SYSTEM, user: `TITLE: ${tl.title}\nPLACES: ${sets.join(", ")}\nCAST: ${cast.join("; ")}\n${tl.monster ? `MONSTER: ${tl.monster.name}\n` : ""}LINES:\n${lines.join("\n")}\nWORDS (index:word@start):\n${words.join(" ")}` };
}

/** token + USD estimate of one call (no call): ~4 characters a token for the prompts; output from the shot count */
export function estimateWordDirector({ tl, model = WD_MODEL, shotsPerSec = 1 / 1.4, thinkingOut = 1500 }) {
  const { system, user } = wordDirectorPrompt({ tl });
  const tok = (s) => Math.ceil(s.length / 3.8);
  const shots = Math.ceil((tl.duration ?? 90) * shotsPerSec);
  const output = shots * 70 + thinkingOut; // ~70 tokens a shot (JSON with 1-3 actors) + reasoning
  const p = PRICE[model] ?? PRICE[WD_MODEL];
  const sys = tok(system), usr = tok(user) + 400; // + the schema
  const usd = (sys * p.cacheWrite + usr * p.input + output * p.output) / 1e6;
  const usdCached = (sys * p.cacheRead + usr * p.input + output * p.output) / 1e6;
  return { model, system: sys, user: usr, output, shots, usd: +usd.toFixed(4), usdCached: +usdCached.toFixed(4), worstUsd: +((sys * p.cacheWrite + usr * p.input + output * 2 * p.output) / 1e6 * 2).toFixed(4) };
}

/** checks and repairs the director's answer (never throws) -> { shots, problems } */
export function validateWordDirection(raw, { tl }) {
  const problems = [], caps = tl.captions ?? [], N = caps.length;
  const sets = new Set((tl.shots ?? []).map((s) => s.set)), cast = tl.cast ?? {};
  let shots = Array.isArray(raw?.shots) ? raw.shots : (problems.push("no shots"), []);
  shots = shots.map((s, i) => {
    const w = Math.round(clamp(s?.startWord, 0, Math.max(0, N - 1), 0));
    const set = sets.has(s?.set) ? s.set : (problems.push(`shot ${i}: set "${s?.set}" -> ${[...sets][0]}`), [...sets][0] ?? "street");
    const light = ["day", "night", "warm", "dusk", "dawn"].includes(s?.light) ? s.light : (problems.push(`shot ${i}: light "${s?.light}"`), "day");
    let target = String(s?.target ?? "group");
    if (!cast[target] && !WD_TARGETS_FIXED.includes(target)) { problems.push(`shot ${i}: target "${target}" -> group`); target = "group"; }
    const move = WD_MOVES.includes(s?.move) && s.move !== "static" ? s.move : (problems.push(`shot ${i}: move "${s?.move}" -> push_in`), "push_in");
    const actors = (Array.isArray(s?.actors) ? s.actors : []).filter((a) => cast[a?.id] || (problems.push(`shot ${i}: unknown actor "${a?.id}"`), false)).slice(0, 6)
      .map((a) => ({ id: a.id, pose: POSES.includes(a.pose) ? a.pose : "stand", face: FACES.includes(a.face) ? a.face : "neutral" }));
    return { startWord: w, set, light, target, distance: clamp(s?.distance, 0.8, 30, 3), yaw: clamp(s?.yaw, -60, 60, 0), pitch: clamp(s?.pitch, -10, 45, 5), fov: clamp(s?.fov, 25, 70, 40), move, actors };
  }).sort((a, b) => a.startWord - b.startWord);
  // the first shot at word 0; no two shots on one word; pieces under 0.6 s merge into the shot before
  if (shots.length && shots[0].startWord !== 0) { problems.push("first shot moved to word 0"); shots[0].startWord = 0; }
  const out = [];
  for (const s of shots) {
    const prev = out.at(-1);
    if (prev && (s.startWord === prev.startWord || caps[s.startWord].start - caps[prev.startWord].start < 0.6)) { problems.push(`shot at word ${s.startWord}: under 0.6 s, merged`); continue; }
    out.push(s);
  }
  return { shots: out, problems };
}

/** the planner's timeline with the director's shots: start / end on the words, the world items of each line kept */
export function applyWordDirection(tl0, dir) {
  const tl = JSON.parse(JSON.stringify(tl0)), caps = tl.captions ?? [];
  const old = tl0.shots ?? [];
  const at = (t) => old.find((s) => t >= s.start - 1e-6 && t < s.end - 1e-6) ?? old.at(-1);
  tl.shots = dir.shots.map((d, i) => {
    const start = i === 0 ? 0 : r3(caps[d.startWord].start), end = i + 1 < dir.shots.length ? r3(caps[dir.shots[i + 1].startWord].start) : tl0.duration;
    const p = at(start + (end - start) / 2); // the planner's shot of that moment: its line, subject
    // every planner shot this one overlaps hands over its lines, objects and monster (the PERMANENT RULE's items stay on screen)
    const over = old.filter((o) => o.start < end - 1e-6 && o.end > start + 1e-6);
    const objects = []; for (const o of over) for (const x of o.objects ?? []) if (!objects.some((y) => y.name === x.name && y.asset === x.asset)) objects.push(JSON.parse(JSON.stringify(x)));
    const lines = [...new Set(over.flatMap((o) => o.lines ?? [o.line]))].sort((a, b) => a - b);
    const ms = over.find((o) => o.monsterState)?.monsterState ?? null;
    const spots = { 1: ["center"], 2: ["left", "right"], 3: ["left", "center", "right"] }[Math.min(3, d.actors.length)] ?? ["left", "center", "right", "back", "back", "back"];
    const actors = d.actors.map((a, k) => ({ id: a.id, spot: spots[k] ?? "back", pose: a.pose, expr: p.actors?.find((x) => x.id === a.id)?.expr ?? "neutral", face: a.face, facing: "camera", hold: p.actors?.find((x) => x.id === a.id)?.hold ?? null }));
    const focus = tl.cast[d.target] && actors.some((a) => a.id === d.target) ? d.target : d.target === "object" && over.some((o) => o.objects?.length) ? "object" : d.target === "monster" && tl.monster && over.some((o) => o.monsterState) ? "monster" : "group";
    const camera = d.distance <= 1.6 ? "closeup" : d.distance <= 3.5 ? "medium" : "wide";
    return { start, end, line: p.line, lines: lines.length ? lines : [p.line], part: p.part, set: d.set, light: d.light, camera, focus, actors, monsterState: ms, insert: null, marker: null,
      ...(objects.length ? { objects } : {}), seed: (p.seed ?? i) + i, text: caps.slice(d.startWord, dir.shots[i + 1]?.startWord ?? caps.length).map((w) => w.word).join(" "), subject: p.subject ?? null,
      ...((over.find((o) => o.set === d.set && o.worldSpot) ?? null) ? { worldSpot: over.find((o) => o.set === d.set && o.worldSpot).worldSpot } : {}), ...(over.find((o) => o.setState)?.setState ? { setState: over.find((o) => o.setState).setState } : {}), cam: { target: d.target, distance: d.distance, yaw: d.yaw, pitch: d.pitch, fov: d.fov }, camMove: { type: d.move === "orbit" ? "track" : d.move, speed: "slow" } };
  });
  tl.direction = { ...(tl.direction ?? {}), wordDirector: { version: WD_VERSION, shots: tl.shots.length } };
  return tl;
}

/** a FREE stand-in for the model (tests, the side-by-side's dry run): the planner's shots re-cut every ~1.4 s on words,
 *  with explicit camera numbers per framing. Never claims to be the model: tl.direction.wordDirector.fake */
export function fakeWordDirector(tl) {
  const caps = tl.captions ?? [], shots = [];
  let last = -9;
  caps.forEach((w, i) => {
    const lineStart = (tl.lines ?? []).some((L) => Math.abs(L.start - w.start) < 0.02);
    if (i && w.start - last < (lineStart ? 0.6 : 1.4)) return;
    const p = (tl.shots ?? []).find((s) => w.start >= s.start - 1e-6 && w.start < s.end - 1e-6) ?? tl.shots.at(-1);
    const k = shots.length, close = k % 3 === 1, wide = p.camera === "wide" || k % 5 === 0;
    const target = p.focus && tl.cast?.[p.focus] ? p.focus : (p.actors?.length > 1 ? "group" : p.actors?.[0]?.id ?? (p.focus === "monster" ? "monster" : p.objects?.length ? "object" : "place"));
    shots.push({ startWord: i, set: p.set, light: p.light, target, distance: wide ? 7 : close ? 1.4 : 2.8, yaw: ((k * 17) % 50) - 25, pitch: wide ? 18 : 4, fov: wide ? 52 : close ? 34 : 42,
      move: ["push_in", "pan", "orbit", "push_in", "pull_out"][k % 5], actors: (p.actors ?? []).map((a) => ({ id: a.id, pose: a.pose, face: a.face ?? a.expr ?? "neutral" })) });
    last = w.start;
  });
  return { shots, fake: true };
}

/** the PAID call (Sonnet 5.5, the existing director's call shape: lib/director/design.js). Never called by the tests or
 *  the dev tools without --paid --yes and the owner's OK. -> { data, costUsd, usage, ms, model } */
export function anthropicWordDirector({ apiKey, model = WD_MODEL, fetchFn = fetch, effort = "low", timeoutMs = 240000, maxTokens = 12000 } = {}) { // 12k out: the worst case stays under $0.13
  if (!apiKey) throw new Error("anthropicWordDirector: no apiKey");
  const P = PRICE[model] ?? PRICE[WD_MODEL];
  return {
    model,
    async direct({ tl }) {
      const t0 = Date.now(), { system, user } = wordDirectorPrompt({ tl });
      const res = await fetchFn("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: user }],
          output_config: { effort, format: { type: "json_schema", schema: wordDirectorSchema() } } }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await res.json().catch(() => null), u = body?.usage ?? {};
      const costUsd = +(((u.input_tokens ?? 0) * P.input + (u.output_tokens ?? 0) * P.output + (u.cache_read_input_tokens ?? 0) * P.cacheRead + (u.cache_creation_input_tokens ?? 0) * P.cacheWrite) / 1e6).toFixed(6);
      const base = { costUsd, usage: body?.usage ?? null, ms: Date.now() - t0, model: body?.model ?? model };
      if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), base);
      const text = (body?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
      try { return { data: JSON.parse(text), ...base }; } catch { throw Object.assign(new Error("the reply was not JSON"), base); }
    },
  };
}

/** a recorded answer (a JSON file of a real call), for replaying a paid run for free */
export function fixtureWordDirector(json) { return typeof json === "string" ? JSON.parse(json) : json; }
