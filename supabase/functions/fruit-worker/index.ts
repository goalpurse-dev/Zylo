// deno-lint-ignore-file no-explicit-any
// fruit-worker — AI Fruit Story v2 job runner (service only; never called by
// the browser).
//
//   POST ?action=webhook&t=<hmac>   Runware task result (auth: HMAC of taskUUID)
//   POST {action:"kick", storyId?}  start queued jobs    (auth: x-fruit-worker-secret)
//   POST {action:"reconcile"}       cron, every minute   (auth: x-fruit-worker-secret)
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
import { planStory } from "../_shared/fruit/plannerService.js";
import { validateCreateStory } from "../_shared/fruit/validation.js";
import { FruitError } from "../_shared/fruit/errors.js";
import { buildClipRequest, fallbackClipTask } from "../_shared/fruit/clips.js";
import { rewriteClipPrompt } from "../_shared/fruit/smallTasks.js";
import { buildEnvelope, parseRunware } from "../_shared/fruit/runware.js";
import { videoModel } from "../_shared/fruit/models.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
const RUNWARE_URL = `${(Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "")}/v1`;
const WORKER_SECRET = Deno.env.get("FRUIT_WORKER_SECRET") ?? "";
const PAID_CALLS = Deno.env.get("FRUIT_PAID_CALLS") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

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
const BAKEOFF_MODELS = new Set(["bytedance:seedance@2.0-mini", "lightricks:ltx@2.3", "alibaba:wan@2.6-flash"]);
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
async function rawPoll(body: any) {
  const res = await runwarePost([getResponseTask(body.taskUUID)]);
  const parsed = parseRunware(res.body, body.taskUUID, res.httpStatus);
  if (parsed.state === "success") {
    const url = await createSupabaseMedia(admin).store({ url: parsed.url, path: `fruit/tests/${body.taskUUID}.mp4`, contentType: "video/mp4" });
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
  const idea = body?.input?.source === "idea"
    ? (await admin.from("fruit_ideas").select("*").eq("id", body.input.ideaId).maybeSingle()).data
    : null;
  const input = validateCreateStory(body?.input, lib, (id: string) => (idea && idea.id === id ? { castIds: idea.cast_ids } : null));
  const model = body?.model;
  if (!model?.provider || !model?.model) throw new FruitError("VALIDATION", "model required");
  const out = await planStory({
    admin, userId: typeof body?.userId === "string" ? body.userId : null, model, purposePrefix: "blind_test:",
    env: { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") ?? "", OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") ?? "", FRUIT_PAID_CALLS: PAID_CALLS },
    plannerInput: {
      source: input.source, cast: input.castIds.map((id: string) => lib.get(id)), lengthSec: input.lengthSec, quality: input.quality,
      idea: idea ? { title: idea.title, summary: idea.summary } : undefined, prompt: input.prompt, script: input.script,
    },
  });
  return out;
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

  if (["clip_test", "raw_test", "raw_poll"].includes(action)) {
    if (!sameToken((req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""), SERVICE_KEY)) return json({ ok: false }, 401);
    try {
      const fn = action === "clip_test" ? clipTest : action === "raw_test" ? rawTest : rawPoll;
      return json({ ok: true, ...(await fn(body)) });
    } catch (e) {
      const fe = e as any;
      return json({ ok: false, code: fe?.code ?? "SERVER_FAILED", message: fe?.message ?? String(e) }, 200);
    }
  }

  if (action === "planner_test") {
    if (!sameToken((req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""), SERVICE_KEY)) return json({ ok: false }, 401);
    try {
      return json({ ok: true, ...(await plannerTest(body)) });
    } catch (e) {
      const fe = e as any;
      return json({ ok: false, code: fe?.code ?? "SERVER_FAILED", message: fe?.message, details: fe?.details ?? null, costUsd: fe?.costUsd ?? 0 }, 200);
    }
  }

  if (!sameToken(req.headers.get("x-fruit-worker-secret") ?? "", WORKER_SECRET)) return json({ ok: false }, 401);
  try {
    if (action === "kick") return json({ ok: true, ...(await engine.kick({ storyId: typeof body?.storyId === "string" ? body.storyId : null })) });
    if (action === "reconcile") return json({ ok: true, ...(await engine.reconcile()) });
    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    console.error(`[fruit-worker] ${action} failed:`, (e as Error)?.message ?? e);
    return json({ ok: false, error: "worker failed" }, 500);
  }
});
