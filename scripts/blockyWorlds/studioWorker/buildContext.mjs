// Blocky Worlds STUDIO WORKER: assemble the docker build context in a folder OUTSIDE the repo (free, local; it builds
// nothing and pushes nothing). The repo layout is kept under app/, so every import of the Studio code resolves as on the
// laptop:
//   app/scripts/blockyWorlds/engine/     package.json + lock, plan.mjs, render.mjs, lib/, page/, audio/ (code + SFX wavs),
//                                         voice/, runpod/ (client + roles + endpoint.json), dev/simple/bundle.mjs
//                                         (no assets/, out/ or node_modules/: the frames are drawn on RunPod)
//   app/scripts/blockyWorlds/studio/     the Studio v3 code, as it is in the working folder at build time
//   app/scripts/blockyWorlds/studioWorker/  this worker
//   app/supabase/functions/_shared/blockyWorlds/*.js (+ contentMachine/adminGuard.js, the one import outside it)
//   app/build/changed-files.json        engine/dev/simple/bundle.mjs changedFiles(IMAGE_SINCE), written here with git
//   Dockerfile, fly.toml
// Then a static check: every relative import in the copied code resolves to a copied file (the image build also runs
// worker.mjs --smoke, which imports everything). Any miss: no Dockerfile in the folder, exit code 1.
//   node scripts/blockyWorlds/studioWorker/buildContext.mjs [--out <dir>]     (default: <tmp>/zyvo-blocky-studio-build)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const ENGINE = path.join(ROOT, "scripts/blockyWorlds/engine");

const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
const cp = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

/** the files of the context, as repo paths */
export function contextFiles() {
  const files = new Set();
  const add = (p) => files.add(rel(p));
  for (const f of ["package.json", "package-lock.json", "plan.mjs", "render.mjs"]) add(path.join(ENGINE, f));
  for (const d of ["lib", "page", "audio", "voice"]) for (const f of walk(path.join(ENGINE, d))) add(f);
  for (const f of ["client.mjs", "simpleRole.mjs", "stillsRole.mjs", "stillRendererRunpod.mjs", "endpoint.json"]) add(path.join(ENGINE, "runpod", f));
  add(path.join(ENGINE, "dev/simple/bundle.mjs"));
  for (const f of walk(path.join(ROOT, "scripts/blockyWorlds/studio"))) add(f);
  // the Blender kit engine option (worker.mjs imports blenderKit/workerSteps.mjs; it runs blenderKit/pipeline.mjs): our
  // glue code, endpoint.json and the library entries (not the thumbnails). The kit itself is not in the repo: the option
  // also needs BLOCKY_WORLDS_KIT_DIR in the image (off by default; README.md)
  for (const f of walk(path.join(ROOT, "scripts/blockyWorlds/blenderKit")).filter((f) => /\.(mjs|js|py|json)$/.test(f) && !f.includes(`${path.sep}thumbs${path.sep}`))) add(f);
  for (const f of walk(HERE).filter((f) => /\.(mjs|js)$/.test(f) && !f.includes(`${path.sep}dev${path.sep}`))) add(f);
  for (const f of fs.readdirSync(path.join(ROOT, "supabase/functions/_shared/blockyWorlds")).filter((f) => f.endsWith(".js"))) add(path.join(ROOT, "supabase/functions/_shared/blockyWorlds", f));
  add(path.join(ROOT, "supabase/functions/_shared/contentMachine/adminGuard.js"));
  return [...files].filter((f) => !/(^|\/)(node_modules|out|assets)\//.test(f.replace(/^scripts\/blockyWorlds\/engine\//, ""))).sort();
}

/** every relative specifier ("./x", "../y") in the code files, that does not resolve inside the context */
export function missingImports(files, exists) {
  const miss = [];
  for (const f of files.filter((f) => /\.(mjs|js)$/.test(f) && !f.startsWith("scripts/blockyWorlds/engine/page/"))) {
    // comment lines are skipped (usage notes like "import { mixAudio } from ./audio/mix.mjs" name the CLI path)
    const src = exists.read(f).split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
      if (!exists.has(target)) miss.push(`${target} (from ${f})`);
    }
  }
  return miss;
}

export async function buildContext(out) {
  if (path.resolve(out).startsWith(ROOT + path.sep)) throw new Error("build the context OUTSIDE the repo folder (default: the temp folder)");
  fs.rmSync(out, { recursive: true, force: true });
  const files = contextFiles();
  for (const f of files) cp(path.join(ROOT, f), path.join(out, "app", f));
  // the page files the bundle ships (git is on the laptop, not in the container)
  const { IMAGE_SINCE } = await import(pathToFileURL(path.join(ROOT, "scripts/blockyWorlds/studio/bundle.mjs")).href);
  const { changedFiles } = await import(pathToFileURL(path.join(ENGINE, "dev/simple/bundle.mjs")).href);
  const changed = changedFiles(IMAGE_SINCE);
  fs.mkdirSync(path.join(out, "app", "build"), { recursive: true });
  fs.writeFileSync(path.join(out, "app", "build", "changed-files.json"), JSON.stringify({ since: IMAGE_SINCE, files: changed, at: new Date().toISOString() }, null, 1));
  const set = new Set(files);
  const miss = missingImports(files, { has: (p) => set.has(p), read: (p) => fs.readFileSync(path.join(ROOT, p), "utf8") });
  if (miss.length) return { ok: false, out, files: files.length, missing: miss };
  cp(path.join(HERE, "Dockerfile"), path.join(out, "Dockerfile"));
  cp(path.join(HERE, "fly.toml"), path.join(out, "fly.toml"));
  const bytes = walk(out).reduce((a, f) => a + fs.statSync(f).size, 0);
  return { ok: true, out, files: files.length, changed: changed.length, mb: +(bytes / 1e6).toFixed(1) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const out = path.resolve(argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : path.join(os.tmpdir(), "zyvo-blocky-studio-build"));
  const r = await buildContext(out);
  console.log(JSON.stringify(r, null, 1));
  process.exit(r.ok ? 0 : 1);
}
