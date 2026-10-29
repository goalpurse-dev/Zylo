// M2: a free look at a plan before anything is paid for: the layout on draft word times (0.3 s a word), one still per
// sentence at its moment (the preview check's times), each with its sentence and what it must show. Free.
//   node m2/draftBeats.mjs <runDir (layout.json, script.json)> --proto PROTO --ff FFMPEG [--words voice.words.json] -> <runDir>/draft/ (b_NN.png, beats.json, strip.jpg)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { compile } from "./compile.mjs";
import { draftWords } from "./plan.js";
import { previewTimes } from "./checks.mjs";
import { preparePage, runProcess } from "./make.mjs";

const run = process.argv[2], arg = (k) => process.argv[process.argv.indexOf(`--${k}`) + 1];
const proto = arg("proto"), ff = arg("ff");
const layout0 = JSON.parse(fs.readFileSync(path.join(run, "layout.json"), "utf8")), script = JSON.parse(fs.readFileSync(path.join(run, "script.json"), "utf8"));
const layout = { ...layout0, key: `${layout0.key}_draft`.slice(0, 60) };
// --words: a voice's real word times (the frames the paid check would see); else draft times
const words = arg("words") && process.argv.includes("--words") ? JSON.parse(fs.readFileSync(arg("words"), "utf8")) : draftWords(script.sentences);
const tl = compile(layout, words, words.at(-1).e + 0.1, { roles: script.sentences.map((s) => s.role) });
const pts = previewTimes(tl, layout);
preparePage({ layout, tl, proto });
const dir = path.join(run, "draft"); fs.mkdirSync(dir, { recursive: true });
await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, dir, pts.map((p) => p.t).join(",")], { cwd: proto });
const rows = pts.map((p, i) => ({ role: p.role, text: p.text, t: p.t, must: p.must ?? null, file: `f_${String(i).padStart(3, "0")}.png` }));
fs.writeFileSync(path.join(dir, "beats.json"), JSON.stringify(rows, null, 1));
execFileSync(ff, ["-y", "-loglevel", "error", ...rows.flatMap((r) => ["-i", path.join(dir, r.file)]), "-filter_complex", `${rows.map((_, i) => `[${i}]scale=300:-1[v${i}]`).join(";")};${rows.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${rows.length}`, path.join(dir, "strip.jpg")]);
for (const [i, r] of rows.entries()) console.log(i, r.role.padEnd(9), r.text, "\n            must:", r.must ?? "-");
