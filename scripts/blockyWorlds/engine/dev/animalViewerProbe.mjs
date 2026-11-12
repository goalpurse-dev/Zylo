// dev probe: which meshes of an animal stretch its box (for the viewer framing)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const puppeteer = createRequire(path.join(root, "package.json"))("puppeteer-core");
const sp = process.argv[2] ?? "wolf";
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f).toLowerCase()] ?? "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("[page error]", e.message));
  await page.goto(`http://localhost:${server.address().port}/dev/animalViewer.html`);
  await page.waitForFunction("window.ready === true", { timeout: 120000 });
  console.log(await page.evaluate(async (sp) => {
    const { makeAnimal, animateAnimal } = await import("/page/kit/animals/index.js");
    const THREE = await import("three");
    const g = makeAnimal({ species: sp }); animateAnimal(g, "idle", 0.2); g.updateMatrixWorld(true);
    const U = g.userData, b = window.visBox(g), full = new THREE.Box3().setFromObject(g);
    const rows = [`userData L=${U.length?.toFixed(2)} W=${U.width?.toFixed(2)} H=${U.height?.toFixed(2)}`, `visBox ${b.min.toArray().map((v) => v.toFixed(2))} .. ${b.max.toArray().map((v) => v.toFixed(2))}`, `full ${full.min.toArray().map((v) => v.toFixed(2))} .. ${full.max.toArray().map((v) => v.toFixed(2))}`];
    g.traverseVisible((o) => { if (!o.isMesh) return; const bb = new THREE.Box3().setFromObject(o); const s = bb.getSize(new THREE.Vector3()); if (Math.abs(bb.max.x) > U.width || Math.abs(bb.min.x) > U.width || bb.max.y > U.height * 1.2) rows.push(`${o.name || o.type} ${o.material?.type} vis=${o.material?.visible} op=${o.material?.opacity} ${bb.min.toArray().map((v) => v.toFixed(2))}..${bb.max.toArray().map((v) => v.toFixed(2))}`); });
    return rows.join("\n");
  }, sp));
} finally { await browser.close(); server.close(); }
