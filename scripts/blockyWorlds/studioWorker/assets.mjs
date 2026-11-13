// Blocky Worlds STUDIO WORKER: the Studio builds of a run (studioBuilds.js) + the Studio asset library -> the director.
// The library is the Studio session's (scripts/blockyWorlds/studio/library/library.mjs): lookup(name, kind) returns an
// APPROVED entry { id, name, kind, size: { w, h, d }, code, creature, about, score, ... } or null. Each build goes to
// directVideo({ builds }) with its entry when found; the director's brief then lists the builds as delimited DATA plus each
// approved build's CODE (agent.mjs libraryBrief). A failing lookup is never a failed run: that thing is built from scratch.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { studioBuilds } from "../../../supabase/functions/_shared/blockyWorlds/studioBuilds.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** the Studio asset library's lookup (module relative to this file, export name) */
export const LIBRARY = Object.freeze({ module: "../studio/library/library.mjs", fn: "lookup" });

let cached = { library: null, fn: undefined };
async function lookup(library = LIBRARY) {
  if (cached.library === library && cached.fn !== undefined) return cached.fn;
  let fn = null;
  if (library?.module && library?.fn) {
    try { fn = (await import(pathToFileURL(path.resolve(HERE, library.module)).href))[library.fn] ?? null; } catch { fn = null; }
  }
  cached = { library, fn };
  return fn;
}

/** { [build name]: approved library entry } for the builds the library already has (never throws) */
export async function findAssets(builds = [], { library = LIBRARY, find = null } = {}) {
  const fn = find ?? (await lookup(library));
  if (typeof fn !== "function") return {};
  const out = {};
  for (const b of builds) {
    try { const a = await fn(b.name, b.kind); if (a && typeof a === "object") out[b.name] = a; } catch { /* a lookup error = build it */ }
  }
  return out;
}

/**
 * The run's builds for the director: the list stored at start (a run without one gets it from its own lines), each with
 * its approved library entry when the library has one: [{ name, kind, lines, description, entry? }]
 */
export async function buildsForRun(run, script, opts = {}) {
  const list = Array.isArray(run?.studio_builds) ? run.studio_builds : studioBuilds(script, run?.card ?? null);
  const assets = await findAssets(list, opts);
  const builds = list.map((b) => (assets[b.name] ? { ...b, entry: assets[b.name] } : { ...b }));
  return { builds, assets };
}
