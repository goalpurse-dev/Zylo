// Blocky Worlds: the docker build context's smoke test (runpod/buildContext.mjs runs it before it calls the context
// finished). Free, local, no network. 2026-11-05: the image shipped audio/mix.mjs without audio/sfxEpic.mjs (a hand
// list of files), and a paid prepare job died on ERR_MODULE_NOT_FOUND after the voice, the director and the builder
// were already paid for.
//   1. codeGraph(engineDir): every engine file the worker can load, from runpod/worker.mjs: static imports, literal
//      dynamic imports, and the worker's `path.join(ENGINE, "lib", "x.js")` loads; files under the shared Blocky
//      Worlds folder are kept apart (the image puts them at /app/supabase/functions/_shared/blockyWorlds).
//   2. smoke(contextDir): the image's layout is rebuilt in a temp folder from the CONTEXT's own files (code only:
//      .mjs/.js/.json), then a fresh node process imports every module of the graph from there; a package import
//      resolves to engine/node_modules but only when package.json lists it in "dependencies" (the image runs
//      `npm ci --omit=dev`). Any failed import is reported by file.
//   node runpod/contextSmoke.mjs <contextDir>          exit 0 = every module loads
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ENGINE = path.resolve(here, "..");
export const SHARED = path.resolve(ENGINE, "../../../supabase/functions/_shared/blockyWorlds");
/** the worker's entry modules (everything else is reached from these) */
export const ENTRIES = ["runpod/worker.mjs", "runpod/gpu.mjs", "render.mjs", "plan.mjs"];

const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'`]([^"'`]+)["'`]/g;
const ENGINE_JOIN = /path\.join\(\s*ENGINE\s*,\s*((?:["'][^"']+["']\s*,?\s*)+)\)/g;

/** the files a module loads: relative specifiers + path.join(ENGINE, "...") literals that end in .js / .mjs */
export function importsOf(file, engineDir = ENGINE) {
  const src = fs.readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "");
  const out = [];
  for (const m of src.matchAll(SPEC)) if (/^\.\.?\//.test(m[1]) && /\.(m?js|json)$/.test(m[1])) out.push(path.resolve(path.dirname(file), m[1]));
  for (const m of src.matchAll(ENGINE_JOIN)) {
    const parts = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
    if (/\.(m?js)$/.test(parts.at(-1) ?? "")) out.push(path.join(engineDir, ...parts));
  }
  return out;
}

/** -> { engine: [rel paths in engineDir], shared: [file names in sharedDir], outside: [abs], missing: [{ file, from }] } */
export function codeGraph(engineDir = ENGINE, sharedDir = SHARED, entries = ENTRIES) {
  const seen = new Set(), engine = new Set(), shared = new Set(), outside = new Set(), missing = [];
  const queue = entries.map((e) => ({ file: path.join(engineDir, e), from: "(entry)" }));
  while (queue.length) {
    const { file, from } = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!fs.existsSync(file)) { missing.push({ file, from }); continue; }
    const inEngine = !path.relative(engineDir, file).startsWith(".."), inShared = !path.relative(sharedDir, file).startsWith("..");
    if (inEngine) engine.add(path.relative(engineDir, file).split(path.sep).join("/"));
    else if (inShared) shared.add(path.relative(sharedDir, file).split(path.sep).join("/"));
    else { outside.add(file); continue; }
    if (/\.json$/.test(file)) continue;
    for (const f of importsOf(file, engineDir)) queue.push({ file: f, from: file });
  }
  return { engine: [...engine].sort(), shared: [...shared].sort(), outside: [...outside], missing };
}

// the resolve hook of the child process: bare package names -> engine/node_modules, if listed in "dependencies"
const HOOK = `
import { isBuiltin } from "node:module";
let fallback = null, deps = new Set();
export async function initialize(d) { fallback = d.parent; deps = new Set(d.deps); }
export async function resolve(spec, ctx, next) {
  if (/^(node:|\\.|\\/|file:|data:)/.test(spec) || /^[A-Za-z]:/.test(spec)) return next(spec, ctx);
  const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
  if (isBuiltin(spec) || /\\/node_modules\\//.test(ctx.parentURL ?? "")) return next(spec, ctx); // a package's own imports
  if (!deps.has(name)) throw Object.assign(new Error("package \\"" + name + "\\" is not in package.json dependencies (the image runs npm ci --omit=dev)"), { code: "ERR_MODULE_NOT_FOUND" });
  return next(spec, { ...ctx, parentURL: fallback });
}`;

