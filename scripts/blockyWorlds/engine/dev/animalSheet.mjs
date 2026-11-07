// ANIMALS contact sheets: serves the engine folder on a free port (like dev/kitShot.mjs), opens dev/animals.html in
// headless Chrome (laptop GPU, free) and saves the composite jpg.
//   node dev/animalSheet.mjs <out.jpg> "sheet=views&list=dog,cat&cols=3&cell=300"
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const puppeteer = createRequire(path.join(root, "package.json"))("puppeteer-core");
const [outFile, query = "sheet=views"] = process.argv.slice(2);
if (!outFile) { console.error("usage: node dev/animalSheet.mjs <out.jpg> <query>"); process.exit(1); }
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".ttf": "font/ttf", ".jpg": "image/jpeg", ".png": "image/png", ".hdr": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f).toLowerCase()] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, protocolTimeout: 600000, args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage();
  page.on("console", (m) => { const t = m.text(); if (!/GPU stall|X3595/.test(t)) console.log("[page]", t); });
  page.on("pageerror", (e) => console.log("[page error]", e.message));
  page.on("response", (r) => { if (r.status() >= 400) console.log(`${r.status()}:`, r.url()); });
  await page.setViewport({ width: 800, height: 800 });
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/dev/animals.html?${query}`);
  await page.waitForFunction("window.ready === true", { timeout: 540000 });
  const data = await page.evaluate(() => window.snapshot());
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(data.split(",")[1], "base64"));
  console.log(`${outFile} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await browser.close(); server.close(); }
