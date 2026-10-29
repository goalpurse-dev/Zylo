// M2: the camera of a planned layout, before and after a director change, measured (free: no API call, no render).
// For each sentence: the share of open lawn or sky and of the main subject at its middle, old path vs new path.
//   node m2/replayCamera.mjs <runDir (with layout.json, timeline.json)> <words.json> <speechEnd s>
import fs from "node:fs";
import path from "node:path";
import { compile } from "./compile.mjs";
import { cameraAt, homeView, projectBox } from "./director.js";
import { measureKey, placeLifeProps } from "./framing.js";

export function replay(run, words, speechEnd) {
  const L0 = JSON.parse(fs.readFileSync(path.join(run, "layout.json"), "utf8"));
  const old = JSON.parse(fs.readFileSync(path.join(run, "timeline.json"), "utf8"));
  const { layout, moved } = placeLifeProps({ ...L0, world: { ...L0.world, worker: false } }, homeView(L0), projectBox);
  const tl = compile(layout, words, speechEnd, { roles: L0.roles });
  const rows = tl.sentences.filter((s) => (s.t0 + s.t1) / 2 <= tl.marks.signPop).map((s) => {
    const t = (s.t0 + s.t1) / 2, a = cameraAt(old.camera.end, t), b = cameraAt(tl.camera.end, t);
    return { role: s.role, t: +t.toFixed(1), before: measureKey(L0, a.pos, a.tgt), after: measureKey(layout, b.pos, b.tgt) };
  });
  return { layout, tl, moved, rows, notes: tl.director.notes };
}

if (/replayCamera\.mjs$/.test(process.argv[1] ?? "")) {
  const [run, wf, se] = process.argv.slice(2);
  const r = replay(run, JSON.parse(fs.readFileSync(wf, "utf8")), Number(se));
  console.log("moved:", r.moved.join(", ") || "none");
  for (const n of r.notes) console.log("note:", n);
  for (const x of r.rows) console.log(x.role.padEnd(10), String(x.t).padStart(5), "empty", `${(x.before.empty * 100).toFixed(0)}% -> ${(x.after.empty * 100).toFixed(0)}%`.padEnd(12), "subject", `${(x.before.subject * 100).toFixed(1)}% -> ${(x.after.subject * 100).toFixed(1)}%`);
}
