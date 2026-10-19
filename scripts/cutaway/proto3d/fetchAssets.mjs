// Downloads CC0 textures and an HDRI from Poly Haven (api.polyhaven.com) into proto/assets/<id>/, and writes
// SOURCES.json (asset, author, licence, page, files). Free downloads, no account, no paid call.
import fs from "node:fs";
import path from "node:path";
const OUT = process.argv[2];
const TEX = { // id -> resolution
  excavated_soil_wall: "2k", roots: "1k", leafy_grass: "2k", grass_path_2: "1k", gravel: "1k", brown_mud_dry: "1k", dark_rock: "1k",
  coast_sand_01: "1k", grey_roof_01: "1k", roof_09: "1k", beige_wall_001: "1k", painted_plaster_wall: "1k", asphalt_02: "1k", brown_mud_rocks_01: "1k",
};
const MAPS = { Diffuse: "diff", nor_gl: "nor", Rough: "rough", AO: "ao" };
const HDRI = { id: process.argv[3] ?? "kloofendal_48d_partly_cloudy_puresky", res: "2k" };
const sources = [];
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r; };
for (const [id, res] of Object.entries(TEX)) {
  const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
  const info = await (await get(`https://api.polyhaven.com/info/${id}`)).json();
  const dir = path.join(OUT, id); fs.mkdirSync(dir, { recursive: true });
  const got = [];
  for (const [k, short] of Object.entries(MAPS)) {
    const u = files[k]?.[res]?.jpg?.url ?? files[k]?.[res]?.png?.url;
    if (!u) continue;
    const ext = u.endsWith(".png") ? "png" : "jpg";
    fs.writeFileSync(path.join(dir, `${short}.${ext}`), Buffer.from(await (await get(u)).arrayBuffer()));
    got.push(`${short}.${ext}`);
  }
  sources.push({ asset: id, type: "texture", authors: Object.keys(info.authors ?? {}), licence: "CC0", page: `https://polyhaven.com/a/${id}`, resolution: res, files: got });
  console.log(id, got.join(","));
}
{
  const files = await (await get(`https://api.polyhaven.com/files/${HDRI.id}`)).json();
  const info = await (await get(`https://api.polyhaven.com/info/${HDRI.id}`)).json();
  const u = files.hdri[HDRI.res].hdr.url;
  fs.mkdirSync(path.join(OUT, "hdri"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "hdri", "sky.hdr"), Buffer.from(await (await get(u)).arrayBuffer()));
  sources.push({ asset: HDRI.id, type: "hdri", authors: Object.keys(info.authors ?? {}), licence: "CC0", page: `https://polyhaven.com/a/${HDRI.id}`, resolution: HDRI.res, files: ["sky.hdr"] });
  console.log("hdri", HDRI.id);
}
fs.writeFileSync(path.join(OUT, "SOURCES.json"), JSON.stringify(sources, null, 2));
