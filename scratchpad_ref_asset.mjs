import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync("c:/Users/Public/Zylo/.env.local", "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

for (const id of ["c758b81c-fb99-4058-a971-1372e514ff62", "0518dbef-c23b-4ebf-bb20-65bf82ff1a6d", "05abe1eb-d499-46ba-8ac0-d8dd13398de2"]) {
  const { data, error } = await sb.from("long_form_reference_assets").select("*").eq("id", id).maybeSingle();
  console.log("---", id, error?.message);
  if (data) console.log(JSON.stringify({ reference_type: data.reference_type, entity_id: data.entity_id, result_url: data.result_url, is_ready: data.is_ready, sheet_role: data.sheet_role, layout: data.layout }, null, 1));
}

// also check the actual bundle record for a9c245e9
const { data: bundle } = await sb.from("long_form_scene_reference_bundles").select("*").eq("id", "a9c245e9-b8a0-4432-9378-fa31d141dcd5").maybeSingle();
console.log("bundle a9c245e9:", JSON.stringify(bundle, null, 1));
const { data: bundle2 } = await sb.from("long_form_scene_reference_bundles").select("*").eq("id", "36a568c5-7d16-403d-9e94-fd2ea8b41428").maybeSingle();
console.log("bundle 36a568c5:", JSON.stringify(bundle2, null, 1));
