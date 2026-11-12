// THE FREE REPLAY OF A SAVED STORYBOARD (2026-11-12): a run's storyboard.json (the worker saves it, failed or not)
// through today's code, OFFLINE: the free camera fix, the board validation, the board-only rule (a kept line is a
// problem), then the board on a planned timeline (estimated word timing: no voice) through every engine check + the
// pace of the cuts. Lines that fell back before 2026-11-12 had their director entry thrown away: --rebuild n:loc:cam
// puts back a minimal entry (the problem text names the camera), LABELLED as rebuilt in the output.
//   node dev/simple/replaySaved.mjs --run <video dir> --script <results.json> [--board-only] [--rebuild 8:place:park:street_wide:tamsin,...]
import fs from "node:fs";
import path from "node:path";
import { fixCameras, validateStoryboard } from "../../lib/storyboardDirector.js";
import { applyStoryboard, storyboardChecks, cutStats } from "../../lib/storyboard.js";
import { checkTimeline, checkVisuals, checkSubjects, checkProduction } from "../../plan.mjs";
import { loadScript } from "./planScript.mjs";
import { planVideo } from "../../plan.mjs";
import { estimateWords } from "../../lib/planText.js";
import { directStory } from "../../lib/director/index.js";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const saved = JSON.parse(fs.readFileSync(path.join(arg("run"), "storyboard.json"), "utf8"));
const { script, idea } = loadScript(arg("script"), 1);
const lines = script.lines.map((l) => String(l.text ?? l)), boardOnly = argv.includes("--board-only");
const board = JSON.parse(JSON.stringify(saved.board)), rebuilt = [];
for (const spec of String(arg("rebuild", "")).split(",").filter(Boolean)) {
  const [n, kind, where, cam, who] = spec.split(":"), line = Number(n);
  const old = board.lines.find((l) => l.line === line);
  const e = old?.was ?? { line, place: `${kind}:${where}`, shots: [{ loc: kind === "street" ? "street" : `${kind}:${where}`, light: "day", cam, people: who ? [{ id: who, where: kind === "place" ? "place:center" : "street:3" }] : [], acts: [] }] };
  board.lines = board.lines.filter((l) => l.line !== line); board.lines.push(e); rebuilt.push(line);
}
board.lines.sort((a, b) => a.line - b.line);
const camFixes = fixCameras(board);
// the planner run the worker does (estimated words, the scene list, the mock direction): its cast is the storyboard`s
const scenes = arg("scenes") ? JSON.parse(fs.readFileSync(arg("scenes"), "utf8")) : null;
const direction = await directStory({ script, idea, provider: "mock" });
const planned = planVideo({ script, words: estimateWords(script), idea, direction, criticalMode: "report", scenes });
const cast = planned.cast ?? {};
const problems = validateStoryboard(board, { lines, cast });
const kept = board.lines.filter((l) => l.keep && !l.fallback).map((l) => l.line);
console.log(`saved board: ${board.lines.length} lines; rebuilt (labelled, not the director's own): ${rebuilt.join(", ") || "-"}; camera fixes ${camFixes}`);
console.log(`validation: ${problems.length} problem(s)${problems.length ? ": " + problems.slice(0, 6).map((p) => `#${p.line + 1} ${p.problem}`).join("; ") : ""}`);
console.log(`kept for the old planner: ${kept.length} line(s) ${kept.map((n) => `#${n + 1}`).join(" ")}${boardOnly && kept.length ? " -> board-only: these go to the repair (a paid call) and fail the run if still kept" : ""}`);
const tl = applyStoryboard(planned, board);
const checks = { ...storyboardChecks(tl, board), timeline: checkTimeline(tl).filter((p) => !/unknown built asset/.test(p)), visuals: checkVisuals(tl, script), subjects: checkSubjects(tl), production: checkProduction(tl) };
console.log(`engine checks (estimated timing, kept lines on the old planner): ${Object.entries(checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
for (const [k, v] of Object.entries(checks)) for (const p of v.slice(0, Number(arg("show", 6)))) console.log(`  ${k}: ${typeof p === "string" ? p : JSON.stringify(p)}`);
if (arg("out")) fs.writeFileSync(arg("out"), JSON.stringify(tl));
console.log(`cuts: ${JSON.stringify(cutStats(tl))}; ${tl.shots.length} shots, ${tl.shots.filter((s) => s.board).length} board, ${tl.duration} s`);
const pass = !problems.length && Object.values(checks).every((v) => !v.length) && !(boardOnly && kept.length);
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
