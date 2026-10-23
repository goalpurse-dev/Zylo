// Runs one Cutaway Explainer video end to end on this machine, with the SAME
// engine as the edge function (supabase/functions/_shared/cutaway/engine.js)
// and the same stitch as the Fly machine (render-worker/src/cutawayFinal.mjs).
// Nothing touches the database or charges credits; every provider call is real
// and costs real money (about $0.72 for 15 s), so it stops above --max-usd.
//
//   node scripts/cutaway/runLocal.mjs --topic "rain gutter" --length 15 --out <dir> [--approve] [--max-usd 1.2]
//
// Keys come from the environment or .env.local: ANTHROPIC_API_KEY, RUNWARE_API_KEY, ELEVENLABS_KEY.
// Without --approve it stops at the approval step (wide images saved); run again
// with --approve to continue from the saved state (state.json in --out).
// Needs ffmpeg/ffprobe on PATH (or FFMPEG / FFPROBE).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { advance, approve, newRun, visionFailures } from "../../supabase/functions/_shared/cutaway/engine.js";
import { cropPixels } from "../../supabase/functions/_shared/cutaway/beats.js";
import { checkImage, planVideo, trimScript } from "../../supabase/functions/_shared/cutaway/llm.js";
import { generateSfx } from "../../supabase/functions/_shared/cutaway/sound.js";
import { synthesize } from "../../supabase/functions/_shared/cutaway/voice.js";
import { directSender } from "../../supabase/functions/_shared/cutaway/runware.js";
import { renderCutaway } from "../../render-worker/src/cutawayFinal.mjs";

const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const flag = (name) => process.argv.includes(`--${name}`);

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(".env.local"));
if (arg("env")) loadEnv(path.resolve(arg("env")));

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
const out = path.resolve(arg("out", "cutaway-test"));
const maxUsd = Number(arg("max-usd", "1.2"));
mkdirSync(out, { recursive: true });
const statePath = path.join(out, "state.json");
const missing = ["ANTHROPIC_API_KEY", "RUNWARE_API_KEY"].filter((k) => !process.env[k]);
if (missing.length) { console.error(`missing ${missing.join(", ")}`); process.exit(2); }

