// The SCENE LIST of a script (lib/scenes.js) as plain text: free with --provider mock; the paid director call only with
// --provider sonnet --paid --yes (capped: refused when the worst case is over --max-usd, default $0.10).
//   node dev/simple/scenes.mjs --script <results.json> --pick n --out <dir> [--provider mock|sonnet] [--paid --yes] [--max-usd 0.1]
import fs from "node:fs";
import path from "node:path";
import { validateScenes, mockScenes, anthropicScenes, estimateScenes, formatScenes } from "../../lib/scenes.js";
import { loadScript } from "./planScript.mjs";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = arg("out"); fs.mkdirSync(out, { recursive: true });
const { script, idea } = loadScript(arg("script"), arg("pick"));
// the cast and places the planner's world bible uses (a stored timeline when given, else the bible defaults)
let cast = ["me"], places = ["main_street", "home", "school", "woods"];
if (arg("timeline")) { const tl = JSON.parse(fs.readFileSync(arg("timeline"), "utf8")); cast = Object.keys(tl.world?.cast ?? tl.cast ?? {}).filter((c) => !/^town\d|^extra/.test(c)); places = [...new Set((tl.world?.spots ?? []).map((s) => s.id))]; }
const premise = idea?.premise ?? idea?.topic ?? "";
const provider = arg("provider", "mock");
let raw, cost = 0, source = "mock (free rule-based)";
if (provider === "sonnet") {
  const est = estimateScenes({ script, cast, places, premise });
  const cap = Number(arg("max-usd", 0.1));
  console.log(`estimate: typical $${est.usd}, worst $${est.worstUsd} (cap $${cap})`);
  if (est.worstUsd > cap) { console.log("STOP: the worst case is over the cap"); process.exit(1); }
  if (!(argv.includes("--paid") && argv.includes("--yes"))) { console.log("dry run: no call (add --paid --yes)"); process.exit(0); }
  const { envKey } = await import("../../voice/eleven.mjs");
  const r = await anthropicScenes({ apiKey: envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY") }).direct({ script, cast, places, premise });
  raw = r.data; cost = r.costUsd; source = `${r.model} ($${r.costUsd}, ${Math.round(r.ms / 1000)} s)`;
  fs.writeFileSync(path.join(out, "scenes-answer.json"), JSON.stringify(raw, null, 1));
} else if (provider === "fixture") { raw = JSON.parse(fs.readFileSync(arg("fixture"), "utf8")); source = "recorded answer (free)"; }
else raw = mockScenes({ script, cast, places });
const v = validateScenes(raw, { lines: script.lines, cast, places });
const text = `SCENE LIST: "${script.title}" (${script.lines.length} lines, ${v.scenes.length} scenes; ${source})\n\n${formatScenes(v.scenes, script)}${v.problems.length ? `\n\nREPAIRED (${v.problems.length}): ${v.problems.slice(0, 20).join(" | ")}` : ""}\n`;
fs.writeFileSync(path.join(out, "scenes.txt"), text);
fs.writeFileSync(path.join(out, "scenes.json"), JSON.stringify({ scenes: v.scenes, problems: v.problems, costUsd: cost, source }, null, 1));
console.log(text.slice(0, 200000));
