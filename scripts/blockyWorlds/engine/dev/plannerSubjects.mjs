// node dev/plannerSubjects.mjs [--dir out/paid1] : the plan's subject per shot + checkSubjects / checkVisuals / checkTimeline
import fs from "node:fs";
import path from "node:path";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, estimateWords } from "../plan.mjs";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../../../../supabase/functions/_shared/blockyWorlds/examples.js";
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
let script = EXAMPLE_SCRIPT, idea = EXAMPLE_IDEAS[0], words = null;
if (opt("--dir")) { const s = JSON.parse(fs.readFileSync(path.join(opt("--dir"), "script.json"), "utf8")); script = s.script ?? s; idea = s.idea ?? idea; words = JSON.parse(fs.readFileSync(path.join(opt("--dir"), "words.json"), "utf8")); }
const tl = planVideo({ script, words: words ?? estimateWords(script), idea, lengthSec: 90 });
const from = Number(opt("--from") ?? 0);
tl.shots.forEach((s, i) => { if (s.line >= from) console.log(String(i).padStart(3), String(s.line).padStart(3), s.camera.padEnd(13), String(s.focus).padEnd(8), String(s.subject).padEnd(16), (s.subjectWith ?? []).join(",").padEnd(6), s.set.padEnd(8), s.monsterState ? `${s.monsterState.state}@${s.monsterState.spot}` : "-", s.actors.map((a) => `${a.id}:${a.pose}${a.hold ? "+" + a.hold : ""}`).join(","), JSON.stringify((s.markers ?? (s.marker ? [s.marker] : [])).map((m) => `${m.kind} ${m.text}@${m.on}`)), "|", s.text); });
console.log("checkSubjects", checkSubjects(tl));
console.log("checkVisuals", checkVisuals(tl, script));
console.log("checkTimeline", checkTimeline(tl));
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(tl, null, 1));
