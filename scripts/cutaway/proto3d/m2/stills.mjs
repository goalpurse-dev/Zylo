// M2: renders stills of a page at given times (lossless PNG), for frame comparisons and preview checks. $0, local.
//   node m2/stills.mjs <page.html[?query]> <outDir> <times: "a,b,c" or "from:to:step"; "t@c": the scene at t, the camera at c>
// Serves the folder above m2/ (the proto folder with node_modules and assets). Files: <outDir>/f_<index>.png
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "node:url";

const [pageArg, outDir, timesArg] = process.argv.slice(2);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const times = timesArg.includes(":") ? (() => { const [a, b, s] = timesArg.split(":").map(Number); const out = []; for (let k = 0; a + k * s <= b + 1e-9; k++) out.push(+(a + k * s).toFixed(4)); return out; })() : timesArg.split(",").map((x) => (x.includes("@") ? x.split("@").map(Number) : Number(x)));
fs.mkdirSync(outDir, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
// the same launch as render.mjs: a render server sets CHROME_PATH and its GPU flags in CHROME_ARGS (the production preview
// gate crashed on the GPU server with this laptop's Chrome path written in, 2026-10-25)
const chromeArgs = process.env.CHROME_ARGS ? JSON.parse(process.env.CHROME_ARGS) : null;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, ...(chromeArgs ? { ignoreDefaultArgs: ["--use-angle=swiftshader-webgl", "--disable-gpu"] } : {}), args: chromeArgs ?? (process.env.SOFTWARE_GL ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu"] : ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"]) });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("page error:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("page:", m.text()); });
await page.setViewport({ width: 1080, height: 1920 });
await page.goto(`http://localhost:${server.address().port}/${pageArg}`);
await page.waitForFunction("window.ready === true", { timeout: 60000 });
const t0 = Date.now();
for (let i = 0; i < times.length; i++) {
  // a time "t@c": the scene at t, the camera at c (the flicker check)
  const grab = () => page.evaluate((t) => { if (Array.isArray(t)) window.renderAt(t[0], t[1]); else window.renderAt(t); const c = document.querySelector("canvas"); c.getContext("webgl2")?.finish?.(); return c.toDataURL("image/png"); }, times[i]);
  // (a blank capture on the GPU server, as in render.mjs, is taken again: the real checker failed a pool hook for a black
  // frame in its strip, 2026-10-30; a real frame's PNG is megabytes, an empty one a few KB)
  let data = await grab();
  for (let k = 0; k < 6 && data.length < 200000; k++) { await new Promise((r) => setTimeout(r, 40 * (k + 1))); data = await grab(); }
  fs.writeFileSync(path.join(outDir, `f_${String(i).padStart(3, "0")}.png`), Buffer.from(data.split(",")[1], "base64"));
}
fs.writeFileSync(path.join(outDir, "times.json"), JSON.stringify(times));
console.log(`${times.length} stills in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${outDir}`);
await browser.close();
server.close();
