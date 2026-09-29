// narration.js — 2026-10-02 "make the new flow real in the product" pass,
// Section 7-11. Client for the real narration-audio master timeline: the
// durable long_form_narration_audio_versions row (directly SELECT-able under
// RLS — unlike generation_profiles/production_bibles, this table was never
// grant-revoked from `authenticated`, see its own migration) plus the two
// mutating edge functions (generate/regenerate, change voice) and the
// read-only Beat Director readiness object used to gate "Continue to Visuals".
import { supabase } from "../../../lib/supabaseClient";
import { VOICE_CATALOG } from "../../../lib/voiceCatalog";

// Phase 6b: the curated voice library (src/lib/voiceCatalog.js) — 33 voices,
// each with a fixed sample. Kept in this shape for older call sites.
export const STICKMAN_VOICE_OPTIONS = VOICE_CATALOG.map((v) => ({ voiceId: v.voiceId, voiceModel: v.voiceModel, label: v.name, description: v.tags.join(", ") }));

export async function fetchLatestNarrationAudio(projectId, generationProfileId) {
  if (!projectId || !generationProfileId) return null;
  const { data, error } = await supabase
    .from("long_form_narration_audio_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("generation_profile_id", generationProfileId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

function parseInvokeError(error) {
  const context = error?.context;
  return context && typeof context.json === "function" ? context.json().catch(() => null) : Promise.resolve(null);
}

// Phase 6a: server-side progress + watchdog for the Voice screen.
export async function fetchNarrationStatus(projectId) {
  const { data, error } = await supabase.functions.invoke("get-long-form-narration-status", { body: { projectId } });
  if (error) return null;
  return data;
}

export async function generateNarrationAudio(projectId, { manual = false } = {}) {
  const { data, error } = await supabase.functions.invoke("generate-long-form-narration-audio", { body: { projectId, manual } });
  if (error) {
    const payload = await parseInvokeError(error);
    return { ok: false, status: error.context?.status ?? 500, message: payload?.error ?? "Couldn't generate narration.", payload };
  }
  return { ok: true, ...data };
}

export async function reconcileNarrationAlignment(narrationAudioVersionId) {
  const { data, error } = await supabase.functions.invoke("reconcile-long-form-narration-alignment", { body: { narrationAudioVersionId } });
  if (error) return { ok: false };
  return { ok: true, ...data };
}

export async function changeNarrationVoice(projectId, { voiceId, voiceModel }) {
  const { data, error } = await supabase.functions.invoke("update-long-form-narration-voice", { body: { projectId, voiceId, voiceModel } });
  if (error) return { ok: false };
  return { ok: true, ...data };
}

export async function fetchBeatDirectorReadiness(projectId) {
  const { data, error } = await supabase.functions.invoke("get-long-form-beat-director-readiness", { body: { projectId } });
  if (error) return null;
  return data;
}

export async function lockStory(projectId) {
  const { data, error } = await supabase.functions.invoke("lock-long-form-script", { body: { projectId } });
  if (error) {
    const payload = await parseInvokeError(error);
    return { ok: false, message: payload?.error ?? "Couldn't lock the story." };
  }
  return { ok: true, ...data };
}
