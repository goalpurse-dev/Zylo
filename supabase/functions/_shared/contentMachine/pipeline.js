// Content Machine: the slideshow pipeline, one handler per job stage (cm_jobs.stage). The worker
// (content-machine-worker) claims jobs and calls runJob; everything it needs is passed in (deps), so the
// whole run can be driven in a test with fakes.
//
//   plan         run   → the day's recipes (planner.js) → one idea per slideshow → write (or write_batch)
//   write        idea  → CM_MODEL_MAIN + web search writes the slides (checked; one retry) → check
//   write_batch  run   → the same requests through the Batch API (half price; the daily run) → poll_batch
//   poll_batch   run   → when the batch has ended: settle each request, store each slideshow → check
//   check        idea  → CM_MODEL_FAST: captions per platform + compliance check → images (or rewrite once)
//   rewrite      idea  → CM_MODEL_MAIN rewrites what failed the check → check again (then it is flagged)
//   images       idea  → Runware: the style's background + up to 3 illustrations (no text in images) → render
//   render       idea  → a Fly machine draws PNGs, ZIP and MP4 → render_wait
//   render_wait  idea  → the manifest appeared: settle Fly's time, the slideshow is done
//
// Every paid call goes through deps.guard. A BudgetStopped marks the idea skipped_budget and the run
// goes on with the others; the kill switch puts the job back to wait instead.
import { BudgetStopped } from "./budgetGuard.js";
import { inExperimentPhase, planRecipes } from "./planner.js";
import { estimateUsd, jsonFromMessage, priceFor } from "./providers/anthropic.js";
import { IMAGE_ESTIMATE_USD } from "./providers/runware.js";
import { RENDER_ESTIMATE_USD, RENDER_TIMEOUT_MS, renderCostUsd } from "./providers/fly.js";
import { localDay } from "./spendSummary.js";
import { LAYOUT_VERSION, domain } from "./slides/templates.js";
import { assetUpdate, tagRequest } from "./assets.js";
import { qaFindings, qaRequest } from "./qa.js";
import { postMetrics, scorePosts } from "./analytics.js";
import { LEARNING_RULES, featureBreakdown, freshness, learn } from "./learning.js";
import { SNAPSHOT_COLUMNS, analysisRequest, analystPosts, scoutRequest } from "./agents.js";
import { citable } from "./zyvoLane.js";
import { usableAssets, mockPackage, mockSlideshow, nearDuplicate, packageProblems, packageRequest, rewriteRequest, slideshowProblems, utmLinks, writeRequest } from "./writer.js";

export const LANE = "slideshow";
const TERMINAL = new Set(["done", "failed", "skipped_budget", "rejected", "cancelled"]);
// The real Zyvo screen on a Zyvo slide without an asset: a tight, readable crop of one feature (the Long
// Form niche + style picker), not the whole home page (flagged as unreadable on a phone, 2026-10-18).
export const ZYVO_SHOT_PATH = "assets/zyvo-ui-picker.png";
// At most this many generated pictures per slideshow (a background + a hero for each slide).
export const MAX_IMAGES = 11;

// Reservation ceilings (the actual cost replaces them): writing reads search results, so input is large.
export const ESTIMATES = {
  write: (model, batch = false) => estimateUsd({ model, inputTokens: 30_000, outputTokens: 9_000, searches: 4, batch }),
  rewrite: (model) => estimateUsd({ model, inputTokens: 12_000, outputTokens: 9_000 }),
  package: (model) => estimateUsd({ model, inputTokens: 8_000, outputTokens: 3_000 }),
};

export class Retry extends Error {
  constructor(message, delaySec = 60) { super(message); this.retry = true; this.delaySec = delaySec; }
}

/**
 * deps: { db, guard, ai: {createMessage, createBatch, getBatch, batchResults}, images: {generateImage},
 *         fly: {startRender}, files: {signedUpload(path), signedUrl(path, sec), exists(path), readJson(path)},
 *         env: {anthropicKey, runwareKey, runwareBase, flyToken, flyApp, flyImage, fallbacks}, now: () => Date }
 */
export async function runJob(job, deps) {
  const handler = HANDLERS[job.stage];
  if (!handler) throw new Error(`unknown stage ${job.stage}`);
  // Cancel (owner, 2026-10-18): no new paid step for a cancelled run. A render already running is still
  // collected (it was paid for), so anything finished is kept.
  if (job.run_id && job.stage !== "render_wait") {
    const run = await deps.db.getRun(job.run_id);
    if (run?.status === "cancelled") {
      if (job.idea_id) {
        const idea = await deps.db.getIdea(job.idea_id);
        if (idea && !TERMINAL.has(idea.status)) await deps.db.updateIdea(job.idea_id, { status: "cancelled" });
      }
      await deps.db.finishJob(job.id, "cancelled", "the run was cancelled");
      return "cancelled";
    }
  }
  try {
    const next = await handler(job, deps);
    await deps.db.finishJob(job.id, "done");
    return next ?? "done";
  } catch (e) {
    if (e instanceof BudgetStopped && e.reason === "kill_switch") {
      await deps.db.requeueJob(job.id, { delaySec: 300, error: "kill switch on", keepAttempt: true });
      return "waiting_kill_switch";
    }
    if (e instanceof BudgetStopped) {
      if (job.idea_id) await stopIdea(deps, job.idea_id, "skipped_budget", e.message);
      await deps.db.finishJob(job.id, "done", e.message);
      return "skipped_budget";
    }
    if (e?.retry) {
      await deps.db.requeueJob(job.id, { delaySec: e.delaySec, error: e.message, keepAttempt: true, payload: e.payload });
      return "waiting";
    }
    // A provider's rate limit (HTTP 429) is a wait, not a failure: up to 10 waits, then it counts.
    const waits = Number(job.payload?.rateWaits ?? 0);
    if ((e?.status === 429 || /rate_limit|\b429\b/.test(String(e?.message))) && waits < 10) {
      await deps.db.requeueJob(job.id, { delaySec: 60 + waits * 30, error: "rate limited: waiting", keepAttempt: true, payload: { ...(job.payload ?? {}), rateWaits: waits + 1 } });
      return "rate_limited";
    }
    if (job.attempts < job.max_attempts && !e?.final) {
      await deps.db.requeueJob(job.id, { delaySec: 120, error: String(e?.message ?? e) });
      return "retry";
    }
    if (job.idea_id) await stopIdea(deps, job.idea_id, "failed", String(e?.message ?? e));
    else if (job.run_id) await deps.db.updateRun(job.run_id, { status: "failed", finished_at: deps.now().toISOString(), notes: String(e?.message ?? e).slice(0, 500) });
    await deps.db.finishJob(job.id, "failed", String(e?.message ?? e));
    return "failed";
  }
}

async function stopIdea(deps, ideaId, status, error) {
  const idea = await deps.db.updateIdea(ideaId, { status, error: String(error).slice(0, 500) });
  if (idea?.run_id) await finishRunIfDone(deps, idea.run_id);
}

