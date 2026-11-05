// Earnings Calculator: every number the page uses lives here.
// sources: AIR Media-Tech, vidIQ, TikTok Creator Rewards reports, Nov 2026
// Tweak freely: the page, the bars, the tiles and the progress bar all read from this file.

export type PlatformId = "tiktok" | "youtube_shorts" | "youtube_long";
export type AudienceId = "us_uk" | "mixed" | "other";

export const WEEKS_PER_MONTH = 4.33;

export const PLATFORMS: { id: PlatformId; label: string; short: string }[] = [
  { id: "tiktok", label: "TikTok", short: "TikTok" },
  { id: "youtube_shorts", label: "YouTube Shorts", short: "Shorts" },
  { id: "youtube_long", label: "YouTube Long-form", short: "Long-form" },
];

// USD per 1,000 views, mixed audience.
export const BASE_RPM: Record<PlatformId, number> = {
  youtube_long: 3.0,
  youtube_shorts: 0.05,
  tiktok: 0.6,
};

// TikTok Creator Rewards only counts qualified views (and only videos 60 s+ earn).
export const TIKTOK_QUALIFIED_SHARE = 0.6;

export const NICHES: { id: string; label: string; multiplier: number }[] = [
  { id: "finance", label: "Finance & money", multiplier: 3.0 },
  { id: "explainers", label: "Explainers / how it works", multiplier: 2.0 },
  { id: "tech", label: "Tech & AI", multiplier: 1.7 },
  { id: "history", label: "History", multiplier: 1.4 },
  { id: "horror", label: "Horror & mystery", multiplier: 1.2 },
  { id: "stories", label: "Stories & drama", multiplier: 1.2 },
  { id: "motivation", label: "Motivation", multiplier: 1.0 },
  { id: "facts", label: "Facts & trivia", multiplier: 1.0 },
  { id: "gaming", label: "Gaming / Roblox-style", multiplier: 0.7 },
  { id: "satisfying", label: "Satisfying / ASMR", multiplier: 0.5 },
  { id: "kids", label: "Kids & fan content", multiplier: 0.3 },
];

export const AUDIENCES: { id: AudienceId; label: string; multiplier: number }[] = [
  { id: "us_uk", label: "Mostly US/UK", multiplier: 1.5 },
  { id: "mixed", label: "Mixed", multiplier: 1.0 },
  { id: "other", label: "Mostly other countries", multiplier: 0.4 },
];

// Realistic range around the total.
export const RANGE_LOW = 0.5;
export const RANGE_HIGH = 1.8;

// Brand deals.
export const BRAND_MIN_AVG_VIEWS = 10_000;
export const SPONSOR_CPM: Record<PlatformId, number> = {
  youtube_long: 20,
  youtube_shorts: 8,
  tiktok: 8,
};
export const BRAND_NICHE_CAP = 2; // min(niche, 2)
export const FACELESS_DISCOUNT = 0.6;
export const BRAND_TWO_DEALS_AT = 100_000; // 1 deal/month below this avg, 2 at or above

// Affiliate links, USD per 1,000 monthly views (before niche × audience).
export const AFFILIATE_RATE: Record<PlatformId, number> = {
  youtube_long: 1.0,
  youtube_shorts: 0.2,
  tiktok: 0.2,
};

// Monetization thresholds (display only, real accounts are not checked).
export const ELIGIBILITY: Record<PlatformId, { program: string; requirement: string; target: number; unit: string }> = {
  tiktok: { program: "TikTok Creator Rewards", requirement: "10K followers + 100K views in the last 30 days", target: 100_000, unit: "views / 30 days" },
  youtube_shorts: { program: "YouTube Shorts payouts", requirement: "1K subs + 10M Shorts views in 90 days", target: 10_000_000, unit: "views / 90 days" },
  youtube_long: { program: "YouTube long-form payouts", requirement: "1K subs + 4,000 watch hours", target: 4_000, unit: "watch hours" },
};
export const SHORTS_ELIGIBILITY_MONTHS = 3; // 90 days of views
export const LONG_WATCH_MONTHS = 12; // watch hours counted over 12 months
export const LONG_AVG_WATCH_MINUTES = 4;

// Inputs.
export const VIDEOS_PER_WEEK = { min: 1, max: 21, default: 5 };
export const AVG_VIEWS = { min: 1_000, max: 1_000_000, default: 10_000, chips: [1_000, 10_000, 50_000, 100_000, 500_000, 1_000_000] };
export const DEFAULTS = {
  niche: "facts",
  platform: "youtube_long" as PlatformId,
  videosPerWeek: VIDEOS_PER_WEEK.default,
  avgViews: AVG_VIEWS.default,
  audience: "mixed" as AudienceId,
  stack: { payout: true, brand: false, affiliate: false },
};

// "≈ ..." line under the hero: the highest `from` at or below the monthly total wins.
export const EQUIVALENTS: { from: number; text: string }[] = [
  { from: 0.01, text: "≈ a coffee every month" },
  { from: 10, text: "≈ a streaming subscription" },
  { from: 40, text: "≈ your phone bill" },
  { from: 120, text: "≈ a nice dinner out every week" },
  { from: 300, text: "≈ a weekend trip every month" },
  { from: 500, text: "≈ a new iPhone every 2 months" },
  { from: 1_000, text: "≈ a new iPhone every month" },
  { from: 2_000, text: "≈ your rent, covered" },
  { from: 5_000, text: "≈ a full-time salary" },
  { from: 15_000, text: "≈ a new car every 2 months" },
];
