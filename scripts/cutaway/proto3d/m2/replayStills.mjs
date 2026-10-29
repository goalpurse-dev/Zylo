// M2: the replayed camera (m2/replayCamera.mjs) as stills, old path beside new, at the middle of every sentence
// (free: local renders). Writes <out>/old, <out>/new and <out>/compare.jpg.
//   node m2/replayStills.mjs <runDir> <words.json> <speechEnd s> <out> --proto PROTO --ff FFMPEG
import fs from "node:fs";
import path from "node:path";
import { replay } from "./replayCamera.mjs";
import { preparePage, runProcess } from "./make.mjs";
import { sheet } from "./sheet.mjs";

const [run, wf, se, out] = process.argv.slice(2), arg = (k) => process.argv[process.argv.indexOf(`--${k}`) + 1];
const proto = arg("proto"), ff = arg("ff");
const r = replay(run, JSON.parse(fs.readFileSync(wf, "utf8")), Number(se));
const times = r.rows.map((x) => x.t);
const L0 = JSON.parse(fs.readFileSync(path.join(run, "layout.json"), "utf8")), tl0 = JSON.parse(fs.readFileSync(path.join(run, "timeline.json"), "utf8"));
// its own page key: a video rendering the same topic at the same time keeps its page
for (const [name, lay, tl] of [["old", L0, tl0], ["new", r.layout, r.tl]]) {
  const layout = { ...lay, key: `${lay.key}_replay` };
  preparePage({ layout, tl, proto });
  await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, path.join(out, name), times.join(",")], { cwd: proto });
}
sheet(ff, path.join(out, "old"), path.join(out, "new"), path.join(out, "compare.jpg"), times);
fs.writeFileSync(path.join(out, "rows.json"), JSON.stringify({ moved: r.moved, notes: r.notes, rows: r.rows }, null, 1));
console.log(path.join(out, "compare.jpg"));
