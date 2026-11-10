// The PAGE-CODE-IN-JOB bundle (2026-11-10): runs the CURRENT production engine page (with every page / lib file changed
// since the RunPod image was built) on the image's simple test page (role "simpleStills", runpod/simpleRole.mjs), so a
// look change is checked on RunPod with no image rebuild. One ES module:
//   - SOURCES: each changed browser file's text (by its server path); at load each becomes a blob: module, its import
//     specifiers rewritten (changed files -> their blob URL, every other path -> the page server's absolute URL);
//   - STUBS: stand-ins for modules the test page's import map cannot load (page/post.js needs "n8ao": the simple look
//     uses page/simple/post.js, so the old chain is never called);
//   - the timeline (a blob URL; captions dropped), then window.renderShot(spec = { t }) -> { data, mean, ms }.
// Test harness only: the production page (page/index.html + page/engine.js) is untouched by it.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STUB_POST = `export const POST = {}; export function makeRenderer() { throw new Error("bundle stub: page/post.js"); } export function makePost() { throw new Error("bundle stub: page/post.js"); }`;

/** browser files (page/**, lib/** .js) changed since `since` (a commit) + new untracked ones, as server paths */
export function changedFiles(since) {
  const rel = (p) => p.replace(/^scripts\/blockyWorlds\/engine\//, "");
  const git = (args) => execFileSync("git", args, { cwd: ENGINE, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  const list = new Set([...git(["diff", "--name-only", since, "--", "page", "lib"]), ...git(["ls-files", "--others", "--exclude-standard", "--", "page", "lib"])].map(rel));
  return [...list].filter((p) => /\.js$/.test(p) && !/^lib\/(builder|director|vision|recipes)\//.test(p) && fs.existsSync(path.join(ENGINE, p)) && !/^page\/simple\/simple\.js$/.test(p)).map((p) => `/${p.replace(/\\/g, "/")}`);
}

/** the bundle's code for a timeline (object) and the files to ship (server paths) */
export function makeBundle({ timeline, files, stubs = { "/page/post.js": STUB_POST } }) {
  const SOURCES = {};
  // every page module that imports a stub (directly or through another importer) ships too, so its import is rewritten
  // to the stub (page/capsLayer.js imports page/post.js, which the test page cannot load)
  const all = [];
  const walk = (d) => { for (const e of fs.readdirSync(path.join(ENGINE, d), { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) all.push(`/${p}`); } };
  walk("page"); walk("lib");
  const want = new Set(files), hit = new Set([...Object.keys(stubs), ...files]); // + every importer of a changed file (else it loads the image's old copy)
  for (let grew = true; grew;) {
    grew = false;
    for (const f of all) {
      if (want.has(f) || hit.has(f)) continue;
      const src = fs.readFileSync(path.join(ENGINE, f.slice(1)), "utf8");
      const imps = [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"'\n]+)\1/g)].map((m) => (m[2].startsWith(".") ? path.posix.join(path.posix.dirname(f), m[2]) : m[2]));
      if (imps.some((x) => hit.has(x))) { want.add(f); hit.add(f); grew = true; }
    }
  }
  files = [...want];
  for (const f of files) SOURCES[f] = fs.readFileSync(path.join(ENGINE, f.slice(1)), "utf8");
  for (const [k, v] of Object.entries(stubs)) SOURCES[k] = v;
  const tl = { ...timeline, captions: [] };
  return `// bundle ${new Date().toISOString()}: ${Object.keys(SOURCES).length} modules
const SOURCES = ${JSON.stringify(SOURCES)};
const TL = ${JSON.stringify(tl)};
const origin = location.origin, urls = {}, changed = new Set(Object.keys(SOURCES));
const IMP = /(\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\bimport\\s+)(["'])([^"'\\n]+)\\2/g;
const ABS = /(["'])(\\/(?:page|lib|dev|node_modules)\\/[^"'\\s]+\\.m?js)\\1/g;
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
  const r = window.renderAt(spec.t, spec.safe ? { safe: spec.safe } : null);
  return { data: window.frameData(spec.quality ?? 0.9), mean: r.mean, ms: Math.round(performance.now() - t0), lut: false, shot: r.shot };
};
window.simpleInfo = () => ({ bundle: true, modules: Object.keys(SOURCES).length, ...(window.engineInfo ?? {}) });
await import(urls["/page/engine.js"]);
`;
}
