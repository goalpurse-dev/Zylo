// STUDIO MODE: the director (owner 2026-11-13: back to run 1's setup). ONE model (Sonnet 5.5 for v3; the v4 candidate
// is chosen by test C) directs the WHOLE story in one conversation, like run 1: the bible, block-built assets and every
// cut, with the free checks answering each write. When it calls finish, a ROUND runs: the cuts are rendered as contact
// sheets on RunPod, every frame gets the free pixel check (black / blank / one colour: blocking) and the ONE fixed Sonnet
// checker compares every tile with its line; the failures and the sheets go back into the same conversation for a fix,
// at most `rounds` fix rounds (v3 1, v4 up to 3). The best version so far is the one that renders. Parallel = rendering
// only. The model gets four tools and nothing else (no shell, files, network or keys).
// Money: every call is priced worst-case before it is sent (the cached prefix at the read price, the new part at the
// write price, every output token) and booked after (llm.js costOf); every answer is saved the moment it arrives.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SYSTEM, videoBrief, creatureLines } from "./prompt.mjs";
import { validateShotCode } from "./validate.mjs";
import { checkShots } from "./shotCheck.mjs";
import { assemble, allChecks, lineWordsOf, CAM_TYPES } from "./assemble.mjs";
import { makeStudioBundle } from "./bundle.mjs";
import { renderSheets } from "./render.mjs";
import { tileProblems, cutFrameProblems } from "./pixel.mjs";
import { shotMix, creatureProblems, climaxStart } from "./shotMix.mjs";
import { checkSheets } from "./checker.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(HERE, "../../../supabase/functions/_shared/blockyWorlds");
const { costOf, PRICE } = await import(pathToFileURL(path.join(SHARED, "llm.js")).href);
const { verbsOf } = await import(pathToFileURL(path.resolve(HERE, "../engine/lib/boardActions.js")).href);
const { checkVisuals } = await import(pathToFileURL(path.resolve(HERE, "../engine/plan.mjs")).href);
export const MODELS = Object.freeze({ sonnet: "claude-sonnet-5-5", opus: "claude-opus-5-5" }); // config.js / llm.js PRICE ids
const FALLBACK = new Set(["claude-sonnet-5-5", "claude-opus-5-5"]);
const MAX_TOKENS = 20000; // run 1's biggest director calls used ~12k (thinking included)

// how the checks read a cut (sent with every visuals / subjects problem)
const HINT = `HOW THE CHECKS READ A CUT: a "must show" label is matched LITERALLY against the cut's declarations: put the exact label word in "shows" when that thing is visible (e.g. the curb is checked as "floor": add "floor"; a pocket as "body"); a person = in "people" or drawn with api.person; a pose / face label (sit, eat, scared) = that pose / face on a person; a time word (morning, day) = the cut's light (morning -> day or warm; night -> night); a PET counts only in a cut whose camType is "wide" or "low" and that lists the pet id in "pets" (draw it big enough to read). Never declare what the frame does not show.`;

// ONE tool list for every call (tools lead the cached prefix)
const TOOLS = [
  { name: "set_bible", description: "Set the world bible (homes, window states, events, rooms, rule, notes). Call once before the cuts; calling again replaces it.", input_schema: { type: "object", properties: { homes: { type: "object" }, houses: { type: "object" }, events: { type: "array", items: { type: "object" } }, rooms: { type: "object" }, rule: { type: "object" }, notes: { type: "string" } }, required: ["homes"] } },
  { name: "define_assets", description: "Define or replace block-built assets (name -> code body). Drawn in cuts with api.asset(name, params). creature: true for the story's creature (needs a body and a glowing face).", input_schema: { type: "object", properties: { assets: { type: "array", items: { type: "object", properties: { name: { type: "string" }, code: { type: "string" }, creature: { type: "boolean" }, about: { type: "string" } }, required: ["name", "code"] } } }, required: ["assets"] } },
  { name: "write_shots", description: "Add or replace cuts (by id). Returns every problem the free checks find: invalid code, a still camera, timing, the engine checks per line, the shot mix.", input_schema: { type: "object", properties: { shots: { type: "array", items: { type: "object" } }, remove: { type: "array", items: { type: "string" }, description: "ids of cuts to delete" } }, required: ["shots"] } },
  { name: "finish", description: "Done writing: the engine renders a contact sheet of the cuts and a checker reviews every tile. Refused while a free check fails.", input_schema: { type: "object", properties: { notes: { type: "string" } }, required: ["notes"] } },
];

