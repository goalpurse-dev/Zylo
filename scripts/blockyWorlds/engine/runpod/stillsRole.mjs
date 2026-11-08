// Blocky Worlds RunPod worker: the STILLS roles (2026-11-08: every render moved off the owner's laptop). Called by
// worker.mjs runJob ({ job: { role: "stills" | "objectStills", ... } }); a laptop client sends them
// (dev/runpodStills.mjs, runpod/stillRendererRunpod.mjs). No paid API call: only rendering.
//
// role "stills": { timeline | timelineUrl, picks: [{ t, label? } | { shot, label? }] | "all", w = 540, h = 960,
//                  captions = false, whole = false, out?: { uploads: { [file]: signedPutUrl }, manifest?: signedPutUrl } }
//   ONE page load (the engine page on a copy of the timeline at w x h, no captions unless asked; only the picked shots
//   back to back unless whole / captions: the page then loads only their sets), every pick in order
//   through the SAME frame guards as the video (render.mjs flatGuard: a flat shot re-rendered without fog, then with a
//   plain camera; a black GPU capture re-rendered up to 4 times). A pick { shot } is that shot's middle.
// role "objectStills": { items: [{ kind = "object" | "world", spec, light = "day", view?: { yaw, el }, size?, label? }],
//                  size = 768, out?: as above }
//   the builder's still page (lib/builder/still.mjs: one page, the stills one after another), the blank guard + the
//   flat numbers in the manifest (an object still is a check image: a flat one is flagged, never swapped).
// Without out.uploads the JPEGs come back inline (base64 in the RESULT; at most INLINE_MAX bytes in all).
// -> { role, stills: [{ label, file, t?, shot?, w, h, bytes, mean, flat, detail, safe?, bad, ms, uploaded?, b64? }],
//      loadMs, renderer, guard?, timing }
import fs from "node:fs";
import path from "node:path";
import { startServer, launchBrowser, openPage, flatGuard } from "../render.mjs";
import { isBlack, isBad } from "../lib/frameGuard.js";
import { subTimeline } from "../lib/vision/requirements.js";

