// Content Machine, Part 2: what the posted slideshows did. Pure functions (no database), so every number on
// the Posted and Analytics tabs can be tested. Each post has a timeline of stats snapshots (cm_post_stats):
// hours since posting → the numbers read at that moment.
//
// Views at 24 h / 7 d are read off that timeline: linear between the two snapshots around the hour (the post
// starts at 0 views at hour 0); past the last snapshot they are unknown (the post "needs stats"), never guessed.

export const NEEDS = Object.freeze([
  { key: "24h", hours: 24, covered: 20, label: "needs 24 h stats" },
  { key: "7d", hours: 168, covered: 150, label: "needs 7 d stats" },
]);

// The score (owner, 2026-10-18): views relative to the account, plus weight for saves, shares and profile
// visits. Each part is "this post ÷ the account median" (capped at 5×), so 100 = an ordinary post.
export const SCORE_WEIGHTS = Object.freeze({ views24: 0.6, saveRate: 0.15, shareRate: 0.15, visitRate: 0.1 });
export const SCORE_FORMULA = "score = 100 × (0.60 × views at 24 h ÷ median views at 24 h + 0.15 × saves per view ÷ median + 0.15 × shares per view ÷ median + 0.10 × profile visits per view ÷ median). Each part is capped at 5× the median; 100 = an ordinary post for this account. Posts without 24 h views have no score yet.";

const num = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
export function median(values) {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Snapshots sorted by hours since posting, each with hours computed from the post's time if missing. */
export function timeline(post) {
  const posted = Date.parse(post.posted_at);
  return (post.stats ?? []).map((s) => ({ ...s, hours: num(s.hours_since_post) ?? (Date.parse(s.taken_at) - posted) / 3_600_000 }))
    .filter((s) => Number.isFinite(s.hours) && s.hours >= 0).sort((a, b) => a.hours - b.hours);
}

/** A field's value at `hours` after posting: interpolated, or null when no snapshot reaches that far. */
export function valueAt(points, hours, field = "views") {
  const pts = [{ hours: 0, [field]: 0 }, ...points.filter((p) => num(p[field]) != null)];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (b.hours >= hours) {
      if (b.hours === a.hours) return num(b[field]);
      return Math.round(num(a[field]) + ((num(b[field]) - num(a[field])) * (hours - a.hours)) / (b.hours - a.hours));
    }
  }
  return null;
}

/** The same, but past the last snapshot the last value is carried forward (for the total views chart). */
export function valueAtCarry(points, hours, field = "views") {
  const v = valueAt(points, hours, field);
  if (v != null) return v;
  const known = points.filter((p) => p.hours <= hours && num(p[field]) != null);
  return known.length ? num(known[known.length - 1][field]) : 0;
}

/** One post's numbers: latest snapshot, rates, views at 24 h and 7 d, views per hour, and what it still needs. */
export function postMetrics(post, now = new Date()) {
  const pts = timeline(post);
  const last = pts[pts.length - 1] ?? null;
  const ageHours = (now.getTime() - Date.parse(post.posted_at)) / 3_600_000;
  const v = num(last?.views);
  const per = (x) => (v ? (num(x) ?? 0) / v : null);
  const engaged = last ? ["likes", "comments", "shares", "saves"].reduce((a, k) => a + (num(last[k]) ?? 0), 0) : null;
  const needs = NEEDS.filter((n) => ageHours >= n.hours && !pts.some((p) => p.hours >= n.covered)).map((n) => n.key);
  return {
    snapshots: pts.length, ageHours, latest: last,
    views: v, likes: num(last?.likes), comments: num(last?.comments), shares: num(last?.shares), saves: num(last?.saves),
    profileVisits: num(last?.profile_visits), newFollowers: num(last?.new_followers), avgWatchSec: num(last?.avg_watch_sec), watchedFullPct: num(last?.watched_full_pct),
    engagementRate: v ? engaged / v : null,
    viewsPerHour: v != null && last.hours > 0 ? v / last.hours : null,
    views24: valueAt(pts, 24), views7d: valueAt(pts, 168),
    saveRate: per(last?.saves), shareRate: per(last?.shares), visitRate: per(last?.profile_visits),
    needs,
  };
}

/** Scores every post against the account's medians (over the posts that have 24 h views). */
export function scorePosts(rows) {
  const scored = rows.filter((r) => r.m.views24 != null);
  const med = Object.fromEntries(Object.keys(SCORE_WEIGHTS).map((k) => [k, median(scored.map((r) => r.m[k]))]));
  const part = (x, m) => (x == null ? 1 : m > 0 ? Math.min(5, x / m) : x > 0 ? 2 : 1);
  for (const r of rows) {
    r.m.score = r.m.views24 == null ? null
      : Math.round(100 * Object.entries(SCORE_WEIGHTS).reduce((a, [k, w]) => a + w * part(r.m[k], med[k]), 0));
  }
  return med;
}

