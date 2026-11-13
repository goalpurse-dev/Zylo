// STUDIO MODE: the page-code-in-job bundle (same idea as engine/dev/simple/bundle.mjs, own copy so the engine's file is
// untouched). One ES module for the image's simpleStills role (runpod/simpleRole.mjs): the production engine page with
// every page / lib file changed since the image's build, the board set swapped for studio/page/studioBoard.js (the real
// board.js rides along as /page/simple/board.base.js), the timeline (captions kept for the final, dropped for previews)
// and the agent's validated shot / asset code as base64 DATA (decoded and compiled in the page only).
//   window.renderShot({ t })                       one frame (JPEG data URL)
//   window.renderSheet({ frames: [{ t, label }], cols, tw, th, labels })   frames tiled in one JPEG: the preview contact
//     sheets (small, labelled) and the final's frame packs (2 x 2 full-size frames, no labels); r.lut carries the page's
//     shot-code errors back (the role copies that field into its output)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, "../engine");
const STUB_POST = `export const POST = {}; export function makeRenderer() { throw new Error("bundle stub: page/post.js"); } export function makePost() { throw new Error("bundle stub: page/post.js"); }`;
const b64 = (s) => Buffer.from(String(s), "utf8").toString("base64");

/** the image's build commit: the engine files changed since it ship in the job (default: the build of blocky-simple27) */
export const IMAGE_SINCE = "83fe6397";

