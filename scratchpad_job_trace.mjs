import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
  })
);
const admin = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: assets } = await admin.from("long_form_reference_assets").select("id,entity_id,job_id,render_model,status,qa_status,qa_result,last_error_code").in("id", [
  "9e933643-0000-0000-0000-000000000000".slice(0,8) // placeholder, will refetch properly below
]);

// Refetch by prefix match since I only have 8-char prefixes from earlier trace
const { data: all } = await admin.from("long_form_reference_assets").select("id,entity_id,job_id,render_model,status,qa_status,qa_result,last_error_code").eq("visual_world_version_id", "d64cce75-9f0d-49ef-9138-8d35fc45a0b3").eq("reference_type", "character_reference");
for (const a of all) {
  console.log(`\n=== ${a.entity_id} (${a.id.slice(0,8)}) model=${a.render_model} status=${a.status} qa=${a.qa_status} ===`);
  console.log("qa_result:", JSON.stringify(a.qa_result));
  if (a.job_id) {
    const { data: job } = await admin.from("jobs").select("id,tool_key,status,input,output,error").eq("id", a.job_id).maybeSingle();
    if (job) {
      console.log("job.tool_key:", job.tool_key, "| job.status:", job.status);
      console.log("job.input:", JSON.stringify(job.input)?.slice(0, 300));
      console.log("job.error:", job.error);
    }
  }
}