export async function finishRunIfDone(deps, runId) {
  const ideas = await deps.db.ideasOfRun(runId);
  const current = await deps.db.getRun(runId);
  if (current?.status === "cancelled") {
    if (ideas.every((i) => TERMINAL.has(i.status))) await deps.db.updateRun(runId, { finished_at: current.finished_at ?? deps.now().toISOString(), spend_usd: await deps.db.runSpend(runId) });
    return true;
  }
  if (!ideas.length || !ideas.every((i) => TERMINAL.has(i.status))) return false;
  const spend = await deps.db.runSpend(runId);
  const anyDone = ideas.some((i) => i.status === "done");
  const allBudget = ideas.every((i) => i.status === "skipped_budget");
  await deps.db.updateRun(runId, { status: anyDone ? "done" : allBudget ? "budget_stopped" : "failed", finished_at: deps.now().toISOString(), spend_usd: spend });
  return true;
}

const models = (s, env) => ({ main: s.models?.main || env.modelMain || "claude-sonnet-5-5", fast: s.models?.fast || env.modelFast || "claude-haiku-5-5" });
// The refusal fallback (owner, 2026-10-18): kept, but done here, not by the API: a second call through the
// Budget Guard like any other, and only to a model that costs no more than the main one per token.
export const FALLBACK_MODEL = "claude-sonnet-5";
export function fallbackModel(env, main) {
  if (!env.fallbacks) return null;
  const fb = env.modelFallback || FALLBACK_MODEL;
  if (fb === main) return null;
  const a = priceFor(main), b = priceFor(fb);
  return b.input <= a.input && b.output <= a.output && b.cacheWrite5m <= a.cacheWrite5m ? fb : null;
}

/** A main-model call through the guard; on a refusal, ONE retry on the fallback model, also through the guard. */
/** Guard options for a slideshow's paid calls: its lane, its run, and "live" for an owner-ordered real run. */
export async function paidOpts(deps, idea, extra = {}) {
  const run = idea.run_id ? await deps.db.getRun(idea.run_id) : null;
  return { lane: LANE, runId: idea.run_id, ideaId: idea.id, live: run?.input?.live === true, ...extra };
}

async function callMain(deps, { operation, request, idea, estimate }) {
  const opts = await paidOpts(deps, idea, { mock: async () => ({ dry: true }) });
  const once = (req, op) => deps.guard.spend("anthropic", op, estimate(req.model), async (ticket) => {
    const out = await deps.ai.createMessage(ticket, { apiKey: deps.env.anthropicKey, request: req });
    return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
  }, opts);
  try {
    return await once(request, operation);
  } catch (e) {
    const fb = e?.refusal ? fallbackModel(deps.env, request.model) : null;
    if (!fb) throw e;
    deps.log?.(`[content-machine] ${operation} refused on ${request.model}; trying ${fb}`);
    return once({ ...request, model: fb }, `${operation}.fallback`);
  }
}

/* ─── plan ───────────────────────────────────────────────────────────── */

async function plan(job, deps) {
  const { db } = deps;
  const run = await db.getRun(job.run_id);
  const s = await db.settings();
  const today = localDay(deps.now(), s.timezone);
  const library = await db.library();
  const history = await db.recentRecipes(120);
  const lanes = (await db.lanes?.()) ?? {};
  const assets = (await db.activeAssets?.()) ?? [];
  const posts = await postsForLearning(deps);
  const count = Math.max(1, Math.min(20, Number(run.input?.count) || s.slideshows_per_day));
  // The two accounts (owner, 2026-10-19): a lane's batch makes only that lane; the daily run makes each lane's
  // own count (Settings). Each lane plans with its own formats, history, posting times and winners.
  const perLane = run.account ? { [run.account]: count } : run.input?.lanes ?? { creator: count };
  const experimentPhase = inExperimentPhase({ startedOn: s.experiment_started_on, today, days: s.experiment_days });
  const recipes = [];
  for (const [account, n] of Object.entries(perLane)) {
    if (!(n > 0)) continue;
    const winnersShare = (s.winners_per_day ?? 3) / Math.max(1, (s.winners_per_day ?? 3) + (s.experiments_per_day ?? 2));
    recipes.push(...planRecipes({
      library: laneLibrary(library, account, assets), history, count: Math.min(20, n), seed: `${run.id}-${account}`, topic: run.input?.topic || null,
      experimentPhase,
      // Winners (Phase 3): this lane's recipes with repeated success, fresh-weighted (learning.js), after the experiment phase.
      winners: learn(posts.filter((p) => (p.idea?.account ?? p.idea?.recipe?.account ?? "creator") === account), { now: deps.now(), halfLife: s.half_life_days ?? 14, minSuccesses: s.winner_min_successes ?? 3 }).winners.map((w) => w.recipe),
      winnersPerDay: Math.round(n * winnersShare),
      lane: { key: account, postTimes: lanes[account]?.post_times },
    }));
  }
  if (!recipes.length) throw Object.assign(new Error("nothing to plan (no lane has slideshows)"), { final: true });
  if (!run.dry_run && !s.experiment_started_on) await db.updateSettings({ experiment_started_on: today });
  const ideas = await db.createIdeas(recipes.map((r) => ({
    run_id: run.id, status: "producing", source: run.input?.topic ? "owner" : "machine", format: r.format, zyvo_tool: null, account: r.account ?? "creator",
    title: "(being written)", recipe: r, topic: r.topic, dry_run: run.dry_run, target_platforms: ["tiktok", "instagram", "youtube"],
  })));
  await db.updateRun(run.id, { status: "ideating", started_at: run.started_at ?? deps.now().toISOString() });
  const batch = run.kind === "daily" && s.use_batch_for_daily && !run.dry_run && ideas.length > 1;
  if (batch) await db.enqueue([{ run_id: run.id, stage: "write_batch" }]);
  else await db.enqueue(ideas.map((i) => ({ run_id: run.id, idea_id: i.id, stage: "write" })));
  return `planned ${ideas.length}`;
}

/* ─── write ──────────────────────────────────────────────────────────── */

async function writeContext(deps, idea) {
  const s = await deps.db.settings();
  const trends = (await deps.db.listScouts?.(1))?.[0]?.trend_brief ?? "";
  const account = idea.account ?? idea.recipe?.account ?? "creator";
  const lane = ((await deps.db.lanes?.()) ?? {})[account] ?? null;
  const facts = (await deps.db.facts?.()) ?? [];
  const assets = (await deps.db.activeAssets?.()) ?? [];
  return {
    s, account, facts, brandRules: lane?.brand_rules || s.brand_rules,
    library: laneLibrary(await deps.db.library(), account, assets), recent: await deps.db.recentTitles(30, idea.id), today: localDay(deps.now(), s.timezone), m: models(s, deps.env), assets,
    extra: { playbook: (lane ? lane.playbook : s.playbook) ?? "", trends, facts },
  };
}

