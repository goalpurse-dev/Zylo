// AUDIO agent: render caption stills in headless Chrome -> out/dev/captions/*.png (+ sheet.png contact sheet).
// node dev/captionsPreview.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(".");
const OUT = path.join(ROOT, "out/dev/captions");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".ttf": "font/ttf", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] ?? "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const wordsFile = path.join(ROOT, "out/dev/audio/words.json");
const words = fs.existsSync(wordsFile) ? JSON.parse(fs.readFileSync(wordsFile, "utf8")) : [{ word: "whisper,", start: 0, end: 0.4 }];
const extra = [
  { word: "Barnaby!", start: 0, end: 0.5 },
  { word: "Supercalifragilisticexpialidocious", start: 0, end: 0.5 },
  { word: "SHH", start: 0, end: 0.5 },
];
const find = (w) => words.find((x) => x.word === w) ?? words[0];
const shots = [
  ["dark", words, find("Listener").start + 0.2, "listener_dark"],
  ["sky", words, find("whisper,").start + 0.2, "whisper_sky"],
  ["sky", words, find("I'm").start + 0.2, "im_sky"],
  ["dark", [extra[0]], 0.2, "barnaby_dark"],
  ["sky", [extra[1]], 0.2, "longword_sky"],
  ["dark", [extra[2]], 0.2, "caps_dark"],
  // pop-in sequence of one word
  ...[0, 0.02, 0.04, 0.054, 0.07, 0.09].map((a, k) => ["dark", words, find("town,").start + a, `pop_${k}_${Math.round(a * 1000)}ms`]),
  // hold: 0.1 s after the end of a line's last word (kept) and 0.3 s after (gone)
  ["dark", words, find("name.").end + 0.1, "hold_0.1s"],
  ["dark", words, find("name.").end + 0.3, "hold_0.3s_empty"],
];

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--use-angle=default", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage();
  page.on("console", (m) => console.log("[page]", m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.goto(`http://127.0.0.1:${port}/dev/captions.html`);
  await page.waitForFunction("window.ready && window.ready.then", { timeout: 15000 });
  await page.evaluate("window.ready");
  const files = [];
  for (const [bg, caps, t, name] of shots) {
    const url = await page.evaluate((bg, caps, t) => window.still(bg, caps, t), bg, caps, t);
    const f = path.join(OUT, `${name}.png`);
    fs.writeFileSync(f, Buffer.from(url.split(",")[1], "base64"));
    files.push(f);
  }
  console.log(files.join("\n"));
  // contact sheet (each still at 1/4 size, 6 per row)
  const inputs = files.flatMap((f) => ["-i", f]);
  const n = files.length, cols = 6, rows = Math.ceil(n / cols);
  const pads = Array.from({ length: cols * rows - n }, () => "color=c=black:s=270x480:d=1[p]").map((s, k) => s.replace("[p]", `[p${k}]`));
  const scaled = files.map((_, k) => `[${k}:v]scale=270:480[s${k}]`);
  const labels = [...files.map((_, k) => `[s${k}]`), ...pads.map((_, k) => `[p${k}]`)].join("");
  const fc = [...scaled, ...pads, `${labels}xstack=inputs=${cols * rows}:layout=${Array.from({ length: cols * rows }, (_, k) => `${(k % cols) * 270}_${Math.floor(k / cols) * 480}`).join("|")}`].join(";");
  spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", fc, "-frames:v", "1", path.join(OUT, "sheet.png")], { stdio: "inherit" });
  console.log(path.join(OUT, "sheet.png"));
} finally {
  await browser.close();
  server.close();
}
