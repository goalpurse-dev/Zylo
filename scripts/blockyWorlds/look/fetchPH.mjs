// Free CC0 downloads from Poly Haven's public API (no account, no cost): glTF models at 1k, HDRIs at 2k.
// Usage: node fetchPH.mjs <outDir>
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2];
const MODELS = ["street_lamp_01", "fire_hydrant", "metal_trash_can", "modular_street_seating", "shrub_02", "shrub_04", "jacaranda_tree", "planter_box_01"];
const HDRIS = ["kloofendal_43d_clear_puresky", "kloofendal_38d_partly_cloudy_puresky", "moonlit_golf"];
const UA = { "User-Agent": "zyvo-lookframes" };

async function get(url, dest) {
  if (fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}
const sources = [];
for (const id of MODELS) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA })).json();
  const g = files.gltf?.["1k"]?.gltf;
  if (!g) { console.log("no 1k gltf:", id); continue; }
  await get(g.url, path.join(out, id, `${id}.gltf`));
  for (const [rel, f] of Object.entries(g.include ?? {})) await get(f.url, path.join(out, id, rel));
  const info = await (await fetch(`https://api.polyhaven.com/info/${id}`, { headers: UA })).json();
  sources.push({ id, type: "model", authors: Object.keys(info.authors ?? {}), license: "CC0", link: `https://polyhaven.com/a/${id}` });
  console.log("model", id);
}
for (const id of HDRIS) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA })).json();
  await get(files.hdri["2k"].hdr.url, path.join(out, "hdri", `${id}.hdr`));
  const info = await (await fetch(`https://api.polyhaven.com/info/${id}`, { headers: UA })).json();
  sources.push({ id, type: "hdri", authors: Object.keys(info.authors ?? {}), license: "CC0", link: `https://polyhaven.com/a/${id}` });
  console.log("hdri", id);
}
fs.writeFileSync(path.join(out, "SOURCES.json"), JSON.stringify(sources, null, 1));
