// Earnings Calculator math. Pure functions: every number on the page comes from calculate().
import {
  AFFILIATE_RATE, AUDIENCES, BASE_RPM, BRAND_MIN_AVG_VIEWS, BRAND_NICHE_CAP, BRAND_TWO_DEALS_AT,
  ELIGIBILITY, EQUIVALENTS, FACELESS_DISCOUNT, LONG_AVG_WATCH_MINUTES, LONG_WATCH_MONTHS, NICHES,
  PLATFORMS, RANGE_HIGH, RANGE_LOW, SHORTS_ELIGIBILITY_MONTHS, SPONSOR_CPM, TIKTOK_QUALIFIED_SHARE,
  WEEKS_PER_MONTH,
} from "./earningsConfig.ts";
import type { AudienceId, PlatformId } from "./earningsConfig.ts";

export type Inputs = {
  niche: string;
  platform: PlatformId;
  videosPerWeek: number;
  avgViews: number;
  audience: AudienceId;
  stack: { payout: boolean; brand: boolean; affiliate: boolean };
};

const nicheMultiplier = (id: string) => (NICHES.find((n) => n.id === id) ?? NICHES[0]).multiplier;
const audienceMultiplier = (id: string) => (AUDIENCES.find((a) => a.id === id) ?? AUDIENCES[1]).multiplier;

function forPlatform(input: Inputs, platform: PlatformId) {
  const niche = nicheMultiplier(input.niche);
  const audience = audienceMultiplier(input.audience);
  const videosPerMonth = input.videosPerWeek * WEEKS_PER_MONTH;
  const monthlyViews = input.avgViews * videosPerMonth;
  const paidViews = platform === "tiktok" ? monthlyViews * TIKTOK_QUALIFIED_SHARE : monthlyViews;
  const rpm = BASE_RPM[platform] * niche * audience;

  const brandUnlocked = input.avgViews >= BRAND_MIN_AVG_VIEWS;
  const perDeal = (input.avgViews / 1000) * SPONSOR_CPM[platform] * Math.min(niche, BRAND_NICHE_CAP) * FACELESS_DISCOUNT;
  const dealsPerMonth = input.avgViews < BRAND_TWO_DEALS_AT ? 1 : 2;

  const rawRows = {
    payout: (paidViews / 1000) * rpm,
    brand: brandUnlocked ? perDeal * dealsPerMonth : 0,
    affiliate: (monthlyViews / 1000) * AFFILIATE_RATE[platform] * niche * audience,
  };
  const on = (key: keyof Inputs["stack"]) => input.stack[key];
  const rawTotal = (on("payout") ? rawRows.payout : 0) + (on("brand") ? rawRows.brand : 0) + (on("affiliate") ? rawRows.affiliate : 0);

  // Each row is rounded to the step the total is shown in, and the total is the exact sum of the
  // switched-on rows, so the rows on screen always add up to the number in the hero.
  const step = moneyStep(rawTotal);
  const round = (v: number) => Math.round(v / step) * step;
  const rows = { payout: round(rawRows.payout), brand: round(rawRows.brand), affiliate: round(rawRows.affiliate) };
  const total = (on("payout") ? rows.payout : 0) + (on("brand") ? rows.brand : 0) + (on("affiliate") ? rows.affiliate : 0);

  return { videosPerMonth, monthlyViews, rpm, rawRows, rows, total, brandUnlocked, dealsPerMonth };
}

export function eligibility(platform: PlatformId, monthlyViews: number) {
  const rule = ELIGIBILITY[platform];
  const current =
    platform === "tiktok" ? monthlyViews
    : platform === "youtube_shorts" ? monthlyViews * SHORTS_ELIGIBILITY_MONTHS
    : (monthlyViews * LONG_WATCH_MONTHS * LONG_AVG_WATCH_MINUTES) / 60;
  const progress = Math.min(1, current / rule.target);
  return { ...rule, current, progress, unlocked: current >= rule.target };
}

export function equivalentFor(monthly: number) {
  let pick: string | null = null;
  for (const e of EQUIVALENTS) if (monthly >= e.from) pick = e.text;
  return pick;
}

export function calculate(input: Inputs) {
  const main = forPlatform(input, input.platform);
  const compare = PLATFORMS.map((p) => ({ ...p, total: forPlatform(input, p.id).total }));
  return {
    ...main,
    monthly: main.total,
    yearly: main.total * 12,
    low: main.total * RANGE_LOW,
    high: main.total * RANGE_HIGH,
    perVideo: main.videosPerMonth > 0 ? main.total / main.videosPerMonth : 0,
    compare,
    eligibility: eligibility(input.platform, main.monthlyViews),
    equivalent: equivalentFor(main.total),
  };
}

// The precision formatMoney shows a value in (kept in step with formatMoney below).
export function moneyStep(value: number) {
  const v = Math.abs(value);
  if (v < 10) return 0.01;
  if (v < 1_000) return 1;
  if (v < 99_950) return 100;
  if (v < 999_500) return 1_000;
  return 100_000;
}

// $0.43, $950, $1.2K, $14K, $30.8K, $250K, $1.3M. Cents only below $10.
export function formatMoney(value: number) {
  const v = Math.max(0, Number.isFinite(value) ? value : 0);
  if (v === 0) return "$0";
  if (v < 10) return `$${v.toFixed(2)}`;
  if (v < 999.5) return `$${Math.round(v)}`;
  if (v < 99_950) return `$${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  if (v < 999_500) return `$${Math.round(v / 1_000)}K`;
  return `$${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

// 950, 1.2K, 14K, 1.3M.
export function formatCount(value: number) {
  const v = Math.max(0, Math.round(value));
  if (v < 1_000) return String(v);
  if (v < 9_950) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  if (v < 999_500) return `${Math.round(v / 1_000)}K`;
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
