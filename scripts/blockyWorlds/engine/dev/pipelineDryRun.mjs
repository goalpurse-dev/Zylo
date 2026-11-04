// Blocky Worlds: the production pipeline, end to end, for FREE on this laptop (docs/blocky-worlds-pipeline.md).
// The real runtime (renderRuntime.js + render.js), the real worker roles (runpod/worker.mjs: prepare, chunk, finish) and
// real callbacks/webhooks over a local HTTP server; only RunPod, storage and the tables are stand-ins:
//   RunPod   -> each job is `node runpod/worker.mjs '{"job": ...}'` in a child process (mode "local": this laptop's GPU),
//               its RESULT posted back as RunPod's webhook
//   storage  -> files under the out folder; signed URLs are file:// URLs
//   tables   -> memory (dev/pipelineFakes.mjs), with the same guards as production
//   ElevenLabs -> never called: the run starts with the first paid test's take (out/paid1/voice.mp3 + take.json) in
//               storage and voice_ready set, exactly as a retried run would; ELEVENLABS_KEY is removed from the workers'
//               environment, so a bug can't buy a take.
// Renders 2 short chunks (48 frames = 2 s) so it takes a couple of minutes; the voice, the plan + its three checks, music
// A, the SFX and the mix are the full video's.
// Then the failure drills (a scripted RunPod, no render): a visual-check miss refunds before any render; NO_GPU retries
// on another worker; a chunk that keeps failing fails the run and refunds once; a duplicate callback is ignored.
//   node dev/pipelineDryRun.mjs [--frames 48] [--chunks 2] [--lines N] [--no-drills] [--drills-only] [--out out/pipeline-dry]
//   --lines N: the script's first N lines and the take cut to them (2026-11-05: the full Listener stops at the kit check,
//   a "ladder" on line 25 the kit can't build yet; --lines 24 runs the good path)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeRuntime } from "../../../../supabase/functions/_shared/blockyWorlds/renderRuntime.js";
import { costSummary, paths, RENDER } from "../../../../supabase/functions/_shared/blockyWorlds/render.js";
import { fileStorage, memoryDb, scriptedRunPod } from "./pipelineFakes.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const FRAMES = Number(arg("frames", 48)), CHUNKS = Number(arg("chunks", 2)), LINES = Number(arg("lines", 0)) || null;
const OUT = path.resolve(ENGINE, arg("out", `out/pipeline-dry/${new Date().toISOString().replace(/[:.]/g, "-")}`));
const PAID1 = path.join(ENGINE, "out", "paid1");
const SECRET = "dry-run-secret";
const say = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

/** RunPod: a child process per job; its RESULT comes back as the webhook */
function processRunPod(log) {
  const jobs = new Map();
  let n = 0;
  return {
    configured: true, jobs,
    async run({ input, webhook }) {
      const id = `local-${++n}-${input.job.role}${input.job.role === "chunk" ? input.job.chunk.index : ""}`;
      const env = { ...process.env }; delete env.ELEVENLABS_KEY;
      const t0 = Date.now(), child = spawn(process.execPath, [path.join(ENGINE, "runpod", "worker.mjs"), JSON.stringify(input)], { cwd: ENGINE, env, stdio: ["ignore", "pipe", "pipe"] });
      const rec = { id, child, status: "IN_PROGRESS", output: null, executionTime: 0, stdout: "" };
      jobs.set(id, rec);
      const logFile = path.join(log, `${id}.log`);
      child.stdout.on("data", (d) => { rec.stdout += d; fs.appendFileSync(logFile, d); });
      child.stderr.on("data", (d) => fs.appendFileSync(logFile, d));
      child.on("close", async (code) => {
        const line = rec.stdout.split(/\r?\n/).filter((l) => l.startsWith("RESULT ")).pop();
        rec.output = line ? JSON.parse(line.slice(7)) : { ok: false, code: "WORKER_CRASHED", error: `exit ${code}` };
        rec.executionTime = Date.now() - t0;
        rec.status = rec.status === "CANCELLED" ? "CANCELLED" : "COMPLETED";
        await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: rec.status, output: rec.output, executionTime: rec.executionTime, delayTime: 300 }) }).catch((e) => say(`webhook failed: ${e.message}`));
      });
      return { id };
    },
    async status(id) { const r = jobs.get(id); return r ? { id, status: r.status, output: r.output, executionTime: r.executionTime, delayTime: 300 } : null; },
    async cancel(id) { const r = jobs.get(id); if (r && r.status === "IN_PROGRESS") { r.status = "CANCELLED"; r.child.kill(); } },
  };
}

