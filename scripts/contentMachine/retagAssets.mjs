// Looks at the ACTIVE assets again with the fast model (owner-ordered, 2026-10-18: tag frames with burned-in
// subtitles, so the writer never gets one cut off mid-sentence). Queues tag_assets jobs with retag: true; the
// worker runs them through the Budget Guard (lane "assets"), about $0.0002 per image. UI screens are skipped
// (they have no subtitles; the crops are described by importUiCrops.mjs).
//   node scripts/contentMachine/retagAssets.mjs [--env <.env.local>] [--list]
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(ROOT, "package.json"));
const arg = (name, def = null) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; };
require("dotenv").config({ path: arg("--env", path.join(ROOT, ".env.local")), quiet: true });
const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed."); process.exit(2); }
const db = require("@supabase/supabase-js").createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.from("cm_assets").select("id").eq("status", "active").neq("kind", "ui").is("subtitles", null).limit(1000);
if (error) throw new Error(error.message);
const ids = data.map((r) => r.id);
if (process.argv.includes("--list")) console.log(`${ids.length} active assets would be looked at again`);
else {
  const jobs = [];
  for (let i = 0; i < ids.length; i += 8) jobs.push({ stage: "tag_assets", payload: { ids: ids.slice(i, i + 8), live: true, retag: true }, max_attempts: 2 });
  if (jobs.length) { const { error: e } = await db.from("cm_jobs").insert(jobs); if (e) throw new Error(`queue: ${e.message}`); }
  console.log(`queued ${jobs.length} re-tag jobs for ${ids.length} assets (the worker picks them up within a minute)`);
}
// On Windows, exiting while a connection closes crashes Node: leave a moment.
await new Promise((r) => setTimeout(r, 300));
