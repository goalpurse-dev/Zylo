// Blocky Worlds SHOT PROMPTS (owner 2026-11-11: "every shot is written like an AI-video-gen PROMPT PAIR, and then the
// engine builds it"): script -> scene list -> shot prompts (text) -> the engine turns each prompt into exact shot
// parameters / animations -> the stills are checked against the image prompt -> render.
//   shotSkeletons(tl, board)   the planned shots as facts (timing, words, place, who, actions, world state) for the writer
//   promptRequest(...)         the Sonnet request (the system prompt + the owner's #2 storyboard as the few-shot example)
//   checkPrompts(prompts, tl, board) -> per shot / per line misses (FREE, hard checks):
//     verbs  every action verb of the narration is a timed action in a video prompt of its line
//     rule   the rule's constraints (after dark: nobody outside but the exceptions; people indoors)
//     chain  inside a scene, each shot's start state = the previous shot's end state
//   promptsHtml(...)           a readable page grouped by scene
import { verbsOf } from "./boardActions.js";
import { costOf } from "./builder/design.js";

export const PROMPT_MODEL = "claude-sonnet-5-5";
const STATE_KEYS = ["curtains", "nell_sock", "windows", "batter", "blanket", "monster", "street"];

export const SHOT_PROMPT_SYSTEM = `You are the shot director of a short vertical (9:16) blocky-cartoon story video. You write each planned shot as an AI-video-generation PROMPT PAIR; a 3D engine then builds it exactly, so be concrete and literal.

For EVERY shot in the list you get (same ids, same order) write:
1. "image": the IMAGE PROMPT for the first frame (max 55 words): the exact place (from the world bible), who is in frame + position + facing + outfit cue, props and their state, the world state (curtains on / gone, windows normal / white / dark, streets empty), time of day + lighting, the camera (distance, height, angle, lens mm), and what the viewer must understand at a glance.
2. "video": the VIDEO PROMPT as a timed action list [{ "t": seconds from the shot start, "who": id or thing, "do": one physical action }]. Every ACTION VERB of the narration words inside this shot must appear as a timed action at (or just before) its word's time, using the same verb (ripped -> "rips", nailed -> "nails"). Characters DO things (verbs = animations); a face alone is never an action.
3. "faces": expression changes pinned to words [{ "t", "who", "face", "word" }] (faces: neutral happy grin sad crying angry surprised shocked scared smirk thinking sleepy worried).
4. "camera": the camera move (type, speed, start -> end), one short phrase.
5. "effects": wind / glow / dust / none, short.
6. "start" and "end": the world state as the shot starts / ends, with EXACTLY these keys: curtains (on | ripping | gone), nell_sock (on | off), windows (warm | white | dark | day), batter (none | on | licked), blanket (none | over | flying), monster (absent | street_end | at_window | in_street | backing_away), street (empty | hero_only | people). Within a scene the next shot's "start" must equal this shot's "end".
7. "outside": ids of the people standing OUTSIDE (on the street / pavement / garden) in this shot; [] if none. People behind glass are inside.

HOW, NOT JUST WHAT (every story): every video action says which hand or body part, the speed (slowly / quickly / in 0.3 s), the distance or direction, and what REACTS and how (the thing touched moves, drips, shakes, flies). Example: "scoops batter with the right hand, slaps it flat on the pane, the batter drips down slowly".

Hard rules: the world bible's rule constraints hold in every shot (after dark the streets are empty and people stay behind their windows; only the listed exceptions may be outside). Keep each shot's facts (place, people, actions, camera type) exactly as given; you only write them as prompts. Output ONLY a compact JSON array (no whitespace between tokens, omit "faces" when nobody's face changes), no prose.`;

