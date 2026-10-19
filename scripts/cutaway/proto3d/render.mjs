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
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: process.env.SOFTWARE_GL ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu"] : ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });
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
  }
} else {
  const n = Math.round(Number(secs) * Number(fps));
  const enc = spawn(ff, ["-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-r", fps, "-i", "-", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    const data = await page.evaluate((t) => { window.renderAt(t); return document.querySelector("canvas").toDataURL("image/jpeg", 0.95); }, f / Number(fps));
    if (!enc.stdin.write(Buffer.from(data.split(",")[1], "base64"))) await new Promise((r) => enc.stdin.once("drain", r));
    if (f % 60 === 0) console.log(`frame ${f}/${n}`);
  }
  enc.stdin.end();
  await new Promise((r) => enc.on("close", r));
  console.log(`rendered ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await browser.close();
server.close();