/** the callback server: worker events and webhooks -> runtime.handleCallback, as blocky-worlds-render does */
function callbackServer(getRuntime) {
  const srv = http.createServer((req, res) => {
    let b = "";
    req.on("data", (d) => (b += d));
    req.on("end", async () => {
      const url = new URL(req.url, "http://x");
      let r;
      try { r = await getRuntime().handleCallback({ query: Object.fromEntries(url.searchParams.entries()), body: JSON.parse(b || "{}") }); } catch (e) { r = { status: 500, body: { error: e.message } }; say(`callback error: ${e.stack}`); }
      res.writeHead(r.status, { "Content-Type": "application/json" }); res.end(JSON.stringify(r.body));
    });
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${srv.address().port}/functions/v1/blocky-worlds-render`, close: () => srv.close() })));
}

// ---------------------------------------------------------------- 1. the real run
async function realRun() {
  fs.mkdirSync(path.join(OUT, "logs"), { recursive: true });
  const { script, idea } = JSON.parse(fs.readFileSync(path.join(PAID1, "script.json"), "utf8"));
  const db = memoryDb(), storage = fileStorage(path.join(OUT, "store")), runpod = processRunPod(path.join(OUT, "logs"));
  // every status the page would see, as the runtime writes it (the prepare job is quicker than any poll)
  const T0 = Date.now(), seen = [{ status: "queued", atS: 0 }], updateRun = db.updateRun;
  db.updateRun = async (id, patch, guard) => { const r = await updateRun(id, patch, guard); if (r && r.status !== seen.at(-1).status) seen.push({ status: r.status, atS: +((Date.now() - T0) / 1000).toFixed(1) }); return r; };
  let rt;
  const cb = await callbackServer(() => rt);
  rt = makeRuntime({ db, storage, runpod, secret: SECRET, callbackUrl: cb.url, mode: "local", limitFrames: FRAMES, chunks: CHUNKS, log: (...a) => say("runtime:", ...a) });
  // the paid take (the first paid test's), whole or cut to its first --lines N lines (the same words, the same audio up
  // to the last of them): still the real narrator, still free
  let lines = script.lines, mp3 = fs.readFileSync(path.join(PAID1, "voice.mp3")), take = JSON.parse(fs.readFileSync(path.join(PAID1, "take.json"), "utf8"));
  if (LINES) {
    lines = script.lines.slice(0, LINES);
    const text = lines.map((l) => String(l.text).trim()).join("\n"), n = text.split(/\s+/).filter(Boolean).length;
    take = { ...take, text, spoken: take.spoken.slice(0, n), note: `the first ${LINES} lines of out/paid1/take.json (dry run)` };
    const cut = path.join(OUT, "voice_cut.mp3");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(PAID1, "voice.mp3"), "-t", (take.spoken.at(-1).e + 0.3).toFixed(3), "-c", "copy", cut]);
    mp3 = fs.readFileSync(cut);
  }
  // a charged run whose paid take is already in storage: no ElevenLabs call
  const run = db.addRun({ title: script.title, lines, card: idea, length_sec: LINES ? 60 : 120, voice_ready: true });
  const P = paths(run);
  storage.write(P.voiceMp3, mp3);
  storage.write(P.take, JSON.stringify(take));
  say(`run ${run.id}: charged ${run.credits_charged} credits; ${FRAMES} frames in ${CHUNKS} chunks; out ${OUT}`);
  const t0 = T0;
  await rt.start(run.id);
  let last = "";
  for (;;) {
    await new Promise((s) => setTimeout(s, 2000));
    await rt.sweep(); // the cron
    const r = await db.getRun(run.id);
    const jobs = await db.jobs(run.id);
    const line = `${r.status} ${r.pct}% | ${jobs.map((j) => `${j.role}${j.role === "chunk" ? j.idx : ""}#${j.attempt}:${j.state}${j.stage ? `/${j.stage}` : ""}`).join(" ")}`;
    if (line !== last) { say(line); last = line; }
    if (["done", "failed"].includes(r.status)) break;
    if (Date.now() - t0 > 20 * 60000) throw new Error("the dry run took over 20 minutes");
  }
  cb.close();
  const r = await db.getRun(run.id), jobs = await db.jobs(run.id);
  const result = { runId: run.id, status: r.status, error: r.error_code ? `${r.error_code}: ${r.error_message}` : null, refunded: Boolean(r.refunded_at), statuses: seen, wallS: +((Date.now() - t0) / 1000).toFixed(1), jobs: jobs.map((j) => ({ role: j.role, idx: j.idx, attempt: j.attempt, state: j.state, error: j.error_code, totalS: j.output?.totalS ?? null, timing: j.output?.timing ?? null })), ledger: costSummary(db.ledgerRows), files: r.files };
  if (r.status === "done") {
    for (const [k, p] of [["final", P.final], ["web", P.webFinal], ["poster", P.poster]]) fs.copyFileSync(storage.file(p), path.join(OUT, path.basename(p)));
    const probe = (f) => execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,duration", "-of", "compact=p=0", f]).toString().trim().split(/\r?\n/);
    result.final = { file: path.join(OUT, "final.mp4"), streams: probe(path.join(OUT, "final.mp4")), webStreams: probe(path.join(OUT, "web.mp4")) };
    result.chunksLeft = fs.existsSync(storage.file(P.seg(0, 1)));
  }
  fs.writeFileSync(path.join(OUT, "dry-run.json"), JSON.stringify(result, null, 1));
  return result;
}

// ---------------------------------------------------------------- 2. the failure drills (scripted RunPod, no render)
async function drills() {
  const out = [];
  const T = { now: Date.now() };
  const setup = () => {
    const db = memoryDb({ now: () => T.now }), storage = fileStorage(path.join(OUT, "drills", String(out.length))), runpod = scriptedRunPod();
    const rt = makeRuntime({ db, storage, runpod, secret: SECRET, callbackUrl: "https://drill.test/cb", now: () => T.now, log: () => {} });
    const run = db.addRun({ lines: [{ part: "rule", text: "In this town, a drill." }] });
    const P = paths(run);
    const hook = (s, status, output, extra = {}) => rt.handleCallback({ query: runpod.query(s), body: { id: s.id, status, output, executionTime: 40000, delayTime: 5000, ...extra } });
    const ev = (s, event, data = {}) => rt.handleCallback({ body: { runId: s.job.runId, jobId: s.job.jobId, token: s.job.callback.token, event, ...data } });
    const planned = async (s) => {
      storage.write(P.visualCheck, JSON.stringify({ passed: true, timeline: [], missing: [], subjects: [] }));
      storage.write(P.timeline, JSON.stringify({ duration: 20, fps: 24, shots: [{ start: 0, end: 20, set: "street", light: "day", camera: "wide" }] }));
      await ev(s, "planned", {});
    };
    return { db, storage, runpod, rt, run, P, hook, ev, planned, state: async () => db.getRun(run.id) };
  };
  const report = (name, ok, detail) => { out.push({ drill: name, ok, ...detail }); say(`${ok ? "PASS" : "FAIL"} drill: ${name} ${JSON.stringify(detail)}`); };

  { // a. the visual check misses: refunded before any render
    const d = setup();
    await d.rt.start(d.run.id);
    const prep = d.runpod.last("prepare");
    await d.ev(prep, "failed", { code: "VISUAL_CHECK", message: "#12 piano" });
    await d.hook(prep, "COMPLETED", { ok: false, code: "VISUAL_CHECK" });
    const r = await d.state();
    report("visual-check miss refunds before render", r.status === "failed" && r.error_code === "VISUAL_CHECK" && d.db.refunds.length === 1 && d.runpod.sent.every((s) => s.job.role === "prepare"), { status: r.status, code: r.error_code, refunds: d.db.refunds.length, jobsSent: d.runpod.sent.map((s) => s.job.role) });
  }
  { // b. NO_GPU on a chunk: retried on another worker after the wait
    const d = setup();
    await d.rt.start(d.run.id);
    await d.planned(d.runpod.last("prepare"));
    const c0 = d.runpod.last("chunk", 0);
    await d.hook(c0, "COMPLETED", { ok: false, code: "NO_GPU", refresh_worker: true });
    const before = d.runpod.sent.length;
    T.now += (RENDER.noGpuDelaySec + 1) * 1000;
    await d.rt.sweep();
    const c0b = d.runpod.last("chunk", 0);
    report("NO_GPU chunk retries on another worker", c0b.job.attempt === 2 && d.runpod.sent.length === before + 1 && (await d.state()).status === "render", { firstTry: c0.id, retry: c0b.id, attempt: c0b.job.attempt, waitedS: RENDER.noGpuDelaySec });
  }
  { // c. a chunk that keeps failing: the run fails, the rest is cancelled, one refund
    const d = setup();
    await d.rt.start(d.run.id);
    await d.planned(d.runpod.last("prepare"));
    for (let a = 1; a <= RENDER.attempts.chunk; a++) await d.hook(d.runpod.last("chunk", 0), "FAILED", null, { error: JSON.stringify({ code: "RENDER_FAILED", error: "page crashed" }) });
    await d.hook(d.runpod.last("chunk", 0), "FAILED", null, { error: "late duplicate" });
    const r = await d.state();
    report("a chunk that keeps failing fails the run and refunds once", r.status === "failed" && r.error_code === "CHUNK_FAILED" && d.db.refunds.length === 1 && d.runpod.cancelled.length > 0, { status: r.status, code: r.error_code, tries: d.runpod.sent.filter((s) => s.job.role === "chunk" && s.job.chunk.index === 0).length, refunds: d.db.refunds.length, cancelled: d.runpod.cancelled.length });
  }
  { // d. duplicate callbacks and webhooks are ignored
    const d = setup();
    await d.rt.start(d.run.id);
    const prep = d.runpod.last("prepare");
    await d.ev(prep, "voiced", { costUsd: 0.16 });
    await d.ev(prep, "voiced", { costUsd: 0.16 });
    await d.planned(prep); await d.planned(prep);
    d.storage.write(d.P.mix, "m");
    await d.hook(prep, "COMPLETED", { ok: true });
    for (const s of d.runpod.sent.filter((x) => x.job.role === "chunk")) for (let k = 0; k < 3; k++) await d.hook(s, "COMPLETED", { ok: true });
    const fin = d.runpod.last("finish");
    for (let k = 0; k < 2; k++) { await d.ev(fin, "done", { output: { ok: true, durationSec: 20 } }); await d.hook(fin, "COMPLETED", { ok: true }); }
    const r = await d.state(), refs = d.db.ledgerRows.map((l) => l.ref);
    const chunks = d.runpod.sent.filter((s) => s.job.role === "chunk").length, finishes = d.runpod.sent.filter((s) => s.job.role === "finish").length;
    report("duplicate callbacks are ignored", r.status === "done" && finishes === 1 && chunks === r.render.chunks.length && new Set(refs).size === refs.length && costSummary(d.db.ledgerRows).byStage.voice === 0.16, { status: r.status, chunksSent: chunks, finishesSent: finishes, ledgerRows: refs.length, voiceUsd: costSummary(d.db.ledgerRows).byStage.voice });
  }
  fs.writeFileSync(path.join(OUT, "drills.json"), JSON.stringify(out, null, 1));
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
let failed = false;
if (!argv.includes("--drills-only")) {
  const r = await realRun();
  say(`REAL RUN: ${r.status} in ${r.wallS} s; statuses ${r.statuses.map((s) => `${s.status}@${s.atS}s`).join(" -> ")}`);
  for (const j of r.jobs) say(`  ${j.role}${j.role === "chunk" ? ` ${j.idx}` : ""} try ${j.attempt}: ${j.state}${j.error ? ` ${j.error}` : ""} ${j.totalS ?? "?"} s ${JSON.stringify(j.timing)}`);
  say(`  ledger ${JSON.stringify(r.ledger)}`);
  if (r.final) say(`  final ${r.final.file}: ${r.final.streams.join(" | ")}; web: ${r.final.webStreams.join(" | ")}; chunk files left: ${r.chunksLeft}`);
  if (r.status !== "done") { failed = true; say(`  error: ${r.error}`); }
}
if (!argv.includes("--no-drills")) failed = (await drills()).some((d) => !d.ok) || failed;
say(failed ? "DRY RUN: something failed (see above)" : "DRY RUN: all good");
process.exit(failed ? 1 : 0);
