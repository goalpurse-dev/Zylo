// deno-lint-ignore-file no-explicit-any
// generate-long-form-narration-audio/index.ts — 2026-10-02 "real narration
// audio master timeline" pass, Section 7/8/9/10/12.
//
// The durable narration-audio trigger+worker. The HTTP response returns
// almost immediately (a row created/found + its status) — the actual
// ElevenLabs call and persistence run via EdgeRuntime.waitUntil, so closing
// the browser, refreshing, or the laptop sleeping mid-generation can never
// lose the work (Section 10). The client only ever POLLS
// long_form_narration_audio_versions (a normal RLS-scoped SELECT) for the
// result — it never has to re-invoke this function to make progress on an
// already-started generation.
//
// Idempotent by (project, request_hash) — Section 14's "rerunning with
// identical lineage does NOT call provider again" requirement, verified via
// a real live test. p_manual distinguishes the Lock-Story-triggered
// automatic first generation (never counts against the revision allowance)
// from an explicit user "Regenerate Voice" click (does).
//
// Billing policy implemented (Section 13, documented per the explicit
// instruction to state which policy is chosen): narration/TTS cost is
// currently ABSORBED by Zyvo internally — credits_charged stays 0 and
// commit_long_form_reservation_spend is never called for it, exactly like
// the existing Visual World reference-planner and narration-contract
// compiler costs. Real internal cost is still measured and recorded
// (internal_cost_usd) for accounting, matching that same precedent.
//
// POST { projectId, manual?: boolean }
// Returns { ok:true, narrationAudioVersionId, status, alreadyGenerated }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUserOrAutopilot } from "../shared/auth.ts";
import { computeScriptInputHash, computeRequestHash, synthesizeNarrationAudio, mapAlignmentToNarration, DEFAULT_ELEVENLABS_VOICE_SETTINGS, decodeBase64Native, narrationLeaseMs, NARRATION_MAX_ATTEMPTS } from "../_shared/stickman/narrationAudio.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { recordCost, narrationCost } from "../_shared/costLedger.ts";
import { releaseReservationIfActive, settleReservationIfActive } from "../_shared/longFormReservations.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_KEY") ?? "";
const SETTLE_AT_RENDER = (Deno.env.get("LONG_FORM_SETTLE_AT_RENDER") ?? "").trim().toLowerCase() === "true";

// Phase 6d-1: cost = the credits ElevenLabs reports in its character-cost
// header x ELEVENLABS_USD_PER_CREDIT (costLedger.ts config); only when the
// header is missing is it estimated from the character count.

