// M2: a finished video beat by beat, for review: each sentence next to its frame (taken from the final MP4 at the
// sentence's moment), what it had to show, and the preview check's last verdict for it. Free (ffmpeg only).
//   node m2/beatSheet.mjs <runDir> --ff FFMPEG       -> <runDir>/beats/b_NN.jpg + beats.json
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { previewTimes } from "./checks.mjs";

const run = process.argv[2], ff = process.argv[process.argv.indexOf("--ff") + 1];
const tl = JSON.parse(fs.readFileSync(path.join(run, "timeline.json"), "utf8")), layout = JSON.parse(fs.readFileSync(path.join(run, "layout.json"), "utf8"));
const files = fs.readdirSync(run), video = files.find((f) => /_end\.mp4$/.test(f) && !f.startsWith("silent")) ?? files.find((f) => /-web\.mp4$/.test(f));
const v = (() => { try { return JSON.parse(fs.readFileSync(path.join(run, "vision.json"), "utf8")); } catch { return {}; } })();
// the last verdict for each beat: the latest round that looked at it
const verdict = {};
for (const k of ["round1", "round2", "round3"]) for (const f of v[k] ?? []) verdict[f.role] = { ok: f.ok, seen: f.seen, problem: f.problem, round: k };
const dir = path.join(run, "beats"); fs.mkdirSync(dir, { recursive: true });
const rows = previewTimes(tl, layout).map((p, i) => {
  const file = `b_${String(i).padStart(2, "0")}.jpg`;
  execFileSync(ff, ["-y", "-loglevel", "error", "-ss", String(p.t), "-i", path.join(run, video), "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", path.join(dir, file)]);
  return { role: p.role, text: p.text, t: p.t, must: p.must ?? null, file, check: verdict[p.role] ?? null };
});
fs.writeFileSync(path.join(dir, "beats.json"), JSON.stringify({ video, rows }, null, 1));
console.log(path.join(dir, "beats.json"), rows.length, "beats");
