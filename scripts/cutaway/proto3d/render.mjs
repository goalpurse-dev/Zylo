// Renders the three.js scene frame by frame in headless Chrome and pipes the frames to ffmpeg. $0, local.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "node:url";

const [ff, out, secs = "10", fps = "30", only] = process.argv.slice(2);
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
// a render server sets CHROME_PATH and its GPU flags in CHROME_ARGS (JSON); puppeteer's own SwiftShader flag is then left
// out, so WebGL can't fall back to software without the GPU check seeing it
const chromeArgs = process.env.CHROME_ARGS ? JSON.parse(process.env.CHROME_ARGS) : null;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, ...(chromeArgs ? { ignoreDefaultArgs: ["--use-angle=swiftshader-webgl", "--disable-gpu"] } : {}), args: chromeArgs ?? (process.env.SOFTWARE_GL ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu"] : ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"]) });
const page = await browser.newPage();
page.on("console", (m) => console.log("page:", m.text()));
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.setViewport({ width: 1080, height: 1920 });
await page.goto(`http://localhost:${port}/${process.env.PAGE ?? "index.html"}`);
await page.waitForFunction("window.ready === true", { timeout: 30000 });

if (only) { // stills at given times for a quick look
  for (const t of only.split(",")) {
    const data = await page.evaluate((t) => { window.renderAt(t); return document.querySelector("canvas").toDataURL("image/jpeg", 0.9); }, Number(t));
    fs.writeFileSync(`${out}-${t}.jpg`, Buffer.from(data.split(",")[1], "base64"));
    const ms = await page.evaluate(() => { const gl = document.querySelector("canvas").getContext("webgl2"); const px = new Uint8Array(4); window.renderAt(0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const a = performance.now(); for (let i = 0; i < 5; i++) { window.renderAt(0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return (performance.now() - a) / 5; }); console.log(`frame time ${ms.toFixed(0)} ms`);
  }
} else {
  const n = Math.round(Number(secs) * Number(fps));
  // FRAME_FROM / FRAME_TO: one chunk of the video (the CPU fallback splits a video over several machines; the chunks are
  // joined by stream copy, so each is a whole x264 stream of its own frames)
  const f0 = Math.max(0, Number(process.env.FRAME_FROM ?? 0)), f1 = Math.min(n, Number(process.env.FRAME_TO ?? n));
  const enc = spawn(ff, ["-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-r", fps, "-i", "-", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  // a blank capture: on the GPU server (NVIDIA, ANGLE on EGL) a frame sometimes comes back empty, never on this laptop: the
  // first finished swimming pool video of 2026-10-30 had 24 single black frames, the first at frame 0. A capture far
  // smaller than the last good one is rendered again; still small AND truly dark, the last good frame is used instead
  const blankTest = new Set(String(process.env.CUTAWAY_BLANK_TEST ?? "").split(",").filter(Boolean).map(Number));
  const grab = (t, forceBlank = false) => page.evaluate((t, forceBlank) => {
    window.renderAt(t);
    const c = document.querySelector("canvas"), gl = c.getContext("webgl2");
    gl?.finish?.();
    if (forceBlank) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    return c.toDataURL("image/jpeg", 0.95);
  }, t, forceBlank);
  const dark = (data) => page.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode();
    const c2 = document.createElement("canvas"); c2.width = c2.height = 32; const g = c2.getContext("2d"); g.drawImage(im, 0, 0, 32, 32);
    const px = g.getImageData(0, 0, 32, 32).data; let sum = 0; for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
    return sum / (3 * 1024) < 12;
  }, data);
  let lastLen = 0, lastBuf = null, redone = 0, reused = 0;
  for (let f = f0; f < f1; f++) {
    const t = f / Number(fps), small = (d) => (lastLen ? d.length < lastLen * 0.35 : d.length < 160000);
    let data = await grab(t, blankTest.has(f));
    for (let k = 0; k < 6 && small(data); k++) { redone++; await new Promise((r) => setTimeout(r, 40 * (k + 1))); data = await grab(t); }
    let buf = Buffer.from(data.split(",")[1], "base64");
    if (small(data) && lastBuf && await dark(data)) { buf = lastBuf; reused++; console.log(`frame ${f}: blank after its retries, the last good frame is used`); }
    else { lastLen = data.length; lastBuf = buf; }
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once("drain", r));
    if (f % 60 === 0) console.log(`frame ${f}/${n}`);
  }
  if (redone || reused) console.log(`blank captures: ${redone} re-rendered, ${reused} replaced`);
  enc.stdin.end();
  await new Promise((r) => enc.on("close", r));
  console.log(`rendered ${f1 - f0} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await browser.close();
server.close();
