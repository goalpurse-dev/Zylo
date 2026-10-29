// M2: the vision check on the approved videos' own preview frames (the golden pages, on the approved voices): how
// often does it fail a frame the owner approved? (paid: about $0.05 a video)
//   node m2/calibrateVision.mjs <proto> <ffmpeg> <outDir> <spend.jsonl>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./compile.mjs";
import { previewTimes, shrink, visionCheck } from "./checks.mjs";
import { loadKey } from "./llm.mjs";
import { runProcess, syncProto } from "./make.mjs";
import { sentencesOf } from "./curves.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const [proto, ff, out, log] = process.argv.slice(2);
const R = "C:/Users/Public/Zylo/research/seamless-niche";
const GOLD = [["french_drain", `${R}/m2drain/voice/voice_final.words.json`, `${R}/work/m2drain/times.json`], ["landfill", `${R}/m1/voice_tests/voice_final_eric.words.json`, `${R}/work/m1full_v2/times.json`]];
syncProto(proto);
const report = {};
for (const [key, wf, tf] of GOLD) {
  const golden = JSON.parse(fs.readFileSync(path.join(here, "layouts", `${key}.json`), "utf8"));
  const roles = JSON.parse(fs.readFileSync(path.join(here, "layouts", `${key}.template.json`), "utf8")).roles;
  const words = JSON.parse(fs.readFileSync(wf, "utf8")), TM = JSON.parse(fs.readFileSync(tf, "utf8"));
  const tl = compile(golden, words, TM.speechEnd, { roles });
  // the golden page (m2_<key>.html) is already in the render folder; its timeline gets the roles too
  fs.writeFileSync(path.join(proto, "m2run", `${key}.timeline.json`), JSON.stringify(compile(golden, words, TM.speechEnd)));
  const shots = previewTimes(tl).map((s, i) => ({ ...s, text: sentencesOf(words, roles)[i].text }));
  const dir = path.join(out, key);
  await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${key}.html`, path.join(dir, "png"), shots.map((s) => s.t).join(",")], { cwd: proto });
  const jpgs = shrink(ff, shots.map((_, i) => path.join(dir, "png", `f_${String(i).padStart(3, "0")}.png`)), path.join(dir, "jpg"));
  const vc = await visionCheck({ apiKey: loadKey(), frames: shots.map((s, i) => ({ ...s, file: jpgs[i] })), log });
  report[key] = { failed: vc.frames.filter((f) => !f.ok).map((f) => `${f.role}: ${f.problem}`), passed: vc.frames.filter((f) => f.ok).length, of: vc.frames.length, costUsd: vc.costUsd };
  console.log(key, JSON.stringify(report[key], null, 1));
}
fs.writeFileSync(path.join(out, "calibration.json"), JSON.stringify(report, null, 1));
