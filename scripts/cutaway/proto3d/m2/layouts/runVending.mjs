// The vending machine video: the hand-planned M2 layout on its fact-checked script, with one ElevenLabs take
// (Eric, the approved livelier settings, re-timed by silence), rendered by the M2 runner, then the measured checks.
// The grading is set from the preview's saturation, as the runner does. No Claude calls.
//   node m2/layouts/runVending.mjs <outDir> <proto> <ffmpeg> <spend.jsonl>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeVoice } from "../voice.mjs";
import { makeVideo, preparePage, runProcess } from "../make.mjs";
import { compile } from "../compile.mjs";
import { speechEnd } from "../../speechEnd.mjs";
import { gradingFor, previewTimes, renderChecks, saturationOf, timelineChecks } from "../checks.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const [out, proto, ff, log] = process.argv.slice(2);
const wt = path.resolve(here, "../../../../..");
let layout = JSON.parse(fs.readFileSync(path.join(here, "vending_machine.template.json"), "utf8"));
const script = JSON.parse(fs.readFileSync(path.join(here, "vending_machine.script.json"), "utf8"));
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();
const v = await makeVoice({ text: script.sentences.map((s) => s.text).join(" "), out: path.join(out, "voice"), ff, wt, log, sectionWords: ["Drop", "Japan", "Hero"] });
const roles = script.sentences.map((s) => s.role);
const tl = compile(layout, v.words, speechEnd(ff, v.voice), { roles });
const checks = timelineChecks(layout, tl);
preparePage({ layout, tl, proto });
const times = previewTimes(tl).map((s) => s.t);
await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, path.join(out, "preview"), times.join(",")], { cwd: proto });
const sat0 = saturationOf(ff, times.map((_, i) => path.join(out, "preview", `f_${String(i).padStart(3, "0")}.png`)));
const grade = gradingFor(sat0);
if (grade) layout = { ...layout, world: { ...layout.world, sat: grade } };
const made = await makeVideo({ layout, voice: v.voice, words: v.words, out, proto, ff, roles, wt });
const measured = renderChecks({ ff, video: made.files.end, out: path.join(out, "checks") });
const report = { voiceUsd: v.usd, previewSaturation: sat0, grading: grade ?? 1.38, timelineChecks: checks, measured, timing: made.timing, files: made.files, seconds: (Date.now() - t0) / 1000 };
fs.writeFileSync(path.join(out, "run_report.json"), JSON.stringify(report, null, 1));
fs.copyFileSync(path.join(here, "vending_machine.script.json"), path.join(out, "script.json"));
fs.writeFileSync(path.join(out, "layout.json"), JSON.stringify(layout, null, 1));
console.log(JSON.stringify({ voiceUsd: v.usd, seconds: report.seconds, saturation: measured.saturation, sceneMax: measured.sceneMax, problems: [...checks.problems, ...measured.problems], file: made.files.end }, null, 1));
