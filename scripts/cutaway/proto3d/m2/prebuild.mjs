// M2 cost round: pre-build the premade topics' layouts ahead of time, with their scene plans in one Message Batch
// (half price). 1. each topic's script and fact-check run live (the fact research needs web search); 2. every scene
// plan goes into one batch; its answers are written into each topic's step cache; 3. each topic then runs normally
// (the cached plan, the solver, the voice, the preview check), and a layout that passes is saved as a template,
// NOT approved (the owner approves it before other users get it).
//   node m2/prebuild.mjs --out DIR --proto PROTO --ff FFMPEG --log spend.jsonl fire_hydrant atm septic_tank
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { batchJSON, loadKey } from "./llm.mjs";
import { planTopic } from "./planner.mjs";
import { runTopic, OPENINGS } from "./run.mjs";
import { premadeByKey } from "../../../../supabase/functions/_shared/cutaway/topics.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), arg = (k) => argv[argv.indexOf(`--${k}`) + 1];
const outDir = arg("out"), proto = arg("proto"), ff = arg("ff"), log = arg("log");
const keys = []; for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith("--")) { i++; continue; } keys.push(argv[i]); }
const apiKey = loadKey();
const lastOpening = () => { try { return JSON.parse(fs.readFileSync(OPENINGS, "utf8").trim().split("\n").at(-1)); } catch { return null; } };
const topicOf = (k) => `How ${/^[aeiou]/i.test(premadeByKey(k).topic) ? "an" : "a"} ${premadeByKey(k).topic.toLowerCase().replace(/^atm$/, "ATM")} works`;

// 1. live steps up to the scene plan, whose request is kept for the batch
const pending = [];
for (const k of keys) {
  const out = path.join(outDir, k), cacheDir = path.join(out, "steps"), defer = [];
  try { await planTopic({ apiKey, topic: topicOf(k), lengthSec: 30, log, cacheDir, lastOpening: lastOpening(), defer }); console.log(k, "already planned (cached)"); }
  catch (e) { if (!e.deferred) throw e; pending.push({ k, ...defer[0] }); console.log(k, "scene plan deferred to the batch"); }
}
// 2. one batch for every scene plan
if (pending.length) {
  console.log(`batch: ${pending.length} scene plans`);
  const res = await batchJSON({ apiKey, log, requests: pending.map((p) => ({ customId: p.k, model: p.model, system: p.system, user: p.user, schema: p.schema, effort: p.effort, maxTokens: p.maxTokens, label: p.label })) });
  for (const p of pending) {
    const r = res[p.k];
    if (!r || r.error) { console.log(p.k, "batch failed:", r?.error); continue; }
    fs.mkdirSync(path.dirname(p.file), { recursive: true }); fs.writeFileSync(p.file, JSON.stringify(r, null, 1));
    console.log(p.k, `scene plan $${r.costUsd} (batch)`);
  }
}
// 3. the rest of each topic, live (the scene plan now comes from the cache)
for (const k of keys) {
  const out = path.join(outDir, k);
  const r = await runTopic({ topic: topicOf(k), out, proto, ff, lengthSec: 30, log });
  console.log(k, r.ok ? "passed" : "did not pass", `$${r.totalUsd}`, (r.problems ?? []).join("; "));
  if (!r.ok) continue;
  const L = JSON.parse(fs.readFileSync(path.join(out, "layout.json"), "utf8")), facts = JSON.parse(fs.readFileSync(path.join(out, "script.json"), "utf8")).facts ?? [];
  fs.writeFileSync(path.join(here, "layouts", `${k}.template.json`), JSON.stringify({ ...L, key: k, template: true, approved: false, facts, savedFrom: `prebuild ${path.basename(out)}`, savedAt: new Date().toISOString() }, null, 1));
  console.log(k, "saved as a template (not approved)");
}
