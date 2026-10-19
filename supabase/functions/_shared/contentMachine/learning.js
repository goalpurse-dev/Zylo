// Content Machine, Phase 3: what the program itself learns from the scored posts (analytics.js), before and
// apart from the agent's analysis. Pure functions.
//   freshness   a post's weight halves every half_life_days (default 14): recent results count more, so the
//               machine follows what works NOW.
//   winners     a recipe (format × style × hook) with at least winner_min_successes (default 3) posts that beat
//               the account median (score > 100); ranked by their fresh-weighted score. The planner makes
//               winners_per_day of them (after the experiment phase) and fills the rest with experiments.
//   retire      a format, style or hook with 3+ scored posts whose fresh-weighted score is below the median
//               (100): suggested for retiring in the Library (the owner decides).
import { postMetrics, scorePosts } from "./analytics.js";

export const SUCCESS_SCORE = 100;
export const RETIRE_MIN_POSTS = 3;
export const LEARNING_RULES = (s) => `A post's weight halves every ${s.half_life_days} days. A winner is a format × style × hook recipe with ${s.winner_min_successes}+ posts scoring over ${SUCCESS_SCORE} (better than this account's median). A format, style or hook with ${RETIRE_MIN_POSTS}+ scored posts whose weighted score is under ${SUCCESS_SCORE} is suggested for retiring.`;

export const freshness = (ageDays, halfLife = 14) => Math.pow(0.5, Math.max(0, ageDays) / Math.max(1, halfLife));
const keyOf = (r) => `${r.format}|${r.style}|${r.hook_type}`;

/** posts: [{posted_at, idea: {recipe}, stats}] → { scored, winners, retire, postsWithStats }. */
export function learn(posts, { now = new Date(), halfLife = 14, minSuccesses = 3 } = {}) {
  const rows = posts.map((p) => ({ post: p, recipe: p.idea?.recipe ?? {}, m: postMetrics(p, now) }));
  scorePosts(rows);
  const scored = rows.filter((r) => r.m.score != null);
  for (const r of scored) r.w = freshness((now.getTime() - Date.parse(r.post.posted_at)) / 86_400_000, halfLife);
  const weighted = (list) => { const w = list.reduce((a, r) => a + r.w, 0); return w ? Math.round(list.reduce((a, r) => a + r.w * r.m.score, 0) / w) : null; };

  const groups = new Map();
  for (const r of scored) { const k = keyOf(r.recipe); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const winners = [...groups.values()].map((list) => {
    const best = [...list].sort((a, b) => b.m.score - a.m.score)[0];
    const { topic, mode, slide_count, replaces, ...recipe } = best.recipe;   // the recipe, without one post's details
    return { key: keyOf(best.recipe), recipe, posts: list.length, successes: list.filter((r) => r.m.score > SUCCESS_SCORE).length, score: weighted(list) };
  }).filter((g) => g.successes >= minSuccesses && g.score > SUCCESS_SCORE).sort((a, b) => b.score - a.score);

  const retire = [];
  for (const [kind, field] of [["format", "format"], ["style", "style"], ["hook", "hook_type"]]) {
    const by = new Map();
    for (const r of scored) { const k = r.recipe[field]; if (!k) continue; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
    for (const [key, list] of by) {
      const score = weighted(list);
      if (list.length >= RETIRE_MIN_POSTS && score < SUCCESS_SCORE) retire.push({ kind, key, posts: list.length, score });
    }
  }
  return { postsWithStats: rows.filter((r) => r.m.snapshots > 0).length, scored: scored.length, winners, retire: retire.sort((a, b) => a.score - b.score) };
}

/** True when enough posts got stats since the last analysis to make a new one worth it. */
export function analysisDue(postsWithStats, lastAnalysisPosts, suggestAfter = 10) {
  return postsWithStats - (lastAnalysisPosts ?? 0) >= suggestAfter;
}

/**
 * The Zyvo account (owner, 2026-10-19): which features (the fact keys its slides cite) and hooks go with profile
 * visits and link clicks. posts: [{idea: {script, recipe}, stats}]. Per feature / hook: posts, the average score,
 * profile visits per 1,000 views, link clicks (summed; entered by hand until the site records UTM visits).
 */
export function featureBreakdown(posts, { now = new Date() } = {}) {
  const rows = posts.map((p) => ({ post: p, recipe: p.idea?.recipe ?? {}, m: postMetrics(p, now) }));
  scorePosts(rows);
  const clicks = (r) => { const last = [...(r.post.stats ?? [])].sort((a, b) => Date.parse(a.taken_at) - Date.parse(b.taken_at)).pop(); return Number(last?.link_clicks ?? 0) || 0; };
  const group = (keyOf) => {
    const g = new Map();
    for (const r of rows) for (const k of new Set(keyOf(r))) { if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
    return [...g].map(([key, list]) => {
      const views = list.reduce((a, r) => a + (r.m.views ?? 0), 0);
      const visits = list.reduce((a, r) => a + (r.m.profileVisits ?? 0), 0);
      const scored = list.filter((r) => r.m.score != null);
      return { key, posts: list.length, score: scored.length ? Math.round(scored.reduce((a, r) => a + r.m.score, 0) / scored.length) : null,
        visitsPer1k: views ? Math.round((visits / views) * 10000) / 10 : null, linkClicks: list.reduce((a, r) => a + clicks(r), 0) };
    }).sort((a, b) => (b.visitsPer1k ?? -1) - (a.visitsPer1k ?? -1));
  };
  return {
    features: group((r) => (r.post.idea?.script?.slides ?? []).flatMap((s) => s.fact_ids ?? [])),
    hooks: group((r) => [r.recipe.hook_type ?? "unknown"]),
    formats: group((r) => [r.recipe.format ?? "unknown"]),
  };
}
