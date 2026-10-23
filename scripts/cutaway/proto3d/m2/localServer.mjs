// M2: the local runner for the Cutaway template on localhost (owner testing; nothing is deployed). The page's dev
// server proxies /m2api here (vite.config.js). One run at a time: the render needs the laptop's GPU.
//   node scripts/cutaway/proto3d/m2/localServer.mjs   (env: M2_PROTO the render folder, M2_FFMPEG, M2_PORT 8787)
//
//   POST /m2api/runs { topic, lengthSec, endCard }  -> { id } (or 422 { error, missing, closest } when the kit can't
//        build it: the free rule check, then Claude Haiku 5.5 when the rules can't decide)
//   GET  /m2api/runs/:id                           -> the run in the template's shape (step, renderPct, narration,
//        facts, parts, frames, finalUrl, post, error, cost)
//   GET  /m2api/files/:id/<path>                   -> a file of the run (the video, preview frames)
//
// Saved layouts are re-used: a topic with a template in m2/layouts (the golden two, and every new layout this
// runner has made) skips the scene planning. A new layout is saved there after its video is made.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTopic } from "./run.mjs";
import { callJSON, loadKey, MODEL } from "./llm.mjs";
import { classifyTopic, kitCheck, normTopic, premadeByKey } from "../../../../supabase/functions/_shared/cutaway/topics.js";
import { checkKitFit } from "../../../../supabase/functions/_shared/cutaway/kitCheck.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PROTO = process.env.M2_PROTO ?? "C:/Users/Huhta/AppData/Local/Temp/claude/c--Users-Public-Zylo/9fd93e59-a925-49a7-beab-dadbb576d507/scratchpad/proto";
const FF = process.env.M2_FFMPEG ?? "C:/Users/Huhta/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe";
const RUNS = process.env.M2_RUNS ?? "C:/Users/Public/Zylo/research/seamless-niche/work/m2local";
const LOG = process.env.M2_LOG ?? "C:/Users/Public/Zylo/research/seamless-niche/work/m2spend.jsonl";
const PORT = Number(process.env.M2_PORT ?? 8787);
const LAYOUTS = path.join(here, "layouts");

const runs = new Map(); // id -> state
let busy = null;

const keyOf = (topic) => normTopic(topic).replace(/^(a|an|the) /, "").replace(/\b(how|does|do|work|works|a|an|the)\b/g, " ").trim().replace(/\s+/g, "_").slice(0, 40);
function savedLayoutFor(topic) {
  const c = classifyTopic(topic);
  const key = c.premade ?? keyOf(topic);
  return fs.existsSync(path.join(LAYOUTS, `${key}.template.json`)) ? key : null;
}

const POST_SCHEMA = { type: "object", additionalProperties: false, required: ["title", "description", "hashtags"], properties: { title: { type: "string" }, description: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } } };
async function postFor(script) {
  // Haiku: it passed the post-text checks on every test script (Sonnet broke the 2-sentence rule twice), at 1/20 the price
  const r = await callJSON({ apiKey: loadKey(), model: MODEL.small, label: "post text", log: LOG, effort: "low", maxTokens: 3000, schema: POST_SCHEMA,
    system: "You write the post text for a short vertical 3D explainer video on TikTok, YouTube Shorts and Reels: a title under 60 characters with one emoji at the end, a 1-2 sentence description that teases the most surprising fact, and 8 lowercase hashtags (each starting with #, always including #howitworks, #3danimation, #explained and #shorts).",
    user: `Title: ${script.title}\nNarration: ${script.sentences.map((s) => s.text).join(" ")}` });
  return { post: r.data, costUsd: r.costUsd };
}

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
function view(st) {
  const base = `/m2api/files/${st.id}/`;
  return {
    id: st.id, topic: st.topic, lengthSec: st.lengthSec, endCard: st.endCard, soundEffects: true, local: true,
    step: st.step, stepAt: st.stepAt, renderPct: st.renderPct ?? 0, title: st.title ?? st.topic, narration: st.narration ?? "",
    facts: (st.facts ?? []).filter((f) => f.verdict !== "drop").map((f) => ({ claim: f.claim, sources: (f.sources ?? []).map((s) => ({ label: s.title?.slice(0, 40) || host(s.url), url: s.url })) })),
    parts: st.parts ?? [], frames: (st.frames ?? []).map((f) => base + f), framesShown: st.step === "render" ? Math.floor(((st.renderPct ?? 0) / 100) * (st.frames?.length ?? 0)) : st.step === "done" ? st.frames?.length ?? 0 : 0,
    finalUrl: st.final ? base + st.final : null, poster: st.poster ? base + st.poster : null, post: st.post ?? null, error: st.error ?? null,
    reused: st.reuse, costUsd: st.costUsd ?? null, doneAt: st.doneAt ?? null, createdAt: st.createdAt,
  };
}