/** the planned shots as facts for the writer */
export function shotSkeletons(tl, board) {
  const caps = tl.captions ?? [];
  return tl.shots.map((s, i) => {
    const words = caps.filter((w) => w.start >= s.start - 1e-3 && w.start < s.end - 1e-3).map((w) => `${w.word}@${(w.start - s.start).toFixed(2)}`);
    const b = s.board;
    const base = { id: i, line: s.line, scene: s.scene ?? null, t: [s.start, s.end].map((x) => +x.toFixed(2)), light: s.light, words: words.join(" ") };
    if (b) return { ...base, place: b.loc, cam: `${b.cam} (${s.camera})`, people: b.people.map((p) => `${p.id}@${p.where}${p.pose ? ` ${p.pose}` : ""}${p.face ? ` (${p.face})` : ""}${p.shut ? " eyes shut" : ""}`), monster: b.monster ? `${b.monster.where} eye:${b.monster.eye ?? "stare"}${b.monster.state ? ` ${b.monster.state}` : ""}${b.monster.turnTo ? ` turns to ${b.monster.turnTo}'s house` : ""}` : null, actions: b.acts.map((a) => `${a.k}${a.who ? ` by ${a.who}` : ""}${a.at ? ` at ${a.at}s` : ""}`) };
    return { ...base, place: s.set === "bedroom" ? "room:me" : "street", cam: s.camera, people: (s.actors ?? []).map((a) => `${a.id} ${a.pose ?? "stand"} (${a.expr ?? ""})`), monster: s.monsterState ? `${s.monsterState.spot} ${s.monsterState.state} eye:${s.monsterState.eye}` : null, actions: ["(planned engine shot: keep as is)"] };
  });
}

/** the owner's storyboard as text (the few-shot example of what each line SHOWS) */
export function storyboardText(board, tl) {
  return board.lines.map((b) => `#${b.line} "${tl.lines[b.line].text}" -> ${b.keep ? `keep the planned shots${b.replace ? " (one replaced)" : ""}` : b.shots.map((s) => `[${s.at ? `from "${s.at}": ` : ""}${s.loc}, ${s.cam}; ${(s.acts ?? []).map((a) => a.k).join(", ") || "no action"}]`).join(" ")}`).join("\n");
}

export function promptRequest(tl, board) {
  const scenes = (tl.scenes ?? []).map((sc) => `${sc.id}: lines ${sc.from}-${sc.to}, ${sc.location}, ${sc.time}`).join("\n");
  const bible = JSON.stringify({ homes: board.bible.homes, houses: board.bible.houses, events: board.bible.events.map((e) => `line ${e.line}: ${e.owners.join(",")}${e.except ? ` except ${e.except}` : ""} -> ${JSON.stringify(e.set)}${e.why ? ` (${e.why})` : ""}`), rule: board.bible.rule });
  const cast = Object.entries(tl.cast ?? {}).map(([id, c]) => `${id}: ${c.name} (${c.role})`).join("; ");
  const user = `STORY: "${tl.title}"\nCAST: ${cast}; monster: The Peeker (a very tall dark blocky creature with ONE huge glowing eye)\n\nWORLD BIBLE + RULE CONSTRAINTS:\n${bible}\n\nSCENE LIST:\n${scenes}\n\nTHE OWNER'S STORYBOARD (the source of truth; each line = what we SEE happening):\n${storyboardText(board, tl)}\n\nTHE SHOTS (facts; word@seconds from the shot start):\n${JSON.stringify(shotSkeletons(tl, board))}`;
  return { system: SHOT_PROMPT_SYSTEM, user };
}

/** the calls: the shots in parts (the whole request cached once, each later part reads it), max_tokens from the money
 *  cap; -> { data (all parts), costUsd, usage[], stop[] } */
export const MODEL_PRICE = { "claude-sonnet-5-5": { in: 2, out: 10, write: 2.5, read: 0.2 }, "claude-haiku-5-5": { in: 0.1, out: 0.5, write: 0.125, read: 0.01 } };
export async function writePrompts({ apiKey, tl, board, capUsd = 0.15, parts = 2, ids = null, perShot = 0, model = PROMPT_MODEL, note = "", fetchFn = fetch, log = () => {} }) {
  const { system, user } = promptRequest(tl, board);
  const P = MODEL_PRICE[model] ?? MODEL_PRICE[PROMPT_MODEL];
  const estIn = Math.ceil((system.length + user.length) / 2.0); // ~2 chars a token (JSON-heavy: the #2 request was 23.7k chars = 11.4k tokens)
  const inWorst = (estIn * P.write + (parts - 1) * estIn * P.read + parts * 120 * P.in) / 1e6;
  // perShot: the output room a part gets per shot (a full-detail shot is ~440 tokens); else the cap split evenly
  const nIds = ids?.length ?? tl.shots.length;
  const maxOut = perShot ? perShot * Math.ceil(nIds / parts) : Math.floor((capUsd - inWorst) / parts / (P.out / 1e6));
  if (maxOut < 2000) throw new Error(`cap $${capUsd} leaves only ${maxOut} output tokens a part`);
  const all = ids ?? tl.shots.map((_, i) => i), per = Math.ceil(all.length / parts), data = [], usage = [], stop = [], raw = [];
  let costUsd = 0;
  for (let k = 0; k < parts; k++) {
    const part = all.slice(k * per, (k + 1) * per); if (!part.length) break;
    const partWorst = ((k ? estIn * P.read : estIn * P.write) + maxOut * P.out) / 1e6;
    if (costUsd + partWorst > capUsd) { log(`stop: part ${k + 1} could take the spend $${costUsd.toFixed(4)} over the cap $${capUsd}`); break; }
    log(`part ${k + 1}/${parts}: ids ${part.join(",")} (max ${maxOut} tokens)`);
    const res = await fetchFn("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxOut, system: [{ type: "text", text: system }], messages: [{ role: "user", content: [{ type: "text", text: user, cache_control: { type: "ephemeral" } }, { type: "text", text: `Write the prompt pairs for shot ids ${part.join(", ")} only.${note ? ` ${note}` : ""}` }] }], ...(model.includes("sonnet") ? { output_config: { effort: "low" } } : { thinking: { type: "disabled" } }) }), // Haiku: no thinking (2026-11-11: with its default thinking a $0.017 draft spent every token thinking and wrote nothing)
      signal: AbortSignal.timeout(600000),
    });
    const body = await res.json().catch(() => null);
    costUsd += costOf(body?.model ?? model, body?.usage);
    if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { costUsd });
    const text = (body.content ?? []).filter((x) => x.type === "text").map((x) => x.text).join("").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    usage.push(body.usage); stop.push(body.stop_reason); raw.push(text);
    const got = completeObjects(text); data.push(...got); log(`  -> ${got.length} shots, stop ${body.stop_reason}, $${costUsd.toFixed(4)} so far`);
    // out of room in a part: its complete shots are kept (never a paid retry of the same shots); the next part is other shots
  }
  return { data, raw: raw.join("\n----\n"), costUsd: +costUsd.toFixed(6), usage, stop, maxOut };
}

