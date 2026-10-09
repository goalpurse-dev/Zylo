// Is AI Fruit Story quiet right now? Read-only. Counts Fruit jobs that are waiting or being
// made (pictures and clips) and final videos being built. Run before deploying Fruit's
// functions: a deploy is made only when this prints QUIET (exit code 0).
//   node scripts/blocky/fruitInFlight.mjs
import { admin } from "./lib.mjs";

const db = admin();
const count = async (table, column, values) => {
  const { count: n, error } = await db.from(table).select("id", { count: "exact", head: true }).in(column, values);
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
};
const jobs = await count("fruit_jobs", "status", ["queued", "submitting", "submitted", "provider_done"]);
const finals = await count("fruit_stories", "final_status", ["building"]);
console.log(`${new Date().toISOString()}  Fruit jobs waiting or being made: ${jobs}; final videos being built: ${finals}`);
console.log(jobs + finals === 0 ? "QUIET" : "BUSY");
process.exit(jobs + finals === 0 ? 0 : 1);
