// M3: the free end-to-end harness (the owner's rule of 2026-10-27: test the whole pipeline for free before any paid
// run). One case = one video, through the production code path:
//   the server's start checks (topic, kit check, caps, price; the shared modules cutaway-api uses) -> the job, as
//   jobFor builds it -> the worker (m3/videoJob.mjs) run FROM THE IMAGE'S BUILD CONTEXT (the files the image ships, so
//   a file the image lacks fails here too) -> its callbacks, posted to a local server and applied with the server's own
//   rules (orchestrate.js onEvent: retries, refunds, the ledger, done) -> the delivered files -> a frame sheet: each
//   sentence beside its frame of the finished video.
// The paid providers are replaced (m2/providers.mjs, CUTAWAY_PROVIDERS=replay): recorded or written answers, a free local
// voice, and every paid host blocked. Differences from production: the laptop's GPU and Chrome instead of RunPod's,
// Windows instead of Linux, a local voice instead of ElevenLabs (unless a recorded take is given).
//   node m3/harness.mjs --case NAME --topic "Landfill" [--length 30] --ctx BUILD_CONTEXT --proto RENDER_FOLDER
//        --root CASES_DIR [--ff FFMPEG] [--python PYTHON]
// Exit: 0 done, 1 failed (refunded), 2 waiting for answers (requests/ has the ones without answers/), 3 harness error.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
const CASE = a.case, TOPIC = a.topic, LENGTH = Number(a.length ?? 30), CTX = path.resolve(a.ctx), PROTO = path.resolve(a.proto);
const FF = a.ff ?? "C:/Users/Huhta/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe";
const PY = a.python ?? "C:/Users/Huhta/AppData/Local/Programs/Python/Python312/python.exe";
const DIR = path.resolve(a.root, CASE), WT = path.join(CTX, "wt"), SH = path.join(WT, "supabase/functions/_shared/cutaway"), M2 = path.join(WT, "scripts/cutaway/proto3d/m2");
const url = (f) => pathToFileURL(f).href;
for (const d of ["answers", "requests", "plan", "out", "frames", "sheet"]) fs.mkdirSync(path.join(DIR, d), { recursive: true });
// each run of a case starts clean (what it would have cost, its events): the answers and requests stay
for (const f of ["spend.jsonl", "events.jsonl", "harness.log"]) fs.rmSync(path.join(DIR, f), { force: true });
// --real: the PAID confirmation run (the owner's go only): the real providers, the same code path; otherwise this
// process answers the server's own kit check from the same replay folder, behind the same paid-host guard
const REAL = a.real === true;
if (!REAL) { process.env.CUTAWAY_PROVIDERS = "replay"; process.env.CUTAWAY_REPLAY_DIR = DIR; }
// --real-vision: the frames judged by the real checker (a few cents a video, the owner's rule of 2026-10-30), planning
// and voice still free stand-ins; --vision-cap dollars for the whole batch (its ledger: --ledger, shared by every case);
// --skip-repairs: straight from the first check to the salvage (the batch's lower bound, within the cap)
if (!REAL && a["real-vision"]) {
  process.env.CUTAWAY_REAL_VISION = "1";
  process.env.CUTAWAY_REAL_VISION_CAP = String(Number(a["vision-cap"] ?? 1));
  process.env.CUTAWAY_REAL_VISION_LEDGER = path.resolve(a.ledger ?? path.join(a.root, "real_vision_ledger.json"));
}
if (a["skip-repairs"]) process.env.CUTAWAY_SKIP_REPAIRS = "1";
const { replayLLM } = REAL ? { replayLLM: () => { throw Object.assign(new Error("a real kit check is not run by the harness"), { code: "REPLAY_PENDING" }); } } : await import(url(path.join(M2, "providers.mjs")));
const { topicProblem, decide, DEFAULT_SETTINGS } = await import(url(path.join(SH, "guard.js")));
const { quoteTopic } = await import(url(path.join(SH, "quote.js")));
const { jobFor } = await import(url(path.join(SH, "jobs.js")));
const { onEvent } = await import(url(path.join(SH, "orchestrate.js")));
const { fullCostUsd } = await import(url(path.join(SH, "pricing.js")));
const { KIT_SYSTEM, KIT_SCHEMA } = await import(url(path.join(SH, "kitCheck.js")));
const log = (m) => { console.log(`[${CASE}] ${m}`); fs.appendFileSync(path.join(DIR, "harness.log"), `${new Date().toISOString()} ${m}\n`); };
const result = (r) => { fs.writeFileSync(path.join(DIR, "result.json"), JSON.stringify({ case: CASE, topic: TOPIC, lengthSec: LENGTH, at: new Date().toISOString(), ...r }, null, 1)); return r; };
const APPROVED = ["landfill", "french_drain", "car_wash"];

