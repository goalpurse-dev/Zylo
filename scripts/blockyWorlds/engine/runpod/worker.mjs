// Blocky Worlds RunPod worker (docs/blocky-worlds-pipeline.md). One job, then RESULT {...} on stdout (handler.py returns it).
//
// PRODUCTION ({ job: {...} } from blocky-worlds-render; signed URLs and a callback token only, never a storage key):
//   role "prepare": the story director (lib/director directStory: mock by default, free; "anthropic" with the job's
//                   director.provider + ANTHROPIC_KEY) IN PARALLEL with the voice (ElevenLabs, ELEVENLABS_KEY from the
//                   RunPod secret; or the run's earlier take, never bought twice) -> trim + word timings -> planVideo
//                   ({ direction }: the production list is the planner's source of truth) -> checkTimeline +
//                   checkVisuals + checkSubjects + checkProduction (ANY miss stops here: nothing is rendered, the run is
//                   refunded; never skipped) -> timeline.json (+ production.json) up -> "planned" (with the capability
//                   gaps: the worker has no Supabase key, the edge function logs them) -> music A + SFX cues + the mix
//                   -> mix.m4a up. No GPU needed.
//                   The server sets job.prepare.director { provider, model? } and job.prepare.builder { provider,
//                   library (snapshot), budget: { maxUsd } } from its secrets (render.js prepareProduction); a builder
//                   asset goes back as a "built" event, the spend in "planned" and in the job's end (spend).
//   role "chunk":   GPU check (NO_GPU -> handler.py retires this worker) -> frames [from, to) -> seg (1080p, squeezed
//                   under the upload limit) + web (720p) up, progress events as it goes.
//   role "finish":  the segments joined by stream copy + the mix -> final.mp4; the same for web.mp4; poster.jpg. No GPU.
//   Events go to job.callback.url ({ runId, jobId, token, event, ... }); a callback that can't be reached never fails
//   the job (RunPod's webhook and the sweeper cover it).
//
// STAGING (inline or { jobUrl }; runpod/dispatch.mjs): { mode, timelineUrl, pages, ranges: [{ from, to, upload }],
//   whole: { mixUrl, upload } | null, uploads: { report } } as before.
//
// mode: "gpu" (RunPod), "cpu" (SwiftShader, tests), "local" (this laptop's GPU, the dry run).
//   node runpod/worker.mjs '{"job": {...}}'  |  node runpod/worker.mjs '{"jobUrl": "https://..."}'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { useGpu, useSoftware } from "./gpu.mjs";
import { concat, renderParallel } from "../render.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FF = process.env.FFMPEG ?? "ffmpeg";
const MAX_UPLOAD = 48 * 1024 * 1024;
const coded = (code, message) => Object.assign(new Error(message), { code });

// ---------------------------------------------------------------- files by URL (https signed URLs, or file:// for tests)
export async function get(url, file) {
  if (!url) throw coded("BAD_JOB", `no URL for ${file ? path.basename(file) : "a download"}`);
  const b = url.startsWith("file://") ? fs.readFileSync(fileURLToPath(url)) : await fetch(url, { signal: AbortSignal.timeout(120000) }).then(async (r) => { if (!r.ok) throw new Error(`download ${r.status} ${url.split("?")[0]}`); return Buffer.from(await r.arrayBuffer()); });
  if (file) fs.writeFileSync(file, b); return b;
}
export async function put(url, file, type) {
  if (!url) throw coded("BAD_JOB", `no upload URL for ${path.basename(file)}`);
  if (url.startsWith("file://")) { const dst = fileURLToPath(url); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(file, dst); return; }
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { method: "PUT", headers: { "Content-Type": type, "x-upsert": "true" }, body: fs.readFileSync(file), signal: AbortSignal.timeout(180000) });
      if (r.ok) return;
      const t = (await r.text()).slice(0, 200);
      if (r.status < 500 || i >= 3) throw coded("UPLOAD_FAILED", `upload ${path.basename(file)} ${r.status} ${t}`);
    } catch (e) { if (e.code === "UPLOAD_FAILED" || i >= 3) throw coded("UPLOAD_FAILED", e.message); }
    await new Promise((s) => setTimeout(s, 1500 * i));
  }
}
const ffmpeg = (args) => { const p = spawnSync(FF, ["-v", "error", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 26 }); if (p.status !== 0) throw new Error(`ffmpeg failed: ${(p.stderr || "").slice(-500)}`); };
const probeDuration = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

