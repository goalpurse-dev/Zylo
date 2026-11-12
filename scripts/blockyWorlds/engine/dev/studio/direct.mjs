// STUDIO MODE prototype, step 2 (dev driver): the prepared run (dev/studio/prepare.mjs) -> the orchestrated director
// (scripts/blockyWorlds/studio/director.mjs: the world, the scenes in parallel, the look checks, capped fix rounds; the
// best version is kept) -> the gate -> the final render (K parallel RunPod jobs of full-size frame packs, then a local
// encode + the mix) -> the labelled contact sheet + the free frame check of the final -> report.json.
// Tiers: --model sonnet|haiku, --rounds (fix rounds: v3 1, v4 3, Sonnet tests 2). After the cap the best version renders
// even if lines still fail (they are logged); a failing CODE gate (invalid code, timing) never renders.
// Caps: --cap (everything in this run folder) and --agent-cap (model use, default $3 per video), checked before every call.
//   node dev/studio/direct.mjs --out <run dir> [--model sonnet] [--rounds 2] [--cap 5] [--agent-cap 3] [--jobs 6] --yes
import fs from "node:fs";
import path from "node:path";
import { ledger, stepTimes } from "../../../studio/ledger.mjs";
import { directStudio, derive, MODELS } from "../../../studio/director.mjs";
import { assemble, allChecks } from "../../../studio/assemble.mjs";
import { makeStudioBundle } from "../../../studio/bundle.mjs";
import { renderFinal } from "../../../studio/render.mjs";
import { contactSheet, finalFrameCheck } from "../../../studio/finalize.mjs";
import { envKey, paceStats } from "../../voice/eleven.mjs";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = path.resolve(arg("out"));
const L = ledger(out, { capUsd: Number(arg("cap", 5)), agentCapUsd: Number(arg("agent-cap", 3)) });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(out, "run.log"), l + "\n"); };
const tl0 = JSON.parse(fs.readFileSync(path.join(out, "base-timeline.json"), "utf8"));
const script = JSON.parse(fs.readFileSync(path.join(out, "results.json"), "utf8")).results[0].script;
const model = MODELS[arg("model", "sonnet")] ?? arg("model"), rounds = Number(arg("rounds", 2));
// the tier defaults: Haiku thinks long at medium effort (run 3: 14k thinking tokens and no answer), so low effort + room
const cheap = /haiku/.test(model), effortArg = arg("effort", cheap ? "low" : "medium"), sceneTok = Number(arg("scene-tokens", cheap ? 24000 : 14000));
say(`direct: "${script.title}" ${tl0.duration} s, ${model}, ${rounds} fix round(s); spent $${L.total()} of $${L.capUsd} (model $${L.agentTotal()} of $${L.agentCapUsd})`);
if (!argv.includes("--yes")) { say("dry run: nothing paid (add --yes)"); process.exit(0); }
const apiKey = envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY");

// 1. the director (skipped when a directed plan is in the folder)
let plan, dirReport = null;
const doneFile = path.join(out, "directed.json");
if (fs.existsSync(doneFile)) { plan = JSON.parse(fs.readFileSync(path.join(out, "studio.json"), "utf8")); dirReport = JSON.parse(fs.readFileSync(path.join(out, "director-report.json"), "utf8")); say("directing: reused"); }
else {
  const r = await L.step("director", () => directStudio({ tl0, script, out, L, apiKey, model, rounds, minutes: Number(arg("minutes", 25)), effort: effortArg, sceneSec: Number(arg("scene-sec", 15)), sceneTokens: sceneTok, repair: !argv.includes("--no-repair"), log: say }));
  plan = r.plan; dirReport = r.report;
  fs.writeFileSync(doneFile, JSON.stringify({ model, rounds, best: r.report.best, sec: r.report.sec }, null, 1));
  say(`directing: ${r.report.calls} model calls in ${r.report.sec} s; best = round ${r.report.best.round}: failing lines [${r.report.best.failingLines.join(",")}], ${r.report.best.blocked} blocked frame(s), gate ${r.report.best.gate}; model $${L.agentTotal()}`);
}

