// STUDIO ASSET LIBRARY: the review thumbnail of a saved build, rendered on RunPod (the Studio endpoint, one small stills
// job for every entry asked): the build ALONE in the street, two daylight angles and one night view, side by side
// (3 x 216 x 384) -> studio/library/thumbs/<id>.jpg. A run's free thumbnail (frames of its final) is replaced.
//   renderShowcase({ ids, template, L, scratch }) -> { ok, files, billed }
//   template: a Studio timeline.json to clone the shot structure from (any finished run's)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { makeStudioBundle } from "../bundle.mjs";
import { renderSheets } from "../render.mjs";
import { assetInfo } from "../shotCheck.mjs";
import { LIB, listAssets, writeReview } from "./library.mjs";

const ANGLES = [{ ang: 0.45, light: "day" }, { ang: -0.6, light: "day" }, { ang: 0.1, light: "night" }];

/** one cut's code: the build at the origin of the street, the camera orbiting slowly round its centre */
function showCode(codeName, info, ang) {
  const [w, h, d] = info.size ?? [2, 2, 2], c = info.center ?? [0, h / 2, 0];
  const D = +(1.25 * Math.max(h / 0.73, w / 0.41, d / 0.41, 3)).toFixed(2); // fits the portrait frame (fov 40)
  const cx = c[0], cy = +Math.max(0.6, c[1]).toFixed(2), cz = +(c[2] + 1.5).toFixed(2);
  return `api.asset("${codeName}", { at: [0, 0, 1.5] });
const c = [${cx}, ${cy}, ${cz}];
api.camera({ pos: api.orbit(c, ${D}, ${ang} + 0.12 * api.k, ${+(h * 0.15).toFixed(2)}), look: c, fov: 40 });`;
}

export async function renderShowcase({ ids, template, L, scratch }) {
  const tl0 = JSON.parse(fs.readFileSync(template, "utf8"));
  const base = tl0.shots.find((s) => s.board?.loc === "street") ?? tl0.shots[0];
  const entries = listAssets().filter((a) => ids.includes(a.id));
  if (!entries.length) throw new Error("no such library entries");
  const shots = [], code = {}, assets = {}, creatures = [];
  let t = 0;
  for (const [k, a] of entries.entries()) {
    const info = assetInfo(a.code, {});
    const name = `lib${k}_${a.codeName}`.slice(0, 31).replace(/[^a-z0-9_]/g, "_");
    assets[name] = a.code; if (a.creature) creatures.push(name);
    for (const [j, v] of ANGLES.entries()) {
      const id = `x${k}_${j}`;
      shots.push({ ...JSON.parse(JSON.stringify(base)), start: t, end: t + 1, studio: id, light: v.light, camera: "medium", actors: [], objects: [], board: { ...JSON.parse(JSON.stringify(base.board)), people: [], monster: null, acts: [] }, text: a.name });
      code[id] = showCode(name, info, v.ang);
      t += 1;
    }
  }
  const tl = { ...tl0, shots, duration: t, captions: [], lines: tl0.lines };
  const bundle = await makeStudioBundle({ timeline: tl, shots: code, assets, homes: base.board?.homes ?? {}, creatures });
  const sheets = entries.map((a, k) => ({ name: `show_${k}`, frames: ANGLES.map((_, j) => ({ t: k * ANGLES.length + j + 0.5, label: "" })), cols: 3 }));
  const r = await renderSheets({ code: bundle, sheets: sheets.map((s) => ({ ...s, labels: false })), out: path.join(scratch, "showcase"), L, label: "library" });
  if (!r.ok) return { ok: false, error: r.error };
  const files = [];
  fs.mkdirSync(LIB.thumbs, { recursive: true });
  for (const [k, a] of entries.entries()) {
    const src = r.files[k]?.file; if (!src) continue;
    const out = path.join(LIB.thumbs, `${a.id}.jpg`);
    // the sheet carries a label strip under the tiles: crop to the 3 tiles, recompress small
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", "crop=648:384:0:0", "-q:v", "6", out]);
    const file = path.join(LIB.items, `${a.id}.json`), e = JSON.parse(fs.readFileSync(file, "utf8"));
    e.preview = `thumbs/${a.id}.jpg`; e.previewKind = "showcase"; fs.writeFileSync(file, JSON.stringify(e, null, 1) + "\n");
    files.push(out);
  }
  writeReview();
  return { ok: true, files, billed: r.billed, pageErrors: r.pageErrors };
}
