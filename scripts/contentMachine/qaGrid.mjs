// The vision QA check on a rendered format × style grid (renderSamples.mjs with ZONES=0, so the check sees
// the slides as posted). Uploads the PNGs to the PRIVATE bucket under qa/<label>/, queues one qa_check job per
// format × style (the worker runs them through the Budget Guard, lane "qa", CM_MODEL_FAST: about $0.0015
// per slideshow), waits for the findings and writes <gridDir>/qa.json. Paid: run only when the owner asks.
//   node scripts/contentMachine/qaGrid.mjs <gridDir> <label> [--env <.env.local>]
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(ROOT, "package.json"));
const arg = (name, def = null) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; };
const [gridDir, label] = process.argv.slice(2);
if (!gridDir || !/^[a-z0-9-]+$/.test(label ?? "")) { console.error("usage: qaGrid.mjs <gridDir> <label a-z0-9-> [--env <.env.local>]"); process.exit(2); }
require("dotenv").config({ path: arg("--env", path.join(ROOT, ".env.local")), quiet: true });
const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed."); process.exit(2); }
const db = require("@supabase/supabase-js").createClient(url, key, { auth: { persistSession: false } });
const bucket = db.storage.from("content-machine");

const combos = [];
for (const format of readdirSync(gridDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  for (const style of readdirSync(path.join(gridDir, format), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const dir = path.join(gridDir, format, style);
    const pngs = readdirSync(dir).filter((f) => /^slide-\d+\.png$/.test(f)).sort();
    if (pngs.length) combos.push({ format, style, dir, pngs });
  }
}
const jobs = [];
for (const c of combos) {
  const paths = [];
  for (const f of c.pngs) {
    const p = `qa/${label}/${c.format}/${c.style}/${f}`;
    const { error } = await bucket.upload(p, readFileSync(path.join(c.dir, f)), { contentType: "image/png", upsert: true });
    if (error) throw new Error(`upload ${p}: ${error.message}`);
    paths.push(p);
  }
  c.out = `qa/${label}/${c.format}/${c.style}.json`;
  jobs.push({ stage: "qa_check", max_attempts: 2, payload: { paths: paths.slice(0, 12), out: c.out, live: true, pictures: paths.map(() => "a generated picture or a real Zyvo output") } });
}
const { error } = await db.from("cm_jobs").insert(jobs);
if (error) throw new Error(`queue: ${error.message}`);
console.log(`uploaded ${combos.reduce((a, c) => a + c.pngs.length, 0)} slides, queued ${jobs.length} checks`);

const results = {};
const t0 = Date.now();
while (Object.keys(results).length < combos.length && Date.now() - t0 < 25 * 60_000) {
  await new Promise((r) => setTimeout(r, 30_000));
  for (const c of combos) {
    const k = `${c.format} × ${c.style}`;
    if (results[k]) continue;
    const { data } = await bucket.download(c.out);
    if (data) results[k] = JSON.parse(await data.text());
  }
  console.log(`${Math.round((Date.now() - t0) / 1000)}s: ${Object.keys(results).length}/${combos.length}`);
}
const flagged = Object.fromEntries(Object.entries(results).filter(([, r]) => r.findings && Object.keys(r.findings).length).map(([k, r]) => [k, r.findings]));
const cost = Object.values(results).reduce((a, r) => a + (r.costUsd ?? 0), 0);
writeFileSync(path.join(gridDir, "qa.json"), JSON.stringify({ label, checked: Object.keys(results).length, of: combos.length, costUsd: cost, flagged }, null, 2));
console.log(`checked ${Object.keys(results).length}/${combos.length}, flagged ${Object.keys(flagged).length}, cost $${cost.toFixed(4)}`);
if (existsSync(path.join(gridDir, "qa.json"))) console.log(`wrote ${path.join(gridDir, "qa.json")}`);
