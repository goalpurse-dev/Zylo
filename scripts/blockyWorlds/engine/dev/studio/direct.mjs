// STUDIO MODE prototype, step 2 (dev driver): the prepared run (dev/studio/prepare.mjs) -> the directing agent
// (scripts/blockyWorlds/studio/agent.mjs: bible, assets, shot code, preview sheets on RunPod, fixes) -> the final render
// (K parallel RunPod jobs of full-size frame packs, then a local encode + the mix) -> the labelled contact sheet -> the
// vision audit of the final frames -> report.json (cost + time per step, cuts/min, checks).
// Caps: the experiment cap (default $5, everything in this run folder) and the agent cap (default $3, Sonnet only).
//   node dev/studio/direct.mjs --out <run dir> [--cap 5] [--agent-cap 3] [--minutes 22] [--jobs 6] --yes
import fs from "node:fs";
import path from "node:path";
import { ledger, stepTimes } from "../../../studio/ledger.mjs";
import { directVideo, lineNeeds, derive } from "../../../studio/agent.mjs";
import { assemble, allChecks } from "../../../studio/assemble.mjs";
import { makeStudioBundle } from "../../../studio/bundle.mjs";
import { renderFinal } from "../../../studio/render.mjs";
import { contactSheet, visionAudit } from "../../../studio/finalize.mjs";
import { envKey } from "../../voice/eleven.mjs";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = path.resolve(arg("out"));
const L = ledger(out, { capUsd: Number(arg("cap", 5)), agentCapUsd: Number(arg("agent-cap", 3)) });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(out, "run.log"), l + "\n"); };
const tl0 = JSON.parse(fs.readFileSync(path.join(out, "base-timeline.json"), "utf8"));
const script = JSON.parse(fs.readFileSync(path.join(out, "results.json"), "utf8")).results[0].script;
say(`direct: "${script.title}" ${tl0.duration} s; spent $${L.total()} of $${L.capUsd} (agent $${L.agentTotal()} of $${L.agentCapUsd})`);
if (!argv.includes("--yes")) { say("dry run: nothing paid (add --yes)"); process.exit(0); }
const apiKey = envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY");

// 1. the directing agent (skipped when a finished plan is in the folder)
let plan;
const doneFile = path.join(out, "directed.json");
if (fs.existsSync(doneFile)) { plan = JSON.parse(fs.readFileSync(path.join(out, "studio.json"), "utf8")); say("directing: reused"); }
else {
  const r = await L.step("agent", () => directVideo({ tl0, script, out, L, apiKey, agentCapUsd: L.agentCapUsd, minutes: Number(arg("minutes", 22)), log: say }));
  fs.writeFileSync(doneFile, JSON.stringify({ finished: r.finished, gate: r.gate, previews: r.previews, sec: r.sec }, null, 1));
  say(`directing: ${r.finished ? "finished" : "STOPPED"} after ${r.sec} s, ${r.previews} preview round(s), gate ${r.gate}; agent $${L.agentTotal()}\n${r.report}`);
  plan = r.plan;
}

// 2. the final timeline + every check (the gate must be clean: no render otherwise)
const shotRes = derive(plan, tl0);
const badCode = Object.entries(shotRes).filter(([, r]) => !r.ok);
if (badCode.length) say(`cut code problems: ${badCode.map(([id, r]) => `${id}: ${r.errors[0]}`).join("; ").slice(0, 800)}`);
const { tl } = assemble(tl0, plan);
const ac = allChecks(tl, script, plan);
ac.gate += badCode.length; // a cut whose code fails the validator / pre-check never renders
fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(tl));
fs.writeFileSync(path.join(out, "checks.json"), JSON.stringify(ac, null, 1));
say(`checks: ${Object.entries(ac.checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}; gate ${ac.gate}; cuts ${JSON.stringify(ac.cuts)}`);
if (ac.gate && !argv.includes("--render-anyway")) { say("STOPPED: a gate check fails (no final render)"); process.exit(1); }

// 3. the final render (RunPod, parallel) + encode + mux
const finalDir = path.join(out, "final");
let fin = fs.existsSync(path.join(finalDir, "final.mp4")) ? { ok: true, final: path.join(finalDir, "final.mp4"), reused: true } : null;
if (!fin) {
  const code = await makeStudioBundle({ timeline: tl, shots: Object.fromEntries(plan.shots.map((s) => [s.id, s.code])), assets: plan.assets, homes: plan.bible.homes, captions: true });
  fin = await L.step("final_render", () => renderFinal({ code, tl, out: finalDir, mix: path.join(out, "mix.m4a"), jobs: Number(arg("jobs", 6)), L }));
  say(`final: ${fin.ok ? `${fin.final} (${fin.frames} frames, ${fin.jobs} jobs, wall ${fin.wallSec} s, $${fin.billed?.toFixed(4)})` : `FAILED ${fin.error}`}${fin.pageErrors?.length ? `; page errors ${fin.pageErrors.slice(0, 8).join(" | ")}` : ""}`);
  if (!fin.ok) process.exit(1);
}

// 4. the contact sheet + the vision audit of the final frames
const sheet = await L.step("contact_sheet", async () => contactSheet({ mp4: fin.final, tl, out }));
const needs = lineNeeds(tl0, script);
let audit = null;
try { audit = await L.step("vision_audit", () => visionAudit({ mp4: fin.final, tl, mustShow: needs.mustShow, out, L, apiKey })); }
catch (e) { say(`vision audit: ${e.message}`); }
const auditBad = audit ? audit.lines.filter((x) => !x.allShown) : null;
say(`vision audit: ${audit ? `${audit.lines.length - auditBad.length}/${audit.lines.length} lines fully shown; cuts with a problem ${audit.cuts.filter((c) => c.missing.length || c.problem).length}/${audit.cuts.length} ($${audit.usd})` : "skipped"}`);

// 5. the report
const report = {
  title: script.title, duration: tl.duration, final: fin.final, contactSheet: sheet,
  costs: L.costs, totalUsd: L.total(), agentUsd: L.agentTotal(), seconds: stepTimes(out),
  cuts: ac.cuts, checks: Object.fromEntries(Object.entries(ac.checks).map(([k, v]) => [k, v.length])),
  vision: audit ? { linesShown: audit.lines.length - auditBad.length, lines: audit.lines.length, missingByLine: auditBad, cutProblems: audit.cuts.filter((c) => c.missing.length || c.problem) } : null,
};
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 1));
say(`DONE: ${fin.final}; total $${L.total()}`);