/** A lane's part of the library: its formats and styles (cm_library.lanes); "Prompt → result" only with 2+ assets whose prompt is recorded. */
export function laneLibrary(library, account = "creator", assets = []) {
  const mine = (r) => (r.lanes ?? ["creator"]).includes(account);
  const prompted = usableAssets(assets).filter((a) => String(a.prompt ?? "").trim()).length;
  return {
    formats: library.formats.filter((f) => mine(f) && (f.spec?.requires !== "asset_prompts" || prompted >= 2)),
    styles: library.styles.filter(mine), hooks: library.hooks.filter(mine),
  };
}

/** What the program checks a slideshow against: the usable assets (and their recorded prompts) and the fact keys. */
function checkOpts(assets, facts) {
  const usable = usableAssets(assets);
  return { assetRefs: new Set(usable.map((a) => a.ref)), assetPrompts: new Map(usable.filter((a) => a.prompt).map((a) => [a.ref, a.prompt])), factKeys: new Set(citable(facts).map((x) => x.key)) };
}

/** Program checks + near-duplicates. Returns the problems (empty = keep it). */
function judge(slideshow, idea, recent, assets = [], facts = []) {
  const problems = slideshowProblems(slideshow, idea.recipe, checkOpts(assets, facts));
  const dup = nearDuplicate(slideshow, recent);
  if (dup) problems.push(`too close to an earlier post ("${dup.title}"): pick a different angle`);
  return problems;
}

async function saveSlideshow(deps, idea, slideshow) {
  const zyvoSlides = slideshow.slides.map((x, i) => (x.is_zyvo ? i + 1 : null)).filter(Boolean);
  await deps.db.updateIdea(idea.id, {
    title: slideshow.title.slice(0, 200), hook: slideshow.hook, concept: slideshow.hypothesis, hypothesis: slideshow.hypothesis,
    topic: slideshow.topic, script: slideshow, virality_score: slideshow.virality_score,
    why_it_could_go_viral: slideshow.why_it_could_go_viral,
    zyvo_integration: `slide ${zyvoSlides.join(", ")} · ${idea.recipe.cta_type}`,
  });
  await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "check" }]);
}

async function write(job, deps) {
  const idea = await deps.db.getIdea(job.idea_id);
  if (TERMINAL.has(idea.status)) return "idea already finished";
  const { library, recent, today, m, assets, extra, facts, brandRules } = await writeContext(deps, idea);
  const request = writeRequest({ model: m.main, brandRules, library, recipe: idea.recipe, today, avoidTitles: recent.map((r) => r.title), assets, ...extra });
  if (job.payload?.problems?.length) request.messages[0].content += `\n\nYOUR LAST ATTEMPT HAD THESE PROBLEMS, avoid them:\n${job.payload.problems.map((p) => `- ${p}`).join("\n")}`;
  if (job.payload?.note) request.messages[0].content += `\n\nNOTE: ${job.payload.note}`;
  const r = await callMain(deps, { operation: "anthropic.write", request, idea, estimate: (model) => ESTIMATES.write(model) });
  const slideshow = r.dryRun ? mockSlideshow(idea.recipe, usableAssets(assets), facts) : jsonFromMessage(r.result);
  const problems = r.dryRun ? [] : judge(slideshow, idea, recent, assets, facts);
  if (problems.length) {
    if (!job.payload?.problems) {
      await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "write", payload: { problems } }]);
      return `rewriting: ${problems.join("; ")}`;
    }
    throw Object.assign(new Error(`the slideshow failed the checks twice: ${problems.join("; ")}`), { final: true });
  }
  await saveSlideshow(deps, idea, slideshow);
  return "written";
}

/* ─── the daily run through the Batch API ────────────────────────────── */

async function writeBatch(job, deps) {
  const ideas = (await deps.db.ideasOfRun(job.run_id)).filter((i) => i.status === "producing" && !i.script?.slides);
  if (!ideas.length) return "nothing to write";
  const s = await deps.db.settings();
  const today = localDay(deps.now(), s.timezone);
  const m = models(s, deps.env);
  const recent = await deps.db.recentTitles(30, null);
  const assets = (await deps.db.activeAssets?.()) ?? [];
  const requests = [], ledger = {};
  let ticket = null;
  for (const idea of ideas) {
    try {
      const r = await deps.guard.reserve("anthropic", "anthropic.write.batch", ESTIMATES.write(m.main, true), { lane: LANE, runId: job.run_id, ideaId: idea.id });
      if (r.dryRun) { await deps.guard.settle(r.ledgerId, { actualUsd: 0, requestRef: "dry-run" }); await deps.db.enqueue([{ run_id: job.run_id, idea_id: idea.id, stage: "write" }]); continue; }
      ticket = ticket ?? r.ticket;
      ledger[idea.id] = r.ledgerId;
      const ctx = await writeContext(deps, idea);   // the idea's own lane: rules, formats, playbook, fact sheet
      requests.push({ custom_id: idea.id, params: writeRequest({ model: m.main, brandRules: ctx.brandRules, library: ctx.library, recipe: idea.recipe, today, avoidTitles: recent.map((x) => x.title), assets, ...ctx.extra }) });
    } catch (e) {
      if (!(e instanceof BudgetStopped) || e.reason === "kill_switch") throw e;
      await stopIdea(deps, idea.id, "skipped_budget", e.message);
    }
  }
  if (!requests.length) return "no batch needed";
  let batch;
  try {
    batch = await deps.ai.createBatch(ticket, { apiKey: deps.env.anthropicKey, requests });
  } catch (e) {
    for (const id of Object.values(ledger)) await deps.guard.settle(id, { actualUsd: 0, status: "failed", error: e.message });
    // The batch never started: write them one by one instead.
    await deps.db.enqueue(Object.keys(ledger).map((ideaId) => ({ run_id: job.run_id, idea_id: ideaId, stage: "write" })));
    return `batch refused (${e.message}); writing one by one`;
  }
  await deps.db.enqueue([{ run_id: job.run_id, stage: "poll_batch", payload: { batchId: batch.id, ledger, submittedAt: deps.now().toISOString() }, run_after: new Date(deps.now().getTime() + 60_000).toISOString() }]);
  return `batch ${batch.id} with ${requests.length}`;
}

async function pollBatch(job, deps) {
  const { batchId, ledger, submittedAt } = job.payload;
  const b = await deps.ai.getBatch({ apiKey: deps.env.anthropicKey, batchId });
  if (b.processing_status !== "ended") {
    if (deps.now() - new Date(submittedAt) > 26 * 3600_000) throw new Error("the batch never ended");
    throw Object.assign(new Retry(`batch ${b.processing_status}`, 90), { payload: job.payload });
  }
  const results = await deps.ai.batchResults({ apiKey: deps.env.anthropicKey, resultsUrl: b.results_url });
  for (const [ideaId, ledgerId] of Object.entries(ledger)) {
    const r = results[ideaId];
    const idea = await deps.db.getIdea(ideaId);
    if (!r || r.type !== "succeeded") {
      await deps.guard.settle(ledgerId, { actualUsd: r?.costUsd ?? 0, status: "failed", requestRef: batchId, error: r?.type ?? "missing" });
      await deps.db.enqueue([{ run_id: job.run_id, idea_id: ideaId, stage: "write" }]);
      continue;
    }
    await deps.guard.settle(ledgerId, { actualUsd: r.costUsd, requestRef: `${batchId}/${ideaId}` });
    let slideshow = null, problems;
    try { slideshow = jsonFromMessage(r.message); problems = judge(slideshow, idea, await deps.db.recentTitles(30, ideaId), (await deps.db.activeAssets?.()) ?? [], (await deps.db.facts?.()) ?? []); } catch (e) { problems = [e.message]; }
    if (problems.length) await deps.db.enqueue([{ run_id: job.run_id, idea_id: ideaId, stage: "write", payload: { problems } }]);
    else await saveSlideshow(deps, idea, slideshow);
  }
  return "batch collected";
}

