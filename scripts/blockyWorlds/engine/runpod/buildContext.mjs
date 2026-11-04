// Blocky Worlds: assemble the docker build context of the render worker (runpod/Dockerfile) in a folder. Free, local;
// it builds nothing and pushes nothing.
//   engine/  package.json + lock, lib/, page/, render.mjs, runpod/ (code only), and the assets the page code uses:
//            a texture set / Poly Haven model folder / Kenney model / HDRI is kept when its name appears in page/ or
//            lib/ source (the caption font always). --all-assets copies every asset.
//   handler.py, Dockerfile at the root.
//   node runpod/buildContext.mjs <outDir> [--all-assets]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), ENGINE = path.resolve(here, "..");
const argv = process.argv.slice(2), out = argv.find((a) => !a.startsWith("--")), ALL = argv.includes("--all-assets");
if (!out) { console.error("usage: node runpod/buildContext.mjs <outDir> [--all-assets]"); process.exit(2); }
if (path.resolve(out).startsWith(ENGINE + path.sep + "assets")) throw new Error("outDir inside assets/");

const walk = (d) => fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
const cp = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };

fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
cp(path.join(here, "Dockerfile"), path.join(out, "Dockerfile"));
cp(path.join(here, "handler.py"), path.join(out, "handler.py"));
const E = path.join(out, "engine");
for (const f of ["package.json", "package-lock.json", "render.mjs"]) cp(path.join(ENGINE, f), path.join(E, f));
for (const d of ["lib", "page"]) for (const f of walk(path.join(ENGINE, d))) cp(f, path.join(E, path.relative(ENGINE, f)));
for (const f of ["gpu.mjs", "worker.mjs"]) cp(path.join(here, f), path.join(E, "runpod", f));

// the assets the code names
const source = ["page", "lib"].flatMap((d) => walk(path.join(ENGINE, d))).filter((f) => /\.(m?js|html|json)$/.test(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
const named = (name) => new RegExp(`["'\`/]${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`/.]`).test(source);
const A = path.join(ENGINE, "assets"), kept = [], skipped = new Set();
for (const f of walk(A)) {
  const rel = path.relative(A, f).split(path.sep), top = rel[0];
  let keep = ALL || rel.join("/") === "LilitaOne-Regular.ttf";
  if (!keep && top === "kenney") keep = rel.length > 2 ? named(path.basename(f, path.extname(f))) || f.endsWith(".png") && named(rel[1]) : false;
  else if (!keep && top === "ph") keep = rel[1] === "hdri" ? named(path.basename(f, path.extname(f))) : named(rel[1]);
  else if (!keep && top === "hdri") keep = named(path.basename(f, path.extname(f))) || named(top);
  else if (!keep && rel.length > 1) keep = named(top);
  if (keep) { cp(f, path.join(E, "assets", ...rel)); kept.push(f); } else skipped.add(rel.slice(0, rel.length > 2 ? 2 : 1).join("/"));
}
function fs_size(f) { return fs.statSync(f).size; }
const all = walk(out);
console.log(`context ${out}: ${all.length} files, ${(all.reduce((s, f) => s + fs_size(f), 0) / 1e6).toFixed(1)} MB (assets kept ${kept.length}, ${(kept.reduce((s, f) => s + fs_size(f), 0) / 1e6).toFixed(1)} MB)`);
if (skipped.size) console.log(`folders with assets left out (not named in page/ or lib/): ${[...skipped].sort().join(", ")}`);
