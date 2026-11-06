// Zyvo YouTube tutorials: films the cards of cards.js ($0, local Chrome). A card spec + a length -> an mp4 (silent,
// 1920x1080, 30 fps); a thumbnail spec -> a 1280x720 PNG. Cached by the spec's hash, so re-assembling is fast.
//   import { filmCards } from "./cards.mjs"; await filmCards([{ spec, secs, out }, ...])
//   node cards.mjs <spec.json> <out.mp4|png> [secs]      one card, for a look
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROTO = process.env.PROTO_DIR ?? "C:/Users/Public/Zylo-contentmachine/content/studio-worker/proto";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
export const FPS = 30;
export const cardKey = (spec, secs) => crypto.createHash("sha1").update(JSON.stringify({ spec, secs, v: 1 })).digest("hex").slice(0, 12);

function serve() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    // pictures by absolute path (a frame of a real video, a credited thumbnail); the page itself from this folder
    const f = u.pathname === "/file" ? u.searchParams.get("p") : path.join(HERE, u.pathname);
    if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    const ext = path.extname(f).toLowerCase();
    res.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[ext] ?? "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  }).listen(0);
  return server;
}

/** jobs: [{ spec, secs, out }] (out .mp4 or .png). Skips outputs that already exist. */
export async function filmCards(jobs, log = console.log) {
  const todo = jobs.filter((j) => !fs.existsSync(j.out));
  if (!todo.length) return;
  const server = serve(), port = server.address().port;
  const puppeteer = createRequire(path.join(PROTO, "package.json"))("puppeteer-core");
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--force-device-scale-factor=1"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`http://localhost:${port}/cards.html`);
    await page.waitForFunction(() => window.ready === true);
    for (const j of todo) {
      fs.mkdirSync(path.dirname(j.out), { recursive: true });
      const grab = (t, type = "image/jpeg") => page.evaluate(async (spec, t, secs, type) => { await window.renderCard(spec, t, secs); return document.getElementById("out").toDataURL(type, 0.92); }, j.spec, t, j.secs, type);
      if (j.out.endsWith(".png")) {
        fs.writeFileSync(j.out, Buffer.from((await grab(0, "image/png")).split(",")[1], "base64"));
        log(`card ${path.basename(j.out)}`);
        continue;
      }
      const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-r", String(FPS), j.out], { stdio: ["pipe", "inherit", "inherit"] });
      const n = Math.max(1, Math.round(j.secs * FPS));
      for (let i = 0; i < n; i++) {
        const buf = Buffer.from((await grab(i / FPS)).split(",")[1], "base64");
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      }
      ff.stdin.end();
      await new Promise((ok, no) => ff.on("close", (c) => (c === 0 ? ok() : no(new Error(`ffmpeg ${c} on ${j.out}`)))));
      log(`card ${path.basename(j.out)} (${j.secs.toFixed(1)} s)`);
    }
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [specFile, out, secs = "2.5"] = process.argv.slice(2);
  await filmCards([{ spec: JSON.parse(fs.readFileSync(specFile, "utf8")), secs: Number(secs), out: path.resolve(out) }]);
}