/* ─── check: captions + compliance ───────────────────────────────────── */

async function check(job, deps) {
  const idea = await deps.db.getIdea(job.idea_id);
  if (TERMINAL.has(idea.status)) return "idea already finished";
  const s = await deps.db.settings();
  const m = models(s, deps.env);
  const links = utmLinks(idea.id);
  const { brandRules, facts } = await writeContext(deps, idea);   // the lane's rules; the Zyvo lane is checked against the fact sheet
  const r = await deps.guard.spend("anthropic", "anthropic.package", ESTIMATES.package(m.fast), async (ticket) => {
    const out = await deps.ai.createMessage(ticket, { apiKey: deps.env.anthropicKey, request: packageRequest({ model: m.fast, brandRules, recipe: idea.recipe, slideshow: idea.script, links, facts }) });
    return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
  }, await paidOpts(deps, idea, { mock: async () => ({ dry: true }) }));
  const pkg = r.dryRun ? mockPackage() : jsonFromMessage(r.result);
  const problems = [...(pkg.compliance?.ok ? [] : pkg.compliance?.problems ?? ["the compliance check failed"]), ...packageProblems(pkg)];
  const rewritten = Boolean(idea.compliance?.rewritten);
  if (problems.length && !rewritten && !r.dryRun) {
    await deps.db.updateIdea(idea.id, { compliance: { ...(idea.compliance ?? {}), ok: false, problems, rewritten: false } });
    await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "rewrite", payload: { problems } }]);
    return "rewrite needed";
  }
  const gen = await deps.db.ensureGeneration(idea.id);
  await deps.db.savePackages(gen.id, platformPackages(pkg, idea, links));
  await deps.db.updateIdea(idea.id, { compliance: { ...(idea.compliance ?? {}), ok: !problems.length, problems, rewritten, flagged: problems.length > 0 } });
  await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "images" }]);
  return problems.length ? "flagged" : "packaged";
}

export function platformPackages(pkg, idea, links) {
  const ai = Boolean(idea.script?.ai_label_required);
  const time = idea.recipe?.post_time ?? null;
  const sound = pkg.sound_suggestion ?? null;
  return [
    { platform: "tiktok", caption: pkg.tiktok.caption, title: pkg.tiktok.title ?? null, hashtags: pkg.tiktok.hashtags, on_screen_text: pkg.tiktok.on_screen_text ?? [], suggested_post_time: time, ai_label_required: ai, sound_suggestion: sound, compliance: { link: links.tiktok } },
    { platform: "instagram", caption: pkg.instagram.caption, title: null, hashtags: pkg.instagram.hashtags, on_screen_text: [], suggested_post_time: time, ai_label_required: ai, sound_suggestion: sound, compliance: { link: links.instagram } },
    { platform: "youtube", caption: pkg.youtube.description, title: pkg.youtube.title, hashtags: pkg.youtube.hashtags, on_screen_text: [], suggested_post_time: time, ai_label_required: ai, sound_suggestion: sound, compliance: { link: links.youtube } },
  ];
}

async function rewrite(job, deps) {
  const idea = await deps.db.getIdea(job.idea_id);
  if (TERMINAL.has(idea.status)) return "idea already finished";
  const { library, today, m, assets, extra, facts, brandRules } = await writeContext(deps, idea);
  const request = rewriteRequest({ model: m.main, brandRules, library, recipe: idea.recipe, today, slideshow: idea.script, problems: job.payload?.problems ?? [], assets, ...extra });
  const r = await callMain(deps, { operation: "anthropic.rewrite", request, idea, estimate: (model) => ESTIMATES.rewrite(model) });
  const slideshow = r.dryRun ? idea.script : jsonFromMessage(r.result);
  const problems = slideshowProblems(slideshow, idea.recipe, checkOpts(assets, facts));
  if (problems.length) throw Object.assign(new Error(`the rewrite failed the checks: ${problems.join("; ")}`), { final: true });
  // A layout rewrite (the text didn't fit) is counted apart from the compliance rewrite: one of each.
  const flag = job.payload?.layout ? { layoutRetried: true } : { rewritten: true };
  await deps.db.updateIdea(idea.id, { script: slideshow, title: slideshow.title.slice(0, 200), hook: slideshow.hook, compliance: { ...(idea.compliance ?? {}), ...flag } });
  await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "check" }]);
  return "rewritten";
}

/* ─── images ─────────────────────────────────────────────────────────── */