// 2. the final timeline + every check (a failing code gate never renders; failing look checks after the cap are logged)
const shotRes = derive(plan, tl0);
const badCode = Object.entries(shotRes).filter(([, r]) => !r.ok && !r.motionOnly); // invalid / throwing code never renders
const pushed = Object.entries(shotRes).filter(([, r]) => r.motionOnly).map(([id]) => id);
if (pushed.length) say(`safety push (a still camera after the fix cap): ${pushed.join(", ")}`);
const { tl, problems: timingProblems } = assemble(tl0, plan);
const ac = allChecks(tl, script, plan);
const uncovered = timingProblems.filter((p) => /no shot|no word|no line/.test(p));
if (uncovered.length) { say(`STOPPED: ${uncovered.length} line(s) without a cut (never rendered): ${uncovered.slice(0, 8).join("; ")}`); process.exit(1); }
fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(tl));
fs.writeFileSync(path.join(out, "checks.json"), JSON.stringify(ac, null, 1));
say(`checks: ${Object.entries(ac.checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}; gate ${ac.gate}; code problems ${badCode.length}; cuts ${JSON.stringify(ac.cuts)}`);
if (badCode.length) { say(`STOPPED: ${badCode.length} cut(s) with invalid code: ${badCode.map(([id, r]) => `${id}: ${r.errors[0]}`).join("; ").slice(0, 600)}`); process.exit(1); }
if (ac.gate) say(`NOTE: the engine checks still fail (${ac.gate}) after the fix-round cap: rendering the best version, the failures are logged in checks.json`);

// 3. the final render (RunPod, parallel) + encode + mux
const finalDir = path.join(out, "final");
let fin = fs.existsSync(path.join(finalDir, "final.mp4")) ? { ok: true, final: path.join(finalDir, "final.mp4"), reused: true } : null;
if (!fin) {
  const code = await makeStudioBundle({ timeline: tl, shots: Object.fromEntries(plan.shots.map((s) => [s.id, s.code])), assets: plan.assets, homes: plan.bible.homes, creatures: plan.creatures ?? [], captions: true });
  fin = await L.step("final_render", () => renderFinal({ code, tl, out: finalDir, mix: path.join(out, "mix.m4a"), jobs: Number(arg("jobs", 6)), L }));
  say(`final: ${fin.ok ? `${fin.final} (${fin.frames} frames, ${fin.jobs} jobs, wall ${fin.wallSec} s, $${fin.billed?.toFixed(4)})` : `FAILED ${fin.error}`}${fin.pageErrors?.length ? `; page errors ${fin.pageErrors.slice(0, 8).join(" | ")}` : ""}`);
  if (!fin.ok) process.exit(1);
}

// 4. the contact sheet + the free frame check of the final (the same thresholds as the previews)
const sheet = await L.step("contact_sheet", async () => contactSheet({ mp4: fin.final, tl, out }));
const frames = finalFrameCheck({ dir: path.join(out, "cs"), tl });
say(`final frames: ${frames.blocked.length} blocked/dark of ${tl.shots.length}${frames.blocked.length ? `: ${frames.blocked.map((b) => `#${b.i} ${b.id} (${b.problems.join("; ")})`).join(" | ").slice(0, 900)}` : ""}`);
const words = JSON.parse(fs.readFileSync(path.join(out, "words.json"), "utf8"));
const best = dirReport?.best ?? null;
const report = {
  title: script.title, model, rounds, duration: tl.duration, final: fin.final, contactSheet: sheet,
  costs: L.costs, totalUsd: L.total(), modelUsd: L.agentTotal(), seconds: stepTimes(out),
  pace: paceStats(words), cuts: ac.cuts, checks: Object.fromEntries(Object.entries(ac.checks).map(([k, v]) => [k, v.length])),
  finalFramesBlocked: frames.blocked, director: { rounds: dirReport?.rounds ?? null, best, stillFailing: dirReport?.stillFailing ?? null, calls: dirReport?.calls ?? null },
};
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
say(`DONE: ${fin.final}; total $${L.total()}`);