async function fetchTo(url, file) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`download ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// Sound effects: library sounds are kept in render-worker/assets/sfx (committed, the same file every
// video); topic-specific cues go to a local cache folder. Either way a repeat costs nothing.
const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../render-worker/assets/sfx");
const SFX_CACHE = path.resolve(arg("sfx-cache", path.join(out, "..", "sfx-cache")));
mkdirSync(SFX_CACHE, { recursive: true });
// The used-ideas log for local runs: topics + mechanisms of earlier local runs.
const IDEAS = path.resolve(arg("ideas", path.join(out, "..", "used-ideas.json")));
const ideas = existsSync(IDEAS) ? JSON.parse(readFileSync(IDEAS, "utf8")) : { topics: [], mechanisms: [] };

let renderResult = null;
const deps = {
  // Every planner / critic output is saved next to the state, so a failed plan can be read.
  planVideo: ({ topic, lengthSec, usedIdeas }) => planVideo({
    apiKey: process.env.ANTHROPIC_API_KEY, topic, lengthSec, usedIdeas,
    onTrace: (t) => { if (t.output) writeFileSync(path.join(out, `plan-${Date.now()}-${t.stage.replace(/[^a-z0-9]+/gi, "")}.json`), JSON.stringify(t, null, 2)); },
  }),
  trimScript: ({ plan, maxWords, lengthSec, usedIdeas }) => trimScript({ apiKey: process.env.ANTHROPIC_API_KEY, plan, maxWords, lengthSec, usedIdeas }),
  checkImage: ({ imageUrl, description, checks, plan }) => checkImage({ apiKey: process.env.ANTHROPIC_API_KEY, imageUrl, description, checks, plan }),
  synthesize: process.env.ELEVENLABS_KEY ? ({ text }) => synthesize({ apiKey: process.env.ELEVENLABS_KEY, text }) : null,
  sfx: process.env.ELEVENLABS_KEY ? async ({ cacheKey, text, seconds }) => {
    const lib = cacheKey.startsWith("lib-");
    const file = path.join(lib ? ASSETS : SFX_CACHE, `${cacheKey}.mp3`);
    if (existsSync(file)) return { url: file, costUsd: 0, cached: true };
    const { bytes, costUsd } = await generateSfx({ apiKey: process.env.ELEVENLABS_KEY, text, seconds });
    writeFileSync(file, bytes);
    return { url: file, costUsd, cached: false };
  } : null,
  saveAudio: async (b64) => { const f = path.join(out, "voice.mp3"); writeFileSync(f, Buffer.from(b64, "base64")); return f; },
  send: directSender(process.env.RUNWARE_API_KEY),
  crop: async ({ imageUrl, box }) => {
    const src = await fetchTo(imageUrl, path.join(out, `crop-src-${Date.now()}.jpg`));
    const [W, H] = execFileSync(FFPROBE, ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", src]).toString().trim().split(",").map(Number);
    const p = cropPixels(box, W, H);
    const file = path.join(out, `crop-${p.x}-${p.y}-${p.w}.jpg`);
    execFileSync(FFMPEG, ["-v", "error", "-y", "-i", src, "-vf", `crop=${p.w}:${p.h}:${p.x}:${p.y}`, "-q:v", "2", file]);
    return { image: `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`, h: p.h };
  },
  keep: async (url, name) => { await fetchTo(url, path.join(out, name)); return url; },
  startRender: async (job) => {
    const file = await renderCutaway(job, path.join(out, "render"), "final.mp4");
    renderResult = file;
    return { file };
  },
  checkRender: async (handle) => ({ state: "done", url: handle.file ?? renderResult, costUsd: 0 }),
};

const spent = (s) => Object.values(s.costs ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
const save = (s) => writeFileSync(statePath, JSON.stringify(s, null, 2));

let s = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : newRun({ topic: arg("topic", "landfill"), lengthSec: Number(arg("length", "30")), soundEffects: !flag("no-sfx"), usedIdeas: ideas.mechanisms });
if (s.step === "approval" && flag("approve")) {
  const failed = visionFailures(s);
  if (failed.length && !flag("force")) {
    console.error(`not approving: ${failed.length} wide image(s) failed the vision check twice: ${failed.map((w) => `${w.id}: ${w.vision.fix}`).join(" | ")}`);
    process.exit(3);
  }
  s = approve(s); save(s); console.log("approved");
}

const t0 = Date.now();
let lastStep = null;
while (!["approval", "done", "failed"].includes(s.step)) {
  s = await advance(s, deps);
  save(s);
  if (s.step !== lastStep) { console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${s.step}  spent $${spent(s).toFixed(4)}`); lastStep = s.step; }
  if (spent(s) > maxUsd) { console.error(`stopping: spent $${spent(s).toFixed(3)} > --max-usd ${maxUsd}`); break; }
  if (!["approval", "done", "failed"].includes(s.step)) await new Promise((r) => setTimeout(r, 4000));
}

if (s.step === "done" && s.plan) {
  writeFileSync(IDEAS, JSON.stringify({ topics: [...new Set([...ideas.topics, s.topic])], mechanisms: [...new Set([...ideas.mechanisms, ...(s.plan.mechanisms ?? [])])] }, null, 2));
}
const vision = (s.wide ?? []).map((w) => ({ id: w.id, attempts: w.attempts, pass: w.vision?.pass ?? null, fix: w.vision?.fix ?? "" }));
if (s.visionLog?.length) writeFileSync(path.join(out, "vision-log.json"), JSON.stringify(s.visionLog, null, 2));
console.log(JSON.stringify({ step: s.step, error: s.error ?? null, costs: s.costs, totalUsd: Number(spent(s).toFixed(4)), vision, critic: s.critic ?? null, final: s.finalUrl ?? null, seconds: (Date.now() - t0) / 1000 }, null, 2));
