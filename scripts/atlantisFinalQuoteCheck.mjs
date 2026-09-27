import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const { data: project } = await admin.from("long_form_projects").select("user_id,scene_generation_tier").eq("id", PROJECT_ID).maybeSingle();
const { data: chapterQuote } = await admin.rpc("quote_long_form_generation", { p_project_id: PROJECT_ID, p_user_id: project.user_id, p_tier: project.scene_generation_tier ?? "v3", p_chapter_mode: true });
console.log(JSON.stringify({ tier: project.scene_generation_tier, chapterQuote }, null, 2));
