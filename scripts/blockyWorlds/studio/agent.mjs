// STUDIO MODE: the directing agent (Sonnet 5.5, the repo's fetch-to-/v1/messages pattern like llm.js). The orchestrator
// owns the loop, the keys and the money; the model gets ONLY these tools:
//   set_bible       the world bible (homes, window states, rooms, the rule)
//   define_assets   block-built things (validated code, studio/validate.mjs)
//   write_shots     the cuts (validated + run against a stub on the laptop: studio/shotCheck.mjs; then every engine check)
//   render_preview  contact sheets rendered on RunPod (studio/render.mjs); the images come back in the tool result
//   finish          ends the directing (refused while a gate check fails)
// No shell, no files, no network, no secrets. Cost = tokens x price after every call (llm.js costOf); the agent cap is
// checked BEFORE every call with its worst case and AFTER it; time and money go to steps.jsonl.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SYSTEM, videoBrief } from "./prompt.mjs";
import { validateShotCode } from "./validate.mjs";
import { checkShots } from "./shotCheck.mjs";
import { assemble, allChecks, lineWordsOf, CAM_TYPES } from "./assemble.mjs";
import { makeStudioBundle } from "./bundle.mjs";
import { renderSheets } from "./render.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(HERE, "../../../supabase/functions/_shared/blockyWorlds");
const { costOf } = await import(pathToFileURL(path.join(SHARED, "llm.js")).href);
const { verbsOf } = await import(pathToFileURL(path.resolve(HERE, "../engine/lib/boardActions.js")).href);
const { checkVisuals } = await import(pathToFileURL(path.resolve(HERE, "../engine/plan.mjs")).href);
export const MODEL = "claude-sonnet-5-5"; // config.js MODELS (judge / library) and llm.js PRICE use this id
const MAX_TOKENS = 32000;
// how the checks read a cut (sent with every visuals / subjects problem)
const HINT = `HOW THE CHECKS READ A CUT: a "must show" label is matched LITERALLY against the cut's declarations: put the exact label word in "shows" when that thing is visible (e.g. the curb is checked as "floor": add "floor"; a pocket as "body"); a person = in "people" or drawn with api.person; a pose / face label (sit, eat, scared) = that pose / face on a person; a time word (morning, day) = the cut's light (morning -> day or warm; night -> night); a PET counts only in a cut whose camType is "wide" or "low" and that lists the pet id in "pets" (draw it big enough to read). Never declare what the frame does not show.`;

const TOOLS = [
  { name: "set_bible", description: "Set the world bible (homes, window states, events, rooms, rule, notes). Call once before the cuts; calling again replaces it.", input_schema: { type: "object", properties: { homes: { type: "object" }, houses: { type: "object" }, events: { type: "array", items: { type: "object" } }, rooms: { type: "object" }, rule: { type: "object" }, notes: { type: "string" } }, required: ["homes"] } },
  { name: "define_assets", description: "Define or replace block-built assets (name -> code body). Drawn in shots with api.asset(name, params).", input_schema: { type: "object", properties: { assets: { type: "array", items: { type: "object", properties: { name: { type: "string" }, code: { type: "string" }, about: { type: "string" } }, required: ["name", "code"] } } }, required: ["assets"] } },
  { name: "write_shots", description: "Add or replace cuts (by id). Returns every problem found: invalid code, still camera, timing, and the engine checks per line.", input_schema: { type: "object", properties: { shots: { type: "array", items: { type: "object" } }, remove: { type: "array", items: { type: "string" }, description: "ids of cuts to delete" } }, required: ["shots"] } },
  { name: "render_preview", description: "Render contact sheets of cuts on the real engine and return them as images. ids: the cuts to show (omit = all). frames: 'mid' (one frame at ~40% of each cut) or 'start_end'.", input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } }, frames: { type: "string", enum: ["mid", "start_end"] } } } },
  { name: "finish", description: "Finish directing; the final render starts. Refused while a gate check fails.", input_schema: { type: "object", properties: { notes: { type: "string" } }, required: ["notes"] } },
];

