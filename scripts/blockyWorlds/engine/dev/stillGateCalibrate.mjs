// The still gate's calibration on labelled stills (free, local, no render): every JPEG decoded by ffmpeg to the gate's
// 36 x 64 grid, lib/stillGate.js pixelStats + pixelReasons, scored against the labels.
//   node dev/stillGateCalibrate.mjs [step3 dir] [--csv out.csv] [--show]
// The step-3 labels (problems.json, 2026-11-09) split into BLANK (what a pixel / geometry gate must catch: blank, wall,
// sky-only, ceiling-only, inside an object, too dark, blown out) and CONTENT (wrong prop, face hidden, missing beat: the
// shot review's job, not counted either way).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GRID, pixelStats, pixelReasons } from "../lib/stillGate.js";

export const STEP3_DEFAULT = "C:/Users/Huhta/AppData/Local/Temp/claude/406e5fa85684c54c/7058aea9-2818-45ee-b63a-c62abb8e016b/scratchpad/step3";

/** the BLANK labels per video (shot numbers), from problems.json's bad lists + the blank frames its problem text names */
export const BLANK = Object.freeze({
  1: { 40: "inside a wooden object", 19: "blue wall 3/4", 10: "mostly sky + sign", 63: "mostly sky + sign" },
  2: { 48: "ceiling rail", 62: "ceiling rail", 57: "blank wall/window", 33: "beige wall", 39: "blue wall", 40: "wall corner", 21: "dark wall + door", 52: "wall + door", 25: "inside furniture", 63: "sky + sign", 64: "sky + sign", 1: "night sky + tower", 18: "night sky + sign" },
  3: { 73: "overexposed", 37: "shell ceiling", 46: "shell ceiling", 64: "ceiling", 65: "ceiling", 42: "inside a giant", 44: "inside a giant", 52: "blank planes", 38: "dark blob", 40: "dark blob", 62: "night sky", 63: "night sky", 67: "dark trees", 69: "dark trees", 9: "grass only", 1: "trees / grass only" },
  4: { 59: "brown wall + sky", 20: "dark block", 25: "night sky + sign" },
  5: { 1: "empty frame", 2: "empty frame", 24: "fog blob" },
});

export function decodeGrid(file, ff = process.env.FFMPEG ?? "ffmpeg") {
  const p = spawnSync(ff, ["-v", "error", "-i", file, "-vf", `scale=${GRID.w}:${GRID.h}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 24 });
  if (p.status !== 0 || !p.stdout?.length) throw new Error(`ffmpeg could not decode ${file}: ${String(p.stderr).slice(0, 200)}`);
  return new Uint8Array(p.stdout.buffer, p.stdout.byteOffset, p.stdout.length);
}

/** every still of a step-3 folder: [{ video, shot, file }] */
export function step3Stills(dir) {
  const out = [];
  for (const v of fs.readdirSync(dir).filter((x) => /^\d+$/.test(x)).sort((a, b) => a - b)) {
    const sd = path.join(dir, v, "stills");
    if (!fs.existsSync(sd)) continue;
    for (const f of fs.readdirSync(sd)) { const m = /_s(\d+)\.jpg$/.exec(f); if (m) out.push({ video: Number(v), shot: Number(m[1]), file: path.join(sd, f) }); }
  }
  return out;
}

export function score(rows) {
  const pos = rows.filter((r) => r.label === "blank"), neg = rows.filter((r) => r.label === "good");
  const tp = pos.filter((r) => r.fail).length, fp = neg.filter((r) => r.fail).length;
  return { stills: rows.length, blank: pos.length, caught: tp, missed: pos.filter((r) => !r.fail).map((r) => `${r.video}:s${r.shot}`), good: neg.length, falseAlarms: fp, falseList: neg.filter((r) => r.fail).map((r) => `${r.video}:s${r.shot} ${r.codes.join("+")}`), recall: +(tp / Math.max(1, pos.length)).toFixed(3), precision: +(tp / Math.max(1, tp + fp)).toFixed(3) };
}

export function calibrate(dir = STEP3_DEFAULT) {
  const probs = fs.existsSync(path.join(dir, "problems.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "problems.json"), "utf8")) : {};
  return step3Stills(dir).map((s) => {
    const stats = pixelStats(decodeGrid(s.file));
    const reasons = pixelReasons(stats);
    const blank = BLANK[s.video]?.[s.shot];
    const content = !blank && (probs[s.video]?.bad ?? []).some((b) => b.s === s.shot);
    return { ...s, label: blank ? "blank" : content ? "content" : "good", note: blank ?? null, stats, codes: reasons.map((r) => r.code), fail: reasons.length > 0 };
  });
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--csv") ?? STEP3_DEFAULT;
  const rows = calibrate(dir);
  if (args.includes("--show")) for (const r of rows.filter((x) => x.label === "blank" || x.fail)) console.log(`${r.label.padEnd(7)} ${r.video}:s${String(r.shot).padStart(2, "0")} ${(r.codes.join("+") || "-").padEnd(16)} flat ${r.stats.flat} cl ${r.stats.clusters} ce ${r.stats.centreEdges} edges ${r.stats.edges} sky ${r.stats.sky} offEdges ${r.stats.edgesOffSky} mean ${r.stats.mean} p90 ${r.stats.p90} sat ${r.stats.sat} ${r.note ?? ""}`);
  const ci = args.indexOf("--csv");
  if (ci >= 0) {
    const keys = Object.keys(rows[0].stats).filter((k) => typeof rows[0].stats[k] === "number");
    fs.writeFileSync(args[ci + 1], ["video,shot,label,fail,codes," + keys.join(","), ...rows.map((r) => [r.video, r.shot, r.label, r.fail ? 1 : 0, r.codes.join("+"), ...keys.map((k) => r.stats[k])].join(","))].join("\n"));
  }
  console.log(JSON.stringify(score(rows), null, 1));
}
