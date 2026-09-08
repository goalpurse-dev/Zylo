// deno-lint-ignore-file no-explicit-any
// start-long-form-visual-world/index.ts
//
// Client-facing entry point for Visual World / Canonical References —
// mirrors start-long-form-visual-plan's contract exactly: creates/claims
// the Visual World Version row, kicks off the async worker, returns almost
// immediately. The client polls for completion.
//
// HARD INPUT CONTRACT: may only start from VisualPlanVersion.status ===
// "ready" — never planning/failed/stale. Enforced here, server-side.
//
// POST { projectId, regenerate?: boolean }
// Returns { project, visualWorld: { id, status, stage, ... } }.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_VISUAL_WORLD_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-visual-world`;
const MAX_VERSIONS_PER_PROJECT = 6;

const VISUAL_WORLD_PAUSED = (Deno.env.get("LONG_FORM_VISUAL_WORLD_PAUSED") ?? "").trim().toLowerCase() === "true";

function backgroundDispatch(promise: Promise<unknown>) {
  if (VISUAL_WORLD_PAUSED) return;
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[start-long-form-visual-world] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}
async function dispatchFirstStage(visualWorldVersionId: string) {
  await fetch(ADVANCE_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId }) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const regenerate = body?.regenerate === true;
  // Renderer/style abstraction (Part 1): the client selects from a small,
  // server-validated allowlist — never trust an arbitrary tool_key from the
  // request. Only image:flux.base is enabled for this cheap-test pass;
  // Studio/Director are real values the schema already supports but are
  // rejected here until their real Runware models are configured (never
  // invented — see advance-long-form-visual-world's own comment on this).
  const ALLOWED_RENDERER_TOOL_KEYS = ["image:flux.base", "image:flux2.klein9bkv"];
  const ALLOWED_STYLE_KEYS = ["zyvo_illustrated_documentary"];
  const rendererToolKey = ALLOWED_RENDERER_TOOL_KEYS.includes(body?.rendererToolKey) ? body.rendererToolKey : "image:flux.base";
  const styleKey = ALLOWED_STYLE_KEYS.includes(body?.styleKey) ? body.styleKey : "zyvo_illustrated_documentary";
  // Optional advanced overrides (Part 10) — planned views the user
  // unchecked before generation, as "entityId:angle" keys. Never required.
  const excludedViews = Array.isArray(body?.excludedViews) ? body.excludedViews.filter((v: unknown) => typeof v === "string").slice(0, 200) : [];
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);
  if (!project.current_visual_plan_version_id) return err(req, "This project needs a finished storyboard before Visual World can begin", 400);

  const { data: visualPlanRow } = await admin.from("long_form_visual_plan_versions").select("id, status, script_version_id").eq("id", project.current_visual_plan_version_id).maybeSingle();
  // HARD gate — see file header. Never planning/failed.
  if (!visualPlanRow || visualPlanRow.status !== "ready") {
    return err(req, "The storyboard for this project isn't ready yet", 400, { code: "VISUAL_PLAN_NOT_READY" });
  }

  const visualPlanVersionId = visualPlanRow.id;
  const scriptVersionId = visualPlanRow.script_version_id;

  if (!regenerate) {
    const { data: existing } = await admin
      .from("long_form_visual_world_versions")
      .select("id, status, stage")
      .eq("project_id", projectId)
      .eq("visual_plan_version_id", visualPlanVersionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status !== "failed") {
      return ok(req, { project, visualWorld: existing });
    }
    if (existing && existing.status === "failed") {
      const { data: resumed, error: resumeError } = await admin
        .from("long_form_visual_world_versions")
        .update({ status: "planning", stage: "planning", stage_attempt: 0, worker_lock_until: null, last_error_code: null })
        .eq("id", existing.id)
        .select("id, status, stage")
        .single();
      if (resumeError || !resumed) return err(req, "Could not resume Visual World", 500);
      backgroundDispatch(dispatchFirstStage(resumed.id));
      return ok(req, { project, visualWorld: resumed });
    }
  }

  if (regenerate) {
    const { count } = await admin.from("long_form_visual_world_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("visual_plan_version_id", visualPlanVersionId);
    if ((count ?? 0) >= MAX_VERSIONS_PER_PROJECT) {
      return err(req, "You've reached the Visual World regeneration limit for this storyboard.", 429, { code: "TOO_MANY_VERSIONS" });
    }
  }

  const { count: versionCount } = await admin.from("long_form_visual_world_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("visual_plan_version_id", visualPlanVersionId);
  const nextVersion = (versionCount ?? 0) + 1;

  const { data: inserted, error: insertError } = await admin
    .from("long_form_visual_world_versions")
    .insert({
      project_id: projectId,
      visual_plan_version_id: visualPlanVersionId,
      script_version_id: scriptVersionId,
      version: nextVersion,
      status: "planning",
      stage: "planning",
      renderer_tool_key: rendererToolKey,
      style_key: styleKey,
      excluded_views: excludedViews,
    })
    .select("id, status, stage")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: race } = await admin
        .from("long_form_visual_world_versions")
        .select("id, status, stage")
        .eq("project_id", projectId)
        .eq("visual_plan_version_id", visualPlanVersionId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (race) return ok(req, { project, visualWorld: race });
    }
    return err(req, "Could not start Visual World", 500);
  }

  backgroundDispatch(dispatchFirstStage(inserted.id));
  return ok(req, { project, visualWorld: inserted });
});
