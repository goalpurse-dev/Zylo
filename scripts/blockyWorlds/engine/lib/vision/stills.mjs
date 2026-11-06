// Blocky Worlds shot review: the stills of a planned timeline, as the video will show them, before any chunk renders.
// The real engine page (page/index.html + renderAt + frameData, as render.mjs renderStills does) on a COPY of the
// timeline: no captions (the judge must see the picture, not the caption word) and a small frame (432 x 768 by
// default: the same 9:16 framing, ~443 image tokens a still). One Chrome, one page load for the whole batch; a later
// round renders only the re-planned shots from a SUB-timeline (those shots, re-timed back to back), so its page loads
// only their sets.
//   const r = await makeShotStills({ dir, size, browser? })
//   await r.renderTimeline(tl, picks)  picks = [{ key, t }] (timeline seconds) -> [{ key, t, file, jpeg, w, h, ms, mean, shot }]
//   await r.close()
//   node lib/vision/stills.mjs <timeline.json> [--out dir] [--size 768] [--limit n]   (free: renders every shot's stills, prints the timings)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer, launchBrowser, openPage } from "../../render.mjs";
import { stillPicks, stillTimeline } from "./requirements.js";
export { stillTimeline, subTimeline } from "./requirements.js";

export async function makeShotStills({ dir, size = 768, browser: given = null, log = () => {} } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const srv = await startServer(dir);
  const browser = given ?? (await launchBrowser());
  let n = 0;
  return {
    dir,
    /** one page load for the timeline, then every pick in order; a pick that fails is returned with an error, never thrown */
    async renderTimeline(tl, picks, { name = `review${++n}`, onLoad = null } = {}) {
      const st = stillTimeline(tl, { size });
      const tlName = `${name}.json`;
      fs.writeFileSync(path.join(dir, tlName), JSON.stringify(st));
      const t0 = Date.now();
      const page = await openPage(browser, { port: srv.port, tlName, W: st.width, H: st.height, label: ` ${name}` });
      const loadMs = Date.now() - t0;
      onLoad?.(loadMs);
      log(`stills: page loaded in ${loadMs} ms (${st.width}x${st.height}, ${tl.shots.length} shots)`);
      const out = [];
      try {
        for (const p of picks) {
          const a = Date.now();
          try {
            let r = await page.evaluate((t) => { const r = window.renderAt(t); return { ...r, data: window.frameData(0.85) }; }, p.t);
            // the blank-frame guard (as render.mjs): an empty frame is rendered once more
            if (r.mean != null && r.mean < 3) r = await page.evaluate((t) => { window.renderAt(t); const r = window.renderAt(t); return { ...r, data: window.frameData(0.85) }; }, p.t);
            const jpeg = Buffer.from(r.data.slice(r.data.indexOf(",") + 1), "base64");
            const file = path.join(dir, `${name}-${p.key}.jpg`);
            fs.writeFileSync(file, jpeg);
            out.push({ ...p, file, jpeg, w: st.width, h: st.height, ms: Date.now() - a, mean: r.mean ?? null, shot: r.shot ?? null });
          } catch (e) { out.push({ ...p, error: String(e.message ?? e).slice(0, 200), ms: Date.now() - a }); }
        }
      } finally { await page.close().catch(() => {}); }
      return { stills: out, loadMs, ms: Date.now() - t0 };
    },
    async close() { if (!given) await browser.close().catch(() => {}); srv.close(); },
  };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const tlPath = args.find((a) => !a.startsWith("--") && a.endsWith(".json"));
  if (!tlPath) { console.error("usage: node lib/vision/stills.mjs <timeline.json> [--out dir] [--size 768] [--limit n]"); process.exit(2); }
  const tl = JSON.parse(fs.readFileSync(tlPath, "utf8"));
  const out = path.resolve(opt("--out", path.join(path.dirname(path.resolve(tlPath)), "shot-stills")));
  let picks = stillPicks(tl);
  const limit = Number(opt("--limit", 0)); if (limit) picks = picks.slice(0, limit);
  const T0 = Date.now();
  const r = await makeShotStills({ dir: out, size: Number(opt("--size", 768)), log: console.log });
  try {
    const res = await r.renderTimeline(tl, picks.map((p) => ({ key: p.key, t: p.t })));
    const ok = res.stills.filter((s) => !s.error), ms = ok.map((s) => s.ms).sort((a, b) => a - b);
    console.log(`${ok.length}/${picks.length} stills (${tl.shots.length} shots) in ${(res.ms / 1000).toFixed(1)} s: page load ${(res.loadMs / 1000).toFixed(1)} s, per still median ${ms[ms.length >> 1]} ms, max ${ms.at(-1)} ms, total ${(ms.reduce((a, b) => a + b, 0) / 1000).toFixed(1)} s; errors: ${res.stills.filter((s) => s.error).map((s) => `${s.key}: ${s.error}`).join("; ") || "none"}`);
    console.log(`wall incl. Chrome start: ${((Date.now() - T0) / 1000).toFixed(1)} s -> ${out}`);
  } finally { await r.close(); }
}