// a finished run in RUNS (after a restart of this runner, or a run made by m2/run.mjs and copied there)
function fromDisk(id) {
  const out = path.join(RUNS, id), rep = path.join(out, "run_report.json");
  if (!/^[\w-]+$/.test(id) || !fs.existsSync(rep)) return null;
  const r = JSON.parse(fs.readFileSync(rep, "utf8")), script = JSON.parse(fs.readFileSync(path.join(out, "script.json"), "utf8")), L = JSON.parse(fs.readFileSync(path.join(out, "layout.json"), "utf8"));
  const post = fs.existsSync(path.join(out, "post.json")) ? JSON.parse(fs.readFileSync(path.join(out, "post.json"), "utf8")) : null;
  const final = path.relative(out, r.files.end).split(path.sep).join("/");
  const frames = fs.existsSync(path.join(out, "preview_small")) ? fs.readdirSync(path.join(out, "preview_small")).filter((f) => f.endsWith(".jpg")).sort().map((f) => `preview_small/${f}`) : [];
  const st = { id, topic: r.topic, lengthSec: r.lengthSec, endCard: true, reuse: r.reuse, step: "done", stepAt: Date.now(), renderPct: 100, title: script.title, narration: script.sentences.map((x) => x.text).join(" "), facts: script.facts ?? [], parts: L.parts.map((p) => pretty(p.id)), frames, final, poster: frames.at(-1), post, costUsd: r.totalUsd, doneAt: Date.now() - 60000, createdAt: new Date(fs.statSync(rep).mtimeMs).toISOString() };
  runs.set(id, st);
  return st;
}

