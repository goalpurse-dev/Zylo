// M3: assemble the build context of the Cutaway render worker image (m3/Dockerfile.gpu) in a folder:
//   proto/  package.json + lock (three, n8ao, postprocessing, puppeteer-core) and the R1 textures (assets/)
//   wt/     the page source (real.js, full.html, render.mjs, speechEnd.mjs), kit/, m2/, m3/, the final-mix modules
//           (render-worker/src/cutawayFinal*.mjs) and the sound library (render-worker/assets/sfx)
//   fonts/  the caption font (Lilita One, OFL)
//   node m3/buildContext.mjs <outDir> --proto PROTO
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const P3 = path.resolve(here, ".."), WT = path.resolve(here, "../../../..");
const argv = process.argv.slice(2), out = argv[0], proto = argv[argv.indexOf("--proto") + 1];
const cp = (src, dst, filter = () => true) => {
  const s = fs.statSync(src);
  if (s.isDirectory()) { for (const f of fs.readdirSync(src)) if (filter(f, path.join(src, f))) cp(path.join(src, f), path.join(dst, f), filter); return; }
  fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst);
};
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
cp(path.join(here, "Dockerfile.gpu"), path.join(out, "Dockerfile"));
cp(path.join(here, "fly.staging.toml"), path.join(out, "fly.toml"));
cp(path.join(here, "handler.py"), path.join(out, "handler.py"));
for (const f of ["package.json", "package-lock.json"]) cp(path.join(proto, f), path.join(out, "proto", f));
cp(path.join(proto, "assets"), path.join(out, "proto", "assets"));
const code = (f) => !/\.(json|jsonl|md)$/.test(f) || f === "package.json"; // no layouts, logs or notes
for (const f of ["real.js", "full.html", "render.mjs", "speechEnd.mjs"]) cp(path.join(P3, f), path.join(out, "wt/scripts/cutaway/proto3d", f));
for (const d of ["kit", "m2", "m3"]) cp(path.join(P3, d), path.join(out, "wt/scripts/cutaway/proto3d", d), (f, full) => !fs.statSync(full).isDirectory() && code(f) && !/Dockerfile|\.toml$|\.py$/.test(f));
for (const f of ["cutawayFinal.mjs", "cutawayFinalPlan.mjs"]) cp(path.join(WT, "render-worker/src", f), path.join(out, "wt/render-worker/src", f));
cp(path.join(WT, "render-worker/assets/sfx"), path.join(out, "wt/render-worker/assets/sfx"));
cp(path.join(WT, "supabase/functions/_shared/fonts/LilitaOne-Regular.ttf"), path.join(out, "fonts/LilitaOne-Regular.ttf"));
cp(path.join(WT, "supabase/functions/_shared/fonts/LilitaOne-Regular.ttf"), path.join(out, "wt/supabase/functions/_shared/fonts/LilitaOne-Regular.ttf"));
// the kit and M2 .js files are ES modules: in the worktree the root package.json says so, here a minimal one does
fs.writeFileSync(path.join(out, "wt/package.json"), JSON.stringify({ name: "cutaway-render-worker", private: true, type: "module" }, null, 1));
let n = 0, bytes = 0; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), s = fs.statSync(p); if (s.isDirectory()) walk(p); else { n++; bytes += s.size; } } }; walk(out);
console.log(`context ${out}: ${n} files, ${(bytes / 1e6).toFixed(1)} MB`);
