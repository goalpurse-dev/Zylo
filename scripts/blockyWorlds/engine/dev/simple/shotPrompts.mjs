// SHOT PROMPTS for a storyboard timeline (lib/shotPrompts.js): one capped Sonnet call writes every shot as an image +
// video prompt pair, then the FREE checks (verbs, rule, state chain) and a readable HTML page.
//   node dev/simple/shotPrompts.mjs --tl <storyboard timeline.json> --board kidNeverBlinks --out <dir> [--cap 0.15] [--yes]
//   node dev/simple/shotPrompts.mjs --tl ... --out <dir> --recheck     (no call: checks + page from <dir>/prompts.json)
import fs from "node:fs";
import path from "node:path";
import { promptRequest, writePrompts, checkPrompts, promptsHtml, PROMPT_MODEL } from "../../lib/shotPrompts.js";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = arg("out"); fs.mkdirSync(out, { recursive: true });
const tl = JSON.parse(fs.readFileSync(arg("tl"), "utf8"));
const board = Object.values(await import(`../../lib/storyboards/${arg("board", "kidNeverBlinks")}.js`))[0];
const cap = Number(arg("cap", 0.15));
const { system, user } = promptRequest(tl, board);
const estIn = Math.ceil((system.length + user.length) / 3.4);
console.log(`request: ~${estIn} input tokens; cap $${cap} -> max ${Math.floor((cap - estIn * 2.5 / 1e6) / 1e-5)} output tokens`);
let prompts, cost = 0;
if (argv.includes("--recheck")) { const j = JSON.parse(fs.readFileSync(path.join(out, "prompts.json"), "utf8")); prompts = j.prompts; cost = j.costUsd; }
else {
  if (!argv.includes("--yes")) { fs.writeFileSync(path.join(out, "request.txt"), `${system}\n\n---\n\n${user}`); console.log("dry run: nothing sent (add --yes)"); process.exit(0); }
  const { envKey } = await import("../../voice/eleven.mjs");
  const r = await writePrompts({ apiKey: envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY"), tl, board, capUsd: cap });
  fs.appendFileSync(path.join(out, "spend.jsonl"), JSON.stringify({ at: new Date().toISOString(), label: `Blocky Worlds #2 shot prompts (${PROMPT_MODEL}, stop ${r.stop})`, usage: r.usage, costUsd: r.costUsd }) + "\n");
  console.log(`call: $${r.costUsd} stop ${r.stop} usage ${JSON.stringify(r.usage)}`);
  if (!r.data) { fs.writeFileSync(path.join(out, "raw.txt"), r.raw ?? ""); console.log("STOP: the reply was not JSON (raw.txt)"); process.exit(1); }
  prompts = r.data; cost = r.costUsd;
  fs.writeFileSync(path.join(out, "prompts.json"), JSON.stringify({ model: PROMPT_MODEL, costUsd: cost, usage: r.usage, prompts }, null, 1));
}
const checks = checkPrompts(prompts, tl, board);
fs.writeFileSync(path.join(out, "checks.json"), JSON.stringify(checks, null, 1));
fs.writeFileSync(path.join(out, "prompts.html"), promptsHtml({ tl, prompts, checks, cost, model: PROMPT_MODEL }));
console.log(`checks: ${Object.entries(checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
for (const [k, v] of Object.entries(checks)) for (const m of v.slice(0, 15)) console.log(`  ${k}: ${m}`);