// ---------- the server's start checks (cutaway-api "start") ----------
const bad = topicProblem(TOPIC);
if (bad) { result({ ok: false, code: "BAD_INPUT", stage: "topic", message: bad }); process.exit(1); }
const q = quoteTopic(TOPIC, LENGTH, new Set(APPROVED));
let check = q.check;
if (check.verdict === "unsure") {
  const r = (() => { try { return replayLLM({ label: "kit check", model: "claude-haiku-5-5", system: KIT_SYSTEM, user: `Topic: ${TOPIC}`, schema: KIT_SCHEMA }); } catch (e) { if (e.code === "REPLAY_PENDING") { log("waiting: kit check"); process.exit(2); } throw e; } })();
  check = { verdict: r.data.buildable ? "yes" : "no", missing: r.data.missing ?? [] };
}
if (check.verdict === "no") { result({ ok: false, code: "CANT_BUILD", stage: "kit check", message: check.missing.join(", ") }); process.exit(1); }
const g = decide(DEFAULT_SETTINGS, { spent_24h: 0, user_running: 0, user_starts_1h: 0 }, fullCostUsd(q.kind, LENGTH));
if (!g.ok) { result({ ok: false, code: g.code, stage: "cap check", message: g.reason }); process.exit(1); }
log(`start: ${q.kind}${q.premade ? ` (${q.premade})` : ""}, ${q.credits} credits`);

// the approved layout as the server sends it (cutaway_layouts, seeded from these templates; facts from the layout)
const layoutFor = (key) => { if (!key) return null; const L = JSON.parse(fs.readFileSync(path.join(M2, "layouts", `${key}.template.json`), "utf8")); return { ...L, key, facts: L.facts ?? [] }; };
const run = { id: `harness-${CASE}`, topic: TOPIC, length_sec: LENGTH, kind: q.kind, attempt: 1, status: "queued", stage: "queued", provider: "runpod", layout_key: q.premade, end_card: true, plan_ready: false, created_at: new Date().toISOString() };
const files = { layout: "layout.json", script: "script.json", words: "words.json", voice: "voice.mp3", post: "post.json", steps: "steps.json" };
const plan = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, url(path.join(DIR, "plan", f))]));
const urls = { planPut: plan, planGet: plan, frames: Array.from({ length: 8 }, (_, i) => url(path.join(DIR, "frames", `frame_${i}.jpg`))), final: url(path.join(DIR, "out", "final.mp4")), web: url(path.join(DIR, "out", "web.mp4")), poster: url(path.join(DIR, "out", "poster.jpg")) };

// ---------- the callback server: the worker's events, applied with the server's rules ----------
const events = [], ledger = [], actionsSeen = [];
let pendingWorker = null;
const server = http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => { body += c; });
  req.on("end", () => {
    res.writeHead(200).end("{}");
    let ev; try { ev = JSON.parse(body); } catch { return; }
    events.push(ev); fs.appendFileSync(path.join(DIR, "events.jsonl"), `${JSON.stringify(ev)}\n`);
    const { patch, actions } = onEvent(run, ev);
    Object.assign(run, patch);
    for (const x of actions) { actionsSeen.push(x); if (x.type === "ledger") ledger.push(x.costs); }
    if (ev.event !== "heartbeat") log(`event ${ev.event}${ev.stage ? ` ${ev.stage}` : ""}${ev.code ? ` ${ev.code}` : ""} -> ${run.status}/${run.stage}${actions.filter((x) => x.type !== "ledger").length ? ` [${actions.filter((x) => x.type !== "ledger").map((x) => `${x.type}${x.target ? `:${x.target}` : ""}`).join(", ")}]` : ""}`);
  });
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const callback = { url: `http://127.0.0.1:${server.address().port}/cutaway-callback`, token: "harness" };

