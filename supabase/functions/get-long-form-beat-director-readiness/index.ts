// deno-lint-ignore-file no-explicit-any
// get-long-form-beat-director-readiness/index.ts — 2026-10-02 "real
// narration audio master timeline" pass, Section 15/16.
//
// Read-only. Fetches every artifact the (not-yet-built) Beat Director needs
// and assembles them via the shared, pure, tested assembleBeatDirectorReadiness
// function. Never mutates anything, never calls a provider.
//
// POST { projectId }
// Returns the BeatDirectorReadiness object directly.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { assembleBeatDirectorReadiness } from "../_shared/stickman/beatDirectorReadiness.ts";

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

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  const { data: profile } = await admin.from("long_form_generation_profiles").select("*").eq("project_id", projectId).eq("status", "active").maybeSingle();
  const { data: scriptVersion } = project.current_script_version_id
    ? await admin.from("long_form_script_versions").select("*").eq("id", project.current_script_version_id).maybeSingle()
    : { data: null };
  const { data: productionBible } = profile && scriptVersion
    ? await admin.from("long_form_production_bibles").select("*").eq("project_id", projectId).eq("script_version_id", scriptVersion.id).eq("generation_profile_id", profile.id).eq("status", "frozen").maybeSingle()
    : { data: null };
  const { data: narrationAudio } = profile && scriptVersion
    ? await admin.from("long_form_narration_audio_versions").select("*").eq("project_id", projectId).eq("script_version_id", scriptVersion.id).eq("generation_profile_id", profile.id).order("version", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const readiness = assembleBeatDirectorReadiness({ project, generationProfile: profile, scriptVersion, productionBible, narrationAudio });
  return ok(req, readiness);
});
