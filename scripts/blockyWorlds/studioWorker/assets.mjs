// Blocky Worlds STUDIO WORKER: the Studio builds of a run (studioBuilds.js) -> the Studio asset library -> the director's
// brief note. The asset library is built by the Studio session in scripts/blockyWorlds/studio/; it will export ONE lookup
// function. Until its name is known this adapter is a stub: no asset is found, so the director builds every thing itself
// (exactly what it does today). To wire it: set LIBRARY below to { module, fn } (the module path relative to this file and
// the export's name); the call is lookup(name, kind) -> { id, ... } | null, and a failing lookup is never a failed run.
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { studioBuilds, studioBuildsNote } from "../../../supabase/functions/_shared/blockyWorlds/studioBuilds.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** the Studio asset library's lookup: null = the stub (no library yet) */
export const LIBRARY = null; // e.g. { module: "../studio/assets.mjs", fn: "findAsset" }

let lookupFn;
async function lookup(library = LIBRARY) {
  if (lookupFn !== undefined && library === LIBRARY) return lookupFn;
  let fn = null;
  if (library?.module && library?.fn) {
    try { fn = (await import(pathToFileURL(path.resolve(HERE, library.module)).href))[library.fn] ?? null; } catch { fn = null; }
  }
  if (library === LIBRARY) lookupFn = fn;
  return fn;
}

/** { [build name]: asset } for the builds the library already has (never throws) */
export async function findAssets(builds = [], { library = LIBRARY, find = null } = {}) {
  const fn = find ?? (await lookup(library));
  if (typeof fn !== "function") return {};
  const out = {};
  for (const b of builds) {
    try { const a = await fn(b.name, b.kind); if (a && typeof a === "object") out[b.name] = a; } catch { /* a lookup error = build it */ }
  }
  return out;
}

/** the run's builds (stored at start; a run without them gets them computed from its own lines) and the director's note */
export async function buildsForRun(run, script, opts = {}) {
  const builds = Array.isArray(run?.studio_builds) ? run.studio_builds : studioBuilds(script, run?.card ?? null);
  const assets = await findAssets(builds, opts);
  return { builds, assets, note: studioBuildsNote(builds, assets) };
}