const worker = (job) => new Promise((ok) => {
  const env = { ...process.env, CUTAWAY_PROTO: PROTO, CUTAWAY_WT: WT, FFMPEG: FF, PYTHON: PY, ...(REAL ? {} : { CUTAWAY_PROVIDERS: "replay", CUTAWAY_REPLAY_DIR: DIR }), ...(a.takes && !REAL ? { CUTAWAY_TAKES: path.resolve(a.takes) } : {}) };
  if (REAL) { delete env.CUTAWAY_PROVIDERS; delete env.CUTAWAY_REPLAY_DIR; }
  for (const k of ["ANTHROPIC_API_KEY", "ELEVENLABS_KEY", "ELEVENLABS_API_KEY", "RUNWARE_API_KEY"]) delete env[k];
  const jf = path.join(DIR, `job_${job.attempt}.json`); fs.writeFileSync(jf, JSON.stringify({ job }));
  env.CUTAWAY_JOB_FILE = jf;
  const p = spawn(process.execPath, [path.join(WT, "scripts/cutaway/proto3d/m3/videoJob.mjs")], { cwd: WT, env, stdio: ["ignore", "pipe", "pipe"] });
  const out = fs.createWriteStream(path.join(DIR, `worker_${job.attempt}.log`));
  p.stdout.pipe(out); p.stderr.pipe(out);
  p.on("close", (code) => ok(code));
});

// ---------- the run: attempts as the server dispatches them ----------
const t0 = Date.now();
let attempt = 0;
for (;;) {
  attempt++;
  // (a retry gets the earlier attempt's paid replies, as the server sends them: runtime.ts urlsFor)
  // (--gate-only: the plan role, which stops once the preview gate passes and the plan is saved; no render)
  const job = jobFor(run, { role: a["gate-only"] ? "plan" : "video", mode: "local", urls: { ...urls, ...(run.attempt > 1 && !run.plan_ready ? { resume: plan.steps } : {}) }, callback, layout: layoutFor(q.premade), library: [] });
  if (a.cap) job.capUsd = Number(a.cap);
  log(`worker attempt ${run.attempt}${job.plan.get ? " (the plan already made)" : ""}`);
  const code = await worker(job);
  await new Promise((r) => setTimeout(r, 300));
  const failed = [...events].reverse().find((e) => e.event === "failed");
  if (failed && /REPLAY_PENDING/.test(failed.message ?? "")) {
    const key = /REPLAY_PENDING (\S+?):/.exec(failed.message)?.[1];
    // the post text is answered here (a template: it is never judged), every other call by its answer file
    if (key?.startsWith("post_text__")) {
      const r = JSON.parse(fs.readFileSync(path.join(DIR, "requests", `${key}.json`), "utf8")), title = /Title: (.*)/.exec(r.user)?.[1] ?? TOPIC;
      fs.writeFileSync(path.join(DIR, "answers", `${key}.json`), JSON.stringify({ hash: "*", note: "harness template", data: { title: `${title} 🛠️`.slice(0, 60), description: `How ${TOPIC.toLowerCase()} really works, built step by step.`, hashtags: ["#howitworks", "#3danimation", "#explained", "#shorts", "#engineering", "#diy", "#science", "#satisfying"] } }));
      events.length = 0; run.attempt = 1; run.status = "queued"; run.plan_ready = false; attempt = 0; fs.rmSync(path.join(DIR, "events.jsonl"), { force: true });
      continue;
    }
    server.close(); log(`waiting for an answer: ${key}`);
    result({ ok: null, waiting: key, stage: run.stage });
    process.exit(2);
  }
  if (run.status === "done" || (a["gate-only"] && run.plan_ready)) break;
  const next = actionsSeen.filter((x) => x.type === "dispatch").at(-1);
  if (run.status === "failed" || !next || code === null) break;
  if (next.target === "fly") { log("the server sends it to the Fly fallback (not run here: SwiftShader on this laptop takes about an hour)"); break; }
  if (attempt >= 3) break;
  actionsSeen.length = 0;
}
server.close();

