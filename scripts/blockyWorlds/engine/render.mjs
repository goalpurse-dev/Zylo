// Blocky Worlds engine: render a timeline's frames in headless Chrome (page/index.html) and pipe them into x264.
// Free and local; the same code runs on a RunPod GPU (CHROME_PATH / CHROME_ARGS from the worker's GPU check).
//   node render.mjs <timeline.json> <out.mp4> [--workers N] [--mode pages|browsers] [--from F --to T]
//                   [--stills t1,t2,...] [--stubs [list]] [--query "a=1&b=2"]
//   --from/--to: frame numbers [from, to) (one chunk; each chunk is a whole x264 stream, so chunks join by stream copy)
//   --stills: JPEGs at those times (seconds) to <out without .mp4>-<t>.jpg, with the frame time printed
//   --stubs: the engine's stand-in modules (dev/stubs); "--stubs people,captions" replaces only those
// Env: CHROME_PATH, CHROME_ARGS (JSON flag list, GPU servers), SOFTWARE_GL=1 (SwiftShader), BW_BLANK_TEST=3,10 (force
// a blank capture on those frames to test the guard). Prints `PROGRESS {...}` lines.
// API: renderRange({ timelinePath, from, to, out }), renderParallel({ timelinePath, out, workers }), renderStills(...)
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

export const ENGINE = path.dirname(fileURLToPath(import.meta.url));
const FF = process.env.FFMPEG ?? "ffmpeg";
const progress = (o) => console.log(`PROGRESS ${JSON.stringify(o)}`);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".ttf": "font/ttf", ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png", ".hdr": "application/octet-stream", ".bin": "application/octet-stream", ".wav": "audio/wav" };
const SERVED = ["page", "assets", "node_modules", "lib", "dev"];

/** the page server: the engine's folders, and the job's folder (timeline, audio) under /job/ */
export function startServer(jobDir) {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    const top = p.split("/")[1];
    let base, rel;
    if (top === "job") { base = jobDir; rel = p.slice(4); } else if (SERVED.includes(top)) { base = ENGINE; rel = p; } else { res.writeHead(404); return res.end(); }
    const f = path.resolve(base, "." + rel);
    if (!f.startsWith(path.resolve(base)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ port: server.address().port, close: () => server.close() })));
}

/** Chrome: the laptop's GPU by default; CHROME_ARGS (JSON) on a GPU server; SOFTWARE_GL=1 for SwiftShader */
export function chromeArgs() {
  const keepAwake = ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"];
  if (process.env.CHROME_ARGS) return { args: [...JSON.parse(process.env.CHROME_ARGS), ...keepAwake], ignoreDefaultArgs: ["--use-angle=swiftshader-webgl", "--disable-gpu"] };
  if (process.env.SOFTWARE_GL) return { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu", ...keepAwake] };
  return { args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist", ...keepAwake] };
}
export function launchBrowser() {
  return puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 900000, ...chromeArgs() });
}

/** a page with the engine loaded and ready (window.ready), or a clear error (window.engineError / page errors) */
export async function openPage(browser, { port, tlName, query = "", W = 1080, H = 1920, label = "" }) {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { const t = m.text(); if (m.type() === "error" || m.type() === "warning" || /engine/i.test(t)) console.log(`page${label}: ${t.slice(0, 600)}`); });
  page.on("pageerror", (e) => { errors.push(e.message); console.log(`page${label} error: ${e.message}`); });
  page.on("requestfailed", (r) => r.failure()?.errorText !== "net::ERR_ABORTED" && console.log(`page${label}: request failed ${r.url()} (${r.failure()?.errorText})`));
  page.on("response", (r) => { if (r.status() >= 400) console.log(`page${label}: ${r.status()} ${r.url()}`); });
  await page.setViewport({ width: Math.min(W, 1080), height: Math.min(H, 1920) });
  await page.goto(`http://127.0.0.1:${port}/page/index.html?tl=/job/${encodeURIComponent(tlName)}${query ? `&${query}` : ""}`);
  try { await page.waitForFunction("window.ready === true || !!window.engineError", { timeout: 300000, polling: 100 }); }
  catch (e) { throw new Error(`engine page never became ready (${e.message})${errors.length ? `: ${errors.join(" | ")}` : ""}`); }
  const err = await page.evaluate(() => window.engineError ?? null);
  if (err) throw new Error(`engine page failed: ${err}`);
  return page;
}

export const readTimeline = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const frameCount = (tl) => Math.round(tl.duration * (tl.fps ?? 24));

function encoder(out, fps) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const enc = spawn(FF, ["-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-r", String(fps), "-i", "-", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", String(fps), out], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => enc.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c} for ${out}`)))));
  enc.stdin.on("error", () => {});
  return { write: async (buf) => { if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once("drain", r)); }, end: async () => { enc.stdin.end(); await done; } };
}

