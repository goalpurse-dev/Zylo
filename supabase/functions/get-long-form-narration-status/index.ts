// deno-lint-ignore-file no-explicit-any
// get-long-form-narration-status/index.ts — user-facing (Phase 6a).
// What the Voice screen polls every ~3 s while the narration is prepared:
// the row's status, the SERVER's "now" + the row's start time (elapsed never
// runs on a local clock), an honest ETA range from the script's character
// count (measured: 6,310 chars -> 13 s), the voice, and the attempt number.
// Display only: a "generating" row whose lease expired is recovered by the
// server watchdog in advance-long-form-autopilot (cron, every minute), which
// resumes it ONCE or marks it failed so the screen shows a free Retry.
// POST { projectId }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { narrationEtaSeconds } from "../_shared/stickman/narrationAudio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const { data: project } = await admin.from("long_form_projects").select("id, user_id, current_script_version_id").eq("id", projectId).maybeSingle();
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);
  const { data: profile } = await admin.from("long_form_generation_profiles").select("id, voice_id, voice_model").eq("project_id", projectId).eq("status", "active").maybeSingle();
  const { data: script } = project.current_script_version_id ? await admin.from("long_form_script_versions").select("script_document").eq("id", project.current_script_version_id).maybeSingle() : { data: null };
  const chars = (script?.script_document?.narrationSegments ?? []).map((s: any) => s.text).join(" ").length;
  const { data: row } = profile ? await admin.from("long_form_narration_audio_versions").select("id, status, created_at, lease_until, ready_at, last_error_code, provider_metadata").eq("project_id", projectId).eq("generation_profile_id", profile.id).order("version", { ascending: false }).limit(1).maybeSingle() : { data: null };

  const now = new Date();
  // Display only (Phase 6b): recovery of an expired lease is the server
  // watchdog's job (advance-long-form-autopilot, every minute) — no page needed.
  const leaseExpired = row?.status === "generating" && row.lease_until && Date.parse(row.lease_until) < now.getTime();
  const startedAt = row?.provider_metadata?.resumedAt ?? row?.created_at ?? null;
  return ok(req, {
    status: row?.status ?? "none",
    startedAt,
    serverNow: now.toISOString(),
    etaSeconds: narrationEtaSeconds(chars),
    characterCount: chars,
    attempt: Number(row?.provider_metadata?.attempts ?? 1),
    resuming: !!leaseExpired,
    voice: profile ? { voiceId: profile.voice_id, voiceModel: profile.voice_model } : null,
    error: row?.status === "failed" ? (row.last_error_code === "NARRATION_STALLED" ? "The voice generation stalled." : "The voice generation failed.") : null,
    providerCharacterCost: row?.provider_metadata?.providerCharacterCost ?? null,
  });
});