/** a streamed Messages reply (server-sent events) rebuilt into the message object a non-streaming call returns:
 *  { model, content: [blocks], stop_reason, usage }; thinking blocks keep their signature (passed back unchanged) */
async function readStream(res) {
  const msg = { model: null, content: [], stop_reason: null, usage: {} };
  const dec = new TextDecoder(); let buf = "", json = {};
  const handle = (ev) => {
    if (ev.type === "message_start") { msg.model = ev.message.model; msg.usage = { ...ev.message.usage }; msg.id = ev.message.id; }
    else if (ev.type === "content_block_start") { msg.content[ev.index] = { ...ev.content_block }; if (ev.content_block.type === "tool_use") { json[ev.index] = ""; msg.content[ev.index].input = {}; } }
    else if (ev.type === "content_block_delta") {
      const b = msg.content[ev.index], d = ev.delta;
      if (d.type === "text_delta") b.text = (b.text ?? "") + d.text;
      else if (d.type === "thinking_delta") b.thinking = (b.thinking ?? "") + d.thinking;
      else if (d.type === "signature_delta") b.signature = (b.signature ?? "") + d.signature;
      else if (d.type === "input_json_delta") json[ev.index] += d.partial_json;
    } else if (ev.type === "content_block_stop") { if (json[ev.index] != null) { try { msg.content[ev.index].input = json[ev.index] ? JSON.parse(json[ev.index]) : {}; } catch { msg.content[ev.index].input = {}; msg.content[ev.index].truncated = true; } } }
    else if (ev.type === "message_delta") { if (ev.delta?.stop_reason) msg.stop_reason = ev.delta.stop_reason; if (ev.usage) Object.assign(msg.usage, ev.usage); }
    else if (ev.type === "error") throw Object.assign(new Error(`stream error: ${JSON.stringify(ev.error).slice(0, 300)}`), { usage: msg.usage });
  };
  try {
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let k;
      while ((k = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, k); buf = buf.slice(k + 2);
        const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
        if (data) handle(JSON.parse(data));
      }
    }
  } catch (e) { throw Object.assign(e, { usage: e.usage ?? msg.usage }); } // a broken stream still books what it used
  msg.content = msg.content.filter(Boolean);
  return msg;
}

