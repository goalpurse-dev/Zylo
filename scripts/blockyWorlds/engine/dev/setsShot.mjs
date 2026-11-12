// SETS preview stills (free, local): serves the engine folder on a random port, opens dev/sets.html in headless Chrome
// on the laptop GPU and saves stills to out/dev/sets/: every set x {day, night, warm} in a wide shot, plus every camera
// type on the chosen sets; prints the set build + load time and the GPU ms per frame (1080x1920, full post chain).
// Usage (from engine/): node dev/setsShot.mjs [sets=street,bedroom,school,woods] [lights=day,night,warm] [camSets=street,bedroom]
//   env CAMS=wide,medium,... limits the camera list; env ONLY=<set>_<light>_<cam>[,..] renders just those.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "..");
const [setsArg = "street,bedroom,school,woods", lightsArg = "day,night,warm", camSetsArg = "street,bedroom"] = process.argv.slice(2);
const SETS = setsArg.split(","), LIGHTS = lightsArg.split(","), CAMSETS = camSetsArg === "-" ? [] : camSetsArg.split(",");
const CAMS = (process.env.CAMS ?? "medium,closeup,low,over_shoulder,insert").split(",");
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const outDir = path.join(root, "out", "dev", "sets");
fs.mkdirSync(outDir, { recursive: true });

const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".ttf": "font/ttf", ".gltf": "model/gltf+json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".png": "image/png", ".hdr": "application/octet-stream", ".bin": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "max-age=3600" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 600000, args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });

const FOCUS = { wide: "group", medium: "center", closeup: "center", low: "monster", over_shoulder: "center", insert: "insert" };
const report = [];
for (const set of SETS) {
  const page = await browser.newPage();
  page.on("console", (m) => { const t = m.text(); if (!/GPU stall|X3595|texImage/.test(t)) console.log(`[${set}]`, t); });
  page.on("pageerror", (e) => console.log(`[${set}] page error:`, e.message));
  page.on("response", (r) => { if (r.status() >= 400) console.log(`[${set}] ${r.status()}:`, r.url()); });
  await page.setViewport({ width: 1080, height: 1920 });
  await page.goto(`http://localhost:${port}/dev/sets.html`);
  await page.waitForFunction("window.ready === true", { timeout: 120000 });
  const jobs = [];
  for (const light of LIGHTS) jobs.push({ light, cam: "wide" });
  if (CAMSETS.includes(set)) for (const cam of CAMS) jobs.push({ light: "day", cam });
  if (CAMSETS.includes(set) && LIGHTS.includes("night")) jobs.push({ light: "night", cam: "low" });
  if (["street", "woods"].includes(set) && LIGHTS.includes("night")) jobs.push({ light: process.env.TOWERLIGHT ?? "night", cam: "low", monsterSpot: "tower", tag: "tower" }, { light: "night", cam: "wide", monsterSpot: "tower", tag: "tower" });
  let loadMs = null; const ms = {};
  for (const j of jobs) {
    const name = `${set}_${j.light}_${j.cam}${j.tag ? `_${j.tag}` : ""}`;
    if (ONLY && !ONLY.has(name)) continue;
    const info = await page.evaluate((o) => window.show(o), { set, light: j.light, cam: j.cam, focus: FOCUS[j.cam], t: 0, dur: 3, seed: 3, monsterSpot: j.monsterSpot ?? "far" });
    loadMs ??= info.loadMs;
    await new Promise((r) => setTimeout(r, 300));
    const data = await page.evaluate(() => { window.snapshot(); return window.snapshot(); });
    fs.writeFileSync(path.join(outDir, `${name}.jpg`), Buffer.from(data.split(",")[1], "base64"));
    if (j.cam === "wide" && !j.tag) { ms[j.light] = Math.round(await page.evaluate(() => window.timeFrames(8))); if (process.env.INFO) console.log(JSON.stringify(await page.evaluate(() => ({ ...window.info(), ...window.timeParts() })))); }
    console.log(`${name}: cam ${info.cam.join(",")} fov ${info.fov} hit ${info.hit}${j.cam === "wide" ? `; ${ms[j.light]} ms/frame` : ""}`);
  }
  if (process.env.SWITCH) { // day -> night -> warm -> day on the same page: the last day frame must match the first
    const shotOf = async (light) => { await page.evaluate((o) => window.show(o), { set, light, cam: "wide", focus: "group", seed: 3 }); return page.evaluate(() => { window.snapshot(); return window.snapshot(); }); };
    const a = await shotOf("day"); for (const l of ["night", "warm", "day", "night", "warm"]) await shotOf(l); const b = await shotOf("day");
    const A = Buffer.from(a.split(",")[1], "base64"), B = Buffer.from(b.split(",")[1], "base64");
    fs.writeFileSync(path.join(outDir, `${set}_switch_check.jpg`), B);
    console.log(`${set}: light switching day->night->warm->day x2: ${A.equals(B) ? "identical frame" : `frames differ (${A.length} vs ${B.length} bytes)`}`);
  }
  report.push({ set, loadS: loadMs != null ? +(loadMs / 1000).toFixed(1) : null, msPerFrame: ms });
  await page.close();
}
console.log(JSON.stringify(report));
await browser.close();
server.close();
