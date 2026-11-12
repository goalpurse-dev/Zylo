// Blocky Worlds RunPod worker: the SIMPLE-STYLE TEST role (2026-11-10, owner: "do a quick style test first ... rendered
// on RunPod"). A separate test page (page/simple/), never the production engine page. No paid API call: only rendering.
// role "simpleStills": { code?: string (page/simple/simple.js sent inline: the look can be iterated without an image
//   rebuild; written to the job folder and loaded as /job/simple.js), shots: [{ label, sheet?: true, ...spec }],
//   quality = 0.9, out?: { uploads: { [file]: signedPutUrl }, manifest?: signedPutUrl } }
//   ONE page load, every shot in order (window.renderShot / window.renderSheet), a black capture re-rendered up to 4x.
// -> { role, stills: [{ label, file, bytes, mean, ms, lut }], loadMs, renderer, info, timing }
import fs from "node:fs";
import path from "node:path";
import { startServer, launchBrowser } from "../render.mjs";
import { deliver } from "./stillsRole.mjs";

const coded = (code, message) => Object.assign(new Error(message), { code });
const safeName = (s) => String(s ?? "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
export const simpleFileNames = (shots) => shots.map((s, i) => `${String(i).padStart(3, "0")}_${safeName(s.label ?? `shot${i}`)}.jpg`);

export async function renderSimpleStills({ shots, code = null, dir, quality = 0.9, log = console.log, browser: given = null }) {
  if (!Array.isArray(shots) || !shots.length) throw coded("BAD_JOB", "no shots");
  fs.mkdirSync(dir, { recursive: true });
  if (code != null) { if (typeof code !== "string" || code.length > 2_000_000) throw coded("BAD_JOB", "code must be a string under 2 MB"); fs.writeFileSync(path.join(dir, "simple.js"), code); }
  const names = simpleFileNames(shots);
  const srv = await startServer(dir), browser = given ?? (await launchBrowser());
  const t0 = Date.now();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log(`simple page: ${m.text().slice(0, 400)}`); });
    page.on("pageerror", (e) => { errors.push(e.message); log(`simple page error: ${e.message}`); });
    await page.setViewport({ width: 1080, height: 1920 });
    await page.goto(`http://127.0.0.1:${srv.port}/page/simple/index.html${code != null ? "?code=/job/simple.js" : ""}`);
    try { await page.waitForFunction("window.ready === true || !!window.engineError", { timeout: 180000, polling: 100 }); }
    catch (e) { throw new Error(`simple page never became ready (${e.message})${errors.length ? `: ${errors.join(" | ")}` : ""}`); }
    const err = await page.evaluate(() => window.engineError ?? null);
    if (err) throw new Error(err);
    const info = await page.evaluate(() => window.simpleInfo?.() ?? null);
    const loadMs = Date.now() - t0, out = [];
    log(`simple: page loaded in ${loadMs} ms, ${shots.length} shots`);
    for (const [i, s] of shots.entries()) {
      const a = Date.now();
      try {
        let r = null;
        for (let k = 0; k < 5; k++) {
          r = await page.evaluate((s, q) => (s.sheet ? window.renderSheet({ ...s, quality: q }) : window.renderShot({ ...s, quality: q })), s, s.quality ?? quality);
          if (r.mean == null || r.mean >= 3) break;
          await new Promise((res) => setTimeout(res, 60 * (k + 1)));
        }
        const jpeg = Buffer.from(r.data.slice(r.data.indexOf(",") + 1), "base64");
        fs.writeFileSync(path.join(dir, names[i]), jpeg);
        out.push({ label: safeName(s.label ?? `shot${i}`), file: names[i], bytes: jpeg.length, mean: r.mean, lut: r.lut, pageMs: r.ms, ms: Date.now() - a });
      } catch (e) { out.push({ label: safeName(s.label ?? `shot${i}`), file: null, error: String(e.message ?? e).slice(0, 300), ms: Date.now() - a }); }
    }
    await page.close().catch(() => {});
    return { stills: out, loadMs, info, errors: errors.slice(0, 10), ms: Date.now() - t0 };
  } finally { if (!given) await browser.close().catch(() => {}); srv.close(); }
}

/** the role for worker.mjs (gpuCheck = its renderer(mode); put = its upload helper) */
export async function simpleStillsJob(job, dir, { gpuCheck, put }) {
  const s = job.simple ?? job, timing = {};
  let t = Date.now();
  const renderer = await gpuCheck(job.mode ?? "gpu");
  timing.gpuCheck = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  const d = path.join(dir, "simple");
  const res = await renderSimpleStills({ shots: s.shots, code: s.code ?? null, dir: d, quality: s.quality ?? 0.9 });
  timing.render = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  await deliver(res, d, s.out, put);
  timing.upload = +((Date.now() - t) / 1000).toFixed(2);
  return { role: "simpleStills", renderer, loadMs: res.loadMs, info: res.info, errors: res.errors, stills: res.stills, timing };
}
