// M2: a free look at a layout on its voice before a full render: 1 fps stills, a contact sheet, and the mean HSV
// saturation of those stills (the same measure as the render check).
//   node m2/look.mjs <layout.json> <voice.mp3> <words.json> <proto> <ffmpeg> <outDir> [roles.json | script.json]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { compile } from "./compile.mjs";
import { preparePage, runProcess } from "./make.mjs";
import { speechEnd } from "../speechEnd.mjs";
import { sheet } from "./sheet.mjs";
import { timelineChecks } from "./checks.mjs";

const [lf, voice, wf, proto, ff, out, rf] = process.argv.slice(2);
const layout = JSON.parse(fs.readFileSync(lf, "utf8")), words = JSON.parse(fs.readFileSync(wf, "utf8"));
const rj = rf ? JSON.parse(fs.readFileSync(rf, "utf8")) : null;
const roles = Array.isArray(rj) ? rj : rj?.sentences ? rj.sentences.map((s) => s.role) : layout.roles ?? [];
const tl = compile(layout, words, speechEnd(ff, voice), { roles });
preparePage({ layout, tl, proto });
const times = []; for (let t = 0; t <= tl.marks.lengthEnd; t += 1) times.push(t);
await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, out, times.join(",")], { cwd: proto });
sheet(ff, out, null, path.join(out, "contact_sheet.jpg"), times, { w: 180, perRow: 8 });
let sum = 0, n = 0;
for (let i = 0; i < times.length; i++) {
  const raw = execFileSync(ff, ["-v", "error", "-i", path.join(out, `f_${String(i).padStart(3, "0")}.png`), "-vf", "scale=108:192", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  for (let k = 0; k < raw.length; k += 3) { const mx = Math.max(raw[k], raw[k + 1], raw[k + 2]), mn = Math.min(raw[k], raw[k + 1], raw[k + 2]); sum += mx ? (mx - mn) / mx : 0; n++; }
}
console.log(JSON.stringify({ saturation: +(sum / n).toFixed(3), checks: timelineChecks(layout, tl), director: tl.director?.frames?.map((f) => `${f.t.toFixed(1)} ${f.ids} ${(f.rect.w * 100).toFixed(0)}% ${f.ok ? "ok" : f.why}`) }, null, 1));
