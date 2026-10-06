// deno-lint-ignore-file no-explicit-any
// fruit-worker — AI Fruit Story v2 job runner (service only; never called by
// the browser).
//
//   POST ?action=webhook&t=<hmac>   Runware task result (auth: HMAC of taskUUID)
//   POST {action:"kick", storyId?}  start queued jobs    (auth: x-fruit-worker-secret)
//   POST {action:"reconcile"}       cron, every minute   (auth: x-fruit-worker-secret)
//   POST {action:"final_done", callId, token, ok, …}  the Fly final-video machine's report (auth: HMAC of callId)
//   POST {action:"planner_test"}    blind test: run the planner with a chosen model, save nothing
//                                   but the logged calls (auth: service-role bearer)
//
// All logic lives in _shared/fruit/engine.js (tested offline); this file only
// wires Supabase, Runware and Storage.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEngine } from "../_shared/fruit/engine.js";
import { createSupabaseMedia, createSupabaseStore } from "../_shared/fruit/supabaseStore.js";
import { getResponseTask, sameToken, webhookToken } from "../_shared/fruit/runware.js";
import { planSeries, planStory, reviewStoredScript } from "../_shared/fruit/plannerService.js";
import { setupsFor } from "../_shared/fruit/series.js";
import { validateCreateStory } from "../_shared/fruit/validation.js";
import { FruitError, MESSAGES } from "../_shared/fruit/errors.js";
import { FINAL_TIMEOUT_MIN, FINAL_USD_PER_SECOND, storyUpdateForReport } from "../_shared/fruit/final.js";
import { raiseProviderAlert } from "../_shared/fruit/alerts.js";
import { checkPicture } from "../_shared/fruit/pictureCheck.js";
import { FRAME_USD_PER_SECOND, checkClipFrame, checkClipWords, frameMachineConfig, framePath } from "../_shared/fruit/clipCheck.js";
import { buildClipRequest, fallbackClipTask } from "../_shared/fruit/clips.js";
import { buildPictureRequest, withRedrawHint } from "../_shared/fruit/pictures.js";
import { DEFAULT_NICHE, hasHooks, nicheOf } from "../_shared/fruit/niches/index.js";
import { rewriteClipPrompt } from "../_shared/fruit/smallTasks.js";
import { buildEnvelope, parseRunware } from "../_shared/fruit/runware.js";
import { videoModel } from "../_shared/fruit/models.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
const RUNWARE_URL = `${(Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "")}/v1`;
const WORKER_SECRET = Deno.env.get("FRUIT_WORKER_SECRET") ?? "";
const PAID_CALLS = Deno.env.get("FRUIT_PAID_CALLS") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
// Switches (all on unless set to "off"): the clip word check, the clip last-frame check, the automatic final build.
const off = (name: string) => (Deno.env.get(name) ?? "").toLowerCase() === "off";
const CLIP_CHECK_OFF = off("FRUIT_CLIP_CHECK");
const CLIP_FRAME_OFF = off("FRUIT_CLIP_FRAME_CHECK");
const AUTO_FINAL_OFF = off("FRUIT_AUTO_FINAL");
// The frame machine runs on the final-video image (node + ffmpeg), on the same Fly app.
const FLY_API_TOKEN = Deno.env.get("FLY_API_TOKEN") ?? "";
const FLY_APP = Deno.env.get("FLY_RENDER_APP") ?? "zyvo-render";
const FRUIT_FINAL_IMAGE = Deno.env.get("FRUIT_FINAL_IMAGE") ?? `registry.fly.io/${FLY_APP}:fruit-final`;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const ALERT_ENV = { RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") ?? "", ALERT_EMAIL: Deno.env.get("FRUIT_ALERT_EMAIL") || Deno.env.get("CONTACT_TO_EMAIL") || "" };

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
  env: { FRUIT_PAID_CALLS: PAID_CALLS, webhookBase: `${SUPABASE_URL}/functions/v1/fruit-worker`, webhookSecret: WORKER_SECRET },
  // A clip that finally fails on Wan2.6 Flash is re-sent once on Seedance 2.0 Mini.
  fallbackClip: fallbackClipTask,
  // Every scene picture: fruit heads, nobody extra up front, no hair or writing, and the
  // speaker chest-up (gpt-5-mini vision, logged; ours to pay).
  checkPicture: async (job: any, storedUrl: string) => {
    if (paidOff()) return null;
    const { expected, speaker, niche } = await sceneCast(job.scene_id);
    if (!expected.length || !checkable(niche)) return null;
    return checkPicture({
      admin, apiKey: OPENAI_API_KEY, imageUrl: storedUrl, expected, speaker, niche,
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
    const { data: sc } = await admin.from("fruit_story_scenes").select("line, duration_sec").eq("id", job.scene_id).single();
    if (!sc?.line) return null;
    return checkClipWords({ admin, apiKey: OPENAI_API_KEY, userId: job.user_id, storyId: job.story_id, sceneId: job.scene_id, clipUrl: storedUrl, line: sc.line, durationSec: Number(sc.duration_sec) });
  },
  // Every clip: its last frame, grabbed by a small Fly machine (answers at clip_frame_done).
  requestClipFrame: async (job: any, storedUrl: string) => {
    if (paidOff() || CLIP_CHECK_OFF || CLIP_FRAME_OFF || !FLY_API_TOKEN || !OPENAI_API_KEY) return null;
    const path = framePath(job.user_id, job.story_id, job.id, job.attempt);
    const { data: signed, error } = await admin.storage.from("generated").createSignedUploadUrl(path, { upsert: true });
    if (error || !signed?.signedUrl) return null;
    const frameJob = { jobId: job.id, clipUrl: storedUrl, uploadUrl: signed.signedUrl, callbackUrl: `${SUPABASE_URL}/functions/v1/fruit-worker`, token: await webhookToken(WORKER_SECRET, `frame:${job.id}`) };
    const { data: call } = await admin.from("fruit_ai_calls").insert({
      user_id: job.user_id, story_id: job.story_id, scene_id: job.scene_id, job_id: job.id, provider: "fly", model: "shared-cpu-2x", purpose: "clip_frame",
      attempt: job.attempt, request: { clipUrl: storedUrl, path },
    }).select("id").single();
    const res = await fetch(`https://api.machines.dev/v1/apps/${FLY_APP}/machines`, {
      method: "POST", headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(frameMachineConfig({ image: FRUIT_FINAL_IMAGE, job: frameJob })), signal: AbortSignal.timeout(20_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any);
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error(`[fruit-worker] frame machine start failed ${res.status}:`, detail);
      if (call?.id) await admin.from("fruit_ai_calls").update({ ok: false, http_status: res.status, error: `machine start: ${detail}`, cost_usd: 0, completed_at: new Date().toISOString() }).eq("id", call.id);
      return null;
    }
    return { path, callId: call?.id ?? null };
  },
  checkClipFrame: async (job: any, frame: any) => {
    const { expected, niche } = await sceneCast(job.scene_id);
    const startedAt = new Date(frame.at).getTime();
    if (frame.callId) await admin.from("fruit_ai_calls").update({ ok: true, cost_usd: ((Date.now() - startedAt) / 1000) * FRAME_USD_PER_SECOND, latency_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }).eq("id", frame.callId);
    if (!expected.length || !checkable(niche)) return null;
    return checkClipFrame({
      admin, apiKey: OPENAI_API_KEY, frameUrl: admin.storage.from("generated").getPublicUrl(frame.path).data.publicUrl, expected, niche,
      ids: { user_id: job.user_id, story_id: job.story_id, scene_id: job.scene_id, job_id: job.id },
    });
  },
  // The story's last clip is ready: build the final video without waiting for the button.
  onCompleted: async (job: any) => {
    if (job.kind !== "clip" || AUTO_FINAL_OFF) return;
    const { data: story } = await admin.from("fruit_stories").select("status, final_status").eq("id", job.story_id).maybeSingle();
    if (story?.status !== "clips_ready" || (story.final_status && story.final_status !== "none")) return;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/fruit-story-api`, {
      method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-fruit-worker-secret": WORKER_SECRET },
      body: JSON.stringify({ action: "autoFinal", storyId: job.story_id }), signal: AbortSignal.timeout(60_000),
    });
    const out = await res.json().catch(() => null);
    if (!out?.data?.started) console.log(`[fruit-worker] auto final not started for ${job.story_id}: ${out?.data?.reason ?? out?.code ?? res.status}`);
  },
  // Runware refused because our balance is out: the job is already refunded; alert the admin.
  onProviderBalance: ({ job, code, message }: any) => raiseProviderAlert(admin, ALERT_ENV, {
    provider: "runware", code, message, context: { jobId: job.id, storyId: job.story_id, kind: job.kind, model: job.request?.model },
  }),
  // One content-policy rewrite per clip (gpt-5-mini), keeping the exact line.
  rewriteClip: async (job: any) => {
    const { data: scene } = await admin.from("fruit_story_scenes").select("line").eq("id", job.scene_id).single();
    if (!scene) return null;
    const prompt = await rewriteClipPrompt({
      admin, env: { OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") ?? "", ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") ?? "" },
      userId: job.user_id, storyId: job.story_id, sceneId: job.scene_id, jobId: job.id, prompt: job.request.positivePrompt, line: scene.line,
    });
    return prompt ? { ...job.request, positivePrompt: prompt } : null;
  },
});

const paidOff = () => PAID_CALLS.toLowerCase() === "off";

/** A template's pictures are checked with its own rules (niches/); one that has none yet is not checked with Fruit's. */
const checkable = (niche: string) => nicheOf(niche).id === DEFAULT_NICHE || hasHooks(niche, "check");

/** Who should be in a scene's picture ({name, fruit}, in frame order), who speaks, and the story's template. */
async function sceneCast(sceneId: string) {
  const { data: sc } = await admin.from("fruit_story_scenes").select("present_ids, speaker_id, story_id").eq("id", sceneId).single();
  // Its own query: a story without a niche (or a database from before the column) is fruit.
  const { data: st } = sc?.story_id ? await admin.from("fruit_stories").select("niche").eq("id", sc.story_id).maybeSingle() : { data: null };
  const { data: chars } = await admin.from("fruit_characters").select("id, name, fruit").in("id", sc?.present_ids ?? []);
  const byId = new Map((chars ?? []).map((c: any) => [c.id, c]));
  const expected = (sc?.present_ids ?? []).map((id: string) => byId.get(id)).filter(Boolean).map((c: any) => ({ name: c.name, fruit: c.fruit }));
  return { expected, speaker: (byId.get(sc?.speaker_id) as any)?.name ?? null, niche: nicheOf(st).id };
}

/**
 * Admin test: ONE clip for a scene at a chosen tier/length, charged through the
 * normal fruit_charge_step path. A tier above the user's plan works only with
 * an admin row in fruit_test_overrides (single use, auto-expiring).
 */
async function clipTest(body: any) {
  if (paidOff()) throw new FruitError("PAID_CALLS_DISABLED", "paid calls are off");
  const { data: sc, error } = await admin.from("fruit_story_scenes").select("*").eq("id", body?.sceneId).single();
  if (error || !sc) throw new FruitError("NOT_FOUND", "scene");
  const { data: story } = await admin.from("fruit_stories").select("*").eq("id", sc.story_id).single();
  const { data: rows } = await admin.from("fruit_characters").select("*");
  const lib = new Map((rows ?? []).map((c: any) => [c.id, c]));
  const quality = body?.quality ?? story.quality;
  const built = buildClipRequest({
    story: { aspect: story.aspect, quality: story.quality }, library: lib, quality, durationSec: body?.durationSec,
    scene: { speakerId: sc.speaker_id, presentIds: sc.present_ids, line: sc.line, emotion: sc.emotion, action: sc.action, shot: sc.shot, placement: sc.placement, imageUrl: sc.image_url },
  });
  const { data, error: e2 } = await admin.rpc("fruit_charge_step", {
    p_user_id: story.user_id, p_story_id: story.id, p_step: "reclip", p_from_statuses: ["pictures_ready", "animating", "clips_ready", "final_ready"], p_to_status: "animating",
    p_items: [{ scene_id: sc.id, kind: "clip", tool_key: videoModel(quality).toolKey, price_input: built.priceInput, request: built.request, prompt: built.prompt }],
  });
  if (e2) throw new FruitError("CHARGE_FAILED", e2.message);
  await engine.kick({ storyId: story.id });
  return data;
}

/** Bake-off: models that aren't products yet. Submitted directly (no user charge), every call logged with its real cost. */
const BAKEOFF_MODELS = new Set(["bytedance:seedance@2.0-mini", "lightricks:ltx@2.3", "alibaba:wan@2.6-flash", "google:3@3"]);
async function rawTest(body: any) {
  if (paidOff()) throw new FruitError("PAID_CALLS_DISABLED", "paid calls are off");
  const task = body?.task;
  if (!task || task.taskType !== "videoInference" || !BAKEOFF_MODELS.has(task.model)) throw new FruitError("VALIDATION", "model not allowed");
  const taskUUID = crypto.randomUUID();
  const envelope = buildEnvelope(task, { taskUUID, webhookURL: null });
  const { data: call } = await admin.from("fruit_ai_calls").insert({
    user_id: body.userId ?? null, story_id: body.storyId ?? null, scene_id: body.sceneId ?? null,
    provider: "runware", model: task.model, purpose: `bakeoff:${body.label ?? task.model}`, request: envelope,
  }).select("id").single();
  const res = await runwarePost([envelope]);
  const parsed = parseRunware(res.body, taskUUID, res.httpStatus);
  if (parsed.state === "error") {
    await admin.from("fruit_ai_calls").update({ ok: false, http_status: res.httpStatus, response: res.body, error: `${parsed.code}: ${parsed.message}`, cost_usd: parsed.cost ?? 0, completed_at: new Date().toISOString() }).eq("id", call.id);
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
  if (paidOff()) throw new FruitError("PAID_CALLS_DISABLED", "paid calls are off");
  const { data: sc } = await admin.from("fruit_story_scenes").select("*").eq("id", body?.sceneId).single();
  if (!sc) throw new FruitError("NOT_FOUND", "scene");
  const { data: story } = await admin.from("fruit_stories").select("*").eq("id", sc.story_id).single();
  const { data: rows } = await admin.from("fruit_characters").select("*");
  const built = buildPictureRequest({
    story: { aspect: story.aspect, locations: story.locations }, library: new Map((rows ?? []).map((c: any) => [c.id, c])), mode: "new",
    scene: { speakerId: sc.speaker_id, presentIds: sc.present_ids, action: sc.action, emotion: sc.emotion, shot: sc.shot, placement: sc.placement, locationId: sc.location_id },
  });
  const taskUUID = crypto.randomUUID();
  const envelope = buildEnvelope(built.request, { taskUUID, webhookURL: null });
  const { data: call } = await admin.from("fruit_ai_calls").insert({
    user_id: story.user_id, story_id: story.id, scene_id: sc.id, provider: "runware", model: built.request.model, purpose: "framing_check", request: envelope,
  }).select("id").single();
  const res = await runwarePost([envelope]);
  const parsed = parseRunware(res.body, taskUUID, res.httpStatus);
  if (parsed.state === "error") {
    await admin.from("fruit_ai_calls").update({ ok: false, http_status: res.httpStatus, response: res.body, error: `${parsed.code}: ${parsed.message}`, cost_usd: parsed.cost ?? 0, completed_at: new Date().toISOString() }).eq("id", call.id);
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
  if (!FLY_API_TOKEN) throw new FruitError("VALIDATION", "FLY_API_TOKEN not set");
  if (typeof body?.clipUrl !== "string" || !body.clipUrl.startsWith(`${SUPABASE_URL}/storage/`)) throw new FruitError("VALIDATION", "clipUrl must be a stored clip");
  const id = crypto.randomUUID();
  const jobId = `test-${id}`;
  const path = `fruit/tests/frames/${id}.jpg`;
  const { data: signed, error } = await admin.storage.from("generated").createSignedUploadUrl(path, { upsert: true });
  if (error || !signed?.signedUrl) throw new FruitError("SERVER_FAILED", "signed upload");
  const frameJob = { jobId, clipUrl: body.clipUrl, uploadUrl: signed.signedUrl, callbackUrl: `${SUPABASE_URL}/functions/v1/fruit-worker`, token: await webhookToken(WORKER_SECRET, `frame:${jobId}`) };
  const t0 = Date.now();
  const res = await fetch(`https://api.machines.dev/v1/apps/${FLY_APP}/machines`, {
    method: "POST", headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(frameMachineConfig({ image: FRUIT_FINAL_IMAGE, job: frameJob })), signal: AbortSignal.timeout(20_000),
  });
  const machine = await res.json().catch(() => null);
  return { started: res.ok, status: res.status, ms: Date.now() - t0, jobId, url: admin.storage.from("generated").getPublicUrl(path).data.publicUrl, machineId: machine?.id ?? null, error: res.ok ? null : JSON.stringify(machine).slice(0, 300) };
}

async function rawPoll(body: any) {
  const res = await runwarePost([getResponseTask(body.taskUUID)]);
  const parsed = parseRunware(res.body, body.taskUUID, res.httpStatus);
  if (parsed.state === "success") {
    const image = body?.kind === "image";
    const url = await createSupabaseMedia(admin).store({ url: parsed.url, path: `fruit/tests/${body.taskUUID}.${image ? "jpg" : "mp4"}`, contentType: image ? "image/jpeg" : "video/mp4" });
    await admin.from("fruit_ai_calls").update({ ok: true, http_status: res.httpStatus, response: res.body, cost_usd: parsed.cost, completed_at: new Date().toISOString() }).eq("id", body.callId);
    return { state: "success", url, cost: parsed.cost };
  }
  if (parsed.state === "error") {
    await admin.from("fruit_ai_calls").update({ ok: false, http_status: res.httpStatus, response: res.body, error: `${parsed.code}: ${parsed.message}`, cost_usd: parsed.cost ?? 0, completed_at: new Date().toISOString() }).eq("id", body.callId);
    return { state: "error", error: `${parsed.code}: ${parsed.message}`, cost: parsed.cost ?? 0 };
  }
  return { state: "pending" };
}

/** Blind test: same validation + planner as createStory, model chosen by the caller, nothing saved but the call log. */
async function plannerTest(body: any) {
  const { data: rows, error } = await admin.from("fruit_characters").select("*").eq("active", true);
  if (error) throw new Error(error.message);
  const lib = new Map(rows.map((c: any) => [c.id, c]));
  // body.idea: an idea that isn't in the table yet ({id, title, summary, cast_ids}), for testing a library change before it ships.
  const idea = body?.input?.source === "idea"
    ? (body?.idea?.id === body.input.ideaId ? body.idea : (await admin.from("fruit_ideas").select("*").eq("id", body.input.ideaId).maybeSingle()).data)
    : null;
  const input = validateCreateStory(body?.input, lib, (id: string) => (idea && idea.id === id ? { castIds: idea.cast_ids } : null));
  const model = body?.model;
  if (!model?.provider || !model?.model) throw new FruitError("VALIDATION", "model required");
  const out = await planStory({
    admin, userId: typeof body?.userId === "string" ? body.userId : null, model, purposePrefix: "blind_test:",
    env: { ...TEST_ENV(), ...(body?.review === false ? { FRUIT_SCRIPT_REVIEW: "off" } : {}) },
    plannerInput: {
      source: input.source, cast: input.castIds.map((id: string) => lib.get(id)), lengthSec: input.lengthSec, quality: input.quality,
      idea: idea ? { title: idea.title, summary: idea.summary } : undefined, prompt: input.prompt, script: input.script,
    },
  });
  return out;
}

const TEST_ENV = () => ({ ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") ?? "", OPENAI_API_KEY, FRUIT_PAID_CALLS: PAID_CALLS });

/**
 * Admin test: plan a series and write its first episode with today's planners.
 * Nothing is saved but the logged calls. body: {userId?, input: {concept, castIds, opener, tone, episodeCount}, lengthSec, quality}
 */
async function seriesTest(body: any) {
  const { data: rows, error } = await admin.from("fruit_characters").select("*").eq("active", true);
  if (error) throw new Error(error.message);
  const lib = new Map(rows.map((c: any) => [c.id, c]));
  const input = body?.input ?? {};
  const cast = (input.castIds ?? []).map((id: string) => lib.get(id)).filter(Boolean);
  if (cast.length < 2) throw new FruitError("VALIDATION", "castIds required");
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
  const { data: story } = await admin.from("fruit_stories").select("*").eq("id", body?.storyId).maybeSingle();
  if (!story) throw new FruitError("NOT_FOUND", "story");
  const { data: scenes } = await admin.from("fruit_story_scenes").select("idx, speaker_id, line, present_ids, location_id").eq("story_id", story.id).order("idx");
  const { data: rows } = await admin.from("fruit_characters").select("*").in("id", story.cast_ids);
  let series = null;
  if (story.series_id) {
    const { data: ep } = await admin.from("fruit_series_episodes").select("number, title, summary, cliffhanger").eq("series_id", story.series_id).eq("number", story.episode_number).maybeSingle();
    series = { episode: ep };
  }
  const plan = {
    title: story.title, roles: story.cast_roles ?? {}, outfits: story.planner?.outfits ?? {}, locations: story.locations ?? [],
    scenes: (scenes ?? []).map((s: any) => ({ speakerId: s.speaker_id, line: s.line, presentIds: s.present_ids, locationId: s.location_id })),
  };
  return reviewStoredScript({ admin, env: TEST_ENV(), userId: null, plan, cast: rows ?? [], source: story.series_id ? "episode" : "idea", series });
}

/**
 * The Fly machine's report for a final build. Only the build in flight
 * (fruit_stories.final_call_id) may change the story; a late report from an
 * older build is logged and ignored. Free either way: nothing to refund.
 */
async function finalDone(callId: string, report: any) {
  const { data: call } = await admin.from("fruit_ai_calls").select("id, story_id, request, created_at, completed_at").eq("id", callId).eq("purpose", "final").maybeSingle();
  if (!call) return { applied: false, reason: "unknown build" };
  if (!call.completed_at) {
    await admin.from("fruit_ai_calls").update({
      ok: Boolean(report?.ok), error: report?.ok ? null : String(report?.error ?? "failed").slice(0, 500),
      response: { ...(call.request?.path ? { path: call.request.path } : {}), durationSec: report?.durationSec ?? null, trimmedSec: report?.trimmedSec ?? null, trimmedPerClip: report?.trimmedPerClip ?? null, captionSources: report?.captionSources ?? null, sizeBytes: report?.sizeBytes ?? null, seconds: report?.seconds ?? null },
      // Billed machine time includes boot + image pull, so charge the wall clock since start when it's longer.
      cost_usd: Math.max(Number(report?.costUsd) || 0, ((Date.now() - new Date(call.created_at).getTime()) / 1000) * FINAL_USD_PER_SECOND),
      latency_ms: Date.now() - new Date(call.created_at).getTime(), completed_at: new Date().toISOString(),
    }).eq("id", callId);
  }
  const publicUrl = report?.ok ? admin.storage.from("generated").getPublicUrl(call.request.path).data.publicUrl : null;
  const coverUrl = report?.ok && report?.cover && call.request?.coverPath ? admin.storage.from("generated").getPublicUrl(call.request.coverPath).data.publicUrl : null;
  const { data: moved } = await admin.from("fruit_stories")
    .update(storyUpdateForReport(report, publicUrl, MESSAGES.FINAL_FAILED, coverUrl))
    .eq("id", call.story_id).eq("final_call_id", callId).eq("status", "building").select("id");
  return { applied: Boolean(moved?.length) };
}

/** Builds that never reported (machine died) fail after FINAL_TIMEOUT_MIN; the user retries for free. */
async function failStaleFinals() {
  const cutoff = new Date(Date.now() - FINAL_TIMEOUT_MIN * 60_000).toISOString();
  const { data: stale } = await admin.from("fruit_stories").select("id, final_call_id").eq("status", "building").lt("final_requested_at", cutoff);
  for (const s of stale ?? []) {
    await admin.from("fruit_stories").update(storyUpdateForReport({ ok: false }, null, MESSAGES.FINAL_FAILED)).eq("id", s.id).eq("status", "building");
    if (s.final_call_id) await admin.from("fruit_ai_calls").update({ ok: false, error: "timed out", completed_at: new Date().toISOString() }).eq("id", s.final_call_id).is("completed_at", null);
  }
  return stale?.length ?? 0;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function background(p: Promise<unknown>) {
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = p.catch((e) => console.error("[fruit-worker] background failed:", e?.message ?? e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

function taskUUIDOf(body: any): string | null {
  const first = Array.isArray(body?.data) ? body.data[0] : Array.isArray(body?.errors) ? body.errors[0] : body;
  return typeof first?.taskUUID === "string" ? first.taskUUID : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!WORKER_SECRET) return json({ ok: false, error: "FRUIT_WORKER_SECRET not configured" }, 500);
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const action = url.searchParams.get("action") ?? body?.action;

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
      console.log(`[fruit-worker] frame test ${jobId}: ${body?.ok ? "ok" : `failed: ${body?.error}`}`);
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
      console.error("[fruit-worker] final_done failed:", (e as Error)?.message ?? e);
      return json({ ok: false, error: "worker failed" }, 500);
    }
  }

  if (["clip_test", "raw_test", "raw_poll", "picture_test", "frame_test"].includes(action)) {
    if (!sameToken((req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""), SERVICE_KEY)) return json({ ok: false }, 401);
    try {
      const fn = action === "clip_test" ? clipTest : action === "raw_test" ? rawTest : action === "picture_test" ? pictureTest : action === "frame_test" ? frameTest : rawPoll;
      return json({ ok: true, ...(await fn(body)) });
    } catch (e) {
      const fe = e as any;
      return json({ ok: false, code: fe?.code ?? "SERVER_FAILED", message: fe?.message ?? String(e) }, 200);
    }
  }

  if (action === "planner_test" || action === "series_test" || action === "review_test") {
    if (!sameToken((req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""), SERVICE_KEY)) return json({ ok: false }, 401);
    try {
      const fn = action === "series_test" ? seriesTest : action === "review_test" ? reviewTest : plannerTest;
      return json({ ok: true, ...(await fn(body)) });
    } catch (e) {
      const fe = e as any;
      return json({ ok: false, code: fe?.code ?? "SERVER_FAILED", message: fe?.message, details: fe?.details ?? null, costUsd: fe?.costUsd ?? 0 }, 200);
    }
  }

  if (!sameToken(req.headers.get("x-fruit-worker-secret") ?? "", WORKER_SECRET)) return json({ ok: false }, 401);
  try {
    if (action === "kick") return json({ ok: true, ...(await engine.kick({ storyId: typeof body?.storyId === "string" ? body.storyId : null })) });
    if (action === "reconcile") return json({ ok: true, ...(await engine.reconcile()), finalsTimedOut: await failStaleFinals() });
    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    console.error(`[fruit-worker] ${action} failed:`, (e as Error)?.message ?? e);
    return json({ ok: false, error: "worker failed" }, 500);
  }
});