/** SONNET REPAIR of a draft: only the shots that fail the free checks, as small patches (the failing fields only), a
 *  compact request (the failing shots' facts + draft fields + the failures); -> { prompts (patched), costUsd, patched } */
export async function repairPrompts({ apiKey, tl, board, prompts, checks, capUsd = 0.01, model = PROMPT_MODEL, kinds = ["rule", "chain", "verbs", "how"], fetchFn = fetch, log = () => {} }) {
  const fails = new Map();
  const add = (id, m) => { if (id == null || !prompts.some((p) => p.id === id)) return; if (!fails.has(id)) fails.set(id, []); fails.get(id).push(m); };
  for (const k of kinds) for (const m of checks[k] ?? []) {
    if (k === "verbs") { const n = Number(m.match(/^line (\d+)/)?.[1]); const s = tl.shots.findIndex((x) => x.line === n && x.board?.acts.length) ; add(s >= 0 ? s : tl.shots.findIndex((x) => x.line === n), m); continue; }
    const ids = [...m.matchAll(/shot (\d+)/g)].map((x) => Number(x[1])); add(ids.at(-1), m);
  }
  const sk = shotSkeletons(tl, board);
  // only what each fix needs: the state fields for the rule / the chain, the actions + words for a verb / HOW miss
  const items = [...fails.entries()].map(([id, ms]) => { const p = prompts.find((x) => x.id === id), act = ms.some((m) => /not a timed action|wants 2 of/.test(m)); return { id, line: tl.lines[tl.shots[id].line].text, facts: { place: sk[id].place, people: sk[id].people, ...(act ? { monster: sk[id].monster, actions: sk[id].actions, words: sk[id].words } : {}) }, draft: act ? { video: p.video } : { start: p.start, end: p.end, outside: p.outside }, ...(act ? {} : { prevEnd: prompts.find((x) => x.id === id - 1)?.end ?? null }), failures: ms }; });
  if (!items.length) return { prompts, costUsd: 0, patched: [] };
  const P = MODEL_PRICE[model];
  const system = `You repair shot prompt drafts of a vertical cartoon video. For each item, return a PATCH with ONLY the fields that fix its failures: "video" (the full corrected timed action list; every action says which hand / body part or direction, the speed or manner, and what reacts), "start" / "end" (all 7 state keys: curtains, nell_sock, windows, batter, blanket, monster, street), "outside" (ids standing outside; people behind glass or in a room are inside). A shot's "start" must equal the previous shot's end (prevEnd) within a scene; after dark nobody but the rule's exceptions is outside. Output ONLY a compact JSON array [{"id":..,...}].`;
  const user = JSON.stringify({ rule: board.bible.rule, items });
  // the exact input size (the free token-count endpoint), so the cap sets the output room right
  const ct = await fetchFn("https://api.anthropic.com/v1/messages/count_tokens", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model, system, messages: [{ role: "user", content: user }] }) }).then((r) => r.json()).catch(() => null);
  const estIn = ct?.input_tokens ?? Math.ceil((system.length + user.length) / 2.0);
  const maxOut = Math.floor((capUsd - estIn * P.in / 1e6) / (P.out / 1e6));
  if (maxOut < 300) { log(`repair: cap $${capUsd} leaves ${maxOut} tokens for ${items.length} shots: not sent`); return { prompts, costUsd: 0, patched: [], skipped: items.map((x) => x.id) }; }
  log(`repair: ${items.length} shots (${items.map((x) => x.id).join(",")}), ~${estIn} in, max ${maxOut} out`);
  const res = await fetchFn("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model, max_tokens: maxOut, system, messages: [{ role: "user", content: user }], ...(model.includes("sonnet") ? { output_config: { effort: "low" } } : { thinking: { type: "disabled" } }) }) });
  const body = await res.json().catch(() => null);
  const costUsd = costOf(body?.model ?? model, body?.usage);
  if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { costUsd });
  const text = (body.content ?? []).filter((x) => x.type === "text").map((x) => x.text).join("").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const patches = completeObjects(text), out = prompts.map((p) => ({ ...p }));
  for (const q of patches) { const p = out.find((x) => x.id === q.id); if (!p) continue; for (const k of ["video", "start", "end", "outside"]) if (q[k] != null) p[k] = q[k]; p.repaired = true; }
  log(`repair: $${costUsd} stop ${body.stop_reason}; ${patches.length} patches`);
  return { prompts: out, costUsd, patched: patches.map((q) => q.id), stop: body.stop_reason, usage: body.usage, unpatched: items.map((x) => x.id).filter((id) => !patches.some((q) => q.id === id)) };
}

