// deno-lint-ignore-file no-explicit-any
// update-long-form-narration-voice/index.ts — 2026-10-02 "make the new flow
// real in the product" pass, Section 11 ("Change Voice").
//
// Voice choice carries NO reservation cost impact (only render tier/duration
// feed the credit quote — see longFormProjectQuote.ts), and before Visuals/
// Beat Director exist there is nothing downstream of narration that a voice
// change could invalidate except the narration artifact itself — which the
// existing request_hash idempotency already handles correctly for free: a
// different voiceId produces a different request_hash, so the very next
// generate-long-form-narration-audio call naturally creates a NEW versioned
// row rather than reusing the old one. That's the real "downstream
// invalidation" here; this function's only job is the in-place voice field
// update on the CURRENT active Production Profile (never a new profile
// version/lineage — a voice swap is not a quality-tier change).
//
// POST { projectId, voiceId, voiceModel }
// Returns { ok:true }
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
  const voiceId = String(body?.voiceId ?? "").trim();
  const voiceModel = String(body?.voiceModel ?? "").trim();
  if (!projectId || !voiceId || !voiceModel) return err(req, "Missing projectId/voiceId/voiceModel", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("id,user_id").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  const { data: profile, error: profileError } = await admin.from("long_form_generation_profiles").select("id").eq("project_id", projectId).eq("status", "active").maybeSingle();
  if (profileError) return err(req, "Failed to load production profile", 500);
  if (!profile) return err(req, "This project has no active Production Profile.", 409);

  const { error: updateError } = await admin.from("long_form_generation_profiles").update({ voice_id: voiceId, voice_model: voiceModel }).eq("id", profile.id);
  if (updateError) return err(req, "Could not update voice.", 500, { reason: updateError.message });

  return ok(req, { ok: true });
});
