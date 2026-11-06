// M3: the look meter (the owner's go of 2026-11-05, step A of the batch-2 look study). Free, local.
// For saved plans (m3/sweep/plans, m3/sweep/known): the timeline as a real run makes it, rendered small at 10 fps in
// headless Chrome, measured the same way as the 21 competitor videos (research/seamless-niche/work/b2/motion.mjs):
//   still   share of frame steps where almost nothing changes (mean |diff| < 0.6 of 255)
//   motion  mean |diff| per step
//   fast    frame steps with a big change (mean |diff| > 28) per minute: fast camera moves, whips, flashes
// and from the timeline (no render): fill = the median width share of the part each line shows at its moment;
// capOn = the share of lines whose caption band crosses that part.
// Competitor medians (batch 2, 21 videos): still 19%, motion 5.8, fast 27/min.
//   node m3/lookMeter.mjs --proto PROTO [--only a,b] [--known] [--out DIR] [--tag before]
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), M2 = path.join(here, "../m2");
const argv = process.argv.slice(2), a = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
const PROTO = path.resolve(a.proto), OUT = path.resolve(a.out ?? path.join(PROTO, "..", "look_meter")), TAG = a.tag ?? "now";
fs.mkdirSync(OUT, { recursive: true });
const imp = (f) => import(pathToFileURL(path.join(M2, f)).href);
const { layoutRules } = await imp("layoutRules.js"), { compile } = await imp("compile.mjs"), { draftWords } = await imp("plan.js");
const { preparePage } = await imp("make.mjs"), { previewTimes } = await imp("checks.mjs"), { focusOf } = await imp("focus.js");
const { cameraAt, projectBox } = await imp("director.js"), { measureKey } = await imp("framing.js");
const puppeteer = createRequire(path.join(PROTO, "package.json"))("puppeteer-core");

const W = 270, H = 480, FPS = 10;
const dirs = [path.join(here, "sweep", "plans"), ...(a.known ? [path.join(here, "sweep", "known")] : [])];
const only = a.only ? String(a.only).split(",") : null;
const files = dirs.flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => ({ d, name: f.replace(/\.json$/, "") }))).filter((x) => !only || only.includes(x.name));

const server = http.createServer((req, res) => {
  const f = path.join(PROTO, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(PROTO) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" }[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=d3d11", "--enable-gpu"] });

