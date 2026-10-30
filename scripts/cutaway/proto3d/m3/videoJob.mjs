// M3: one production Cutaway job, on the RunPod GPU or a Fly CPU machine. The job comes from the server
// (supabase/functions/_shared/cutaway/jobs.js); it carries signed URLs only, never a key. Roles:
//   video  the whole video on the GPU: the plan (script, facts, scene, voice and its word check, the preview gate), the
//          render, the mix, the uploads
//   plan   the CPU fallback's first machine: the plan only (the GPU job's plan, when it got that far, is reused instead)
//   chunk  one frame range of the video on a CPU machine (SwiftShader), uploaded as a segment
//   mix    the CPU fallback's last machine: the segments joined, then the sound, captions and copies, uploaded
// A plan already made (a retry, the fallback) is downloaded, never paid for again. Progress, the finished plan and the end
// go to the callback (cutaway-callback) with the job's token; a callback that can't be reached never fails the job.
//   node m3/videoJob.mjs '<input json>'         (RunPod: handler.py passes the job input)
//   CUTAWAY_JOB='<job json>' node m3/videoJob.mjs (Fly: the machine's env)
// Keys: ANTHROPIC_API_KEY and ELEVENLABS_KEY from the environment (RunPod secrets / the Fly machine's env).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runTopic } from "../m2/run.mjs";
import { makeVideo, preparePage } from "../m2/make.mjs";
import { compile } from "../m2/compile.mjs";
import { callJSON, loadKey, MODEL } from "../m2/llm.mjs";
import { speechEnd } from "../speechEnd.mjs";
import { useGpu, useSoftware } from "./gpu.mjs";
import { setRunCap } from "../m2/budget.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROTO = process.env.CUTAWAY_PROTO ?? "/app/proto", FF = process.env.FFMPEG ?? "ffmpeg", FPS = 30;
const LAYOUTS = path.resolve(here, "../m2/layouts");
// the RunPod 16 GB tier, per second (pricing.js RUNTIME_RATES.runpodUsdPerSec)
const GPU_USD_PER_SEC = 0.00016;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the job's files ----------
// (file:// URLs work too: the local test of the fallback roles)
export async function get(url, file) {
  if (url.startsWith("file://")) { const b = fs.readFileSync(fileURLToPath(url)); if (file) fs.writeFileSync(file, b); return b; }
  for (let i = 0; ; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`download ${r.status}`); const b = Buffer.from(await r.arrayBuffer()); if (file) fs.writeFileSync(file, b); return b; } catch (e) { if (i >= 2) throw e; await sleep(1500 * (i + 1)); }
  }
}
export async function put(url, file, type) {
  if (url.startsWith("file://")) { const to = fileURLToPath(url); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(file, to); return; }
  for (let i = 0; ; i++) {
    try { const r = await fetch(url, { method: "PUT", headers: { "Content-Type": type, "x-upsert": "true" }, body: fs.readFileSync(file), signal: AbortSignal.timeout(300000) }); if (!r.ok) throw new Error(`upload ${path.basename(file)} ${r.status} ${(await r.text()).slice(0, 200)}`); return; } catch (e) { if (i >= 2) throw e; await sleep(2000 * (i + 1)); }
  }
}