/**
 * frames [from, to) of an open page into one mp4. The blank-frame guard (Cutaway, NVIDIA ANGLE-on-EGL sometimes hands
 * back an empty frame): a 3D frame whose mean brightness is under 3/255 is rendered again (up to 6 times, waiting a
 * little longer each time); still black, the last good frame is used.
 */
async function renderFrames(page, { fps, from, to, out, onFrame = () => {}, q = 0.92 }) {
  const enc = encoder(out, fps), blankTest = new Set(String(process.env.BW_BLANK_TEST ?? "").split(",").filter(Boolean).map(Number));
  const grab = (t, force) => page.evaluate((t, q, force) => { const r = window.renderAt(t); if (force) r.mean = 0; return { ...r, data: window.frameData(q) }; }, t, q, force);
  let lastBuf = null, redone = 0, reused = 0;
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    const t = f / fps;
    let r = await grab(t, blankTest.has(f));
    for (let k = 0; k < 6 && r.mean < 3 && lastBuf; k++) { redone++; await new Promise((s) => setTimeout(s, 40 * (k + 1))); r = await grab(t, false); }
    let buf = Buffer.from(r.data.slice(r.data.indexOf(",") + 1), "base64");
    if (r.mean < 3 && lastBuf) { buf = lastBuf; reused++; console.log(`frame ${f}: black after its retries, the last good frame is used`); } else lastBuf = buf;
    await enc.write(buf);
    onFrame(f);
  }
  await enc.end();
  const s = (Date.now() - t0) / 1000;
  if (redone || reused) console.log(`blank captures: ${redone} re-rendered, ${reused} replaced`);
  return { frames: to - from, seconds: +s.toFixed(2), msPerFrame: +((s * 1000) / Math.max(1, to - from)).toFixed(1), redone, reused };
}

const query = (o = {}) => [o.stubs ? `stubs=${o.stubs === true ? 1 : o.stubs}` : "", o.query ?? process.env.ENGINE_QUERY ?? ""].filter(Boolean).join("&");

/** one chunk: frames [from, to) of the timeline into out (a whole x264 stream) */
export async function renderRange({ timelinePath, from = 0, to = null, out, stubs = null, query: q = null }) {
  const tl = readTimeline(timelinePath), fps = tl.fps ?? 24, N = frameCount(tl);
  to = Math.min(N, to ?? N); from = Math.max(0, from);
  const srv = await startServer(path.dirname(path.resolve(timelinePath))), browser = await launchBrowser();
  try {
    const t0 = Date.now();
    const page = await openPage(browser, { port: srv.port, tlName: path.basename(timelinePath), query: query({ stubs, query: q }), W: tl.width, H: tl.height });
    const loadS = (Date.now() - t0) / 1000;
    const r = await renderFrames(page, { fps, from, to, out, onFrame: (f) => { if ((f - from) % 24 === 0 || f === to - 1) progress({ stage: "render", frame: f - from + 1, frames: to - from, pct: Math.round(((f - from + 1) * 100) / (to - from)) }); } });
    return { ...r, loadS: +loadS.toFixed(2), out };
  } finally { await browser.close().catch(() => {}); srv.close(); }
}

/**
 * the whole video (or [from, to)) split into `workers` chunks rendered at once — mode "pages": one Chrome, a page each
 * (they share one GPU process); "browsers": a Chrome each — then joined by stream copy (ffmpeg concat demuxer).
 */
export async function renderParallel({ timelinePath, out, workers = 1, from = 0, to = null, mode = "pages", stubs = null, query: q = null, onProgress = progress }) {
  const tl = readTimeline(timelinePath), fps = tl.fps ?? 24, N = frameCount(tl);
  to = Math.min(N, to ?? N);
  const total = to - from, K = Math.max(1, Math.min(workers, total));
  const bounds = Array.from({ length: K }, (_, i) => [from + Math.round((total * i) / K), from + Math.round((total * (i + 1)) / K)]);
  const tmp = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), ".chunks-"));
  const srv = await startServer(path.dirname(path.resolve(timelinePath)));
  const browsers = [];
  const t0 = Date.now();
  let done = 0;
  try {
    const shared = mode === "pages" ? await launchBrowser() : null;
    if (shared) browsers.push(shared);
    const opened = await Promise.all(bounds.map(async (b, i) => {
      const br = shared ?? await launchBrowser(); if (!shared) browsers.push(br);
      return openPage(br, { port: srv.port, tlName: path.basename(timelinePath), query: query({ stubs, query: q }), W: tl.width, H: tl.height, label: ` ${i}` });
    }));
    const loadS = (Date.now() - t0) / 1000;
    const t1 = Date.now();
    const files = bounds.map((_, i) => path.join(tmp, `chunk${String(i).padStart(3, "0")}.mp4`));
    const results = await Promise.all(bounds.map(([a, b], i) => renderFrames(opened[i], { fps, from: a, to: b, out: files[i], onFrame: () => { done++; if (done % 24 === 0 || done === total) onProgress({ stage: "render", frame: done, frames: total, pct: Math.round((done * 100) / total) }); } })));
    const renderS = (Date.now() - t1) / 1000;
    await concat(files, out);
    return { out, frames: total, workers: K, mode, loadS: +loadS.toFixed(2), renderS: +renderS.toFixed(2), msPerFrame: +((renderS * 1000) / total).toFixed(1), chunks: results };
  } finally {
    for (const b of browsers) await b.close().catch(() => {});
    srv.close();
    // Windows can still hold a chunk open for a moment: a leftover temp folder must never fail the render
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }); } catch (e) { console.log(`note: temp folder left behind (${e.code})`); }
  }
}