async function images(job, deps) {
  const idea = await deps.db.getIdea(job.idea_id);
  if (TERMINAL.has(idea.status)) return "idea already finished";
  const library = await deps.db.library();
  const style = library.styles.find((x) => x.key === idea.recipe.style) ?? library.styles[0];
  const gen = await deps.db.ensureGeneration(idea.id);
  const have = gen.source_assets ?? {};
  // heroes: {slide index: {url} (generated) | {asset: path, ref} (from the asset library)}.
  const assets = { background: have.background ?? null, heroes: { ...(have.heroes ?? {}) }, costs: { ...(have.costs ?? {}) }, ...(have.collages ? { collages: have.collages } : {}), ...(have.galleries ? { galleries: have.galleries } : {}) };
  const library_ = (await deps.db.activeAssets?.()) ?? [];
  const byRef = new Map(library_.map((a) => [a.ref, a]));
  const wanted = [];
  // The shared background: one per slideshow, for consistency (every style has one now).
  if (!assets.background && style.spec?.bg_prompt) wanted.push(["background", `${style.spec.bg_prompt}. Mood suited to: ${idea.topic ?? idea.title}`]);
  // One hero visual per slide: a library asset when the writer picked one (no cost), else a generated
  // picture in the style's own look (hero_prompt). Owner, 2026-10-18: "every slide needs a strong visual".
  // A showcase cover is the collage of the real outputs on its later slides (owner, 2026-10-18): no picture
  // of its own is generated.
  const showcase = idea.recipe?.format === "zyvo_showcase" && idea.script.slides[0]?.kind === "cover";
  if (showcase) {
    const outputs = idea.script.slides.slice(1).map((sl) => (sl.asset_id ? byRef.get(String(sl.asset_id)) : null)).filter(Boolean);
    const unique = [...new Map(outputs.map((a) => [a.ref, a])).values()].slice(0, 4);
    if (unique.length >= 2) { assets.collages = { 0: unique.map((a) => ({ asset: a.path, ref: a.ref })) }; delete assets.heroes[0]; }
  }
  // The Zyvo account's slides show several real outputs each, with their style / tool labels (owner, 2026-10-19).
  idea.script.slides.forEach((sl, i) => {
    const list = (sl.assets ?? []).map((x) => ({ a: byRef.get(String(x?.asset_id ?? "")), label: x?.label ?? null })).filter((x) => x.a);
    if (list.length) assets.galleries = { ...(assets.galleries ?? {}), [i]: list.map((x) => ({ asset: x.a.path, ref: x.a.ref, label: x.label })) };
  });
  idea.script.slides.forEach((sl, i) => {
    if (assets.heroes[i] || (i === 0 && assets.collages?.[0]) || assets.galleries?.[i]) return;
    const asset = sl.asset_id ? byRef.get(String(sl.asset_id)) : null;
    if (asset) { assets.heroes[i] = { asset: asset.path, ref: asset.ref }; return; }
    // A slide about Zyvo shows real Zyvo (its asset, else the real Zyvo screen): never a generated picture.
    if (sl.is_zyvo) return;
    if (!String(sl.image_prompt ?? "").trim()) return;
    const subject = String(sl.image_prompt).trim();
    const prompt = style.spec?.hero_prompt ? style.spec.hero_prompt.replace("{subject}", subject) : subject;
    if (wanted.length < MAX_IMAGES) wanted.push([i, prompt]);
  });
  const opts = await paidOpts(deps, idea, { mock: async () => null });
  for (const [slot, prompt] of wanted) {
    // No people at all in backgrounds and in the photoreal / 3D / product styles' pictures (text sits on
    // them, and a photoreal person risks a lookalike); the meme style's scenes may show invented characters.
    const kind = style.spec?.meme && slot !== "background" ? "meme" : "background";
    // Each picture is made at the shape of the frame it fills, so nothing needs cropping: heroes 4:3 (the
    // frame takes the picture's own shape), a meme picture tall (it fills the slide under the caption bar).
    const slide = slot === "background" ? null : idea.script.slides[slot];
    const memeLayout = slide && (slide.kind === "meme" || (style.spec?.meme && ["cover", "text", "cta"].includes(slide.kind)));
    const size = slot === "background" ? {} : memeLayout ? { width: 768, height: 1088 } : { width: 1024, height: 768 };
    // One retry per image. A second failure fails the slideshow: a placeholder is never posted.
    let r = null, last = null;
    for (let attempt = 1; attempt <= 2 && !r; attempt++) {
      try {
        r = await deps.guard.spend("runware", "runware.image.fast", IMAGE_ESTIMATE_USD, async (ticket) => {
          const out = await deps.images.generateImage(ticket, { apiKey: deps.env.runwareKey, baseUrl: deps.env.runwareBase, prompt, kind, ...size });
          return { result: out.url, actualUsd: out.costUsd, requestRef: out.taskUUID };
        }, opts);
      } catch (e) {
        if (e instanceof BudgetStopped) throw e;
        last = e;
      }
    }
    if (!r) throw Object.assign(new Error(`an image failed twice (${slot === "background" ? "background" : `slide ${slot + 1}`}): ${last?.message ?? "unknown"}`), { final: true });
    if (slot === "background") assets.background = r.result; else assets.heroes[slot] = { url: r.result };
    assets.costs[slot] = r.actualUsd;
    await deps.db.updateGeneration(gen.id, { source_assets: assets, status: "generating" });   // kept even if a later image fails
  }
  await deps.db.updateGeneration(gen.id, { source_assets: assets, status: "generating" });
  await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "render" }]);
  return `${wanted.length} images`;
}

/** The URLs the renderer gets for a slideshow's pictures: generated ones as they are, library assets signed. */
export async function heroUrls(deps, heroes = {}, seconds = 3600) {
  const out = {};
  for (const [i, h] of Object.entries(heroes)) {
    if (h?.url) out[i] = h.url;
    else if (h?.asset) out[i] = await deps.files.signedUrl(h.asset, seconds);
  }
  return out;
}

/** The Zyvo account's galleries: {slide index: [{url, label}]} (signed links, labels kept in order). */
export async function galleryUrls(deps, galleries = {}, seconds = 3600) {
  const out = {};
  for (const [i, list] of Object.entries(galleries ?? {})) {
    const rows = [];
    for (const g of list ?? []) { const url = g?.asset ? await deps.files.signedUrl(g.asset, seconds) : null; if (url) rows.push({ url, label: g.label ?? null }); }
    out[i] = rows;
  }
  return out;
}

/** The showcase covers' collages: {slide index: [signed urls]}. */
export async function collageUrls(deps, collages = {}, seconds = 3600) {
  const out = {};
  for (const [i, list] of Object.entries(collages ?? {})) out[i] = Object.values(await heroUrls(deps, { ...list }, seconds));
  return out;
}

/* ─── render ─────────────────────────────────────────────────────────── */

/** Signed links to the APPROVED logos of the tools on these slides (and Zyvo's own), keyed by domain and name. */
export async function logosFor(deps, slides) {
  const rows = (await deps.db.approvedLogos()) ?? [];
  const wanted = new Set(["tryzyvo.com", "zyvo"]);
  for (const s of slides) if (s.tool) { wanted.add(domain(s.tool.url)); wanted.add(String(s.tool.name).trim().toLowerCase()); }
  const out = {};
  for (const row of rows) {
    const keys = [row.domain, String(row.name).trim().toLowerCase()].filter((k) => wanted.has(k));
    if (!keys.length) continue;
    const display = row.display ?? "logo";
    // The owner's rules first: "name" (no mark) and "tile" (initials) apply whatever file there is.
    if (display !== "logo") { for (const k of keys) out[k] = { display }; continue; }
    if (!row.approved || !row.logo_path) continue;          // a file is used only once approved
    const url = await deps.files.signedUrl(row.logo_path, 3600);
    if (url) for (const k of keys) out[k] = url;
  }
  return out;
}

export function renderPaths(idea, day) {
  const base = `slideshows/${day}/${idea.id}`;
  const n = idea.script.slides.length;
  return {
    base,
    pngs: Array.from({ length: n }, (_, i) => `${base}/slide-${String(i + 1).padStart(2, "0")}.png`),
    zip: `${base}/slides.zip`, mp4: `${base}/slideshow.mp4`, manifest: `${base}/manifest.json`,
  };
}

