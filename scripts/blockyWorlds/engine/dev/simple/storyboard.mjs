// FREE: a planned timeline + a storyboard (lib/storyboards/*.js) -> the storyboard timeline, then the HARD checks
// (storyboard: board, rule, actions, places + the engine's timeline / visuals / subjects / production checks).
// Exits 1 on any problem (no stills, no render).
//   node dev/simple/storyboard.mjs --tl <planned timeline.json> --board kidNeverBlinks --script <results.json> --pick 2 --out <timeline.json>
import fs from "node:fs";
import { applyStoryboard, storyboardChecks } from "../../lib/storyboard.js";
import { checkTimeline, checkVisuals, checkSubjects, checkProduction } from "../../plan.mjs";
import { loadScript } from "./planScript.mjs";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const mod = await import(`../../lib/storyboards/${arg("board", "kidNeverBlinks")}.js`);
const board = Object.values(mod)[0];
const tl = applyStoryboard(JSON.parse(fs.readFileSync(arg("tl"), "utf8")), board);
const { script } = loadScript(arg("script"), arg("pick"));
const checks = { ...storyboardChecks(tl, board), timeline: checkTimeline(tl).filter((p) => !/unknown built asset/.test(p)), visuals: checkVisuals(tl, script), subjects: checkSubjects(tl), production: checkProduction(tl) };
fs.writeFileSync(arg("out"), JSON.stringify(tl));
console.log(`storyboard ${board.id}: ${tl.shots.length} shots (${tl.shots.filter((s) => s.board).length} storyboard), ${tl.duration} s; checks ${Object.entries(checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
for (const [k, v] of Object.entries(checks)) for (const p of v.slice(0, 12)) console.log(`  ${k}: ${typeof p === "string" ? p : JSON.stringify(p)}`);
if (Object.values(checks).some((v) => v.length)) { console.log("STOP: a check fails"); process.exit(1); }
console.log("OK: every check clean");