const avg = (xs) => { const v = xs.filter((x) => x != null && Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

/**
 * Everything the Analytics tab shows. posts: [{id, platform, posted_at, post_url, idea: {title, recipe}, stats: []}].
 * filters: {platform, format, style, hook, from, to (YYYY-MM-DD, posted date)}; sort: a metric key.
 */
export function analytics(posts, { filters = {}, now = new Date(), sort = "score", dir = "desc" } = {}) {
  const day = (iso) => String(iso ?? "").slice(0, 10);
  const all = posts.map((p) => ({ post: p, recipe: p.idea?.recipe ?? {}, m: postMetrics(p, now) }));
  scorePosts(all);   // the medians are the whole account's, whatever the filter
  const acc = (post) => post.account ?? post.idea?.account ?? post.idea?.recipe?.account ?? "creator";
  const rows = all.filter(({ post, recipe }) => (!filters.account || acc(post) === filters.account) && (!filters.platform || post.platform === filters.platform)
    && (!filters.format || recipe.format === filters.format) && (!filters.style || recipe.style === filters.style)
    && (!filters.hook || recipe.hook_type === filters.hook)
    && (!filters.from || day(post.posted_at) >= filters.from) && (!filters.to || day(post.posted_at) <= filters.to));

  const sum = (list, k) => list.reduce((a, r) => a + (r.m[k] ?? 0), 0);
  const totalsOf = (list) => ({ posts: list.length, views: sum(list, "views"), likes: sum(list, "likes"), comments: sum(list, "comments"), shares: sum(list, "shares"), saves: sum(list, "saves"), profileVisits: sum(list, "profileVisits"), newFollowers: sum(list, "newFollowers") });
  const byAccount = {};
  for (const a of ["creator", "zyvo"]) { const l = rows.filter((r) => acc(r.post) === a); if (l.length) byAccount[a] = totalsOf(l); }
  const byPlatform = {};
  for (const p of ["tiktok", "instagram", "youtube"]) { const l = rows.filter((r) => r.post.platform === p); if (l.length) byPlatform[p] = totalsOf(l); }

  const groupAvg = (key) => {
    const groups = {};
    for (const r of rows) (groups[r.recipe[key] ?? "unknown"] ??= []).push(r);
    return Object.entries(groups).map(([k, l]) => ({ key: k, posts: l.length, views24: avg(l.map((r) => r.m.views24)), score: avg(l.map((r) => r.m.score)), engagementRate: avg(l.map((r) => r.m.engagementRate)) }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  };

  const sign = dir === "asc" ? 1 : -1;
  const table = [...rows].sort((a, b) => {
    const x = sort === "posted_at" ? Date.parse(a.post.posted_at) : a.m[sort], y = sort === "posted_at" ? Date.parse(b.post.posted_at) : b.m[sort];
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    return sign * (x - y);
  });
  const top5 = rows.filter((r) => r.m.score != null).sort((a, b) => b.m.score - a.m.score).slice(0, 5);

  // Total views over time: at the end of each day, every post's views then (carried past its last snapshot).
  const series = [];
  if (rows.length) {
    const first = Math.min(...rows.map((r) => Date.parse(r.post.posted_at)));
    const end = now.getTime();
    for (let t = Date.parse(`${new Date(first).toISOString().slice(0, 10)}T23:59:59Z`); t < end + 86_400_000; t += 86_400_000) {
      const at = Math.min(t, end);
      const total = rows.reduce((a, r) => { const h = (at - Date.parse(r.post.posted_at)) / 3_600_000; return h < 0 ? a : a + valueAtCarry(timeline(r.post), h); }, 0);
      series.push({ day: new Date(at).toISOString().slice(0, 10), views: total });
    }
  }
  return {
    totals: totalsOf(rows), byPlatform, byAccount, table, top5, series,
    // Studio videos (owner, 2026-10-30): which CTA variant and which template did better (the A/B test)
    averages: { format: groupAvg("format"), style: groupAvg("style"), hook: groupAvg("hook_type"), cta: groupAvg("cta").filter((g) => g.key !== "unknown"), template: groupAvg("template").filter((g) => g.key !== "unknown") },
    formula: SCORE_FORMULA, filtered: rows.length, total: all.length,
  };
}
