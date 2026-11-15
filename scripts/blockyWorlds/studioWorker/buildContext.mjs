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
//   node scripts/blockyWorlds/studioWorker/buildContext.mjs [--out <dir>] [--kit <kit root>] [--ref <commit>]
//        (default out: <tmp>/zyvo-blocky-studio-build; default kit: BLOCKY_WORLDS_KIT_DIR, else the laptop's reference copy)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

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

// THE BLENDER KIT (the owner's Blender engine): a creator's kit used with permission, NEVER in git. Only the text the
// director and its tools read go into the context's kit/ folder (the Dockerfile puts it at /kit, BLOCKY_WORLDS_KIT_DIR):
// its guide, playbook, rbx/ toolkit, tools/*.py and the worked examples. Never its setup / voice / ElevenLabs scripts
// (the owner's exclusion), assets or sounds (Blender runs on RunPod, not here).
export const KIT_DEFAULT = path.join(ROOT, "reference/blocky-worlds/roblox-story-kit/unzipped/roblox-story-kit");
const KIT_SKIP = /(^|\/)(setup\.py|eleven\.py|voice\.py|voice_run\.py)$/;
/** the kit files the image needs (paths relative to the kit root) */
export function kitFiles(kit) {
  const relK = (p) => path.relative(kit, p).split(path.sep).join("/");
  const keep = (f) => /^(SKILL\.md|README\.md|engine\/PLAYBOOK\.md)$/.test(f) || /^engine\/rbx\/.+\.py$/.test(f) || /^engine\/tools\/[^/]+\.py$/.test(f)
    || /^engine\/videos\/[^/]+\/(shots\.py|script\.txt|audio\/[^/]+\.json)$/.test(f);
  return walk(kit).map(relK).filter((f) => keep(f) && !KIT_SKIP.test(f)).sort();
}

/** a repo file's bytes at a git ref (the COMMITTED version), or null when the ref has no such file */
export function gitBytes(ref, p) {
  const r = spawnSync("git", ["-C", ROOT, "show", `${ref}:${p}`], { maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

// --ref <commit> (the go-live rule "deploy only committed code"): every repo file is taken from that commit, never from
// the shared working folder (other sessions' uncommitted edits stay out); a file the commit lacks fails the build context
export async function buildContext(out, { kit = process.env.BLOCKY_WORLDS_KIT_DIR || KIT_DEFAULT, ref = null } = {}) {
  if (!fs.existsSync(path.join(kit, "SKILL.md")) || !fs.existsSync(path.join(kit, "engine", "PLAYBOOK.md"))) return { ok: false, out, missing: [`the Blender kit (SKILL.md, engine/PLAYBOOK.md) at ${kit}: pass --kit <dir> or BLOCKY_WORLDS_KIT_DIR`] };
  if (path.resolve(out).startsWith(ROOT + path.sep)) throw new Error("build the context OUTSIDE the repo folder (default: the temp folder)");
  fs.rmSync(out, { recursive: true, force: true });
  const files = contextFiles();
  const notCommitted = [];
  const put = (f, dst) => {
    if (!ref) return cp(path.join(ROOT, f), dst);
    const b = gitBytes(ref, f);
    if (!b) { notCommitted.push(f); return; }
    fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, b);
  };
  for (const f of files) put(f, path.join(out, "app", f));
  if (notCommitted.length) return { ok: false, out, ref, missing: notCommitted.map((f) => `${f} (not in ${ref})`) };
  // the page files the bundle ships (git is on the laptop, not in the container)
  const { IMAGE_SINCE } = await import(pathToFileURL(path.join(ROOT, "scripts/blockyWorlds/studio/bundle.mjs")).href);
  const { changedFiles } = await import(pathToFileURL(path.join(ENGINE, "dev/simple/bundle.mjs")).href);
  const changed = changedFiles(IMAGE_SINCE);
  fs.mkdirSync(path.join(out, "app", "build"), { recursive: true });
  fs.writeFileSync(path.join(out, "app", "build", "changed-files.json"), JSON.stringify({ since: IMAGE_SINCE, files: changed, at: new Date().toISOString() }, null, 1));
  const set = new Set(files);
  const miss = missingImports(files, { has: (p) => set.has(p), read: (p) => fs.readFileSync(path.join(out, "app", p), "utf8") });
  if (miss.length) return { ok: false, out, files: files.length, missing: miss };
  const kf = kitFiles(kit);
  for (const f of kf) cp(path.join(kit, f), path.join(out, "kit", f));
  put("scripts/blockyWorlds/studioWorker/Dockerfile", path.join(out, "Dockerfile"));
  put("scripts/blockyWorlds/studioWorker/fly.toml", path.join(out, "fly.toml"));
  if (notCommitted.length) return { ok: false, out, ref, missing: notCommitted };
  const bytes = walk(out).reduce((a, f) => a + fs.statSync(f).size, 0);
  return { ok: true, out, ref: ref ?? "working folder", files: files.length, kitFiles: kf.length, changed: changed.length, mb: +(bytes / 1e6).toFixed(1) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const out = path.resolve(argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : path.join(os.tmpdir(), "zyvo-blocky-studio-build"));
  const r = await buildContext(out, { ...(argv.includes("--kit") ? { kit: path.resolve(argv[argv.indexOf("--kit") + 1]) } : {}), ...(argv.includes("--ref") ? { ref: argv[argv.indexOf("--ref") + 1] } : {}) });
  console.log(JSON.stringify(r, null, 1));
  process.exit(r.ok ? 0 : 1);
}
