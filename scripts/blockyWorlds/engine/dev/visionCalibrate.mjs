// Blocky Worlds shot review: how well does the AI judge agree with a human review? Compares the judge's per-line
// verdicts on a folder of caption-free stills (lib/vision/stills.mjs) with a human review.json (dev/reviewPage.mjs).
// FREE by default (the mock judge; prints the request sizes and what the paid run would cost). A paid run needs
// --paid AND --yes AND an ANTHROPIC_KEY, and stops before any call whose worst case would pass --max-usd.
//   node dev/visionCalibrate.mjs --tl <timeline.json> --stills <dir from lib/vision/stills.mjs> --human <review.json>
//        [--premise "..."] [--paid --yes --model haiku|sonnet --max-usd 0.05] [--out file.json]
import fs from "node:fs";
import path from "node:path";
import { lineRequirements, stillPicks } from "../lib/vision/requirements.js";
import { batchesOf, anthropicJudge, worstCaseUsd, inputTokens, maxTokensFor, REVIEW_MODELS } from "../lib/vision/judge.js";
import { mockJudge } from "../lib/vision/mock.js";
import { PRICE } from "../lib/builder/design.js";

const args = process.argv.slice(2), opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; }, flag = (k) => args.includes(k);
const tl = JSON.parse(fs.readFileSync(opt("--tl"), "utf8"));
const human = JSON.parse(fs.readFileSync(opt("--human"), "utf8"));
const dir = path.resolve(opt("--stills"));
const premise = opt("--premise", human.premise ?? null);
const model = opt("--model", "haiku") === "sonnet" ? REVIEW_MODELS.strict : REVIEW_MODELS.default;
const maxUsd = Number(opt("--max-usd", 0.05));

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg"));
const fileOf = (key) => files.find((f) => f.endsWith(`-${key}.jpg`));
const reqs = lineRequirements(tl, { premise });
const picks = stillPicks(tl);
const items = reqs.map((r) => ({ ...r, castIds: Object.keys(tl.cast ?? {}), plan: r.shots.map((i) => tl.shots[i]),
  stills: picks.filter((p) => p.line === r.line && fileOf(p.key)).map((p) => ({ key: p.key, shot: p.shot, jpeg: fs.readFileSync(path.join(dir, fileOf(p.key))), w: 432, h: 768 })) })).filter((it) => it.stills.length);
const batches = batchesOf(items, { size: 8, maxImages: 14 });
const inTok = batches.reduce((n, b) => n + inputTokens(b, { premise }), 0), outCap = batches.reduce((n, b) => n + maxTokensFor(b), 0);
const worst = batches.reduce((n, b) => n + worstCaseUsd(model, b, { premise }), 0);
const p = PRICE[model];
console.log(`${items.length} lines, ${items.reduce((n, it) => n + it.stills.length, 0)} stills, ${batches.length} requests; ~${inTok} input tokens; ${model}: typical ~$${((inTok * p.input + batches.length * 1500 * p.output) / 1e6).toFixed(4)}, worst $${worst.toFixed(4)} (output cap ${outCap})`);

let judge = mockJudge();
if (flag("--paid")) {
  if (!flag("--yes")) { console.log("a paid run needs --yes too (and the owner's go): nothing was sent"); process.exit(0); }
  if (!process.env.ANTHROPIC_KEY) { console.log("no ANTHROPIC_KEY: nothing was sent"); process.exit(1); }
  if (worst > maxUsd) { console.log(`worst case $${worst.toFixed(4)} > --max-usd ${maxUsd}: nothing was sent`); process.exit(1); }
  judge = anthropicJudge({ apiKey: process.env.ANTHROPIC_KEY, model, premise });
}
const T0 = Date.now();
let cost = 0;
const verdicts = (await Promise.all(batches.map(async (b) => { const r = await judge.judge(b); cost += r.costUsd ?? 0; return r.lines; }))).flat();
const H = new Map((human.lines ?? []).map((l) => [l.line, l]));
const pairs = verdicts.map((v) => ({ line: v.line, ai: v.verdict, human: H.get(v.line)?.verdict ?? null, aiTypes: v.types, humanTypes: H.get(v.line)?.types ?? [], shows: v.shows })).filter((x) => x.human && x.human !== "unjudged");
const exact = pairs.filter((x) => x.ai === x.human).length;
const binary = pairs.filter((x) => (x.ai === "match") === (x.human === "match")).length;
const caughtMisses = pairs.filter((x) => x.human !== "match" && x.ai !== "match").length, humanMisses = pairs.filter((x) => x.human !== "match").length;
const falseAlarms = pairs.filter((x) => x.human === "match" && x.ai !== "match").length;
const conf = {}; for (const x of pairs) conf[`${x.human}->${x.ai}`] = (conf[`${x.human}->${x.ai}`] ?? 0) + 1;
console.log(`${judge.name} (${judge.model}): ${((Date.now() - T0) / 1000).toFixed(1)} s, $${cost.toFixed(4)}`);
console.log(`agreement: exact ${exact}/${pairs.length}; match-or-not ${binary}/${pairs.length}; caught ${caughtMisses}/${humanMisses} of the human's partial+miss; false alarms ${falseAlarms}`);
console.log(`human -> ai: ${JSON.stringify(conf)}`);
if (opt("--out")) fs.writeFileSync(opt("--out"), JSON.stringify({ model: judge.model, costUsd: cost, pairs, verdicts }, null, 1));
