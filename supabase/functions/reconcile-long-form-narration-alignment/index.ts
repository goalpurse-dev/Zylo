// deno-lint-ignore-file no-explicit-any
// reconcile-long-form-narration-alignment/index.ts — 2026-10-02 "real
// narration audio master timeline" pass, Section 10.
//
// Section 10's explicit requirement: "If the provider audio succeeds but
// alignment parsing fails: preserve the successful audio. Retry/reconcile
// alignment separately. Do not pay for another voice generation
// unnecessarily." This function does exactly that and nothing else — it
// re-runs the SAME deterministic mapping (mapAlignmentToNarration) against
// the row's own already-stored raw_provider_alignment and the current
// script segments, with ZERO network call to any provider.
//
// POST { narrationAudioVersionId }
// Returns { ok:true, status } | { ok:false, reason } on a genuine, still-
// unresolved mismatch.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { mapAlignmentToNarration } from "../_shared/stickman/narrationAudio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const narrationAudioVersionId = String(body?.narrationAudioVersionId ?? "").trim();
  if (!narrationAudioVersionId) return err(req, "Missing narrationAudioVersionId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: row, error: rowError } = await admin.from("long_form_narration_audio_versions").select("*, long_form_projects!inner(user_id)").eq("id", narrationAudioVersionId).maybeSingle();
  if (rowError) return err(req, "Failed to load narration audio", 500);
  if (!row) return err(req, "Narration audio not found", 404);
  const ownerId = Array.isArray(row.long_form_projects) ? row.long_form_projects[0]?.user_id : row.long_form_projects?.user_id;
  if (ownerId !== user.id) return err(req, "Forbidden", 403);
  if (row.status !== "alignment_failed") return err(req, "This narration audio does not need alignment reconciliation.", 409);
  if (!row.raw_provider_alignment || !row.audio_url) return err(req, "No stored alignment/audio to reconcile from.", 422);

  const { data: scriptVersion, error: scriptError } = await admin.from("long_form_script_versions").select("script_document").eq("id", row.script_version_id).maybeSingle();
  if (scriptError) return err(req, "Failed to load script", 500);
  const segments: { id: string; text: string }[] = scriptVersion?.script_document?.narrationSegments ?? [];

  const mapped = mapAlignmentToNarration(row.raw_provider_alignment, segments);
  if (!mapped.ok) {
    return err(req, "Alignment still could not be mapped to the current script segments.", 422, { reason: mapped.reason });
  }

  await admin.from("long_form_narration_audio_versions").update({
    status: "ready", narration: mapped.segmentTimings, last_error_code: null, last_error_at: null, ready_at: new Date().toISOString(),
  }).eq("id", narrationAudioVersionId);

  return ok(req, { ok: true, status: "ready" });
});
