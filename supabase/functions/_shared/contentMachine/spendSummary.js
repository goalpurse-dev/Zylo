// Content Machine: the numbers on the top bar and the Budget tab, from ledger rows. The same rule as the
// SQL that enforces the caps (cm_reserve_spend): a row counts its actual cost once known, else its
// reserved estimate; days are local days in the settings' time zone.

export const WARN_AT = 0.8;

const cost = (r) => Number(r.actual_usd ?? r.estimated_usd ?? 0);
const round = (n) => Math.round(n * 1e6) / 1e6;

/** YYYY-MM-DD of `date` in `timeZone`. */
export function localDay(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export const monthStart = (day) => `${day.slice(0, 7)}-01`;

/** The last `n` local days ending with `day`, oldest first. */
export function daysBack(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d - (n - 1 - i))).toISOString().slice(0, 10));
}

function meter(usedUsd, capUsd) {
  if (capUsd == null) return { usedUsd: round(usedUsd), capUsd: null, share: null, warn: false, full: false };
  const share = capUsd > 0 ? usedUsd / capUsd : usedUsd > 0 ? Infinity : 0;
  return { usedUsd: round(usedUsd), capUsd, share: Number.isFinite(share) ? round(share) : 1, warn: share >= WARN_AT, full: share >= 1 };
}

/** rows: this month's ledger rows (at least). today: the local day. */
export function summarize(rows, settings, today) {
  const first = monthStart(today);
  let todayUsd = 0, monthUsd = 0, reservedUsd = 0, dryCalls = 0, dryWouldCostUsd = 0;
  const byProvider = {}, byLane = {};
  for (const r of rows) {
    if (r.local_day < first || r.local_day > today) continue;
    const c = cost(r);
    monthUsd += c;
    if (r.local_day !== today) continue;
    todayUsd += c;
    if (r.status === "reserved") reservedUsd += c;
    byProvider[r.provider] = (byProvider[r.provider] ?? 0) + c;
    if (r.lane) byLane[r.lane] = (byLane[r.lane] ?? 0) + c;
    if (r.dry_run) { dryCalls += 1; dryWouldCostUsd += Number(r.would_cost_usd ?? 0); }
  }
  const providerCaps = settings.per_provider_daily_caps ?? {};
  const laneCaps = settings.lane_daily_caps ?? {};
  const providers = [...new Set([...Object.keys(providerCaps), ...Object.keys(byProvider)])].sort();
  const lanes = [...new Set([...Object.keys(laneCaps), ...Object.keys(byLane)])].sort();
  const day = meter(todayUsd, Number(settings.daily_budget_usd));
  const month = meter(monthUsd, Number(settings.monthly_budget_usd));
  const provider = Object.fromEntries(providers.map((p) => [p, meter(byProvider[p] ?? 0, providerCaps[p] != null ? Number(providerCaps[p]) : null)]));
  const lane = Object.fromEntries(lanes.map((l) => [l, meter(byLane[l] ?? 0, laneCaps[l] != null ? Number(laneCaps[l]) : null)]));
  const warnings = [];
  if (day.warn) warnings.push(day.full ? "Today's budget is used up." : `${Math.round(day.share * 100)} % of today's budget is used.`);
  if (month.warn) warnings.push(month.full ? "This month's budget is used up." : `${Math.round(month.share * 100)} % of this month's budget is used.`);
  for (const [p, m] of Object.entries(provider)) if (m.warn) warnings.push(m.full ? `${p}: today's cap is used up.` : `${p}: ${Math.round(m.share * 100)} % of today's cap.`);
  for (const [l, m] of Object.entries(lane)) if (m.warn) warnings.push(m.full ? `${l}: today's cap is used up.` : `${l}: ${Math.round(m.share * 100)} % of today's cap.`);
  return { today, day, month, provider, lane, reservedUsd: round(reservedUsd), dryCalls, dryWouldCostUsd: round(dryWouldCostUsd), warnings };
}

/** Spend per local day per provider, for the last `n` days (the Budget tab's chart). */
export function dailySeries(rows, today, n = 30) {
  const days = daysBack(today, n);
  const index = Object.fromEntries(days.map((d, i) => [d, i]));
  const out = days.map((d) => ({ day: d, totalUsd: 0, byProvider: {} }));
  for (const r of rows) {
    const i = index[r.local_day];
    if (i == null) continue;
    const c = cost(r);
    out[i].totalUsd = round(out[i].totalUsd + c);
    out[i].byProvider[r.provider] = round((out[i].byProvider[r.provider] ?? 0) + c);
  }
  return out;
}
