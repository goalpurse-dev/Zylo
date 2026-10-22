// M2: the first frame (0.3 s) and the home view of finished runs, with the current opening fix and director (free:
// local stills). One sheet: per run, its first frame then a frame in its first home shot.
//   node m2/firstFrames.mjs <out.jpg> --proto PROTO --ff FFMPEG <runDir>...
import fs from "node:fs";
import path from "node:path";
import { compile } from "./compile.mjs";
import { preparePage, runProcess } from "./make.mjs";
import { speechEnd } from "../speechEnd.mjs";
import { fixOpening, OPEN_AT } from "./planner.mjs";
import { sheet } from "./sheet.mjs";

const argv = process.argv.slice(2), arg = (k) => argv[argv.indexOf(`--${k}`) + 1];
const out = argv[0], proto = arg("proto"), ff = arg("ff");
const runs = []; for (let i = 1; i < argv.length; i++) { if (argv[i].startsWith("--")) { i++; continue; } runs.push(argv[i]); }
const dir = path.join(path.dirname(out), "first_frames"); fs.mkdirSync(dir, { recursive: true });
const files = [];
for (const run of runs) {
  const L0 = JSON.parse(fs.readFileSync(path.join(run, "layout.json"), "utf8"));
  const voice = fs.existsSync(path.join(run, "voice", "voice.mp3")) ? path.join(run, "voice", "voice.mp3") : null;
  const wordsFile = voice ? path.join(run, "voice", "voice.words.json") : null;
  const tl0 = JSON.parse(fs.readFileSync(path.join(run, "timeline.json"), "utf8"));
  const words = wordsFile ? JSON.parse(fs.readFileSync(wordsFile, "utf8")) : null;
  const { layout: L1, moved } = fixOpening(L0);
  const layout = { ...L1, key: `${L0.key}_ff`.slice(0, 60) };
  void tl0;
  const tl = compile(layout, words, speechEnd(ff, voice), { roles: L0.roles });
  const home = tl.sentences.find((s) => s.role === "problem") ?? tl.sentences[1];
  const times = [OPEN_AT, +((home.t0 + home.t1) / 2).toFixed(2)];
  preparePage({ layout, tl, proto });
  const d = path.join(dir, path.basename(run));
  await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, d, times.join(",")], { cwd: proto });
  files.push(d);
  console.log(path.basename(run), "opening:", JSON.stringify(moved), "director notes:", tl.director.notes.filter((n) => !/dropped|no focus/.test(n)).join(" | ") || "none");
}
// a sheet: each run's two stills side by side
const all = path.join(dir, "all"); fs.mkdirSync(all, { recursive: true });
const T = [];
files.forEach((d, i) => { for (const k of [0, 1]) { fs.copyFileSync(path.join(d, `f_00${k}.png`), path.join(all, `f_${String(i * 2 + k).padStart(3, "0")}.png`)); T.push(i * 2 + k); } });
fs.writeFileSync(path.join(all, "times.json"), JSON.stringify(T));
sheet(ff, all, null, out, T, { perRow: 2 * Math.min(files.length, 3) });
console.log(out);
