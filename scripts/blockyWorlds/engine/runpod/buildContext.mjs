// Blocky Worlds: assemble the docker build context of the render worker (runpod/Dockerfile) in a folder. Free, local;
// it builds nothing and pushes nothing.
//   engine/  package.json + lock, lib/ and page/ whole, and EVERY engine file the worker can load (runpod/contextSmoke.mjs
//            codeGraph: from runpod/worker.mjs through static imports, literal dynamic imports and the worker's
//            path.join(ENGINE, ...) loads; never a hand list: 2026-11-05 the list missed audio/sfxEpic.mjs and a paid
//            prepare job died on ERR_MODULE_NOT_FOUND), the SFX wavs, and the assets the page code uses: a texture set /
//            Poly Haven model folder / Kenney model / HDRI is kept when its name appears in page/ or lib/ source (the
//            caption font always). --all-assets copies every asset; --no-assets none (the tests).
//   shared/  supabase/functions/_shared/blockyWorlds/*.js (the narrator config + voice code the prepare role uses)
//   handler.py, Dockerfile at the root.
// Then the SMOKE TEST (contextSmoke.mjs smoke): every module of the graph is imported from the context in the image's
// layout. Any failure: the context is NOT finished (its Dockerfile is removed, so nothing can be built from it) and
// the exit code is 1.
//   node runpod/buildContext.mjs <outDir> [--all-assets | --no-assets]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { codeGraph, smoke, SHARED } from "./contextSmoke.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)), ENGINE = path.resolve(here, "..");

const walk = (d) => fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
const cp = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };

/** the context in `out` -> { files, bytes, assetsKept, assetsBytes, skipped, smoke } (smoke.ok false: not finished) */
export function buildContext(out, { assets = "named" } = {}) {
  if (path.resolve(out).startsWith(ENGINE + path.sep + "assets")) throw new Error("outDir inside assets/");
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const E = path.join(out, "engine");
  for (const f of ["package.json", "package-lock.json"]) cp(path.join(ENGINE, f), path.join(E, f));
  for (const d of ["lib", "page"]) for (const f of walk(path.join(ENGINE, d))) cp(f, path.join(E, path.relative(ENGINE, f)));
  // every engine file the worker loads (the production roles: prepare = voice, director, builder, plan + checks,
  // music + SFX + mix; chunk / finish = render)
  const graph = codeGraph(ENGINE);
  if (graph.missing.length) throw new Error(`the worker imports files the repo does not have: ${graph.missing.map((m) => `${path.relative(ENGINE, m.file)} (from ${path.relative(ENGINE, m.from)})`).join(", ")}`);
  if (graph.outside.length) throw new Error(`the worker imports files outside engine/ and the shared folder: ${graph.outside.join(", ")}`);
  for (const rel of graph.engine) cp(path.join(ENGINE, rel), path.join(E, rel));
  for (const f of walk(path.join(ENGINE, "audio", "sfx")).filter((f) => f.endsWith(".wav"))) cp(f, path.join(E, "audio", "sfx", path.basename(f)));
  // the shared Blocky Worlds config + voice code (eleven.mjs imports ../../../../supabase/functions/_shared/blockyWorlds/)
  for (const f of fs.readdirSync(SHARED).filter((f) => f.endsWith(".js"))) cp(path.join(SHARED, f), path.join(out, "shared", f));

  // the assets the code names
  const kept = [], skipped = new Set();
  if (assets !== "none") {
    const source = ["page", "lib"].flatMap((d) => walk(path.join(ENGINE, d))).filter((f) => /\.(m?js|html|json)$/.test(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
    const named = (name) => new RegExp(`["'\`/]${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`/.]`).test(source);
    const A = path.join(ENGINE, "assets");
    for (const f of walk(A)) {
      const rel = path.relative(A, f).split(path.sep), top = rel[0];
      let keep = assets === "all" || rel.join("/") === "LilitaOne-Regular.ttf";
      if (!keep && top === "kenney") keep = rel.length > 2 ? named(path.basename(f, path.extname(f))) || f.endsWith(".png") && named(rel[1]) : false;
      else if (!keep && top === "ph") keep = rel[1] === "hdri" ? named(path.basename(f, path.extname(f))) : named(rel[1]);
      else if (!keep && top === "hdri") keep = named(path.basename(f, path.extname(f))) || named(top);
      else if (!keep && rel.length > 1) keep = named(top);
      if (keep) { cp(f, path.join(E, "assets", ...rel)); kept.push(f); } else skipped.add(rel.slice(0, rel.length > 2 ? 2 : 1).join("/"));
    }
  } else fs.mkdirSync(path.join(E, "assets"), { recursive: true });

  // the smoke test: only a context whose every module loads gets its Dockerfile
  const s = smoke(out);
  if (s.ok) { cp(path.join(here, "Dockerfile"), path.join(out, "Dockerfile")); cp(path.join(here, "handler.py"), path.join(out, "handler.py")); }
  const all = walk(out), size = (f) => fs.statSync(f).size;
  return { files: all.length, bytes: all.reduce((a, f) => a + size(f), 0), engineModules: graph.engine.length, assetsKept: kept.length, assetsBytes: kept.reduce((a, f) => a + size(f), 0), skipped: [...skipped].sort(), smoke: s };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), out = argv.find((a) => !a.startsWith("--"));
  if (!out) { console.error("usage: node runpod/buildContext.mjs <outDir> [--all-assets | --no-assets]"); process.exit(2); }
  const r = buildContext(out, { assets: argv.includes("--all-assets") ? "all" : argv.includes("--no-assets") ? "none" : "named" });
  console.log(`context ${out}: ${r.files} files, ${(r.bytes / 1e6).toFixed(1)} MB (engine code files ${r.engineModules}, assets kept ${r.assetsKept}, ${(r.assetsBytes / 1e6).toFixed(1)} MB)`);
  if (r.skipped.length) console.log(`folders with assets left out (not named in page/ or lib/): ${r.skipped.join(", ")}`);
  if (!r.smoke.ok) { console.error(`SMOKE TEST FAILED: the context is NOT finished (no Dockerfile in it):\n  ${r.smoke.problems.join("\n  ")}`); process.exit(1); }
  console.log(`smoke test ok: ${r.smoke.modules} engine modules + ${r.smoke.shared} shared files load from the context in the image's layout`);
}
