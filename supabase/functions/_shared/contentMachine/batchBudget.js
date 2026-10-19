// Content Machine: "will this batch fit today's caps?" (owner, 2026-10-19). Both accounts share the caps ($3 a
// day in total, $2.50 Anthropic, $3 for slideshows); a batch that would go over is refused BEFORE it starts,
// instead of stopping halfway. Pure: the caller passes today's spend summary and the account's recent costs.

// Until an account has real slideshows to learn from: the creator account writes with web search; the Zyvo
// account doesn't (it claims only from the fact sheet), so it costs less.
export const DEFAULT_PER_SLIDESHOW = { creator: 0.22, zyvo: 0.15 };
// Of a slideshow's cost, about this much is the writing and checking (Anthropic); the rest is pictures and the render.
export const ANTHROPIC_SHARE = 0.9;

/** The cost of one slideshow of this account: the average of its recent real ones (at least 3), else the default. */
export function perSlideshowUsd(account, recentCosts = []) {
  const real = recentCosts.filter((c) => Number.isFinite(c) && c > 0);
  if (real.length < 3) return DEFAULT_PER_SLIDESHOW[account] ?? DEFAULT_PER_SLIDESHOW.creator;
  const avg = real.reduce((a, b) => a + b, 0) / real.length;
  return Math.round(avg * 1.15 * 1000) / 1000;   // 15 % headroom: a rewrite or a regenerate costs extra
}

/**
 * summary: spendSummary.summarize() for today. Returns { estimateUsd, perUsd, fits, maxCount, leftUsd, limit, message }.
 * limit names the cap that decides (daily total, Anthropic, slideshows lane).
 */
export function batchCheck({ account, count, summary, recentCosts = [], dryRun = false }) {
  const per = perSlideshowUsd(account, recentCosts);
  const est = Math.round(per * count * 1000) / 1000;
  if (dryRun) return { estimateUsd: est, perUsd: per, fits: true, maxCount: 10, leftUsd: null, limit: null, message: null };
  const left = (m) => (m?.capUsd == null ? Infinity : Math.max(0, m.capUsd - m.usedUsd));
  const caps = [
    { name: "today's total budget", left: left(summary.day), share: 1 },
    { name: "this month's budget", left: left(summary.month), share: 1 },
    { name: "the Anthropic cap", left: left(summary.provider?.anthropic), share: ANTHROPIC_SHARE },
    { name: "the slideshow cap", left: left(summary.lane?.slideshow), share: 1 },
  ];
  // How many slideshows each cap still allows; the smallest decides.
  const allowed = caps.map((c) => ({ ...c, n: c.left === Infinity ? Infinity : Math.floor(c.left / (per * c.share) + 1e-9) }));
  const tightest = allowed.reduce((a, b) => (b.n < a.n ? b : a));
  const maxCount = Math.max(0, Math.min(10, tightest.n));
  const fits = count <= maxCount;
  const leftUsd = tightest.left === Infinity ? null : Math.round(tightest.left * 100) / 100;
  const message = fits ? null : maxCount === 0
    ? `This batch needs about $${est.toFixed(2)}, but ${tightest.name} has $${leftUsd.toFixed(2)} left today. Nothing would be made: try again tomorrow or raise the cap.`
    : `This batch needs about $${est.toFixed(2)}, but ${tightest.name} has $${leftUsd.toFixed(2)} left today: make ${maxCount} or fewer.`;
  return { estimateUsd: est, perUsd: per, fits, maxCount, leftUsd, limit: tightest.name, message };
}
