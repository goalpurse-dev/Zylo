// Downloads CC0 3D models from Poly Haven (api.polyhaven.com, Creative Commons Zero) as glTF with their 1k textures
// into proto/assets/polyhaven/<id>/ (the .gltf, its .bin, textures/), and writes SOURCES.json (asset, authors, licence,
// page, files). Free downloads, no account, no paid call. The worker image runs it once, like fetchKenney.mjs.
//   node fetchPolyModels.mjs <proto>/assets/polyhaven [id,id (only those)]
// (the owner's rule 19 of 2026-11-11: realistic CC0 models, one consistent look; the realistic props a planner's "model"
// part finds by keyword, the recurring "token" prop's duck, and the worker's spade. Only light models, under ~35k
// triangles each: Poly Haven's trees are millions of triangles, so the trees and houses are built in code instead.)
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2];
if (!OUT) { console.error("usage: node fetchPolyModels.mjs <proto>/assets/polyhaven [ids]"); process.exit(1); }
export const POLY_MODELS = [
  "rubber_duck_toy", "rusted_spade_01", "bleach_bottle", "plastic_bottle_gallon", "baseball_01", "metal_trash_can",
  "street_lamp_02", "painted_wooden_bench", "planter_box_01", "potted_plant_04", "cardboard_box_01", "plastic_crate_01",
  "garden_hose_wall_mounted_01", "propane_tank", "metal_jerrycan", "pipe_wrench", "adjustable_wrench", "metal_toolbox",
  "wooden_bucket_01", "watering_can_metal_01",
];
const ONLY = process.argv[3] ? process.argv[3].split(",") : null;
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r; };
const SRC = path.join(OUT, "SOURCES.json");
fs.mkdirSync(OUT, { recursive: true });
const sources = (fs.existsSync(SRC) ? JSON.parse(fs.readFileSync(SRC, "utf8")) : []).filter((x) => ONLY && !ONLY.includes(x.asset));
for (const id of POLY_MODELS.filter((x) => !ONLY || ONLY.includes(x))) {
  try {
    const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
    const info = await (await get(`https://api.polyhaven.com/info/${id}`)).json();
    // (a model whose page does not say CC0 is never fetched; Poly Haven publishes everything as CC0, checked anyway)
    if (info.license && !/cc0/i.test(String(info.license))) { console.log(id, "skipped: licence", info.license); continue; }
    const g = files.gltf?.["1k"]?.gltf;
    if (!g) { console.log(id, "skipped: no 1k glTF"); continue; }
    const dir = path.join(OUT, id); fs.mkdirSync(path.join(dir, "textures"), { recursive: true });
    fs.writeFileSync(path.join(dir, `${id}.gltf`), Buffer.from(await (await get(g.url)).arrayBuffer()));
    const got = [`${id}.gltf`];
    for (const [rel, f] of Object.entries(g.include ?? {})) {
      const to = path.join(dir, rel); fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, Buffer.from(await (await get(f.url)).arrayBuffer())); got.push(rel);
    }
    sources.push({ asset: id, type: "model", authors: Object.keys(info.authors ?? {}), licence: "CC0", page: `https://polyhaven.com/a/${id}`, triangles: info.polycount ?? null, files: got });
    console.log(id, got.length, "files");
  } catch (e) { console.log(id, "failed:", e.message); }
}
fs.writeFileSync(SRC, JSON.stringify(sources, null, 2));
