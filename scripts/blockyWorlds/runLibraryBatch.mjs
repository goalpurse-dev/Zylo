// Blocky Worlds: run an idea-library batch from this laptop (the same job code as the blocky-worlds-library endpoint,
// so no function deploy is needed). It writes into the production tables with the service-role key from .env.local.
//
//   node scripts/blockyWorlds/runLibraryBatch.mjs --target 200 --max-usd 6 --env-file .env.local      (real: paid)
//   node scripts/blockyWorlds/runLibraryBatch.mjs --target 12 --mock --memory                          (free, no database)
//   node scripts/blockyWorlds/runLibraryBatch.mjs --report <batchId> --env-file .env.local             (the report only)
//
// The money cap: before every call the job adds that call's worst case and stops if it could pass --max-usd
// (libraryJob.js). A real run refuses to start without --max-usd. Ctrl+C stops it; the batch can be resumed with
// --resume <batchId>.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { JUDGE_WORST_USD, memoryStore, supabaseStore, tick, WRITE_WORST_USD } from "../../supabase/functions/_shared/blockyWorlds/libraryJob.js";

const args = process.argv.slice(2);
const opt = (name, fallback = null) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const has = (name) => args.includes(`--${name}`);
const mock = has("mock"), memory = has("memory");
const provider = mock ? "mock" : "anthropic";
const target = Math.max(1, Math.floor(Number(opt("target", 200))));
const maxUsd = mock ? Infinity : Number(opt("max-usd"));

function env(file) {
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
}
const E = memory ? {} : env(opt("env-file", ".env.local"));
const admin = memory ? null : createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function report(batchId) {
  const { data: b } = await admin.from("blocky_worlds_idea_batches").select("*").eq("id", batchId).single();
  const { data: costs } = await admin.from("blocky_worlds_ai_calls").select("usd").eq("purpose", "library").gte("created_at", b.created_at);
  const { data: top } = await admin.from("blocky_worlds_library").select("score, idea, formula, twist, mood").eq("batch_id", batchId).eq("status", "live").order("score", { ascending: false }).limit(10);
  const { count: live } = await admin.from("blocky_worlds_library").select("id", { count: "exact", head: true }).eq("status", "live");
  console.log(`\nBATCH ${b.id}: ${b.status}`);
  console.log(`accepted ${b.accepted} (target ${b.requested}), rejected ${b.rejected}, duplicates ${b.duplicates}, dropped by checks ${b.dropped}, written ${b.generated}`);
  console.log(`cost: batch $${Number(b.cost_usd).toFixed(4)}; cost log since start $${(costs ?? []).reduce((a, c) => a + Number(c.usd), 0).toFixed(4)}; live ideas in the library now: ${live}`);
  console.log("\nTOP 10 BY JUDGE SCORE");
  for (const [i, r] of (top ?? []).entries()) {
    const c = r.idea;
    console.log(`\n${i + 1}. [${r.score}] ${c.title}  (${r.formula}/${r.twist}/${r.mood}, ${c.setting})\n   ${c.opener}\n   price: ${c.price}\n   examples: ${c.examples.join(" | ")}\n   narrator: ${c.narrator} | prop: ${c.prop}\n   twist: ${c.twist}\n   closer: ${c.closer}`);
  }
}

if (opt("report")) { await report(opt("report")); process.exit(0); }
if (!mock && !(maxUsd > 0)) { console.error("A real batch needs --max-usd (the most it may spend)."); process.exit(1); }
if (!mock && !E.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is missing from the env file."); process.exit(1); }

let store, batch;
if (memory) {
  store = memoryStore();
  batch = { id: "local", requested: target, status: "running", accepted: 0 };
} else {
  const probe = await admin.from("blocky_worlds_library").select("id", { head: true, count: "exact" });
  if (probe.error) { console.error(`The library tables aren't there yet (apply the two migrations first): ${probe.error.message}`); process.exit(1); }
  store = supabaseStore(admin, provider);
  if (opt("resume")) batch = (await admin.from("blocky_worlds_idea_batches").select("*").eq("id", opt("resume")).single()).data;
  else {
    const { data, error } = await admin.from("blocky_worlds_idea_batches").insert({ provider, requested: target, note: JSON.stringify({ maxUsd, runner: "local" }) }).select("*").single();
    if (error) { console.error(error.message); process.exit(1); }
    batch = data;
  }
}
console.log(`batch ${batch.id}: target ${target} accepted ideas, ${mock ? "MOCK (free)" : `real calls, cap $${maxUsd}`}; worst case per write $${WRITE_WORST_USD}, per judge $${JUDGE_WORST_USD}`);
const t0 = Date.now();
const maxTicks = Math.max(1, Math.floor(Number(opt("ticks", 400))));
for (let n = 1; n <= maxTicks && batch.status === "running"; n++) {
  const r = await tick({ store, batch, provider, apiKey: E.ANTHROPIC_API_KEY ?? "", maxUsd, callsPerTick: 3, seed: (Date.now() % 100000) + n * 977 });
  batch = r.batch;
  for (const line of r.log) console.log(`  ${line}`);
  console.log(`tick ${n}: accepted ${batch.accepted}/${target}, rejected ${batch.rejected}, duplicates ${batch.duplicates}, $${Number(batch.cost_usd).toFixed(4)}, ${Math.round((Date.now() - t0) / 1000)} s`);
}
if (memory) {
  const live = store.rows.filter((r) => r.status === "live").sort((a, b) => b.score - a.score).slice(0, 3);
  console.log(`\nMEMORY RUN: ${batch.status}, accepted ${batch.accepted}; top: ${live.map((r) => `[${r.score}] ${r.idea.title}`).join("; ")}`);
} else await report(batch.id);