/** one node process: import every module of the list from root; -> [{ rel, error }] for the failures */
function importAll(root, rels, engineDir) {
  const deps = Object.keys(JSON.parse(fs.readFileSync(path.join(engineDir, "package.json"), "utf8")).dependencies ?? {});
  const hookFile = path.join(root, "smoke-hook.mjs"), runFile = path.join(root, "smoke-run.mjs");
  fs.writeFileSync(hookFile, HOOK);
  fs.writeFileSync(runFile, `import { register } from "node:module";
import { pathToFileURL } from "node:url";
register(${JSON.stringify(pathToFileURL(hookFile).href)}, { data: { parent: ${JSON.stringify(pathToFileURL(path.join(engineDir, "package.json")).href)}, deps: ${JSON.stringify(deps)} } });
const fails = [];
for (const [rel, file] of ${JSON.stringify(rels.map((r) => [r, pathToFileURL(path.join(root, "app/scripts/blockyWorlds/engine", r)).href]))}) {
  try { await import(file); } catch (e) { fails.push({ rel, error: String(e?.message ?? e).split("\\n")[0].slice(0, 400) }); }
}
console.log("SMOKE " + JSON.stringify(fails));
process.exit(0);
`);
  const p = spawnSync(process.execPath, [runFile], { encoding: "utf8", cwd: root, timeout: 120000, maxBuffer: 1 << 24, env: { ...process.env, NODE_OPTIONS: "" } });
  const line = (p.stdout ?? "").split(/\r?\n/).find((l) => l.startsWith("SMOKE "));
  if (!line) return [{ rel: "(the smoke process)", error: `exit ${p.status}: ${(p.stderr || p.stdout || "").slice(-600)}` }];
  return JSON.parse(line.slice(6));
}

/**
 * The context's smoke test -> { ok, modules, problems: [string] }. The image layout comes from the context's own
 * files: <ctx>/engine -> app/scripts/blockyWorlds/engine, <ctx>/shared -> app/supabase/functions/_shared/blockyWorlds.
 */
export function smoke(ctx, { engineDir = ENGINE, keep = false } = {}) {
  const problems = [];
  const graph = codeGraph(engineDir);
  for (const m of graph.missing) problems.push(`the repo itself has no ${path.relative(engineDir, m.file)} (imported by ${path.relative(engineDir, m.from)})`);
  for (const f of graph.outside) problems.push(`the worker loads ${f}, outside engine/ and the shared folder: the image has no copy of it`);
  for (const rel of graph.engine) if (!fs.existsSync(path.join(ctx, "engine", rel))) problems.push(`the context has no engine/${rel}`);
  for (const rel of graph.shared) if (!fs.existsSync(path.join(ctx, "shared", rel))) problems.push(`the context has no shared/${rel}`);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bw-ctx-smoke-"));
  try {
    const code = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).map(String).filter((f) => /\.(m?js|json)$/.test(f)) : []);
    const eng = path.join(root, "app/scripts/blockyWorlds/engine"), sh = path.join(root, "app/supabase/functions/_shared/blockyWorlds");
    for (const f of code(path.join(ctx, "engine")).filter((f) => !/^assets[\\/]/.test(f))) { fs.mkdirSync(path.dirname(path.join(eng, f)), { recursive: true }); fs.copyFileSync(path.join(ctx, "engine", f), path.join(eng, f)); }
    for (const f of code(path.join(ctx, "shared"))) { fs.mkdirSync(path.dirname(path.join(sh, f)), { recursive: true }); fs.copyFileSync(path.join(ctx, "shared", f), path.join(sh, f)); }
    const mods = graph.engine.filter((r) => /\.m?js$/.test(r) && fs.existsSync(path.join(eng, r)));
    for (const f of importAll(root, mods, engineDir)) problems.push(`engine/${f.rel} does not load from the context: ${f.error}`);
    return { ok: !problems.length, modules: mods.length, shared: graph.shared.length, problems, root: keep ? root : null };
  } finally { if (!keep) fs.rmSync(root, { recursive: true, force: true }); }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const ctx = process.argv[2];
  if (!ctx) { console.error("usage: node runpod/contextSmoke.mjs <contextDir>"); process.exit(2); }
  const r = smoke(path.resolve(ctx));
  console.log(r.ok ? `smoke ok: ${r.modules} engine modules + ${r.shared} shared files load from the context` : `SMOKE FAILED:\n  ${r.problems.join("\n  ")}`);
  process.exit(r.ok ? 0 : 1);
}
