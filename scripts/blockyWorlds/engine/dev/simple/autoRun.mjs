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
const SCRIPT_CAP = 0.12, SCENES_CAP = 0.06;
if (!argv.includes("--yes")) { say(`plan: "${topic}" ${LEN} s; caps script $${SCRIPT_CAP}, scenes $${SCENES_CAP}, the run $${(CAP - SCRIPT_CAP - SCENES_CAP).toFixed(2)}; dry run`); process.exit(0); }
const { envKey } = await import(pathToFileURL(path.join(ENGINE, "voice", "eleven.mjs")).href);
const apiKey = envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY");
const LLM = await import(pathToFileURL(path.join(SHARED, "llm.js")).href);

// 1. ideas from the topic + the script (the server's own calls, under a money meter)
const meter = LLM.moneyMeter(SCRIPT_CAP);
const results = await stage("script", async () => {
  const ideas = await LLM.writeTopicIdeas({ apiKey, topic, meter });
  const card = (ideas.cards ?? ideas.ideas ?? ideas.items ?? ideas)[0] ?? ideas;
  const w = await LLM.writeScript({ apiKey, idea: card, lengthSec: LEN, meter, maxTokens: 8000 });
  return { results: [{ script: w.script, card }], costUsd: meter.spent };
});
C.script = meter.spent;
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 1));
const script = results.results[0].script;
say(`script: "${script.title}" ${script.lines.length} lines ($${C.script}, ${T.script} s)`);

// 2. the scene list (Sonnet) on the planner's cast and places
const scenes = await stage("scenes", async () => {
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
const left = +(CAP - C.script - C.scenes - Number(arg("spent", 0))).toFixed(3); // --spent: an earlier stopped attempt's spend
const run = path.join(out, "video");
const r = await stage("video", async () => spawnSync(process.execPath, [path.join(ENGINE, "dev/simple/videoRun.mjs"), "--script", path.join(out, "results.json"), "--pick", "1", "--out", run, "--scenes", path.join(out, "scenes.json"),
  "--storyboard", "auto", "--storyboard-usd", "0.15", "--prompts-usd", "0.25", "--per-shot", "330", "--review-usd", "0.02", "--builder-usd", "0", "--prepare-sec", "300", "--chunks", "6", "--max-chunk-sec", "120", "--cap", String(left), "--yes"], { cwd: ENGINE, encoding: "utf8", maxBuffer: 1 << 26 }));
fs.writeFileSync(path.join(out, "videoRun.out"), `${r.stdout}\n${r.stderr}`);
const costs = fs.existsSync(path.join(run, "costs.json")) ? JSON.parse(fs.readFileSync(path.join(run, "costs.json"), "utf8")) : {};
Object.assign(C, costs);
fs.writeFileSync(path.join(out, "stages.json"), JSON.stringify({ seconds: T, usd: C, total: +Object.values(C).reduce((a, b) => a + (Number(b) || 0), 0).toFixed(4), wallS: +((Date.now() - t0) / 1000).toFixed(1) }, null, 1));
say(`video: exit ${r.status}; ${String(r.stdout).trim().split(/\r?\n/).slice(-2).join(" | ").slice(0, 400)}`);
say(`total $${Object.values(C).reduce((a, b) => a + (Number(b) || 0), 0).toFixed(4)}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
