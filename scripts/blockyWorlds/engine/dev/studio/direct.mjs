// STUDIO MODE prototype, step 2 (dev driver): the prepared run (dev/studio/prepare.mjs) -> ONE director for the whole
// story (scripts/blockyWorlds/studio/agent.mjs, run 1's setup) with finish-driven rounds: contact sheets on RunPod, the
// free pixel check, the one fixed Sonnet checker, at most --rounds fix rounds (v3 1, v4 up to 3) -> the best version ->
// the final render (parallel RunPod jobs of full-size frame packs, then a local encode + the mix) -> the contact sheet +
// the free frame check of the final -> report.json.
// Tiers: v3 = --model sonnet --rounds 1; v4 = --rounds 3 with the model test C picks (--model opus = claude-opus-5-5).
// Caps: --cap (everything in this run folder) and --agent-cap (model use, $3 per video at most), checked before every call.
//   node dev/studio/direct.mjs --out <run dir> [--model sonnet|opus] [--rounds 1] [--cap 5] [--agent-cap 3] [--jobs 4] --yes
import fs from "node:fs";
import path from "node:path";
import { ledger, stepTimes } from "../../../studio/ledger.mjs";
import { directVideo, derive, MODELS } from "../../../studio/agent.mjs";
import { assemble, allChecks } from "../../../studio/assemble.mjs";
import { shotMix } from "../../../studio/shotMix.mjs";
import { makeStudioBundle } from "../../../studio/bundle.mjs";
import { renderFinal, finalLimits, sheetMaxSec, RATE } from "../../../studio/render.mjs";
import { contactSheet, finalFrameCheck } from "../../../studio/finalize.mjs";
import { envKey, paceStats } from "../../voice/eleven.mjs";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = path.resolve(arg("out"));
const L = ledger(out, { capUsd: Number(arg("cap", 5)), agentCapUsd: Math.min(3, Number(arg("agent-cap", 3))) });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(out, "run.log"), l + "\n"); };
const tl0 = JSON.parse(fs.readFileSync(path.join(out, "base-timeline.json"), "utf8"));
const script = JSON.parse(fs.readFileSync(path.join(out, "results.json"), "utf8")).results[0].script;
const model = MODELS[arg("model", "sonnet")] ?? arg("model"), rounds = Number(arg("rounds", 1));
say(`direct: "${script.title}" ${tl0.duration} s, ${model}, ${rounds} fix round(s); spent $${L.total()} of $${L.capUsd} (model $${L.agentTotal()} of $${L.agentCapUsd})`);
if (!argv.includes("--yes")) { say("dry run: nothing paid (add --yes)"); process.exit(0); }
const apiKey = envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY");

// 1. the director (skipped when a directed plan is in the folder)
let plan, dirReport = null;
const doneFile = path.join(out, "directed.json");
if (fs.existsSync(doneFile)) { plan = JSON.parse(fs.readFileSync(path.join(out, "studio.json"), "utf8")); dirReport = JSON.parse(fs.readFileSync(path.join(out, "director-report.json"), "utf8")); say("directing: reused"); }
else {
  // the reserve kept out of the director's writing: the final render (worst case), each preview + checker pass, each fix
  const jobs = Number(arg("jobs", 2)), nCuts = Math.round((tl0.duration / 60) * 58);
  const reserve = { finalUsd: finalLimits(tl0, jobs).worstUsd, previewUsd: +(sheetMaxSec(nCuts) * RATE).toFixed(4), checkUsd: 0.06, fixUsd: /opus/.test(model) ? 0.16 : 0.08 };
  say(`reserve: ${JSON.stringify(reserve)}`);
  const r = await L.step("director", () => directVideo({ tl0, script, out, L, apiKey, model, rounds, minutes: Number(arg("minutes", 25)), effort: arg("effort", "medium"), reserve, briefNote: arg("brief-note") ? fs.readFileSync(arg("brief-note"), "utf8") : null, maxTokens: Number(arg("max-tokens", /opus/.test(model) ? 32000 : 20000)), log: say }));
  plan = r.plan; dirReport = r.report;
  fs.writeFileSync(doneFile, JSON.stringify({ model, rounds, best: r.report.best, finished: r.report.finished, sec: r.report.sec }, null, 1));
  say(`directing: ${r.report.calls} model calls in ${r.report.sec} s (${r.report.finished?.reason ?? "stopped"}); best = round ${r.report.best?.round ?? "-"}: failing lines [${(r.report.best?.failingLines ?? []).join(",")}], ${r.report.best?.blocked ?? "?"} blocked frame(s), gate ${r.report.best?.gate ?? "?"}; model $${L.agentTotal()}`);
}

