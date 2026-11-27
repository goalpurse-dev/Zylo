// Zyvo's plan and credit RULES in words: ONE copy, read by the pricing page (its plan lines, Free box and FAQ:
// src/components/pricing) and by Maestro's knowledge (_shared/maestro/knowledge.js). Change a rule here and both say
// the new thing. Numbers are not typed here: prices come live from Stripe (plan-prices), credits from
// stripePlanPrices.js, programs from their own config files.
// Plain JS (no imports), so the website, the edge functions and the tests share it.

/** what each plan is, as the pricing page says it (the quality tiers it unlocks) */
export const PLAN_LINES = Object.freeze({
  starter: Object.freeze({ line: "Every tool and template at V2 quality.", tiers: Object.freeze(["v2"]) }),
  pro: Object.freeze({ line: "Sharper V3 quality and more credits.", tiers: Object.freeze(["v2", "v3"]), badge: "Recommended: unlocks V3" }),
  generative: Object.freeze({ line: "Every quality tier and the most credits.", tiers: Object.freeze(["v2", "v3", "v4"]) }),
});

/** who each plan is for (owner 2026-11-26: Maestro's plan advice). There is no plan above Generative. */
export const PLAN_FIT = Object.freeze({
  starter: "testing Zyvo and making a few videos a month",
  pro: "one channel that posts regularly",
  generative: "posting every day, or more than one channel",
});

export const FREE_PLAN = "Sign up free: 5 AI images every 30 days and a look around every tool. Making videos needs a plan. No card needed.";

// The FAQ on the pricing page, word for word.
export const BILLING_FAQ = Object.freeze([
  { q: "Can I cancel anytime?", a: "Yes. Manage your plan in the Stripe portal. It stays active until the end of your paid period, with no surprise charges." },
  { q: "Do unused credits roll over?", a: "Monthly credits add to your balance; they don't reset to zero. One-time packs never expire." },
  { q: "How do upgrades and downgrades work?", a: "Both are handled securely in Stripe. Upgrades are instant (prorated). Downgrades take effect at your next renewal." },
  { q: "Do you offer refunds?", a: "Unused credits are refundable within 7 days. Once credits are spent, refunds can't be issued because of AI generation costs." },
  { q: "What do V2, V3 and V4 mean?", a: "They're quality tiers for Zyvo's templates and Long Form. V2 is on every plan, V3 needs Pro, V4 needs Generative. Higher tiers look sharper and use more credits." },
  { q: "Is there a free plan?", a: "Yes. Sign up free for 5 AI images every 30 days and a look around every tool. Making videos needs a plan." },
]);

// What happens to credits when something fails on our side (every maker refunds a failed run: generation jobs via
// fail_and_refund_generation_job and the sweeper, In This Town via blocky_worlds_refund, Cutaway, Long Form reservations).
// Long Form (since 2026-10-03, migration 20261024100000): a failed scene or render is retried free and finished work is
// kept; everything comes back only when the video can't be made at all.
export const FAILED_RUNS = "If a video or image can't be made because of a problem on our side, its credits go back to your balance automatically. In Long Form, a scene or final render that fails is retried for free; everything comes back if the video can't be made at all.";
export const WHERE_TO_CANCEL = "Settings > Billing > Cancel plan (it opens the secure Stripe portal). The plan stays active until the end of the period you paid for.";