function plan(x) {
  const P = JSON.parse(fs.readFileSync(path.join(x.d, `${x.name}.json`), "utf8")), S = P.sentences, roles = S.map((s) => s.role);
  let layout = { ...P.layout, roles, key: `look_${x.name}` };
  if (!layout.codeShots && !layout.camera) layout = layoutRules(layout).layout;
  const words = draftWords(S), tl = compile(layout, words, words.at(-1).e + 0.1, { roles });
  return { layout, tl, words };
}
// the part each line shows: its width share at the line's moment, and whether the caption band crosses it
function framing(layout, tl, words) {
  const fill = [], capOn = [], area = [];
  // (area: the share of the frame the build covers at each line's moment, the measure the camera checks use)
  // (main: the main part's width share of the frame at each line's middle: the washer, the bunker, the pool; the measure
  // the eye reads as "how big is the thing"; area from measureKey read 0% for the washer, so it is not used)
  const mp = layout.parts.find((p) => p.main) ?? null; let mb = null; try { mb = mp && focusOf(mp, layout.world?.cut); } catch {}
  for (const s of tl.sentences) { if (s.role === "congrats" || !mb) continue; const k = cameraAt(tl.camera.end, (s.t0 + s.t1) / 2), r = projectBox(k.pos, k.tgt, mb); area.push(r.behind ? 0 : Math.max(0, Math.min(1, r.x1) - Math.max(0, r.x0))); }
  for (const pt of previewTimes(tl, layout)) {
    const b = layout.beats?.find((x) => x.s === pt.role), part = b?.shows && layout.parts.find((p) => p.id === b.shows.p);
    let box = null; try { box = part && focusOf(part, layout.world?.cut); } catch {}
    if (!box) continue;
    const k = cameraAt(tl.camera.end, pt.t), r = projectBox(k.pos, k.tgt, box);
    const w = r.behind ? 0 : Math.max(0, Math.min(1, r.x1) - Math.max(0, r.x0));
    fill.push(w);
    // (captionY is by word: the word said at the line's moment)
    const i = Math.max(0, words.findIndex((w) => w.e > pt.t)), cy = tl.captionY?.[i] ?? 0.52;
    capOn.push(!r.behind && w > 0 && r.y0 < cy + 0.03 && r.y1 > cy - 0.03 && r.x0 < 0.62 && r.x1 > 0.38);
  }
  const med = (v) => (v.length ? [...v].sort((p, q) => p - q)[Math.floor(v.length / 2)] : 0);
  return { main: area.length ? +med(area).toFixed(2) : null, fill: +med(fill).toFixed(2), capOn: +(capOn.filter(Boolean).length / Math.max(1, capOn.length)).toFixed(2) };
}
async function render(layout, tl, dir, mainOnly = false) {
  preparePage({ layout, tl, proto: PROTO });
  if (!mainOnly) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); }
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  await page.goto(`http://localhost:${server.address().port}/m2_${layout.key}.html`);
  await page.waitForFunction("window.ready === true", { timeout: 90000 });
  // the main part's real width on screen at each line's middle (window.mainWidthAt, makePage.mjs), before the frames
  const mains = [];
  for (const s of tl.sentences) { if (s.role === "congrats") continue; const w = await page.evaluate((t) => (window.mainWidthAt ? window.mainWidthAt(t) : null), (s.t0 + s.t1) / 2); if (w != null) mains.push(w); }
  const main = mains.length ? +[...mains].sort((p, q) => p - q)[Math.floor(mains.length / 2)].toFixed(2) : null;
  if (mainOnly) { await page.close(); return { main }; }
  const L = tl.marks?.lengthEnd ?? 30;
  for (let i = 0, t = 0; t <= L; i++, t = i / FPS) {
    const data = await page.evaluate((t) => { window.renderAt(t); return document.querySelector("canvas").toDataURL("image/jpeg", 0.8); }, t);
    fs.writeFileSync(path.join(dir, `f_${String(i).padStart(4, "0")}.jpg`), Buffer.from(data.split(",")[1], "base64"));
  }
  await page.close();
  return { main };
}
// the competitor measures, on the frames (the caption rows skipped as in motion.mjs; our frames have no captions)
function measure(dir) {
  const GW = 108, GH = 192, N = GW * GH;
  const r = spawnSync("ffmpeg", ["-v", "error", "-framerate", String(FPS), "-i", path.join(dir, "f_%04d.jpg"), "-vf", `scale=${GW}:${GH},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  const buf = r.stdout, F = Math.floor(buf.length / N);
  let still = 0, fast = 0, sum = 0, steps = 0;
  for (let f = 1; f < F; f++) {
    let d = 0, n = 0;
    for (let by = 0; by < 12; by++) { if (by >= 6 && by <= 8) continue; for (let y = by * 16; y < by * 16 + 16; y++) for (let x = 0; x < GW; x++) { d += Math.abs(buf[(f - 1) * N + y * GW + x] - buf[f * N + y * GW + x]); n++; } }
    const m = d / n; steps++; sum += m; if (m > 28) fast++; else if (m < 0.6) still++;
  }
  return { sec: +(F / FPS).toFixed(1), still: +(still / steps).toFixed(2), motion: +(sum / steps).toFixed(2), fast: +(fast / (F / FPS / 60)).toFixed(1) };
}

// (three pages at once: a plan's page file is its own, m2_look_<plan>.html)
const rows = [], queue = [...files];
const one = async (x) => {
  try {
    const { layout, tl, words } = plan(x), fr = framing(layout, tl, words), dir = path.join(OUT, "frames", TAG, `${x.d.endsWith("known") ? "known_" : ""}${x.name}`);
    if (a["no-render"]) { rows.push({ plan: x.name, known: x.d.endsWith("known"), ...fr }); return; }
    const { area: _a, main: _m, ...fr2 } = fr;
    const rr = await render({ ...layout, key: `look_${x.d.endsWith("known") ? "known_" : ""}${x.name}` }, tl, dir, !!a["main-only"]);
    if (a["main-only"]) { rows.push({ plan: x.name, known: x.d.endsWith("known"), ...fr2, main: rr.main }); console.log(`[look] ${x.name} main ${rr.main}`); return; }
    const m = measure(dir);
    rows.push({ plan: x.name, known: x.d.endsWith("known"), ...m, ...fr2, main: rr.main });
    console.log(`[look] ${JSON.stringify(rows.at(-1))}`);
  } catch (e) { rows.push({ plan: x.name, error: String(e.message).slice(0, 200) }); console.log(`[look] ${x.name} ERROR ${e.message}`); }
};
await Promise.all(Array.from({ length: Number(a.jobs ?? 3) }, async () => { while (queue.length) await one(queue.shift()); }));
await browser.close(); server.close();
if (a["no-render"] || a.merge || a["main-only"]) { const fp = path.join(OUT, `look_${TAG}.json`), old = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf8")).rows : []; const key = (r) => `${r.known ? "k:" : ""}${r.plan}`, by = new Map(old.map((r) => [key(r), r])); for (const r of rows) by.set(key(r), r.error && by.get(key(r)) && !by.get(key(r)).error ? by.get(key(r)) : { ...(by.get(key(r)) ?? {}), ...r, ...(r.error ? {} : { error: undefined }) }); rows.length = 0; rows.push(...by.values()); }
const ok = rows.filter((r) => !r.error), med = (k) => { const v = ok.map((r) => r[k]).sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; };
const summary = { tag: TAG, plans: ok.length, errors: rows.length - ok.length, still: med("still"), motion: med("motion"), fast: med("fast"), main: med("main"), fill: med("fill"), capOn: med("capOn") };
fs.writeFileSync(path.join(OUT, `look_${TAG}.json`), JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 1));
console.log(`LOOK ${JSON.stringify(summary)}`);
