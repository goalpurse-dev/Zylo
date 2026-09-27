import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
  })
);
const admin = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// The reconciliation world from the prior incident — this is where the
// operations officer / maintenance technician / other new character sheets
// were actually generated.
const WORLD_ID = "d64cce75-9f0d-49ef-9138-8d35fc45a0b3";

const { data: assets } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", WORLD_ID).order("entity_id").order("created_at");
console.log("Total assets in this world:", assets.length);

const byEntity = new Map();
for (const a of assets) {
  const list = byEntity.get(a.entity_id) ?? [];
  list.push(a);
  byEntity.set(a.entity_id, list);
}

for (const [entityId, rows] of byEntity) {
  console.log(`\n=== entity: ${entityId} (${rows.length} rows) ===`);
  for (const r of rows) {
    console.log(`  id=${r.id.slice(0,8)} angle=${r.angle_or_view} status=${r.status} qa_status=${r.qa_status} generation_type=${r.generation_type} replaces=${r.replaces_asset_id?.slice(0,8) ?? "null"} stale=${r.stale} created_at=${r.created_at} result_url=${r.result_url ? r.result_url.slice(-40) : "null"}`);
  }
}
