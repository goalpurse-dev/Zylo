// Blocky Worlds shot review: the one call the prepare job makes (runpod/worker.mjs), between the builder and the
// pre-render checks. Picks the judge from the job / env, wires the PERMANENT RULE's checks (the same ones the worker
// runs right after: checkTimeline + checkVisuals + checkSubjects + checkProduction + the kit check) as the re-plan
// guard, the builder for things a fix adds, and the still renderer. Never throws.
//   const rv = await reviewForPrepare({ tl, script, premise, config, apiKey, plan, kit, kitProblems, builder, dir, until, beforeStills, log })
//     -> { tl, report, costUsd, summary }        tl is the same object, changed in place; report = shot-review.json
// config (job.prepare.review, else env BLOCKY_WORLDS_REVIEW): { provider: "off" | "mock" | "anthropic", model?,
//   budget?: { maxUsd, maxMs, replanRounds } }. Default OFF until the owner turns it on.
import path from "node:path";
import { reviewShots } from "./shotReview.js";
import { anthropicJudge, REVIEW_MODELS } from "./judge.js";
import { mockJudge } from "./mock.js";
import { makeGateCache } from "./gatePass.js";

// stillSize 480 (270 x 480, 2026-11-07): the judge needs the framing, not detail; ~170 image tokens a still instead of
// ~440, and a faster frame on a software-GL laptop. maxMs: with a prepare job's `until` the window is the job's own
// limit minus what comes after the review (worker.mjs REVIEW_AFTER_SEC), not a fixed 240 s from the review's start.
export const REVIEW_DEFAULTS = Object.freeze({ provider: "off", model: REVIEW_MODELS.default, maxUsd: 0.1, maxMs: 240000, replanRounds: 2, stillSize: 480 });

/**
 * The review's still renderer, opened EARLY and warmed (2026-11-07). The turtle / dog test runs spent 87-176 s of the
 * 240 s window loading the stills page cold; a second load of a similar timeline in the same Chrome took 12 s instead of
 * 63 s (laptop, measured: shader programs, modules, textures and models are cached by then). The prepare job warms it
 * with the directed early plan (estimated timings) while the voice, the director and the builder run.
 *   const rs = makeReviewStills({ dir, size, beforeStills, log });  rs.warm(earlyTl)  (never awaited, never throws)
 *   reviewForPrepare({ ..., stills: rs })  (waits for the warm-up, then reuses the same Chrome for every pass)
 *   await rs.close()
 * rs.gateCache (2026-11-09, the HARD STILL GATE): every still this renderer makes is measured by lib/stillGate.js in the
 * page (lib/vision/stills.mjs); the measurements are kept by shot content, so the gate pass after the review renders only
 * the shots the review did not render (or changed).
 */
export function makeReviewStills({ dir, size = REVIEW_DEFAULTS.stillSize, beforeStills = null, log = () => {}, factory = null } = {}) {
  let r = null, warming = null, warmMs = null, closed = false;
  const gateCache = makeGateCache();
  const open = () => (r ??= (async () => {
    await beforeStills?.();
    const make = factory ?? (await import("./stills.mjs")).makeShotStills;
    return make({ dir, size, log });
  })());
  return {
    size,
    gateCache,
    get warmMs() { return warmMs; },
    get warming() { return Boolean(warming) && warmMs == null; },
    /** load this timeline's page once (no stills): Chrome + the caches are hot for the real passes */
    warm(tl) {
      if (warming || closed || !tl?.shots?.length) return warming ?? Promise.resolve();
      const t0 = Date.now();
      warming = (async () => {
        const s = await open();
        const res = await s.renderTimeline(tl, [], { name: "warm" });
        warmMs = Date.now() - t0;
        log(`stills: warmed in ${warmMs} ms (page load ${res?.loadMs ?? "?"} ms, ${tl.shots.length} shots)`);
      })().catch((e) => { log(`stills: warm-up failed (${String(e?.message ?? e).slice(0, 160)})`); });
      return warming;
    },
    /** the renderer for reviewShots (after the warm-up); its close() is a no-op: the owner closes with rs.close() */
    async get() {
      if (warming) await warming;
      const s = await open();
      return { renderTimeline: async (...a) => { const res = await s.renderTimeline(...a); for (const st of res?.stills ?? []) gateCache.add(st); return res; }, close: async () => {} };
    },
    async close() { if (closed) return; closed = true; if (warming) await warming; if (r) await (await r.catch(() => null))?.close?.().catch?.(() => {}); },
  };
}