async function doGeneration(admin: any, projectId: string, rowId: string, text: string, segments: { id: string; text: string }[], voiceId: string, voiceModel: string, voiceSettings: Record<string, unknown> | null, settleAtNarration = true) {
  try {
    const synthesis = await synthesizeNarrationAudio({ elevenLabsKey: ELEVENLABS_KEY, text, voiceId, voiceModel, voiceSettings: voiceSettings ?? undefined });
    // Heartbeat: the provider answered — extend the lease while we save.
    const { data: cur } = await admin.from("long_form_narration_audio_versions").select("provider_metadata").eq("id", rowId).maybeSingle();
    const prevMeta = cur?.provider_metadata ?? {};
    await admin.from("long_form_narration_audio_versions").update({ lease_until: new Date(Date.now() + 120_000).toISOString(), provider_metadata: { ...prevMeta, phase: "saving", providerCharacterCost: synthesis.characterCost, characterCount: text.length } }).eq("id", rowId);
    const audioBytes = await decodeBase64Native(synthesis.audioBase64, synthesis.mimeType);
    const path = `long-form/narration/${rowId}.mp3`;
    const { error: uploadError } = await admin.storage.from("generated").upload(path, audioBytes, { contentType: synthesis.mimeType, upsert: true });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = admin.storage.from("generated").getPublicUrl(path);

    const mapped = mapAlignmentToNarration(synthesis.rawAlignment, segments);
    // Cost ledger: characters sent + ElevenLabs' own character-cost (credits).
    // Phase 6d-1: the credits ElevenLabs actually charged x $/credit (config), not a per-character guess.
    const nc = narrationCost(text.length, synthesis.characterCost);
    await recordCost(admin, { projectId, stage: "narration", provider: "elevenlabs", model: voiceModel, units: { calls: 1, characters: text.length, providerCredits: nc.credits }, usd: nc.usd, estimated: nc.estimated, sourceTable: "long_form_narration_audio_versions", sourceId: rowId });
    const internalCostUsd = Number(nc.usd.toFixed(4));
    const providerMetadata = { attempts: prevMeta.attempts ?? 1, resumedAt: prevMeta.resumedAt ?? null, characterCount: text.length, model: voiceModel, providerCharacterCost: synthesis.characterCost, providerRequestId: synthesis.requestId, costBasis: nc.estimated ? "credits estimated at 0.20/character x $/credit (no character-cost header)" : "ElevenLabs character-cost header (credits) x $/credit" };

    if (mapped.ok) {
      await admin.from("long_form_narration_audio_versions").update({
        status: "ready", audio_url: publicUrl.publicUrl, audio_duration_seconds: synthesis.durationSeconds,
        raw_provider_alignment: synthesis.rawAlignment, narration: mapped.segmentTimings,
        provider_metadata: providerMetadata, internal_cost_usd: internalCostUsd, ready_at: new Date().toISOString(),
      }).eq("id", rowId);
      // Phase 5b moved the settle to render completion (finish-long-form-render,
      // RENDER_IS_THE_LAST_REAL_STAGE) — but users can't start a render until
      // the Render button ships (Phase 6), so until LONG_FORM_SETTLE_AT_RENDER
      // is switched on, narration-ready still settles (today's behavior).
      // Phase 6c: with the flag on, a STICKMAN project keeps its reservation for the
      // Scenes step (each scene draws from it) and settles at render (or after 7 idle
      // days, settleIdleReservations). Legacy projects keep settling here (unchanged).
      if (settleAtNarration) await settleReservationIfActive(admin, projectId, "narration_ready", logEvent);
    } else {
      // Section 10: the audio itself succeeded — preserve it. Only
      // alignment mapping failed; reconcile-long-form-narration-alignment
      // can retry the mapping later with ZERO new provider call. Real,
      // usable work was produced, so the reservation is left untouched —
      // this is not a "failed before any spend" case.
      console.error("[generate-long-form-narration-audio] audio succeeded but alignment mapping failed (audio preserved):", rowId, mapped.reason);
      await admin.from("long_form_narration_audio_versions").update({
        status: "alignment_failed", audio_url: publicUrl.publicUrl, audio_duration_seconds: synthesis.durationSeconds,
        raw_provider_alignment: synthesis.rawAlignment, provider_metadata: providerMetadata, internal_cost_usd: internalCostUsd,
        last_error_code: mapped.reason, last_error_at: new Date().toISOString(),
      }).eq("id", rowId);
    }
  } catch (e) {
    console.error("[generate-long-form-narration-audio] generation failed:", rowId, e);
    await admin.from("long_form_narration_audio_versions").update({
      status: "failed", last_error_code: e instanceof Error ? e.message.slice(0, 200) : "UNKNOWN_ERROR", last_error_at: new Date().toISOString(),
    }).eq("id", rowId);
    // Phase 0, Section B — a genuine provider/upload failure with nothing
    // produced is exactly "generation fails terminally before any spend."
    await releaseReservationIfActive(admin, projectId, "narration_failed", logEvent);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  if (!ELEVENLABS_KEY) return err(req, "ELEVENLABS_KEY not configured", 500);

  // Phase 6b: the server watchdog (advance-long-form-autopilot cron) resumes
  // stalled narration without any open page — internal secret + owner userId.
  const { user, authError } = await requireUserOrAutopilot(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const manual = Boolean(body?.manual);
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project, error: projectError } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (projectError) return err(req, "Failed to load project", 500);
  if (!project || project.user_id !== user.id) return err(req, "Project not found", 404);

  const { data: profile, error: profileError } = await admin.from("long_form_generation_profiles").select("*").eq("project_id", projectId).eq("status", "active").maybeSingle();
  if (profileError) return err(req, "Failed to load generation profile", 500);
  if (!profile) return err(req, "This project has no active Production Profile yet — complete Setup first.", 409);
  if (!profile.voice_id || !profile.voice_model) return err(req, "This project's Production Profile has no voice configured.", 409);

  if (!project.current_script_version_id) return err(req, "This project has no script yet.", 409);
  const { data: scriptVersion, error: scriptError } = await admin.from("long_form_script_versions").select("*").eq("id", project.current_script_version_id).maybeSingle();
  if (scriptError) return err(req, "Failed to load script", 500);
  if (!scriptVersion) return err(req, "Script not found", 404);
  // Narration-first, hard gate (same rule as the Production Bible builder):
  // TTS must never run before the script is explicitly LOCKED — "ready"
  // alone only means the critic/revision pipeline finished, not that the
  // user committed to it (Section 5/6).
  if (!scriptVersion.locked_at || scriptVersion.locked_generation_profile_id !== profile.id) {
    return err(req, "The script must be locked (Lock Story) for this exact Production Profile before narration can be generated.", 409);
  }

  const segments: { id: string; text: string }[] = scriptVersion.script_document?.narrationSegments ?? [];
  if (!segments.length) return err(req, "The locked script has no narration segments.", 422);
  const ttsInputText = segments.map((s) => s.text).join(" ");

  const scriptInputHash = await computeScriptInputHash(segments);
  // The EFFECTIVE settings (defaults + profile) are hashed and stored, so a
  // changed default (Phase 2c: speed 0.92 -> 1.0) makes new audio instead of
  // silently reusing audio at the old speed. Only explicit actions (lock,
  // retry, regenerate, change voice) ever call this function.
  const effectiveVoiceSettings = { ...DEFAULT_ELEVENLABS_VOICE_SETTINGS, ...(profile.voice_settings ?? {}) };
  const voiceSpec = { provider: profile.voice_provider ?? "elevenlabs", voiceId: profile.voice_id, voiceModel: profile.voice_model, voiceSettings: effectiveVoiceSettings, language: profile.language ?? null };
  const requestHash = await computeRequestHash(scriptInputHash, voiceSpec);

  const { data: existing } = await admin.from("long_form_narration_audio_versions").select("*").eq("project_id", projectId).eq("request_hash", requestHash).maybeSingle();

  // Phase 6b: the server watchdog only ever RESUMES the stalled row it found.
  // If that row no longer matches the current script/voice (superseded), it
  // is closed as failed — the watchdog never starts a new paid generation.
  const resumeRowId = body?.resumeRowId ? String(body.resumeRowId) : null;
  if (resumeRowId && existing?.id !== resumeRowId) {
    await admin.from("long_form_narration_audio_versions").update({ status: "failed", last_error_code: "NARRATION_SUPERSEDED", last_error_at: new Date().toISOString() }).eq("id", resumeRowId).eq("status", "generating");
    return ok(req, { ok: true, narrationAudioVersionId: resumeRowId, status: "failed", superseded: true, alreadyGenerated: false });
  }

  if (existing?.status === "ready") {
    return ok(req, { ok: true, narrationAudioVersionId: existing.id, status: "ready", alreadyGenerated: true });
  }
  if (existing?.status === "generating" && existing.lease_until && new Date(existing.lease_until).getTime() > Date.now()) {
    return ok(req, { ok: true, narrationAudioVersionId: existing.id, status: "generating", alreadyGenerated: false });
  }
  // Phase 6a watchdog: a "generating" row whose lease expired was killed
  // mid-run (nothing wrote a result). Resume it ONCE from the saved state
  // (same row, same request); a second stall becomes a clear failure the
  // user can retry for free.
  const leaseMs = narrationLeaseMs(ttsInputText.length);
  const attempts = Number(existing?.provider_metadata?.attempts ?? 1);
  if (existing?.status === "generating" && !body?.retry && attempts >= NARRATION_MAX_ATTEMPTS) {
    await admin.from("long_form_narration_audio_versions").update({ status: "failed", last_error_code: "NARRATION_STALLED", last_error_at: new Date().toISOString() }).eq("id", existing.id);
    return ok(req, { ok: true, narrationAudioVersionId: existing.id, status: "failed", alreadyGenerated: false });
  }
  if (existing?.status === "alignment_failed") {
    // No new provider call needed — the caller should invoke
    // reconcile-long-form-narration-alignment instead, which is free and
    // instant. Told explicitly rather than silently retried here so the
    // caller's own UI can show the right state.
    return ok(req, { ok: true, narrationAudioVersionId: existing.id, status: "alignment_failed", alreadyGenerated: false, needsReconcile: true });
  }

  // Manual-regeneration allowance (Section 12) — only a genuinely NEW
  // synthesis attempt (not a poll of an in-progress/ready/alignment_failed
  // row, all handled above) ever consumes it, and only when explicitly
  // manual. The automatic first generation Lock Story triggers is never manual.
  if (manual) {
    if (project.manual_tts_regenerations_used >= project.included_manual_tts_regenerations) {
      return err(req, "You've used your included voice regeneration for this project. Regenerating again will cost additional credits.", 402, {
        includedRegenerationsUsed: project.manual_tts_regenerations_used, includedRegenerationsTotal: project.included_manual_tts_regenerations, requiresExtraCredits: true,
      });
    }
    await admin.from("long_form_projects").update({ manual_tts_regenerations_used: project.manual_tts_regenerations_used + 1 }).eq("id", projectId);
  }

  let rowId: string;
  if (existing?.status === "failed" || existing?.status === "generating") {
    // failed -> a free Retry (fresh attempt budget); generating with an expired lease -> the watchdog's one resume.
    const nextAttempts = existing.status === "failed" || body?.retry ? 1 : attempts + 1;
    await admin.from("long_form_narration_audio_versions").update({ status: "generating", lease_until: new Date(Date.now() + leaseMs).toISOString(), last_error_code: null, last_error_at: null, provider_metadata: { ...(existing.provider_metadata ?? {}), attempts: nextAttempts, phase: "tts", resumedAt: new Date().toISOString() } }).eq("id", existing.id);
    rowId = existing.id;
  } else {
    const { count } = await admin.from("long_form_narration_audio_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    const { data: inserted, error: insertError } = await admin.from("long_form_narration_audio_versions").insert({
      project_id: projectId, generation_profile_id: profile.id, script_version_id: scriptVersion.id, version: (count ?? 0) + 1,
      status: "generating", voice_provider: voiceSpec.provider, voice_id: voiceSpec.voiceId, voice_model: voiceSpec.voiceModel,
      voice_settings: voiceSpec.voiceSettings, language: voiceSpec.language,
      script_input_hash: scriptInputHash, request_hash: requestHash, lease_until: new Date(Date.now() + leaseMs).toISOString(), provider_metadata: { attempts: 1, phase: "tts", characterCount: ttsInputText.length },
    }).select("id").single();
    if (insertError) return err(req, "Could not start narration generation.", 500, { reason: insertError.message });
    rowId = inserted.id;
  }

  const settleAtNarration = !(SETTLE_AT_RENDER && profile.visual_recipe === "stickman_doodle_explainer");
  const work = doGeneration(admin, projectId, rowId, ttsInputText, segments, voiceSpec.voiceId, voiceSpec.voiceModel, effectiveVoiceSettings, settleAtNarration);
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(work); else await work;

  return ok(req, { ok: true, narrationAudioVersionId: rowId, status: "generating", alreadyGenerated: false });
});
