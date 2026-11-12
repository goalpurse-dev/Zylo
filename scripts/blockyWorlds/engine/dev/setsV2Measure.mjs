// SETS-V2 2026-11-09: the look measure (free, ffmpeg only): per image the median HSV saturation and median brightness
// (V = max(r,g,b)) of a 72 px wide downsample, then the median over the images. The same measure as the page's per-shot
// auto grade (lib/setThemes.js frameStats), so reference frames and our stills compare one to one.
//   node dev/setsV2Measure.mjs <dir|glob-ish prefix> [more...] [--each]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { frameStats } from "../lib/setThemes.js";

export function measureImage(file, w = 72) {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${w}:-2`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 26 });
  return frameStats(new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.length));
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

function filesOf(arg) {
  if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) {
    const out = [];
    const walk = (d, depth) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory() && depth < 3) walk(p, depth + 1); else if (/\.(jpe?g|png)$/i.test(f) && !/sheet/i.test(f)) out.push(p); } };
    walk(arg, 0); return out;
  }
  return fs.existsSync(arg) ? [arg] : [];
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"))) {
  const args = process.argv.slice(2), each = args.includes("--each");
  for (const a of args.filter((x) => !x.startsWith("--"))) {
    const files = filesOf(a);
    const st = files.map((f) => { try { return { f, ...measureImage(f) }; } catch { return null; } }).filter(Boolean);
    if (each) for (const s of st) console.log(`  ${path.basename(s.f).padEnd(28)} V ${s.bright.toFixed(2)}  S ${s.sat.toFixed(2)}  warm ${s.warm.toFixed(3)}`);
    console.log(`${a}: ${st.length} images | median brightness ${med(st.map((s) => s.bright)).toFixed(3)} | median saturation ${med(st.map((s) => s.sat)).toFixed(3)} | warm cast ${med(st.map((s) => s.warm)).toFixed(3)}`);
  }
}
