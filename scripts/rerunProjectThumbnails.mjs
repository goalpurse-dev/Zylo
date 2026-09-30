// Re-makes one project's 3 thumbnails as a FREE internal batch (service role:
// no credits charged to the owner). One attempt; waits up to 6 min and prints
// each concept, headline, checks and the real cost from the ledger.
// Paid: ~$0.12–0.19 (concepts + 3 images, a re-render only if a check fails).
//   node --env-file=.env.local scripts/rerunProjectThumbnails.mjs <projectId> <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [PROJECT, OUT] = process.argv.slice(2);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const since = new Date().toISOString();
fs.mkdirSync(OUT, { recursive: true });
// The old batch's stuck tile really failed (its worker was killed): mark it so, so the new
// watchdog doesn't re-draw it and the new batch can start.
const { data: stuck } = await admin.from("long_form_thumbnails").update({ status: "failed", error: "timed out (worker stopped)" })
  .eq("project_id", PROJECT).in("status", ["queued", "rendering"]).select("id, batch, slot");
console.log("marked failed:", JSON.stringify(stuck));
const r = await fetch(`${process.env.SUPABASE_URL}/functions/v1/long-form-thumbnails`, {
  method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ action: "start", projectId: PROJECT, regenerate: true }),
});
const start = await r.json().catch(() => null);
console.log("start:", r.status, JSON.stringify(start)?.slice(0, 400));
if (!r.ok || !start?.ok || start.busy) process.exit(1);
const batch = start.thumbnails[0].batch;
let rows = [];
for (let i = 0; i < 72; i++) {
  await new Promise((res) => setTimeout(res, 5000));
  ({ data: rows } = await admin.from("long_form_thumbnails").select("slot, status, headline, concept, checks, flagged, png_url, full_url, cost_usd, error, credits_charged").eq("project_id", PROJECT).eq("batch", batch).order("slot"));
  if (rows.every((x) => x.status === "ready" || x.status === "failed")) break;
}
const { data: led } = await admin.from("long_form_cost_ledger").select("stage, model, usd, units").eq("project_id", PROJECT).gte("created_at", since);
const usd = (led ?? []).reduce((a, x) => a + Number(x.usd), 0);
for (const x of rows) {
  if (x.png_url) fs.writeFileSync(`${OUT}/thumb-${x.slot}.png`, Buffer.from(await (await fetch(x.png_url)).arrayBuffer()));
  console.log(JSON.stringify({ slot: x.slot, status: x.status, headline: x.headline, archetype: x.concept?.archetype, answersTitle: x.concept?.answersTitle, strangerReads: x.concept?.strangerReads, hook: x.concept?.hookObject, hookHeld: x.concept?.hookHeld, scene: x.concept?.scene, tries: x.checks?.tries, pass: x.checks?.pass, flagged: x.flagged, credits: x.credits_charged, error: x.error }));
}
console.log("ledger since start:", JSON.stringify((led ?? []).map((x) => [x.model, x.units?.purpose, Number(x.usd).toFixed(4)])));
console.log("TOTAL USD", usd.toFixed(4));
