// deno-lint-ignore-file no-explicit-any
// blocky-worker — Blocky Stories job runner (service only; never called by
// the browser).
//
//   POST ?action=webhook&t=<hmac>   Runware task result (auth: HMAC of taskUUID)
//   POST {action:"kick", storyId?}  start queued jobs    (auth: x-blocky-worker-secret)
//   POST {action:"reconcile"}       cron, every minute   (auth: x-blocky-worker-secret)
//   POST {action:"final_done", callId, token, ok, …}  the Fly final-video machine's report (auth: HMAC of callId)
//   POST {action:"planner_test"}    blind test: run the planner with a chosen model, save nothing
//                                   but the logged calls (auth: service-role bearer)
//   POST {action:"raw_test"}        one test picture or clip on an allowed model, no user charge,
//                                   logged with its real cost (auth: service-role bearer)
//
// All logic lives in _shared/blocky/engine.js (tested offline); this file only
// wires Supabase, Runware and Storage. Blocky Stories is its own product:
// nothing here imports from, reads or writes AI Fruit Story's.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEngine } from "../_shared/blocky/engine.js";
import { createSupabaseMedia, createSupabaseStore } from "../_shared/blocky/supabaseStore.js";
import { getResponseTask, sameToken, webhookToken } from "../_shared/blocky/runware.js";
import { planOnly, planSeries, planStory, reviewStoredScript } from "../_shared/blocky/plannerService.js";
import { setupsFor } from "../_shared/blocky/series.js";
import { validateCreateStory } from "../_shared/blocky/validation.js";
import { BlockyError, MESSAGES } from "../_shared/blocky/errors.js";
import { FINAL_TIMEOUT_MIN, FINAL_USD_PER_SECOND, storyUpdateForReport } from "../_shared/blocky/final.js";
import { raiseProviderAlert } from "../_shared/blocky/alerts.js";
import { DRAWN_TEXT_PROBLEM, checkPicture } from "../_shared/blocky/pictureCheck.js";
import { checkAvatar } from "../_shared/blocky/avatarCheck.js";
import { FRAME_USD_PER_SECOND, checkClipFrame, checkClipWords, frameMachineConfig, framePath, speechFramesPath } from "../_shared/blocky/clipCheck.js";
import { buildClipRequest, fallbackClipTask } from "../_shared/blocky/clips.js";
import { buildPictureRequest, withRedrawHint } from "../_shared/blocky/pictures.js";
import { rewriteClipPrompt } from "../_shared/blocky/smallTasks.js";
import { buildEnvelope, parseRunware } from "../_shared/blocky/runware.js";
import { BLOCKY_MODELS, videoModel } from "../_shared/blocky/models.js";
import { readPaidState } from "../_shared/blocky/spendGuard.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
const RUNWARE_URL = `${(Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "")}/v1`;
const WORKER_SECRET = Deno.env.get("BLOCKY_WORKER_SECRET") ?? "";
// Paid calls: OFF unless the switch in the database is on and today's spend is under the daily cap (spendGuard.js).
// Read again at the start of every request, so the switch works at once; off until it has been read.
const ENV_PAID_CALLS = Deno.env.get("BLOCKY_PAID_CALLS") ?? "";
let PAID_OFF = true;
const paidOff = () => PAID_OFF;
const paidEnv = () => (PAID_OFF ? "off" : "");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
// Switches (all on unless set to "off"): the clip word check, the clip last-frame check, the automatic final build.
const off = (name: string) => (Deno.env.get(name) ?? "").toLowerCase() === "off";
const CLIP_CHECK_OFF = off("BLOCKY_CLIP_CHECK");
const CLIP_FRAME_OFF = off("BLOCKY_CLIP_FRAME_CHECK");
const AUTO_FINAL_OFF = off("BLOCKY_AUTO_FINAL");
// The frame machine runs on the final-video image (node + ffmpeg), on the same Fly app.
const FLY_API_TOKEN = Deno.env.get("FLY_API_TOKEN") ?? "";
const FLY_APP = Deno.env.get("FLY_RENDER_APP") ?? "zyvo-render";
const BLOCKY_FINAL_IMAGE = Deno.env.get("BLOCKY_FINAL_IMAGE") ?? `registry.fly.io/${FLY_APP}:blocky-final`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const ALERT_ENV = { RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") ?? "", ALERT_EMAIL: Deno.env.get("BLOCKY_ALERT_EMAIL") || Deno.env.get("CONTACT_TO_EMAIL") || "" };

async function runwarePost(tasks: unknown[]) {
  const res = await fetch(RUNWARE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${RUNWARE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(tasks),
    signal: AbortSignal.timeout(30_000),
  });
  return { httpStatus: res.status, body: await res.json().catch(() => null) };
}

const engine = createEngine({
  store: createSupabaseStore(admin),
  media: createSupabaseMedia(admin),
  runware: {
    submit: (envelope: unknown) => runwarePost([envelope]),
    poll: (taskUUID: string) => runwarePost([getResponseTask(taskUUID)]),
  },
  env: { get BLOCKY_PAID_CALLS() { return paidEnv(); }, webhookBase: `${SUPABASE_URL}/functions/v1/blocky-worker`, webhookSecret: WORKER_SECRET },
  // A clip that finally fails is re-sent on the next model of its tier (pricing.js). So is a clip the
  // video model drew its own subtitles into (straight to the next model, at our cost).
  fallbackClip: fallbackClipTask,
  drawnTextProblem: DRAWN_TEXT_PROBLEM,
  // Every scene picture: blocky avatars only, nobody extra up front, no brick-toy look, no text,
  // and the speaker chest-up (gpt-5-mini vision, logged; ours to pay).
  checkPicture: async (job: any, storedUrl: string) => {
    if (paidOff()) return null;
    const { expected, speaker } = await sceneCast(job.scene_id);
    if (!expected.length) return null;
    return checkPicture({
      admin, apiKey: OPENAI_API_KEY, imageUrl: storedUrl, expected, speaker,
      ids: { user_id: job.user_id, story_id: job.story_id, scene_id: job.scene_id, job_id: job.id },
    });
  },
  // The one automatic redraw is told what to fix.
  redrawRequest: (job: any, verdict: any) => {
    const prompt = withRedrawHint(job.request?.positivePrompt ?? "", verdict?.fixes ?? []);
    return prompt && prompt !== job.request?.positivePrompt ? { ...job.request, positivePrompt: prompt } : null;
  },
  // Every clip: did the voice say the line? (speech-to-text, logged; the final video reuses the transcript)
  checkClipWords: async (job: any, storedUrl: string) => {
    if (paidOff() || CLIP_CHECK_OFF || !OPENAI_API_KEY) return null;
    const { data: sc } = await admin.from("blocky_story_scenes").select("line, duration_sec").eq("id", job.scene_id).single();
    if (!sc?.line) return null;
    return checkClipWords({ admin, apiKey: OPENAI_API_KEY, userId: job.user_id, storyId: job.story_id, sceneId: job.scene_id, clipUrl: storedUrl, line: sc.line, durationSec: Number(sc.duration_sec) });
  },
  // Every clip: its last frame, grabbed by a small Fly machine (answers at clip_frame_done).
  requestClipFrame: async (job: any, storedUrl: string) => {
    if (paidOff() || CLIP_CHECK_OFF || CLIP_FRAME_OFF || !FLY_API_TOKEN || !OPENAI_API_KEY) return null;
    const path = framePath(job.user_id, job.story_id, job.id, job.attempt);
    const { data: signed, error } = await admin.storage.from("generated").createSignedUploadUrl(path, { upsert: true });
    if (error || !signed?.signedUrl) return null;
    // Two frames from the middle of the line too: subtitles the video model drew itself show there, not in the last frame.
    const speechPath = speechFramesPath(job.user_id, job.story_id, job.id, job.attempt);
    const { data: speechSigned } = await admin.storage.from("generated").createSignedUploadUrl(speechPath, { upsert: true });
    const durationSec = Number(job.request?.duration) || 0;
    const withSpeech = Boolean(speechSigned?.signedUrl) && durationSec > 0;
    const frameJob = {
      jobId: job.id, clipUrl: storedUrl, uploadUrl: signed.signedUrl, callbackUrl: `${SUPABASE_URL}/functions/v1/blocky-worker`, token: await webhookToken(WORKER_SECRET, `frame:${job.id}`),
      ...(withSpeech ? { speechUploadUrl: speechSigned!.signedUrl, durationSec } : {}),
    };
    const { data: call } = await admin.from("blocky_ai_calls").insert({
      user_id: job.user_id, story_id: job.story_id, scene_id: job.scene_id, job_id: job.id, provider: "fly", model: "shared-cpu-2x", purpose: "clip_frame",
      attempt: job.attempt, request: { clipUrl: storedUrl, path, ...(withSpeech ? { speechPath } : {}) },
    }).select("id").single();
    const res = await fetch(`https://api.machines.dev/v1/apps/${FLY_APP}/machines`, {
      method: "POST", headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(frameMachineConfig({ image: BLOCKY_FINAL_IMAGE, job: frameJob })), signal: AbortSignal.timeout(20_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any);
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error(`[blocky-worker] frame machine start failed ${res.status}:`, detail);
      if (call?.id) await admin.from("blocky_ai_calls").update({ ok: false, http_status: res.status, error: `machine start: ${detail}`, cost_usd: 0, completed_at: new Date().toISOString() }).eq("id", call.id);
      return null;
    }
    return { path, callId: call?.id ?? null, ...(withSpeech ? { speechPath } : {}) };
  },
  checkClipFrame: async (job: any, frame: any) => {
    const { expected } = await sceneCast(job.scene_id);
    const startedAt = new Date(frame.at).getTime();
    if (frame.callId) await admin.from("blocky_ai_calls").update({ ok: true, cost_usd: ((Date.now() - startedAt) / 1000) * FRAME_USD_PER_SECOND, latency_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }).eq("id", frame.callId);
    if (!expected.length) return null;
    return checkClipFrame({
      admin, apiKey: OPENAI_API_KEY, frameUrl: admin.storage.from("generated").getPublicUrl(frame.path).data.publicUrl, expected,
      speechUrl: frame.speechPath ? admin.storage.from("generated").getPublicUrl(frame.speechPath).data.publicUrl : null,
      // attempt: the final video trusts only the check of the clip's current attempt (final.js#scenesWithDrawnText)
      ids: { user_id: job.user_id, story_id: job.story_id, scene_id: job.scene_id, job_id: job.id, attempt: job.attempt },
    });
  },
  // The story's last clip is ready: build the final video without waiting for the button.
  onCompleted: async (job: any) => {
    if (job.kind !== "clip" || AUTO_FINAL_OFF) return;
    const { data: story } = await admin.from("blocky_stories").select("status, final_status").eq("id", job.story_id).maybeSingle();
    if (story?.status !== "clips_ready" || (story.final_status && story.final_status !== "none")) return;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/blocky-story-api`, {
      method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-blocky-worker-secret": WORKER_SECRET },
      body: JSON.stringify({ action: "autoFinal", storyId: job.story_id }), signal: AbortSignal.timeout(60_000),
    });
    const out = await res.json().catch(() => null);
    if (!out?.data?.started) console.log(`[blocky-worker] auto final not started for ${job.story_id}: ${out?.data?.reason ?? out?.code ?? res.status}`);
  },
  // Runware refused because our balance is out: the job is already refunded; alert the admin.
  onProviderBalance: ({ job, code, message }: any) => raiseProviderAlert(admin, ALERT_ENV, {
    provider: "runware", code, message, context: { jobId: job.id, storyId: job.story_id, kind: job.kind, model: job.request?.model },
  }),
  // One content-policy rewrite per clip (gpt-5-mini), keeping the exact line.
  rewriteClip: async (job: any) => {
    if (paidOff()) return null;
    const { data: scene } = await admin.from("blocky_story_scenes").select("line").eq("id", job.scene_id).single();
    if (!scene) return null;
    const prompt = await rewriteClipPrompt({
      admin, env: { OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") ?? "", ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") ?? "" },
      userId: job.user_id, storyId: job.story_id, sceneId: job.scene_id, jobId: job.id, prompt: job.request.positivePrompt, line: scene.line,
    });
    return prompt ? { ...job.request, positivePrompt: prompt } : null;
  },
});


/** Who should be in a scene's picture ({name, look}, in frame order) and who speaks. */
async function sceneCast(sceneId: string) {
  const { data: sc } = await admin.from("blocky_story_scenes").select("present_ids, speaker_id").eq("id", sceneId).single();
  const { data: chars } = await admin.from("blocky_characters").select("id, name, look").in("id", sc?.present_ids ?? []);
  const byId = new Map((chars ?? []).map((c: any) => [c.id, c]));
  const expected = (sc?.present_ids ?? []).map((id: string) => byId.get(id)).filter(Boolean).map((c: any) => ({ name: c.name, look: c.look }));
  return { expected, speaker: (byId.get(sc?.speaker_id) as any)?.name ?? null };
}

/**
 * Admin test: ONE clip for a scene at a chosen tier/length, charged through the
 * normal blocky_charge_step path. A tier above the user's plan works only with
 * an admin row in blocky_test_overrides (single use, auto-expiring).
 */
async function clipTest(body: any) {
  if (paidOff()) throw new BlockyError("PAID_CALLS_DISABLED", "paid calls are off");
  const { data: sc, error } = await admin.from("blocky_story_scenes").select("*").eq("id", body?.sceneId).single();
  if (error || !sc) throw new BlockyError("NOT_FOUND", "scene");
  const { data: story } = await admin.from("blocky_stories").select("*").eq("id", sc.story_id).single();
  const { data: rows } = await admin.from("blocky_characters").select("*");
  const lib = new Map((rows ?? []).map((c: any) => [c.id, c]));
  const quality = body?.quality ?? story.quality;
  const built = buildClipRequest({
    story: { aspect: story.aspect, quality: story.quality }, library: lib, quality, durationSec: body?.durationSec,
    scene: { speakerId: sc.speaker_id, presentIds: sc.present_ids, line: sc.line, emotion: sc.emotion, action: sc.action, shot: sc.shot, placement: sc.placement, imageUrl: sc.image_url },
  });
  const { data, error: e2 } = await admin.rpc("blocky_charge_step", {
    p_user_id: story.user_id, p_story_id: story.id, p_step: "reclip", p_from_statuses: ["pictures_ready", "animating", "clips_ready", "final_ready"], p_to_status: "animating",
    p_items: [{ scene_id: sc.id, kind: "clip", tool_key: videoModel(quality).toolKey, price_input: built.priceInput, request: built.request, prompt: built.prompt }],
  });
  if (e2) throw new BlockyError("CHARGE_FAILED", e2.message);
  await engine.kick({ storyId: story.id });
  return data;
}

/**
 * Test runs: one picture or clip sent straight to Runware (no user charge),
 * every call logged with its real cost. Only these models: the three clip
 * tiers (pricing.js) and the two
 * picture models (Nano Banana 2 Lite, Nano Banana Pro). Service role only.
 * Poll with raw_poll ({kind: "image"} for a picture).
 */
const TEST_MODELS: Record<string, Set<string>> = {
  // The clip models in use (pricing.js) and the two they replaced on 2026-10-08, for test clips.
  videoInference: new Set(["alibaba:wan@2.6-flash", "bytedance:seedance@2.0-mini", "google:3@3", "xai:grok-imagine@video-1.5-lite", "prunaai:p-video@2", "google:veo@3.1-lite"]),
  // Nano Banana 2 Lite and Pro, and FLUX.2 [klein] 9B (and its KV variant): the avatar-library test of 2026-10-08.
  imageInference: new Set(["google:nano-banana@2-lite", "google:4@2", "runware:400@2", "runware:400@6"]),
};
async function rawTest(body: any) {
  if (paidOff()) throw new BlockyError("PAID_CALLS_DISABLED", "paid calls are off");
  const task = body?.task;
  if (!task || !TEST_MODELS[task.taskType]?.has(task.model)) throw new BlockyError("VALIDATION", "model not allowed");
  const taskUUID = crypto.randomUUID();
  const envelope = buildEnvelope(task, { taskUUID, webhookURL: null });
  const { data: call } = await admin.from("blocky_ai_calls").insert({
    user_id: body.userId ?? null, story_id: body.storyId ?? null, scene_id: body.sceneId ?? null,
    provider: "runware", model: task.model, purpose: `test:${body.label ?? task.model}`, request: envelope,
  }).select("id").single();
  const res = await runwarePost([envelope]);
  const parsed = parseRunware(res.body, taskUUID, res.httpStatus);
  if (parsed.state === "error") {
    await admin.from("blocky_ai_calls").update({ ok: false, http_status: res.httpStatus, response: res.body, error: `${parsed.code}: ${parsed.message}`, cost_usd: parsed.cost ?? 0, completed_at: new Date().toISOString() }).eq("id", call.id);
    return { ok: false, taskUUID, callId: call.id, error: `${parsed.code}: ${parsed.message}` };
  }
  return { ok: true, taskUUID, callId: call.id };
}
/**
 * Admin framing check: one scene picture with TODAY's builder (mode "new"),
 * sent straight to Runware (no user charge, story untouched), logged with its
 * real cost. Poll with raw_poll {kind: "image"}.
 */
async function pictureTest(body: any) {
  if (paidOff()) throw new BlockyError("PAID_CALLS_DISABLED", "paid calls are off");
  const { data: sc } = await admin.from("blocky_story_scenes").select("*").eq("id", body?.sceneId).single();
  if (!sc) throw new BlockyError("NOT_FOUND", "scene");
  const { data: story } = await admin.from("blocky_stories").select("*").eq("id", sc.story_id).single();
  const { data: rows } = await admin.from("blocky_characters").select("*");
  // refOverrides {avatarId: url}: the scene with other reference pictures for those avatars (the library test).
  const refs = body?.refOverrides && typeof body.refOverrides === "object" ? body.refOverrides : {};
  const built = buildPictureRequest({
    story: { aspect: story.aspect, locations: story.locations }, library: new Map((rows ?? []).map((c: any) => [c.id, typeof refs[c.id] === "string" && /^https:///.test(refs[c.id]) ? { ...c, ref_image_url: refs[c.id] } : c])), mode: "new",
    scene: { speakerId: sc.speaker_id, presentIds: sc.present_ids, action: sc.action, emotion: sc.emotion, shot: sc.shot, placement: sc.placement, locationId: sc.location_id },
  });
  const taskUUID = crypto.randomUUID();
  const envelope = buildEnvelope(built.request, { taskUUID, webhookURL: null });
  const { data: call } = await admin.from("blocky_ai_calls").insert({
    user_id: story.user_id, story_id: story.id, scene_id: sc.id, provider: "runware", model: built.request.model, purpose: "framing_check", request: envelope,
  }).select("id").single();
  const res = await runwarePost([envelope]);
  const parsed = parseRunware(res.body, taskUUID, res.httpStatus);
  if (parsed.state === "error") {
    await admin.from("blocky_ai_calls").update({ ok: false, http_status: res.httpStatus, response: res.body, error: `${parsed.code}: ${parsed.message}`, cost_usd: parsed.cost ?? 0, completed_at: new Date().toISOString() }).eq("id", call.id);
    return { ok: false, taskUUID, callId: call.id, error: `${parsed.code}: ${parsed.message}` };
  }
  return { ok: true, taskUUID, callId: call.id, prompt: built.request.positivePrompt, shot: sc.shot };
}

/**
 * Admin test: grab the last frame of any stored clip on a frame machine, with
 * nothing attached to a job. Proves the machine, the script, the upload and
 * the callback. The frame lands at the returned url a few seconds later.
 */
async function frameTest(body: any) {
  if (paidOff()) throw new BlockyError("PAID_CALLS_DISABLED", "paid calls are off");
  if (!FLY_API_TOKEN) throw new BlockyError("VALIDATION", "FLY_API_TOKEN not set");
  if (typeof body?.clipUrl !== "string" || !body.clipUrl.startsWith(`${SUPABASE_URL}/storage/`)) throw new BlockyError("VALIDATION", "clipUrl must be a stored clip");
  const id = crypto.randomUUID();
  const jobId = `test-${id}`;
  const path = `blocky/tests/frames/${id}.jpg`;
  const { data: signed, error } = await admin.storage.from("generated").createSignedUploadUrl(path, { upsert: true });
  if (error || !signed?.signedUrl) throw new BlockyError("SERVER_FAILED", "signed upload");
  const frameJob = { jobId, clipUrl: body.clipUrl, uploadUrl: signed.signedUrl, callbackUrl: `${SUPABASE_URL}/functions/v1/blocky-worker`, token: await webhookToken(WORKER_SECRET, `frame:${jobId}`) };
  const t0 = Date.now();
  const res = await fetch(`https://api.machines.dev/v1/apps/${FLY_APP}/machines`, {
    method: "POST", headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(frameMachineConfig({ image: BLOCKY_FINAL_IMAGE, job: frameJob })), signal: AbortSignal.timeout(20_000),
  });
  const machine = await res.json().catch(() => null);
  return { started: res.ok, status: res.status, ms: Date.now() - t0, jobId, url: admin.storage.from("generated").getPublicUrl(path).data.publicUrl, machineId: machine?.id ?? null, error: res.ok ? null : JSON.stringify(machine).slice(0, 300) };
}

/**
 * Admin test: the avatar-reference check on one picture (avatarCheck.js). No user charge; logged with its cost.
 * body: {imageUrl, avatar: {name, head, torso, legs, accessory, face}} (scripts/blocky/roster.mjs)
 */
async function avatarCheckTest(body: any) {
  if (paidOff()) throw new BlockyError("PAID_CALLS_DISABLED", "paid calls are off");
  const a = body?.avatar;
  if (typeof body?.imageUrl !== "string" || !/^https:///.test(body.imageUrl) || !a?.name || !a?.head || !a?.torso || !a?.legs || !a?.face) throw new BlockyError("VALIDATION", "imageUrl and avatar are needed");
  return await checkAvatar({ admin, apiKey: OPENAI_API_KEY, imageUrl: body.imageUrl, avatar: { name: String(a.name), head: String(a.head), torso: String(a.torso), legs: String(a.legs), accessory: a.accessory ? String(a.accessory) : null, face: String(a.face) } });
}

async function rawPoll(body: any) {
  const res = await runwarePost([getResponseTask(body.taskUUID)]);
  const parsed = parseRunware(res.body, body.taskUUID, res.httpStatus);
  if (parsed.state === "success") {
    const image = body?.kind === "image";
    const url = await createSupabaseMedia(admin).store({ url: parsed.url, path: `blocky/tests/${body.taskUUID}.${image ? "jpg" : "mp4"}`, contentType: image ? "image/jpeg" : "video/mp4" });
    await admin.from("blocky_ai_calls").update({ ok: true, http_status: res.httpStatus, response: res.body, cost_usd: parsed.cost, completed_at: new Date().toISOString() }).eq("id", body.callId);
    return { state: "success", url, cost: parsed.cost };
  }
  if (parsed.state === "error") {
    await admin.from("blocky_ai_calls").update({ ok: false, http_status: res.httpStatus, response: res.body, error: `${parsed.code}: ${parsed.message}`, cost_usd: parsed.cost ?? 0, completed_at: new Date().toISOString() }).eq("id", body.callId);
    return { state: "error", error: `${parsed.code}: ${parsed.message}`, cost: parsed.cost ?? 0 };
  }
  return { state: "pending" };
}

/** Blind test: same validation + planner as createStory, model chosen by the caller, nothing saved but the call log. */
async function plannerTest(body: any) {
  const { data: rows, error } = await admin.from("blocky_characters").select("*").eq("active", true);
  if (error) throw new Error(error.message);
  const lib = new Map(rows.map((c: any) => [c.id, c]));
  // body.idea: the idea to write from ({id, title, summary, cast_ids}); the idea engine has no table yet.
  const idea = body?.input?.source === "idea" && body?.idea?.id === body.input.ideaId ? body.idea : null;
  const input = validateCreateStory(body?.input, lib, (id: string) => (idea && idea.id === id ? { castIds: idea.cast_ids } : null));
  const model = body?.model;
  if (!model?.provider || !model?.model) throw new BlockyError("VALIDATION", "model required");
  const out = await planStory({
    admin, userId: typeof body?.userId === "string" ? body.userId : null, model, purposePrefix: "blind_test:",
    env: { ...TEST_ENV(), ...(body?.review === false ? { BLOCKY_SCRIPT_REVIEW: "off" } : {}) },
    plannerInput: {
      source: input.source, cast: input.castIds.map((id: string) => lib.get(id)), lengthSec: input.lengthSec, quality: input.quality,
      idea: idea ? { title: idea.title, summary: idea.summary } : undefined, prompt: input.prompt, script: input.script,
      // as if this were the user's next story after one that used these twist patterns
      avoidPatterns: Array.isArray(body?.avoidPatterns) ? body.avoidPatterns.filter((x: unknown) => typeof x === "string").slice(0, 3) : [],
      avoidOpeners: Array.isArray(body?.avoidOpeners) ? body.avoidOpeners.filter((x: unknown) => typeof x === "string").slice(0, 5) : [],
    },
  });
  return out;
}

/**
 * Admin test: the plan step alone (three plans and the judge), no script.
 * body: {input: as planner_test, effort?: "low"|"medium"|"high", rawPlans?: a plan step's answer to judge again,
 *        avoidPatterns?, avoidOpeners?}
 */
async function planTest(body: any) {
  const { data: rows, error } = await admin.from("blocky_characters").select("*").eq("active", true);
  if (error) throw new Error(error.message);
  const lib = new Map(rows.map((c: any) => [c.id, c]));
  const input = validateCreateStory(body?.input, lib, () => null);
  const effort = ["low", "medium", "high"].includes(body?.effort) ? body.effort : null;
  return planOnly({
    admin, userId: null, env: TEST_ENV(),
    plannerInput: {
      source: input.source, cast: input.castIds.map((id: string) => lib.get(id)), lengthSec: input.lengthSec, quality: input.quality, prompt: input.prompt,
      avoidPatterns: Array.isArray(body?.avoidPatterns) ? body.avoidPatterns.filter((x: unknown) => typeof x === "string").slice(0, 3) : [],
      avoidOpeners: Array.isArray(body?.avoidOpeners) ? body.avoidOpeners.filter((x: unknown) => typeof x === "string").slice(0, 5) : [],
      ...(effort ? { planModel: { ...BLOCKY_MODELS.twistPlan, effort } } : {}),
      ...(body?.rawPlans && typeof body.rawPlans === "object" ? { rawPlans: body.rawPlans } : {}),
    },
  });
}

const TEST_ENV = () => ({ ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") ?? "", OPENAI_API_KEY, BLOCKY_PAID_CALLS: paidEnv() });

/**
 * Admin test: plan a series and write its first episode with today's planners.
 * Nothing is saved but the logged calls. body: {userId?, input: {concept, castIds, opener, tone, episodeCount}, lengthSec, quality}
 */
async function seriesTest(body: any) {
  const { data: rows, error } = await admin.from("blocky_characters").select("*").eq("active", true);
  if (error) throw new Error(error.message);
  const lib = new Map(rows.map((c: any) => [c.id, c]));
  const input = body?.input ?? {};
  const cast = (input.castIds ?? []).map((id: string) => lib.get(id)).filter(Boolean);
  if (cast.length < 2) throw new BlockyError("VALIDATION", "castIds required");
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const s = await planSeries({ admin, env: TEST_ENV(), userId, seriesId: null, input: { concept: input.concept, cast, opener: input.opener ?? "", tone: input.tone ?? "", episodeCount: Number(input.episodeCount) || 3 } });
  const o = s.outline;
  const ep = o.episodes[0];
  const story = await planStory({
    admin, userId, purposePrefix: "blind_test:", env: TEST_ENV(),
    plannerInput: {
      source: "episode", cast, lengthSec: Number(body?.lengthSec) || 20, quality: body?.quality ?? "v2",
      series: { title: o.title, logline: o.logline, bible: o.bible, previous: [], episode: ep, locations: o.locations, characters: o.characters, setups: setupsFor(o.setups, 1), lastEnd: null },
    },
  });
  return { outline: o, seriesCostUsd: s.costUsd, plan: story.plan, review: story.review, attempts: story.attempts, costUsd: story.costUsd };
}

/**
 * Admin test: what today's script editor says about a story that already exists.
 * Reads the story, changes nothing, logs the one call. body: {storyId}
 */
async function reviewTest(body: any) {
  const { data: story } = await admin.from("blocky_stories").select("*").eq("id", body?.storyId).maybeSingle();
  if (!story) throw new BlockyError("NOT_FOUND", "story");
  const { data: scenes } = await admin.from("blocky_story_scenes").select("idx, speaker_id, line, present_ids, location_id").eq("story_id", story.id).order("idx");
  const { data: rows } = await admin.from("blocky_characters").select("*").in("id", story.cast_ids);
  let series = null;
  if (story.series_id) {
    const { data: ep } = await admin.from("blocky_series_episodes").select("number, title, summary, cliffhanger").eq("series_id", story.series_id).eq("number", story.episode_number).maybeSingle();
    series = { episode: ep };
  }
  const plan = {
    title: story.title, roles: story.cast_roles ?? {}, locations: story.locations ?? [],
    scenes: (scenes ?? []).map((s: any) => ({ speakerId: s.speaker_id, line: s.line, presentIds: s.present_ids, locationId: s.location_id })),
  };
  return reviewStoredScript({ admin, env: TEST_ENV(), userId: null, plan, cast: rows ?? [], source: story.series_id ? "episode" : "idea", series });
}

/**
 * The Fly machine's report for a final build. Only the build in flight
 * (blocky_stories.final_call_id) may change the story; a late report from an
 * older build is logged and ignored. Free either way: nothing to refund.
 */
async function finalDone(callId: string, report: any) {
  const { data: call } = await admin.from("blocky_ai_calls").select("id, story_id, request, created_at, completed_at").eq("id", callId).eq("purpose", "final").maybeSingle();
  if (!call) return { applied: false, reason: "unknown build" };
  if (!call.completed_at) {
    await admin.from("blocky_ai_calls").update({
      ok: Boolean(report?.ok), error: report?.ok ? null : String(report?.error ?? "failed").slice(0, 500),
      response: { ...(call.request?.path ? { path: call.request.path } : {}), durationSec: report?.durationSec ?? null, trimmedSec: report?.trimmedSec ?? null, trimmedPerClip: report?.trimmedPerClip ?? null, captionSources: report?.captionSources ?? null, sizeBytes: report?.sizeBytes ?? null, seconds: report?.seconds ?? null },
      // Billed machine time includes boot + image pull, so charge the wall clock since start when it's longer.
      cost_usd: Math.max(Number(report?.costUsd) || 0, ((Date.now() - new Date(call.created_at).getTime()) / 1000) * FINAL_USD_PER_SECOND),
      latency_ms: Date.now() - new Date(call.created_at).getTime(), completed_at: new Date().toISOString(),
    }).eq("id", callId);
  }
  const publicUrl = report?.ok ? admin.storage.from("generated").getPublicUrl(call.request.path).data.publicUrl : null;
  const coverUrl = report?.ok && report?.cover && call.request?.coverPath ? admin.storage.from("generated").getPublicUrl(call.request.coverPath).data.publicUrl : null;
  const { data: moved } = await admin.from("blocky_stories")
    .update(storyUpdateForReport(report, publicUrl, MESSAGES.FINAL_FAILED, coverUrl))
    .eq("id", call.story_id).eq("final_call_id", callId).eq("status", "building").select("id");
  return { applied: Boolean(moved?.length) };
}

/** Builds that never reported (machine died) fail after FINAL_TIMEOUT_MIN; the user retries for free. */
async function failStaleFinals() {
  const cutoff = new Date(Date.now() - FINAL_TIMEOUT_MIN * 60_000).toISOString();
  const { data: stale } = await admin.from("blocky_stories").select("id, final_call_id").eq("status", "building").lt("final_requested_at", cutoff);
  for (const s of stale ?? []) {
    await admin.from("blocky_stories").update(storyUpdateForReport({ ok: false }, null, MESSAGES.FINAL_FAILED)).eq("id", s.id).eq("status", "building");
    if (s.final_call_id) await admin.from("blocky_ai_calls").update({ ok: false, error: "timed out", completed_at: new Date().toISOString() }).eq("id", s.final_call_id).is("completed_at", null);
  }
  return stale?.length ?? 0;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function background(p: Promise<unknown>) {
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = p.catch((e) => console.error("[blocky-worker] background failed:", e?.message ?? e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

function taskUUIDOf(body: any): string | null {
  const first = Array.isArray(body?.data) ? body.data[0] : Array.isArray(body?.errors) ? body.errors[0] : body;
  return typeof first?.taskUUID === "string" ? first.taskUUID : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!WORKER_SECRET) return json({ ok: false, error: "BLOCKY_WORKER_SECRET not configured" }, 500);
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const action = url.searchParams.get("action") ?? body?.action;
  // The switch and the cap, fresh for this request. A result that is already paid for is still stored when they are off.
  PAID_OFF = !(await readPaidState(admin, ENV_PAID_CALLS)).on;

  if (action === "webhook") {
    const taskUUID = taskUUIDOf(body);
    const token = url.searchParams.get("t") ?? "";
    if (!taskUUID || !sameToken(token, await webhookToken(WORKER_SECRET, taskUUID))) return json({ ok: false }, 401);
    // Runware wants a reply within ~5 s: record in the background.
    background(engine.onResult(taskUUID, body));
    return json({ ok: true });
  }

  if (action === "clip_frame_done") {
    const jobId = typeof body?.jobId === "string" ? body.jobId : "";
    if (!jobId || !sameToken(String(body?.token ?? ""), await webhookToken(WORKER_SECRET, `frame:${jobId}`))) return json({ ok: false }, 401);
    if (jobId.startsWith("test-")) {   // frame_test: nothing to finish
      console.log(`[blocky-worker] frame test ${jobId}: ${body?.ok ? "ok" : `failed: ${body?.error}`}`);
      return json({ ok: true });
    }
    // The picture check takes a few seconds: answer the machine now, finish in the background.
    background(engine.onClipFrame(jobId, Boolean(body?.ok)));
    return json({ ok: true });
  }

  if (action === "final_done") {
    const callId = typeof body?.callId === "string" ? body.callId : "";
    if (!callId || !sameToken(String(body?.token ?? ""), await webhookToken(WORKER_SECRET, `final:${callId}`))) return json({ ok: false }, 401);
    try {
      return json({ ok: true, ...(await finalDone(callId, body)) });
    } catch (e) {
      console.error("[blocky-worker] final_done failed:", (e as Error)?.message ?? e);
      return json({ ok: false, error: "worker failed" }, 500);
    }
  }

  if (["clip_test", "raw_test", "raw_poll", "picture_test", "frame_test", "avatar_check_test"].includes(action)) {
    if (!sameToken((req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""), SERVICE_KEY)) return json({ ok: false }, 401);
    try {
      const fn = action === "clip_test" ? clipTest : action === "raw_test" ? rawTest : action === "picture_test" ? pictureTest : action === "frame_test" ? frameTest : action === "avatar_check_test" ? avatarCheckTest : rawPoll;
      return json({ ok: true, ...(await fn(body)) });
    } catch (e) {
      const fe = e as any;
      return json({ ok: false, code: fe?.code ?? "SERVER_FAILED", message: fe?.message ?? String(e) }, 200);
    }
  }

  if (action === "planner_test" || action === "series_test" || action === "review_test" || action === "plan_test") {
    if (!sameToken((req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""), SERVICE_KEY)) return json({ ok: false }, 401);
    try {
      const fn = action === "series_test" ? seriesTest : action === "review_test" ? reviewTest : action === "plan_test" ? planTest : plannerTest;
      return json({ ok: true, ...(await fn(body)) });
    } catch (e) {
      const fe = e as any;
      return json({ ok: false, code: fe?.code ?? "SERVER_FAILED", message: fe?.message, details: fe?.details ?? null, costUsd: fe?.costUsd ?? 0 }, 200);
    }
  }

  if (!sameToken(req.headers.get("x-blocky-worker-secret") ?? "", WORKER_SECRET)) return json({ ok: false }, 401);
  try {
    if (action === "kick") return json({ ok: true, ...(await engine.kick({ storyId: typeof body?.storyId === "string" ? body.storyId : null })) });
    if (action === "reconcile") return json({ ok: true, ...(await engine.reconcile()), finalsTimedOut: await failStaleFinals() });
    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    console.error(`[blocky-worker] ${action} failed:`, (e as Error)?.message ?? e);
    return json({ ok: false, error: "worker failed" }, 500);
  }
});
