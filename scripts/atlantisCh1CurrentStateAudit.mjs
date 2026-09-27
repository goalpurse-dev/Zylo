import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";

const { data: project } = await admin.from("long_form_projects").select("*").eq("id", PROJECT_ID).maybeSingle();
console.log("current_visual_plan_version_id:", project.current_visual_plan_version_id);
console.log("current_visual_world_version_id:", project.current_visual_world_version_id);
console.log("active_generation_charge_id:", project.active_generation_charge_id);

const { data: charges } = await admin.from("long_form_episode_generation_charges").select("*").eq("project_id", PROJECT_ID).order("created_at");
console.log("\nALL CHARGES:", JSON.stringify(charges, null, 2));
