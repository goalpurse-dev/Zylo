// 2026-09-23 "systemic production stabilization" pass — locally renders the
// REAL, freshly-recompiled Chapter 1 PROGRAMMATIC_GRAPHIC specs through the
// exact same deterministic renderGraphicCard/escalateToListLayout functions
// the real pipeline uses. Zero provider calls, zero credits — a
// PROGRAMMATIC_GRAPHIC card is pure local computation, never Runware/Kling.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { renderGraphicCard } from "../supabase/functions/_shared/graphicTemplates.ts";
import { escalateToListLayout } from "../supabase/functions/_shared/graphicSpec.ts";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const V7 = "96e84cf2-799e-482b-a3d2-b924b44c9d53";
const { data: plans } = await admin.from("long_form_scene_render_plans").select("visual_beat_id,overlay_spec").eq("visual_plan_version_id", V7).in("visual_beat_id", ["vb01_shot_7", "vb02_shot_1", "vb02_shot_2"]);
for (const p of plans) {
  const rendered = renderGraphicCard(p.overlay_spec);
  console.log(p.visual_beat_id, "template:", p.overlay_spec.template, "issues:", JSON.stringify(rendered.issues));
  if (rendered.issues.length) {
    const escalated = escalateToListLayout(p.overlay_spec);
    if (escalated) {
      const r2 = renderGraphicCard(escalated);
      console.log("  escalated to BULLET_LIST -> issues:", JSON.stringify(r2.issues));
    } else {
      console.log("  no escalation available");
    }
  }
}
