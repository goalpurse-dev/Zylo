// narration.js — 2026-10-02 "make the new flow real in the product" pass,
// Section 7-11. Client for the real narration-audio master timeline: the
// durable long_form_narration_audio_versions row (directly SELECT-able under
// RLS — unlike generation_profiles/production_bibles, this table was never
// grant-revoked from `authenticated`, see its own migration) plus the two
// mutating edge functions (generate/regenerate, change voice) and the
// read-only Beat Director readiness object used to gate "Continue to Visuals".
import { supabase } from "../../../lib/supabaseClient";

// A small, fixed set of real, well-known ElevenLabs premade voice ids — no
// live catalog fetch exists yet, and no live preview is wired (Section 11
// allows omitting preview "if practical"; it isn't yet, since the
// ELEVENLABS_KEY secret is currently invalid — see the engineering report).
// "Josh" matches the exact id this pass's own live validation script used.
export const STICKMAN_VOICE_OPTIONS = [
  { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5", label: "Josh", description: "Calm, clear male narrator — the default." },
  { voiceId: "21m00Tcm4TlvDq8ikWAM", voiceModel: "eleven_flash_v2_5", label: "Rachel", description: "Warm, measured female narrator." },
  { voiceId: "EXAVITQu4vr4xnSDxMaL", voiceModel: "eleven_flash_v2_5", label: "Bella", description: "Bright, energetic female voice." },
  { voiceId: "ErXwobaYiN019PkySvjV", voiceModel: "eleven_flash_v2_5", label: "Antoni", description: "Deep, confident male voice." },
];

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