export async function makeStudioBundle({ timeline, shots, assets = {}, homes = {}, creatures = [], captions = false, since = IMAGE_SINCE }) {
  const { changedFiles } = await import(pathToFileURL(path.join(ENGINE, "dev/simple/bundle.mjs")).href);
  const overrides = {
    "/page/post.js": STUB_POST,
    "/page/simple/board.js": fs.readFileSync(path.join(HERE, "page/studioBoard.js"), "utf8"),
    "/page/simple/board.base.js": fs.readFileSync(path.join(ENGINE, "page/simple/board.js"), "utf8"),
    "/studio/world.js": fs.readFileSync(path.join(HERE, "world.js"), "utf8"),
  };
  const files = [...new Set(["/page/engine.js", ...changedFiles(since)])];
  // every page / lib module that imports an override or a changed file ships too (else it loads the image's old copy)
  const all = [];
  const walk = (d) => { for (const e of fs.readdirSync(path.join(ENGINE, d), { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) all.push(`/${p}`); } };
  walk("page"); walk("lib");
  const want = new Set(files), hit = new Set([...Object.keys(overrides), ...files]);
  for (let grew = true; grew;) {
    grew = false;
    for (const f of all) {
      if (want.has(f) || hit.has(f)) continue;
      const src = fs.readFileSync(path.join(ENGINE, f.slice(1)), "utf8");
      const imps = [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"'\n]+)\1/g)].map((m) => (m[2].startsWith(".") ? path.posix.join(path.posix.dirname(f), m[2]) : m[2]));
      if (imps.some((x) => hit.has(x))) { want.add(f); hit.add(f); grew = true; }
    }
  }
  const SOURCES = {};
  for (const f of want) if (fs.existsSync(path.join(ENGINE, f.slice(1)))) SOURCES[f] = fs.readFileSync(path.join(ENGINE, f.slice(1)), "utf8");
  Object.assign(SOURCES, overrides);
  const tl = { ...timeline, captions: captions ? timeline.captions ?? [] : [] };
  const STUDIO = { shots: Object.fromEntries(Object.entries(shots).map(([k, v]) => [k, b64(v)])), assets: Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, b64(v)])), homes, creatures };
  return `// studio bundle ${new Date().toISOString()}: ${Object.keys(SOURCES).length} modules, ${Object.keys(shots).length} shots
window.__STUDIO = ${JSON.stringify(STUDIO)};
const SOURCES = ${JSON.stringify(SOURCES)};
const TL = ${JSON.stringify(tl)};
const origin = location.origin, urls = {}, changed = new Set(Object.keys(SOURCES));
const IMP = /(\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\bimport\\s+)(["'])([^"'\\n]+)\\2/g;
const ABS = /(["'])(\\/(?:page|lib|dev|node_modules|studio)\\/[^"'\\s]+\\.m?js)\\1/g;
const resolve = (spec, from) => /^\\.\\.?\\//.test(spec) ? new URL(spec, origin + from).pathname : spec.startsWith("/") ? spec : null;
const deps = {};
for (const [p, src] of Object.entries(SOURCES)) {
  const d = new Set();
  for (const m of src.matchAll(IMP)) { const r = resolve(m[3], p); if (r && changed.has(r)) d.add(r); }
  for (const m of src.matchAll(ABS)) if (changed.has(m[2])) d.add(m[2]);
  deps[p] = [...d];
}
const rewrite = (p, src) => src
  .replace(IMP, (m, pre, q, spec) => { const r = resolve(spec, p); return r ? pre + q + (urls[r] ?? origin + r) + q : m; })
  .replace(ABS, (m, q, x) => q + (urls[x] ?? origin + x) + q);
const state = {};
const visit = (p) => { if (state[p] === 2 || state[p] === 1) return; state[p] = 1; for (const d of deps[p]) visit(d); urls[p] = URL.createObjectURL(new Blob([rewrite(p, SOURCES[p])], { type: "text/javascript" })); state[p] = 2; };
for (const p of Object.keys(SOURCES)) visit(p);
const tlUrl = URL.createObjectURL(new Blob([JSON.stringify(TL)], { type: "application/json" }));
history.replaceState(null, "", location.pathname + location.search + (location.search ? "&" : "?") + "tl=" + encodeURIComponent(tlUrl));
window.renderShot = (spec) => {
  const t0 = performance.now();
  const r = window.renderAt(spec.t);
  return { data: window.frameData(spec.quality ?? 0.9), mean: r.mean, ms: Math.round(performance.now() - t0), lut: false, shot: r.shot };
};
window.renderSheet = (spec) => {
  const t0 = performance.now(), frames = spec.frames ?? [], cols = spec.cols ?? 4, tw = spec.tw ?? 216, th = spec.th ?? 384, lab = spec.labels ? 34 : 0;
  const rows = Math.ceil(frames.length / cols), c = document.createElement("canvas");
  c.width = cols * tw; c.height = rows * (th + lab);
  const g = c.getContext("2d"); g.fillStyle = "#111"; g.fillRect(0, 0, c.width, c.height);
  let mean = 0;
  const tiles = [];
  const pc = document.createElement("canvas"); pc.width = 72; pc.height = 128;
  const pg = pc.getContext("2d", { willReadFrequently: true });
  window.__studioFg = !!spec.stats; // the foreground-slab measure on preview / check sheets only (never the final)
  frames.forEach((f, i) => {
    let r = window.renderAt(f.t);
    for (let k = 0; k < 6 && !(r.mean >= 3); k++) r = window.renderAt(f.t); // the blank-frame guard (render.mjs: a black first frame after a light change is re-rendered)
    mean += r.mean;
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
    g.drawImage(document.getElementById("out"), x, y, tw, th);
    if (spec.stats) {
      // the frame's pixel stats (72 x 128 luminance): mean, spread, edge density, the biggest 16-level bucket
      pg.drawImage(document.getElementById("out"), 0, 0, 72, 128);
      const d = pg.getImageData(0, 0, 72, 128).data, n = 72 * 128, lum = new Float32Array(n), hist = new Map();
      let s = 0, s2 = 0, e = 0, ec = 0;
      for (let p = 0; p < n; p++) { const v = 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2]; lum[p] = v; s += v; s2 += v * v; const kk = v >> 4; hist.set(kk, (hist.get(kk) ?? 0) + 1); }
      for (let yy = 0; yy < 128; yy++) for (let xx = 0; xx < 71; xx++) { ec++; if (Math.abs(lum[yy * 72 + xx] - lum[yy * 72 + xx + 1]) > 14) e++; }
      const m = s / n;
      tiles.push({ i, label: f.label ?? null, t: f.t, mean: +m.toFixed(1), sd: +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(1), edge: +(e / ec).toFixed(3), flat: +(Math.max(...hist.values()) / n).toFixed(2), geo: window.__studioStats?.() ?? null });
    }
    if (lab) { g.fillStyle = "#111"; g.fillRect(x, y + th, tw, lab); g.fillStyle = "#fff"; g.font = "bold 15px sans-serif"; g.fillText(String(f.label ?? "").slice(0, 28), x + 4, y + th + 14); g.font = "12px sans-serif"; g.fillText(String(f.sub ?? "").slice(0, 34), x + 4, y + th + 29); }
  });
  window.__studioFg = false;
  const e = (window.__studioErrsList?.() ?? []).slice(0, 30);
  // lut carries the page's own report back (the role copies that field): the shot-code errors + each tile's stats
  return { data: c.toDataURL("image/jpeg", spec.quality ?? 0.88), mean: +(mean / Math.max(1, frames.length)).toFixed(1), ms: Math.round(performance.now() - t0), lut: JSON.stringify({ errors: e, tiles }) };
};
window.simpleInfo = () => ({ bundle: "studio", modules: Object.keys(SOURCES).length, ...(window.engineInfo ?? {}) });
await import(urls["/page/engine.js"]);
`;
}
