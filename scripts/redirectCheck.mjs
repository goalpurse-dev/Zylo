// Checks the renamed-slug 301s ($0, local): serves dist/ with vercel.json's
// redirects (exact sources) + cleanUrls + the SPA rewrite, requests every old
// URL without following redirects, then opens the destination in a browser
// and checks it renders a real page (not the 404). Also greps the repo for
// internal links that still use an old slug.
//   node scripts/redirectCheck.mjs <oldToNewMap.json>
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const MAP = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const DIST = path.resolve("dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const file = (p) => { try { return fs.statSync(p).isFile() ? p : null; } catch { return null; } };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const r = vercel.redirects.find((x) => x.source === url.pathname);
  if (r) { res.writeHead(r.statusCode ?? (r.permanent ? 308 : 307), { Location: r.destination + url.search }); return res.end(); }
  const p = path.join(DIST, decodeURIComponent(url.pathname));
  const hit = file(p) || file(p + ".html") || file(path.join(p, "index.html")) || path.join(DIST, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(hit)] ?? "application/octet-stream" });
  fs.createReadStream(hit).pipe(res);
});
await new Promise((ok) => server.listen(4319, ok));
const BASE = "http://localhost:4319";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
const rows = [];
for (const [from, to] of MAP) {
  const r = await fetch(BASE + from, { redirect: "manual" });
  const loc = r.headers.get("location");
  await page.goto(BASE + loc, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(400);
  const got = await page.evaluate(() => ({ path: location.pathname, title: document.title, h1: document.querySelector("h1")?.textContent.trim().slice(0, 90) ?? "", notFound: /not found|404/i.test(document.body.innerText.slice(0, 600)) }));
  rows.push({ from, to, status: r.status, location: loc, rendersAt: got.path, title: got.title, h1: got.h1, ok: r.status === 301 && loc === to && got.path === to && !got.notFound && !!got.h1 });
}
await browser.close();
server.close();
// Internal links still using an old slug (vercel.json holds the redirects).
const olds = MAP.map(([a]) => a.replace(/^\//, ""));
const rx = new RegExp(`(?<![\\w-])(${olds.map((s) => s.replace(/[/.-]/g, "\\$&")).join("|")})(?![\\w-])`);
const tracked = execSync("git ls-files -co --exclude-standard src scripts public index.html", { encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").filter((f) => f && /\.(jsx?|mjs|md|json|xml|html|txt)$/.test(f) && f !== "scripts/redirectCheck.mjs");
const leftovers = [];
for (const f of tracked) { if (!fs.existsSync(f)) continue; fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (rx.test(l)) leftovers.push(`${f}:${i + 1}`); }); }
for (const f of fs.readdirSync(DIST, { recursive: true })) {
  const p = path.join(DIST, f);
  if (/\.(html|js|xml)$/.test(p) && fs.statSync(p).isFile() && rx.test(fs.readFileSync(p, "utf8"))) leftovers.push("dist/" + f);
}
console.log(JSON.stringify({ passed: rows.filter((r) => r.ok).length, of: rows.length, leftovers, rows }, null, 1));
