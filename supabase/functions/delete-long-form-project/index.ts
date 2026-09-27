// delete-long-form-project/index.ts — 2026-10-03 "fixes round 3" pass,
// Section 3 (project card "⋯" menu -> Delete).
//
// Soft delete only — sets deleted_at, never a real DELETE FROM. A hard
// delete would need every dependent table (script/research/story-plan
// versions, generation profiles, reservations, narration audio, production
// bibles, visual plan/world, scenes, scene render plans...) to have a
// correct ON DELETE CASCADE, which nothing here has verified table-by-table;
// soft delete sidesteps that risk entirely and stays trivially reversible.
// fetchUserLongFormProjects (project.js) filters deleted_at is null.
//
// POST { projectId }
// Returns { ok:true }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { releaseReservationIfActive } from "../_shared/longFormReservations.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("id,user_id,deleted_at").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);
  if (project.deleted_at) return ok(req, { ok: true }); // already deleted — idempotent

  const { error: updateError } = await admin.from("long_form_projects").update({ deleted_at: new Date().toISOString() }).eq("id", projectId);
  if (updateError) return err(req, "Could not delete project", 500, { reason: updateError.message });

  // Phase 0, Section B — deleting a project is exactly the "ended without
  // producing work" case release_long_form_reservation exists for. Runs
  // AFTER the delete succeeds (never blocks the delete itself on a billing
  // hiccup) and is a no-op if there's no active reservation or it's already
  // settled/released.
  await releaseReservationIfActive(admin, projectId, "project_deleted", logEvent);

  return ok(req, { ok: true });
});
