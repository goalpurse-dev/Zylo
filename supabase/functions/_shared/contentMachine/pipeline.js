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
import { domain } from "./slides/templates.js";
import { mockPackage, mockSlideshow, nearDuplicate, packageProblems, packageRequest, rewriteRequest, slideshowProblems, utmLinks, writeRequest } from "./writer.js";

export const LANE = "slideshow";
const TERMINAL = new Set(["done", "failed", "skipped_budget", "rejected"]);
export const ZYVO_SHOT_PATH = "assets/zyvo-home.png";

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
async function callMain(deps, { operation, request, idea, estimate }) {
  const opts = { lane: LANE, runId: idea.run_id, ideaId: idea.id, mock: async () => ({ dry: true }) };
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
  const count = Math.max(1, Math.min(20, Number(run.input?.count) || s.slideshows_per_day));
  const recipes = planRecipes({
    library, history, count, seed: run.id, topic: run.input?.topic || null,
    experimentPhase: inExperimentPhase({ startedOn: s.experiment_started_on, today, days: s.experiment_days }),
    winners: [], winnersPerDay: s.winners_per_day,
  });
  if (!run.dry_run && !s.experiment_started_on) await db.updateSettings({ experiment_started_on: today });
  const ideas = await db.createIdeas(recipes.map((r) => ({
    run_id: run.id, status: "producing", source: run.input?.topic ? "owner" : "machine", format: r.format, zyvo_tool: null,
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
  return { s, library: await deps.db.library(), recent: await deps.db.recentTitles(30, idea.id), today: localDay(deps.now(), s.timezone), m: models(s, deps.env) };
}

/** Program checks + near-duplicates. Returns the problems (empty = keep it). */
function judge(slideshow, idea, recent) {
  const problems = slideshowProblems(slideshow, idea.recipe);
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
  const { s, library, recent, today, m } = await writeContext(deps, idea);
  const request = writeRequest({ model: m.main, brandRules: s.brand_rules, library, recipe: idea.recipe, today, avoidTitles: recent.map((r) => r.title) });
  if (job.payload?.problems?.length) request.messages[0].content += `\n\nYOUR LAST ATTEMPT HAD THESE PROBLEMS, avoid them:\n${job.payload.problems.map((p) => `- ${p}`).join("\n")}`;
  if (job.payload?.note) request.messages[0].content += `\n\nNOTE: ${job.payload.note}`;
  const r = await callMain(deps, { operation: "anthropic.write", request, idea, estimate: (model) => ESTIMATES.write(model) });
  const slideshow = r.dryRun ? mockSlideshow(idea.recipe) : jsonFromMessage(r.result);
  const problems = r.dryRun ? [] : judge(slideshow, idea, recent);
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
  const library = await deps.db.library();
  const today = localDay(deps.now(), s.timezone);
  const m = models(s, deps.env);
  const recent = await deps.db.recentTitles(30, null);
  const requests = [], ledger = {};
  let ticket = null;
  for (const idea of ideas) {
    try {
      const r = await deps.guard.reserve("anthropic", "anthropic.write.batch", ESTIMATES.write(m.main, true), { lane: LANE, runId: job.run_id, ideaId: idea.id });
      if (r.dryRun) { await deps.guard.settle(r.ledgerId, { actualUsd: 0, requestRef: "dry-run" }); await deps.db.enqueue([{ run_id: job.run_id, idea_id: idea.id, stage: "write" }]); continue; }
      ticket = ticket ?? r.ticket;
      ledger[idea.id] = r.ledgerId;
      requests.push({ custom_id: idea.id, params: writeRequest({ model: m.main, brandRules: s.brand_rules, library, recipe: idea.recipe, today, avoidTitles: recent.map((x) => x.title) }) });
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
    try { slideshow = jsonFromMessage(r.message); problems = judge(slideshow, idea, await deps.db.recentTitles(30, ideaId)); } catch (e) { problems = [e.message]; }
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
  const r = await deps.guard.spend("anthropic", "anthropic.package", ESTIMATES.package(m.fast), async (ticket) => {
    const out = await deps.ai.createMessage(ticket, { apiKey: deps.env.anthropicKey, request: packageRequest({ model: m.fast, brandRules: s.brand_rules, recipe: idea.recipe, slideshow: idea.script, links }) });
    return { result: out.body, actualUsd: out.costUsd, requestRef: out.body?.id };
  }, { lane: LANE, runId: idea.run_id, ideaId: idea.id, mock: async () => ({ dry: true }) });
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
    { platform: "tiktok", caption: pkg.tiktok.caption, title: null, hashtags: pkg.tiktok.hashtags, on_screen_text: pkg.tiktok.on_screen_text ?? [], suggested_post_time: time, ai_label_required: ai, sound_suggestion: sound, compliance: { link: links.tiktok } },
    { platform: "instagram", caption: pkg.instagram.caption, title: null, hashtags: pkg.instagram.hashtags, on_screen_text: [], suggested_post_time: time, ai_label_required: ai, sound_suggestion: sound, compliance: { link: links.instagram } },
    { platform: "youtube", caption: pkg.youtube.description, title: pkg.youtube.title, hashtags: pkg.youtube.hashtags, on_screen_text: [], suggested_post_time: time, ai_label_required: ai, sound_suggestion: sound, compliance: { link: links.youtube } },
  ];
}

async function rewrite(job, deps) {
  const idea = await deps.db.getIdea(job.idea_id);
  if (TERMINAL.has(idea.status)) return "idea already finished";
  const { s, library, today, m } = await writeContext(deps, idea);
  const request = rewriteRequest({ model: m.main, brandRules: s.brand_rules, library, recipe: idea.recipe, today, slideshow: idea.script, problems: job.payload?.problems ?? [] });
  const r = await callMain(deps, { operation: "anthropic.rewrite", request, idea, estimate: (model) => ESTIMATES.rewrite(model) });
  const slideshow = r.dryRun ? idea.script : jsonFromMessage(r.result);
  const problems = slideshowProblems(slideshow, idea.recipe);
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
  const assets = { background: have.background ?? null, illustrations: { ...(have.illustrations ?? {}) }, costs: { ...(have.costs ?? {}) } };
  const wanted = [];
  if (!assets.background && style.spec?.bg_prompt) wanted.push(["background", `${style.spec.bg_prompt}. Mood suited to: ${idea.topic ?? idea.title}`]);
  idea.script.slides.forEach((sl, i) => { if (sl.image_prompt && wanted.length < 4 && !assets.illustrations[i]) wanted.push([i, sl.image_prompt]); });
  for (const [slot, prompt] of wanted) {
    // Backgrounds carry text, so they have no people at all; illustrations may show invented characters.
    const kind = slot === "background" && !style.spec?.meme ? "background" : "illustration";
    // One retry per image. A second failure fails the slideshow: a placeholder is never posted.
    let r = null, last = null;
    for (let attempt = 1; attempt <= 2 && !r; attempt++) {
      try {
        r = await deps.guard.spend("runware", "runware.image.fast", IMAGE_ESTIMATE_USD, async (ticket) => {
          const out = await deps.images.generateImage(ticket, { apiKey: deps.env.runwareKey, baseUrl: deps.env.runwareBase, prompt, kind });
          return { result: out.url, actualUsd: out.costUsd, requestRef: out.taskUUID };
        }, { lane: LANE, runId: idea.run_id, ideaId: idea.id, mock: async () => null });
      } catch (e) {
        if (e instanceof BudgetStopped) throw e;
        last = e;
      }
    }
    if (!r) throw Object.assign(new Error(`an image failed twice (${slot === "background" ? "background" : `slide ${slot + 1}`}): ${last?.message ?? "unknown"}`), { final: true });
    if (slot === "background") assets.background = r.result; else assets.illustrations[slot] = r.result;
    assets.costs[slot] = r.actualUsd;
    await deps.db.updateGeneration(gen.id, { source_assets: assets, status: "generating" });   // kept even if a later image fails
  }
  await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "render" }]);
  return `${wanted.length} images`;
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
    if (!keys.length || !row.logo_path) continue;
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
    images: { background: gen.source_assets?.background ?? null, illustrations: gen.source_assets?.illustrations ?? {} },
    zyvoShot: await deps.files.signedUrl(ZYVO_SHOT_PATH, 3600), uploads, secondsPerSlide: 2.5,
    logos: await logosFor(deps, idea.script.slides),
  };
  const r = await deps.guard.reserve("fly", "fly.render.slides", RENDER_ESTIMATE_USD, { lane: LANE, runId: idea.run_id, ideaId: idea.id });
  let started;
  try {
    started = await deps.fly.startRender(r.ticket, { token: deps.env.flyToken, app: deps.env.flyApp, image: deps.env.flyImage, name: `cm-slides-${idea.id.slice(0, 8)}-${Date.now().toString(36)}`, job: renderJob });
  } catch (e) {
    await deps.guard.settle(r.ledgerId, { actualUsd: 0, status: "failed", error: e.message });
    throw e;
  }
  await deps.db.updateGeneration(gen.id, { status: "rendering" });
  await deps.db.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "render_wait", payload: { ledgerId: r.ledgerId, startedAt: started.startedAt, machineId: started.machineId, paths }, run_after: new Date(deps.now().getTime() + 45_000).toISOString() }]);
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
  await deps.db.updateIdea(idea.id, { status: "done" });
  await finishRunIfDone(deps, idea.run_id);
  return "rendered";
}

const HANDLERS = { plan, write, write_batch: writeBatch, poll_batch: pollBatch, check, rewrite, images, render, render_wait: renderWait };
export const STAGES = Object.keys(HANDLERS);
