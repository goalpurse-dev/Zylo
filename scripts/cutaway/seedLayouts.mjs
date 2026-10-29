// Cutaway Explainer: put the saved layouts (scripts/cutaway/proto3d/m2/layouts/<key>.template.json) into
// public.cutaway_layouts. Premade topics at launch = only the layouts the owner approved: --approve lists those keys;
// every other key goes in unapproved (the owner can approve it later with the button on a finished video).
// A dry run unless --apply. An already approved row is never changed back.
//   node scripts/cutaway/seedLayouts.mjs landfill french_drain car_wash --approve landfill,french_drain,car_wash [--apply]
// Reads SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY from the main folder's .env.local (never printed).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { premadeByKey } from "../../supabase/functions/_shared/cutaway/topics.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LAYOUTS = path.join(here, "proto3d", "m2", "layouts");
const argv = process.argv.slice(2), apply = argv.includes("--apply");
const approveAt = argv.indexOf("--approve"), approve = new Set(approveAt >= 0 ? argv[approveAt + 1].split(",").filter(Boolean) : []);
const keys = argv.filter((a, i) => !a.startsWith("--") && i !== approveAt + 1);
if (!keys.length) throw new Error("name the layouts: node scripts/cutaway/seedLayouts.mjs landfill french_drain ...");
for (const k of approve) if (!keys.includes(k)) throw new Error(`--approve ${k}: not in the list`);

const rows = keys.map((key) => {
  const file = path.join(LAYOUTS, `${key}.template.json`);
  if (!fs.existsSync(file)) throw new Error(`no saved layout ${file}`);
  const t = JSON.parse(fs.readFileSync(file, "utf8")), p = premadeByKey(key);
  if (!p) throw new Error(`${key} is not a premade topic (topics.js PREMADE)`);
  const { approved: _a, savedFrom, savedAt, facts = [], ...layout } = t;
  return { key, topic: p.topic, layout: { ...layout, key }, script: { facts, savedFrom: savedFrom ?? null, savedAt: savedAt ?? null }, approved: approve.has(key) };
});
for (const r of rows) console.log(`${r.key.padEnd(16)} ${r.layout.parts.length} parts  ${r.approved ? "APPROVED (premade)" : "not approved"}`);
if (!apply) { console.log("dry run: add --apply to write"); process.exit(0); }

const env = Object.fromEntries(fs.readFileSync(process.env.ZYLO_ENV ?? "C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are needed in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });
const now = new Date().toISOString();
for (const r of rows) {
  const { data: cur, error: e1 } = await db.from("cutaway_layouts").select("approved").eq("key", r.key).maybeSingle();
  if (e1) throw new Error(`${r.key}: ${e1.message}`);
  if (cur?.approved && !r.approved) { console.log(`${r.key}: already approved, left as it is`); continue; }
  const row = { ...r, updated_at: now, retired_at: null, ...(r.approved ? { approved_at: now } : {}) };
  const { error } = await db.from("cutaway_layouts").upsert(row);
  if (error) throw new Error(`${r.key}: ${error.message}`);
  console.log(`${r.key}: written`);
}
