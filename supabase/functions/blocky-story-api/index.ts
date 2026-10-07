// deno-lint-ignore-file no-explicit-any
// blocky-story-api — the Blocky Stories backend the browser talks to.
// One action-routed endpoint for every function of the contract
// (src/components/viral-tools/blocky-stories/api/blockyStoriesApi.js).
//
// Blocky Stories is its own product: its own engine (_shared/blocky/), tables
// (blocky_*), RPCs and worker. Nothing here imports from, reads or writes
// AI Fruit Story's. The only things shared are the platform's: profiles (the
// one credit balance), tool_prices, the rate limiter and the feature flags.
//
// Every action: signed-in user → the blocky_v1 switch → paid plan (for
// anything that writes or spends) → input validation → rate limit → work. The browser never prices,
// charges or creates jobs; paid steps go through blocky_charge_step (one
// atomic charge per step, priced from tool_prices) and blocky-worker.
//
// Response: {ok: true, data} or {ok: false, code, message} (message is shown
// to the user as-is unless code ends in _FAILED).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../shared/cors.ts";
import { BlockyError, MESSAGES, errorBody, fromDbError, blockyError } from "../_shared/blocky/errors.js";
import { episodeStatuses, spentFromLedger, stepBlocker, toRecentSingle, toStory } from "../_shared/blocky/storyState.js";
import { FINAL_MACHINE, buildFinalJob, coverScene, finalMachineConfig, finalPath, overlayTexts, scenesWithDrawnText, storyUpdateForReport } from "../_shared/blocky/final.js";
import { DRAWN_TEXT_PROBLEM } from "../_shared/blocky/pictureCheck.js";
import { sameToken, webhookToken } from "../_shared/blocky/runware.js";
import { providerOnHold } from "../_shared/blocky/alerts.js";
import { ensurePlates, lastEndOf, plateOf } from "../_shared/blocky/plates.js";
import { setupsFor } from "../_shared/blocky/series.js";
import { createSupabaseMedia } from "../_shared/blocky/supabaseStore.js";
import { transcriptsForClips } from "../_shared/blocky/captionWords.js";
import { spokenDiff } from "../_shared/blocky/spoken.js";
import { remakeStats } from "../_shared/blocky/clipCheck.js";
import { writeUploadPackage } from "../_shared/blocky/uploadPackage.js";
import { BLOCKY_MODELS } from "../_shared/blocky/models.js";
import { validateCreateStory, validateEditInstruction, validateId, validateScenePrompt, validateSeriesPlan } from "../_shared/blocky/validation.js";
import { planStep } from "../_shared/blocky/steps.js";
import { planSeries, planStory } from "../_shared/blocky/plannerService.js";
import { buildPictureRequest } from "../_shared/blocky/pictures.js";
import { buildClipRequest } from "../_shared/blocky/clips.js";
import { cleanEditInstruction } from "../_shared/blocky/smallTasks.js";
import { COST_USD, SMALL_USD, WRITER_USD, estimateUsd, readPaidState } from "../_shared/blocky/spendGuard.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_SECRET = Deno.env.get("BLOCKY_WORKER_SECRET") ?? "";
// A hard off switch as a function secret; the everyday switch and the daily cap are in the database (spendGuard.js).
const ENV_PAID_CALLS = Deno.env.get("BLOCKY_PAID_CALLS") ?? "";
const LLM_ENV = {
  ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
  OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") ?? "",
  BLOCKY_PAID_CALLS: Deno.env.get("BLOCKY_PAID_CALLS") ?? "",
  RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") ?? "",
  ALERT_EMAIL: Deno.env.get("BLOCKY_ALERT_EMAIL") || Deno.env.get("CONTACT_TO_EMAIL") || "",
};
// Final video: a per-job machine on the Long Form render app (same image family, own tag).
const FLY_API_TOKEN = Deno.env.get("FLY_API_TOKEN") ?? "";
const FLY_APP = Deno.env.get("FLY_RENDER_APP") ?? "zyvo-render";
const BLOCKY_FINAL_IMAGE = Deno.env.get("BLOCKY_FINAL_IMAGE") ?? `registry.fly.io/${FLY_APP}:blocky-final`;
const PLAN_RANK: Record<string, number> = { starter: 1, affiliate: 1, pro: 2, generative: 3 };
const QUALITY_PLAN: Record<string, [number, string]> = { v2: [1, "Starter"], v3: [2, "Pro"], v4: [3, "Generative"] };

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
const RUNWARE_URL = `${(Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "")}/v1`;
/** Synchronous Runware call (location plates only; scene pictures and clips go through blocky-worker). */
async function runwarePost(tasks: unknown[]) {
  const res = await fetch(RUNWARE_URL, {
    method: "POST", headers: { Authorization: `Bearer ${RUNWARE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(tasks), signal: AbortSignal.timeout(60_000),
  });
  return { httpStatus: res.status, body: await res.json().catch(() => null) };
}

const BUILDERS = { picture: buildPictureRequest, clip: buildClipRequest };

const PAID_PLANS = new Set(["starter", "pro", "generative", "affiliate"]);
const RATE = {
  read: { bucket: "blocky:read", limit: 600 },
  step: { bucket: "blocky:step", limit: 120 },
  story: { bucket: "blocky:story", limit: 30 },
  series: { bucket: "blocky:series", limit: 5 },
} as const;

type Ctx = { userId: string; plan: string; body: any };

/**
 * Paid calls are OFF unless the switch is on and today's spend, with what this
 * step is expected to cost us, stays under the daily cap. Read fresh every
 * time, so turning the switch off works at once. Nothing is charged on a refusal.
 */
async function requirePaidCalls(addUsd: number) {
  const state = await readPaidState(admin, ENV_PAID_CALLS, addUsd);
  if (state.on) return;
  console.log(`[blocky-story-api] paid call refused: ${state.reason} (spent $${state.spentUsd}, running $${state.inFlightUsd}, next $${addUsd}, cap $${state.capUsd})`);
  throw blockyError(state.reason === "cap_reached" ? "DAILY_CAP_REACHED" : "PAID_CALLS_DISABLED");
}

/* ─── helpers ─────────────────────────────────────────────────────────── */

const must = ({ data, error }: { data: any; error: any }) => {
  if (error) {
    console.error("[blocky-story-api] db:", error.message);   // raw text is logged, never returned
    throw fromDbError(error);
  }
  return data;
};

let libraryCache: { at: number; rows: any[] } | null = null;
async function library() {
  if (!libraryCache || Date.now() - libraryCache.at > 5 * 60_000) {
    const rows = must(await admin.from("blocky_characters").select("*").eq("active", true).order("sort_order"));
    libraryCache = { at: Date.now(), rows };
  }
  return libraryCache.rows;
}
const libraryMap = async () => new Map((await library()).map((c: any) => [c.id, c]));

// An avatar has no age and no gender: only a name, a locked look and how it sounds.
const toCharacter = (c: any) => ({
  id: c.id, name: c.name, hue: c.hue, tag: c.tag, role: c.role, look: c.look,
  voiceStyle: c.voice_style, roleTags: c.role_tags, refImageUrl: c.ref_image_url,
});

/** A switch is on for everyone (global_feature_flags) or for this account (user_feature_flags). No row = off. */
async function switchedOn(userId: string, flag: string) {
  const [g, u] = await Promise.all([
    admin.from("global_feature_flags").select("enabled").eq("key", flag).maybeSingle(),
    admin.from("user_feature_flags").select("flags").eq("user_id", userId).maybeSingle(),
  ]);
  return g.data?.enabled === true || u.data?.flags?.[flag] === true;
}

/** While Blocky Stories is in testing it exists only for accounts with the switch on; for everyone else it isn't there. */
const FLAG = "blocky_v1";
async function requireSwitchedOn(userId: string) {
  if (await switchedOn(userId, FLAG)) return;
  throw blockyError("NOT_FOUND", "This page doesn't exist.");
}

/**
 * Series has its own switch, off for everyone until single stories pass the quality review
 * (src/data/blockyStories.js#BLOCKY_SERIES_FLAG). Every series action is refused without it.
 */
const SERIES_FLAG = "blocky_series_v1";
async function requireSeries(userId: string) {
  if (await switchedOn(userId, SERIES_FLAG)) return;
  throw blockyError("STAGE_NOT_READY", "Series aren't switched on yet. Make a single video.");
}

async function rateLimit(userId: string, kind: keyof typeof RATE) {
  const { bucket, limit } = RATE[kind];
  const { data, error } = await admin.rpc("consume_rate_limit", { p_user_id: userId, p_bucket: bucket, p_limit: limit, p_window_seconds: 600 });
  if (error) { console.error(`[blocky-story-api] rate limiter unavailable (${bucket}), allowing`, error.message); return; }
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) throw blockyError("RATE_LIMITED", `You're going a bit fast. Try again in ${Math.max(1, Number(row.retry_after_seconds) || 60)} seconds.`);
}

function requirePaid(ctx: Ctx) {
  if (!PAID_PLANS.has(ctx.plan)) throw blockyError("PLAN_UPGRADE_REQUIRED");
}

async function loadStory(userId: string, storyId: string) {
  const story = must(await admin.from("blocky_stories").select("*").eq("id", storyId).eq("user_id", userId).is("deleted_at", null).maybeSingle());
  if (!story) throw blockyError("NOT_FOUND");
  const scenes = must(await admin.from("blocky_story_scenes").select("*").eq("story_id", storyId).order("idx"));
  const ledger = must(await admin.from("blocky_credit_ledger").select("operation, credits").eq("story_id", storyId));
  return { row: story, scenes, spent: spentFromLedger(ledger) };
}

async function loadSceneStory(userId: string, sceneId: string) {
  const scene = must(await admin.from("blocky_story_scenes").select("story_id").eq("id", sceneId).eq("user_id", userId).maybeSingle());
  if (!scene) throw new BlockyError("NOT_FOUND", "This scene doesn't exist anymore.", 404);
  return loadStory(userId, scene.story_id);
}

function kickWorker(storyId: string) {
  const p = fetch(`${SUPABASE_URL}/functions/v1/blocky-worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-blocky-worker-secret": WORKER_SECRET },
    body: JSON.stringify({ action: "kick", storyId }),
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => console.error("[blocky-story-api] kick failed (cron will pick it up):", e?.message ?? e));
  (globalThis as any).EdgeRuntime?.waitUntil?.(p);
}

/** One paid step: plan → atomic charge → start the worker → fresh story. */
async function runStep(ctx: Ctx, step: string, storyId: string, extra: Record<string, unknown> = {}) {
  requirePaid(ctx);
  await rateLimit(ctx.userId, "step");
  // Out-of-credit guard: while Runware just refused us for balance, don't charge for work that can't run.
  if (await providerOnHold(admin, "runware")) throw blockyError("PROVIDER_UNAVAILABLE");
  const { row, scenes } = await loadStory(ctx.userId, storyId);
  // locations: builder only, not the contract
  const story: any = { ...toStory(row, scenes), locations: row.locations };
  const staging = new Map(scenes.map((s: any) => [s.id, { locationId: s.location_id, action: s.action, emotion: s.emotion, shot: s.shot, placement: s.placement }]));
  const plan = planStep(step as any, { story, scenes: story.scenes, library: await libraryMap(), builders: BUILDERS, staging, ...extra });
  // The switch and the daily cap, with what this step will cost us, before anything is charged.
  await requirePaidCalls(estimateUsd(plan.items));
  must(await admin.rpc("blocky_charge_step", {
    p_user_id: ctx.userId, p_story_id: storyId, p_step: plan.step, p_from_statuses: plan.from, p_to_status: plan.to, p_items: plan.items,
  }));
  kickWorker(storyId);
  const fresh = await loadStory(ctx.userId, storyId);
  return toStory(fresh.row, fresh.scenes, fresh.spent);
}

/* ─── actions ─────────────────────────────────────────────────────────── */

const ACTIONS: Record<string, (ctx: Ctx) => Promise<unknown>> = {
  async listCharacters(ctx) {
    await rateLimit(ctx.userId, "read");
    return (await library()).map(toCharacter);
  },

  /** The idea engine (ten story engines, five ideas a batch, the used-ideas memory) is its own phase: not built yet. */
  async getIdeas(ctx) {
    await rateLimit(ctx.userId, "read");
    throw blockyError("STAGE_NOT_READY", "Story ideas aren't switched on yet. Write your own story or paste a script.");
  },

  async createStory(ctx) {
    requirePaid(ctx);
    const rows = await library();
    const lib = new Map(rows.map((c: any) => [c.id, c]));
    const raw = ctx.body?.input;
    if (raw?.source === "episode") await requireSeries(ctx.userId);
    if (raw?.source === "idea") throw blockyError("STAGE_NOT_READY", "Story ideas aren't switched on yet. Write your own story or paste a script.");
    const input = validateCreateStory(raw, lib, () => null);
    const [need, planName] = QUALITY_PLAN[input.quality];
    if ((PLAN_RANK[ctx.plan] ?? 0) < need) throw blockyError("PLAN_UPGRADE_REQUIRED", `${input.quality.toUpperCase()} needs the ${planName} plan.`);
    await rateLimit(ctx.userId, "story");
    // The script, and for an episode up to three location plates (pictures made at our cost).
    await requirePaidCalls(WRITER_USD + (input.source === "episode" ? 3 * COST_USD.image : 0));
    if (await providerOnHold(admin, BLOCKY_MODELS.planner.provider)) throw blockyError("PROVIDER_UNAVAILABLE");

    // An episode: the series cast, its bible, the earlier episodes, and this one's plan.
    let series: any;
    if (input.source === "episode") {
      const s = must(await admin.from("blocky_series").select("*").eq("id", input.seriesId).eq("user_id", ctx.userId).is("deleted_at", null).maybeSingle());
      if (!s) throw new BlockyError("NOT_FOUND", "This series doesn't exist anymore.", 404);
      const episodes = must(await admin.from("blocky_series_episodes").select("*").eq("series_id", s.id).order("number"));
      const storyIds = episodes.map((e: any) => e.story_id).filter(Boolean);
      const stories = storyIds.length ? must(await admin.from("blocky_stories").select("id, status").in("id", storyIds)) : [];
      const target = episodeStatuses(episodes, new Map(stories.map((x: any) => [x.id, x.status]))).find((e: any) => e.number === input.episodeNumber);
      if (!target) throw blockyError("VALIDATION", "That episode doesn't exist.");
      if (target.status === "locked") throw new BlockyError("WRONG_STATUS", "Finish the previous episode first.", 409);
      if (target.storyId) throw new BlockyError("WRONG_STATUS", "This episode is already started.", 409);
      input.castIds = s.cast_ids;
      // Continuity: where the previous episode ended (its planner's end state, or its last scene).
      const prevEp = episodes.find((e: any) => e.number === input.episodeNumber - 1);
      let lastEnd = null;
      if (prevEp?.story_id) {
        const prev = must(await admin.from("blocky_stories").select("end_state, locations").eq("id", prevEp.story_id).maybeSingle());
        const prevScenes = must(await admin.from("blocky_story_scenes").select("idx, speaker_id, present_ids, location_id, placement, emotion").eq("story_id", prevEp.story_id));
        lastEnd = lastEndOf(prev, prevScenes);
      }
      series = {
        id: s.id, title: s.title, logline: s.logline, bible: s.bible?.text ?? "", bibleRow: s.bible ?? {},
        previous: episodes.filter((e: any) => e.number < input.episodeNumber).map((e: any) => ({ number: e.number, title: e.title, summary: e.summary, cliffhanger: e.cliffhanger })),
        episode: { number: target.number, title: target.title, summary: target.summary, cliffhanger: target.cliffhanger },
        locations: (s.bible?.locations ?? []).map((l: any) => ({ id: l.id, description: l.description })),
        characters: s.bible?.characters ?? [],
        setups: setupsFor(s.bible?.setups ?? [], input.episodeNumber),
        lastEnd,
      };
    }

    const cast = input.castIds.map((id: string) => lib.get(id));
    const { plan, attempts, review, callIds, costUsd, model } = await planStory({
      admin, env: LLM_ENV, userId: ctx.userId, seriesId: series?.id ?? null,
      plannerInput: {
        source: input.source, cast, lengthSec: input.lengthSec, quality: input.quality,
        prompt: input.prompt, script: input.script, series,
      },
    });
    // An episode's cast is the characters it uses (a series of five often plays an
    // episode with two); every one of them gets a role: the planner's, else the
    // series bible's, else their library tag. Never an empty one.
    const used = new Set(plan.scenes.flatMap((sc: any) => sc.presentIds));
    const storyCast = series ? input.castIds.filter((id: string) => used.has(id)) : input.castIds;
    const roles: Record<string, string> = {};
    for (const id of storyCast) {
      roles[id] = plan.roles?.[id] || (series?.characters ?? []).find((c: any) => c.id === id)?.role || lib.get(id)?.tag || "";
    }
    // Series locations: make any missing plate (empty background, our cost) and
    // give each story location its plate so every scene there matches the series.
    let locations = plan.locations;
    if (series && series.locations.length) {
      const usedIds = [...new Set(plan.locations.map((l: any) => l.seriesLocationId).filter(Boolean))];
      const bibleLocations = await ensurePlates({
        locations: series.bibleRow.locations ?? [], usedIds, aspect: input.aspect, userId: ctx.userId, seriesId: series.id,
        deps: {
          post: runwarePost,
          store: (o: any) => createSupabaseMedia(admin).store(o),
          log: async (row: any) => { await admin.from("blocky_ai_calls").insert(row); },
        },
      });
      if (JSON.stringify(bibleLocations) !== JSON.stringify(series.bibleRow.locations ?? [])) {
        await admin.from("blocky_series").update({ bible: { ...series.bibleRow, locations: bibleLocations } }).eq("id", series.id);
      }
      locations = plan.locations.map((l: any) => {
        const plate = plateOf(bibleLocations.find((b: any) => b.id === l.seriesLocationId), input.aspect);
        return plate ? { ...l, plateUrl: plate } : l;
      });
    }
    const storyId = must(await admin.rpc("blocky_create_story", {
      p_user_id: ctx.userId,
      p_story: {
        source: input.source,
        input: { source: input.source, ideaId: input.ideaId ?? null, prompt: input.prompt ?? null, script: input.script ?? null },
        title: plan.title, cast_ids: storyCast, quality: input.quality, aspect: input.aspect,
        length_sec: Math.min(180, Math.max(5, plan.lengthSec)), locations,
        // review: what the script editor found and whether the script was rewritten
        planner: { provider: model.provider, model: model.model, attempts, callIds, costUsd, review: review ?? null },
        series_id: series?.id ?? null, episode_number: series ? input.episodeNumber : null,
      },
      p_scenes: plan.scenes.map((sc: any) => ({
        title: sc.title, speaker_id: sc.speakerId, line: sc.line, present_ids: sc.presentIds, location_id: sc.locationId,
        action: sc.action, emotion: sc.emotion, shot: sc.shot, placement: sc.placement, duration_sec: sc.durationSec,
      })),
      p_call_ids: callIds,
    }));
    // Each character's role in THIS story, and (for series continuity) where it ends.
    must(await admin.from("blocky_stories").update({ cast_roles: roles, end_state: plan.endState ?? null }).eq("id", storyId).select("id"));
    const { row, scenes, spent } = await loadStory(ctx.userId, storyId);
    return toStory(row, scenes, spent);
  },

  async getStory(ctx) {
    await rateLimit(ctx.userId, "read");
    const { row, scenes, spent } = await loadStory(ctx.userId, validateId(ctx.body?.storyId));
    return toStory(row, scenes, spent);
  },

  generateScenePictures: (ctx) => runStep(ctx, "pictures", validateId(ctx.body?.storyId)),

  async editScene(ctx) {
    const sceneId = validateId(ctx.body?.sceneId, "scene");
    const raw = validateEditInstruction(ctx.body?.instruction);
    requirePaid(ctx);
    await requirePaidCalls(SMALL_USD);
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

  /** Free, once: redraw a picture our automatic check flagged (today's prompt; SQL enforces the rules). */
  async regenerateSceneFree(ctx) {
    const sceneId = validateId(ctx.body?.sceneId, "scene");
    const { row } = await loadSceneStory(ctx.userId, sceneId);
    return runStep(ctx, "free_regenerate", row.id, { sceneId });
  },

  animateAll: (ctx) => runStep(ctx, "animate", validateId(ctx.body?.storyId)),

  async regenerateClip(ctx) {
    const sceneId = validateId(ctx.body?.sceneId, "scene");
    const { row } = await loadSceneStory(ctx.userId, sceneId);
    return runStep(ctx, "reclip", row.id, { sceneId });
  },

  /** Free: title, caption, pinned comment and hashtags for posting (small model, logged, saved once). */
  async uploadPackage(ctx) {
    requirePaid(ctx);
    const storyId = validateId(ctx.body?.storyId);
    await rateLimit(ctx.userId, "read");
    const { row, scenes } = await loadStory(ctx.userId, storyId);
    if (row.upload_package && !ctx.body?.refresh) return row.upload_package;
    if (row.status !== "final_ready") throw new BlockyError("WRONG_STATUS", "Make the final video first.", 409);
    await requirePaidCalls(SMALL_USD);
    const lib = await libraryMap();
    const nameOf = (id: string) => lib.get(id)?.name ?? id;
    let episode: any = null;
    if (row.series_id) {
      const s = must(await admin.from("blocky_series").select("title").eq("id", row.series_id).maybeSingle());
      const next = must(await admin.from("blocky_series_episodes").select("number, title").eq("series_id", row.series_id).eq("number", (row.episode_number ?? 0) + 1).maybeSingle());
      episode = { number: row.episode_number, seriesTitle: s?.title ?? "", nextNumber: next?.number ?? null, nextTitle: next?.title ?? null };
    }
    const pkg = await writeUploadPackage({
      admin, apiKey: LLM_ENV.OPENAI_API_KEY,
      input: {
        title: row.title, episode,
        lines: [...scenes].sort((a: any, b: any) => a.idx - b.idx).map((s: any) => ({ speaker: nameOf(s.speaker_id), line: s.line })),
        roles: Object.fromEntries(Object.entries(row.cast_roles ?? {}).map(([id, role]) => [nameOf(id), role])),
      },
      ids: { user_id: ctx.userId, story_id: storyId },
    }).catch((e: any) => { console.error("[blocky-story-api] upload package:", e?.message ?? e); throw new BlockyError("PACKAGE_FAILED", "We couldn't write the post text. Try again.", 502); });
    const { costUsd, ...saved } = pkg;
    await admin.from("blocky_stories").update({ upload_package: saved }).eq("id", storyId);
    return saved;
  },

  /** Free: joins the clips on a per-job Fly machine (render-worker/src/blockyFinal.mjs). */
  async buildFinal(ctx) {
    requirePaid(ctx);
    const storyId = validateId(ctx.body?.storyId);
    await rateLimit(ctx.userId, "step");
    return startFinal(ctx.userId, storyId, { captions: ctx.body?.captions !== false, partLabel: ctx.body?.partLabel, endCard: ctx.body?.endCard });
  },
};

/**
 * Starts a final build. Called by the user's button (buildFinal) and by
 * blocky-worker the moment a story's last clip is ready (autoFinal), so a
 * video is finished even when the user has closed the tab. Free either way.
 */
async function startFinal(userId: string, storyId: string, opts: { captions?: boolean; partLabel?: unknown; endCard?: unknown; auto?: boolean }) {
    const captions = opts.captions !== false;
    const { row, scenes } = await loadStory(userId, storyId);
    const story = toStory(row, scenes);
    // Already building (the automatic build beat the button): nothing to start, just show it.
    if (row.status === "building") return story;
    const blocker = stepBlocker("final", story, story.scenes);
    if (blocker) throw new BlockyError("WRONG_STATUS", blocker, 409);
    if (!FLY_API_TOKEN) throw blockyError("FINAL_FAILED");
    // Free for the user, but the machine and the caption transcripts cost us a little: the switch and the cap cover them too.
    await requirePaidCalls(SMALL_USD);

    // Series options: "Part N" at the start and an end card. On for episodes and off
    // for singles the first time; after that, whatever the user last chose.
    const first = row.final_status === "none";
    const pick = (value: unknown, current: boolean) => (typeof value === "boolean" ? value : first ? Boolean(row.series_id) : current);
    const partLabel = pick(opts.partLabel, row.final_part_label);
    const endCard = pick(opts.endCard, row.final_end_card);
    let nextTitle: string | null = null;
    if (row.series_id && endCard) {
      const next = must(await admin.from("blocky_series_episodes").select("title").eq("series_id", row.series_id).eq("number", (row.episode_number ?? 0) + 1).maybeSingle());
      nextTitle = next?.title ?? null;
    }

    const callId = crypto.randomUUID();
    const path = finalPath(userId, storyId, callId);
    const coverPath = path.replace(/final-([^/]+)\.mp4$/, "cover-$1.jpg");
    const [{ data: signed, error: signErr }, { data: coverSigned }] = await Promise.all([
      admin.storage.from("generated").createSignedUploadUrl(path, { upsert: true }),
      admin.storage.from("generated").createSignedUploadUrl(coverPath, { upsert: true }),
    ]);
    if (signErr || !signed?.signedUrl) { console.error("[blocky-story-api] signed upload:", signErr?.message); throw blockyError("FINAL_FAILED"); }
    // The cover: the most dramatic scene picture with the title (ffmpeg, never AI text).
    const coverFrom = coverScene(scenes);
    const job = buildFinalJob({
      story: row, scenes, callId, captions,
      uploadUrl: signed.signedUrl,
      callbackUrl: `${SUPABASE_URL}/functions/v1/blocky-worker`,
      token: await webhookToken(WORKER_SECRET, `final:${callId}`),
      overlays: overlayTexts({ partLabel, endCard, episodeNumber: row.episode_number ?? null, nextTitle }),
      cover: coverFrom && coverSigned?.signedUrl
        ? { imageUrl: coverFrom.image_url, label: row.episode_number ? `Episode ${row.episode_number}` : "", title: row.title, uploadUrl: coverSigned.signedUrl, sceneIndex: coverFrom.idx }
        : null,
    });
    // Each clip's transcript (made by the clip check, cached per clip URL): the
    // builder trims to the last spoken word and times the captions to the words.
    // When the voice really changed the line, the caption shows what was said.
    {
      const ordered = [...scenes].sort((a: any, b: any) => a.idx - b.idx);
      const transcripts = await transcriptsForClips({
        admin, apiKey: LLM_ENV.OPENAI_API_KEY, paidOff: false, userId, storyId,
        clips: ordered.map((s: any) => ({ sceneId: s.id, url: s.clip_url, durationSec: Number(s.duration_sec) })),
      });
      job.clips.forEach((c: any, i: number) => {
        const t = transcripts[i];
        if (!t?.words?.length) return;
        c.words = t.words;
        // Only when the difference matters (a dropped name, another word): a slur keeps the written line.
        if (spokenDiff(c.line, t.text).matters) c.caption = String(t.text).trim();
      });
      // ONE caption track, always. A clip the video model drew its own subtitles into gets no caption of
      // ours on top (an empty caption: the builder then draws nothing for that clip, and still trims by its words).
      const { data: clipJobs } = await admin.from("blocky_jobs").select("id, attempt").eq("story_id", storyId).eq("kind", "clip");
      const { data: frameChecks } = await admin.from("blocky_ai_calls").select("job_id, attempt, created_at, response").eq("story_id", storyId).eq("purpose", "clip_frame_check");
      const drawn = scenesWithDrawnText(ordered.map((s: any) => ({ id: s.id, clip_job_id: s.clip_job_id })), clipJobs ?? [], frameChecks ?? [], DRAWN_TEXT_PROBLEM);
      job.clips.forEach((c: any, i: number) => { if (drawn.has(ordered[i].id)) { c.caption = ""; c.drawnText = true; } });
      if (drawn.size) console.log(`[blocky-story-api] final ${storyId}: ${drawn.size} clip(s) carry subtitles drawn by the video model; our caption is left off them`);
    }
    // The clip check's log for this story: how many clips were made again, and what that and the checks cost.
    let clipCheck: any = null;
    try {
      const [{ data: jobs }, { data: calls }] = await Promise.all([
        admin.from("blocky_jobs").select("id, kind, error").eq("story_id", storyId).eq("kind", "clip"),
        admin.from("blocky_ai_calls").select("job_id, purpose, ok, cost_usd, attempt").eq("story_id", storyId).in("purpose", ["clip", "caption_words", "clip_frame", "clip_frame_check"]),
      ]);
      clipCheck = remakeStats(jobs ?? [], calls ?? []);
      console.log(`[blocky-story-api] clip check ${storyId}: ${clipCheck.remade} of ${clipCheck.clips} clips remade ($${clipCheck.remakeCostUsd}), checks $${clipCheck.checkCostUsd}`);
    } catch (e) { console.error("[blocky-story-api] clip check stats:", (e as Error)?.message ?? e); }
    const moved = must(await admin.from("blocky_stories")
      .update({ status: "building", final_status: "building", final_captions: captions, final_part_label: partLabel, final_end_card: endCard, final_requested_at: new Date().toISOString(), final_error: null, final_call_id: callId })
      .eq("id", storyId).in("status", ["clips_ready", "final_ready"]).select("id"));
    if (!moved.length) throw blockyError("WRONG_STATUS");
    must(await admin.from("blocky_ai_calls").insert({
      id: callId, user_id: userId, story_id: storyId, provider: "fly", model: `${FINAL_MACHINE.cpu_kind}-${FINAL_MACHINE.cpus}x`, purpose: "final",
      request: { ...job, auto: Boolean(opts.auto), clipCheck, clips: job.clips.map((c: any) => ({ url: c.url, line: c.line, words: c.words ? c.words.length : null, ...(c.caption ? { caption: c.caption } : {}), ...(c.drawnText ? { drawnText: true, caption: "" } : {}) })), uploadUrl: "(signed, one-time)", token: "(hmac)", path, coverPath, cover: job.cover ? { ...job.cover, uploadUrl: "(signed, one-time)" } : null },
    }));

    const t0 = Date.now();
    const res = await fetch(`https://api.machines.dev/v1/apps/${FLY_APP}/machines`, {
      method: "POST", headers: { Authorization: `Bearer ${FLY_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(finalMachineConfig({ image: BLOCKY_FINAL_IMAGE, job })),
      signal: AbortSignal.timeout(30_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any);
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      console.error(`[blocky-story-api] Fly machine start failed ${res.status}:`, detail);
      await admin.from("blocky_ai_calls").update({ ok: false, http_status: res.status, error: `machine start: ${detail}`, cost_usd: 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString() }).eq("id", callId);
      await admin.from("blocky_stories").update(storyUpdateForReport({ ok: false }, null, MESSAGES.FINAL_FAILED)).eq("id", storyId).eq("final_call_id", callId);
      throw blockyError("FINAL_FAILED");
    }
    const machine = await res.json().catch(() => ({}));
    await admin.from("blocky_ai_calls").update({ http_status: res.status, response: { machineId: machine?.id ?? null, region: machine?.region ?? null } }).eq("id", callId);
    const fresh = await loadStory(userId, storyId);
    return toStory(fresh.row, fresh.scenes, fresh.spent);
}

Object.assign(ACTIONS, {
  /** Free: the series outline (title, logline, bible with fixed roles, episodes with cliffhangers). */
  async createSeriesPlan(ctx) {
    await requireSeries(ctx.userId);
    requirePaid(ctx);
    const lib = await libraryMap();
    const input = validateSeriesPlan(ctx.body?.input, lib);
    await rateLimit(ctx.userId, "series");
    await requirePaidCalls(WRITER_USD);
    if (await providerOnHold(admin, BLOCKY_MODELS.planner.provider)) throw blockyError("PROVIDER_UNAVAILABLE");
    const row = must(await admin.from("blocky_series").insert({
      user_id: ctx.userId, concept: input.concept, cast_ids: input.castIds, tone: input.tone, opener: input.opener, episode_count: input.episodeCount,
    }).select("id").single());
    try {
      const { outline, attempts, callIds, costUsd, model } = await planSeries({
        admin, env: LLM_ENV, userId: ctx.userId, seriesId: row.id,
        input: { concept: input.concept, cast: input.castIds.map((id: string) => lib.get(id)), opener: input.opener, tone: input.tone, episodeCount: input.episodeCount },
      });
      must(await admin.from("blocky_series").update({
        title: outline.title, logline: outline.logline,
        bible: {
          text: outline.bible, locations: outline.locations, characters: outline.characters, setups: outline.setups,
          planner: { provider: model.provider, model: model.model, attempts, callIds, costUsd },
        },
      }).eq("id", row.id));
      must(await admin.from("blocky_series_episodes").insert(outline.episodes.map((e: any) => ({
        series_id: row.id, user_id: ctx.userId, number: e.number, title: e.title, summary: e.summary, cliffhanger: e.cliffhanger,
      }))));
    } catch (e) {
      await admin.from("blocky_series").delete().eq("id", row.id);
      throw e;
    }
    return seriesView(ctx.userId, row.id);
  },

  async getSeries(ctx) {
    await requireSeries(ctx.userId);
    await rateLimit(ctx.userId, "read");
    return seriesView(ctx.userId, validateId(ctx.body?.seriesId, "series"));
  },

  async listSeries(ctx) {
    await requireSeries(ctx.userId);
    await rateLimit(ctx.userId, "read");
    return listSeriesCards(ctx.userId);
  },

  async listRecent(ctx) {
    await rateLimit(ctx.userId, "read");
    if (ctx.body?.type === "series") { await requireSeries(ctx.userId); return listSeriesCards(ctx.userId); }
    const rows = must(await admin.from("blocky_stories").select("*").eq("user_id", ctx.userId).is("series_id", null).is("deleted_at", null)
      .neq("status", "draft").order("created_at", { ascending: false }).limit(30));
    if (!rows.length) return [];
    const scenes = must(await admin.from("blocky_story_scenes").select("story_id, idx, image_url").in("story_id", rows.map((r: any) => r.id)).lt("idx", 3));
    return rows.map((r: any) => toRecentSingle(r, scenes.filter((s: any) => s.story_id === r.id)));
  },
});

/**
 * blocky-worker, when a story's last clip is ready: build the final video
 * without waiting for the button. Only the first time (a story that was never
 * built), only when every clip is there, and never for a user who is no
 * longer on a paid plan. Returns what happened; never throws to the worker.
 */
async function autoFinal(storyId: string) {
  const row = must(await admin.from("blocky_stories").select("id, user_id, status, final_status").eq("id", storyId).is("deleted_at", null).maybeSingle());
  if (!row) return { started: false, reason: "no story" };
  if (row.status !== "clips_ready" || (row.final_status && row.final_status !== "none")) return { started: false, reason: `status ${row.status}/${row.final_status}` };
  const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", row.user_id).maybeSingle();
  if (!PAID_PLANS.has(String(profile?.plan_code ?? "free").toLowerCase().trim())) return { started: false, reason: "no paid plan" };
  try {
    await startFinal(row.user_id, storyId, { captions: true, auto: true });
    return { started: true };
  } catch (e) {
    return { started: false, reason: String((e as any)?.code ?? (e as Error)?.message ?? e).slice(0, 120) };
  }
}

async function seriesView(userId: string, seriesId: string) {
  const s = must(await admin.from("blocky_series").select("*").eq("id", seriesId).eq("user_id", userId).is("deleted_at", null).maybeSingle());
  if (!s) throw new BlockyError("NOT_FOUND", "This series doesn't exist anymore.", 404);
  const episodes = must(await admin.from("blocky_series_episodes").select("*").eq("series_id", seriesId).order("number"));
  const storyIds = episodes.map((e: any) => e.story_id).filter(Boolean);
  const stories = storyIds.length ? must(await admin.from("blocky_stories").select("id, status").in("id", storyIds)) : [];
  const b = s.bible ?? {};
  return {
    id: s.id, title: s.title, logline: s.logline, castIds: s.cast_ids, createdAt: s.created_at,
    episodes: episodeStatuses(episodes, new Map(stories.map((x: any) => [x.id, x.status]))),
    // The series bible, read-only in the UI.
    bible: {
      text: b.text ?? "",
      locations: (b.locations ?? []).map((l: any) => ({ id: l.id, description: l.description, plateUrl: l.plates?.["9:16"] ?? l.plates?.["16:9"] ?? null })),
      characters: b.characters ?? [],
      setups: b.setups ?? [],
    },
  };
}

async function listSeriesCards(userId: string) {
  const list = must(await admin.from("blocky_series").select("*").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(30));
  if (!list.length) return [];
  const eps = must(await admin.from("blocky_series_episodes").select("series_id, number, story_id").in("series_id", list.map((s: any) => s.id)));
  const storyIds = eps.map((e: any) => e.story_id).filter(Boolean);
  const stories = storyIds.length ? must(await admin.from("blocky_stories").select("id, status").in("id", storyIds)) : [];
  const status = new Map(stories.map((x: any) => [x.id, x.status]));
  const thumbs = storyIds.length ? must(await admin.from("blocky_story_scenes").select("story_id, idx, image_url").in("story_id", storyIds).lt("idx", 3)) : [];
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
    if (!token) throw blockyError("UNAUTHORIZED");
    const body = await req.json().catch(() => ({}));
    // Service call from blocky-worker (its secret, not a user session): the automatic final build.
    if (body?.action === "autoFinal") {
      if (!WORKER_SECRET || !sameToken(req.headers.get("x-blocky-worker-secret") ?? "", WORKER_SECRET)) throw blockyError("UNAUTHORIZED");
      return reply({ ok: true, data: await autoFinal(validateId(body?.storyId)) });
    }
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) throw blockyError("UNAUTHORIZED");

    const handler = ACTIONS[body?.action];
    if (!handler) throw new BlockyError("VALIDATION", "Unknown action.", 400);
    await requireSwitchedOn(user.id);

    const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", user.id).maybeSingle();
    const plan = String(profile?.plan_code ?? "free").toLowerCase().trim();
    const data = await handler({ userId: user.id, plan, body });
    return reply({ ok: true, data });
  } catch (e) {
    const err = e instanceof BlockyError ? e : fromDbError(e);
    if (!(e instanceof BlockyError)) console.error("[blocky-story-api] unexpected:", (e as Error)?.message ?? e);
    return reply(errorBody(err), err.status ?? 500);
  }
});
