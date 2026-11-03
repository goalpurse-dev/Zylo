// Blocky Worlds: the short looping clips the page shows (public/blocky-worlds/clips). Renders the locked look in headless
// Chrome on the laptop GPU, one camera move per clip, then ffmpeg makes a small silent mp4 and a poster. Free and local.
// Usage: node clips.mjs <protoDir> <fontDir> <phDir> <outDir> [key,key]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const [protoDir, fontDir, phDir, outDir, only] = process.argv.slice(2);
const puppeteer = createRequire(path.join(protoDir, "package.json"))("puppeteer-core");
const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 24, SEC = 4, WIDTH = 540;

// [x, y, z, look at x, y, z] from -> to; bus z from -> to (the bus pulls in on some)
const CLIPS = {
  street: { look: "L", from: [3.6, 1.5, 8.5, 4.6, 2.0, -8], to: [6.0, 1.6, 6.8, 6.4, 2.0, -8], bus: [-30, -10.5] },
  folk: { look: "L", from: [4.9, 1.6, 9.8, 6.0, 1.5, -1], to: [5.3, 1.5, 6.4, 6.2, 1.5, -1], bus: [-10.5, -10.5] },
  night: { look: "Ln", from: [6.2, 1.7, 8.2, 5.6, 2.0, -8], to: [4.4, 1.5, 7.4, 5.9, 2.0, -8], bus: [-10.5, -10.5] },
  above: { look: "L", from: [1.0, 4.6, 12, 5.5, 1.2, -4], to: [2.6, 3.6, 10, 6.0, 1.2, -4], bus: [-42, -16] },
};

const types = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf", ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png", ".hdr": "application/octet-stream", ".bin": "application/octet-stream" };
const resolve = (url) => {
  const p = decodeURIComponent(url.split("?")[0]);
  if (p.startsWith("/node_modules/") || p.startsWith("/assets/")) return path.join(protoDir, p);
  if (p.startsWith("/font/")) return path.join(fontDir, p.slice(6));
  if (p.startsWith("/ph/")) return path.join(phDir, p.slice(4));
  return path.join(here, p);
};
const server = http.createServer((req, res) => {
  const f = resolve(req.url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f).toLowerCase()] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 600000, args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });
fs.mkdirSync(outDir, { recursive: true });

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

for (const [key, c] of Object.entries(CLIPS)) {
  if (only && !only.split(",").includes(key)) continue;
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(`[${key}] page error:`, e.message));
  await page.setViewport({ width: WIDTH, height: Math.round(WIDTH * 16 / 9) });
  await page.goto(`http://localhost:${port}/look.html?look=${c.look}&w=${WIDTH}&nocap`);
  await page.waitForFunction("window.ready === true", { timeout: 240000 });
  const tmp = fs.mkdtempSync(path.join(outDir, `.${key}-`));
  const n = FPS * SEC, t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = ease(i / (n - 1));
    const data = await page.evaluate((cam, busZ) => { window.setShot(cam, busZ); return window.snapshot(); }, lerp(c.from, c.to, t), c.bus[0] + (c.bus[1] - c.bus[0]) * t);
    fs.writeFileSync(path.join(tmp, `f${String(i).padStart(4, "0")}.jpg`), Buffer.from(data.split(",")[1], "base64"));
  }
  const mp4 = path.join(outDir, `${key}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(tmp, "f%04d.jpg"), "-vf", "scale=432:-2", "-c:v", "libx264", "-preset", "slow", "-crf", "31", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(tmp, "f0000.jpg"), "-vf", "scale=432:-2", "-q:v", "6", path.join(outDir, `${key}.jpg`)]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${key}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB`);
  await page.close();
}
await browser.close();
server.close();
