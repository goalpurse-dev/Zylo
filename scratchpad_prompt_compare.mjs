import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
  })
);
const admin = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ids = ["dc96a914", "d931eabd", "f97c9ea7", "5af8e609", "a26bdcd8", "eaab3128"]; // technician x2, protagonist(new), power_officer(new), agri(new), ops officer
const { data } = await admin.from("long_form_reference_assets").select("id,entity_id,prompt_snapshot,render_model,cost_usd").order("created_at");
for (const row of data) {
  if (ids.some((p) => row.id.startsWith(p))) {
    console.log(`\n=== ${row.entity_id} (${row.id.slice(0,8)}) render_model=${row.render_model} cost=${row.cost_usd} ===`);
    console.log(row.prompt_snapshot);
  }
}
