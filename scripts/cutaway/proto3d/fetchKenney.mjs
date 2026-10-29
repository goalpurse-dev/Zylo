// Downloads Kenney's CC0 model kits (kenney.nl, Creative Commons Zero) and keeps only their GLB models and the shared
// colour-map texture: proto/assets/kenney/<kit>/<model>.glb + Textures/colormap.png, and SOURCES.json. Free, no account.
//   node fetchKenney.mjs <proto>/assets/kenney
// The zips are read here (no unzip tool needed on the render server).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT = process.argv[2];
const KITS = {
  car: { page: "https://kenney.nl/assets/car-kit", zip: "https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip" },
  commercial: { page: "https://kenney.nl/assets/city-kit-commercial", zip: "https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip" },
  suburban: { page: "https://kenney.nl/assets/city-kit-suburban", zip: "https://kenney.nl/media/pages/assets/city-kit-suburban/2c871b7af2-1745479373/kenney_city-kit-suburban_20.zip" },
  roads: { page: "https://kenney.nl/assets/city-kit-roads", zip: "https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1791628607/kenney_city-kit-roads.zip" },
  // the model library the scene planner picks from before designing a part (kit/modelCatalog.json): household things,
  // barrels, crates, tanks and machines (2026-10-26)
  furniture: { page: "https://kenney.nl/assets/furniture-kit", zip: "https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip" },
  survival: { page: "https://kenney.nl/assets/survival-kit", zip: "https://kenney.nl/media/pages/assets/survival-kit/4065a8185b-1712149243/kenney_survival-kit.zip" },
  factory: { page: "https://kenney.nl/assets/factory-kit", zip: "https://kenney.nl/media/pages/assets/factory-kit/edaac9d4f6-1777639602/kenney_factory-kit_3.0.zip" },
};
// only some kits: node fetchKenney.mjs <dir> furniture survival (the others stay as they are)
const ONLY = process.argv.slice(3);

/** the files in a zip: [{ name, data }] (stored or deflated entries, read from the central directory) */
function unzip(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a zip");
  const count = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = [];
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString("utf8"); p += 46 + nlen + xlen + clen;
    if (name.endsWith("/")) continue;
    const ds = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), raw = buf.slice(ds, ds + csize);
    out.push({ name, data: method === 0 ? raw : zlib.inflateRawSync(raw) });
  }
  return out;
}

const sourcesFile = path.join(OUT, "SOURCES.json");
const sources = (fs.existsSync(sourcesFile) ? JSON.parse(fs.readFileSync(sourcesFile, "utf8")) : []).filter((x) => ONLY.length && !ONLY.includes(x.kit));
for (const [kit, k] of Object.entries(KITS)) {
  if (ONLY.length && !ONLY.includes(kit)) continue;
  const r = await fetch(k.zip); if (!r.ok) throw new Error(`${r.status} ${k.zip}`);
  const files = unzip(Buffer.from(await r.arrayBuffer()));
  const lic = files.find((f) => /License\.txt$/i.test(f.name))?.data.toString("utf8") ?? "";
  if (!/CC0|Creative Commons Zero/i.test(lic)) throw new Error(`${kit}: not CC0, not used`);
  const dir = path.join(OUT, kit); let n = 0;
  for (const f of files) {
    // (the older kits keep their .glb files under "GLTF format")
    const m = f.name.match(/Models\/GL(?:B|TF) format\/(.+\.(?:glb|png))$/i); if (!m) continue;
    const to = path.join(dir, m[1]); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, f.data); n++;
  }
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "License.txt"), lic);
  sources.push({ kit, author: "Kenney (kenney.nl)", licence: "CC0 1.0", page: k.page, files: n });
  console.log(kit, n, "files");
}
fs.writeFileSync(sourcesFile, JSON.stringify(sources, null, 1));
