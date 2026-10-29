// M2 cost round: does a cheaper model judge the preview frames like Sonnet does? Re-runs the vision check with
// another model on the frames Sonnet already judged (each run's preview_small + vision.json round 1) and counts where
// they agree, beat by beat. Paid (the other model's calls only), logged.
//   node m2/visionAgree.mjs --model claude-haiku-5-5 --log spend.jsonl <runDir>...
import fs from "node:fs";
import path from "node:path";
import { loadKey } from "./llm.mjs";
import { visionCheck } from "./checks.mjs";

const argv = process.argv.slice(2), arg = (k) => argv[argv.indexOf(`--${k}`) + 1];
const model = arg("model"), log = arg("log");
const runs = []; for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith("--")) { i++; continue; } runs.push(argv[i]); }
const apiKey = loadKey();
let agree = 0, total = 0, cost = 0, missedFails = 0, extraFails = 0;
const rows = [];
for (const run of runs) {
  const v = JSON.parse(fs.readFileSync(path.join(run, "vision.json"), "utf8")), tl = JSON.parse(fs.readFileSync(path.join(run, "timeline.json"), "utf8"));
  const text = (role) => tl.sentences.find((s) => s.role === role)?.text ?? "";
  const files = fs.readdirSync(path.join(run, "preview_small")).filter((f) => f.endsWith(".jpg")).sort();
  const frames = v.round1.map((f, i) => ({ role: f.role, t: f.t, text: text(f.role), file: path.join(run, "preview_small", files[i]) }));
  const r = await visionCheck({ apiKey, frames, log, model });
  cost += r.costUsd;
  r.frames.forEach((f, i) => {
    const s = v.round1[i]; total++;
    if (f.ok === s.ok) agree++; else if (s.ok) extraFails++; else missedFails++;
    rows.push({ run: path.basename(run), role: s.role, sonnet: s.ok, other: f.ok, otherSaw: f.ok === s.ok ? undefined : f.problem });
  });
  console.log(path.basename(run), "sonnet fails:", v.round1.filter((f) => !f.ok).map((f) => f.role).join(","), "| other fails:", r.frames.filter((f) => !f.ok).map((f) => f.role).join(","), `$${r.costUsd}`);
}
const res = { model, frames: total, agree, agreement: +(agree / total).toFixed(3), missedFails, extraFails, costUsd: +cost.toFixed(4), rows };
fs.writeFileSync(path.join(path.dirname(runs[0]), `vision_agree_${model}.json`), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ model, frames: total, agree, agreement: res.agreement, missedFails, extraFails, costUsd: res.costUsd }));
