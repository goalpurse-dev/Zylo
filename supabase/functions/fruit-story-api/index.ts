// deno-lint-ignore-file no-explicit-any
// fruit-story-api — the AI Fruit Story v2 backend the browser talks to.
// One action-routed endpoint for every function of the v2 contract
// (src/components/viral-tools/ai-fruit-story-v2/api/fruitStoryV2Api.js).
//
// Every action: signed-in user → paid plan (for anything that writes or
// spends) → input validation → rate limit → work. The browser never prices,
// charges or creates jobs; paid steps go through fruit_charge_step (one
// atomic charge per step, priced from tool_prices) and fruit-worker.
//
// Response: {ok: true, data} or {ok: false, code, message} (message is shown
// to the user as-is unless code ends in _FAILED).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../shared/cors.ts";
import { FruitError, errorBody, fromDbError, fruitError } from "../_shared/fruit/errors.js";
import { episodeStatuses, toRecentSingle, toStory } from "../_shared/fruit/storyState.js";
import { validateCreateStory, validateEditInstruction, validateId, validateScenePrompt, validateSeriesPlan } from "../_shared/fruit/validation.js";
import { planStep } from "../_shared/fruit/steps.js";
import { planStory } from "../_shared/fruit/plannerService.js";
import { buildPictureRequest } from "../_shared/fruit/pictures.js";
import { buildClipRequest } from "../_shared/fruit/clips.js";
import { cleanEditInstruction } from "../_shared/fruit/smallTasks.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_SECRET = Deno.env.get("FRUIT_WORKER_SECRET") ?? "";
const PAID_CALLS_OFF = (Deno.env.get("FRUIT_PAID_CALLS") ?? "").toLowerCase() === "off";
const LLM_ENV = {
  ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
  OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") ?? "",
  FRUIT_PAID_CALLS: Deno.env.get("FRUIT_PAID_CALLS") ?? "",
};
const PLAN_RANK: Record<string, number> = { starter: 1, affiliate: 1, pro: 2, generative: 3 };
const QUALITY_PLAN: Record<string, [number, string]> = { v2: [1, "Starter"], v3: [2, "Pro"], v4: [3, "Generative"] };

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Pictures (stage 3d) and clips (stage 3e) are on.
const BUILDERS = { picture: buildPictureRequest, clip: buildClipRequest };

const PAID_PLANS = new Set(["starter", "pro", "generative", "affiliate"]);
const RATE = {
  read: { bucket: "fruit-v2:read", limit: 600 },
  step: { bucket: "fruit-v2:step", limit: 120 },
  story: { bucket: "fruit-v2:story", limit: 30 },
  series: { bucket: "fruit-v2:series", limit: 5 },
} as const;

type Ctx = { userId: string; plan: string; body: any };

/* ─── helpers ─────────────────────────────────────────────────────────── */

const must = ({ data, error }: { data: any; error: any }) => {
  if (error) {
    console.error("[fruit-story-api] db:", error.message);   // raw text is logged, never returned
    throw fromDbError(error);
  }
  return data;
};

let libraryCache: { at: number; rows: any[] } | null = null;
async function library() {
  if (!libraryCache || Date.now() - libraryCache.at > 5 * 60_000) {
    const rows = must(await admin.from("fruit_characters").select("*").eq("active", true).order("sort_order"));
    libraryCache = { at: Date.now(), rows };
  }
  return libraryCache.rows;
}
const libraryMap = async () => new Map((await library()).map((c: any) => [c.id, c]));

const toCharacter = (c: any) => ({
  id: c.id, name: c.name, collection: c.collection, fruit: c.fruit, emoji: c.emoji, hue: c.hue,
  tag: c.tag, role: c.role, gender: c.gender, voiceStyle: c.voice_style, storyTypes: c.story_types, refImageUrl: c.ref_image_url,
});

async function rateLimit(userId: string, kind: keyof typeof RATE) {
  const { bucket, limit } = RATE[kind];
  const { data, error } = await admin.rpc("consume_rate_limit", { p_user_id: userId, p_bucket: bucket, p_limit: limit, p_window_seconds: 600 });
  if (error) { console.error(`[fruit-story-api] rate limiter unavailable (${bucket}), allowing`, error.message); return; }
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) throw fruitError("RATE_LIMITED", `You're going a bit fast. Try again in ${Math.max(1, Number(row.retry_after_seconds) || 60)} seconds.`);
}

