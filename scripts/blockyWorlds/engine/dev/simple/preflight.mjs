// FREE PREFLIGHT of a test video before any paid step (2026-11-10): the stored director list (storage) + the take's real
// word timings, planned exactly as the worker's prepare does (critical items in REJECT mode with NO builder, library
// none), then the four pre-render checks. Prints the critical items and where each resolves; exits 1 when anything
// would still need the builder or a check fails (the run must not start).
//   node dev/simple/preflight.mjs --script <results.json> --pick 2 --run <storage folder name, e.g. video2> --out <dir>
import fs from "node:fs";
import path from "node:path";
import { storage, loadEnv } from "../../runpod/client.mjs";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, checkProduction } from "../../plan.mjs";
import { directStory } from "../../lib/director/index.js";
import { loadScript } from "./planScript.mjs";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = arg("out"); fs.mkdirSync(out, { recursive: true });
const { script, idea } = loadScript(arg("script"), arg("pick"));
const st = storage(loadEnv(), `blocky-worlds-test/video/${arg("run")}`);
const stored = JSON.parse(String(await st.get("direction.json")));
const take = JSON.parse(String(await st.get("take.json")));
// the take's spoken words -> the trimmed timings the voice step makes (voice/eleven.mjs keepRanges + remap)
const { keepRanges, remap } = await import("../../voice/eleven.mjs");
const ranges = keepRanges(take.spoken, take.spoken.at(-1).e + 0.3);
const words = take.spoken.map((w) => ({ word: w.w ?? w.word, start: +remap(w.s, ranges).toFixed(3), end: +remap(w.e, ranges).toFixed(3) }));
const provider = { model: stored.model ?? null, direct: async () => ({ data: stored.production, costUsd: 0, model: stored.model ?? null }) };
const direction = await directStory({ script, idea, provider });
let tl, rejected = null;
try { tl = planVideo({ script, words, idea, lengthSec: 90, direction, criticalMode: "reject", library: () => null, built: {} }); }
catch (e) { rejected = e; }
const crit = rejected?.critical ?? tl?.critical ?? null;
const items = (crit?.items ?? []).map((i) => `${i.name} [${(i.why ?? []).join("+")}] -> ${i.source ?? "UNRESOLVED (builder)"}${i.kitName ? ` (${i.kitName})` : ""}`);
console.log(`critical items:\n  ${items.join("\n  ") || "(none)"}`);
if (rejected) { console.log(`STOP: the plan is rejected without the builder: ${rejected.message.slice(0, 600)}`); process.exit(1); }
const checks = { timeline: checkTimeline(tl), visuals: checkVisuals(tl, script), subjects: checkSubjects(tl), production: checkProduction(tl) };
fs.writeFileSync(path.join(out, "preflight-timeline.json"), JSON.stringify(tl));
const needs = (tl.needs ?? []).length;
console.log(`plan: ${tl.shots.length} shots, ${tl.duration} s, wpm ${Math.round(words.length / ((words.at(-1).end - words[0].start) / 60))}; builder needs left ${needs}; checks ${Object.entries(checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
for (const [k, v] of Object.entries(checks)) for (const p of v.slice(0, 6)) console.log(`  ${k}: ${typeof p === "string" ? p : JSON.stringify(p)}`);
if (Object.values(checks).some((v) => v.length)) { console.log("STOP: a check fails"); process.exit(1); }
console.log("OK: every critical item from the kit, the four checks clean");