async function render(job, deps) {
  const idea = await deps.db.getIdea(job.idea_id);
  if (TERMINAL.has(idea.status)) return "idea already finished";
  const gen = await deps.db.ensureGeneration(idea.id);
  const s = await deps.db.settings();
  const library = await deps.db.library();
  const style = library.styles.find((x) => x.key === idea.recipe.style) ?? library.styles[0];
  if (idea.dry_run) {
    // A dry run draws nothing on Fly (that would cost money); the admin page previews the slides live.
    await deps.db.updateGeneration(gen.id, { status: "done", files: { dryRun: true }, aspect: "9:16" });
    await deps.db.updateIdea(idea.id, { status: "done" });
    await finishRunIfDone(deps, idea.run_id);
    return "dry run: not rendered";
  }
  const paths = renderPaths(idea, localDay(deps.now(), s.timezone));
  const uploads = {
    pngs: await Promise.all(paths.pngs.map((p) => deps.files.signedUpload(p))),
    zip: await deps.files.signedUpload(paths.zip), mp4: await deps.files.signedUpload(paths.mp4), manifest: await deps.files.signedUpload(paths.manifest),
  };
  const renderJob = {
    ideaId: idea.id, slideshow: { slides: idea.script.slides }, style: style.spec,
    images: { background: gen.source_assets?.background ?? null, heroes: await heroUrls(deps, gen.source_assets?.heroes), collages: await collageUrls(deps, gen.source_assets?.collages), galleries: await galleryUrls(deps, gen.source_assets?.galleries) },
    zyvoShot: await deps.files.signedUrl(ZYVO_SHOT_PATH, 3600), uploads, secondsPerSlide: 2.5,
    logos: await logosFor(deps, idea.script.slides),
    // The renderer takes pictures only from these hosts: our own bucket and the image provider.
    allowedHosts: deps.env.allowedImageHosts ?? [],
    layoutVersion: LAYOUT_VERSION,
  };
  const r = await deps.guard.reserve("fly", "fly.render.slides", RENDER_ESTIMATE_USD, await paidOpts(deps, idea));
  let started;
  try {
    started = await deps.fly.startRender(r.ticket, { token: deps.env.flyToken, app: deps.env.flyApp, image: deps.env.flyImage, name: `cm-slides-${idea.id.slice(0, 8)}-${Date.now().toString(36)}`, job: renderJob });
  } catch (e) {
    await deps.guard.settle(r.ledgerId, { actualUsd: 0, status: "failed", error: e.message });
    throw e;
  }
  await deps.db.updateGeneration(gen.id, { status: "rendering" });
  await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "render_wait", payload: { ledgerId: r.ledgerId, startedAt: started.startedAt, machineId: started.machineId, paths }, run_after: new Date(deps.now().getTime() + 45_000).toISOString() }]);
  await deps.db.updateGeneration(gen.id, { layout_version: LAYOUT_VERSION });
  return "rendering";
}

async function renderWait(job, deps) {
  const { ledgerId, startedAt, paths, machineId } = job.payload;
  const idea = await deps.db.getIdea(job.idea_id);
  const gen = await deps.db.ensureGeneration(idea.id);
  const now = deps.now().getTime();
  const manifest = (await deps.files.exists(paths.manifest)) ? await deps.files.readJson(paths.manifest) : null;
  if (!manifest) {
    if (now - startedAt > RENDER_TIMEOUT_MS) {
      await deps.guard.settle(ledgerId, { actualUsd: renderCostUsd(startedAt, now), status: "failed", requestRef: machineId, error: "render timed out" });
      await deps.db.updateGeneration(gen.id, { status: "failed", error: "the render took too long" });
      throw Object.assign(new Error("the render took too long"), { final: true });
    }
    throw Object.assign(new Retry("rendering", 20), { payload: job.payload });
  }
  const cost = renderCostUsd(startedAt, now);
  if (!manifest.ok) {
    await deps.guard.settle(ledgerId, { actualUsd: cost, status: "failed", requestRef: machineId, error: manifest.error });
    const layout = Array.isArray(manifest.layout) ? manifest.layout : null;
    if (layout) {
      // The slides didn't pass the layout check (too much text, an overlap, outside the safe zone, a missing
      // image). Nothing was posted. Once: ask for shorter copy and render again. Twice: flag it and stop.
      const problems = layout.flatMap((l) => l.problems.map((p) => `slide ${l.slide}: ${p}`));
      if (!idea.compliance?.layoutRetried) {
        await deps.db.updateGeneration(gen.id, { status: "queued", error: null });
        await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "rewrite", payload: { layout: true, problems: [...problems, "make the text on these slides SHORTER so it fits"] } }]);
        return "layout: rewriting shorter";
      }
      await deps.db.updateIdea(idea.id, { compliance: { ...(idea.compliance ?? {}), flagged: true, ok: false, problems: [...(idea.compliance?.problems ?? []), ...problems] } });
      await deps.db.updateGeneration(gen.id, { status: "failed", error: `layout still fails after a shorter rewrite: ${problems.join("; ")}`.slice(0, 500) });
      throw Object.assign(new Error(`the layout still fails after a shorter rewrite: ${problems.join("; ")}`), { final: true });
    }
    await deps.db.updateGeneration(gen.id, { status: "failed", error: String(manifest.error).slice(0, 500) });
    throw Object.assign(new Error(`render failed: ${manifest.error}`), { final: true });
  }
  await deps.guard.settle(ledgerId, { actualUsd: cost, requestRef: machineId });
  await deps.db.updateGeneration(gen.id, {
    status: "done", video_path: paths.mp4, thumbnail_path: paths.pngs[0], duration_s: manifest.durationSec,
    files: { pngs: paths.pngs, zip: paths.zip, mp4: paths.mp4, sizes: manifest.sizes ?? null },
  });
  // Empty space (owner, 2026-10-18): a slide with more than ~25 % of the safe area unused still renders, but
  // the slideshow is marked for the owner.
  const empty = (manifest.warnings ?? []).flatMap((w) => w.warnings.map((x) => `slide ${w.slide}: ${x}`));
  if (empty.length) await deps.db.updateIdea(idea.id, { compliance: { ...(idea.compliance ?? {}), flagged: true, emptySpace: empty, problems: [...(idea.compliance?.problems ?? []).filter((p) => !/of the safe area is empty/.test(p)), ...empty] } });
  // The vision QA check looks at the finished slides before the slideshow counts as done.
  await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "qa" }]);
  return "rendered";
}

/* ─── the vision QA check ────────────────────────────────────────────── */

