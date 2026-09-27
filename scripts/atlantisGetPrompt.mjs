import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const beatId = process.argv[2];
const { data: plan } = await admin.from("long_form_scene_render_plans").select("image_prompt,director_meta,composition,qa_expectations,overlay_spec").eq("visual_beat_id", beatId).eq("visual_plan_version_id", "dae92f04-912f-4053-b348-ac11471c2b8d").maybeSingle();
console.log(JSON.stringify(plan, null, 2));