function requirePaid(ctx: Ctx) {
  if (!PAID_PLANS.has(ctx.plan)) throw fruitError("PLAN_UPGRADE_REQUIRED");
}

async function loadStory(userId: string, storyId: string) {
  const story = must(await admin.from("fruit_stories").select("*").eq("id", storyId).eq("user_id", userId).is("deleted_at", null).maybeSingle());
  if (!story) throw fruitError("NOT_FOUND");
  const scenes = must(await admin.from("fruit_story_scenes").select("*").eq("story_id", storyId).order("idx"));
  return { row: story, scenes };
}

async function loadSceneStory(userId: string, sceneId: string) {
  const scene = must(await admin.from("fruit_story_scenes").select("story_id").eq("id", sceneId).eq("user_id", userId).maybeSingle());
  if (!scene) throw new FruitError("NOT_FOUND", "This scene doesn't exist anymore.", 404);
  return loadStory(userId, scene.story_id);
}

function kickWorker(storyId: string) {
  const p = fetch(`${SUPABASE_URL}/functions/v1/fruit-worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-fruit-worker-secret": WORKER_SECRET },
    body: JSON.stringify({ action: "kick", storyId }),
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => console.error("[fruit-story-api] kick failed (cron will pick it up):", e?.message ?? e));
  (globalThis as any).EdgeRuntime?.waitUntil?.(p);
}

/** One paid step: plan → atomic charge → start the worker → fresh story. */
async function runStep(ctx: Ctx, step: string, storyId: string, extra: Record<string, unknown> = {}) {
  requirePaid(ctx);
  if (PAID_CALLS_OFF) throw fruitError("PAID_CALLS_DISABLED");
  await rateLimit(ctx.userId, "step");
  const { row, scenes } = await loadStory(ctx.userId, storyId);
  const story: any = { ...toStory(row, scenes), locations: row.locations };   // locations: builder only, not the contract
  const staging = new Map(scenes.map((s: any) => [s.id, { locationId: s.location_id, action: s.action, emotion: s.emotion, shot: s.shot, placement: s.placement }]));
  const plan = planStep(step as any, { story, scenes: story.scenes, library: await libraryMap(), builders: BUILDERS, staging, ...extra });
  must(await admin.rpc("fruit_charge_step", {
    p_user_id: ctx.userId, p_story_id: storyId, p_step: plan.step, p_from_statuses: plan.from, p_to_status: plan.to, p_items: plan.items,
  }));
  kickWorker(storyId);
  const fresh = await loadStory(ctx.userId, storyId);
  return toStory(fresh.row, fresh.scenes);
}

/* ─── actions ─────────────────────────────────────────────────────────── */

const ACTIONS: Record<string, (ctx: Ctx) => Promise<unknown>> = {
  async listCharacters(ctx) {
    await rateLimit(ctx.userId, "read");
    return (await library()).map(toCharacter);
  },

  async getIdeas(ctx) {
    await rateLimit(ctx.userId, "read");
    const seed = Number.isFinite(Number(ctx.body?.seed)) ? Number(ctx.body.seed) : 0;
    const rows = must(await admin.rpc("fruit_pick_ideas", { p_seed: `${ctx.userId}:${seed}`, p_count: 5 }));
    if (!rows?.length) throw fruitError("IDEAS_FAILED", "We couldn't load new ideas.");
    return rows.map((i: any) => ({ id: i.id, title: i.title, summary: i.summary, castIds: i.cast_ids }));
  },

  async createStory(ctx) {
    requirePaid(ctx);
    const rows = await library();
    const lib = new Map(rows.map((c: any) => [c.id, c]));
    const raw = ctx.body?.input;
    const idea = raw?.source === "idea" && typeof raw?.ideaId === "string"
      ? must(await admin.from("fruit_ideas").select("*").eq("id", raw.ideaId).eq("active", true).maybeSingle())
      : null;
    const input = validateCreateStory(raw, lib, (id: string) => (idea && idea.id === id ? { castIds: idea.cast_ids } : null));
    const [need, planName] = QUALITY_PLAN[input.quality];
    if ((PLAN_RANK[ctx.plan] ?? 0) < need) throw fruitError("PLAN_UPGRADE_REQUIRED", `${input.quality.toUpperCase()} needs the ${planName} plan.`);
    if (input.source === "episode") throw fruitError("STAGE_NOT_READY", "Series episodes aren't switched on yet.");   // stage 3g
    await rateLimit(ctx.userId, "story");

    const cast = input.castIds.map((id: string) => lib.get(id));
    const { plan, attempts, callIds, costUsd, model } = await planStory({
      admin, env: LLM_ENV, userId: ctx.userId,
      plannerInput: {
        source: input.source, cast, lengthSec: input.lengthSec, quality: input.quality,
        idea: idea ? { title: idea.title, summary: idea.summary } : undefined,
        prompt: input.prompt, script: input.script,
      },
    });
    const storyId = must(await admin.rpc("fruit_create_story", {
      p_user_id: ctx.userId,
      p_story: {
        source: input.source,
        input: { source: input.source, ideaId: input.ideaId ?? null, prompt: input.prompt ?? null, script: input.script ?? null },
        title: plan.title, cast_ids: input.castIds, quality: input.quality, aspect: input.aspect,
        length_sec: Math.min(180, Math.max(5, plan.lengthSec)), locations: plan.locations,
        planner: { provider: model.provider, model: model.model, attempts, callIds, costUsd },
      },
      p_scenes: plan.scenes.map((sc: any) => ({
        title: sc.title, speaker_id: sc.speakerId, line: sc.line, present_ids: sc.presentIds, location_id: sc.locationId,
        action: sc.action, emotion: sc.emotion, shot: sc.shot, placement: sc.placement, duration_sec: sc.durationSec,
      })),
      p_call_ids: callIds,
    }));
    const { row, scenes } = await loadStory(ctx.userId, storyId);
    return toStory(row, scenes);
  },

  async getStory(ctx) {
    await rateLimit(ctx.userId, "read");
    const { row, scenes } = await loadStory(ctx.userId, validateId(ctx.body?.storyId));
    return toStory(row, scenes);
  },

  generateScenePictures: (ctx) => runStep(ctx, "pictures", validateId(ctx.body?.storyId)),

  async editScene(ctx) {
    const sceneId = validateId(ctx.body?.sceneId, "scene");
    const raw = validateEditInstruction(ctx.body?.instruction);
    requirePaid(ctx);
    if (PAID_CALLS_OFF) throw fruitError("PAID_CALLS_DISABLED");
    const { row } = await loadSceneStory(ctx.userId, sceneId);
    const instruction = await cleanEditInstruction({ admin, env: LLM_ENV, userId: ctx.userId, storyId: row.id, sceneId, instruction: raw });
    return runStep(ctx, "edit", row.id, { sceneId, instruction });
  },

  async regenerateScene(ctx) {
    const sceneId = validateId(ctx.body?.sceneId, "scene");
    const prompt = validateScenePrompt(ctx.body?.prompt);
    const { row, scenes } = await loadSceneStory(ctx.userId, sceneId);
    const scene = scenes.find((s: any) => s.id === sceneId);
    const step = scene?.image_status === "failed" && scene.image_prompt === prompt ? "retry_picture" : "regenerate";
    return runStep(ctx, step, row.id, { sceneId, prompt });
  },

  animateAll: (ctx) => runStep(ctx, "animate", validateId(ctx.body?.storyId)),

  async regenerateClip(ctx) {
    const sceneId = validateId(ctx.body?.sceneId, "scene");
    const { row } = await loadSceneStory(ctx.userId, sceneId);
    return runStep(ctx, "reclip", row.id, { sceneId });
  },

  async buildFinal(ctx) {
    requirePaid(ctx);
    validateId(ctx.body?.storyId);
    throw fruitError("STAGE_NOT_READY", "The final video isn't switched on yet.");   // stage 3f
  },

  async createSeriesPlan(ctx) {
    requirePaid(ctx);
    await rateLimit(ctx.userId, "series");
    validateSeriesPlan(ctx.body?.input, await libraryMap());
    throw fruitError("STAGE_NOT_READY", "Series plans aren't switched on yet.");     // stage 3g
  },

  async getSeries(ctx) {
    await rateLimit(ctx.userId, "read");
    const seriesId = validateId(ctx.body?.seriesId, "series");
    const s = must(await admin.from("fruit_series").select("*").eq("id", seriesId).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle());
    if (!s) throw new FruitError("NOT_FOUND", "This series doesn't exist anymore.", 404);
    const episodes = must(await admin.from("fruit_series_episodes").select("*").eq("series_id", seriesId).order("number"));
    const storyIds = episodes.map((e: any) => e.story_id).filter(Boolean);
    const stories = storyIds.length ? must(await admin.from("fruit_stories").select("id, status").in("id", storyIds)) : [];
    return {
      id: s.id, title: s.title, logline: s.logline, castIds: s.cast_ids, createdAt: s.created_at,
      episodes: episodeStatuses(episodes, new Map(stories.map((x: any) => [x.id, x.status]))),
    };
  },

  async listSeries(ctx) {
    await rateLimit(ctx.userId, "read");
    return listSeriesCards(ctx.userId);
  },

  async listRecent(ctx) {
    await rateLimit(ctx.userId, "read");
    if (ctx.body?.type === "series") return listSeriesCards(ctx.userId);
    const rows = must(await admin.from("fruit_stories").select("*").eq("user_id", ctx.userId).is("series_id", null).is("deleted_at", null)
      .neq("status", "draft").order("created_at", { ascending: false }).limit(30));
    if (!rows.length) return [];
    const scenes = must(await admin.from("fruit_story_scenes").select("story_id, idx, image_url").in("story_id", rows.map((r: any) => r.id)).lt("idx", 3));
    return rows.map((r: any) => toRecentSingle(r, scenes.filter((s: any) => s.story_id === r.id)));
  },
};

async function listSeriesCards(userId: string) {
  const list = must(await admin.from("fruit_series").select("*").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(30));
  if (!list.length) return [];
  const eps = must(await admin.from("fruit_series_episodes").select("series_id, number, story_id").in("series_id", list.map((s: any) => s.id)));
  const storyIds = eps.map((e: any) => e.story_id).filter(Boolean);
  const stories = storyIds.length ? must(await admin.from("fruit_stories").select("id, status").in("id", storyIds)) : [];
  const status = new Map(stories.map((x: any) => [x.id, x.status]));
  const thumbs = storyIds.length ? must(await admin.from("fruit_story_scenes").select("story_id, idx, image_url").in("story_id", storyIds).lt("idx", 3)) : [];
  return list.map((s: any) => {
    const mine = eps.filter((e: any) => e.series_id === s.id).sort((a: any, b: any) => a.number - b.number);
    return {
      type: "series", id: s.id, title: s.title, castIds: s.cast_ids, episodeCount: s.episode_count,
      madeCount: mine.filter((e: any) => e.story_id && status.get(e.story_id) === "final_ready").length,
      thumbUrls: mine.flatMap((e: any) => thumbs.filter((t: any) => t.story_id === e.story_id).sort((a: any, b: any) => a.idx - b.idx).map((t: any) => t.image_url)).filter(Boolean).slice(0, 3),
      createdAt: s.created_at,
    };
  });
}

/* ─── entry ───────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method !== "POST") return reply({ ok: false, code: "VALIDATION", message: "POST only." }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) throw fruitError("UNAUTHORIZED");
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) throw fruitError("UNAUTHORIZED");

    const body = await req.json().catch(() => ({}));
    const handler = ACTIONS[body?.action];
    if (!handler) throw new FruitError("VALIDATION", "Unknown action.", 400);

    const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", user.id).maybeSingle();
    const plan = String(profile?.plan_code ?? "free").toLowerCase().trim();
    const data = await handler({ userId: user.id, plan, body });
    return reply({ ok: true, data });
  } catch (e) {
    const err = e instanceof FruitError ? e : fromDbError(e);
    if (!(e instanceof FruitError)) console.error("[fruit-story-api] unexpected:", (e as Error)?.message ?? e);
    return reply(errorBody(err), err.status ?? 500);
  }
});
