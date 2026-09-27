// deno-lint-ignore-file no-explicit-any
// get-long-form-project-profile/index.ts — 2026-10-02 "make the new flow
// real in the product" pass.
//
// Read-only. long_form_generation_profiles has `revoke all ... from
// authenticated` at the table level (see 20261002100000's own comment: every
// write goes through create_long_form_generation_profile, a SECURITY DEFINER
// RPC) — so the frontend has no way to read a project's active profile
// directly. This is the one read path: it's how the new recipe-aware
// stepper, the Story page's "Lock Story" gate, and the Narration page all
// find out (a) whether this project even uses the new Stickman flow and
// (b) the locked voice/tier settings for it. Never mutates anything.
//
// POST { projectId }
// Returns { ok:true, profile: <row> | null }
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
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("id,user_id").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  const { data: profile, error: profileError } = await admin.from("long_form_generation_profiles").select("*").eq("project_id", projectId).eq("status", "active").maybeSingle();
  if (profileError) return err(req, "Failed to load production profile", 500);

  return ok(req, { ok: true, profile: profile ?? null });
});
