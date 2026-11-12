// INTEGRATION: contact sheets of stills (labels drawn in), for out/integration/.
//   node dev/integrationSheet.mjs <out.jpg> <cols> <label1=img1.jpg> <label2=img2.jpg> ...
// Each still is scaled to 360 x 640; its label is printed under it (Lilita One). ffmpeg only, free.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function sheet(out, cols, items) {
  const font = "assets/LilitaOne-Regular.ttf"; // relative to ENGINE (ffmpeg's drawtext dislikes Windows drive colons)
  const args = ["-v", "error", "-y"];
  for (const it of items) args.push("-i", path.resolve(it.file));
  const esc = (s) => String(s).replace(/[\\:']/g, " ").replace(/%/g, " pct").slice(0, 46);
  const parts = items.map((it, i) => `[${i}:v]scale=360:640,pad=360:700:0:0:black,drawtext=fontfile=${font}:text='${esc(it.label)}':x=8:y=652:fontsize=22:fontcolor=white[v${i}]`);
  const rows = Math.ceil(items.length / cols);
  const layout = items.map((_, i) => `${(i % cols) * 360}_${Math.floor(i / cols) * 700}`).join("|");
  const fill = rows * cols - items.length;
  const pads = Array.from({ length: fill }, (_, k) => `color=black:s=360x700:d=1[p${k}]`);
  const inputs = [...items.map((_, i) => `[v${i}]`), ...pads.map((_, k) => `[p${k}]`)].join("");
  const fullLayout = [...items.map((_, i) => i), ...pads.map((_, k) => items.length + k)].map((i) => `${(i % cols) * 360}_${Math.floor(i / cols) * 700}`).join("|");
  void layout;
  const filter = [...parts, ...pads, `${inputs}xstack=inputs=${items.length + fill}:layout=${fullLayout}[o]`].join(";");
  args.push("-filter_complex", filter, "-map", "[o]", "-frames:v", "1", "-q:v", "3", path.resolve(out));
  const p = spawnSync(process.env.FFMPEG ?? "ffmpeg", args, { cwd: ENGINE, encoding: "utf8" });
  if (p.status !== 0) throw new Error(p.stderr.slice(-800));
  return out;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const [out, cols, ...rest] = process.argv.slice(2);
  const items = rest.map((x) => { const i = x.indexOf("="); return { label: x.slice(0, i), file: x.slice(i + 1) }; }).filter((x) => fs.existsSync(x.file));
  console.log(sheet(out, Number(cols) || 4, items));
}
