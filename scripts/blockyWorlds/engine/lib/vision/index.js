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

export const REVIEW_DEFAULTS = Object.freeze({ provider: "off", model: REVIEW_MODELS.default, maxUsd: 0.1, maxMs: 120000, replanRounds: 2 });

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
    const { tl: out, report } = await reviewShots({
      tl, script, premise, judge,
      stills: stills ?? (async () => { await beforeStills?.(); return (await import("./stills.mjs")).makeShotStills({ dir: path.join(dir, "review"), log }); }),
      check: checksFor(plan, script, kit, kitProblems),
      // only the needs a fix added (tl.needs were resolved before the review): the builder's money / time caps still hold
      rebuild: builder ? async (t) => { const keep = t.needs; t.needs = []; try { return await builder.buildFor(t, { plan, kit }); } finally { t.needs = keep; } } : null,
      budget: { maxUsd: Math.max(0, Math.min(1, Number(b.maxUsd ?? REVIEW_DEFAULTS.maxUsd))), maxMs: Number(b.maxMs ?? REVIEW_DEFAULTS.maxMs), replanRounds: Math.max(0, Math.min(2, Number(b.replanRounds ?? REVIEW_DEFAULTS.replanRounds))), until },
      outDir: dir, log,
    });
    const summary = { provider: report.provider, model: report.model, first: report.first, final: report.counts, passes: report.passes.length, fixes: report.fixes.applied.length, reverted: report.fixes.reverted.length, cards: report.cards.length, unresolved: report.unresolved.length, costUsd: report.costUsd, ms: report.ms, stopped: report.stopped ?? null };
    return { tl: out, report, costUsd: report.costUsd, summary };
  } catch (e) {
    log(`shot review skipped: ${e.message}`);
    return { tl, report: null, costUsd: 0, summary: { error: String(e.message).slice(0, 200) } };
  }
}