// the words of a video beat that time each animated action (the prompt's timed list -> the action's start)
const KEY_WORDS = { "press:eye": /press|push|squash/i, "glow:windows": /glow|white|blaz/i, "rip:curtains": /rip|tear|yank/i, "fly:curtains": /fl(y|ies|ew)|soar|kite/i, "nail:boards": /nail|hammer|bang/i, "grab:boards": /grab|lift|pick/i, "smear:batter": /slap|smear|scoop/i, "lick:glass": /lick|tongue/i, "blow_off:blanket": /blanket.*(fl|blow|lift)|(fl|blow|lift).*blanket/i, "sneeze": /sneez/i, "turn:monster": /turn/i, "pull:sock": /pull|rip|tug/i, "blink:eye": /blink|lid/i, "back_away:monster": /back|retreat|step/i, "dark:windows": /dark|off/i, "peek:curtains": /peek|pull|curtain/i, "hide:curtains": /hide|duck|shut|yank/i, "arrive:monster": /stride|walk|step|arriv/i, "poke_out:cat": /poke|cat|head/i, "catch:peeking": /step|enter|appear/i, "look_up": /look|tilt/i, "stack:bricks": /brick|stack|set/i };
/** THE ENGINE PARAMETERS FROM THE PROMPTS: each board shot takes its prompt's faces (pinned to words) and the start of
 *  each animated action from the prompt's timed beats; -> a new timeline (+ what was taken, per shot) */
export function paramsFromPrompts(tl0, prompts) {
  const tl = JSON.parse(JSON.stringify(tl0)), byId = new Map((prompts ?? []).map((p) => [p.id, p])), log = [];
  tl.shots.forEach((s, i) => {
    const p = byId.get(i); if (!p || !s.board) return;
    const dur = s.end - s.start, took = [];
    for (const f of p.faces ?? []) { const person = s.board.people.find((x) => x.id === f.who); if (person && f.face) { (person.faces ??= []).push({ t: Math.max(0, Math.min(dur - 0.05, Number(f.t) || 0)), face: f.face }); took.push(`${f.who} ${f.face}@${f.t}`); } }
    for (const a of s.board.acts) {
      const re = KEY_WORDS[a.k]; if (!re) continue;
      const beat = (p.video ?? []).find((v) => re.test(`${v.do}`) && (!a.who || v.who === a.who || !s.board.people.some((x) => x.id === v.who)));
      if (beat && !(a.at > 0)) { a.at = Math.max(0, Math.min(dur - 0.2, Number(beat.t) || 0)); took.push(`${a.k}@${a.at}`); }
    }
    s.board.prompt = { image: p.image, camera: p.camera };
    if (took.length) log.push(`shot ${i}: ${took.join(", ")}`);
  });
  return { tl, log };
}

