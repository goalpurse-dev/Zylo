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
export async function writePrompts({ apiKey, tl, board, capUsd = 0.15, parts = 2, fetchFn = fetch }) {
  const { system, user } = promptRequest(tl, board);
  const estIn = Math.ceil((system.length + user.length) / 3.4);
  const inWorst = (estIn * 2.5 + (parts - 1) * estIn * 0.2 + parts * 60 * 2) / 1e6;
  const maxOut = Math.floor((capUsd - inWorst) / parts / (10 / 1e6));
  if (maxOut < 3000) throw new Error(`cap $${capUsd} leaves only ${maxOut} output tokens a part`);
  const n = tl.shots.length, per = Math.ceil(n / parts), data = [], usage = [], stop = [], raw = [];
  let costUsd = 0;
  for (let k = 0; k < parts; k++) {
    const a = k * per, b = Math.min(n, a + per) - 1; if (a > b) break;
    const res = await fetchFn("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: PROMPT_MODEL, max_tokens: maxOut, system: [{ type: "text", text: system }], messages: [{ role: "user", content: [{ type: "text", text: user, cache_control: { type: "ephemeral" } }, { type: "text", text: `Write the prompt pairs for shot ids ${a}-${b} only.` }] }], output_config: { effort: "low" } }),
      signal: AbortSignal.timeout(600000),
    });
    const body = await res.json().catch(() => null);
    costUsd += costOf(body?.model ?? PROMPT_MODEL, body?.usage);
    if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { costUsd });
    const text = (body.content ?? []).filter((x) => x.type === "text").map((x) => x.text).join("").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    usage.push(body.usage); stop.push(body.stop_reason); raw.push(text);
    try { data.push(...JSON.parse(text)); } catch { return { data: null, raw: raw.join("\n----\n"), costUsd, usage, stop, maxOut }; }
  }
  return { data, raw: raw.join("\n----\n"), costUsd: +costUsd.toFixed(6), usage, stop, maxOut };
}

// ------------------------------------------------------------------------------------------------ the free checks
const STEM = { sleeps: "sleep|slept|asleep|awake|stare", bulging: "bulg|puff|spill", flew: "fl(y|ies|ew|ying)|kite", slept: "sleep|slept|asleep", said: "say|says|said|talk|speak", says: "say|says|said|talk|speak", caught: "catch|caught|spot|step", lost: "poke|lost|hid", finds: "find|hunt|search|look|stare|scan", filled: "fill|press", look: "look|peek", went: "dark|off|go", staring: "star", peeked: "peek|finger", looked: "look|tilt|gaze|stare", backed: "back|retreat|step" };
function verbRe(v) {
  const w = v.verb.toLowerCase().split(/\s+/)[0];
  if (STEM[w]) return new RegExp(STEM[w], "i");
  const stem = w.replace(/(ped|ed|es|s)$/, "").replace(/(.)\1$/, "$1");
  return new RegExp(stem.slice(0, Math.max(3, stem.length)), "i");
}
export function checkPrompts(prompts, tl, board) {
  const byId = new Map((Array.isArray(prompts) ? prompts : []).map((p) => [p.id, p]));
  const out = { missing: [], verbs: [], rule: [], chain: [], keys: [] };
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
  const issues = (i) => [...checks.missing, ...checks.rule, ...checks.chain, ...checks.keys].filter((m) => new RegExp(`shot ${i}\\b|-> ${i} `).test(m));
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
<p class="checks">${iss.length || li.length ? [...iss, ...li].map((m) => `<span class="miss">✗ ${esc(m)}</span>`).join("<br>") : '<span class="pass">✓ verbs, rule, state chain</span>'}</p></article>`;
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
<p>${tl.shots.length} shots in ${(tl.scenes ?? []).length} scenes. Written by ${esc(model)} for $${Number(cost).toFixed(4)}. Free checks: verbs ${n("verbs")} miss(es), rule ${n("rule")}, state chain ${n("chain")}, state keys ${n("keys")}, missing shots ${n("missing")}.</p>
${html}</main></body></html>`;
}
