// Blocky Worlds engine, end to end (free, local): script -> voice -> plan -> timeline.json -> music -> render -> mix ->
// final.mp4 (+ a 720p web copy). Prints `PROGRESS {...}` lines and a timing report (seconds per stage).
//   node make.mjs --example [--idea 0] [--out out/<name>] [--workers N] [--mode pages|browsers] [--secs N] [--silent]
//                 [--stubs [list]] [--music A-E|loop.wav] [--no-sfx] [--director mock|haiku|sonnet|off] [--script file.json]
//   --director: the story director's production list (lib/director) is the planner's source of truth; default mock
//   (free, rule-based). haiku / sonnet are PAID calls (~$0.003 / ~$0.05 a video) and run only with --paid and
//   ANTHROPIC_KEY. It runs at the same time as the voice; production.json lands in the out folder.
//   --script: a { title, idea, lines: [{ part, text }] } file instead of --example (dev/scripts/turtle_wolf.json)
//   --music: an original backrooms loop (audio/backrooms.mjs options A-E) or a seamless loop file; default A (the
//   owner's pick, 2026-11-04: the same track under every video, looped to fit, with its clean ending).
//   Sound effects on key moments come from lib/sfx.js (sfx_cues.json in the out folder); --no-sfx turns them off.
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

export async function makeVideo({ script, idea = {}, out, workers = 2, mode = "pages", secs = null, silent = false, stubs = null, onProgress = null, voice = "free", paid = false, renderVideo = true, music = "A", sfx = true, director = "mock" }) {
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
  // the story director, in parallel with the voice (it needs only the script)
  const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
  const directing = director && director !== "off" ? lap("director", async () => {
    const { directStory } = await need("lib/director/index.js", ["directStory"]);
    const { DIRECTOR_MODELS } = await import(pathToFileURL(path.join(ENGINE, "lib", "director", "design.js")).href);
    const real = director === "haiku" || director === "sonnet";
    if (real && !paid) throw new Error(`--director ${director} is a paid Anthropic call: add --paid (or use --director mock, free)`);
    const apiKey = process.env.ANTHROPIC_KEY ?? process.env.ANTHROPIC_API_KEY ?? null;
    if (real && !apiKey) throw new Error(`--director ${director} needs ANTHROPIC_KEY`);
    const { makeGapLog, jsonlStore } = await import(pathToFileURL(path.join(ENGINE, "lib", "gaps.js")).href);
    const d = await directStory({ script, idea, provider: real ? "anthropic" : "mock", apiKey, model: director === "sonnet" ? DIRECTOR_MODELS.strong : DIRECTOR_MODELS.fast, exists, gapLog: makeGapLog({ store: jsonlStore(path.join(out, "gaps.jsonl")) }), storyId: idea?.title ?? script.title ?? null, source: "make" });
    fs.writeFileSync(path.join(out, "production.json"), JSON.stringify({ provider: d.provider, model: d.model, fellBack: d.fellBack, costUsd: d.costUsd, ms: d.ms, problems: d.problems, production: d.production, gaps: d.match.gaps, summary: d.match.summary }, null, 1));
    return d;
  }) : Promise.resolve(null);
  directing.catch(() => {});
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
  const direction = await directing;
  const tl = await lap("plan", async () => plan.planVideo({ script, words, idea, direction, exists }));
  tl.audio = { voice: "voice.wav", music: "music.wav" };
  const problems = typeof plan.checkTimeline === "function" ? plan.checkTimeline(tl) : [];
  if (problems.length) console.log(`plan: ${problems.length} problem(s): ${problems.slice(0, 8).join("; ")}`);
  // every line's key nouns must be on screen (plan.mjs checkVisuals): a line still missing one stops the run before any render
  const missing = typeof plan.checkVisuals === "function" ? plan.checkVisuals(tl, script) : [];
  // every shot's subject (who the line is about) must be on screen and featured (plan.mjs checkSubjects)
  const subjects = typeof plan.checkSubjects === "function" ? plan.checkSubjects(tl) : [];
  // every line's items from the production list on screen (plan.mjs checkProduction; planVideo re-planned misses already)
  const production = typeof plan.checkProduction === "function" ? plan.checkProduction(tl) : [];
  fs.writeFileSync(path.join(out, "visual-check.json"), JSON.stringify({ missing, subjects, production, report: tl.visualReport ?? null, direction: tl.direction ?? null }, null, 1));
  if (missing.length) throw new Error(`VISUAL_CHECK: ${missing.length} line(s) show nothing for a spoken noun: ${missing.slice(0, 5).map((m) => `#${m.line} ${(m.missing ?? []).join("/")}`).join(", ")} (see visual-check.json)`);
  if (subjects.length) throw new Error(`SUBJECT_CHECK: ${subjects.length} shot(s) don't show who the line is about: ${subjects.slice(0, 5).map((m) => `shot ${m.shot} (#${m.line}) ${m.problem}`).join(", ")} (see visual-check.json)`);
  if (production.length) throw new Error(`PRODUCTION_CHECK: ${production.length} line(s) miss an item the story needs: ${production.slice(0, 5).map((m) => `#${m.line} ${m.missing.map((x) => x.name).join("/")}`).join(", ")} (see visual-check.json)`);
  if (problems.length) throw new Error(`PLAN_FAILED: ${problems.slice(0, 5).join("; ")}`);
  // no builder in the local run: its need markers go (a string shot.world would read as an EPIC world to the engine)
  for (const s of tl.shots) { if (typeof s.world === "string") delete s.world; if (s.need) delete s.need; }
  const tlPath = path.join(out, "timeline.json");
  fs.writeFileSync(tlPath, JSON.stringify(tl, null, 1));
  const length = secs ? Math.min(Number(secs), tl.duration) : tl.duration;

  // 3. music: --music A-E = an original backrooms loop (audio/backrooms.mjs) played to the length with its ending;
  //    --music <file> = a seamless loop file; none = the old mood bed
  progress({ stage: "music", pct: 10 });
  const musicWav = path.join(out, "music.wav");
  await lap("music", async () => {
    if (music) { const { bedFromLoop } = await need("audio/mix.mjs", ["bedFromLoop"]); await bedFromLoop(music, length, musicWav); return; }
    const { makeMusic } = await need("audio/music.mjs", ["makeMusic"]); await makeMusic({ out: musicWav, seconds: Math.ceil(tl.duration + 1), mood: idea.mood ?? "horror", seed: 1 });
  });

  // 4. render (silent video)
  const silentMp4 = path.join(out, "silent.mp4"), fps = tl.fps ?? 24;
  // --no-render: stop after the mix (the GPU render happens on RunPod: runpod/dispatch.mjs reads this folder)
  const rendered = !renderVideo ? null : await lap("render", () => renderParallel({ timelinePath: tlPath, out: silentMp4, workers, mode, stubs, to: Math.round(length * fps), onProgress: (o) => progress({ ...o, pct: Math.round(12 + (o.pct * 78) / 100) }) }));

  // 5. mix
  progress({ stage: "mix", pct: 91 });
  const mixM4a = path.join(out, "mix.m4a");
  // sound effects on the key moments (lib/sfx.js; --no-sfx switches them off), the bed under the voice at the references' level
  let audioInfo = null;
  await lap("mix", async () => {
    const { mixAudio } = await need("audio/mix.mjs", ["mixAudio"]);
    const { sfxCues } = await import(pathToFileURL(path.join(ENGINE, "lib", "sfx.js")).href);
    const { simpleCues, AUDIO_SIMPLE } = await import(pathToFileURL(path.join(ENGINE, "lib", "audioPlan.js")).href);
    const simpleAudio = tl.look === "simple"; // SIMPLE LOOK: one boom on the rule's key word, music ~12 dB under
    const cues = sfx ? (simpleAudio ? simpleCues(tl, sfxCues(tl)) : sfxCues(tl)).filter((c) => c.t < length) : [];
    fs.writeFileSync(path.join(out, "sfx_cues.json"), JSON.stringify(cues, null, 1));
    audioInfo = await mixAudio({ voice: voiceWav, music: musicWav, out: mixM4a, duration: length, sfxCues: cues, ...(simpleAudio ? { musicUnderVoiceDb: AUDIO_SIMPLE.musicUnderVoiceDb } : {}) });
    audioInfo.musicOption = music ?? `mood ${idea.mood ?? "horror"}`;
  });

  if (!renderVideo) {
    timing.total = +((Date.now() - T0) / 1000).toFixed(2);
    const report = { title: tl.title, duration: tl.duration, shots: tl.shots.length, voice: voiceInfo, audio: audioInfo, timing, planProblems: problems, rendered: "no (--no-render)" };
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
  const report = { title: tl.title, duration: tl.duration, rendered: length, frames: rendered.frames, shots: tl.shots.length, workers: rendered.workers, mode, msPerFrame: rendered.msPerFrame, pageLoadS: rendered.loadS, silent, stubs, voice: voiceInfo, audio: audioInfo, files: { final, web, timeline: tlPath }, sizes: { final: fs.statSync(final).size, web: fs.statSync(web).size }, timing, planProblems: problems };
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
  progress({ stage: "done", pct: 100 });
  return report;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const { opt } = parseArgs(process.argv.slice(2), ["out", "workers", "mode", "secs", "idea", "voice", "music", "director", "script"]);
  if (opt.script) {
    const f = JSON.parse(fs.readFileSync(path.resolve(opt.script), "utf8"));
    try {
      const r = await makeVideo({ script: { title: f.title, lines: f.lines }, idea: f.idea ?? {}, out: opt.out ?? path.join(ENGINE, "out", path.basename(opt.script, ".json")), workers: Number(opt.workers ?? 2), mode: opt.mode ?? "pages", secs: opt.secs ? Number(opt.secs) : null, silent: !!opt.silent, stubs: opt.stubs ?? null, voice: opt.voice ?? "free", paid: !!opt.paid, renderVideo: !opt["no-render"], music: opt.music ?? "A", sfx: !opt["no-sfx"], director: opt.director ?? "mock" });
      console.log("timing (s):", JSON.stringify(r.timing));
      console.log(r.files.final ? `final: ${r.files.final}` : `ready for RunPod: ${r.files.timeline}`);
    } catch (e) { console.error(e.stack ?? e.message); process.exit(1); }
    process.exit(0);
  }
  if (!opt.example) { console.error("usage: node make.mjs --example [--idea 0] [--out out/<name>] [--workers N] [--secs N] [--silent] [--stubs] [--music A-E|loop.wav] [--no-sfx]"); process.exit(2); }
  const { EXAMPLE_SCRIPT, EXAMPLE_IDEAS } = await import(pathToFileURL(EXAMPLES).href);
  const idea = EXAMPLE_IDEAS[Number(opt.idea ?? 0)];
  try {
    const r = await makeVideo({ script: EXAMPLE_SCRIPT, idea, out: opt.out ?? path.join(ENGINE, "out", "example"), workers: Number(opt.workers ?? 2), mode: opt.mode ?? "pages", secs: opt.secs ? Number(opt.secs) : null, silent: !!opt.silent, stubs: opt.stubs ?? null, voice: opt.voice ?? "free", paid: !!opt.paid, renderVideo: !opt["no-render"], music: opt.music ?? "A", sfx: !opt["no-sfx"], director: opt.director ?? "mock" });
    console.log("timing (s):", JSON.stringify(r.timing));
    console.log(r.files.final ? `final: ${r.files.final}` : `ready for RunPod: ${r.files.timeline}`);
  } catch (e) { console.error(e.stack ?? e.message); process.exit(1); }
}