/** the callback: { runId, jobId, token, attempt, event, ...data }; 3 tries, never throws */
export function poster(job) {
  return async (event, data = {}) => {
    if (!job.callback?.url) { console.log(`EVENT ${event} ${JSON.stringify(data).slice(0, 300)}`); return; }
    const body = JSON.stringify({ runId: job.runId, jobId: job.jobId, token: job.callback.token, attempt: job.attempt ?? 1, event, ...data });
    for (let i = 1; i <= 3; i++) {
      try { const r = await fetch(job.callback.url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(15000) }); await r.body?.cancel(); if (r.ok || r.status < 500) return; } catch { /* try again */ }
      await new Promise((s) => setTimeout(s, 1000 * i));
    }
  };
}

// ---------------------------------------------------------------- the pre-render checks (THE RULE)
/**
 * checkTimeline + checkVisuals + checkSubjects on a planned timeline. A planner without any of the three is a failure,
 * never a skip. -> { passed, timeline, missing, subjects }; the caller stops before any render when !passed.
 */
export function preRenderChecks(plan, tl, script, kit) {
  // checkProduction is required whenever the plan was made from a production list (tl.production)
  for (const f of ["checkTimeline", "checkVisuals", "checkSubjects", ...(tl?.production ? ["checkProduction"] : [])]) if (typeof plan?.[f] !== "function") throw coded("PLAN_FAILED", `plan.mjs has no ${f}(): the pre-render checks can't run, so nothing is rendered`);
  const timeline = plan.checkTimeline(tl) ?? [], missing = plan.checkVisuals(tl, script) ?? [], subjects = plan.checkSubjects(tl) ?? [];
  const production = tl?.production ? plan.checkProduction(tl) ?? [] : [];
  const kitMissing = kitProblems(tl, kit);
  return { passed: !timeline.length && !missing.length && !subjects.length && !production.length && !kitMissing.length, timeline, missing, subjects, production, kit: kitMissing };
}
/**
 * Every object the plan puts on screen must be one the engine's kit can build (page/kit/objects.js resolveObject +
 * its states): the engine page refuses the timeline otherwise, on every GPU, so it is checked here, before any render
 * (2026-11-05 dry run: the planner placed a "ladder" the kit did not have yet; 8 GPU tries were spent on it).
 */