async function qa(job, deps) {
  const idea = await deps.db.getIdea(job.idea_id);
  if (TERMINAL.has(idea.status)) return "idea already finished";
  const gen = await deps.db.ensureGeneration(idea.id);
  const s = await deps.db.settings();
  const model = models(s, deps.env).fast;
  const heroes = gen.source_assets?.heroes ?? {};
  const slides = [];
  for (const [n, path] of (gen.files?.pngs ?? []).entries()) {
    const h = heroes[n];
    const picture = gen.source_assets?.galleries?.[n] ? "real Zyvo outputs from the library (with small style labels) and rebuilt Zyvo UI" : ["ui_prompt", "ui_checklist"].includes(idea.script.slides[n]?.kind) ? "a rebuilt Zyvo UI component (no photo)" : n === 0 && gen.source_assets?.collages?.[0] ? "a collage of real Zyvo outputs from the library" : h?.url ? "generated" : h?.asset ? "a real Zyvo output from the library" : idea.script.slides[n]?.is_zyvo ? "the real Zyvo screen" : "the background";
    slides.push({ slide: n + 1, kind: idea.script.slides[n]?.kind ?? "slide", picture, url: await deps.files.signedUrl(path, 1800) });
  }
  const r = await deps.guard.spend("anthropic", "anthropic.qa", estimateUsd({ model, inputTokens: slides.length * 1700 + 900, outputTokens: slides.length * 90 }), async (ticket) => {
    const out = await deps.ai.createMessage(ticket, { apiKey: deps.env.anthropicKey, request: qaRequest({ model, slides }) });
    return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
  }, await paidOpts(deps, idea, { mock: async () => ({ dry: true }) }));
  const findings = r.dryRun ? {} : qaFindings(jsonFromMessage(r.result));
  const flagged = Object.keys(findings).map(Number);
  // A real library asset flagged for an artifact in the picture itself is marked "flawed" and no longer
  // offered to the writer (owner, 2026-10-18); the owner can unflag it in Assets.
  const flawed = flawedAssets(findings, heroes);
  if (flawed.length) await deps.db.markAssetsFlawed?.(flawed);
  const done = async (extra = {}) => {
    // A slideshow the owner had approved (then rendered again) stays approved.
    await deps.db.updateIdea(idea.id, { status: idea.status === "approved" ? "approved" : "done", compliance: { ...(idea.compliance ?? {}), qa: { checked: true, findings }, ...extra } });
    await finishRunIfDone(deps, idea.run_id);
  };
  if (!flagged.length) { await done(); return "qa passed"; }
  // One regenerate: the flagged slides' GENERATED pictures are made again, then render and QA again.
  const regenerable = flagged.filter((n) => heroes[n - 1]?.url);
  if (!idea.compliance?.qaRetried && regenerable.length) {
    const kept = Object.fromEntries(Object.entries(heroes).filter(([i]) => !regenerable.includes(Number(i) + 1)));
    await deps.db.updateGeneration(gen.id, { source_assets: { ...gen.source_assets, heroes: kept }, status: "queued" });
    await deps.db.updateIdea(idea.id, { compliance: { ...(idea.compliance ?? {}), qaRetried: true, qa: { checked: true, findings, regenerated: regenerable } } });
    await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "images" }]);
    return `qa: regenerating slides ${regenerable.join(", ")}`;
  }
  const problems = Object.entries(findings).map(([n, f]) => `slide ${n}: ${f.flags.join(", ")}${f.note ? ` (${f.note})` : ""}`);
  // A meme slideshow still flagged after its regenerate is dropped and replaced by another format × style,
  // so the batch stays complete (owner, 2026-10-18). One replacement per dropped slideshow.
  if (idea.recipe?.style === "meme_style" && idea.compliance?.qaRetried && !idea.recipe?.replaces) {
    await deps.db.updateIdea(idea.id, { status: "rejected", error: "dropped: still flagged by the QA check after its regenerate (replaced)", compliance: { ...(idea.compliance ?? {}), qa: { checked: true, findings }, flagged: true, ok: false, dropped: true, problems: [...(idea.compliance?.problems ?? []), ...problems] } });
    const replacement = await replaceIdea(deps, idea);
    await finishRunIfDone(deps, idea.run_id);
    return `qa: dropped the meme slideshow; replaced by ${replacement.recipe.format} × ${replacement.recipe.style}`;
  }
  // Still flagged (or nothing to regenerate): kept, but marked for the owner in admin.
  await done({ flagged: true, ok: false, problems: [...(idea.compliance?.problems ?? []), ...problems] });
  return `qa flagged: ${problems.join("; ")}`;
}

/* ─── Phase 3: the analyst and the scout ─────────────────────────────── */

/** The posts with their slideshows' recipes and snapshots, as the learning code reads them. */
async function postsForLearning(deps) {
  if (!deps.db.listPosts) return [];
  return (await deps.db.listPosts()).map((p) => ({ ...p, idea: p.cm_ideas ?? null, stats: p.cm_post_stats ?? [] }));
}

/** "Let the agent analyze" (payload.analysisId): a report and a proposed playbook, CM_MODEL_MAIN, through the guard. */
async function analyze(job, deps) {
  const a = await deps.db.getAnalysis(job.payload.analysisId);
  if (a.status === "done") return "already done";
  const s = await deps.db.settings();
  const m = models(s, deps.env);
  // One account's posts (its own medians and winners), or both for a combined report (owner, 2026-10-19).
  const account = a.account ?? job.payload?.account ?? "creator";
  const accountOf = (p) => p.account ?? p.idea?.account ?? p.idea?.recipe?.account ?? "creator";
  const posts = (await postsForLearning(deps)).filter((p) => account === "both" || accountOf(p) === account);
  const lane = account === "both" ? null : ((await deps.db.lanes?.()) ?? {})[account] ?? null;
  const now = deps.now();
  const learned = learn(posts, { now, halfLife: s.half_life_days ?? 14, minSuccesses: s.winner_min_successes ?? 3 });
  // The Zyvo account: which features (cited facts) and hooks go with profile visits and link clicks.
  if (account === "zyvo") learned.features = featureBreakdown(posts, { now });
  // The analyst reads every post, scored or not, newest first, with its freshness weight.
  const rows = posts.map((p) => ({ post: p, recipe: p.idea?.recipe ?? {}, m: postMetrics(p, now) }));
  scorePosts(rows);
  for (const r of rows) r.w = freshness((now.getTime() - Date.parse(r.post.posted_at)) / 86_400_000, s.half_life_days ?? 14);
  const lib = await deps.db.library();
  const library = [...lib.formats.map((x) => ({ ...x, kind: "format", status: "active" })), ...lib.styles.map((x) => ({ ...x, kind: "style", status: "active" })), ...lib.hooks.map((x) => ({ ...x, kind: "hook", status: "active" }))];
  const scoutReport = (await deps.db.listScouts?.(1))?.[0] ?? null;
  const request = analysisRequest({ model: m.main, account, posts: { columns: SNAPSHOT_COLUMNS, rows: analystPosts(rows) }, learning: learned, playbook: lane ? lane.playbook : s.playbook, rules: LEARNING_RULES({ half_life_days: s.half_life_days ?? 14, winner_min_successes: s.winner_min_successes ?? 3 }), library, scout: scoutReport });
  await deps.db.updateAnalysis(a.id, { status: "running", model: m.main, learning: learned });
  try {
    const r = await deps.guard.spend("anthropic", "anthropic.analyze", estimateUsd({ model: m.main, inputTokens: 6000 + posts.length * 400, outputTokens: 4000 }), async (ticket) => {
      const out = await deps.ai.createMessage(ticket, { apiKey: deps.env.anthropicKey, request });
      return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
    }, { lane: "analysis", live: true, mock: async () => ({ dry: true }) });
    const report = r.dryRun ? { summary: "Dry run: no analysis was made.", what_works: [], what_doesnt: [], playbook: s.playbook ?? "", experiments: [], retire: [], trend_notes: "", confidence: "low" } : jsonFromMessage(r.result);
    await deps.db.updateAnalysis(a.id, { status: "done", report, cost_usd: r.actualUsd ?? 0, error: null });
    return "analysed";
  } catch (e) {
    await deps.db.updateAnalysis(a.id, { status: "failed", error: String(e?.message ?? e).slice(0, 500) });
    if (e instanceof BudgetStopped) return `stopped: ${e.message}`;
    throw Object.assign(e, { final: true });
  }
}

