// Zyvo Studio: renders a three.js scene frame by frame in headless Chrome (the laptop GPU) and pipes the frames
// to ffmpeg, or saves stills. $0, local. Based on scripts/cutaway/proto3d/render.mjs; serves three/n8ao/
// postprocessing and the CC0 textures from the Cutaway render folder (PROTO_DIR) and real Zyvo outputs (PICS_DIR).
//   PROTO_DIR=<cutaway render folder> PICS_DIR=<real outputs> PAGE="look.html?look=A" node render.mjs <ffmpeg> shots/A 1 30 0
//   ... node render.mjs <ffmpeg> out.mp4 <seconds> 30          (a clip)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const [ff, out, secs = "10", fps = "30", only] = process.argv.slice(2);
const root = path.dirname(fileURLToPath(import.meta.url));
const PROTO = process.env.PROTO_DIR, PICS = process.env.PICS_DIR;
if (!PROTO) { console.error("PROTO_DIR: the Cutaway render folder (node_modules + assets)"); process.exit(2); }
// puppeteer-core lives in the render folder, not in the repo's package.json (on purpose, as for the Cutaway kit)
const puppeteer = createRequire(path.join(PROTO, "package.json"))("puppeteer-core");
const types = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".hdr": "application/octet-stream", ".mp4": "video/mp4" };
const resolve = (url) => {
  const p = decodeURIComponent(url.split("?")[0]);
  const [base, rel] = p.startsWith("/node_modules/") || p.startsWith("/assets/") ? [PROTO, p] : p.startsWith("/pics/") && PICS ? [PICS, p.slice(5)] : p.startsWith("/work/") && process.env.WORK_DIR ? [process.env.WORK_DIR, p.slice(5)] : [root, p];
  const f = path.join(base, rel);
  return f.startsWith(path.resolve(base)) ? f : null;
};
const server = http.createServer((req, res) => {
  const f = resolve(req.url);
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f).toLowerCase()] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("console", (m) => console.log("page:", m.text()));
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.setViewport({ width: 1080, height: 1920 });
await page.goto(`http://localhost:${port}/${process.env.PAGE ?? "look.html"}`);
await page.waitForFunction("window.ready === true", { timeout: 60000 });

// the composited frame (#out: 3D + overlays) when the page has one, else the WebGL canvas
const grab = (t, q) => page.evaluate(async (t, q) => { await window.renderAt(t); return (document.getElementById("out") ?? document.querySelector("canvas")).toDataURL("image/jpeg", q); }, t, q);
if (only) {
  for (const t of only.split(",")) {
    const data = await grab(Number(t), 0.92);
    fs.writeFileSync(`${out}-${t}.jpg`, Buffer.from(data.split(",")[1], "base64"));
    console.log(`saved ${out}-${t}.jpg (${(await page.evaluate(() => window.lastMs ?? 0)).toFixed(0)} ms)`);
  }
} else {
  const n = Math.round(Number(secs) * Number(fps));
  // AUDIO=<wav>: muxed in as AAC (the mix made by audio.py)
  const audio = process.env.AUDIO ? ["-i", process.env.AUDIO, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-shortest"] : [];
  const enc = spawn(ff, ["-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-r", fps, "-i", "-", ...audio, "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    const data = await grab(f / Number(fps), 0.95);
    if (!enc.stdin.write(Buffer.from(data.split(",")[1], "base64"))) await new Promise((r) => enc.stdin.once("drain", r));
    if (f % 60 === 0) console.log(`frame ${f}/${n}`);
  }
  enc.stdin.end();
  await new Promise((r) => enc.on("close", r));
  console.log(`rendered ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
const zones = await page.evaluate(() => window.zoneReport?.() ?? null);
if (zones) console.log(Object.keys(zones).length ? `SAFE ZONES: ${JSON.stringify(zones)}` : "SAFE ZONES: every face and key prop inside on every frame");
await browser.close();
server.close();