/** join whole x264 chunks by stream copy (the concat demuxer) */
export async function concat(files, out) {
  if (files.length === 1) { fs.copyFileSync(files[0], out); return out; }
  const list = path.join(os.tmpdir(), `bw-concat-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(list, files.map((f) => `file '${path.resolve(f).replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
  await new Promise((res, rej) => spawn(FF, ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out], { stdio: "inherit" }).on("close", (c) => (c === 0 ? res() : rej(new Error(`concat exited ${c}`)))));
  fs.rmSync(list, { force: true });
  return out;
}

/** JPEG stills at the given times, and the frame time (render + capture) */
export async function renderStills({ timelinePath, times, outPrefix, stubs = null, query: q = null }) {
  const tl = readTimeline(timelinePath);
  const srv = await startServer(path.dirname(path.resolve(timelinePath))), browser = await launchBrowser();
  try {
    const page = await openPage(browser, { port: srv.port, tlName: path.basename(timelinePath), query: query({ stubs, query: q }), W: tl.width, H: tl.height });
    const info = await page.evaluate(() => window.engineInfo);
    console.log(`renderer: ${info.renderer}; stubs: ${info.stubs.join(",") || "none"}; sets ${info.sets.join(",")}`);
    fs.mkdirSync(path.dirname(path.resolve(outPrefix)), { recursive: true });
    const files = [];
    for (const t of times) {
      const a = Date.now();
      const r = await page.evaluate((t) => { const r = window.renderAt(t); return { ...r, data: window.frameData(0.9) }; }, t);
      const f = `${outPrefix}-${t}.jpg`;
      fs.writeFileSync(f, Buffer.from(r.data.split(",")[1], "base64"));
      console.log(`t=${t}: shot ${r.shot}, mean ${r.mean}, ${Date.now() - a} ms -> ${f}`);
      files.push(f);
    }
    return files;
  } finally { await browser.close().catch(() => {}); srv.close(); }
}

/** CLI args: positionals, `--k v` for the named valued flags, `--stubs [list]` (a list only if it has no dot), `--x` booleans */
export function parseArgs(argv, valued) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { pos.push(a); continue; }
    const k = a.slice(2), nx = argv[i + 1];
    if (valued.includes(k)) { opt[k] = nx; i++; }
    else if (k === "stubs" && nx && !nx.startsWith("--") && /^[a-z0-9,]+$/i.test(nx)) { opt[k] = nx; i++; }
    else opt[k] = true;
  }
  return { pos, opt };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const { pos, opt } = parseArgs(process.argv.slice(2), ["workers", "mode", "from", "to", "stills", "query"]);
  const [timelinePath, out] = pos;
  if (!timelinePath || !out) { console.error("usage: node render.mjs <timeline.json> <out.mp4> [--workers N] [--mode pages|browsers] [--from F --to T] [--stills t1,t2] [--stubs [list]]"); process.exit(2); }
  const flag = (k) => (k in opt ? 0 : -1), val = (k, d = null) => opt[k] ?? d;
  const stubs = opt.stubs ?? null, q = val("query");
  const t0 = Date.now();
  try {
    if (flag("stills") >= 0) await renderStills({ timelinePath, times: val("stills").split(",").map(Number), outPrefix: out.replace(/\.mp4$/i, ""), stubs, query: q });
    else if (flag("from") >= 0 || flag("to") >= 0) console.log(JSON.stringify(await renderRange({ timelinePath, from: Number(val("from", 0)), to: val("to") == null ? null : Number(val("to")), out, stubs, query: q })));
    else console.log(JSON.stringify(await renderParallel({ timelinePath, out, workers: Number(val("workers", 1)), mode: val("mode", "pages"), stubs, query: q })));
    console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
