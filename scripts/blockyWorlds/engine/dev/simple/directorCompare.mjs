// The WORD DIRECTOR vs the PLANNER on one script (owner 2026-11-10, step 5d). Free by default: the planner's plan, the
// word director's answer from the fake (or a recorded fixture: --fixture <answer.json>), both through the four
// pre-render checks + the pace numbers, and the paid call's cost ESTIMATE. The paid call needs --paid --yes (the owner's
// OK first); it records its answer to <out>/answer.json so every later comparison replays it for free.
//   node dev/simple/directorCompare.mjs --script <file> [--pick n] --out <dir> [--fixture answer.json] [--paid --yes]
import fs from "node:fs";
import path from "node:path";
import { checkTimeline, checkVisuals, checkSubjects, checkProduction } from "../../plan.mjs";
import { paceReport } from "../../lib/wordTiming.js";
import { estimateWordDirector, validateWordDirection, applyWordDirection, fakeWordDirector, fixtureWordDirector, anthropicWordDirector } from "../../lib/wordDirector.js";
import { planScript, loadScript } from "./planScript.mjs";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const counts = (tl, script) => ({ timeline: checkTimeline(tl).length, visuals: checkVisuals(tl, script).length, subjects: checkSubjects(tl).length, production: checkProduction(tl).length });

export async function compare({ script, idea, fixture = null, provider = null }) {
  const { tl } = await planScript({ script, idea });
  const est = estimateWordDirector({ tl });
  let raw, source;
  if (provider) { const r = await provider.direct({ tl }); raw = r.data; source = { kind: "paid", costUsd: r.costUsd, model: r.model, ms: r.ms }; }
  else if (fixture) { raw = fixtureWordDirector(fixture); source = { kind: "fixture" }; }
  else { raw = fakeWordDirector(tl); source = { kind: "fake (free stand-in, not the model)" }; }
  const v = validateWordDirection(raw, { tl });
  const wd = applyWordDirection(tl, v);
  if (source.kind.startsWith("fake")) wd.direction.wordDirector.fake = true;
  return { planner: { tl, checks: counts(tl, script), pace: paceReport(tl) }, director: { tl: wd, raw, checks: counts(wd, script), pace: paceReport(wd), problems: v.problems.slice(0, 40), source }, estimate: est };
}

if (process.argv[1] && /directorCompare\.mjs$/.test(process.argv[1])) {
  const file = arg("script"), out = arg("out");
  if (!file || !out) { console.error("usage: node dev/simple/directorCompare.mjs --script <file> [--pick n] --out <dir> [--fixture f] [--paid --yes]"); process.exit(2); }
  const { script, idea } = loadScript(file, arg("pick"));
  let provider = null;
  if (argv.includes("--paid")) {
    if (!argv.includes("--yes")) { console.log("--paid needs --yes (and the owner's OK): nothing sent"); process.exit(0); }
    const { envKey } = await import("../../voice/eleven.mjs");
    provider = anthropicWordDirector({ apiKey: envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY") });
  }
  const r = await compare({ script, idea, fixture: arg("fixture") ? JSON.parse(fs.readFileSync(arg("fixture"), "utf8")) : null, provider });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "planner.json"), JSON.stringify(r.planner.tl));
  fs.writeFileSync(path.join(out, "director.json"), JSON.stringify(r.director.tl));
  fs.writeFileSync(path.join(out, "answer.json"), JSON.stringify(r.director.raw, null, 1));
  const summary = { script: script.title, estimate: r.estimate, planner: { checks: r.planner.checks, pace: r.planner.pace }, director: { source: r.director.source, checks: r.director.checks, pace: r.director.pace, problems: r.director.problems } };
  fs.writeFileSync(path.join(out, "compare.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}
