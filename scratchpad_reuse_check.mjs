import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
  })
);
const admin = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data } = await admin.from("long_form_reference_assets").select("id,entity_id,generation_type,source_visual_world_version_id,source_reference_asset_id,reuse_reason,job_id,render_model").eq("visual_world_version_id", "d64cce75-9f0d-49ef-9138-8d35fc45a0b3");
for (const a of data) {
  console.log(`${a.entity_id.padEnd(22)} id=${a.id.slice(0,8)} gen_type=${a.generation_type.padEnd(10)} source_asset=${(a.source_reference_asset_id?.slice(0,8) ?? "null").padEnd(10)} source_world=${(a.source_visual_world_version_id?.slice(0,8) ?? "null").padEnd(10)} job_id=${a.job_id ? "SET" : "NULL"} model=${a.render_model}`);
}