/** what the cuts' CODE draws (people + their pose / face / hold, the engine monster, the pets), from the free stub run:
 *  set on each shot before assemble (studio.json keeps only what the agent wrote). -> the per-shot check results */
export function derive(plan, tl0) {
  for (const s of plan.shots) s.codeAnimals = (s.pets ?? []).map((id) => ({ species: tl0.pets?.[id]?.species ?? "dog", pet: id }));
  const pre = assemble(tl0, plan);
  const shotRes = checkShots({ shots: plan.shots, assets: plan.assets, homes: plan.bible.homes, cast: tl0.cast ?? {}, timing: pre.timing });
  for (const s of plan.shots) { const r = shotRes[s.id]; s.codePeople = r?.people ?? []; s.codeInfo = r?.info ?? {}; s.codeMonster = !!r?.monster; }
  return shotRes;
}

/** what each line must show (the visuals check on an empty timeline), its verbs, its subjects */
export function lineNeeds(tl0, script) {
  const empty = { ...tl0, shots: [] };
  const miss = checkVisuals(empty, script);
  const mustShow = {}; for (const m of miss) mustShow[m.line] = m.missing;
  const verbs = {}; tl0.lines.forEach((l, n) => { const v = verbsOf(String(l.text).replace(/"[^"]*"/g, "")); if (v.length) verbs[n] = v.map((x) => `"${x.verb}" -> act ${x.keys.join(" | ")}`); });
  const subjects = {}; for (const s of tl0.shots) if (s.subject && !/^(someone|group)$/.test(s.subject)) (subjects[s.line] ??= new Set()).add(s.subject);
  return { mustShow, verbs, subjects: Object.fromEntries(Object.entries(subjects).map(([k, v]) => [k, [...v]])) };
}

export async function directVideo({ tl0, script, out, L, apiKey, agentCapUsd = 3, minutes = 22, maxPreviews = 4, log = console.log }) {
  const words = lineWordsOf(tl0);
  const needs = lineNeeds(tl0, script);
  const planFile = path.join(out, "studio.json");
  const plan = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, "utf8")) : { bible: null, assets: {}, shots: [] };
  const save = () => fs.writeFileSync(planFile, JSON.stringify(plan, null, 1));
  const t0 = Date.now(), deadline = t0 + minutes * 60_000;
  // preview bookkeeping survives a resume (previewed.json): which code each cut had when it was last previewed
  const pvFile = path.join(out, "previewed.json");
  const pv = fs.existsSync(pvFile) ? JSON.parse(fs.readFileSync(pvFile, "utf8")) : { previews: 0, code: {} };
  let previews = pv.previews, finished = null, lastEval = null;
  const left = () => `budget left: $${(agentCapUsd - L.agentTotal()).toFixed(2)} of $${agentCapUsd}; time left: ${Math.max(0, Math.round((deadline - Date.now()) / 60000))} min; previews left: ${maxPreviews - previews}`;

  // ---------------------------------------------------------------- the evaluation (free)
  function evaluate() {
    if (!plan.bible?.homes) return { text: "no bible yet: call set_bible first", gate: 1 };
    const shotRes = derive(plan, tl0);
    const { tl, timing, problems } = assemble(tl0, plan);
    const ac = allChecks(tl, script, plan);
    const idOf = (i) => tl.shots[i]?.studio ?? `#${i}`;
    const lines = [];
    const bad = Object.entries(shotRes).filter(([, r]) => !r.ok);
    if (bad.length) lines.push(`CUT CODE PROBLEMS (${bad.length}):`, ...bad.slice(0, 40).map(([id, r]) => `- ${id}: ${r.errors.join("; ")}`));
    if (problems.length) lines.push(`TIMING / COVERAGE (${problems.length}):`, ...problems.slice(0, 30).map((p) => `- ${p}`));
    const c = ac.checks;
    const fix = (p) => String(p).replace(/\bshot (\d+)/g, (m, i) => `cut ${idOf(Number(i))}`);
    if (c.visuals.length) lines.push(`VISUALS (a named thing not on screen in its line; declare + show it): ${c.visuals.length}`, ...c.visuals.slice(0, 30).map((v) => `- line ${v.line}: missing ${v.missing.join(", ")}`));
    if (c.subjects.length) lines.push(`SUBJECTS: ${c.subjects.length}`, ...c.subjects.slice(0, 20).map((s) => `- cut ${idOf(s.shot)} (line ${s.line}): ${s.problem}`));
    if (c.actions.length) lines.push(`ACTIONS (declare the act on a cut of the line and animate it): ${c.actions.length}`, ...c.actions.slice(0, 20).map((p) => `- ${fix(p)}`));
    if (c.timeline.length) lines.push(`TIMELINE: ${c.timeline.length}`, ...c.timeline.slice(0, 20).map((p) => `- ${fix(p)}`));
    if (c.rule.length) lines.push(`RULE: ${c.rule.length}`, ...c.rule.slice(0, 10).map((p) => `- ${fix(p)}`));
    const gate = ac.gate + bad.length + problems.length;
    if (c.visuals.length || c.subjects.length) lines.push(HINT);
    lines.push(`cuts: ${tl.shots.length}, ${ac.cuts.cutsPerMin} a minute, ${ac.cuts.first15} in the first 15 s, first cut ${ac.cuts.firstCut} s (target 50-60 a minute, 14-18 in 15 s)`);
    lines.push(gate ? `GATE: ${gate} problem(s) left` : "GATE: clean (all checks pass)");
    lastEval = { tl, timing, shotRes, checks: c, gate, cuts: ac.cuts };
    fs.writeFileSync(path.join(out, "studio-timeline.json"), JSON.stringify(tl));
    fs.writeFileSync(path.join(out, "studio-checks.json"), JSON.stringify({ gate, cuts: ac.cuts, checks: c, shots: shotRes, problems }, null, 1));
    return { text: lines.join("\n"), gate };
  }

  // ---------------------------------------------------------------- the tools
  async function run(name, input) {
    if (name === "set_bible") {
      const homes = input.homes ?? {}, idx = Object.values(homes).map(Number).sort((a, b) => a - b);
      const errs = [];
      if (!idx.every((v, i) => v === i)) errs.push("homes must be numbered 0..n-1 with no gaps");
      for (const id of Object.keys(homes)) if (!tl0.cast?.[id]) errs.push(`home owner "${id}" is not in the cast`);
      if (errs.length) return { text: `bible refused: ${errs.join("; ")}` };
      plan.bible = { homes, houses: input.houses ?? { "*": { cover: "curtained" } }, events: input.events ?? [], rooms: input.rooms ?? {}, rule: input.rule ?? { text: "", constraints: [] }, notes: input.notes ?? "" };
      if (!Array.isArray(plan.bible.rule.constraints)) plan.bible.rule.constraints = [];
      save();
      return { text: `bible set (${Object.keys(homes).length} homes). ${left()}` };
    }
    if (name === "define_assets") {
      const res = [];
      for (const a of input.assets ?? []) {
        const v = validateShotCode(a.code);
        if (!/^[a-z][a-z0-9_]{1,30}$/.test(a.name ?? "")) { res.push(`${a.name}: bad name (lowercase letters, digits, _)`); continue; }
        if (v.ok) { plan.assets[a.name] = a.code; res.push(`${a.name}: ok`); } else res.push(`${a.name}: REFUSED ${v.errors.join("; ")}`);
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
        const i = plan.shots.findIndex((x) => x.id === s.id);
        if (i >= 0) plan.shots[i] = s; else plan.shots.push(s);
      }
      save();
      const e = evaluate();
      return { text: `${n} cut(s) written; ${plan.shots.length} in the video.\n${e.text}\n${left()}` };
    }
    if (name === "render_preview") {
      if (previews >= maxPreviews) return { text: `no previews left (${maxPreviews} used). Fix by reasoning, then finish. ${left()}` };
      const e = evaluate();
      if (!lastEval) return { text: e.text };
      const okIds = new Set(Object.entries(lastEval.shotRes).filter(([, r]) => r.ok).map(([id]) => id));
      const want = (input.ids?.length ? input.ids : lastEval.tl.shots.map((s) => s.studio)).filter((id) => okIds.has(id));
      const shots = lastEval.tl.shots.filter((s) => want.includes(s.studio));
      if (!shots.length) return { text: "nothing to preview (no valid cuts among those ids)" };
      const frames = shots.flatMap((s) => (input.frames === "start_end" ? [[0.02, "start"], [Math.max(0.03, s.end - s.start - 0.05), "end"]] : [[(s.end - s.start) * 0.4, ""]]).map(([dt, tag]) => ({ t: +(s.start + dt).toFixed(3), label: `${s.studio} L${s.line} ${s.camera}${tag ? ` ${tag}` : ""}`, sub: s.text })));
      const sheets = []; for (let i = 0; i < frames.length; i += 20) sheets.push({ name: `sheet${previews}_${i / 20}`, frames: frames.slice(i, i + 20), cols: 5 });
      const code = await makeStudioBundle({ timeline: lastEval.tl, shots: Object.fromEntries(plan.shots.filter((s) => okIds.has(s.id)).map((s) => [s.id, s.code])), assets: plan.assets, homes: plan.bible.homes });
      previews++; pv.previews = previews;
      const r = await renderSheets({ code, sheets, out: path.join(out, `preview${previews}`), L, label: `preview:${previews}` });
      fs.writeFileSync(pvFile, JSON.stringify(pv));
      if (!r.ok) return { text: `the preview render failed: ${r.error}. ${left()}` };
      for (const s of plan.shots) if (want.includes(s.id)) pv.code[s.id] = s.code;
      fs.writeFileSync(pvFile, JSON.stringify(pv));
      const content = [{ type: "text", text: `${sheets.length} sheet(s), ${frames.length} frames (label: cut id, line, camType; then the cut's words).${r.pageErrors.length ? ` PAGE ERRORS (the code threw while rendering): ${r.pageErrors.slice(0, 15).join(" | ")}` : ""}\n${e.text}\n${left()}` }];
      for (const f of r.files) if (f?.file) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f.file).toString("base64") } });
      return { content };
    }
    if (name === "finish") {
      const e = evaluate();
      // refused while a gate check fails or a cut was never previewed with its current code, unless time, money or the
      // previews are used up (then the driver's own gate decides: a failing gate never renders)
      const unseen = plan.shots.filter((s) => pv.code[s.id] !== s.code).map((s) => s.id);
      const outOf = Date.now() > deadline || agentCapUsd - L.agentTotal() < 0.35 || previews >= maxPreviews;
      if ((e.gate || unseen.length) && !outOf) {
        const why = [e.gate ? `${e.gate} gate problem(s) left` : null, unseen.length ? `${unseen.length} cut(s) never previewed with their current code: ${unseen.join(", ")} (render_preview them and LOOK at every tile)` : null].filter(Boolean).join("; ");
        return { text: `finish refused: ${why}.\n${e.text}\n${left()}` };
      }
      finished = { notes: input.notes ?? "", gate: e.gate };
      return { text: "finished" };
    }
    return { text: `unknown tool ${name}` };
  }

  // ---------------------------------------------------------------- the loop
  const brief = videoBrief({ script, tl: { ...tl0, __words: words }, ...needs, budgetUsd: agentCapUsd, minutes });
  fs.writeFileSync(path.join(out, "agent-brief.txt"), brief);
  const messages = fs.existsSync(path.join(out, "agent-messages.json")) ? JSON.parse(fs.readFileSync(path.join(out, "agent-messages.json"), "utf8")) : [{ role: "user", content: [{ type: "text", text: brief }] }];
  const estTokens = (m) => Math.ceil(JSON.stringify(m).replace(/"data":"[^"]+"/g, (x) => " ".repeat(Math.min(6000, x.length / 200))).length / 3.2) + m.flatMap((x) => (Array.isArray(x.content) ? x.content : [])).flatMap((b) => (b.type === "tool_result" && Array.isArray(b.content) ? b.content : [b])).filter((b) => b?.type === "image").length * 1700;
  // the system text this conversation started with (a resumed conversation keeps it byte for byte: cache + thinking)
  const sysFile = path.join(out, "agent-system.txt");
  const systemText = fs.existsSync(sysFile) ? fs.readFileSync(sysFile, "utf8") : SYSTEM;
  if (!fs.existsSync(sysFile)) fs.writeFileSync(sysFile, systemText);
  const sysTokens = Math.ceil(systemText.length / 3.2);
  for (let call = 1; call <= 40 && !finished; call++) {
    const worst = +((MAX_TOKENS * 10 + (estTokens(messages) + sysTokens) * 2.5) / 1e6).toFixed(4); // every output token + the whole input as a cache write
    try { L.check(`agent call ${call}`, worst, { agent: true }); }
    catch (e) { log(`agent: ${e.message}: stopping the directing cleanly`); L.log({ step: "agent_stop", reason: e.message }); break; }
    // caching: the constant system prompt + tools have their own breakpoint; the top-level automatic breakpoint moves with
    // the newest message (the history is never edited: thinking blocks stay valid, the prefix stays cached)
    const body = { model: MODEL, max_tokens: MAX_TOKENS, cache_control: { type: "ephemeral" }, system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }], tools: TOOLS, messages, thinking: { type: "adaptive" }, output_config: { effort: "medium" }, fallbacks: "default" };
    const a = Date.now();
    let res, j;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", "anthropic-beta": "server-side-fallback-2026-07-01" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15 * 60_000) });
      j = await res.json();
    } catch (e) { L.log({ step: "agent_call", call, ok: false, error: String(e.message).slice(0, 300), sec: +((Date.now() - a) / 1000).toFixed(1) }); log(`agent call ${call} failed: ${e.message}`); break; }
    const usd = costOf(j?.model ?? MODEL, j?.usage ?? {});
    L.add("agent", usd);
    const toolNames = (j?.content ?? []).filter((b) => b.type === "tool_use").map((b) => b.name);
    L.log({ step: "agent_call", call, ok: res.ok, sec: +((Date.now() - a) / 1000).toFixed(1), usd, usage: j?.usage ?? null, stop: j?.stop_reason ?? null, tools: toolNames, model: j?.model ?? null });
    log(`agent call ${call}: ${res.status} ${j?.stop_reason ?? ""} ${toolNames.join(",") || "-"} in ${((Date.now() - a) / 1000).toFixed(0)} s, $${usd} (agent total $${L.agentTotal()})`);
    if (!res.ok) { log(`agent error: ${JSON.stringify(j?.error ?? j).slice(0, 400)}`); break; }
    if (L.agentTotal() > agentCapUsd) { log(`agent: over the $${agentCapUsd} cap after call ${call}: stopping`); L.log({ step: "agent_stop", reason: "over cap after call" }); break; }
    messages.push({ role: "assistant", content: j.content });
    if (j.stop_reason === "refusal") { log("agent: refused"); break; }
    const uses = j.content.filter((b) => b.type === "tool_use");
    if (!uses.length) { messages.push({ role: "user", content: [{ type: "text", text: `Use the tools. ${left()}` }] }); continue; }
    const results = [];
    for (const u of uses) {
      const b = Date.now();
      let r; try { r = await run(u.name, u.input ?? {}); } catch (e) { r = { text: `tool error: ${String(e.message ?? e).slice(0, 500)}` }; }
      L.log({ step: `tool:${u.name}`, sec: +((Date.now() - b) / 1000).toFixed(2), ...(u.name === "write_shots" ? { n: (u.input?.shots ?? []).length } : {}) });
      results.push({ type: "tool_result", tool_use_id: u.id, content: r.content ?? [{ type: "text", text: r.text }] });
    }
    if (Date.now() > deadline && !finished) results.push({ type: "text", text: "TIME IS UP: call finish now." });
    messages.push({ role: "user", content: results });
    fs.writeFileSync(path.join(out, "agent-messages.json"), JSON.stringify(messages));
    if (Date.now() > deadline + 4 * 60_000) { log("agent: hard time limit"); break; }
  }
  const e = evaluate();
  return { plan, finished, gate: e.gate, report: e.text, previews, sec: +((Date.now() - t0) / 1000).toFixed(1) };
}
