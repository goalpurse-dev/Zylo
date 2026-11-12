// Style test driver (dev only): node dev/styletest/render.mjs <clip turtle|wolf> <out.mp4|outPrefix> [--stills 0,2.5] [--dur 5] [--fps 24] [--w 1080 --h 1920]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { startServer, launchBrowser, ENGINE } from "../../render.mjs";

const [clip, out] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg("w", 1080), H = +arg("h", 1920), fps = +arg("fps", 24), dur = +arg("dur", 5), stills = arg("stills", null);

const srv = await startServer(ENGINE);
const browser = await launchBrowser();
const page = await browser.newPage();
page.on("console", (m) => console.log(`page: ${m.text().slice(0, 400)}`));
page.on("pageerror", (e) => { console.log(`page error: ${e.message}`); page.evaluate((m) => { window.engineError = m; }, e.message).catch(() => {}); });
page.on("response", (r) => { if (r.status() >= 400) console.log(`page: ${r.status()} ${r.url()}`); });
await page.setViewport({ width: W, height: H });
const tLoad = Date.now();
await page.goto(`http://127.0.0.1:${srv.port}/dev/styletest/index.html?clip=${clip}&w=${W}&h=${H}&${arg("q", "")}`);
await page.waitForFunction("window.ready === true || !!window.engineError", { timeout: 600000, polling: 200 });
const err = await page.evaluate(() => window.engineError ?? null);
if (err) { console.log("ENGINE ERROR", err); await browser.close(); srv.close(); process.exit(1); }
console.log(`ready in ${((Date.now() - tLoad) / 1000).toFixed(1)} s`, JSON.stringify(await page.evaluate(() => window.stats)));

const grab = async (t) => page.evaluate((t) => { const r = window.renderAt(t); return { ...r, data: window.frameData(0.92) }; }, t);
if (stills) {
  for (const t of stills.split(",").map(Number)) {
    const r = await grab(t); fs.writeFileSync(`${out}-${t}.jpg`, Buffer.from(r.data.split(",")[1], "base64"));
    console.log(`still ${t}: ${r.ms.toFixed(0)} ms, ${r.tris} tris, ${r.calls} calls`);
  }
} else {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const enc = spawn(process.env.FFMPEG ?? "ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-r", String(fps), "-i", "-", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((r) => enc.on("close", r));
  const n = Math.round(dur * fps), ms = []; const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    const r = await grab(f / fps); ms.push(r.ms);
    if (!enc.stdin.write(Buffer.from(r.data.split(",")[1], "base64"))) await new Promise((r) => enc.stdin.once("drain", r));
    if (f % 24 === 0) console.log(`frame ${f}/${n}: gpu ${r.ms.toFixed(0)} ms, ${r.tris} tris`);
  }
  enc.stdin.end(); await done;
  const wall = (Date.now() - t0) / n; ms.sort((a, b) => a - b);
  console.log(`TIMING ${clip}: ${n} frames, wall ${wall.toFixed(0)} ms/frame (incl. JPEG capture), render median ${ms[n >> 1].toFixed(0)} ms, p95 ${ms[Math.floor(n * 0.95)].toFixed(0)} ms`);
}
await browser.close(); srv.close();
