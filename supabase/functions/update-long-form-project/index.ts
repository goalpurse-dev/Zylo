// update-long-form-project/index.ts
//
// Small, low-stakes edits layered on top of a generated Story Plan —
// picking an alternative title, or editing/adding/removing a chapter.
// These are NOT a regeneration: they mutate the CURRENT story plan version
// in place (title selection lives on the project row itself; chapter edits
// patch that version's story_plan JSONB), so "Regenerate Plan" remains the
// only action that ever creates a new version.
//
// POST { projectId, selectedTitle? , chapters? }
// Returns { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_CHAPTERS = 12;

function isValidChapters(chapters: unknown) {
  if (!Array.isArray(chapters) || chapters.length === 0 || chapters.length > MAX_CHAPTERS) return false;
  return chapters.every(
    (c) =>
      c &&
      typeof c === "object" &&
      typeof c.id === "string" &&
      typeof c.title === "string" &&
      typeof c.summary === "string" &&
      typeof c.purpose === "string" &&
      typeof c.estimatedMinutes === "number" &&
      Array.isArray(c.keyQuestions)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project } = await admin
    .from("long_form_projects")
    .select("id, user_id, current_story_plan_version_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);

  let didSomething = false;

  if (typeof body?.selectedTitle === "string" && body.selectedTitle.trim()) {
    const { error } = await admin
      .from("long_form_projects")
      .update({ selected_title: body.selectedTitle.trim().slice(0, 300), updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) return err(req, "Could not save title", 500);
    didSomething = true;
  }

  if ("chapters" in body) {
    if (!project.current_story_plan_version_id) return err(req, "No story plan to edit yet", 400);
    if (!isValidChapters(body.chapters)) return err(req, "Invalid chapters", 400);

    const { data: version } = await admin
      .from("long_form_story_plan_versions")
      .select("story_plan")
      .eq("id", project.current_story_plan_version_id)
      .maybeSingle();
    if (!version) return err(req, "Story plan version not found", 404);

    const nextStoryPlan = { ...version.story_plan, chapters: body.chapters };
    const { error } = await admin.from("long_form_story_plan_versions").update({ story_plan: nextStoryPlan }).eq("id", project.current_story_plan_version_id);
    if (error) return err(req, "Could not save chapters", 500);
    didSomething = true;
  }

  if (!didSomething) return err(req, "No recognized fields to update", 400);

  return ok(req, { ok: true });
});
