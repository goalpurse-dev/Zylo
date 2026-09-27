import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("LONG_FORM_VISUAL_PLAN_ADVANCE_SECRET") ?? "";
const PAUSED = (Deno.env.get("LONG_FORM_VISUAL_PLAN_PAUSED") ?? "").trim().toLowerCase() === "true";
async function dispatch(id: string) {
  const response = await fetch(`${URL}/functions/v1/advance-long-form-visual-plan`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "x-cron-secret": SECRET }, body: JSON.stringify({ visualPlanVersionId: id }) });
  const result = await response.json().catch(() => ({}));
  console.info("[visual-plan] dispatch", { id, httpStatus: response.status, claimed: result.claimed, paused: result.paused });
  if (!response.ok) throw new Error(`Dispatch HTTP ${response.status}`);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  if (!body.projectId) return err(req, "Missing projectId", 400);
  const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  // A maintenance pause must never silently create another stranded request.
  // Existing versions remain readable; only explicitly authorized recovery can run.
  if (PAUSED) {
    const { data: owned } = await admin.from("long_form_projects").select("current_script_version_id").eq("id", body.projectId).eq("user_id", user.id).maybeSingle();
    if (!owned) return err(req, "Project not found", 404);
    const { data: existing } = await admin.from("long_form_visual_plan_versions").select("id").eq("project_id",body.projectId).eq("script_version_id",owned.current_script_version_id).is("meta->>supersededBy",null).limit(1).maybeSingle();
    if (body.regenerate === true || !existing) return err(req, "Storyboard updates are temporarily paused. Your existing storyboard is safe.", 503, { code:"VISUAL_PLAN_PAUSED" });
  }
  const { data: visualPlan, error } = await admin.rpc("start_visual_plan_version", { p_project_id: body.projectId, p_user_id: user.id, p_regenerate: body.regenerate === true });
  if (error) return err(req, error.message, 400, { code: error.message.includes("SCRIPT_NOT_READY") ? "SCRIPT_NOT_READY" : "START_FAILED" });
  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", body.projectId).single();
  if (visualPlan.status === "planning") EdgeRuntime.waitUntil(dispatch(visualPlan.id).catch(error => console.error("[visual-plan] dispatch failed; recovery will retry", error.message)));
  return ok(req, { project, visualPlan });
});