async function start(st) {
  const out = path.join(RUNS, st.id);
  const set = (o) => { const stepNow = o.step && o.step !== st.step; Object.assign(st, o); if (stepNow) st.stepAt = Date.now(); };
  const toUi = { script: "script", scene: "scene", render: "render", timeline: "render", sound: "render", finish: "render", done: "render" };
  try {
    const r = await runTopic({
      topic: st.topic, out, proto: PROTO, ff: FF, lengthSec: st.lengthSec, reuse: st.reuse, endCard: st.endCard, log: LOG,
      onProgress: (p) => {
        if (p.stage === "failed") return;
        const step = toUi[p.stage] ?? st.step;
        set({ step, ...(p.title ? { title: p.title } : {}), ...(p.narration ? { narration: p.narration } : {}), ...(p.facts ? { facts: p.facts } : {}), ...(p.parts ? { parts: p.parts.map(pretty) } : {}), ...(Array.isArray(p.frames) ? { frames: p.frames } : {}) });
        if (p.stage === "render" && Number.isFinite(p.frames)) st.renderPct = Math.min(99, Math.round((p.frame / p.frames) * 100));
      },
    });
    if (!r.ok) throw new Error(`${r.problems?.length ? r.problems.join("; ") : (r.vision?.failing ?? []).join(", ") + " did not pass the preview check"}`);
    const { post, costUsd } = await postFor(JSON.parse(fs.readFileSync(path.join(out, "script.json"), "utf8")));
    // a new layout is saved for the next video of this topic
    if (!st.reuse) {
      const L = JSON.parse(fs.readFileSync(path.join(out, "layout.json"), "utf8"));
      const key = classifyTopic(st.topic).premade ?? keyOf(st.topic);
      // its checked facts go with it: the next video of this topic needs no new fact-check
      const facts = JSON.parse(fs.readFileSync(path.join(out, "script.json"), "utf8")).facts ?? [];
      fs.writeFileSync(path.join(LAYOUTS, `${key}.template.json`), JSON.stringify({ ...L, key, template: true, approved: false, facts, savedFrom: st.id, savedAt: new Date().toISOString() }, null, 1));
    }
    const file = path.relative(out, r.files[st.endCard === false ? "noend" : "end"] ?? r.files.end).split(path.sep).join("/");
    set({ step: "done", renderPct: 100, final: file, post, costUsd: +(r.totalUsd + costUsd).toFixed(4), doneAt: Date.now(), report: r.measured });
  } catch (e) {
    set({ step: "failed", error: String(e.message ?? e).slice(0, 600) });
  } finally { busy = null; }
}
const pretty = (id) => id.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const json = (code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method === "POST" && url.pathname === "/m2api/runs") {
    let body = ""; for await (const c of req) body += c;
    const { topic, lengthSec = 30, endCard = true } = JSON.parse(body || "{}");
    if (!topic || String(topic).trim().length < 3) return json(400, { error: "Type a topic." });
    if (busy) return json(409, { error: "A video is already being made on this computer. Try again when it is done." });
    // the kit check before anything is paid: the free rules, then Haiku when they can't decide
    const reuse = savedLayoutFor(topic);
    if (!reuse && classifyTopic(topic).kind !== "premade") {
      const k = kitCheck(topic);
      let verdict = k.verdict, missing = k.missing;
      if (verdict === "unsure") { const h = await checkKitFit({ apiKey: loadKey(), topic }); verdict = h.buildable ? "yes" : "no"; missing = h.missing; fs.appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), label: "kit check (Haiku)", costUsd: h.costUsd })}\n`); }
      if (verdict === "no") return json(422, { error: "The kit can't build this topic yet.", missing, closest: k.closest.map((c) => premadeByKey(c)?.topic ?? c) });
    }
    const id = `m2-${Date.now()}`;
    const st = { id, topic: String(topic).trim(), lengthSec: Number(lengthSec) === 60 ? 60 : 30, endCard: endCard !== false, reuse, step: "script", stepAt: Date.now(), createdAt: new Date().toISOString() };
    runs.set(id, st); busy = id;
    start(st);
    return json(200, { id, reuse });
  }
  if (req.method === "GET" && url.pathname === "/m2api/runs") {
    const ids = fs.existsSync(RUNS) ? fs.readdirSync(RUNS).filter((d) => fs.existsSync(path.join(RUNS, d, "run_report.json"))) : [];
    return json(200, ids.map((id) => runs.get(id) ?? fromDisk(id)).filter((st) => st?.step === "done").map(view).sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))).slice(0, 8));
  }
  let m = url.pathname.match(/^\/m2api\/runs\/([\w-]+)$/);
  if (req.method === "GET" && m) { const st = runs.get(m[1]) ?? fromDisk(m[1]); return st ? json(200, view(st)) : json(404, { error: "no such run" }); }
  m = url.pathname.match(/^\/m2api\/files\/([\w-]+)\/(.+)$/);
  if (req.method === "GET" && m) {
    const dir = path.join(RUNS, m[1]), f = path.resolve(dir, decodeURIComponent(m[2]));
    if (!f.startsWith(path.resolve(dir)) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
    const type = { ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json" }[path.extname(f)] ?? "application/octet-stream";
    const size = fs.statSync(f).size, range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range) { const a = Number(range[1] || 0), b = range[2] ? Number(range[2]) : size - 1; res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${a}-${b}/${size}`, "Accept-Ranges": "bytes", "Content-Length": b - a + 1 }); return fs.createReadStream(f, { start: a, end: b }).pipe(res); }
    res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" }); return fs.createReadStream(f).pipe(res);
  }
  if (url.pathname === "/m2api/health") return json(200, { ok: true, busy, proto: fs.existsSync(path.join(PROTO, "node_modules")) });
  json(404, { error: "not found" });
}

if (/localServer\.mjs$/.test(process.argv[1] ?? "")) {
  fs.mkdirSync(RUNS, { recursive: true });
  http.createServer((req, res) => handle(req, res).catch((e) => { res.writeHead(500); res.end(JSON.stringify({ error: String(e.message ?? e) })); })).listen(PORT, "127.0.0.1", () => console.log(`M2 local runner on http://127.0.0.1:${PORT} (render folder ${PROTO})`));
}

export { handle, view, savedLayoutFor };
