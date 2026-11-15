// THE SHAKEDOWN (2026-11-12): one FULLY AUTOMATIC video from a topic, zero intervention, every stage timed and costed:
// ideas + script (the server's llm.js) -> the scene list (Sonnet, lib/scenes.js) -> videoRun with the automatic storyboard
// (the RunPod prepare: director, voice, storyboard + shot prompts in parallel, checks, still gate, mix) -> the chunks.
//   node dev/simple/autoRun.mjs --topic "..." --out <dir> --cap 1.00 [--yes]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { planScript } from "./planScript.mjs";
import { anthropicScenes, validateScenes } from "../../lib/scenes.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED = path.resolve(ENGINE, "../../../supabase/functions/_shared/blockyWorlds");
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = path.resolve(arg("out")), CAP = Number(arg("cap", 1)), topic = arg("topic"), LEN = Number(arg("length", 90));
fs.mkdirSync(out, { recursive: true });
const T = {}, C = {}, t0 = Date.now();
const say = (m) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)} s] ${m}`; console.log(l); fs.appendFileSync(path.join(out, "auto.log"), l + "\n"); };
const stage = async (name, fn) => { const s = Date.now(); try { return await fn(); } finally { T[name] = +((Date.now() - s) / 1000).toFixed(1); fs.writeFileSync(path.join(out, "stages.json"), JSON.stringify({ seconds: T, usd: C }, null, 1)); } };
// the money: script <= 0.12, scenes <= 0.06; the rest goes to videoRun (its own worst case: the director, the voice,
// the storyboard + prompts caps, the review, RunPod) and must fit in what is left
// --writer hybrid: the PRODUCTION writer for a typed topic (blocky-worlds-api writeScript: topic ideas in launch board mode,
// the user's first card, pickRecipe + examplesFor, writeHybrid board) with its formula checks (formula.js)
const HYBRID_W = arg("writer") === "hybrid";
const SCRIPT_CAP = Number(arg("script-usd", HYBRID_W ? 0.25 : 0.12)), SCENES_CAP = 0.06;
if (!argv.includes("--yes")) { say(`plan: "${topic}" ${LEN} s; caps script $${SCRIPT_CAP}, scenes $${SCENES_CAP}, the run $${(CAP - SCRIPT_CAP - SCENES_CAP).toFixed(2)}; dry run`); process.exit(0); }
const { envKey } = await import(pathToFileURL(path.join(ENGINE, "voice", "eleven.mjs")).href);
const apiKey = envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY");
const LLM = await import(pathToFileURL(path.join(SHARED, "llm.js")).href);

// 1. ideas from the topic + the script (the server's own calls, under a money meter)
const meter = LLM.moneyMeter(SCRIPT_CAP);
// --reuse: a stopped attempt's script + scene list (their time and cost stay in stages.json; no second paid call)
const prev = argv.includes("--reuse") && fs.existsSync(path.join(out, "stages.json")) ? JSON.parse(fs.readFileSync(path.join(out, "stages.json"), "utf8")) : null;
if (prev) { Object.assign(T, { script: prev.seconds.script, scenes: prev.seconds.scenes }); Object.assign(C, { script: prev.usd.script, scenes: prev.usd.scenes, earlier_attempt: +(prev.total - prev.usd.script - prev.usd.scenes).toFixed(5) }); }
const results = prev ? JSON.parse(fs.readFileSync(path.join(out, "results.json"), "utf8")) : await stage("script", async () => {
  // --card <file>: a library idea card (the customer picked it); else ideas from the topic
  const card = arg("card") ? JSON.parse(fs.readFileSync(arg("card"), "utf8")) : await (async () => { const ideas = await LLM.writeTopicIdeas({ apiKey, topic, meter, ...(HYBRID_W ? { board: true } : {}) }); return (ideas.cards ?? ideas.ideas ?? ideas.items ?? ideas)[0] ?? ideas; })();
  if (HYBRID_W) {
    const { pickRecipe, RECIPES } = await import(pathToFileURL(path.join(SHARED, "recipes.js")).href);
    const { examplesFor } = await import(pathToFileURL(path.join(SHARED, "referenceTexts.js")).href);
    const { APP_HYBRID } = await import(pathToFileURL(path.join(SHARED, "hybridApp.js")).href);
    const picked = pickRecipe({ topic, card }), recipe = { ...picked, what: RECIPES[picked.id]?.what };
    const h = await LLM.writeHybrid({ apiKey, topic, recipe, examples: examplesFor(recipe.id), lengthSec: LEN, meter, judge: APP_HYBRID.judge, idea: { ...card, topic }, board: true });
    if (!h.script?.lines?.length) throw new Error(`the writer returned no script: ${h.stopped ?? "?"}`);
    const { formulaProblems } = await import(pathToFileURL(path.join(SHARED, "formula.js")).href);
    return { results: [{ script: h.script, card: { ...card, ...(h.card ?? {}), topic } }], costUsd: meter.spent, writer: { recipe: recipe.id, calls: h.calls, hardChecks: h.checks?.hard ?? [], softChecks: h.checks?.soft ?? [], fixed: h.fixed ?? null, feedback: h.feedback ?? null, formula: formulaProblems(h.script, LEN) } };
  }
  const w = await LLM.writeScript({ apiKey, idea: card, lengthSec: LEN, meter, maxTokens: 8000 });
  return { results: [{ script: w.script, card }], costUsd: meter.spent };
});
if (!prev) C.script = meter.spent;
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 1));
const script = results.results[0].script;
say(`script: "${script.title}" ${script.lines.length} lines ($${C.script}, ${T.script} s)`);

// 2. the scene list (Sonnet) on the planner's cast and places
const scenes = prev ? JSON.parse(fs.readFileSync(path.join(out, "scenes.json"), "utf8")) : await stage("scenes", async () => {
  const { tl } = await planScript({ script, idea: results.results[0].card ?? {} });
  const cast = Object.keys(tl.world?.cast ?? tl.cast ?? {}).filter((c) => !/^town\d|^extra/.test(c));
  const places = [...new Set((tl.world?.spots ?? []).map((s) => s.place ?? s.id).filter(Boolean))].slice(0, 12);
  const r = await anthropicScenes({ apiKey }).direct({ script, cast, places: places.length ? places : ["main_street", "home", "school", "woods"], premise: results.results[0].card?.premise ?? topic });
  C.scenes = r.costUsd;
  if (C.scenes > SCENES_CAP) say(`scenes cost $${C.scenes} over its cap`);
  return validateScenes(r.data, { lines: script.lines, cast, places }).scenes;
});
fs.writeFileSync(path.join(out, "scenes.json"), JSON.stringify(scenes));
say(`scenes: ${scenes.length} ($${C.scenes}, ${T.scenes} s)`);

// 3. the video: the RunPod prepare with the automatic storyboard + the chunks (videoRun keeps its own costs.json)
const left = +(CAP - C.script - C.scenes - (C.earlier_attempt ?? 0) - Number(arg("spent", 0))).toFixed(3); // --spent: an earlier stopped attempt's spend
const run = path.join(out, `video-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`); // its own storage folder (a shared "video" folder held another run's take: BAD_JOB)
const r = await stage("video", async () => spawnSync(process.execPath, [path.join(ENGINE, "dev/simple/videoRun.mjs"), "--script", path.join(out, "results.json"), "--pick", "1", "--out", run, "--scenes", path.join(out, "scenes.json"),
  "--storyboard", "auto", "--storyboard-usd", String(arg("storyboard-usd", 0.14)), "--prompts-usd", String(arg("prompts-usd", 0.24)), ...(argv.includes("--voice-after") ? ["--voice-after"] : []), "--per-shot", "330", ...(arg("max-fallback") != null ? ["--max-fallback", arg("max-fallback")] : []), "--review-usd", String(arg("review-usd", 0.01)), "--builder-usd", "0", "--prepare-sec", "300", "--chunks", "6", "--max-chunk-sec", "110", "--cap", String(left), "--yes"], { cwd: ENGINE, encoding: "utf8", maxBuffer: 1 << 26 }));
fs.writeFileSync(path.join(out, "videoRun.out"), `${r.stdout}\n${r.stderr}`);
const costs = fs.existsSync(path.join(run, "costs.json")) ? JSON.parse(fs.readFileSync(path.join(run, "costs.json"), "utf8")) : {};
Object.assign(C, costs);
fs.writeFileSync(path.join(out, "stages.json"), JSON.stringify({ seconds: T, usd: C, total: +Object.values(C).reduce((a, b) => a + (Number(b) || 0), 0).toFixed(4), wallS: +((Date.now() - t0) / 1000).toFixed(1) }, null, 1));
say(`video: exit ${r.status}; ${String(r.stdout).trim().split(/\r?\n/).slice(-2).join(" | ").slice(0, 400)}`);
say(`total $${Object.values(C).reduce((a, b) => a + (Number(b) || 0), 0).toFixed(4)}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
