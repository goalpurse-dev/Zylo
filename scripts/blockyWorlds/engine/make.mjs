// Blocky Worlds engine, end to end (free, local): script -> voice -> plan -> timeline.json -> music -> render -> mix ->
// final.mp4 (+ a 720p web copy). Prints `PROGRESS {...}` lines and a timing report (seconds per stage).
//   node make.mjs --example [--idea 0] [--out out/<name>] [--workers N] [--mode pages|browsers] [--secs N] [--silent]
//                 [--stubs [list]]
//   --example: EXAMPLE_SCRIPT + EXAMPLE_IDEAS[--idea] from supabase/functions/_shared/blockyWorlds/examples.js
//   --silent: no voice (the planner's estimateWords timings and a silent wav), --secs N: render only the first N s
// API: makeVideo({ script, idea, out, workers, secs, silent, stubs, mode }) -> report
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderParallel, parseArgs } from "./render.mjs";

const ENGINE = path.dirname(fileURLToPath(import.meta.url));
const FF = process.env.FFMPEG ?? "ffmpeg";
const EXAMPLES = path.resolve(ENGINE, "../../../supabase/functions/_shared/blockyWorlds/examples.js");

/** a module of another agent, loaded only when needed; a clear error when it (or an export) is missing */
async function need(rel, names) {
  const f = path.join(ENGINE, rel);
  if (!fs.existsSync(f)) throw new Error(`make: ${rel} does not exist yet (needed for ${names.join(", ")})`);
  const m = await import(pathToFileURL(f).href);
  for (const n of names) if (typeof m[n] !== "function") throw new Error(`make: ${rel} has no exported function ${n}()`);
  return m;
}
const run = (args) => new Promise((res, rej) => { let err = ""; const p = spawn(FF, ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] }); p.stderr.on("data", (d) => (err += d)); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}: ${err.slice(-600)}`)))); });

/** EXAMPLE_SCRIPT's [part, text] pairs as { part, text } lines (what the planner and the voice read) */
export function normalizeScript(s) {
  return { ...s, title: s.title, lines: s.lines.map((l) => (Array.isArray(l) ? { part: l[0], text: l[1] } : typeof l === "string" ? { part: "line", text: l } : l)) };
}

export async function makeVideo({ script, idea = {}, out, workers = 2, mode = "pages", secs = null, silent = false, stubs = null, onProgress = null, voice = "free", paid = false, renderVideo = true }) {
  const progress = (o) => { console.log(`PROGRESS ${JSON.stringify(o)}`); onProgress?.(o); };
  const T0 = Date.now(), timing = {};
  const lap = async (k, fn) => { const t = Date.now(); const r = await fn(); timing[k] = +((Date.now() - t) / 1000).toFixed(2); return r; };
  out = path.resolve(out); fs.mkdirSync(out, { recursive: true });
  script = normalizeScript(script);
  fs.writeFileSync(path.join(out, "script.json"), JSON.stringify({ script, idea }, null, 1));
  const voiceWav = path.join(out, "voice.wav"), wordsJson = path.join(out, "words.json");
  let voiceInfo = { voice: silent ? "silent" : voice };

  // 1. voice (or the silent fallback)
  progress({ stage: "voice", pct: 2 });
  const plan = await need("plan.mjs", ["planVideo", ...(silent ? ["estimateWords"] : [])]);
  const words = await lap("voice", async () => {
    if (silent) {
      const w = plan.estimateWords(script);
      fs.writeFileSync(wordsJson, JSON.stringify(w));
      await run(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", (w.at(-1).end + 0.4).toFixed(3), "-c:a", "pcm_s16le", voiceWav]);
      return w;
    }
    if (voice === "eleven") {
      // the real narrator: a PAID take, only with paid = true (the CLI's --paid); a take already in the folder is reused
      if (!paid) throw new Error("--voice eleven is a paid ElevenLabs take: add --paid");
      const { elevenVoice } = await need("voice/eleven.mjs", ["elevenVoice"]);
      const v = await elevenVoice({ lines: script.lines, outDir: out });
      voiceInfo = { voice: "eleven", costUsd: v.costUsd, billedChars: v.billedChars, chars: v.chars, wpm: v.wpm, duration: v.duration, rawDuration: v.rawDuration };
      return v.words;
    }
    const { freeVoice } = await need("voice/free.mjs", ["freeVoice"]);
    const v = await freeVoice({ lines: script.lines, out: voiceWav, wordsOut: wordsJson });
    return v.words;
  });

  // 2. the plan -> timeline.json (next to the audio: the page server serves this folder)
  progress({ stage: "plan", pct: 8 });
  const tl = await lap("plan", async () => plan.planVideo({ script, words, idea }));
  tl.audio = { voice: "voice.wav", music: "music.wav" };
  const problems = typeof plan.checkTimeline === "function" ? plan.checkTimeline(tl) : [];
  if (problems.length) console.log(`plan: ${problems.length} problem(s): ${problems.slice(0, 8).join("; ")}`);
  // every line's key nouns must be on screen (plan.mjs checkVisuals): a line still missing one stops the run before any render
  const missing = typeof plan.checkVisuals === "function" ? plan.checkVisuals(tl, script) : [];
  fs.writeFileSync(path.join(out, "visual-check.json"), JSON.stringify({ missing, report: tl.visualReport ?? null }, null, 1));
  if (missing.length) throw new Error(`VISUAL_CHECK: ${missing.length} line(s) show nothing for a spoken noun: ${missing.slice(0, 5).map((m) => `#${m.line} ${(m.missing ?? []).join("/")}`).join(", ")} (see visual-check.json)`);
  const tlPath = path.join(out, "timeline.json");
  fs.writeFileSync(tlPath, JSON.stringify(tl, null, 1));
  const length = secs ? Math.min(Number(secs), tl.duration) : tl.duration;

  // 3. music
  progress({ stage: "music", pct: 10 });
  const musicWav = path.join(out, "music.wav");
  await lap("music", async () => { const { makeMusic } = await need("audio/music.mjs", ["makeMusic"]); await makeMusic({ out: musicWav, seconds: Math.ceil(tl.duration + 1), mood: idea.mood ?? "horror", seed: 1 }); });

  // 4. render (silent video)
  const silentMp4 = path.join(out, "silent.mp4"), fps = tl.fps ?? 24;
  // --no-render: stop after the mix (the GPU render happens on RunPod: runpod/dispatch.mjs reads this folder)
  const rendered = !renderVideo ? null : await lap("render", () => renderParallel({ timelinePath: tlPath, out: silentMp4, workers, mode, stubs, to: Math.round(length * fps), onProgress: (o) => progress({ ...o, pct: Math.round(12 + (o.pct * 78) / 100) }) }));

  // 5. mix
  progress({ stage: "mix", pct: 91 });
  const mixM4a = path.join(out, "mix.m4a");
  await lap("mix", async () => { const { mixAudio } = await need("audio/mix.mjs", ["mixAudio"]); await mixAudio({ voice: voiceWav, music: musicWav, out: mixM4a, duration: length, shots: tl.shots }); });

  if (!renderVideo) {
    timing.total = +((Date.now() - T0) / 1000).toFixed(2);
    const report = { title: tl.title, duration: tl.duration, shots: tl.shots.length, voice: voiceInfo, timing, planProblems: problems, rendered: "no (--no-render)" };
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
    return { ...report, files: { timeline: tlPath, mix: mixM4a } };
  }
  // 6. mux + the web copy
  progress({ stage: "mux", pct: 96 });
  const final = path.join(out, "final.mp4"), web = path.join(out, "final_720.mp4");
  await lap("mux", async () => {
    await run(["-i", silentMp4, "-i", mixM4a, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", length.toFixed(3), "-movflags", "+faststart", final]);
    await run(["-i", final, "-vf", "scale=720:1280", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", web]);
  });
  timing.total = +((Date.now() - T0) / 1000).toFixed(2);
  const report = { title: tl.title, duration: tl.duration, rendered: length, frames: rendered.frames, shots: tl.shots.length, workers: rendered.workers, mode, msPerFrame: rendered.msPerFrame, pageLoadS: rendered.loadS, silent, stubs, voice: voiceInfo, files: { final, web, timeline: tlPath }, sizes: { final: fs.statSync(final).size, web: fs.statSync(web).size }, timing, planProblems: problems };
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
  progress({ stage: "done", pct: 100 });
  return report;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const { opt } = parseArgs(process.argv.slice(2), ["out", "workers", "mode", "secs", "idea", "voice"]);
  if (!opt.example) { console.error("usage: node make.mjs --example [--idea 0] [--out out/<name>] [--workers N] [--secs N] [--silent] [--stubs]"); process.exit(2); }
  const { EXAMPLE_SCRIPT, EXAMPLE_IDEAS } = await import(pathToFileURL(EXAMPLES).href);
  const idea = EXAMPLE_IDEAS[Number(opt.idea ?? 0)];
  try {
    const r = await makeVideo({ script: EXAMPLE_SCRIPT, idea, out: opt.out ?? path.join(ENGINE, "out", "example"), workers: Number(opt.workers ?? 2), mode: opt.mode ?? "pages", secs: opt.secs ? Number(opt.secs) : null, silent: !!opt.silent, stubs: opt.stubs ?? null, voice: opt.voice ?? "free", paid: !!opt.paid, renderVideo: !opt["no-render"] });
    console.log("timing (s):", JSON.stringify(r.timing));
    console.log(r.files.final ? `final: ${r.files.final}` : `ready for RunPod: ${r.files.timeline}`);
  } catch (e) { console.error(e.stack ?? e.message); process.exit(1); }
}