// ------------------------------------------------------------------------------------------------ free enrichment
// (no paid call) the facts the engine KNOWS replace what the writer guessed, and thin beats get their missing HOW
const VERB_BEAT = { "look out": "looks out past the curtain edge with one eye, slowly, the curtain trembling in the fingers", glowed: "every window glows white, one after another, quickly, the light spilling onto the empty street", glows: "the window glows white in 0.3 s, the light flooding the pane" };
const QUICK = /\b(slap|snap|jerk|flinch|duck|yank|rip|tear|sneez|blink|slam|grab|bang|hit|nail|jump|pop|flick|twitch|spin)/i;
const HANDS = /\b(pull|push|grab|hold|slap|pat|wave|point|press|lift|scoop|smear|tug|tape|hammer|nail|stack|set|pick|reach|cover|wipe|knock|tap)/i;
const LOOKS = /\b(look|stare|peek|gaze|glance|watch|peer|eye)/i;
export function enrichPrompts(prompts0, tl) {
  const prompts = JSON.parse(JSON.stringify(prompts0)), byId = new Map(prompts.map((p) => [p.id, p])), log = [];
  // 1. a narration verb with no timed action: the beat from the template, at the matching action's start
  for (const [n, l] of (tl.lines ?? []).entries()) {
    const ids = tl.shots.map((s, i) => [s, i]).filter(([s]) => s.line === n).map(([, i]) => i);
    const text = ids.flatMap((i) => (byId.get(i)?.video ?? []).map((a) => a.do)).join(" | ");
    for (const v of verbsOf(l.text)) {
      if (verbRe(v).test(text)) continue;
      const beat = VERB_BEAT[v.verb.toLowerCase()]; if (!beat) continue;
      const host = ids.map((i) => [i, tl.shots[i]]).find(([, s]) => (s.board?.acts ?? []).some((a) => v.keys.includes(a.k))) ?? [ids[0], tl.shots[ids[0]]];
      const act = (host[1].board?.acts ?? []).find((a) => v.keys.includes(a.k));
      const p = byId.get(host[0]); if (!p) continue;
      p.video = [...(p.video ?? []), { t: act?.at ?? 0, who: act?.who ?? (v.keys.some((k) => /windows/.test(k)) ? "windows" : "town1"), do: beat }].sort((a, b) => a.t - b.t);
      log.push(`shot ${host[0]}: + "${beat.slice(0, 50)}..." (line ${n} "${v.verb}")`);
    }
  }
  // 2. the monster and the street from the shot's facts: where the Peeker is (an arrival walks in from the street; a shot
  //    that does not show it holds the state of the shot after it in the scene, else the one before), who is outside
  //    (the scene's street: the most seen in it, empty < hero_only < people; "outside" = who stands outside in frame)
  const RANK = ["empty", "hero_only", "people"];
  const facts = tl.shots.map((s, i) => {
    const b = s.board, m = b ? b.monster : s.monsterState;
    const arrive = (b?.acts ?? []).some((a) => a.k === "arrive:monster"), back = (b?.acts ?? []).some((a) => a.k === "back_away:monster");
    const where = !m ? null : b ? (/^(window|roomwindow):/.test(m.where) ? "at_window" : m.where === "end" ? "street_end" : "in_street") : "in_street";
    const out = b ? b.people.filter((x) => !/^(window|room):/.test(x.where)).map((x) => x.id) : s.set === "street" ? (s.actors ?? []).map((a) => a.id) : [];
    return { i, scene: s.scene, mon: where ? { start: arrive ? "in_street" : where, end: back ? "backing_away" : where } : null, out, street: !out.length ? 0 : out.every((x) => x === "me") ? 1 : 2 };
  });
  const sceneStreet = {}; for (const f of facts) sceneStreet[f.scene] = Math.max(sceneStreet[f.scene] ?? 0, f.street);
  for (const f of facts) {
    const p = byId.get(f.i); if (!p) continue;
    p.start ??= {}; p.end ??= {}; p.outside = f.out;
    p.start.street = p.end.street = RANK[sceneStreet[f.scene]];
    let mon = f.mon;
    if (!mon) { const next = facts.slice(f.i + 1).find((x) => x.scene === f.scene && x.mon); const prev = [...facts.slice(0, f.i)].reverse().find((x) => x.scene === f.scene && x.mon); const v = next ? next.mon.start : prev ? prev.mon.end : null; if (v) mon = { start: v, end: v }; }
    if (mon) { p.start.monster = mon.start; p.end.monster = mon.end; }
  }
  // inside a scene the start state is the end state of the shot before (the other keys: what the writer handed over)
  for (let i = 1; i < tl.shots.length; i++) { const a = byId.get(i - 1), b = byId.get(i); if (a && b && tl.shots[i].scene === tl.shots[i - 1].scene) for (const k of Object.keys(a.end ?? {})) if (k !== "monster" && k !== "street" && b.start) b.start[k] = a.end[k]; }
  // 3. thin beats: the missing manner (a speed word) and, still thin, the missing where (the hand / the eyes)
  for (const p of prompts) for (const a of p.video ?? []) {
    const d = String(a.do ?? ""), part = HOW_PART.test(d), how = HOW_SPEED.test(d) || HOW_MANNER.test(d), react = HOW_REACT.test(d);
    if (part + how + react >= 2) continue;
    let add = "";
    if (!how) add += QUICK.test(d) ? ", quickly" : ", slowly";
    if (!part && !react) add += HANDS.test(d) ? " with the right hand" : LOOKS.test(d) ? ", eyes wide" : a.who === "monster" ? ", its huge eye forward" : " toward the window";
    a.do = d + add; log.push(`shot ${p.id}: "${d.slice(0, 40)}" +"${add}"`);
  }
  return { prompts, log };
}