/** what the cuts' CODE draws (people + pose / face / hold, the engine monster, pets), set on each shot -> check results */
export function derive(plan, tl0) {
  for (const s of plan.shots) s.codeAnimals = (s.pets ?? []).map((id) => ({ species: tl0.pets?.[id]?.species ?? "dog", pet: id }));
  const pre = assemble(tl0, plan);
  const shotRes = checkShots({ shots: plan.shots, assets: plan.assets, homes: plan.bible.homes, cast: tl0.cast ?? {}, timing: pre.timing });
  for (const s of plan.shots) { const r = shotRes[s.id]; s.codePeople = r?.people ?? []; s.codeInfo = r?.info ?? {}; s.codeMonster = !!r?.monster; s.autoPush = !!r?.motionOnly; s.animalsDrawn = !!r?.animalsDrawn; }
  return shotRes;
}
/** what each line must show (the visuals check on an empty timeline), its verbs, its subjects */
export function lineNeeds(tl0, script) {
  const miss = checkVisuals({ ...tl0, shots: [] }, script);
  const mustShow = {}; for (const m of miss) mustShow[m.line] = m.missing;
  const verbs = {}; tl0.lines.forEach((l, n) => { const v = verbsOf(String(l.text).replace(/"[^"]*"/g, "")); if (v.length) verbs[n] = v.map((x) => `"${x.verb}" -> act ${x.keys.join(" | ")}`); });
  const subjects = {}; for (const s of tl0.shots) if (s.subject && !/^(someone|group)$/.test(s.subject)) (subjects[s.line] ??= new Set()).add(s.subject);
  return { mustShow, verbs, subjects: Object.fromEntries(Object.entries(subjects).map(([k, v]) => [k, [...v]])) };
}
/** the rule's constraints in the shape lib/storyboard.js checkRule reads (a constraint without "when" crashed it) */
const cleanRule = (r) => ({ text: String(r?.text ?? ""), constraints: (Array.isArray(r?.constraints) ? r.constraints : []).filter((c) => Array.isArray(c?.when) && c.when.every((x) => typeof x === "string")).map((c) => ({ when: c.when, ...(c.outside ? { outside: c.outside } : {}), ...(c.people ? { people: c.people } : {}), except: Array.isArray(c.except) ? c.except.filter((e) => e?.who) : [], why: String(c.why ?? "") })) });

export async function directVideo({ tl0, script, out, L, apiKey, model = MODELS.sonnet, rounds = 1, minutes = 25, effort = "medium", reserve = null, briefNote = null, maxTokens: dirMax = MAX_TOKENS, log = console.log }) {
  const words = lineWordsOf(tl0), needs = lineNeeds(tl0, script);
  const P = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  const f = (n) => path.join(out, n);
  const plan = fs.existsSync(f("studio.json")) ? JSON.parse(fs.readFileSync(f("studio.json"), "utf8")) : { bible: null, assets: {}, creatures: [], shots: [] };
  plan.creatures ??= [];
  const save = () => fs.writeFileSync(f("studio.json"), JSON.stringify(plan, null, 1));
  // the round state survives a resume (director-state.json)
  const st = fs.existsSync(f("director-state.json")) ? JSON.parse(fs.readFileSync(f("director-state.json"), "utf8")) : { round: -1, previewed: {}, vision: { lines: {}, cuts: {} }, pixel: {}, sheets: [], best: null, history: [], refusals: 0 };
  const saveSt = () => fs.writeFileSync(f("director-state.json"), JSON.stringify(st));
  const ansDir = f("answers"); fs.mkdirSync(ansDir, { recursive: true });
  const t0 = Date.now(), deadline = t0 + minutes * 60_000;
  let finished = null, calls = fs.readdirSync(ansDir).length, lastIn = 0, checkerCalls = 0; // a resume keeps numbering the saved answers
  // THE RESERVE (owner 2026-11-13: the in-loop round must always run): what the rest of the pipeline still needs, kept
  // out of the director's room: the final render (worst case), every preview + checker pass to come, every fix call to
  // come (the call being made is not counted). Run-cap items: final + previews; model-cap items: checker passes + fixes.
  const R = { finalUsd: 0.1, previewUsd: 0.035, checkUsd: 0.06, fixUsd: 0.08, ...(reserve ?? {}) };
  const reserveFor = (kind) => {
    const passes = rounds - st.round; // round 0 not run yet: rounds + 1 passes to come; after round r: rounds - r
    const fixes = st.round < 0 ? rounds : Math.max(0, rounds - st.round - 1); // the fix calls after this one
    if (kind === "agent_check") return { run: R.finalUsd + Math.max(0, passes - 1) * R.previewUsd, model: Math.max(0, passes - 1) * R.checkUsd + fixes * R.fixUsd };
    return { run: R.finalUsd + passes * (R.previewUsd + R.checkUsd) + fixes * R.fixUsd, model: passes * R.checkUsd + fixes * R.fixUsd };
  };
  const writingRoom = () => { const r = reserveFor("agent"); return Math.min(L.capUsd - L.total() - r.run, L.agentCapUsd - L.agentTotal() - r.model); };
  const left = () => `budget left for your writing: $${Math.max(0, writingRoom()).toFixed(2)} (the checks, the fix round and the render are already reserved); time left: ${Math.max(0, Math.round((deadline - Date.now()) / 60000))} min; fix rounds left: ${Math.max(0, rounds - Math.max(0, st.round))}`;

  // one priced model call (the director's, or the checker's with its own model); the answer is saved at once
  async function call({ label, model: m = model, messages, system = null, tools = null, schema = null, maxTokens = MAX_TOKENS, eff = effort, kind = "agent" }) {
    const PP = PRICE[m] ?? P;
    const est = Math.ceil(((system ?? "").length + JSON.stringify(messages).replace(/"data":"[^"]+"/g, '"data":""').length) / 3.2) + JSON.stringify(messages).split('"type":"image"').length * 1700;
    const cached = kind === "agent" ? Math.min(est, lastIn) : 0; // the conversation prefix the last call cached
    const inCost = (cached * PP.cacheRead + (est - cached) * PP.cacheWrite) / 1e6;
    // the output limit fitted to what is left after the reserve (a finish / fix / check call is small)
    const rs = reserveFor(kind);
    const room = Math.min(L.capUsd - L.total() - rs.run, L.agentCapUsd - L.agentTotal() - rs.model) - inCost;
    const floor = kind === "agent" ? 4000 : 1500;
    if (maxTokens * PP.output / 1e6 > room) {
      maxTokens = Math.floor((room * 1e6) / PP.output);
      if (maxTokens < floor) throw Object.assign(new Error(`${label}: $${room.toFixed(3)} of room after the reserve (the checks, the fix round and the render come first)`), { code: "RESERVE" });
    }
    const worst = +(maxTokens * PP.output / 1e6 + inCost).toFixed(4);
    L.check(`${label} (${m})`, worst, { agent: true });
    const body = { model: m, max_tokens: maxTokens, ...(system ? { system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] } : {}), messages, ...(tools ? { tools } : {}), thinking: { type: "adaptive" }, output_config: { effort: eff, ...(schema ? { format: { type: "json_schema", schema } } : {}) }, ...(kind === "agent" ? { cache_control: { type: "ephemeral" } } : {}), ...(FALLBACK.has(m) ? { fallbacks: "default" } : {}) };
    const a = Date.now();
    let res, j;
    // STREAMED (2026-11-13: a non-streaming Opus call over 5 min died on Node's 300 s header timeout, and the automatic
    // resend repeated it): the reply arrives as server-sent events and is rebuilt into the same message object. A resend
    // happens only for a refusal to start (429 / 5xx / 529: nothing generated, nothing billed), never after a network
    // failure mid-answer (that one may be billed: the run stops instead).
    for (let tries = 0; tries < 2; tries++) {
      try { res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(FALLBACK.has(m) ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}) }, body: JSON.stringify({ ...body, stream: true }), signal: AbortSignal.timeout(20 * 60_000) }); j = res.ok ? await readStream(res) : await res.json(); }
      catch (e) { j = { error: { message: String(e.message) }, usage: e.usage ?? null, model: m }; res = { ok: false, status: 0 }; }
      if (res.ok || ![429, 500, 502, 503, 529].includes(res.status)) break;
      await new Promise((r) => setTimeout(r, 6000));
    }
    const usd = costOf(j?.model ?? m, j?.usage ?? {});
    L.add(kind, usd); calls++;
    fs.writeFileSync(path.join(ansDir, `${String(calls).padStart(3, "0")}_${label.replace(/[^a-zA-Z0-9]+/g, "_")}.json`), JSON.stringify(j));
    if (kind === "agent" && j?.usage) lastIn = (j.usage.input_tokens ?? 0) + (j.usage.cache_read_input_tokens ?? 0) + (j.usage.cache_creation_input_tokens ?? 0);
    const used = (j?.content ?? []).filter((b) => b.type === "tool_use").map((b) => b.name);
    L.log({ step: "model_call", label, model: j?.model ?? m, ok: res.ok, sec: +((Date.now() - a) / 1000).toFixed(1), usd, usage: j?.usage ?? null, stop: j?.stop_reason ?? null, tools: used, ...(res.ok ? {} : { error: JSON.stringify(j?.error ?? j).slice(0, 400) }) });
    log(`${label}: ${res.status} ${j?.stop_reason ?? ""} ${used.join(",") || ""} in ${((Date.now() - a) / 1000).toFixed(0)} s, $${usd} (model total $${L.agentTotal()})`);
    if (!res.ok) throw Object.assign(new Error(`${label}: HTTP ${res.status} ${JSON.stringify(j?.error ?? j).slice(0, 300)}`), { code: "MODEL" });
    if (j.stop_reason === "refusal") throw Object.assign(new Error(`${label}: refused`), { code: "REFUSED" });
    return j;
  }

  // ---------------------------------------------------------------- the free checks
  function evaluate() {
    if (!plan.bible?.homes) return { text: "no bible yet: call set_bible first", gate: 1, lineFails: {} };
    const shotRes = derive(plan, tl0);
    const { tl, timing, problems } = assemble(tl0, plan);
    const ac = allChecks(tl, script, plan), mix = shotMix(plan, tl, shotRes);
    const idOf = (i) => tl.shots[i]?.studio ?? `#${i}`, fix = (p) => String(p).replace(/\bshot (\d+)/g, (m, i) => `cut ${idOf(Number(i))}`);
    const lines = [], lineFails = {};
    const mark = (n, m) => { if (Number.isInteger(n)) (lineFails[n] ??= []).push(m); };
    const bad = Object.entries(shotRes).filter(([, r]) => !r.ok);
    if (bad.length) lines.push(`CUT CODE PROBLEMS (${bad.length}):`, ...bad.slice(0, 40).map(([id, r]) => `- ${id}: ${r.errors.join("; ")}`));
    if (problems.length) lines.push(`TIMING / COVERAGE (${problems.length}):`, ...problems.slice(0, 30).map((p) => `- ${p}`));
    const c = ac.checks;
    if (c.visuals.length) lines.push(`VISUALS (a named thing not on screen in its line; declare + show it): ${c.visuals.length}`, ...c.visuals.slice(0, 30).map((v) => { mark(v.line, `checks: nothing on screen for ${v.missing.join(", ")}`); return `- line ${v.line}: missing ${v.missing.join(", ")}`; }));
    if (c.subjects.length) lines.push(`SUBJECTS: ${c.subjects.length}`, ...c.subjects.slice(0, 20).map((s) => { mark(s.line, `subject: ${s.problem}`); return `- cut ${idOf(s.shot)} (line ${s.line}): ${s.problem}`; }));
    if (c.actions.length) lines.push(`ACTIONS (declare the act on a cut of the line and animate it): ${c.actions.length}`, ...c.actions.slice(0, 20).map((p) => { const m = String(p).match(/^line (\d+)/); if (m) mark(Number(m[1]), p); return `- ${fix(p)}`; }));
    if (c.timeline.length) lines.push(`TIMELINE: ${c.timeline.length}`, ...c.timeline.slice(0, 20).map((p) => `- ${fix(p)}`));
    if (c.rule.length) lines.push(`RULE: ${c.rule.length}`, ...c.rule.slice(0, 10).map((p) => `- ${fix(p)}`));
    if (mix.problems.length) lines.push(`SHOT MIX: ${mix.problems.length}`, ...mix.problems.map((p) => `- ${p.problem}`));
    if (c.visuals.length || c.subjects.length) lines.push(HINT);
    const hard = bad.filter(([, r]) => !r.motionOnly).length + problems.length + mix.problems.length; // what blocks finish
    const gate = ac.gate + bad.length + problems.length + mix.problems.length;
    lines.push(`cuts: ${tl.shots.length}, ${ac.cuts.cutsPerMin} a minute, ${ac.cuts.first15} in the first 15 s, first cut ${ac.cuts.firstCut} s (target 50-60 a minute, 14-18 in 15 s); shot mix: ${Math.round(mix.stats.doingShare * 100)}% doing something, ${mix.stats.emptyWides} empty wide(s)`);
    lines.push(gate ? `GATE: ${gate} problem(s) left` : "GATE: clean (all free checks pass)");
    fs.writeFileSync(f("studio-checks.json"), JSON.stringify({ gate, hard, cuts: ac.cuts, mix, checks: c, shots: shotRes, problems }, null, 1));
    const renderable = bad.filter(([, r]) => !r.motionOnly).length === 0 && problems.length === 0; // every line has a cut, every cut valid code
    return { text: lines.join("\n"), gate, hard, renderable, tl, shotRes, ac, mix, lineFails };
  }

  // ---------------------------------------------------------------- a round: preview + pixel + the fixed checker
  async function runRound(ev) {
    st.round++;
    const okIds = new Set(Object.entries(ev.shotRes).filter(([, r]) => r.ok || r.motionOnly).map(([id]) => id));
    const todo = ev.tl.shots.filter((s) => okIds.has(s.studio) && st.previewed[s.studio] !== JSON.stringify(plan.shots.find((p) => p.id === s.studio)));
    const sheets = [];
    if (todo.length) {
      const frames = todo.map((s) => ({ t: +(s.start + (s.end - s.start) * 0.4).toFixed(3), label: `${s.studio} L${s.line} ${s.camera}`, sub: s.text }));
      const specs = []; for (let i = 0; i < frames.length; i += 20) specs.push({ name: `round${st.round}_${i / 20}`, frames: frames.slice(i, i + 20), cols: 5 });
      const code = await makeStudioBundle({ timeline: ev.tl, shots: Object.fromEntries(plan.shots.filter((s) => okIds.has(s.id)).map((s) => [s.id, s.code])), assets: plan.assets, homes: plan.bible.homes, creatures: plan.creatures });
      const r = await renderSheets({ code, sheets: specs, out: f(`look${st.round}`), L, label: `preview:${st.round}` });
      if (!r.ok) throw Object.assign(new Error(`preview ${st.round}: ${r.error}`), { code: "PREVIEW" });
      fs.writeFileSync(path.join(f(`look${st.round}`), "tiles.json"), JSON.stringify(r.files.map((x) => x.tiles)));
      r.files.forEach((file, k) => {
        const ids = specs[k].frames.map((fr) => fr.label.split(" ")[0]);
        for (const id of ids) delete st.pixel[id];
        for (const tile of file.tiles ?? []) { const id = String(tile.label ?? "").split(" ")[0]; const cut = plan.shots.find((c) => c.id === id); const p = [...tileProblems(tile), ...cutFrameProblems(tile, cut, { climaxFrom: climaxStart(tl0) })]; if (p.length) st.pixel[id] = p; }
        sheets.push({ file: file.file, cuts: ids.map((id) => { const c = plan.shots.find((p) => p.id === id); return { id, line: c?.line, declares: [...(c?.people ?? []).map((p) => p.id), ...(c?.codePeople ?? []), ...(c?.shows ?? []), ...(c?.pets ?? []), c?.creature || c?.codeMonster ? "the creature" : null].filter(Boolean).join(", ") }; }) });
      });
      for (const e of r.pageErrors ?? []) { const id = String(e).split(":")[0]; (st.pixel[id] ??= []).push(`the code threw while rendering: ${String(e).slice(id.length + 2, 200)}`); }
      for (const s of todo) st.previewed[s.studio] = JSON.stringify(plan.shots.find((p) => p.id === s.studio));
      // the fixed checker on the new sheets (lines of the previewed cuts)
      const lineSet = [...new Set(todo.map((s) => s.line))];
      const v = await checkSheets({ sheets, lines: Object.fromEntries(lineSet.map((n) => [n, { text: tl0.lines[n].text, mustShow: needs.mustShow[n] ?? [] }])), call, label: `checker ${st.round}`, creature: tl0.monster ? { name: tl0.monster.name, lines: creatureLines(script, tl0) } : null });
      checkerCalls++;
      for (const [id, c] of Object.entries(v.cuts)) st.vision.cuts[id] = c;
      for (const n of lineSet) if (v.lines[n]) st.vision.lines[n] = v.lines[n];
      st.sheets = sheets.map((s) => s.file);
    }
    // the round's failures and score; the best version is kept
    const fails = [], failingLines = new Set();
    for (const [n, l] of Object.entries(st.vision.lines)) if (!l.ok) { fails.push(`- line ${n}: the checker can't see: ${l.missing.join(", ") || "what the line says"}`); failingLines.add(Number(n)); }
    for (const s of plan.shots) {
      const ps = [...(st.pixel[s.id] ?? []).map((p) => `BLOCKED FRAME: ${p}`), ...(st.vision.cuts[s.id] && !st.vision.cuts[s.id].ok ? [`checker: ${st.vision.cuts[s.id].problem}`] : [])];
      if (ps.length) { fails.push(`- cut ${s.id} (line ${s.line}): ${ps.join("; ")}`); failingLines.add(s.line); }
    }
    for (const n of Object.keys(ev.lineFails)) failingLines.add(Number(n));
    const blocked = Object.values(st.pixel).filter((x) => x?.length).length;
    const score = failingLines.size * 10 + blocked + ev.gate;
    st.history.push({ round: st.round, failingLines: [...failingLines].sort((a, b) => a - b), blocked, gate: ev.gate, cuts: ev.ac.cuts, mix: ev.mix.stats, score, previewed: todo.length, usd: L.agentTotal(), sec: +((Date.now() - t0) / 1000).toFixed(1) });
    if (!st.best || score < st.best.score) st.best = { round: st.round, score, failingLines: [...failingLines].sort((a, b) => a - b), blocked, gate: ev.gate, shots: JSON.parse(JSON.stringify(plan.shots)) };
    saveSt();
    log(`round ${st.round}: ${failingLines.size} failing line(s) [${[...failingLines].sort((a, b) => a - b).join(",")}], ${blocked} blocked frame(s), gate ${ev.gate}; ${todo.length} cut(s) previewed`);
    return { fails, failingLines, blocked, sheets };
  }

  // ---------------------------------------------------------------- the tools
  async function run(name, input) {
    if (name === "set_bible") {
      const homes = input.homes ?? {}, idx = Object.values(homes).map(Number).sort((a, b) => a - b), errs = [];
      if (!idx.length || !idx.every((v, i) => v === i)) errs.push("homes must be numbered 0..n-1 with no gaps (one owner per house; family members live in that owner's house)");
      for (const id of Object.keys(homes)) if (!tl0.cast?.[id]) errs.push(`home owner "${id}" is not in the cast`);
      if (errs.length) return { text: `bible refused: ${errs.join("; ")}` };
      plan.bible = { homes, houses: input.houses ?? { "*": { cover: "curtained" } }, events: input.events ?? [], rooms: input.rooms ?? {}, rule: cleanRule(input.rule), notes: input.notes ?? "" };
      save();
      return { text: `bible set (${Object.keys(homes).length} homes). ${left()}` };
    }
    if (name === "define_assets") {
      const res = [];
      for (const a of input.assets ?? []) {
        if (!/^[a-z][a-z0-9_]{1,30}$/.test(a.name ?? "")) { res.push(`${a.name}: bad name (lowercase letters, digits, _)`); continue; }
        const v = validateShotCode(a.code);
        if (!v.ok) { res.push(`${a.name}: REFUSED ${v.errors.join("; ")}`); continue; }
        if (a.creature) { const cp = creatureProblems(a.name, a.code, { homes: plan.bible?.homes ?? {}, cast: tl0.cast ?? {} }); if (cp.length) { res.push(`${a.name}: REFUSED ${cp.join("; ")}`); continue; } }
        plan.assets[a.name] = a.code; plan.creatures = plan.creatures.filter((x) => x !== a.name); if (a.creature) plan.creatures.push(a.name);
        res.push(`${a.name}: ok${a.creature ? " (creature)" : ""}`);
      }
      save();
      return { text: `${res.join("\n")}\n${left()}` };
    }
    if (name === "write_shots") {
      for (const id of input.remove ?? []) plan.shots = plan.shots.filter((s) => s.id !== id);
      const n = (input.shots ?? []).length;
      for (const s0 of input.shots ?? []) {
        if (!s0 || typeof s0.id !== "string") continue;
        const s = { ...s0, line: Number(s0.line), w: Number(s0.w ?? 0), light: s0.light ?? "day", loc: s0.loc ?? "street", camType: CAM_TYPES.includes(s0.camType) ? s0.camType : "medium" };
        const i = plan.shots.findIndex((x) => x.id === s.id); if (i >= 0) plan.shots[i] = s; else plan.shots.push(s);
      }
      save();
      return { text: `${n} cut(s) written; ${plan.shots.length} in the video.\n${evaluate().text}\n${left()}` };
    }
    if (name === "finish") {
      const ev = evaluate();
      const outOf = Date.now() > deadline; // money is handled by the reserve (the round and its fix are kept funded)
      if (ev.hard && st.refusals < 3 && !outOf) { st.refusals++; saveSt(); return { text: `finish refused (${st.refusals}/3): the free checks must pass first.\n${ev.text}\n${left()}` }; }
      st.refusals = 0;
      return roundStep(ev, outOf);
    }
    return { text: `unknown tool ${name}` };
  }
  /** a round + what the director gets back (or the end): shared by finish and the orchestrator's own round */
  async function roundStep(ev, outOf = false) {
    let r;
    try { r = await runRound(ev); } catch (e) { if (["CAP", "AGENT_CAP", "RESERVE"].includes(e.code)) { finished = { reason: `money: ${e.message}` }; return { text: "finished (money cap)" }; } throw e; }
    if (!r.fails.length && !ev.gate) { finished = { reason: "clean" }; return { text: "finished: every check passes" }; }
    if (st.round >= rounds || outOf) { finished = { reason: st.round >= rounds ? "fix-round cap" : "time / money" }; return { text: "finished (the fix-round cap): the best version renders" }; }
    const content = [{ type: "text", text: `ROUND ${st.round} (fix round ${st.round + 1} of ${rounds} follows): the render is blocked until these pass.\n${r.fails.join("\n") || "- (the checker passed every tile)"}\n${ev.gate ? `\nTHE FREE CHECKS:\n${ev.text}` : ""}\nThe contact sheet(s) of the cuts previewed this round are attached: LOOK at every tile. Fix the failing cuts with write_shots, then finish again. ${left()}` }];
    for (const file of r.sheets.map((s) => s.file)) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(file).toString("base64") } });
    return { content };
  }

  // ---------------------------------------------------------------- the loop (one conversation, like run 1)
  const sysFile = f("agent-system.txt");
  const systemText = fs.existsSync(sysFile) ? fs.readFileSync(sysFile, "utf8") : SYSTEM;
  if (!fs.existsSync(sysFile)) fs.writeFileSync(sysFile, systemText);
  const brief0 = videoBrief({ script, tl: { ...tl0, __words: words }, ...needs, budgetUsd: L.agentCapUsd, minutes });
  const brief = briefNote ? `${brief0}

NOTE FOR THIS VIDEO (it overrides the cut-count targets above):
${briefNote}` : brief0;
  fs.writeFileSync(f("agent-brief.txt"), brief);
  const messages = fs.existsSync(f("agent-messages.json")) ? JSON.parse(fs.readFileSync(f("agent-messages.json"), "utf8")) : [{ role: "user", content: [{ type: "text", text: brief }] }];
  for (let turn = 1; turn <= 40 && !finished; turn++) {
    let j;
    try { j = await call({ label: `director ${turn}`, messages, system: systemText, tools: TOOLS, maxTokens: dirMax }); }
    catch (e) {
      // the writing room is spent: when every cut is written and the free checks pass, the orchestrator runs the round
      // itself (its reserve is kept for this); the result goes into the conversation for the fix round
      const last = messages.at(-1);
      if (e.code === "RESERVE" && last?.role === "user" && plan.bible?.homes && plan.shots.length) {
        const ev = evaluate();
        if (ev.renderable) {
          log(`director: ${e.message}: the orchestrator calls finish${ev.hard ? " (the free-check problems go to the fix round)" : ""}`);
          const r = await roundStep(ev);
          if (finished) break;
          last.content.push(...(r.content ?? [{ type: "text", text: r.text }]));
          fs.writeFileSync(f("agent-messages.json"), JSON.stringify(messages));
          continue;
        }
      }
      log(`director: ${e.message}: stopping cleanly`); L.log({ step: "director_stop", reason: e.message }); break;
    }
    if (L.agentTotal() > L.agentCapUsd) { log("director: over the model cap after the call: stopping"); break; }
    messages.push({ role: "assistant", content: j.content });
    fs.writeFileSync(f("agent-messages.json"), JSON.stringify(messages));
    const uses = j.content.filter((b) => b.type === "tool_use");
    if (!uses.length) { messages.push({ role: "user", content: [{ type: "text", text: `Use the tools (call finish when the cuts are ready). ${left()}` }] }); continue; }
    const results = [];
    for (const u of uses) {
      const b = Date.now();
      let r; try { r = await run(u.name, u.input ?? {}); } catch (e) { r = { text: `tool error: ${String(e.message ?? e).slice(0, 500)}` }; }
      L.log({ step: `tool:${u.name}`, sec: +((Date.now() - b) / 1000).toFixed(2), ...(u.name === "write_shots" ? { n: (u.input?.shots ?? []).length } : {}) });
      results.push({ type: "tool_result", tool_use_id: u.id, content: r.content ?? [{ type: "text", text: r.text }] });
      if (finished) break;
    }
    if (finished) break;
    if (Date.now() > deadline) results.push({ type: "text", text: "TIME IS UP: call finish now." });
    messages.push({ role: "user", content: results });
    fs.writeFileSync(f("agent-messages.json"), JSON.stringify(messages));
  }
  // the best version renders (a round's snapshot); no round at all = the cuts as written
  if (st.best?.shots) plan.shots = st.best.shots;
  save();
  const report = { model, rounds, history: st.history, best: st.best ? { round: st.best.round, score: st.best.score, failingLines: st.best.failingLines, blocked: st.best.blocked, gate: st.best.gate } : null, finished, calls, checkerCalls, sec: +((Date.now() - t0) / 1000).toFixed(1), vision: st.vision, pixel: st.pixel };
  fs.writeFileSync(f("director-report.json"), JSON.stringify(report, null, 1));
  return { plan, report };
}
