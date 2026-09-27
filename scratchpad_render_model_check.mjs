import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
  })
);
const admin = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WORLD_ID = "d64cce75-9f0d-49ef-9138-8d35fc45a0b3";
const { data } = await admin.from("long_form_reference_assets").select("id,entity_id,angle_or_view,status,qa_status,render_model,replaces_asset_id,created_at,cost_usd").eq("visual_world_version_id", WORLD_ID).eq("reference_type", "character_reference").order("created_at");
for (const r of data) {
  console.log(`${r.entity_id.padEnd(22)} id=${r.id.slice(0,8)} replaces=${(r.replaces_asset_id?.slice(0,8) ?? "null").padEnd(10)} status=${r.status.padEnd(10)} qa=${(r.qa_status ?? "null").padEnd(10)} model=${r.render_model} cost=${r.cost_usd}`);
}
