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
import { advance, approve, newRun } from "../../supabase/functions/_shared/cutaway/engine.js";
import { cropPixels } from "../../supabase/functions/_shared/cutaway/beats.js";
import { planVideo } from "../../supabase/functions/_shared/cutaway/llm.js";
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

let renderResult = null;
const deps = {
  planVideo: ({ topic, lengthSec }) => planVideo({ apiKey: process.env.ANTHROPIC_API_KEY, topic, lengthSec }),
  synthesize: process.env.ELEVENLABS_KEY ? ({ text }) => synthesize({ apiKey: process.env.ELEVENLABS_KEY, text }) : null,
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

let s = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : newRun({ topic: arg("topic", "rain gutter"), lengthSec: Number(arg("length", "15")) });
if (s.step === "approval" && flag("approve")) { s = approve(s); save(s); console.log("approved"); }

const t0 = Date.now();
let lastStep = null;
while (!["approval", "done", "failed"].includes(s.step)) {
  s = await advance(s, deps);
  save(s);
  if (s.step !== lastStep) { console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} s] ${s.step}  spent $${spent(s).toFixed(4)}`); lastStep = s.step; }
  if (spent(s) > maxUsd) { console.error(`stopping: spent $${spent(s).toFixed(3)} > --max-usd ${maxUsd}`); break; }
  if (!["approval", "done", "failed"].includes(s.step)) await new Promise((r) => setTimeout(r, 4000));
}

console.log(JSON.stringify({ step: s.step, error: s.error ?? null, costs: s.costs, totalUsd: Number(spent(s).toFixed(4)), final: s.finalUrl ?? null, seconds: (Date.now() - t0) / 1000 }, null, 2));