/** the complete top-level objects of a JSON array text (a reply cut off at max_tokens keeps its finished shots) */
export function completeObjects(text) {
  const s = String(text ?? "").trim();
  try { const j = JSON.parse(s); return Array.isArray(j) ? j : []; } catch { /* cut off: salvage */ }
  let depth = 0, inStr = false, esc = false, lastEnd = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === "{" || c === "[") depth++; else if (c === "}" || c === "]") { depth--; if (depth === 1 && c === "}") lastEnd = i; }
  }
  try { return lastEnd > 0 ? JSON.parse(s.slice(0, lastEnd + 1) + "]") : []; } catch { return []; }
}

// ------------------------------------------------------------------------------------------------ the free checks
// HOW, NOT JUST WHAT: an action beat says the body part / hand or a distance, AND a speed or what reacts
const HOW_PART = /\b(left|right|both|hand|hands|arm|arms|head|eye|eyes|eyelid|lid|lids|tongue|foot|feet|leg|legs|knee|knees|finger|fingers|shoulder|shoulders|body|chin|nose|mouth|palm|palms|fist|elbow|hip|hips|torso|wrist|back|face|neck|toward|towards|away|forward|backward|up|down|across|into|onto|off|behind|over)\b|\d+(\.\d+)?\s?(m|cm|metres?|meters?|steps?)\b/i;
const HOW_SPEED = /\b(slow|slowly|quick|quickly|fast|sudden|suddenly|gently|hard|softly|sharply|smoothly|steadily|briskly|lazily|jerkily|instantly|gradually|wildly|rapidly)\b|\bin \d|\d+(\.\d+)?\s?s\b/i;
const HOW_REACT = /(drip|shak|sway|flap|\bfl(y|ies|ew|ying)\b|\bfall|wobbl|rattl|bounc|swing|rippl|slid|spin|tumbl|scatter|flutter|glow|squeak|smear|slump|jolt|shiver|trembl|creak|bang|thud|jerk|puff|billow|stream|splatter|crack|ring|echo|sag|droop|rock|smudg|streak|vanish|disappear|clatter|tilt|lurch|ripple|whip|snap|pop)/i;
const HOW_MANNER = /\b\w{3,}ly\b|\b(tight|hard|soft|rigid|wide|deep|deeper|still|once|twice|again)\b/i; // a manner: an adverb ("slowly", "carefully") or a firm adjective
/** a beat passes with 2 of the 3: WHERE (hand / body part / direction / distance), HOW (speed / manner), WHAT REACTS;
 *  a THING's own beat (the curtains, the wind, the lights) passes with its manner or its reaction */
