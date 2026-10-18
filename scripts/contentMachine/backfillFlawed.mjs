// Applies the "flawed asset" rule (pipeline.js flawedAssets) to the vision QA findings already stored on past
// slideshows: a real library asset the QA flagged for an artifact is marked flawed and no longer offered. $0.
//   node scripts/contentMachine/backfillFlawed.mjs [--env <.env.local>] [--list]
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { flawedAssets } from "../../supabase/functions/_shared/contentMachine/pipeline.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(ROOT, "package.json"));
const arg = (name, def = null) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; };
require("dotenv").config({ path: arg("--env", path.join(ROOT, ".env.local")), quiet: true });
const db = require("@supabase/supabase-js").createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ideas, error } = await db.from("cm_ideas").select("id,title,compliance,cm_generations(source_assets)").not("compliance->qa", "is", null).limit(500);
if (error) throw new Error(error.message);
const found = new Map();
for (const i of ideas) {
  const heroes = i.cm_generations?.[0]?.source_assets?.heroes ?? {};
  for (const f of flawedAssets(i.compliance?.qa?.findings, heroes)) if (!found.has(f.ref)) found.set(f.ref, { ...f, title: i.title });
}
for (const f of found.values()) console.log(`${f.ref}  "${f.title}"  ${f.reason}`);
if (!process.argv.includes("--list")) {
  let n = 0;
  for (const f of found.values()) {
    const { data, error: e } = await db.from("cm_assets").update({ status: "flawed", flaw_reason: f.reason, updated_at: new Date().toISOString() }).eq("ref", f.ref).eq("status", "active").select("id");
    if (e) throw new Error(e.message);
    n += data.length;
  }
  console.log(`marked ${n} asset(s) flawed`);
}
await new Promise((r) => setTimeout(r, 300));   // on Windows, exiting while a connection closes crashes Node