export const INLINE_MAX = 8 * 1024 * 1024;
const coded = (code, message) => Object.assign(new Error(message), { code });
const safeName = (s) => String(s ?? "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);

/** picks -> [{ label, t, shot }]: "all" = every shot's middle; { shot } = that shot's middle; { t } as given */
export function resolvePicks(tl, picks) {
  const shots = tl?.shots ?? [];
  const mid = (i) => +(((shots[i].start ?? 0) + (shots[i].end ?? 0)) / 2).toFixed(3);
  const list = picks === "all" || picks == null ? shots.map((_, i) => ({ shot: i })) : picks;
  if (!Array.isArray(list) || !list.length) throw coded("BAD_JOB", "no picks");
  return list.map((p, k) => {
    if (typeof p === "number") p = { t: p };
    if (p.shot != null) {
      if (!shots[p.shot]) throw coded("BAD_JOB", `pick ${k}: the timeline has no shot ${p.shot}`);
      return { label: safeName(p.label ?? `s${String(p.shot).padStart(2, "0")}`), t: p.t != null ? Number(p.t) : mid(p.shot), shot: Number(p.shot) };
    }
    const t = Number(p.t);
    if (!Number.isFinite(t) || t < 0) throw coded("BAD_JOB", `pick ${k}: no time`);
    return { label: safeName(p.label ?? `t${t.toFixed(2)}`), t: Math.min(t, Math.max(0, (tl.duration ?? t) - 0.01)), shot: null };
  });
}

/** the copy the stills page renders: w x h, captions dropped unless asked */
export function stillsTimeline(tl, { w = 540, h = 960, captions = false } = {}) {
  const c = JSON.parse(JSON.stringify(tl));
  c.width = Math.round(Number(w) / 2) * 2; c.height = Math.round(Number(h) / 2) * 2;
  if (!captions) c.captions = [];
  return c;
}

/** labels made unique (a second "s03" becomes "s03_2"), files numbered in pick order */
export function fileNames(picks) {
  const seen = new Map();
  return picks.map((p, i) => { const n = (seen.get(p.label) ?? 0) + 1; seen.set(p.label, n); return `${String(i).padStart(3, "0")}_${p.label}${n > 1 ? `_${n}` : ""}.jpg`; });
}

/** the stills of a timeline in one page load (the local twin of the role, used by it and by the tests) */
/** the shot a time falls in */
export const shotAt = (tl, t) => { const s = tl.shots ?? []; const i = s.findIndex((x) => t >= x.start && t < x.end); return i >= 0 ? i : Math.max(0, s.length - 1); };

/**
 * Only the picked shots, back to back (lib/vision subTimeline, as the shot review's re-renders): the page loads only
 * their sets (the first real check: 54 s to load all 68 shots' sets for 3 stills). -> { tl, at(pick) -> sub time, shotOf(sub shot) }
 */
export function pickedTimeline(tl, list) {
  const keep = [...new Set(list.map((p) => (p.shot != null ? p.shot : shotAt(tl, p.t))))].sort((a, b) => a - b);
  const sub = subTimeline(tl, keep);
  return { tl: sub.tl, at: (p) => sub.map(p.shot != null ? p.shot : shotAt(tl, p.t), p.t), shotOf: (i) => keep[i] ?? null };
}

export async function renderTimelineStills({ tl, picks, w = 540, h = 960, captions = false, whole = false, dir, browser: given = null, quality = 0.9, log = console.log }) {
  fs.mkdirSync(dir, { recursive: true });
  const list = resolvePicks(tl, picks), names = fileNames(list);
  // whole: the full timeline (exactly the video's state at t, e.g. captions); else only the picked shots (much faster)
  const sub = whole || captions ? null : pickedTimeline(tl, list); // captions are timed on the whole video
  const st = stillsTimeline(sub ? sub.tl : tl, { w, h, captions });
  fs.writeFileSync(path.join(dir, "stills_tl.json"), JSON.stringify(st));
  const srv = await startServer(dir), browser = given ?? (await launchBrowser());
  const t0 = Date.now();
  try {
    const page = await openPage(browser, { port: srv.port, tlName: "stills_tl.json", W: st.width, H: st.height, label: " stills" });
    const loadMs = Date.now() - t0;
    log(`stills: page loaded in ${loadMs} ms (${st.width}x${st.height}, ${tl.shots?.length ?? 0} shots, ${list.length} picks)`);
    const grab = (t, force, safe = 0) => page.evaluate((t, safe, q) => { const r = window.renderAt(t, { safe }); return { ...r, data: window.frameData(q) }; }, t, safe, quality);
    const guard = flatGuard(grab), out = [];
    for (const [i, p] of list.entries()) {
      const a = Date.now();
      try {
        const t = sub ? sub.at(p) : p.t;
        let r = await guard.frame(t);
        for (let k = 0; k < 4 && isBlack(r); k++) { await new Promise((s) => setTimeout(s, 40 * (k + 1))); r = await guard.frame(t); }
        if (isBlack(r)) r = await guard.frame(t, { black: true });
        const jpeg = Buffer.from(r.data.slice(r.data.indexOf(",") + 1), "base64"), file = path.join(dir, names[i]);
        fs.writeFileSync(file, jpeg);
        const shot = r.shot == null ? p.shot : sub ? sub.shotOf(r.shot) : r.shot;
        out.push({ label: p.label, file: names[i], t: p.t, shot, ...(sub ? { subT: +t.toFixed(3) } : {}), w: st.width, h: st.height, bytes: jpeg.length, mean: r.mean ?? null, flat: r.flat ?? null, detail: r.detail ?? null, safe: r.safe ?? 0, bad: isBad(r), ms: Date.now() - a });
      } catch (e) { out.push({ label: p.label, file: null, t: p.t, error: String(e.message ?? e).slice(0, 200), ms: Date.now() - a }); }
    }
    await page.close().catch(() => {});
    return { stills: out, loadMs, guard: guard.report(), ms: Date.now() - t0 };
  } finally { if (!given) await browser.close().catch(() => {}); srv.close(); }
}

/** the builder's still page for a list of objects / worlds (one page, in order) */
export async function renderObjectStills({ items, size = 768, dir, makeRenderer = null }) {
  if (!Array.isArray(items) || !items.length) throw coded("BAD_JOB", "no items");
  fs.mkdirSync(dir, { recursive: true });
  const mk = makeRenderer ?? (await import("../lib/builder/still.mjs")).makeStillRenderer;
  const t0 = Date.now(), r = await mk({ outDir: dir, size });
  const out = [];
  let loadMs = null;
  try {
    if (r.ready) { await r.ready(); loadMs = Date.now() - t0; }
    const names = fileNames(items.map((it, i) => ({ label: safeName(it.label ?? `${it.kind ?? "object"}${i + 1}`) })));
    for (const [i, it] of items.entries()) {
      const a = Date.now(), kind = it.kind === "world" ? "world" : "object", label = safeName(it.label ?? `${kind}${i + 1}`);
      try {
        if (!it.spec || typeof it.spec !== "object") throw new Error("no spec");
        const s = await r.render(kind, it.spec, { light: it.light ?? "day", name: names[i].replace(/\.jpg$/, ""), size: it.size ?? null, view: it.view ?? null });
        out.push({ label, file: path.basename(s.file), kind, light: it.light ?? "day", ...(it.view ? { view: it.view } : {}), w: s.w, h: s.h, bytes: s.jpeg.length, mean: s.mean ?? null, flat: s.flat ?? null, detail: s.detail ?? null, bad: Boolean(s.bad), problems: (s.problems ?? []).slice(0, 12), ms: Date.now() - a });
      } catch (e) { out.push({ label, file: null, kind, error: String(e.message ?? e).slice(0, 200), ms: Date.now() - a }); }
    }
  } finally { await r.close().catch(() => {}); }
  return { stills: out, loadMs, ms: Date.now() - t0 };
}

/** the uploads (signed PUT URLs) or the inline base64; the manifest last. put = worker.mjs put */
export async function deliver(res, dir, out, put) {
  const ok = res.stills.filter((s) => s.file);
  if (out?.uploads) {
    for (const s of ok) {
      const url = out.uploads[s.file];
      if (!url) { s.uploaded = false; continue; }
      await put(url, path.join(dir, s.file), "image/jpeg");
      s.uploaded = true;
    }
  } else {
    const total = ok.reduce((n, s) => n + s.bytes, 0);
    if (total > INLINE_MAX) throw coded("BAD_JOB", `${total} bytes of stills is too much to send back inline: give out.uploads`);
    for (const s of ok) s.b64 = fs.readFileSync(path.join(dir, s.file)).toString("base64");
  }
  if (out?.manifest) {
    const f = path.join(dir, "manifest.json");
    fs.writeFileSync(f, JSON.stringify({ ...res, stills: res.stills.map(({ b64, ...s }) => s) }, null, 1));
    await put(out.manifest, f, "application/json");
  }
  return res;
}

/** the two roles for worker.mjs (gpuCheck = its renderer(mode); get / put = its URL helpers) */
export async function stillsJob(job, dir, { gpuCheck, get, put }) {
  const s = job.stills ?? job, timing = {};
  let t = Date.now();
  const renderer = await gpuCheck(job.mode ?? "gpu");
  timing.gpuCheck = +((Date.now() - t) / 1000).toFixed(2);
  let tl = s.timeline ?? null;
  if (!tl && s.timelineUrl) { t = Date.now(); tl = JSON.parse(String(await get(s.timelineUrl))); timing.download = +((Date.now() - t) / 1000).toFixed(2); }
  if (!tl?.shots) throw coded("BAD_JOB", "no timeline (timeline or timelineUrl)");
  t = Date.now();
  const res = await renderTimelineStills({ tl, picks: s.picks ?? "all", w: s.w ?? 540, h: s.h ?? 960, captions: Boolean(s.captions), whole: Boolean(s.whole), dir: path.join(dir, "stills") });
  timing.render = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  await deliver(res, path.join(dir, "stills"), s.out, put);
  timing.upload = +((Date.now() - t) / 1000).toFixed(2);
  return { role: "stills", renderer, loadMs: res.loadMs, guard: res.guard, stills: res.stills, timing };
}

export async function objectStillsJob(job, dir, { gpuCheck, put, makeRenderer = null }) {
  const s = job.objectStills ?? job, timing = {};
  let t = Date.now();
  const renderer = await gpuCheck(job.mode ?? "gpu");
  timing.gpuCheck = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  const res = await renderObjectStills({ items: s.items, size: s.size ?? 768, dir: path.join(dir, "objects"), makeRenderer });
  timing.render = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  await deliver(res, path.join(dir, "objects"), s.out, put);
  timing.upload = +((Date.now() - t) / 1000).toFixed(2);
  return { role: "objectStills", renderer, loadMs: res.loadMs, stills: res.stills, timing };
}
