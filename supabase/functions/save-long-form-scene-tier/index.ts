// deno-lint-ignore-file no-explicit-any
// save-long-form-scene-tier/index.ts
//
// Persists the user's V2/V3/V4 selection on long_form_projects.scene_
// generation_tier. Routed through an edge function (service role) rather
// than a direct client-side table update — long_form_projects has no
// UPDATE RLS policy at all (every existing Long Form mutation already goes
// through a dedicated edge function; this follows the same convention).
//
// POST { projectId, tier }
// Returns { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const tier = String(body?.tier ?? "").trim();
  if (!projectId || !["v2", "v3", "v4"].includes(tier)) return err(req, "Missing or invalid projectId/tier", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project } = await admin.from("long_form_projects").select("id,user_id").eq("id", projectId).maybeSingle();
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  const { error } = await admin.from("long_form_projects").update({ scene_generation_tier: tier, updated_at: new Date().toISOString() }).eq("id", projectId);
  if (error) return err(req, "Could not save your quality selection", 500);
  return ok(req, { ok: true });
});
