// SHOT PROMPTS for a storyboard timeline (lib/shotPrompts.js): capped calls write the shots as image + video prompt
// pairs, then the FREE checks (verbs, rule, state chain, HOW) and a readable HTML page.
//   node dev/simple/shotPrompts.mjs --tl <storyboard timeline.json> --out <dir> [--board kidNeverBlinks] [--cap 0.25]
//        [--model claude-sonnet-5-5 | claude-haiku-5-5] [--parts 4] [--ids 2,5,20-51] [--merge <prompts.json>] [--name prompts] [--yes]
//   --recheck: no call, the checks + page from <dir>/<name>.json
import fs from "node:fs";
import path from "node:path";
import { promptRequest, writePrompts, checkPrompts, promptsHtml, PROMPT_MODEL, MODEL_PRICE } from "../../lib/shotPrompts.js";

const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = arg("out"); fs.mkdirSync(out, { recursive: true });
const name = arg("name", "prompts"), model = arg("model", PROMPT_MODEL), parts = Number(arg("parts", 2)), cap = Number(arg("cap", 0.15));
const tl = JSON.parse(fs.readFileSync(arg("tl"), "utf8"));
const board = Object.values(await import(`../../lib/storyboards/${arg("board", "kidNeverBlinks")}.js`))[0];
const ids = arg("ids") ? arg("ids").split(",").flatMap((r) => { const [a, b] = r.split("-").map(Number); return b == null ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i); }) : null;
const { system, user } = promptRequest(tl, board);
const estIn = Math.ceil((system.length + user.length) / 2.0), P = MODEL_PRICE[model];
console.log(`request: ~${estIn} input tokens (${model}); ${ids ? ids.length : tl.shots.length} shots in ${parts} parts; cap $${cap}`);
let prompts, cost = 0;
const file = path.join(out, `${name}.json`);
if (argv.includes("--recheck")) { const j = JSON.parse(fs.readFileSync(file, "utf8")); prompts = j.prompts; cost = j.costUsd; }
else {
  if (!argv.includes("--yes")) { console.log(`worst case input $${((estIn * P.write + (parts - 1) * estIn * P.read) / 1e6).toFixed(4)}; dry run: nothing sent (add --yes)`); process.exit(0); }
  const { envKey } = await import("../../voice/eleven.mjs");
  const r = await writePrompts({ apiKey: envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY"), tl, board, capUsd: cap, parts, ids, model, perShot: Number(arg("per-shot", 0)), note: arg("note", ""), log: (m) => console.log(m) });
  fs.appendFileSync(path.join(out, "spend.jsonl"), JSON.stringify({ at: new Date().toISOString(), label: `Blocky Worlds #2 shot prompts ${name} (${model}, stop ${r.stop.join(",")})`, usage: r.usage, costUsd: r.costUsd }) + "\n");
  fs.writeFileSync(path.join(out, `${name}.raw.txt`), r.raw ?? "");
  console.log(`calls: $${r.costUsd}; ${r.data.length} shots written`);
  const base = arg("merge") ? JSON.parse(fs.readFileSync(arg("merge"), "utf8")).prompts.filter((p) => !(r.data ?? []).some((q) => q.id === p.id) && p.id < tl.shots.length) : [];
  prompts = [...base, ...r.data].sort((a, b) => a.id - b.id); cost = r.costUsd;
  fs.writeFileSync(file, JSON.stringify({ model, costUsd: cost, usage: r.usage, written: r.data.map((p) => p.id), prompts }, null, 1));
}
const checks = checkPrompts(prompts, tl, board);
fs.writeFileSync(path.join(out, `${name}.checks.json`), JSON.stringify(checks, null, 1));
fs.writeFileSync(path.join(out, `${name}.html`), promptsHtml({ tl, prompts, checks, cost, model }));
console.log(`checks: ${Object.entries(checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
for (const [k, v] of Object.entries(checks)) for (const m of v.slice(0, 8)) console.log(`  ${k}: ${m}`);