// ---------- the result and the frame sheet ----------
const spend = (() => { try { return fs.readFileSync(path.join(DIR, "spend.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } })();
const simulatedUsd = +spend.reduce((s, r) => s + (Number(r.simulatedUsd) || 0), 0).toFixed(4);
const last = [...events].reverse().find((e) => ["done", "failed"].includes(e.event));
const verdicts = {};
for (const f of fs.readdirSync(path.join(DIR, "answers")).filter((f) => /^vision_check__\d+\.json$/.test(f)).sort((x, y) => Number(x.match(/\d+/)[0]) - Number(y.match(/\d+/)[0]))) {
  const ans = JSON.parse(fs.readFileSync(path.join(DIR, "answers", f), "utf8")), req = JSON.parse(fs.readFileSync(path.join(DIR, "requests", f), "utf8"));
  const roles = [...req.user.matchAll(/Frame (\w+) at/g)].map((m) => m[1]);
  (ans.data?.frames ?? []).forEach((v, i) => { if (roles[i]) verdicts[roles[i]] = { ok: v.ok, seen: v.seen, problem: v.problem }; });
}
let sheet = [];
if (run.status === "done" && fs.existsSync(path.join(DIR, "out", "final.mp4"))) {
  const { compile } = await import(url(path.join(M2, "compile.mjs")));
  const { previewTimes } = await import(url(path.join(M2, "checks.mjs")));
  const { speechEnd } = await import(url(path.join(WT, "scripts/cutaway/proto3d/speechEnd.mjs")));
  const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, "plan", f), "utf8"));
  const layout = read("layout.json"), script = read("script.json"), words = read("words.json"), voice = path.join(DIR, "plan", "voice.mp3");
  const roles = script.roles ?? script.sentences.map((s) => s.role);
  const tl = compile(layout, words, speechEnd(FF, voice), { roles });
  sheet = previewTimes(tl, layout).map((p, i) => {
    const img = `sheet/${String(i).padStart(2, "0")}_${p.role}.jpg`;
    execFileSync(FF, ["-v", "error", "-y", "-ss", String(p.t), "-i", path.join(DIR, "out", "final.mp4"), "-frames:v", "1", "-vf", "scale=360:-1", "-q:v", "4", path.join(DIR, img)]);
    return { role: p.role, text: script.sentences.find((s) => s.role === p.role)?.text ?? p.text, t: p.t, img, verdict: verdicts[p.role] ?? null };
  });
} else {
  // a failed video: the frames the preview check was shown (the request images), with its verdicts
  const reqs = fs.readdirSync(path.join(DIR, "requests")).filter((f) => /^vision_check__\d+\.json$/.test(f)).sort();
  for (const f of reqs) {
    const req = JSON.parse(fs.readFileSync(path.join(DIR, "requests", f), "utf8")), key = f.replace(/\.json$/, "");
    const frames = [...req.user.matchAll(/Frame (\w+) at ([\d.]+) s\. Sentence: "(.*?)"/g)];
    frames.forEach((m, i) => { const img = `requests/${key}_img${i + 1}.jpg`; if (fs.existsSync(path.join(DIR, img))) sheet.push({ role: m[1], text: m[3], t: Number(m[2]), img, verdict: verdicts[m[1]] ?? null, round: key }); });
  }
}
fs.writeFileSync(path.join(DIR, "sheet.json"), JSON.stringify(sheet, null, 1));
// the bookkeeping bugs the worker met and skipped (m2/bookkeeping.js): each one is ours to fix, though it failed nothing
const bugs = [...new Set(fs.readdirSync(DIR).filter((f) => /^worker_\d+\.log$/.test(f)).flatMap((f) => fs.readFileSync(path.join(DIR, f), "utf8").split("\n").filter((l) => l.includes("[cutaway] bookkeeping bug")).map((l) => l.replace(/^.*\[cutaway\] bookkeeping bug /, "").trim())))];
// the real checker's verdicts (--real-vision: m2/providers.mjs realRecord), call by call
const vision = fs.existsSync(path.join(DIR, "real")) ? fs.readdirSync(path.join(DIR, "real")).sort().map((f) => { const r = JSON.parse(fs.readFileSync(path.join(DIR, "real", f), "utf8")); return { call: f.replace(/\.json$/, ""), usd: r.usd, failed: (r.data?.frames ?? []).filter((x) => !x.ok).map((x) => ({ role: x.role, problem: x.problem })), passed: (r.data?.frames ?? []).filter((x) => x.ok).map((x) => x.role) }; }) : null;
const r = result({ ok: a["gate-only"] ? !!run.plan_ready : run.status === "done", gateOnly: !!a["gate-only"], vision, bugs, code: run.error_code ?? null, stage: run.stage, status: run.status, message: run.error_message ?? null, attempts: run.attempt, refunded: actionsSeen.some((x) => x.type === "refund") || events.some((e) => e.event === "failed" && run.status === "failed"), simulatedUsd, real: REAL, realUsd: +ledger.reduce((s, c) => s + Object.values(c ?? {}).reduce((x, y) => x + (Number(y) || 0), 0), 0).toFixed(4), durationSec: last?.files?.durationSec ?? null, seconds: +((Date.now() - t0) / 1000).toFixed(1), narration: (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, "plan", "script.json"), "utf8")).sentences.map((s) => `${s.role}: ${s.text}`); } catch { return null; } })(), frames: sheet.length });
log(`${r.ok ? "DONE" : `FAILED ${r.code}`} (${r.seconds} s, would have cost about $${simulatedUsd})`);
process.exit(r.ok ? 0 : 1);
