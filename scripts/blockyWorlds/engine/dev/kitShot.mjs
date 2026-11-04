// KIT preview stills: serves the engine folder on a free port, opens dev/kit.html in headless Chrome (laptop GPU) and
// saves stills to out/dev/kit/. Free and local.  Usage: node dev/kitShot.mjs [name,name,...] [--time]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const puppeteer = createRequire(path.join(root, "package.json"))("puppeteer-core");
const outDir = path.join(root, "out/dev/kit");
const SHOTS = {
  lineup: "scene=lineup&t=0.3",
  lineup2: "scene=lineup&t=0.62",
  poses: "scene=poses&t=0.4",
  faces: "scene=faces",
  monsters_day: "scene=monsters",
  monsters_night: "scene=monsters&light=night&ms=reach&ms2=lurk&t=2.4",
  monsters_night2: "scene=monsters&light=night&ms=reveal&ms2=reveal&t=2",
  inserts: "scene=inserts",
  props: "scene=props",
  props_night: "scene=props&light=night",
  busy: "scene=busy",
};
const args = process.argv.slice(2);
const which = (args.find((a) => !a.startsWith("--")) ?? Object.keys(SHOTS).join(",")).split(",");
const timing = args.includes("--time");
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".ttf": "font/ttf", ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f).toLowerCase()] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 300000, args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });
fs.mkdirSync(outDir, { recursive: true });
for (const name of which) {
  const q = SHOTS[name] ?? name;
  const page = await browser.newPage();
  page.on("console", (m) => { const t = m.text(); if (!/GPU stall|X3595/.test(t)) console.log(`[${name}]`, t); });
  page.on("pageerror", (e) => console.log(`[${name}] page error:`, e.message));
  page.on("response", (r) => { if (r.status() >= 400) console.log(`[${name}] ${r.status()}:`, r.url()); });
  await page.setViewport({ width: 1080, height: 1920 });
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/dev/kit.html?${q}`);
  await page.waitForFunction("window.ready === true", { timeout: 240000 });
  const data = await page.evaluate(() => window.snapshot());
  const file = path.join(outDir, `${name.replace(/[^a-z0-9_]+/gi, "_")}.jpg`);
  fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
  let extra = "";
  if (timing) { const r = await page.evaluate(() => window.timeFrames(24)); extra = `; frame ${r.frameMs.toFixed(1)} ms (posing ${r.poseMs.toFixed(3)} ms), ${r.tris} tris, ${r.calls} draw calls`; }
  console.log(`${name}: ${file} (load ${((Date.now() - t0) / 1000).toFixed(1)} s${extra})`);
  await page.close();
}
await browser.close();
server.close();