// 2. the final timeline + every check (invalid code or a line without a cut never renders; the rest is logged)
if (!plan?.bible?.homes || !plan.shots?.length) { say("STOPPED: the director wrote no bible / no cuts (nothing to render)"); process.exit(1); }
const shotRes = derive(plan, tl0);
const badCode = Object.entries(shotRes).filter(([, r]) => !r.ok && !r.motionOnly);
const pushed = Object.entries(shotRes).filter(([, r]) => r.motionOnly).map(([id]) => id);
if (pushed.length) say(`safety push (a still camera after the last round): ${pushed.join(", ")}`);
const { tl, problems: timingProblems } = assemble(tl0, plan);
const ac = allChecks(tl, script, plan), mix = shotMix(plan, tl, shotRes);
fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(tl));
fs.writeFileSync(path.join(out, "checks.json"), JSON.stringify({ ...ac, mix }, null, 1));
say(`checks: ${Object.entries(ac.checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}; gate ${ac.gate}; code problems ${badCode.length}; shot mix ${JSON.stringify(mix.stats)} (${mix.problems.length} problem(s)); cuts ${JSON.stringify(ac.cuts)}`);
const uncovered = timingProblems.filter((p) => /no shot|no word|no line/.test(p));
if (uncovered.length) { say(`STOPPED: ${uncovered.length} line(s) without a cut (never rendered): ${uncovered.slice(0, 8).join("; ")}`); process.exit(1); }
if (badCode.length) { say(`STOPPED: ${badCode.length} cut(s) with invalid code: ${badCode.map(([id, r]) => `${id}: ${r.errors[0]}`).join("; ").slice(0, 600)}`); process.exit(1); }

// 3. the final render (RunPod, parallel) + encode + mux
const finalDir = path.join(out, "final");
let fin = fs.existsSync(path.join(finalDir, "final.mp4")) ? { ok: true, final: path.join(finalDir, "final.mp4"), reused: true } : null;
if (!fin) {
  const code = await makeStudioBundle({ timeline: tl, shots: Object.fromEntries(plan.shots.map((s) => [s.id, s.code])), assets: plan.assets, homes: plan.bible.homes, creatures: plan.creatures ?? [], captions: true });
  fin = await L.step("final_render", () => renderFinal({ code, tl, out: finalDir, mix: path.join(out, "mix.m4a"), jobs: Number(arg("jobs", 2)), L }));
  say(`final: ${fin.ok ? `${fin.final} (${fin.frames} frames, ${fin.jobs} jobs, wall ${fin.wallSec} s, $${fin.billed?.toFixed(4)})` : `FAILED ${fin.error}`}${fin.pageErrors?.length ? `; page errors ${fin.pageErrors.slice(0, 8).join(" | ")}` : ""}`);
  if (!fin.ok) process.exit(1);
}

// 4. the contact sheet + the free frame check of the final
const sheet = await L.step("contact_sheet", async () => contactSheet({ mp4: fin.final, tl, out }));
const frames = finalFrameCheck({ dir: path.join(out, "cs"), tl });
say(`final frames: ${frames.blocked.length} blocked/dark of ${tl.shots.length}${frames.blocked.length ? `: ${frames.blocked.map((b) => `#${b.i} ${b.id} (${b.problems.join("; ")})`).join(" | ").slice(0, 900)}` : ""}`);
const words = JSON.parse(fs.readFileSync(path.join(out, "words.json"), "utf8"));
const visionFailing = Object.entries(dirReport?.vision?.lines ?? {}).filter(([, l]) => !l.ok).map(([n, l]) => ({ line: Number(n), missing: l.missing }));
const report = {
  title: script.title, model, rounds, duration: tl.duration, final: fin.final, contactSheet: sheet,
  costs: L.costs, totalUsd: L.total(), modelUsd: L.agentTotal(), seconds: stepTimes(out),
  pace: paceStats(words), cuts: ac.cuts, shotMix: mix.stats, shotMixProblems: mix.problems,
  checks: Object.fromEntries(Object.entries(ac.checks).map(([k, v]) => [k, v.length])),
  finalFramesBlocked: frames.blocked, visionFailingLines: visionFailing,
  director: { history: dirReport?.history ?? null, best: dirReport?.best ?? null, finished: dirReport?.finished ?? null, calls: dirReport?.calls ?? null },
};
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
say(`DONE: ${fin.final}; total $${L.total()}`);
