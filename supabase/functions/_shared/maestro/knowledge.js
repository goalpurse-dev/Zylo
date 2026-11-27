// What Maestro knows about Zyvo itself (owner 2026-11-26): plans, credits, what credits buy, every studio and template,
// Rewards, Affiliate, Use with Claude, the credit rules and how to cancel. BUILT FROM THE REAL DATA, never typed in:
//   prices            live from Stripe (the plan-prices function, the same numbers the pricing page shows)
//   plan credits      _shared/stripePlanPrices.js       template prices   _shared/director/styles.js (creditsFor)
//   plan words, FAQ   _shared/billingPolicy.js          equivalents       _shared/planEquivalents.js
//   Rewards           _shared/rewards/config.js         Affiliate         _shared/affiliate/config.js
//   sign-up bonus     _shared/signupBonus.js            offers            _shared/offer.js, _shared/launchDeal.js
//   Use with Claude   _shared/zyvoMcp/config.js         Maestro's limits  ./brain.js (passed in)
// Plain JS, so the Node tests check every number against the same files.
import { STUDIOS, STYLES, creditsFor } from "../director/styles.js";
import { PLAN_CREDITS, TOPUP_CREDITS } from "../stripePlanPrices.js";
import { BILLING_FAQ, FAILED_RUNS, FREE_PLAN, PLAN_FIT, PLAN_LINES, WHERE_TO_CANCEL } from "../billingPolicy.js";
import { QUICK_IMAGE_CREDITS, TOWN_VIDEO_CREDITS, planEquivalents } from "../planEquivalents.js";
import { TOWN_LENGTHS, townPrice } from "../director/styles.js";
import { REWARDS } from "../rewards/config.js";
import { LIVE } from "../liveFeatures.js";
import { AFFILIATE } from "../affiliate/config.js";
import { SIGNUP_BONUS } from "../signupBonus.js";
import { OFFER, offerLive } from "../offer.js";
import { LAUNCH_DEAL, launchDealLive, launchDealPrice } from "../launchDeal.js";
import { FINISH_CREDITS, VIDEO_CREDITS, WRITE_SCRIPT_CREDITS } from "../zyvoMcp/config.js";

export const PLAN_ORDER = Object.freeze(["starter", "pro", "generative"]);
export const PLAN_NAMES = Object.freeze({ starter: "Starter", pro: "Pro", generative: "Generative" });
export const PACK_NAMES = Object.freeze({ mini: "Mini", standard: "Standard", max: "Max" });
const fmt = (n) => Number(n).toLocaleString("en-US");

/** "€18" / "€14.40": whole amounts without cents, like the pricing page */
export function money(amount, currency = "eur") {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  const whole = Number.isInteger(Number(amount));
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: String(currency).toUpperCase(), minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(Number(amount));
}

const lengthLabel = (sec) => (sec < 60 ? `${sec} s` : `${sec / 60} min`);
/** credits per video at each length; In This Town is one flat price at every length */
export function videoPrices(style) {
  if (style.engine?.direct === "town") return TOWN_LENGTHS.map((s) => ({ seconds: s, credits: townPrice(s), label: `${s} s`, exact: true }));
  return style.lengths.map((seconds) => ({ seconds, credits: creditsFor(style, seconds), label: lengthLabel(seconds), exact: false }));
}
/** how many videos `credits` make, rounded down */
export const videosFor = (credits, perVideo) => (perVideo > 0 ? Math.floor(credits / perVideo) : 0);

/** the plan facts Maestro and its cards use: { plan, name, credits, monthly, yearly, currency } (prices may be null) */
export function planFacts(prices) {
  return PLAN_ORDER.map((plan) => ({
    plan, name: PLAN_NAMES[plan], credits: PLAN_CREDITS[plan],
    monthly: prices?.plans?.[plan]?.monthly ?? null, yearly: prices?.plans?.[plan]?.yearly ?? null, currency: prices?.currency ?? "eur",
  }));
}
export function packFacts(prices) {
  return Object.keys(TOPUP_CREDITS).map((pack) => ({ pack, name: PACK_NAMES[pack] ?? pack, credits: TOPUP_CREDITS[pack], price: prices?.topups?.[pack]?.price ?? null, currency: prices?.currency ?? "eur" }));
}

/** offers running right now (from the code that applies them at checkout); [] = no discount of any kind */
export function liveOffers(at = Date.now(), prices = null) {
  const out = [];
  if (launchDealLive(at)) {
    const m = prices?.plans?.[LAUNCH_DEAL.plan]?.monthly;
    out.push(`${PLAN_NAMES[LAUNCH_DEAL.plan]} monthly: ${LAUNCH_DEAL.percentOff}% off the first month${m != null ? ` (${money(launchDealPrice(m), prices.currency)} instead of ${money(m, prices.currency)})` : ""}, until ${new Date(LAUNCH_DEAL.endsAt).toUTCString()}.`);
  }
  if (offerLive(at)) out.push(`+${OFFER.bonusCredits} bonus credits on any plan upgrade, until ${new Date(OFFER.endsAt).toUTCString()}.`);
  return out;
}

