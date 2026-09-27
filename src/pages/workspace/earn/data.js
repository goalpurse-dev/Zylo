// Mock data for the Earn page. Nothing here is fetched from a backend yet —
// submissions, leaderboard and referral-activity pipelines don't exist.
// Only the referral code (data.js has none) and connected-accounts card use
// real Supabase data; everything below is placeholder shape for the UI.

export const RATE_CARD = {
  creditsPerThousandViews: 120,
  referralCommissionPct: 20,
  cookieWindowDays: 30,
  payoutThresholdEur: 25,
  payoutSchedule: "Monthly, on the 1st",
  creditsPerEur: 100,
};

export const MILESTONES = [
  { views: 10_000, label: "10K", unlock: "Priority review queue" },
  { views: 25_000, label: "25K", unlock: "+10% credit rate boost" },
  { views: 50_000, label: "50K", unlock: "Early access to brand campaigns" },
  { views: 100_000, label: "100K", unlock: "Paid Creator — cash payouts unlocked" },
];

export const ONBOARDING_STEPS = [
  {
    key: "connect",
    title: "Connect socials",
    description: "Link the accounts you post from so views can be verified.",
    href: "/workspace/connections",
  },
  {
    key: "create",
    title: "Create with Zyvo",
    description: "Generate a post using any Zyvo tool.",
    href: "/workspace/home",
  },
  {
    key: "post",
    title: "Post with tracking link",
    description: "Share your referral link in the caption or bio.",
    href: "#referral",
  },
  {
    key: "verify",
    title: "Get verified",
    description: "We confirm views 48h after you post.",
    href: "/workspace/earn/rules",
  },
];

export const MOCK_STATS = {
  totalViews: { value: 48_200, delta: "+6,140 this week" },
  pendingCredits: { value: 1_240, delta: "+310 this week" },
  earnedCredits: { value: 5_320, delta: "+840 this week" },
  referralEarnings: { value: 48.0, delta: "+€12.00 this week" },
};

export const MOCK_SUBMISSIONS = [
  {
    id: "sub_1",
    platform: "tiktok",
    postedAt: "2026-08-28",
    views: 18_400,
    verifiedViews: 17_950,
    credits: 215,
    status: "verified",
  },
  {
    id: "sub_2",
    platform: "instagram",
    postedAt: "2026-08-30",
    views: 6_200,
    verifiedViews: null,
    credits: 0,
    status: "pending",
  },
  {
    id: "sub_3",
    platform: "youtube",
    postedAt: "2026-08-22",
    views: 900,
    verifiedViews: 0,
    credits: 0,
    status: "rejected",
    reason: "Views from a private or unlisted video can't be verified",
  },
];

export const MOCK_PAYOUT_FEED = [
  { handle: "creator_84f2", credits: 340, timeAgo: "2m ago" },
  { handle: "nightloop.ai", credits: 120, timeAgo: "6m ago" },
  { handle: "studio_ln", credits: 860, timeAgo: "11m ago" },
  { handle: "clipwave_x", credits: 210, timeAgo: "18m ago" },
  { handle: "zyvo_maker_19", credits: 475, timeAgo: "24m ago" },
  { handle: "pixel.forge", credits: 95, timeAgo: "31m ago" },
  { handle: "loop_daily", credits: 615, timeAgo: "40m ago" },
  { handle: "render_ash", credits: 180, timeAgo: "52m ago" },
];

export const MOCK_REFERRAL_STATS = { clicks: 340, signups: 28, converted: 9, earningsEur: 48.0 };

export const SOCIAL_CAPTIONS = [
  "I've been making my content with Zyvo — try it free:",
  "This is how I make my thumbnails and videos in minutes now 👀",
  "Zyvo turns one idea into a week of content. Link below:",
];

export const MOCK_LEADERBOARD = [
  { handle: "creator_84f2", credits: 12_400 },
  { handle: "zyvo_maker_19", credits: 9_800 },
  { handle: "studio_ln", credits: 8_650 },
  { handle: "clipwave_x", credits: 7_200 },
  { handle: "nightloop.ai", credits: 6_100 },
];

export const CREDITS_PAID_THIS_MONTH = 184_300;

export const CASH_CAMPAIGNS = [
  { id: "camp_1", title: "Launch week push", payout: "€250 pool", deadline: "Ends in 6 days" },
  { id: "camp_2", title: "Template spotlight", payout: "€150 pool", deadline: "Ends in 13 days" },
];

export const PAYOUT_METHODS = [
  { id: "bank", label: "Bank transfer (SEPA)" },
  { id: "paypal", label: "PayPal" },
];

export const RULES_SECTIONS = [
  {
    title: "Eligibility",
    body: "Open to any Zyvo account in good standing. You must connect at least one social account you actively post from before submissions can be verified.",
  },
  {
    title: "What counts as a verified view",
    body: "A view counted by the platform's own public analytics, checked at least 48 hours after posting and filtered for bot and repeat-refresh traffic. Deleted, private, or unlisted posts can't be verified.",
  },
  {
    title: "Fraud policy & rejection triggers",
    body: "Purchased views, engagement pods, view-count manipulation, or reposting someone else's content as your own will get a submission rejected and can result in removal from the program.",
  },
  {
    title: "Payout timing",
    body: `Credits convert to cash once you cross the payout threshold (€${RATE_CARD.payoutThresholdEur}) and reach Paid Creator status. Payouts run on the schedule shown on the rate card.`,
  },
  {
    title: "Tax responsibility",
    body: "Creators are responsible for reporting and paying any taxes owed on rewards or payouts received through the program in their own jurisdiction.",
  },
  {
    title: "Support",
    body: "Questions about a rejected submission or a payout — reach us at support@tryzyvo.com.",
  },
];
