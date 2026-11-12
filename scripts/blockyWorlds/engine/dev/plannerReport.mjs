// Prints the plan of The Listener (or a timeline JSON given as argv[2]) as a readable table, for reviewing the cut.
// node dev/plannerReport.mjs [timeline.json] [--json out.json]
import fs from "node:fs";
import { planVideo, checkTimeline, estimateWords } from "../plan.mjs";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../../../../supabase/functions/_shared/blockyWorlds/examples.js";

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const inFile = args.find((a, i) => !a.startsWith("--") && i !== jsonAt + 1);
const tl = inFile ? JSON.parse(fs.readFileSync(inFile, "utf8"))
  : planVideo({ script: EXAMPLE_SCRIPT, words: estimateWords(EXAMPLE_SCRIPT), idea: EXAMPLE_IDEAS[0], lengthSec: 90 });
if (jsonAt >= 0) fs.writeFileSync(args[jsonAt + 1], JSON.stringify(tl, null, 2));

const pad = (s, n) => String(s ?? "").slice(0, n).padEnd(n);
const lens = tl.shots.map((s) => s.end - s.start).sort((a, b) => a - b);
console.log(`${tl.title}: ${tl.duration.toFixed(1)} s, ${tl.shots.length} shots, median ${lens[lens.length >> 1].toFixed(2)} s, min ${lens[0].toFixed(2)}, max ${lens.at(-1).toFixed(2)}`);
console.log(`cast: ${Object.entries(tl.cast).map(([id, c]) => `${id}=${c.name}(${c.role}${c.baby ? ",baby" : ""})`).join(" ")}`);
console.log(`monster: ${tl.monster ? `${tl.monster.name} ${tl.monster.type} ${tl.monster.glow}` : "none"}`);
const problems = checkTimeline(tl);
console.log(`check: ${problems.length ? problems.join("; ") : "OK"}\n`);
console.log(`${pad("#", 3)} ${pad("time", 11)} ${pad("part", 9)} ${pad("set/light", 14)} ${pad("camera", 13)} ${pad("focus", 8)} ${pad("actors", 40)} ${pad("monster/insert", 26)} text`);
tl.shots.forEach((s, i) => {
  const actors = s.actors.map((a) => `${a.id}:${a.pose}${a.hold ? `(${a.hold})` : ""}/${a.expr}`).join(" ");
  const extra = [s.monsterState ? `M:${s.monsterState.state}@${s.monsterState.spot}` : "", s.insert ? `[${s.insert.text}]` : "", s.marker ? `mk:${s.marker.kind}` : ""].filter(Boolean).join(" ");
  console.log(`${pad(i, 3)} ${pad(`${s.start.toFixed(1)}-${s.end.toFixed(1)}`, 11)} ${pad(s.part, 9)} ${pad(`${s.set}/${s.light}`, 14)} ${pad(s.camera, 13)} ${pad(s.focus, 8)} ${pad(actors, 40)} ${pad(extra, 26)} ${s.text}`);
});
const cams = {};
tl.shots.forEach((s) => { cams[s.camera] = (cams[s.camera] ?? 0) + 1; });
console.log(`\ncameras: ${JSON.stringify(cams)}`);