/** the guard the re-plan uses: every pre-render check, flattened to strings ("" problems = clean) */
export function checksFor(plan, script, kit = null, kitProblems = null) {
  return (tl) => [
    ...(plan.checkTimeline?.(tl) ?? []).map(String),
    ...(plan.checkVisuals?.(tl, script) ?? []).map((m) => `visual line ${m.line}: ${(m.missing ?? []).join(", ")}`),
    ...(plan.checkSubjects?.(tl) ?? []).map((x) => `subject shot ${x.shot}: ${x.problem}`),
    ...(tl?.production && plan.checkProduction ? (plan.checkProduction(tl) ?? []).map((m) => `production line ${m.line}: ${(m.missing ?? []).map((x) => x?.name ?? x).join(", ")}`) : []),
    ...(kit && kitProblems ? kitProblems(tl, kit) : []),
  ];
}

export function judgeFromConfig(config = {}, { apiKey = process.env.ANTHROPIC_KEY ?? null, premise = null } = {}) {
  const p = String(config.provider ?? process.env.BLOCKY_WORLDS_REVIEW ?? "off").toLowerCase();
  if (p === "mock") return mockJudge();
  if ((p === "anthropic" || p === "haiku" || p === "sonnet") && apiKey) return anthropicJudge({ apiKey, model: config.model ?? (p === "sonnet" ? REVIEW_MODELS.strict : REVIEW_MODELS.default), premise });
  return null;
}

export async function reviewForPrepare({ tl, script, premise = null, config = {}, apiKey, plan, kit = null, kitProblems = null, builder = null, dir, until = null, beforeStills = null, stills = null, log = () => {} }) {
  try {
    const judge = judgeFromConfig(config, { apiKey, premise });
    const b = config.budget ?? {};
    const size = Number(config.stillSize ?? REVIEW_DEFAULTS.stillSize);
    // a warmed renderer (makeReviewStills) or a plain factory; the pass-1 load estimate from the warm-up when there was
    // one (a warm reload measured ~0.2x the cold load; 0.4x for margin), else the default (RunPod GPU)
    const warmed = stills && typeof stills.get === "function" ? stills : null;
    // a warm-up still loading: wait for it first (the passes would wait anyway; its measured time sizes pass 1)
    if (warmed?.warming && judge) { const w0 = Date.now(); await warmed.get().catch(() => null); log(`shot review: waited ${Date.now() - w0} ms for the stills warm-up`); }
    const loadMs = warmed?.warmMs ? Math.max(5000, Math.round(0.4 * warmed.warmMs)) : undefined;
    const maxMs = Number(b.maxMs ?? (until ? Infinity : REVIEW_DEFAULTS.maxMs));
    log(`shot review: ${judge ? judge.model : "off"}, stills ${Math.round((size * 9) / 16)}x${size}, ${until ? `${Math.round((until - Date.now()) / 1000)} s until the prepare's review end` : `${maxMs / 1000} s`}${warmed ? `, renderer ${warmed.warmMs != null ? `warmed (${warmed.warmMs} ms)` : warmed.warming ? "still warming" : "cold"}` : ""}`);
    const { tl: out, report } = await reviewShots({
      tl, script, premise, judge,
      stills: warmed ? () => warmed.get() : stills ?? (async () => { await beforeStills?.(); return (await import("./stills.mjs")).makeShotStills({ dir: path.join(dir, "review"), size, log }); }),
      check: checksFor(plan, script, kit, kitProblems),
      // only the needs a fix added (tl.needs were resolved before the review): the builder's money / time caps still hold
      rebuild: builder ? async (t) => { const keep = t.needs; t.needs = []; try { return await builder.buildFor(t, { plan, kit }); } finally { t.needs = keep; } } : null,
      budget: { maxUsd: Math.max(0, Math.min(1, Number(b.maxUsd ?? REVIEW_DEFAULTS.maxUsd))), maxMs, replanRounds: Math.max(0, Math.min(2, Number(b.replanRounds ?? REVIEW_DEFAULTS.replanRounds))), until, ...(loadMs ? { loadMs } : {}) },
      outDir: dir, log,
    });
    const summary = { provider: report.provider, model: report.model, first: report.first, final: report.counts, passes: report.passes.length, fixes: report.fixes.applied.length, reverted: report.fixes.reverted.length, cards: report.cards.length, unresolved: report.unresolved.length, costUsd: report.costUsd, ms: report.ms, stopped: report.stopped ?? null,
      warmMs: warmed?.warmMs ?? null, timing: report.passes.map((p) => ({ pass: p.pass, est: p.estMs ?? null, wait: p.rendererMs ?? null, load: p.loadMs, stills: p.stillsMs, judge: p.judgeMs, rebuild: p.rebuildMs ?? null, ...(p.skipped ? { skipped: String(p.skipped).slice(0, 80) } : {}) })) };
    return { tl: out, report, costUsd: report.costUsd, summary };
  } catch (e) {
    log(`shot review skipped: ${e.message}`);
    return { tl, report: null, costUsd: 0, summary: { error: String(e.message).slice(0, 200) } };
  }
}
