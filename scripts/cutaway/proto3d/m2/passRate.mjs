// M2: why new layouts fail. For every run folder: the plan (stopped by the solver?), the preview check before and
// after its repair (which beats, what the checker saw), the gate, and what each run cost up to its end. Free.
//   node m2/passRate.mjs <out.json> <runDir>...
import fs from "node:fs";
import path from "node:path";

const [out, ...runs] = process.argv.slice(2);
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const rows = [];
for (const run of runs) {
  const plan = read(path.join(run, "plan_report.json")), report = read(path.join(run, "run_report.json")), v = read(path.join(run, "vision.json"));
  if (!plan && !v) continue;
  const saved = !!plan?.reuse;
  const r1 = v?.round1 ?? [], r2 = v?.round2 ?? null;
  const fails1 = r1.filter((f) => !f.ok), still = (r2 ?? r1).filter((f) => !f.ok);
  rows.push({
    run: path.basename(path.dirname(run)) + "/" + path.basename(run), saved, lengthSec: plan?.lengthSec,
    planStopped: (plan?.problems ?? []).length > 0, planProblems: plan?.problems ?? [],
    frames: r1.length, round1Fails: fails1.map((f) => ({ role: f.role, problem: f.problem })), repaired: !!r2,
    stillFailing: still.map((f) => f.role), passedGate: v ? v.passedGate !== false && !(still.length > 2 || still.some((f) => f.role === "name")) : null,
    ok: report?.ok ?? (plan?.problems?.length ? false : null), totalUsd: report?.totalUsd ?? plan?.planUsd ?? null,
  });
}
const fresh = rows.filter((r) => !r.saved);
const summary = {
  newLayoutRuns: fresh.length,
  stoppedAtPlan: fresh.filter((r) => r.planStopped).length,
  reachedPreview: fresh.filter((r) => r.frames).length,
  passedFirstLook: fresh.filter((r) => r.frames && r.round1Fails.length <= 2 && !r.round1Fails.some((f) => f.role === "name")).length,
  passedAfterRepair: fresh.filter((r) => r.passedGate).length,
  meanRound1Fails: +(fresh.filter((r) => r.frames).reduce((s, r) => s + r.round1Fails.length / r.frames, 0) / Math.max(1, fresh.filter((r) => r.frames).length)).toFixed(3),
};
fs.writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary));
for (const r of fresh) console.log(r.run.padEnd(30), r.planStopped ? "PLAN STOPPED" : "", r.frames ? `round1 ${r.round1Fails.length}/${r.frames} fail` : "", r.repaired ? `after repair: ${r.stillFailing.join(",") || "none"}` : "", r.passedGate === false ? "GATE BLOCKED" : r.passedGate ? "passed" : "");
