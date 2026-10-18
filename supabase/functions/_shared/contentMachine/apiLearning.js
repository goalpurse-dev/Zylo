// Content Machine, Phase 3: the learning loop's actions (Analytics tab).
//   learning        the playbook, the program's own numbers (winners, retire, posts with stats), the latest
//                   analyses and scout reports, and whether a new analysis is suggested
//   analyze         "Let the agent analyze": queues the analyst (CM_MODEL_MAIN, through the guard, ~$0.05–0.15)
//   savePlaybook    the owner edits the playbook the writer follows
//   applyAnalysis   the owner takes an analysis's proposed playbook as the new playbook
//   scoutNow        queues a scout (web search, ~$0.10)
import { ApiError } from "./errors.js";
import { LEARNING_RULES, analysisDue, learn } from "./learning.js";

export const PLAYBOOK_MAX = 6000;

export function learningActions({ cm, store, kick, now }) {
  const posts = async () => (await cm.listPosts()).map((p) => ({ ...p, idea: p.cm_ideas ?? null, stats: p.cm_post_stats ?? [] }));
  const busy = (a) => a && ["queued", "running"].includes(a.status);

  return {
    learning: async () => {
      const s = await cm.settings();
      const learned = learn(await posts(), { now: now(), halfLife: s.half_life_days ?? 14, minSuccesses: s.winner_min_successes ?? 3 });
      const analyses = await cm.listAnalyses(5);
      const lastDone = analyses.find((a) => a.status === "done") ?? null;
      return {
        playbook: s.playbook ?? "", playbookUpdatedAt: s.playbook_updated_at ?? null,
        rules: LEARNING_RULES({ half_life_days: s.half_life_days ?? 14, winner_min_successes: s.winner_min_successes ?? 3 }),
        learned, analyses, scouts: await cm.listScouts(3),
        suggest: analysisDue(learned.postsWithStats, lastDone?.posts_count ?? 0, s.analysis_suggest_after ?? 10),
        sinceLast: learned.postsWithStats - (lastDone?.posts_count ?? 0),
        settings: { daily_scout: Boolean(s.daily_scout), half_life_days: s.half_life_days ?? 14, winner_min_successes: s.winner_min_successes ?? 3, analysis_suggest_after: s.analysis_suggest_after ?? 10, winners_per_day: s.winners_per_day, experiments_per_day: s.experiments_per_day, experiment_days: s.experiment_days, experiment_started_on: s.experiment_started_on },
      };
    },

    analyze: async ({ user }) => {
      const s = await cm.settings();
      if (s.kill_switch) throw new ApiError("VALIDATION", "The kill switch is on.");
      if (busy((await cm.listAnalyses(1))[0])) throw new ApiError("VALIDATION", "An analysis is already running.");
      const learned = learn(await posts(), { now: now(), halfLife: s.half_life_days ?? 14, minSuccesses: s.winner_min_successes ?? 3 });
      if (!learned.postsWithStats) throw new ApiError("VALIDATION", "Add stats to at least one posted slideshow first.");
      const a = await cm.createAnalysis({ status: "queued", posts_count: learned.postsWithStats, created_by: user.email });
      await cm.enqueue([{ stage: "analyze", payload: { analysisId: a.id }, max_attempts: 1 }]);
      await store.audit(user.email, "analysis.start", { id: a.id, posts: learned.postsWithStats });
      await kick().catch(() => {});
      return { analysis: a };
    },

    savePlaybook: async ({ user, body }) => {
      const text = String(body?.text ?? "").replace(/\r\n/g, "\n").trim();
      if (text.length > PLAYBOOK_MAX) throw new ApiError("VALIDATION", `The playbook is at most ${PLAYBOOK_MAX} characters.`);
      await cm.updateSettings({ playbook: text, playbook_updated_at: now().toISOString() });
      await store.audit(user.email, "playbook.save", { length: text.length });
      return { playbook: text };
    },

    applyAnalysis: async ({ user, body }) => {
      const a = await cm.getAnalysis(String(body?.id ?? ""));
      const text = String(a.report?.playbook ?? "").trim();
      if (a.status !== "done" || !text) throw new ApiError("VALIDATION", "That analysis has no playbook to apply.");
      await cm.updateSettings({ playbook: text.slice(0, PLAYBOOK_MAX), playbook_updated_at: now().toISOString() });
      await cm.updateAnalysis(a.id, { applied_at: now().toISOString() });
      await store.audit(user.email, "playbook.apply", { analysis: a.id });
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