export function kitProblems(tl, kit) {
  if (typeof kit?.resolveObject !== "function" || !kit?.OBJECTS) throw coded("PLAN_FAILED", "the kit's object catalog is not loaded: the pre-render checks can't run, so nothing is rendered");
  const out = [];
  (tl.shots ?? []).forEach((s, i) => {
    for (const o of s.objects ?? []) {
      if (o?.asset) { if (tl.assets?.[o.asset]?.kind !== "object") out.push(`shot ${i} (#${s.line}): built object "${o.name}" has no blueprint in timeline.assets`); continue; }
      const key = kit.resolveObject(o?.name);
      if (!key) { out.push(`shot ${i} (#${s.line}): the kit has no object "${o?.name}"`); continue; }
      const states = kit.OBJECTS[key]?.states ?? [], st = o.state ?? kit.OBJECTS[key]?.state;
      if (states.length && !states.includes(st)) out.push(`shot ${i} (#${s.line}): object "${key}" has no state "${st}"`);
    }
  });
  return out;
}
export const loadKit = () => import(pathToFileURL(path.join(ENGINE, "page", "kit", "objects.js")).href);
export function checkFailure(c) {
  if (c.missing.length) return coded("VISUAL_CHECK", `${c.missing.length} line(s) show nothing for a spoken noun: ${c.missing.slice(0, 5).map((m) => `#${m.line} ${(m.missing ?? []).join("/")}`).join(", ")}`);
  if (c.production?.length) return coded("PRODUCTION_CHECK", `${c.production.length} line(s) miss an item the story needs: ${c.production.slice(0, 5).map((m) => `#${m.line} ${(m.missing ?? []).map((x) => x.name).join("/")}`).join(", ")}`);
  if (c.subjects.length) return coded("SUBJECT_CHECK", `${c.subjects.length} shot(s) don't show who the line is about: ${c.subjects.slice(0, 5).map((m) => `shot ${m.shot} (#${m.line}) ${m.problem}`).join(", ")}`);
  if (c.kit?.length) return coded("KIT_MISSING", `${c.kit.length} object(s) the engine's kit can't build: ${c.kit.slice(0, 5).join("; ")}`);
  if (c.timeline.length) return coded("PLAN_FAILED", `the timeline has ${c.timeline.length} problem(s): ${c.timeline.slice(0, 5).join("; ")}`);
  return null;
}
const normalizeScript = (s) => ({ ...s, lines: (s?.lines ?? []).map((l) => (Array.isArray(l) ? { part: l[0], text: l[1] } : typeof l === "string" ? { part: "line", text: l } : l)) });

// ---------------------------------------------------------------- prepare: voice -> plan + checks -> mix
export async function prepare(job, dir, post, { planModule = null, voiceFn = null, kitModule = null, builder: builderIn = null } = {}) {
  const p = job.prepare ?? {}, timing = {};
  const lap = async (k, fn) => { const t = Date.now(); const r = await fn(); timing[k] = +((Date.now() - t) / 1000).toFixed(2); return r; };
  const script = normalizeScript(p.script);
  if (!script.lines.length) throw coded("BAD_JOB", "the script has no lines");
  const mp3 = path.join(dir, "voice.mp3"), takeJson = path.join(dir, "take.json");

  // 0. the builder (lib/builder: a missing kit object or world never fails a run) starts early: the needs of a plan made
  //    from estimated timings are resolved (kit -> library -> design + still + vision check) while the voice is made
  const plan = planModule ?? (await import(pathToFileURL(path.join(ENGINE, "plan.mjs")).href));
  const kit = kitModule ?? (await loadKit());
  const B = await import(pathToFileURL(path.join(ENGINE, "lib", "builder", "index.js")).href);
  const { snapshotCache } = await import(pathToFileURL(path.join(ENGINE, "lib", "builder", "cache.js")).href);
  const blog = [];
  const library = snapshotCache(p.builder?.library ?? [], { onSave: async (asset) => { await post("built", { asset: { ...asset, still_path: asset.still_path ? path.basename(asset.still_path) : null } }); } });
  const builder = builderIn ?? B.makeBuilder({
    provider: await B.providerFromConfig({ provider: p.builder?.provider ?? process.env.BLOCKY_WORLDS_BUILDER ?? "off", idea: p.idea ?? null }),
    cache: library, budget: p.builder?.budget ?? {}, stillDir: path.join(dir, "stills"), log: (m) => { blog.push(m); console.log(`builder: ${m}`); },
  });
  // what the director and the builder spent, for the server's cost ledger (render.js aiLedger): "planned" reports the
  // spend so far; the job's end (done output / failed event) reports the totals and what "planned" said, so a call that
  // ends after "planned", or a job that fails before it, is still billed once
  const spend = { directorUsd: 0, directorModel: null, builderUsd: 0, plannedDirectorUsd: 0, plannedBuilderUsd: 0 };
  const spendNow = () => ({ ...spend, builderUsd: +Number(builder.spent ?? spend.builderUsd ?? 0).toFixed(5) });
  try {
    const { needsFromTimeline } = await import(pathToFileURL(path.join(ENGINE, "lib", "builder", "apply.js")).href);
    const early = plan.planVideo({ script, words: plan.estimateWords ? plan.estimateWords(script) : null, idea: p.idea ?? {}, lengthSec: p.lengthSec ?? null });
    builder.prefetch(needsFromTimeline(early, { kit }), kit);
  } catch (e) { console.log(`builder: no early start (${e.message})`); }
  // the story director runs while the voice is made (it needs only the script) and never fails a run (directStory falls
  // back to the mock's list); as soon as it answers, the builder starts on what the list needs built: the needs of a
  // plan made from its production list (match.builderNeeds after the planner's refinements, lib/direction.js)
  const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
  const directing = (async () => {
    if (p.director === false || p.director?.provider === "off") return null;
    try {
      const { directStory } = await import(pathToFileURL(path.join(ENGINE, "lib", "director", "index.js")).href);
      const provider = p.director?.provider === "anthropic" && process.env.ANTHROPIC_KEY ? "anthropic" : "mock";
      const d = await directStory({ script, idea: p.idea ?? null, provider, apiKey: process.env.ANTHROPIC_KEY ?? null, ...(p.director?.model ? { model: p.director.model } : {}), exists, runId: job.runId ?? null, source: "prepare", log: (m) => console.log(`director: ${m}`) });
      spend.directorUsd = Number(d?.costUsd) || 0; spend.directorModel = d?.model ?? null;
      try {
        const { needsFromTimeline } = await import(pathToFileURL(path.join(ENGINE, "lib", "builder", "apply.js")).href);
        const early = plan.planVideo({ script, words: plan.estimateWords ? plan.estimateWords(script) : null, idea: p.idea ?? {}, lengthSec: p.lengthSec ?? null, direction: d, exists });
        builder.prefetch(needsFromTimeline(early, { kit }), kit);
      } catch (e) { console.log(`builder: no directed early start (${e.message})`); }
      return d;
    } catch (e) { console.log(`director: skipped (${e.message})`); return null; }
  })();
  try {
  // 1. the voice: the run's earlier take, or one new paid take uploaded at once
  await post("progress", { stage: "voice", pct: 2 });
  const reuse = Boolean(p.voice?.get);
  if (!reuse && !p.voice?.put) throw coded("BAD_JOB", "no voice URLs");
  if (reuse) {
    try { await get(p.voice.get.mp3, mp3); await get(p.voice.get.take, takeJson); } catch (e) { throw coded("VOICE_DOWNLOAD", `the run's take could not be downloaded: ${e.message}`); }
  } else if (!process.env.ELEVENLABS_KEY && !voiceFn) throw coded("VOICE_CONFIG", "no ElevenLabs key in the worker (RunPod secret blocky_elevenlabs)");
  const voice = voiceFn ?? (await import(pathToFileURL(path.join(ENGINE, "voice", "eleven.mjs")).href)).elevenVoice;
  let v = null;
  try {
    [v] = await Promise.all([lap("voice", () => voice({ lines: script.lines, outDir: dir, apiKey: process.env.ELEVENLABS_KEY ?? null })), lap("director", () => directing)]);
  } catch (e) {
    const m = String(e.message ?? e);
    throw coded(/VOICE_CONFIG/.test(m) ? "VOICE_CONFIG" : /quota|credits|payment|insufficient|\b40[12]\b/i.test(m) ? "PROVIDER_BALANCE" : /different script/.test(m) ? "BAD_JOB" : "VOICE_FAILED", m.slice(0, 600));
  } finally {
    // a take that was bought is kept even if the trim after it failed: a retry gets it back instead of paying again
    if (!reuse && fs.existsSync(takeJson) && fs.existsSync(mp3)) {
      const take = JSON.parse(fs.readFileSync(takeJson, "utf8"));
      await put(p.voice.put.mp3, mp3, "audio/mpeg");
      await put(p.voice.put.take, takeJson, "application/json");
      await post("voiced", { costUsd: take.costUsd ?? null, billedChars: take.billedChars ?? null, chars: take.chars ?? null });
    }
  }

  // 2. the plan, the builder's things put in (each change re-checked; one that breaks a check is undone), then the
  //    three checks + the kit check: any miss stops the run here, before any render
  await post("progress", { stage: "plan", pct: 8 });
  const direction = await directing;
  const tl = await lap("plan", () => plan.planVideo({ script, words: v.words, idea: p.idea ?? {}, lengthSec: p.lengthSec ?? null, direction, exists }));
  if (direction) {
    const prodFile = path.join(dir, "production.json");
    fs.writeFileSync(prodFile, JSON.stringify({ provider: direction.provider, model: direction.model, fellBack: direction.fellBack, costUsd: direction.costUsd, ms: direction.ms, problems: direction.problems, production: direction.production, refined: tl.production ?? null, gaps: direction.match.gaps, summary: direction.match.summary }));
    if (p.out?.production) await put(p.out.production, prodFile, "application/json").catch((e) => console.log(`production.json upload: ${e.message}`)); // bookkeeping never fails a run
  }
  tl.audio = { voice: "voice.wav", music: "music.wav" };
  const built = await lap("build", () => builder.buildFor(tl, { plan, kit }));
  const checks = preRenderChecks(plan, tl, script, kit);
  const checkFile = path.join(dir, "visual-check.json");
  fs.writeFileSync(checkFile, JSON.stringify({ ...checks, report: tl.visualReport ?? null, builder: { ...built, log: blog } }, null, 1));
  if (p.out?.visualCheck) await put(p.out.visualCheck, checkFile, "application/json");
  const bad = checkFailure(checks);
  if (bad) throw bad;
  const tlPath = path.join(dir, "timeline.json");
  fs.writeFileSync(tlPath, JSON.stringify(tl));
  await put(p.out.timeline, tlPath, "application/json");
  const planned = { frames: Math.round(tl.duration * (tl.fps ?? 24)), duration: tl.duration, shots: tl.shots.length, builder: { costUsd: built.report.costUsd, built: built.applied.length, cards: built.cards.length, ms: built.report.ms },
    ...(direction ? { director: { provider: direction.provider, model: direction.model ?? null, fellBack: !!direction.fellBack, costUsd: direction.costUsd ?? 0, ms: direction.ms ?? null }, gaps: (direction.match?.gaps ?? []).slice(0, 200) } : {}),
    timing: { ...timing } };
  await post("planned", planned);
  spend.plannedBuilderUsd = Number(planned.builder.costUsd) || 0; spend.plannedDirectorUsd = Number(planned.director?.costUsd) || 0;

  // 3. music A + the SFX cues + the final mix (the chunks render meanwhile)
  const musicWav = path.join(dir, "music.wav"), mixM4a = path.join(dir, "mix.m4a");
  const { bedFromLoop, mixAudio } = await import(pathToFileURL(path.join(ENGINE, "audio", "mix.mjs")).href);
  const { sfxCues } = await import(pathToFileURL(path.join(ENGINE, "lib", "sfx.js")).href);
  await lap("music", () => bedFromLoop(p.music ?? "A", tl.duration, musicWav));
  const cues = p.sfx === false ? [] : sfxCues(tl);
  const audio = await lap("mix", () => mixAudio({ voice: v.wav, music: musicWav, out: mixM4a, duration: tl.duration, sfxCues: cues }));
  await put(p.out.mix, mixM4a, "audio/mp4");
  return { role: "prepare", planned, builder: { ...built.report, applied: built.applied, reverted: built.reverted, cards: built.cards, added: library.added.map((a) => ({ id: a.id, kind: a.kind, name: a.name })) }, voice: { reused: reuse, costUsd: reuse ? 0 : v.costUsd ?? null, billedChars: v.billedChars ?? null, chars: v.chars ?? null, wpm: v.wpm, duration: v.duration }, audio: { lufs: audio.lufs, truePeak: audio.truePeak, sfxCues: cues.length }, timing, spend: spendNow() };
  } catch (e) {
    // the spend goes back with the failure (a director still answering gets up to 20 s to say what it cost)
    let t;
    await Promise.race([directing, new Promise((s) => { t = setTimeout(s, 20000); })]).catch(() => {});
    clearTimeout(t);
    try { e.spend = spendNow(); } catch { /* bookkeeping never hides the real error */ }
    throw e;
  } finally { await builder.close().catch(() => {}); }
}

// ---------------------------------------------------------------- chunk: frames [from, to) -> seg + web
async function renderer(mode) { return mode === "gpu" ? useGpu() : mode === "cpu" ? useSoftware() : "local (this machine's Chrome)"; }

export async function chunk(job, dir, post) {
  const c = job.chunk, timing = {};
  let t = Date.now();
  const gl = await renderer(job.mode ?? "gpu");
  timing.gpuCheck = +((Date.now() - t) / 1000).toFixed(2);
  const tlPath = path.join(dir, "timeline.json");
  await get(c.timeline, tlPath);
  if (c.crf) process.env.RENDER_CRF = String(c.crf);
  const seg = path.join(dir, "seg.mp4"), web = path.join(dir, "web.mp4");
  let lastPct = -1;
  t = Date.now();
  let res;
  try {
    res = await renderParallel({ timelinePath: tlPath, out: seg, from: c.from, to: c.to, workers: c.pages ?? 1, onProgress: (o) => { const step = Math.floor((o.pct ?? 0) / 20) * 20; if (step > lastPct) { lastPct = step; post("progress", { stage: "render", pct: Math.min(95, step) }).catch(() => {}); } } });
  } catch (e) {
    // the engine page refusing the timeline is the same on every GPU: no retry (render.js NO_RETRY)
    if (/engine: the timeline has \d+ problem/.test(String(e.message))) throw coded("TIMELINE_INVALID", e.message);
    throw e;
  }
  timing.render = +((Date.now() - t) / 1000).toFixed(2);
  // the upload limit (50 MB a file): a busy chunk is squeezed again (higher CRF, same frames) until it fits
  const max = Number(c.maxBytes ?? MAX_UPLOAD);
  for (let crf = Number(c.crf ?? 21) + 4; fs.statSync(seg).size > max && crf <= 36; crf += 4) {
    const smaller = seg.replace(/\.mp4$/, `_crf${crf}.mp4`);
    ffmpeg(["-i", seg, "-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-pix_fmt", "yuv420p", smaller]);
    fs.renameSync(smaller, seg);
  }
  if (fs.statSync(seg).size > max) throw coded("CHUNK_TOO_BIG", `chunk ${c.index} is ${fs.statSync(seg).size} bytes even at CRF 36`);
  // the 720p web copy of this chunk (same settings in every chunk, so the finish joins them by stream copy)
  t = Date.now();
  ffmpeg(["-i", seg, "-vf", "scale=720:1280", "-c:v", "libx264", "-crf", "23", "-preset", "veryfast", "-pix_fmt", "yuv420p", web]);
  timing.web = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  await put(c.out.seg, seg, "video/mp4");
  await put(c.out.web, web, "video/mp4");
  timing.upload = +((Date.now() - t) / 1000).toFixed(2);
  return { role: "chunk", index: c.index, from: c.from, to: c.to, frames: res.frames, msPerFrame: res.msPerFrame, loadS: res.loadS, bytes: fs.statSync(seg).size, webBytes: fs.statSync(web).size, renderer: gl, timing };
}

// ---------------------------------------------------------------- finish: join + mux + poster
export async function finish(job, dir) {
  const f = job.finish, timing = {};
  let t = Date.now();
  const segs = [], webs = [], mix = path.join(dir, "mix.m4a");
  await Promise.all([
    ...f.segs.map(async (u, i) => { const p = path.join(dir, `seg_${String(i).padStart(3, "0")}.mp4`); await get(u, p); segs[i] = p; }),
    ...f.webs.map(async (u, i) => { const p = path.join(dir, `web_${String(i).padStart(3, "0")}.mp4`); await get(u, p); webs[i] = p; }),
    get(f.mix, mix),
  ]);
  timing.download = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  const mux = async (parts, out) => {
    const silent = out.replace(/\.mp4$/, "_silent.mp4");
    await concat(parts, silent);
    ffmpeg(["-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", out]);
    return out;
  };
  const final = await mux(segs, path.join(dir, "final.mp4")), web = await mux(webs, path.join(dir, "web.mp4"));
  const durationSec = +probeDuration(final).toFixed(3);
  const poster = path.join(dir, "poster.jpg");
  ffmpeg(["-ss", String(Math.min(1.5, durationSec / 2)), "-i", web, "-frames:v", "1", "-q:v", "3", poster]);
  timing.join = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  await put(f.out.final, final, "video/mp4");
  await put(f.out.web, web, "video/mp4");
  await put(f.out.poster, poster, "image/jpeg");
  timing.upload = +((Date.now() - t) / 1000).toFixed(2);
  return { role: "finish", durationSec, bytes: fs.statSync(final).size, webBytes: fs.statSync(web).size, timing };
}

/** one production job -> its RESULT (never throws); the worker's own done/failed event goes to the callback too */
export async function runJob(job, opts = {}) {
  const t0 = Date.now(), post = opts.post ?? poster(job);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bw-${job.role}-`));
  let result;
  try {
    const fn = { prepare, chunk, finish }[job.role];
    if (!fn) throw coded("BAD_JOB", `unknown role ${job.role}`);
    const r = await fn(job, dir, post, opts);
    result = { ok: true, ...r, host: process.env.RUNPOD_POD_ID ? `runpod ${process.env.RUNPOD_POD_ID}` : os.hostname(), totalS: +((Date.now() - t0) / 1000).toFixed(2) };
    await post("done", { output: result });
  } catch (e) {
    result = { ok: false, role: job.role, code: e.code ?? "RENDER_FAILED", error: String(e.message ?? e).slice(0, 1500), totalS: +((Date.now() - t0) / 1000).toFixed(2), ...(e.spend ? { spend: e.spend } : {}) };
    await post("failed", { code: result.code, message: result.error, ...(e.spend ? { spend: e.spend } : {}) });
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch { /* a temp folder never fails a job */ }
  }
  return result;
}

// ---------------------------------------------------------------- staging (runpod/dispatch.mjs), unchanged
async function staging(input) {
  const t0 = Date.now(), timing = {};
  const lap = (k, t) => { timing[k] = +((Date.now() - t) / 1000).toFixed(2); };
  let job = null, report = null;
  try {
    job = input.jobUrl ? JSON.parse(String(await get(input.jobUrl))) : input;
    if (job.crf) process.env.RENDER_CRF = String(job.crf);
    const mode = job.mode ?? "gpu", dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-"));
    let t = Date.now();
    const gl = await renderer(mode);
    lap("gpuCheck", t);
    t = Date.now();
    const tlPath = path.join(dir, "timeline.json");
    await get(job.timelineUrl, tlPath);
    lap("download", t);
    const chunks = [];
    t = Date.now();
    for (const [i, r] of (job.ranges ?? []).entries()) {
      const out = path.join(dir, `chunk${i}.mp4`);
      const res = await renderParallel({ timelinePath: tlPath, out, from: r.from, to: r.to, workers: job.pages ?? 1 });
      for (let crf = Number(job.crf ?? 20) + 4; fs.statSync(out).size > MAX_UPLOAD && crf <= 36; crf += 4) {
        const smaller = out.replace(/.mp4$/, `_crf${crf}.mp4`);
        execFileSync(FF, ["-v", "error", "-y", "-i", out, "-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-pix_fmt", "yuv420p", smaller]);
        fs.renameSync(smaller, out);
      }
      if (r.upload) await put(r.upload, out, "video/mp4");
      chunks.push({ from: r.from, to: r.to, frames: res.frames, msPerFrame: res.msPerFrame, loadS: res.loadS, bytes: fs.statSync(out).size });
    }
    if (job.whole) {
      const silent = path.join(dir, "silent.mp4"), mix = path.join(dir, "mix.m4a"), final = path.join(dir, "final.mp4");
      const res = await renderParallel({ timelinePath: tlPath, out: silent, workers: job.pages ?? 1 });
      await get(job.whole.mixUrl, mix);
      const p = spawnSync(FF, ["-v", "error", "-y", "-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final], { encoding: "utf8" });
      if (p.status !== 0) throw new Error(`mux failed: ${p.stderr.slice(-400)}`);
      if (job.whole.upload) await put(job.whole.upload, final, "video/mp4");
      chunks.push({ whole: true, frames: res.frames, msPerFrame: res.msPerFrame, loadS: res.loadS, bytes: fs.statSync(final).size });
    }
    lap("render", t);
    report = { ok: true, mode, renderer: gl, host: process.env.RUNPOD_POD_ID ? `runpod ${process.env.RUNPOD_POD_ID}` : os.hostname(), chunks, timing: { ...timing, total: +((Date.now() - t0) / 1000).toFixed(2) } };
  } catch (e) {
    report = { ok: false, code: e.code ?? "RENDER_FAILED", error: String(e.message).slice(0, 1500), timing: { ...timing, total: +((Date.now() - t0) / 1000).toFixed(2) } };
  }
  if (job?.uploads?.report) { const f = path.join(os.tmpdir(), "bw-report.json"); fs.writeFileSync(f, JSON.stringify(report)); await put(job.uploads.report, f, "application/json").catch(() => {}); }
  return report;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const input = process.argv[2] ? JSON.parse(process.argv[2]) : process.env.JOB_FILE ? JSON.parse(fs.readFileSync(process.env.JOB_FILE, "utf8")) : { jobUrl: process.env.JOB_URL };
  const result = input.job ? await runJob(input.job) : await staging(input);
  console.log(`RESULT ${JSON.stringify(result)}`);
  process.exit(result.ok ? 0 : 1);
}
