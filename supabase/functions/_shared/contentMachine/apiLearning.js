// Content Machine, Phase 3: the learning loop's actions (Analytics tab), per account (owner, 2026-10-19).
//   learning        one account's (or both accounts') playbook, the program's own numbers (winners, retire, posts with
//                   stats), its analyses and the scout reports, and whether a new analysis is suggested
//   analyze         "Let the agent analyze" for one account or both: the analyst (CM_MODEL_MAIN, through the guard)
//   savePlaybook    the owner edits an account's playbook (the writer of that account follows it)
//   applyAnalysis   the owner takes an analysis's proposed playbook as its account's playbook
//   scoutNow        queues a scout (web search, ~$0.10); the scout is shared by both accounts
// Each account learns from its own posts only: its own medians, winners and playbook. "both" is a combined view.
import { ApiError } from "./errors.js";
import { LEARNING_RULES, analysisDue, featureBreakdown, learn } from "./learning.js";

export const PLAYBOOK_MAX = 6000;
const VIEWS = ["creator", "zyvo", "both"];

export function learningActions({ cm, store, kick, now }) {
  const account = (v) => {
    const a = String(v ?? "creator");
    if (!VIEWS.includes(a)) throw new ApiError("VALIDATION", "Account: creator, zyvo or both.");
    return a;
  };
  const accountOf = (p) => p.account ?? p.idea?.account ?? p.idea?.recipe?.account ?? "creator";
  const posts = async (acc) => (await cm.listPosts()).map((p) => ({ ...p, idea: p.cm_ideas ?? null, stats: p.cm_post_stats ?? [] }))
    .filter((p) => acc === "both" || accountOf(p) === acc);
  const busy = (a) => a && ["queued", "running"].includes(a.status);
  const analysesOf = async (acc) => (await cm.listAnalyses(30)).filter((a) => (a.account ?? "creator") === acc).slice(0, 5);
  const knobs = (s) => ({ halfLife: s.half_life_days ?? 14, minSuccesses: s.winner_min_successes ?? 3 });

  return {
    learning: async ({ body }) => {
      const acc = account(body?.account);
      const s = await cm.settings();
      const lanes = (await cm.lanes?.()) ?? {};
      const mine = await posts(acc);
      const learned = learn(mine, { now: now(), ...knobs(s) });
      const analyses = await analysesOf(acc);
      const lastDone = analyses.find((a) => a.status === "done") ?? null;
      const lane = acc === "both" ? null : lanes[acc] ?? null;
      return {
        account: acc,
        playbook: lane ? lane.playbook ?? "" : null, playbookUpdatedAt: lane?.playbook_updated_at ?? null,
        rules: LEARNING_RULES({ half_life_days: s.half_life_days ?? 14, winner_min_successes: s.winner_min_successes ?? 3 }),
        learned, analyses, scouts: await cm.listScouts(3),
        features: acc === "zyvo" ? featureBreakdown(mine, { now: now() }) : null,
        suggest: analysisDue(learned.postsWithStats, lastDone?.posts_count ?? 0, s.analysis_suggest_after ?? 10),
        sinceLast: learned.postsWithStats - (lastDone?.posts_count ?? 0),
        settings: { daily_scout: Boolean(s.daily_scout), half_life_days: s.half_life_days ?? 14, winner_min_successes: s.winner_min_successes ?? 3, analysis_suggest_after: s.analysis_suggest_after ?? 10, winners_per_day: s.winners_per_day, experiments_per_day: s.experiments_per_day, experiment_days: s.experiment_days, experiment_started_on: s.experiment_started_on },
      };
    },

    analyze: async ({ user, body }) => {
      const acc = account(body?.account);
      const s = await cm.settings();
      if (s.kill_switch) throw new ApiError("VALIDATION", "The kill switch is on.");
      if (busy((await cm.listAnalyses(1))[0])) throw new ApiError("VALIDATION", "An analysis is already running.");
      const learned = learn(await posts(acc), { now: now(), ...knobs(s) });
      if (!learned.postsWithStats) throw new ApiError("VALIDATION", `Add stats to at least one posted ${acc === "both" ? "" : `${acc === "zyvo" ? "Zyvo" : "Creator"}-account `}slideshow first.`);
      const a = await cm.createAnalysis({ status: "queued", account: acc, posts_count: learned.postsWithStats, created_by: user.email });
      await cm.enqueue([{ stage: "analyze", payload: { analysisId: a.id, account: acc }, max_attempts: 1 }]);
      await store.audit(user.email, "analysis.start", { id: a.id, account: acc, posts: learned.postsWithStats });
      await kick().catch(() => {});
      return { analysis: a };
    },

    savePlaybook: async ({ user, body }) => {
      const acc = account(body?.account);
      if (acc === "both") throw new ApiError("VALIDATION", "Each account has its own playbook: pick Creator or Zyvo.");
      const text = String(body?.text ?? "").replace(/\r\n/g, "\n").trim();
      if (text.length > PLAYBOOK_MAX) throw new ApiError("VALIDATION", `The playbook is at most ${PLAYBOOK_MAX} characters.`);
      await cm.saveLane(acc, { playbook: text, playbook_updated_at: now().toISOString(), updated_by: user.email });
      await store.audit(user.email, "playbook.save", { account: acc, length: text.length });
      return { playbook: text };
    },

    applyAnalysis: async ({ user, body }) => {
      const a = await cm.getAnalysis(String(body?.id ?? ""));
      const text = String(a.report?.playbook ?? "").trim();
      const acc = a.account ?? "creator";
      if (acc === "both") throw new ApiError("VALIDATION", "A combined analysis is a report: apply a Creator or Zyvo analysis to a playbook.");
      if (a.status !== "done" || !text) throw new ApiError("VALIDATION", "That analysis has no playbook to apply.");
      await cm.saveLane(acc, { playbook: text.slice(0, PLAYBOOK_MAX), playbook_updated_at: now().toISOString(), updated_by: user.email });
      await cm.updateAnalysis(a.id, { applied_at: now().toISOString() });
      await store.audit(user.email, "playbook.apply", { analysis: a.id, account: acc });
      return { playbook: text };
    },

    scoutNow: async ({ user }) => {
      const s = await cm.settings();
      if (s.kill_switch) throw new ApiError("VALIDATION", "The kill switch is on.");
      if (await cm.scoutQueuedSince(new Date(now().getTime() - 10 * 60_000).toISOString())) throw new ApiError("VALIDATION", "A scout was started in the last 10 minutes.");
      await cm.enqueue([{ stage: "scout", payload: { live: true }, max_attempts: 1 }]);
      await store.audit(user.email, "scout.start", {});
      await kick().catch(() => {});
      return { queued: true };
    },
  };
}
