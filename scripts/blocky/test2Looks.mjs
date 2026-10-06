// Blocky Stories tests 2 and 3: the look.
//   Test 2 (done, 2026-10-06): 6 avatar references on Nano Banana 2 Lite, with the
//     first wording ("blocky toy avatar"; half "Roblox-style", half "blocky toy
//     figure"). Their exact prompts are in results.json; they are never sent again.
//   Test 3 (done): one location plate + 4 scene pictures through the real builder.
//   Re-test (retest): Vex and Pixi again on Lite with the corrected wording
//     ("blocky game avatar" + the body-construction text):
//       A = text fix only            B = text fix + the Lite Noob as a body template
//     One of the four leaves the minifigure parts out of the leave-out list, to
//     see whether naming them primes them.
//   Pro (pro): Noob, Vex and Lux on Nano Banana Pro with the prompt the re-test
//     picked (roster.mjs#REF_DEFAULTS).
// Nobody is charged credits (test pictures on blocky-worker). ONE attempt per item: an
// item already in results.json is never sent again.
//   node scripts/blocky/test2Looks.mjs                               prints the plan, sends nothing
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/test2Looks.mjs retest     4 pictures on Lite (about $0.14)
//   BLOCKY_ALLOW_PAID=1 node scripts/blocky/test2Looks.mjs pro        3 pictures on Pro (about $0.44)
import fs from "fs";
import path from "path";
import { openBlockyBudget, paidCallsAllowed } from "./paidGuard.mjs";
import { ROOT, rawTest, writeJson } from "./lib.mjs";
import { ROSTER, REF_DEFAULTS, avatarPrompt } from "./roster.mjs";

const OUT = "data/blocky-tests/test2";
const RESULTS = path.join(ROOT, OUT, "results.json");
const LITE = { key: "lite", label: "Nano Banana 2 Lite", model: "google:nano-banana@2-lite", expectUsd: 0.04 };
const PRO = { key: "pro", label: "Nano Banana Pro", model: "google:4@2", expectUsd: 0.15 };
const byId = (id) => ROSTER.find((a) => a.id === id);
const out = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : { items: {}, notes: [] };
/** The body template (decision 20): the Lite Noob from test 2, the one reference whose arms were right. */
const TEMPLATE_URL = out.items["noob-roblox-lite"]?.url;

const RETEST = [
  { key: "retest-vex-A", id: "vex", variant: "A: text fix only", template: false, minifigure: true },
  { key: "retest-pixi-A", id: "pixi", variant: "A: text fix only, minifigure parts NOT named in the leave-out list", template: false, minifigure: false },
  { key: "retest-vex-B", id: "vex", variant: "B: text fix + Noob body template", template: true, minifigure: true },
  { key: "retest-pixi-B", id: "pixi", variant: "B: text fix + Noob body template", template: true, minifigure: true },
].map((x) => ({ ...x, engine: LITE }));

// The prompt the re-test picked, on both models. Vex on Lite with it is the re-test picture named in LITE_TWIN.
const WIN = REF_DEFAULTS;
const winKey = `${WIN.template ? "B" : "A"}${WIN.minifigure ? "" : "-plain"}`;
// Vex on Lite with the very same prompt is the re-test picture retest-vex-A.
const PRO_RUN = ["noob", "vex", "lux"].map((id) => ({ key: `pro-${id}`, id, engine: PRO, variant: `the picked prompt (${winKey})`, ...WIN }));

const [mode] = process.argv.slice(2);
const plan = { retest: RETEST, pro: PRO_RUN }[mode];
if (!paidCallsAllowed() || !plan) {
  for (const x of [...RETEST, ...PRO_RUN]) console.log(`${x.key.padEnd(16)} ${x.engine.label.padEnd(20)} ${x.variant}  (${avatarPrompt(byId(x.id), x).length} chars${x.template ? ", + 1 reference picture" : ""})`);
  console.log(`\nExample (retest-pixi-B):\n${avatarPrompt(byId("pixi"), { template: true, minifigure: true })}`);
  console.log('\nNothing was sent. Run with BLOCKY_ALLOW_PAID=1 and "retest" or "pro".');
  process.exit(0);
}
if (plan.some((x) => x.template) && !TEMPLATE_URL) throw new Error("the body template (noob-roblox-lite from test 2) is missing");

const budget = openBlockyBudget("looks");
const save = () => writeJson(`${OUT}/results.json`, out);
const log = (m) => { console.log(m); out.notes.push(m); };

for (const x of plan) {
  if (out.items[x.key]) continue;   // one attempt per item
  const prompt = avatarPrompt(byId(x.id), x);
  budget.reserve(x.engine.expectUsd, x.key);
  const row = (out.items[x.key] = { key: x.key, kind: "avatar", id: x.id, variant: x.variant, template: x.template, minifigure: x.minifigure, model: x.engine.model, engine: x.engine.key, prompt, references: x.template ? 1 : 0, state: "sent", at: new Date().toISOString() });
  save();
  const task = { taskType: "imageInference", model: x.engine.model, positivePrompt: prompt, width: 768, height: 1376, numberResults: 1, outputType: "URL", outputFormat: "JPG", outputQuality: 95, ...(x.template ? { inputs: { referenceImages: [TEMPLATE_URL] } } : {}) };
  // A test picture on blocky-worker: no user charge, logged with its real cost.
  const r = await rawTest(task, `blocky-looks-${x.key}`);
  if (r.state === "refused") {
    // The worker refused before anything was sent: not an attempt.
    delete out.items[x.key];
    budget.record(0, `${x.key}: ${r.error}`, x.engine.expectUsd);
    save();
    log(`${x.key}: nothing sent ($0): ${r.error}`);
    continue;
  }
  if (r.state !== "success") Object.assign(row, { state: "failed", error: String(r.error).slice(0, 400), cost: r.cost });
  else {
    Object.assign(row, { state: "success", url: r.url, cost: r.cost, seconds: r.seconds, file: `${x.key}.jpg` });
    fs.writeFileSync(path.join(ROOT, OUT, row.file), Buffer.from(await (await fetch(r.url)).arrayBuffer()));
  }
  budget.record(row.cost, `looks ${x.key}${row.state === "failed" ? " (failed)" : ""}`, x.engine.expectUsd);
  save();
  log(`${x.key}: ${row.state} $${row.cost.toFixed(4)}${row.error ? ` · ${row.error}` : ""}`);
}
console.log(budget.summary());