/** the knowledge block of Maestro's prompt */
export function zyvoKnowledge({ prices = null, at = Date.now(), maestroLimits = null, styles = STYLES, live = LIVE } = {}) {
  const plans = planFacts(prices);
  const cur = prices?.currency ?? "eur";
  const priced = Boolean(prices?.plans);
  const L = [];
  L.push("ZYVO FACTS. These come from Zyvo's own pricing data. Use ONLY these numbers; if a number isn't here, say you're not sure and point to the pricing page.");
  L.push("");
  L.push(`PLANS (monthly credits are added to the balance every month; prices ${priced ? (prices.vatIncluded ? "include VAT" : "are before VAT") : "are on the pricing page"}):`);
  for (const p of plans) {
    const eq = planEquivalents(p.credits);
    const price = priced ? `${money(p.monthly, cur)} a month, or ${money(p.yearly, cur)} a year (${money(Math.round((p.yearly / 12) * 100) / 100, cur)} a month)` : "price: see the pricing page";
    L.push(`- ${p.name}: ${price}. ${fmt(p.credits)} credits a month. ${PLAN_LINES[p.plan].line} Best for: ${PLAN_FIT[p.plan]}. ${fmt(p.credits)} credits ≈ ${eq.town} 60-second In This Town videos or ≈ ${fmt(eq.images)} quick images.`);
  }
  L.push("- There is no plan above Generative. Someone running several channels takes Generative and adds credit packs when needed.");
  L.push(`- Free: ${FREE_PLAN}`);
  L.push(`CREDIT PACKS (one-time, they never expire): ${packFacts(prices).map((k) => `${k.name}: ${fmt(k.credits)} credits${k.price != null ? ` for ${money(k.price, cur)}` : ""}`).join("; ")}.`);
  L.push("");
  L.push("WHAT EACH TEMPLATE COSTS, AND HOW MANY A PLAN'S MONTHLY CREDITS MAKE (credits ÷ price, rounded down; use these counts, never your own math):");
  for (const s of styles) {
    const rows = videoPrices(s).map((v) => `${v.label}: ${v.exact ? "" : "about "}${fmt(v.credits)} credits → ${plans.map((p) => `${p.name} ${videosFor(p.credits, v.credits)}`).join(", ")}`);
    L.push(`- ${s.name}${s.tier === "paid" ? " (paid plans)" : ""}: ${rows.join(" | ")}`);
  }
  L.push(`- Quick image: ${QUICK_IMAGE_CREDITS} credits each → ${plans.map((p) => `${p.name} ${videosFor(p.credits, QUICK_IMAGE_CREDITS)}`).join(", ")}. Quick clips (5-10 s, no voice): the card shows the exact price.`);
  L.push(`- In This Town, made in this chat: exactly ${TOWN_LENGTHS.map((s) => `${s} s ${townPrice(s)} credits`).join(", ")} (60 to 120 seconds; the button shows the same number). Other prices are our estimates: the template's page shows the exact price before anything is charged.`);
  L.push("");
  L.push("STUDIOS: " + STUDIOS.map((s) => `${s.name} (${s.line})`).join("; ") + ".");
  L.push("");
  L.push("CREDITS AND BILLING RULES (say them like this, nothing more):");
  for (const f of BILLING_FAQ) L.push(`- ${f.q} ${f.a}`);
  L.push(`- Failed videos: ${FAILED_RUNS}`);
  L.push(`- How to cancel: ${WHERE_TO_CANCEL}`);
  L.push("");
  const offers = liveOffers(at, prices);
  L.push(`OFFERS RIGHT NOW: ${offers.length ? offers.join(" ") : "No discount or coupon is running."} New accounts: +${SIGNUP_BONUS.credits} bonus credits on their first plan if they buy within ${SIGNUP_BONUS.days} days of signing up. Never mention any other discount.`);
  L.push("");
  const t = REWARDS.videoTiers;
  // only what is live (_shared/liveFeatures.js): a program that isn't live yet is never explained or offered
  if (live.rewards) L.push(`REWARDS (free credits; earning needs a paid plan, free accounts can look): post a video made with Zyvo; when it reaches ${t.map((x) => `${fmt(x.views)} views → ${fmt(x.credits)} credits`).join(", ")} (a re-check pays only the difference; up to ${REWARDS.submissionsPerWeek} video links a week). Invite a friend: when their FIRST purchase goes through you get ${REWARDS.invite.inviterCredits} credits and they get ${REWARDS.invite.friendCredits} (up to ${REWARDS.invite.maxPerMonth} invite rewards a month). On the Rewards page.`);
  if (live.affiliate) L.push(`AFFILIATE (for creators who share Zyvo): ${Math.round(AFFILIATE.cashRate * 100)}% in cash or ${Math.round(AFFILIATE.creditRate * 100)}% in credits of a referred person's FIRST payment, available after ${AFFILIATE.holdDays} days; cash is paid by PayPal or Wise from ${money(AFFILIATE.minCashPayoutEur, "eur")}. People who sign up with your code get ${AFFILIATE.signupBonusCredits} credits. On the Affiliate page.`);
  L.push(`USE WITH CLAUDE: connect Zyvo to your own Claude (the Use with Claude page) and make In This Town videos from there. The free Zyvo Studio Kit builds the story in your own Roblox Studio for free (you record it). Through Claude, Zyvo can write the script (${WRITE_SCRIPT_CREDITS} credits), make the voice (a few credits), finish your recording (${FINISH_CREDITS} credits), or make the whole video in Zyvo (${VIDEO_CREDITS} credits).`);
  if (maestroLimits) L.push(`MAESTRO (this chat): included in every plan. Messages a day: Free ${maestroLimits.free}, Starter ${maestroLimits.starter}, Pro ${maestroLimits.pro}, Generative ${maestroLimits.generative}.`);
  return L.join("\n");
}

/** the one-line account note for this turn (plan, balance, subscription): never cached, never shown */
export function accountLine(u) {
  if (!u) return "ACCOUNT: not known.";
  const plan = PLAN_NAMES[u.plan] ?? "Free";
  return `ACCOUNT (this user, now): plan ${plan}${u.hasSub ? " (an active subscription)" : ""}; balance ${u.credits == null ? "unknown" : `${fmt(u.credits)} credits`}.`;
}