/** a failure's code and whether a second try could help (the server refunds the rest at once) */
export function classify(e) {
  const msg = String(e?.message ?? e);
  if (e?.code === "NO_GPU") return { code: "NO_GPU", retryable: true };
  if (/voice check failed twice/i.test(msg)) return { code: "VOICE_FAILED", retryable: false };
  if (e?.code === "BUDGET" || /over the run's \$/.test(msg)) return { code: "BUDGET", retryable: false };
  if (/credit balance|insufficient.?(credit|fund|quota)|quota_exceeded|payment required|\b402\b/i.test(msg)) return { code: "PROVIDER_BALANCE", retryable: false };
  if (/overloaded|\b529\b|\b503\b|rate.?limit|\b429\b/i.test(msg)) return { code: "PROVIDER_BUSY", retryable: true };
  return { code: e?.code ?? "RENDER_FAILED", retryable: true };
}

// the stages the page shows, from the pipeline's progress events (contract.js statusOfStage)
function stageOf(p) {
  if (p.stage === "scene") return /voice/.test(p.step ?? "") ? "voice" : /preview|vision|repair/.test(p.step ?? "") ? "preview" : "scene";
  if (["timeline", "render"].includes(p.stage)) return "render";
  return p.stage;
}
const pretty = (id) => id.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

const POST_SCHEMA = { type: "object", additionalProperties: false, required: ["title", "description", "hashtags"], properties: { title: { type: "string" }, description: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } } };
/** the copy-ready post text (Haiku: it passed the post-text checks on every test script, at 1/20 the price) */
export async function postFor(script) {
  const r = await callJSON({ apiKey: loadKey(), model: MODEL.small, label: "post text", effort: "low", maxTokens: 3000, schema: POST_SCHEMA,
    system: "You write the post text for a short vertical 3D explainer video on TikTok, YouTube Shorts and Reels: a title under 60 characters with one emoji at the end, a 1-2 sentence description that teases the most surprising fact, and 8 lowercase hashtags (each starting with #, always including #howitworks, #3danimation, #explained and #shorts).",
    user: `Title: ${script.title}\nNarration: ${script.sentences.map((s) => s.text).join(" ")}` });
  return { post: r.data, costUsd: r.costUsd };
}

/** the frames of a planned video (with or without its end card): what the CPU fallback splits into chunks */
export function framesOf({ layout, words, voice, roles }, version = "end") {
  const tl = compile(layout, words, speechEnd(FF, voice), { roles });
  return { frames: Math.round((version === "noend" ? tl.marks.lengthNoEnd : tl.marks.lengthEnd) * FPS), tl };
}

