// Blocky Worlds look frames, round 2: renders look.html?look=<id> in headless Chrome on the laptop GPU, saves each
// composite (3D frame + caption) as a JPEG and prints the measured GPU time per frame. Free and local.
// Usage: node shot.mjs <protoDir> <fontDir> <outDir> A,B,C,An
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const [protoDir, fontDir, outDir, which = "L"] = process.argv.slice(2);
const puppeteer = createRequire(path.join(protoDir, "package.json"))("puppeteer-core");
const here = path.dirname(fileURLToPath(import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf", ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png", ".hdr": "application/octet-stream", ".bin": "application/octet-stream" };
const resolve = (url) => {
  const p = decodeURIComponent(url.split("?")[0]);
  if (p.startsWith("/node_modules/") || p.startsWith("/assets/")) return path.join(protoDir, p);
  if (p.startsWith("/font/")) return path.join(fontDir, p.slice(6));
  return path.join(here, p);
};
const server = http.createServer((req, res) => {
  const f = resolve(req.url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f).toLowerCase()] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 300000, args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });
fs.mkdirSync(outDir, { recursive: true });
for (const look of which.split(",")) {
  const page = await browser.newPage();
  page.on("console", (m) => { const t = m.text(); if (!/GPU stall|X3595/.test(t)) console.log(`[${look}]`, t); });
  page.on("pageerror", (e) => console.log(`[${look}] page error:`, e.message));
  page.on("response", (r) => { if (r.status() >= 400) console.log(`[${look}] ${r.status()}:`, r.url()); });
  page.on("requestfailed", (r) => console.log(`[${look}] failed:`, r.url()));
  await page.setViewport({ width: 1080, height: 1920 });
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/look.html?look=${look}${process.env.EXTRA ?? ""}`);
  await page.waitForFunction("window.ready === true", { timeout: 240000 });
  const loadMs = Date.now() - t0;
  const data = await page.evaluate(() => window.snapshot());
  const frameMs = await page.evaluate(() => window.timeFrames(10));
  fs.writeFileSync(path.join(outDir, `${look}.jpg`), Buffer.from(data.split(",")[1], "base64"));
  console.log(`${look}: saved; scene load ${(loadMs / 1000).toFixed(1)} s; GPU time per frame ${frameMs.toFixed(0)} ms (average of 10, 1080x1920)`);
  await page.close();
}
await browser.close();
server.close();
