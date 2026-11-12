// STORYBOARD-ONLY TEST RUN (2026-11-12): a library idea -> the script (the production path for a library idea:
// llm.js writeScript, board mode) -> the scene list (Sonnet) -> the automatic storyboard EXACTLY as the worker runs it
// (early kit check, board-only, the repair + rewording loop, every final check before the voice), LOCALLY: no voice, no
// render, no RunPod. The early plan uses the free MOCK story director (the worker's Sonnet direction is ~$0.09 a run).
// Writes results.json, scenes.json, storyboard.json, run.json (time + money per step) for the free replay.
//   node dev/simple/storyboardOnly.mjs --idea <library id prefix> --out <dir> [--cap 0.40] --yes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { planVideo } from "../../plan.mjs";
import * as plan from "../../plan.mjs";
import { estimateWords } from "../../lib/planText.js";
import { directStory } from "../../lib/director/index.js";
import { anthropicScenes, validateScenes } from "../../lib/scenes.js";
import { directStoryboard } from "../../lib/storyboardDirector.js";
import { preVoiceProblems } from "../../lib/storyboard.js";
import { envKey } from "../../voice/eleven.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED = path.resolve(ENGINE, "../../../supabase/functions/_shared/blockyWorlds");
const ROOT = path.resolve(ENGINE, "../../..");
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = path.resolve(arg("out")), CAP = Number(arg("cap", 0.4));
fs.mkdirSync(out, { recursive: true });
const LIB = JSON.parse(fs.readFileSync(path.join(ROOT, "src/components/viral-tools/blocky-worlds/dev/libraryFixture.json"), "utf8"));
const row = LIB.find((r) => r.id.startsWith(arg("idea"))); if (!row) throw new Error("no such library idea");
const card = row.idea, T = {}, C = {}, t0 = Date.now();
const say = (m) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)} s] ${m}`; console.log(l); fs.appendFileSync(path.join(out, "run.log"), l + "\n"); };
const save = (extra = {}) => fs.writeFileSync(path.join(out, "run.json"), JSON.stringify({ idea: { id: row.id, title: card.title }, seconds: T, usd: C, total: +Object.values(C).reduce((a, b) => a + b, 0).toFixed(4), ...extra }, null, 1));
const step = async (name, fn) => { const s = Date.now(); try { return await fn(); } finally { T[name] = +((Date.now() - s) / 1000).toFixed(1); save(); } };
say(`idea "${card.title}" (${card.mood}, ${card.setting}); cap $${CAP}`);
if (!argv.includes("--yes")) process.exit(0);
const apiKey = envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY");
const LLM = await import(pathToFileURL(path.join(SHARED, "llm.js")).href);
const { formulaProblems } = await import(pathToFileURL(path.join(SHARED, "formula.js")).href);
const { kitCheck } = await import(pathToFileURL(path.join(SHARED, "kitCheck.js")).href);

// 1. the script (the money meter stops a call whose worst case would pass what is left)
// --reuse: the script of an earlier attempt in this folder (its cost stays booked; no second paid write)
const prevRun = argv.includes("--reuse") && fs.existsSync(path.join(out, "results.json")) ? JSON.parse(fs.readFileSync(path.join(out, "run.json"), "utf8")) : null;
let script;
if (prevRun) { script = JSON.parse(fs.readFileSync(path.join(out, "results.json"), "utf8")).results[0].script; C.script = prevRun.usd.script; T.script = prevRun.seconds.script; }
else { const meter = LLM.moneyMeter(Math.min(0.12, CAP)); const w = await step("script", () => LLM.writeScript({ apiKey, idea: card, lengthSec: 90, meter, maxTokens: 8000, board: true })); C.script = +meter.spent.toFixed(5); script = w.script; }
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ results: [{ script, card }] }, null, 1));
const formula = formulaProblems(script, 90), kc = kitCheck(script, { card, boardOnly: true });
say(`script "${script.title}": ${script.lines.length} lines, ${script.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0)} words ($${C.script}); formula ${formula.length} problem(s); kitCheck(board-only) ${kc.ok ? "ok" : kc.missing.map((m) => m.word).join(", ")}`);
for (const f of formula) say(`  formula: ${f.slice(0, 200)}`);
save({ formula, kitCheck: { ok: kc.ok, missing: kc.missing.map((m) => m.word), warnings: kc.warnings.map((m) => m.word) } });
if (!kc.ok) { say("STOP: the early kit check fails (the worker stops here too, before anything else is paid)"); process.exit(1); }

// 2. the scene list (autoRun's call)
const direction = await directStory({ script, idea: card, provider: "mock" });
const scenes = await step("scenes", async () => {
  const tl = planVideo({ script, words: estimateWords(script), idea: card, direction });
  const cast = Object.keys(tl.world?.cast ?? tl.cast ?? {}).filter((c) => !/^town\d|^extra/.test(c));
  const places = [...new Set((tl.world?.spots ?? []).map((s) => s.place ?? s.id).filter(Boolean))].slice(0, 12);
  const r = await anthropicScenes({ apiKey }).direct({ script, cast, places: places.length ? places : ["main_street", "home", "school", "woods"], premise: card.premise ?? "" });
  C.scenes = +Number(r.costUsd).toFixed(5);
  return validateScenes(r.data, { lines: script.lines, cast, places }).scenes;
});
fs.writeFileSync(path.join(out, "scenes.json"), JSON.stringify(scenes));
say(`scenes: ${scenes.length} ($${C.scenes})`);

// 3. the storyboard, as the worker runs it (runpod/worker.mjs boarding)
const left = +(CAP - C.script - C.scenes).toFixed(3);
const planArgs = { idea: card, direction, criticalMode: "report", scenes };
const early = planVideo({ ...planArgs, script, words: estimateWords(script) });
let r, err = null;
await step("storyboard", async () => {
  try {
    r = await directStoryboard({ apiKey, script, cast: early.cast ?? {}, scenes: early.scenes?.length ? early.scenes : scenes, title: script.title ?? "", capUsd: Math.min(0.25, left), maxFallback: 0, log: say,
      kitCheckFn: (ls) => kitCheck(ls, { boardOnly: true }),
      engineCheckFn: (board, L) => preVoiceProblems({ plan, script, lines: L, board, planArgs }),
      onLinesFinal: () => {} });
  } catch (e) { err = e; }
});
C.storyboard = +Number((r ?? err)?.costUsd ?? 0).toFixed(5);
const rec = r ? { board: r.board, problems: r.problems, rewrites: r.rewrites, lines: r.lines, fellBack: r.fellBack } : { board: err?.board ?? null, problems: err?.problems ?? [], rewrites: err?.rewrites ?? [], fellBack: err?.fellBack ?? [], error: String(err?.message ?? err).slice(0, 600) };
fs.writeFileSync(path.join(out, "storyboard.json"), JSON.stringify(rec));
save({ formula, error: rec.error ?? null, rewrites: rec.rewrites.length, fellBack: rec.fellBack.length });
say(`storyboard: ${err ? `FAILED ${err.code ?? ""} ${String(err.message).slice(0, 300)}` : `${r.board.lines.length} lines, ${r.rewrites.length} reworded`} ($${C.storyboard}); total $${Object.values(C).reduce((a, b) => a + b, 0).toFixed(4)}`);
process.exit(err ? 1 : 0);