async function main() {
  // (CUTAWAY_JOB_FILE: the free harness's job, too long for a Windows command line)
  const input = process.argv[2] ? JSON.parse(process.argv[2]) : process.env.CUTAWAY_JOB_FILE ? JSON.parse(fs.readFileSync(process.env.CUTAWAY_JOB_FILE, "utf8")) : JSON.parse(process.env.CUTAWAY_JOB ?? "{}");
  const job = input.job ?? input, role = job.role ?? "video", mode = job.mode ?? (role === "video" ? "gpu" : "cpu");
  // the run's spending limit (budget.mjs): every paid call checks it before it is sent
  if (job.capUsd) setRunCap(job.capUsd);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cutaway-")), out = path.join(dir, "run");
  const version = job.endCard === false ? "noend" : "end", t0 = Date.now(), costs = { planUsd: 0, voiceUsd: 0, checksUsd: 0, postUsd: 0 };
  fs.mkdirSync(out, { recursive: true });
  // every paid call of this job, one line each (m2 llm.mjs and voice.mjs write it): what a failed job reports as spent
  const spendLog = path.join(dir, "spend.jsonl");
  const spentSoFar = () => {
    const s = { planUsd: 0, voiceUsd: 0, checksUsd: 0 };
    try { for (const l of fs.readFileSync(spendLog, "utf8").split("\n").filter(Boolean)) { const r = JSON.parse(l), u = Number(r.costUsd) || 0; if (/voice/.test(r.label)) s.voiceUsd += u; else if (/vision|preview/.test(r.label)) s.checksUsd += u; else s.planUsd += u; } } catch { /* nothing spent yet */ }
    return s;
  };

  // ---------- the callback ----------
  let lastTell = 0, lastStage = null, queue = Promise.resolve();
  // one at a time, in order: sent side by side, the "scene" event (with the narration) landed after the "voice" one, so a
  // voice failure showed "Scene plan" as its step (the production Landfill of 2026-10-27)
  // each cost is reported once: an event carries only what was not sent before (the server adds every event's costs to
  // the ledger, and "planned" then "done" with the same totals counted a finished video twice; the real traffic light
  // run of 2026-10-28 cost $0.518 and was booked at $1.036)
  const sent = {};
  const fresh = (costs) => {
    if (!costs) return costs;
    const out = {};
    for (const [k, v] of Object.entries(costs)) { const d = +((Number(v) || 0) - (sent[k] ?? 0)).toFixed(6); if (d > 0) { out[k] = d; sent[k] = (sent[k] ?? 0) + d; } }
    return out;
  };
  const tell = (event, data = {}) => (queue = queue.then(() => send(event, data.costs ? { ...data, costs: fresh(data.costs) } : data)));
  const send = async (event, data) => {
    if (!job.callback?.url) { console.log(`EVENT ${event} ${JSON.stringify(data).slice(0, 300)}`); return; }
    const body = JSON.stringify({ runId: job.runId, token: job.callback.token, role, attempt: job.attempt ?? 1, event, ...data });
    for (let i = 0; i < 4; i++) {
      try { const r = await fetch(job.callback.url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(15000) }); await r.body?.cancel(); if (r.ok || r.status < 500) return; } catch { /* try again */ }
      await sleep(1000 * 2 ** i);
    }
  };
  const progress = (p) => {
    if (p.stage === "failed") return;
    const stage = stageOf(p), now = Date.now(), extra = {};
    if (p.title) extra.title = p.title;
    if (p.narration) extra.narration = p.narration;
    if (p.facts) extra.facts = p.facts;
    if (p.parts) extra.parts = p.parts.map(pretty);
    const pct = stage === "render" && Number.isFinite(p.frames) ? Math.min(99, Math.round((p.frame / p.frames) * 100)) : undefined;
    if (stage === lastStage && !Object.keys(extra).length && now - lastTell < 3000) return;
    lastStage = stage; lastTell = now;
    tell("progress", { stage, ...(pct !== undefined ? { pct } : {}), ...extra });
  };
  const beat = setInterval(() => tell("heartbeat"), 20000);

  // ---------- the plan's files: uploaded once made, downloaded when given ----------
  const planFiles = { layout: "layout.json", script: "script.json", words: "words.json", voice: "voice.mp3", post: "post.json" };
  const savePlan = async (ready, post) => {
    const p = path.join(dir, "plan"); fs.mkdirSync(p, { recursive: true });
    fs.writeFileSync(path.join(p, "layout.json"), JSON.stringify(ready.layout)); fs.writeFileSync(path.join(p, "script.json"), JSON.stringify({ ...ready.script, roles: ready.roles }));
    fs.writeFileSync(path.join(p, "words.json"), JSON.stringify(ready.words)); fs.copyFileSync(ready.voice, path.join(p, "voice.mp3"));
    fs.writeFileSync(path.join(p, "post.json"), JSON.stringify(post ?? null));
    for (const [k, f] of Object.entries(planFiles)) if (job.plan?.put?.[k]) await put(job.plan.put[k], path.join(p, f), f.endsWith(".mp3") ? "audio/mpeg" : "application/json");
  };
  // a plan that didn't pass: what the planner left in its folder goes to the run's plan files (never read back for a render)
  const keepFailedPlan = async () => {
    const read = (f) => (fs.existsSync(path.join(out, f)) ? JSON.parse(fs.readFileSync(path.join(out, f), "utf8")) : null);
    // (the preview check's verdicts too: the Landfill of 2026-10-27 failed the gate and its verdicts were lost)
    const layout = read("layout.json"), script = read("script.json"), trace = read("trace.json"), report = read("plan_report.json"), vision = read("vision.json");
    const p = path.join(dir, "failed"); fs.mkdirSync(p, { recursive: true });
    if (layout && job.plan?.put?.layout) { fs.writeFileSync(path.join(p, "layout.json"), JSON.stringify(layout)); await put(job.plan.put.layout, path.join(p, "layout.json"), "application/json"); }
    // (the spend log call by call, so the owner can see what each step cost; and the latest voice take with its words, so a
    // stopped run can be resumed without paying for them again: the swimming pool of 2026-10-29 kept nothing)
    const spend = fs.existsSync(spendLog) ? fs.readFileSync(spendLog, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
    if (script && job.plan?.put?.script) { fs.writeFileSync(path.join(p, "script.json"), JSON.stringify({ ...script, failed: true, trace, report, vision, spend })); await put(job.plan.put.script, path.join(p, "script.json"), "application/json"); }
    // the paid planner replies (each step's saved reply): a retry replays them free, and the failure becomes a free test
    // case even when the planner stopped before its script was made (m3/failureCase.mjs)
    const sd = path.join(out, "steps");
    if (job.plan?.put?.steps && fs.existsSync(sd)) {
      const files = Object.fromEntries(fs.readdirSync(sd).filter((f) => /^step_\d+_.*\.json$/.test(f)).map((f) => [f, JSON.parse(fs.readFileSync(path.join(sd, f), "utf8"))]));
      if (Object.keys(files).length) { fs.writeFileSync(path.join(p, "steps.json"), JSON.stringify({ files })); await put(job.plan.put.steps, path.join(p, "steps.json"), "application/json"); }
    }
    const vdir = fs.existsSync(out) ? fs.readdirSync(out).filter((d) => /^voice(_r\d+)?$/.test(d)).sort().at(-1) : null;
    if (vdir && fs.existsSync(path.join(out, vdir, "voice.mp3"))) {
      if (job.plan?.put?.voice) await put(job.plan.put.voice, path.join(out, vdir, "voice.mp3"), "audio/mpeg");
      if (job.plan?.put?.words && fs.existsSync(path.join(out, vdir, "voice.words.json"))) await put(job.plan.put.words, path.join(out, vdir, "voice.words.json"), "application/json");
    }
  };
  const loadPlan = async () => {
    const p = path.join(dir, "plan"); fs.mkdirSync(p, { recursive: true });
    for (const [k, f] of Object.entries(planFiles)) if (job.plan.get[k]) await get(job.plan.get[k], path.join(p, f));
    const read = (f) => JSON.parse(fs.readFileSync(path.join(p, f), "utf8"));
    const script = read("script.json");
    return { layout: read("layout.json"), script, roles: script.roles ?? script.sentences.map((s) => s.role), words: read("words.json"), voice: path.join(p, "voice.mp3"), post: fs.existsSync(path.join(p, "post.json")) ? read("post.json") : null };
  };
  // the preview frames the page shows while the video renders (up to 8, small)
  const sendFrames = async () => {
    const src = path.join(out, "preview"), urls = job.out?.frames ?? [];
    if (!fs.existsSync(src) || !urls.length) return 0;
    const pngs = fs.readdirSync(src).filter((f) => f.endsWith(".png")).sort();
    const pick = pngs.filter((_, i) => i % Math.max(1, Math.ceil(pngs.length / urls.length)) === 0).slice(0, urls.length);
    for (const [i, f] of pick.entries()) { const jpg = path.join(dir, `frame_${i}.jpg`); execFileSync(FF, ["-v", "error", "-y", "-i", path.join(src, f), "-vf", "scale=360:-1", "-q:v", "5", jpg]); await put(urls[i], jpg, "image/jpeg"); }
    return pick.length;
  };

  // ---------- the finished video: the delivered copy, the web copy, the poster ----------
  const deliver = async (made, ready) => {
    const src = made.files[version] ?? made.files.end, final = path.join(dir, "final.mp4"), poster = path.join(dir, "poster.jpg");
    execFileSync(FF, ["-v", "error", "-y", "-i", src, "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "copy", "-movflags", "+faststart", final]);
    const len = Number(execFileSync(FF.replace(/ffmpeg(\.exe)?$/, (m) => m.replace("ffmpeg", "ffprobe")), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", final], { encoding: "utf8" }).trim()) || 30;
    execFileSync(FF, ["-v", "error", "-y", "-ss", String(Math.max(0, len - 2.5)), "-i", final, "-frames:v", "1", "-vf", "scale=720:-1", "-q:v", "3", poster]);
    if (job.out?.final) await put(job.out.final, final, "video/mp4");
    if (job.out?.web) await put(job.out.web, made.files.web, "video/mp4");
    if (job.out?.poster) await put(job.out.poster, poster, "image/jpeg");
    return { durationSec: +len.toFixed(2), sizes: { final: fs.statSync(final).size, web: fs.statSync(made.files.web).size } };
  };

  try {
    // (mode "local": this laptop's own GPU, for the local test of the roles)
    const renderer = mode === "local" ? "local" : role === "video" && mode === "gpu" ? await useGpu() : role === "plan" ? "none" : useSoftware();
    tell("progress", { stage: job.plan?.get ? "render" : "script", renderer });

    if (role === "video" || role === "plan") {
      let ready, post;
      if (job.plan?.get) ({ post, ...ready } = await loadPlan());
      else {
        // an approved layout for this topic: the worker's layouts folder gets it, the planner reuses it
        let reuse = null;
        // a retry: the earlier attempt's paid planner replies go where the planner looks first (its step cache), so the
        // plan is replayed free in seconds; a missing or unreadable bundle just means planning again
        if (job.plan?.resume) {
          try {
            const { files } = JSON.parse((await get(job.plan.resume)).toString("utf8")), sd = path.join(out, "steps");
            fs.mkdirSync(sd, { recursive: true });
            for (const [f, r] of Object.entries(files ?? {})) if (/^step_\d+_[\w-]+\.json$/.test(f)) fs.writeFileSync(path.join(sd, f), JSON.stringify(r));
            console.log(`[cutaway] retry: ${Object.keys(files ?? {}).length} paid planner replies replayed from the earlier attempt`);
          } catch (e) { console.error("[cutaway] retry: no earlier replies to replay:", e?.message ?? e); }
        }
        if (job.layout) { fs.mkdirSync(LAYOUTS, { recursive: true }); fs.writeFileSync(path.join(LAYOUTS, `${job.layout.key}.template.json`), JSON.stringify({ ...job.layout, template: true, approved: true })); reuse = job.layout.key; }
        const r = await runTopic({ library: Array.isArray(job.library) ? job.library : [], topic: job.topic, out, proto: PROTO, ff: FF, lengthSec: job.lengthSec, reuse, endCard: job.endCard !== false, openings: null, onProgress: progress, render: false, log: spendLog, maxUsd: Number(job.capUsd) || Infinity });
        if (!r.ok) {
          // the refused plan is kept (its layout, and its script with the planner's trace), so it can be replayed free
          await keepFailedPlan().catch((e) => console.error("[cutaway] the failed plan was not kept:", e?.message ?? e));
          const failedGate = Array.isArray(r.vision?.failing) && r.vision.failing.length;
          throw Object.assign(new Error(failedGate ? `the preview check blocked it: ${r.vision.failing.join(", ")}` : `the plan did not pass: ${(r.problems ?? []).join("; ").slice(0, 500)}`), { code: failedGate ? "GATE_FAILED" : "PLAN_FAILED", retryable: false, costs: { planUsd: r.planUsd ?? 0, voiceUsd: r.voiceUsd ?? 0, checksUsd: r.checksUsd ?? 0 } });
        }
        ready = r.ready; Object.assign(costs, r.ready.costs);
        const p = await postFor(ready.script); post = p.post; costs.postUsd = p.costUsd;
        await savePlan(ready, post);
        const frames = await sendFrames();
        const fv = framesOf(ready, version);
        await tell("planned", { costs, frames: fv.frames, previewFrames: frames, title: ready.script.title, narration: ready.script.sentences.map((s) => s.text).join(" "), facts: ready.script.facts ?? [], parts: ready.layout.parts.map((q) => pretty(q.id)), post, key: ready.layout.key });
      }
      if (role === "plan") { clearInterval(beat); return { ok: true }; }
      // the render, the sound, the copies (the GPU job, or a GPU retry of a plan already made)
      tell("progress", { stage: "render", pct: 0 });
      const made = await makeVideo({ layout: ready.layout, voice: ready.voice, words: ready.words, out: path.join(dir, "made"), proto: PROTO, ff: FF, roles: ready.roles, onProgress: progress, only: version });
      tell("progress", { stage: "upload", pct: 99 });
      const files = await deliver(made, ready);
      clearInterval(beat);
      await tell("done", { costs, renderer, files, seconds: +((Date.now() - t0) / 1000).toFixed(1) });
      return { ok: true };
    }

    const ready = await loadPlan();
    if (role === "chunk") {
      const { tl } = framesOf(ready, version);
      const layout = { ...ready.layout, key: `${ready.layout.key}_c${job.chunk.index}`.slice(0, 60) };
      preparePage({ layout, tl, proto: PROTO });
      const seg = path.join(dir, `seg_${job.chunk.index}.mp4`), len = version === "noend" ? tl.marks.lengthNoEnd : tl.marks.lengthEnd;
      await new Promise((res, rej) => {
        const p = spawn(process.execPath, [path.join(PROTO, "render.mjs"), FF, seg, String(len), String(FPS)], { cwd: PROTO, env: { ...process.env, PAGE: `m2_${layout.key}.html${version === "noend" ? "?endcard=0" : ""}`, FRAME_FROM: String(job.chunk.from), FRAME_TO: String(job.chunk.to) }, stdio: ["ignore", "pipe", "pipe"] });
        let err = ""; p.stderr.on("data", (d) => { err += d; });
        p.stdout.on("data", (d) => { const m = /frame (\d+)\//.exec(String(d)); if (m) tell("heartbeat", { chunk: job.chunk.index, frame: Number(m[1]) }); });
        p.on("close", (c) => (c === 0 ? res() : rej(new Error(`chunk ${job.chunk.index} render failed: ${err.slice(-400)}`))));
      });
      await put(job.out.segment, seg, "video/mp4");
      clearInterval(beat);
      await tell("chunk", { index: job.chunk.index, seconds: +((Date.now() - t0) / 1000).toFixed(1) });
      return { ok: true };
    }

    if (role === "mix") {
      const list = path.join(dir, "segments.txt"), parts = [];
      for (const [i, u] of job.segments.entries()) { const f = path.join(dir, `seg_${i}.mp4`); await get(u, f); parts.push(`file '${f.replace(/\\/g, "/")}'`); }
      fs.writeFileSync(list, parts.join("\n"));
      const joined = path.join(dir, `silent_${version}.mp4`);
      execFileSync(FF, ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", joined]);
      tell("progress", { stage: "sound", pct: 99 });
      const made = await makeVideo({ layout: ready.layout, voice: ready.voice, words: ready.words, out: path.join(dir, "made"), proto: PROTO, ff: FF, roles: ready.roles, only: version, silent: { [version]: joined } });
      const files = await deliver(made, ready);
      clearInterval(beat);
      await tell("done", { costs: {}, renderer: "SwiftShader (CPU, split)", files, seconds: +((Date.now() - t0) / 1000).toFixed(1) });
      return { ok: true };
    }
    throw new Error(`unknown role ${role}`);
  } catch (e) {
    clearInterval(beat);
    // (whatever the stop, what was made is kept: a thrown cap or crash used to keep nothing)
    if (role === "video" || role === "plan") await keepFailedPlan().catch((x) => console.error("[cutaway] the failed plan was not kept:", x?.message ?? x));
    const c = e.retryable === false ? { code: e.code ?? "RENDER_FAILED", retryable: false } : classify(e);
    Object.assign(costs, e.costs ?? {});
    // what this attempt spent, from its own log when the error didn't carry it (a crash, the voice check), and its GPU time
    const logged = spentSoFar();
    for (const k of Object.keys(logged)) costs[k] = Math.max(Number(costs[k]) || 0, +logged[k].toFixed(5));
    if (mode === "gpu") costs.gpuUsd = +(((Date.now() - t0) / 1000) * GPU_USD_PER_SEC).toFixed(5);
    // the step it failed in, for the owner's Details
    const stage = c.code === "VOICE_FAILED" ? "voice" : c.code === "GATE_FAILED" ? "preview" : lastStage;
    await tell("failed", { code: c.code, retryable: c.retryable, message: String(e.message ?? e).slice(0, 3500), costs, ...(stage ? { stage } : {}) });
    return { ok: false, code: c.code, error: String(e.message ?? e).slice(0, 1500) };
  }
}

if (/videoJob\.mjs$/.test(process.argv[1] ?? "")) {
  const r = await main();
  console.log(`RESULT ${JSON.stringify(r)}`);
  process.exit(r.ok ? 0 : 1);
}
