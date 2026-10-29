// M2: the CC0 model catalog the scene planner looks in before it designs a new part (the owner's rule of 2026-10-26:
// free CC0 models first). Every model is a Kenney CC0 kit file (fetchKenney.mjs, ASSET_SOURCES.md) in
// proto/assets/kenney/<kit>/<name>.glb; the catalog (kit/modelCatalog.json) lists them with the words of their names.
//   node m2/models.js <proto>/assets/kenney     (re-writes kit/modelCatalog.json from the files)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.join(here, "..", "kit", "modelCatalog.json");
// road tiles and whole buildings are scenery, not things a video builds
const SKIP = /^(road-|low-detail-building|building-|tile|floor|wall|corner|block|path|fence-|detail-)/;

/** "bathroomSinkSquare" / "barrel-open" -> ["bathroom", "sink", "square"] / ["barrel", "open"] */
export const wordsOf = (name) => name.replace(/\.glb$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const stem = (w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");

/** the catalog from the model folders: [{ file: "furniture/toilet.glb", kit, words }] */
export function buildCatalog(dir) {
  const out = [];
  for (const kit of fs.readdirSync(dir)) {
    const k = path.join(dir, kit); if (!fs.statSync(k).isDirectory()) continue;
    for (const f of fs.readdirSync(k)) if (f.endsWith(".glb") && !SKIP.test(f)) out.push({ file: `${kit}/${f}`, kit, words: wordsOf(f) });
  }
  return out;
}

let cached = null;
export const modelCatalog = () => (cached ??= fs.existsSync(CATALOG) ? JSON.parse(fs.readFileSync(CATALOG, "utf8")) : []);

/** the models whose names share a word with the text (a topic, a script's part list), best first, at most n */
export function modelMatches(text, n = 12, catalog = modelCatalog()) {
  const want = new Set(wordsOf(String(text)).filter((w) => w.length >= 3).map(stem));
  const scored = catalog.map((m) => ({ m, s: m.words.filter((w) => want.has(stem(w))).length / Math.sqrt(m.words.length) })).filter((x) => x.s > 0);
  return scored.sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.m);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cat = buildCatalog(process.argv[2]);
  fs.writeFileSync(CATALOG, JSON.stringify(cat));
  console.log(`${cat.length} models -> ${CATALOG}`);
}
