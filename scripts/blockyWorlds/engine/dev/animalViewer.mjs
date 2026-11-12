// ANIMAL VIEWER builder (dev only, 2026-11-07, free: laptop GPU + local ffmpeg). Renders per animal a big FRONT and SIDE
// still, a 3/4 thumbnail, every variant as a 3/4 still, a looping clip of its main motion and one of a giant action,
// into <outDir>/img and <outDir>/clips, and writes <outDir>/data.js for the viewer page. Skips files that exist.
//   node dev/animalViewer.mjs <outDir> [dog,cat,...] [stills|clips|all]
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const puppeteer = createRequire(path.join(root, "package.json"))("puppeteer-core");
const [outDir, listArg = "", parts = "all"] = process.argv.slice(2);
if (!outDir) { console.error("usage: node dev/animalViewer.mjs <outDir> [list] [stills|clips|all]"); process.exit(1); }
const IMG = path.join(outDir, "img"), CLIPS = path.join(outDir, "clips");
fs.mkdirSync(IMG, { recursive: true }); fs.mkdirSync(CLIPS, { recursive: true });

const MAIN = (sp, plan) => plan === "bird" ? "fly" : plan === "fish" || plan === "pinniped" || plan === "cephalopod" ? "swim"
  : plan === "serpent" ? "slither" : plan === "mollusc" || plan === "insect" ? "crawl" : "walk";
const ATTACKERS = new Set(["wolf", "bear", "shark", "dragon", "snake", "octopus", "eagle", "yeti", "cat", "dog", "fish"]);
const ACTION = (sp) => ATTACKERS.has(sp) ? "attack" : "roar";

const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".ttf": "font/ttf", ".jpg": "image/jpeg", ".png": "image/png", ".hdr": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f).toLowerCase()] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 600000, args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage();
  page.on("console", (m) => { const t = m.text(); if (!/GPU stall|X3595/.test(t)) console.log("[page]", t); });
  page.on("pageerror", (e) => console.log("[page error]", e.message));
  await page.goto(`http://localhost:${port}/dev/animalViewer.html`);
  await page.waitForFunction("window.ready === true", { timeout: 300000 });
  const SPECIES = await page.evaluate(() => window.SPECIES);
  const list = listArg ? listArg.split(",") : Object.keys(SPECIES);
  const data = [];
  for (const sp of Object.keys(SPECIES)) {
    const { plan, variants } = SPECIES[sp];
    const main = MAIN(sp, plan), action = ACTION(sp);
    data.push({ species: sp, plan, variants, main, action });
    if (!list.includes(sp)) continue;
    const t0 = Date.now();
    if (parts !== "clips") {
      for (const view of ["front", "side"]) {
        const f = path.join(IMG, `${sp}_${view}.jpg`);
        if (!fs.existsSync(f)) save(f, await page.evaluate((a) => window.still(a), { species: sp, view, size: 720 }));
      }
      const th = path.join(IMG, `${sp}_thumb.jpg`);
      if (!fs.existsSync(th)) save(th, await page.evaluate((a) => window.still(a), { species: sp, view: "3/4", size: 360, person: false }));
      for (const v of variants) {
        const f = path.join(IMG, `${sp}_var_${v}.jpg`);
        if (!fs.existsSync(f)) save(f, await page.evaluate((a) => window.still(a), { species: sp, variant: v, view: "3/4", size: 400, person: false }));
      }
    }
    if (parts !== "stills") {
      for (const [kind, act] of [["move", main], ["act", action]]) {
        const f = path.join(CLIPS, `${sp}_${kind}.mp4`);
        if (fs.existsSync(f)) continue;
        const dur = kind === "move" ? await page.evaluate((a) => window.loopLen(a), { species: sp, act, want: 2.5 }) : 2.5;
        const opts = act === "attack" ? { hitAt: 1.0 } : {};
        const frames = await page.evaluate((a) => window.clip(a), { species: sp, act, t0: act === "fly" ? 1.0 : 0, dur, fps: 24, size: 512, opts, view: plan === "serpent" ? "high" : kind === "move" ? "side" : "3/4" });
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "av-"));
        frames.forEach((d, i) => save(path.join(tmp, `f${String(i).padStart(4, "0")}.jpg`), d));
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "24", "-i", path.join(tmp, "f%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-preset", "medium", "-movflags", "+faststart", f]);
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
    console.log(`${sp} done (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  fs.writeFileSync(path.join(outDir, "data.js"), `window.ANIMAL_DATA = ${JSON.stringify(data, null, 1)};\n`);
} finally { await browser.close(); server.close(); }
