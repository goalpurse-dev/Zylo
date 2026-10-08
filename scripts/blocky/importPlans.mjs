// Checks a file of hand-written story plans (the format is at the top of
// supabase/functions/_shared/blocky/vettedPlans.js) and, with --write, saves the
// good ones as vetted plans for the idea feature. Free: no model is called.
//   node scripts/blocky/importPlans.mjs my-plans.txt            check only: says which line of which plan to fix
//   node scripts/blocky/importPlans.mjs my-plans.txt --write    also saves the plans that passed
// Saving a plan with the same title again updates it. A plan with a problem is never saved.
// --write needs the table blocky_plans (supabase/pending/20261027100000_blocky_story_options.sql, on the owner's go).
import fs from "fs";
import { readPlanFile } from "../../supabase/functions/_shared/blocky/vettedPlans.js";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) { console.error("usage: node scripts/blocky/importPlans.mjs <file> [--write]"); process.exit(2); }
const { plans, report } = readPlanFile(fs.readFileSync(file, "utf8"));
for (const r of report) {
  console.log(`${r.ok ? "OK  " : "FIX "} line ${r.line}: ${r.title}`);
  for (const p of r.problems) console.log(`       - ${p}`);
}
console.log(`\n${plans.length} of ${report.length} plans can be used.`);
if (!process.argv.includes("--write")) process.exit(plans.length === report.length ? 0 : 1);

const { admin } = await import("./lib.mjs");
const db = admin();
const rows = plans.map((p) => ({ slug: p.slug, title: p.title, hook: p.hook, story_type: p.type, plan: p, active: true }));
const { data, error } = await db.from("blocky_plans").upsert(rows, { onConflict: "slug" }).select("slug");
if (error) { console.error(`Not saved: ${error.message}${/blocky_plans/.test(error.message) ? " (the table is not there yet: its SQL waits in supabase/pending/)" : ""}`); process.exit(1); }
console.log(`Saved ${data.length} vetted plans.`);