/** The daily scout (and "Scout now"): what works in short-form right now, with sources. */
async function scout(job, deps) {
  const s = await deps.db.settings();
  const m = models(s, deps.env);
  const today = localDay(deps.now(), s.timezone);
  const r = await deps.guard.spend("anthropic", "anthropic.scout", estimateUsd({ model: m.main, inputTokens: 25_000, outputTokens: 3000, searches: 5 }), async (ticket) => {
    const out = await deps.ai.createMessage(ticket, { apiKey: deps.env.anthropicKey, request: scoutRequest({ model: m.main, today }) });
    return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
  }, { lane: "scout", live: job.payload?.live === true, mock: async () => ({ dry: true }) });
  if (r.dryRun) return "dry run: no scout";
  const report = jsonFromMessage(r.result);
  await deps.db.saveScout({ run_id: null, raw_sources: report.sources ?? [], trend_brief: report.trend_brief, top_formats: report.top_formats ?? [], report, cost_usd: r.actualUsd ?? 0 });
  return "scouted";
}

/**
 * The vision QA check on slides that aren't a slideshow of a run (owner-ordered, 2026-10-18: the format ×
 * style grid after a layout change). payload: { paths: PNGs under qa/ in the bucket (≤ 12), kinds,
 * pictures, out: where the findings are saved (qa/…json), live }. Through the Budget Guard, lane "qa".
 */
async function qaCheck(job, deps) {
  const p = job.payload ?? {};
  const paths = (p.paths ?? []).map(String).filter((x) => x.startsWith("qa/")).slice(0, 12);
  const out = String(p.out ?? "");
  if (!paths.length || !out.startsWith("qa/") || !out.endsWith(".json")) throw Object.assign(new Error("qa_check needs PNGs and an output under qa/"), { final: true });
  const model = models(await deps.db.settings(), deps.env).fast;
  const slides = [];
  for (const [n, path] of paths.entries()) slides.push({ slide: n + 1, kind: p.kinds?.[n] ?? "slide", picture: p.pictures?.[n] ?? "generated", url: await deps.files.signedUrl(path, 1800) });
  const r = await deps.guard.spend("anthropic", "anthropic.qa_check", estimateUsd({ model, inputTokens: slides.length * 1700 + 900, outputTokens: slides.length * 90 }), async (ticket) => {
    const res = await deps.ai.createMessage(ticket, { apiKey: deps.env.anthropicKey, request: qaRequest({ model, slides }) });
    return { result: res.body, actualUsd: res.costUsd, requestRef: res.body?.id };
  }, { lane: "qa", live: p.live === true, mock: async () => ({ dry: true }) });
  const findings = r.dryRun ? null : qaFindings(jsonFromMessage(r.result));
  await deps.files.writeJson(out, { checkedAt: deps.now().toISOString(), dryRun: Boolean(r.dryRun), paths, findings, costUsd: r.actualUsd ?? 0 });
  return r.dryRun ? "dry run: not checked" : `checked ${paths.length}: ${Object.keys(findings).length} flagged`;
}

/** A new idea in the same run with a different format × style (never the meme style), written from scratch. */
async function replaceIdea(deps, idea) {
  const run = await deps.db.getRun(idea.run_id);
  const full = await deps.db.library();
  const library = { ...full, styles: full.styles.filter((s) => s.key !== "meme_style"), formats: full.formats.filter((f) => f.key !== "meme") };
  const today = (await deps.db.ideasOfRun(idea.run_id)).map((i) => i.recipe).filter(Boolean);
  const [r] = planRecipes({ library, history: [...today, ...today, ...(await deps.db.recentRecipes(120))], count: 1, seed: `${idea.run_id}-replace-${idea.id}`, topic: run?.input?.topic || null });
  const [created] = await deps.db.createIdeas([{
    run_id: idea.run_id, status: "producing", source: idea.source ?? "machine", format: r.format, zyvo_tool: null, title: "(being written)",
    recipe: { ...r, replaces: idea.id }, topic: r.topic, dry_run: idea.dry_run, target_platforms: idea.target_platforms ?? ["tiktok", "instagram", "youtube"],
  }]);
  await deps.db.enqueue([{ run_id: idea.run_id, idea_id: created.id, stage: "write" }]);
  return created;
}

/** [{ref, reason}] for the flagged slides whose picture is a library asset and whose flags are about the picture. */
export const ASSET_FLAWS = ["distorted hands or faces", "letters or garbled text inside the picture", "a head or subject is cut off", "a logo or brand mark on an object", "resembles a real person or a brand"];
export function flawedAssets(findings, heroes) {
  const out = [];
  for (const [n, f] of Object.entries(findings ?? {})) {
    const h = heroes?.[Number(n) - 1];
    const why = (f.flags ?? []).filter((x) => ASSET_FLAWS.includes(x));
    if (h?.asset && h.ref && why.length) out.push({ ref: h.ref, reason: `${why.join(", ")}${f.note ? ` (${f.note})` : ""}`.slice(0, 300) });
  }
  return out;
}

/* ─── the asset library: tagging ─────────────────────────────────────── */

async function tagAssets(job, deps) {
  // payload.retag (owner-ordered): active assets are looked at again (the subtitles tag, 2026-10-18).
  const rows = (await deps.db.getAssets(job.payload?.ids ?? [])).filter((a) => a.status === "pending" || (job.payload?.retag && a.status === "active"));
  if (!rows.length) return "nothing to tag";
  const s = await deps.db.settings();
  const model = models(s, deps.env).fast;
  const items = [];
  for (const a of rows) {
    const url = await deps.files.signedUrl(a.path, 1800);
    if (url) items.push({ ref: a.ref, source_path: a.source_path, url, id: a.id });
  }
  const opts = { lane: "assets", live: job.payload?.live === true, mock: async () => ({ dry: true }) };
  const r = await deps.guard.spend("anthropic", "anthropic.tag_assets", estimateUsd({ model, inputTokens: items.length * 1800 + 900, outputTokens: items.length * 160 }), async (ticket) => {
    const out = await deps.ai.createMessage(ticket, { apiKey: deps.env.anthropicKey, request: tagRequest({ model, items }) });
    return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
  }, opts);
  if (r.dryRun) return "dry run: not tagged";
  const tags = jsonFromMessage(r.result).images ?? [];
  const now = deps.now().toISOString();
  let done = 0;
  for (const it of items) {
    const t = tags.find((x) => x.ref === it.ref);
    if (!t) continue;
    await deps.db.updateAsset(it.id, assetUpdate(t, now));
    done += 1;
  }
  return `tagged ${done} of ${items.length}`;
}


const HANDLERS = { plan, write, write_batch: writeBatch, poll_batch: pollBatch, check, rewrite, images, render, render_wait: renderWait, qa, qa_check: qaCheck, tag_assets: tagAssets, analyze, scout };
export const STAGES = Object.keys(HANDLERS);