export function howMisses(prompts, cast = null) {
  const out = [];
  for (const p of prompts ?? []) for (const a of p.video ?? []) {
    const d = String(a.do ?? ""), who = String(a.who ?? "");
    const part = HOW_PART.test(d), how = HOW_SPEED.test(d) || HOW_MANNER.test(d), react = HOW_REACT.test(d);
    const thing = cast ? !(who in cast) && who !== "monster" : false;
    if ((part + how + react) >= 2 || (thing && (how || react))) continue;
    out.push(`shot ${p.id}: "${d.slice(0, 80)}" (has ${[part && "where", how && "speed/manner", react && "reaction"].filter(Boolean).join(" + ") || "nothing"}; wants 2 of where / speed / reaction)`);
  }
  return out;
}
const STEM = { sleeps: "sleep|slept|asleep|awake|stare", bulging: "bulg|puff|spill", flew: "fl(y|ies|ew|ying)|kite", slept: "sleep|slept|asleep", said: "say|says|said|talk|speak", says: "say|says|said|talk|speak", caught: "catch|caught|spot|step", lost: "poke|lost|hid", finds: "find|hunt|search|look|stare|scan", filled: "fill|press", look: "look|peek", went: "dark|off|go", staring: "star", peeked: "peek|finger", looked: "look|tilt|gaze|stare", backed: "back|retreat|step" };
function verbRe(v) {
  const w = v.verb.toLowerCase().split(/\s+/)[0];
  if (STEM[w]) return new RegExp(STEM[w], "i");
  const stem = w.replace(/(ped|ed|es|s)$/, "").replace(/(.)\1$/, "$1");
  return new RegExp(stem.slice(0, Math.max(3, stem.length)), "i");
}
export function checkPrompts(prompts, tl, board) {
  const byId = new Map((Array.isArray(prompts) ? prompts : []).map((p) => [p.id, p]));
  const out = { missing: [], verbs: [], rule: [], chain: [], keys: [], how: howMisses([...byId.values()].filter((p) => p.id < tl.shots.length), tl.cast ?? {}) };
  tl.shots.forEach((s, i) => { if (!byId.has(i)) out.missing.push(`shot ${i}: no prompt`); });
  // verbs: per line, each action verb as a timed action in one of its shots
  for (const [n, l] of (tl.lines ?? []).entries()) {
    const acts = tl.shots.map((s, i) => [s, i]).filter(([s]) => s.line === n).flatMap(([, i]) => (byId.get(i)?.video ?? []).map((a) => `${a.do ?? ""}`)).join(" | ");
    for (const v of verbsOf(l.text)) if (!verbRe(v).test(acts)) out.verbs.push(`line ${n}: "${v.verb}" is not a timed action (${acts.slice(0, 160) || "no actions"})`);
  }
  // the rule: after dark, nobody outside but the exceptions
  for (const c of board.bible.rule?.constraints ?? []) tl.shots.forEach((s, i) => {
    if (!c.when.includes(s.light)) return;
    const p = byId.get(i); if (!p) return;
    const bad = (p.outside ?? []).filter((id) => !(c.except ?? []).some((e) => e.who === id && s.line >= (e.fromLine ?? 0)) && id !== "monster");
    if (bad.length) out.rule.push(`shot ${i} (line ${s.line}): ${bad.join(", ")} outside after dark`);
    if (p.end?.street === "people" || p.start?.street === "people") out.rule.push(`shot ${i} (line ${s.line}): the street has people after dark`);
  });
  // the state keys + the chain inside a scene
  tl.shots.forEach((s, i) => { const p = byId.get(i); if (!p) return; for (const k of STATE_KEYS) for (const w of ["start", "end"]) if (p[w]?.[k] == null) out.keys.push(`shot ${i}: ${w}.${k} missing`); });
  for (let i = 1; i < tl.shots.length; i++) {
    if (tl.shots[i].scene !== tl.shots[i - 1].scene) continue;
    const a = byId.get(i - 1)?.end, b = byId.get(i)?.start; if (!a || !b) continue;
    const diff = STATE_KEYS.filter((k) => String(a[k]) !== String(b[k]));
    if (diff.length) out.chain.push(`shot ${i - 1} -> ${i} (${tl.shots[i].scene}): ${diff.map((k) => `${k} ${a[k]} -> ${b[k]}`).join(", ")}`);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the page
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function promptsHtml({ tl, prompts, checks, cost, model }) {
  const byId = new Map((prompts ?? []).map((p) => [p.id, p]));
  const issues = (i) => [...checks.missing, ...checks.rule, ...checks.chain, ...checks.keys, ...(checks.how ?? [])].filter((m) => new RegExp(`shot ${i}\\b|-> ${i} `).test(m));
  const lineIssues = (n) => checks.verbs.filter((m) => m.startsWith(`line ${n}:`));
  const st = (o) => (o ? Object.entries(o).map(([k, v]) => `<span class="st">${esc(k)}: <b>${esc(v)}</b></span>`).join(" ") : "");
  let html = "";
  for (const sc of tl.scenes ?? []) {
    html += `<section><h2>Scene ${esc(sc.id)} <small>lines ${sc.from}-${sc.to} · ${esc(sc.location)} · ${esc(sc.time)}</small></h2>`;
    tl.shots.forEach((s, i) => {
      if (s.line < sc.from || s.line > sc.to) return;
      const p = byId.get(i) ?? {}, iss = issues(i), li = s === tl.shots.find((x) => x.line === s.line) ? lineIssues(s.line) : [];
      html += `<article class="${iss.length || li.length ? "bad" : "ok"}"><header><span class="id">Shot ${i}</span> <span class="t">${s.start.toFixed(2)}–${s.end.toFixed(2)} s</span> <span class="ln">line ${s.line}</span>${s.board ? "" : ' <span class="keep">planned engine shot</span>'}</header>
<p class="line">“${esc(s.text)}”</p>
<h3>Image prompt</h3><p>${esc(p.image)}</p>
<h3>Video prompt</h3><table>${(p.video ?? []).map((a) => `<tr><td>${esc(Number(a.t).toFixed(2))} s</td><td>${esc(a.who)}</td><td>${esc(a.do)}</td></tr>`).join("")}</table>
${(p.faces ?? []).length ? `<p class="faces">Faces: ${(p.faces ?? []).map((f) => `${esc(f.who)} → ${esc(f.face)} on “${esc(f.word)}” (${esc(f.t)} s)`).join("; ")}</p>` : ""}
<p class="cam">Camera: ${esc(p.camera)} · Effects: ${esc(p.effects)}</p>
<p class="state">Start: ${st(p.start)}</p><p class="state">End: ${st(p.end)}</p>
<p class="checks">${iss.length || li.length ? [...iss, ...li].map((m) => `<span class="miss">✗ ${esc(m)}</span>`).join("<br>") : '<span class="pass">✓ verbs, rule, state chain, HOW</span>'}</p></article>`;
    });
    html += "</section>";
  }
  const n = (k) => checks[k].length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shot Prompts #2</title>
<style>:root{--bg:#f6f4ef;--card:#fff;--ink:#1d1f24;--mut:#666;--ok:#2e7d32;--bad:#c62828;--line:#e3ded3}
@media (prefers-color-scheme:dark){:root{--bg:#16171a;--card:#202227;--ink:#ececec;--mut:#9aa;--line:#33363d}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:16px}
h1{font-size:22px}h2{font-size:18px;margin:28px 0 8px}h2 small{color:var(--mut);font-weight:400}h3{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin:10px 0 2px}
article{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--ok);border-radius:8px;padding:12px 14px;margin:10px 0}article.bad{border-left-color:var(--bad)}
header{font-size:13px;color:var(--mut)}.id{font-weight:700;color:var(--ink)}.keep{background:#e8e3d6;color:#555;border-radius:4px;padding:0 6px}
.line{font-size:17px;font-style:italic;margin:6px 0}table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--line);padding:3px 6px;vertical-align:top}td:first-child{white-space:nowrap;color:var(--mut);width:60px}td:nth-child(2){width:90px;font-weight:600}
.st{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:4px;padding:0 5px;margin:2px}.miss{color:var(--bad)}.pass{color:var(--ok)}.cam,.faces{font-size:13px}</style></head>
<body><main><h1>“${esc(tl.title)}” — shot prompts</h1>
<p>${tl.shots.length} shots in ${(tl.scenes ?? []).length} scenes. Written by ${esc(model)} for $${Number(cost).toFixed(4)}. Free checks: verbs ${n("verbs")} miss(es), rule ${n("rule")}, state chain ${n("chain")}, HOW ${n("how")}, state keys ${n("keys")}, missing shots ${n("missing")}.</p>
${html}</main></body></html>`;
}
