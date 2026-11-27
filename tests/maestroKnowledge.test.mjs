// Maestro's knowledge of Zyvo (_shared/maestro/knowledge.js) and its selling cards: every number comes from the real
// data files, so the chat can never say something the pricing page doesn't.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { zyvoKnowledge, planFacts, packFacts, videoPrices, videosFor, liveOffers, accountLine } from "../supabase/functions/_shared/maestro/knowledge.js";
import { MAESTRO, makeMaestro, systemPrompt } from "../supabase/functions/_shared/maestro/brain.js";
import { STYLES, creditsFor } from "../supabase/functions/_shared/director/styles.js";
import { PLAN_CREDITS, TOPUP_CREDITS } from "../supabase/functions/_shared/stripePlanPrices.js";
import { BILLING_FAQ, FAILED_RUNS, PLAN_FIT, PLAN_LINES } from "../supabase/functions/_shared/billingPolicy.js";
import { QUICK_IMAGE_CREDITS, TOWN_VIDEO_CREDITS } from "../supabase/functions/_shared/planEquivalents.js";
import { REWARDS } from "../supabase/functions/_shared/rewards/config.js";
import { AFFILIATE } from "../supabase/functions/_shared/affiliate/config.js";
import { SIGNUP_BONUS } from "../supabase/functions/_shared/signupBonus.js";
import { LAUNCH_DEAL } from "../supabase/functions/_shared/launchDeal.js";

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
// the plan-prices function's shape (prices themselves are whatever Stripe says; these stand in for it)
const PRICES = { currency: "eur", vatIncluded: true, plans: { starter: { monthly: 18, yearly: 180, credits: 750 }, pro: { monthly: 38, yearly: 380, credits: 1600 }, generative: { monthly: 72, yearly: 720, credits: 3200 } }, topups: { mini: { price: 9, credits: 300 }, standard: { price: 14, credits: 500 }, max: { price: 24, credits: 900 } } };
const AFTER_DEALS = Date.parse("2026-11-26T12:00:00Z");
const K = zyvoKnowledge({ prices: PRICES, at: AFTER_DEALS, maestroLimits: MAESTRO.limits });

test("plans: the live prices and the real monthly credits, what each is for, no plan above Generative", () => {
  for (const [plan, credits] of Object.entries(PLAN_CREDITS)) {
    const name = { starter: "Starter", pro: "Pro", generative: "Generative" }[plan];
    const line = K.split("\n").find((l) => l.startsWith(`- ${name}:`));
    assert.ok(line, name);
    assert.ok(line.includes(`€${PRICES.plans[plan].monthly} a month`), line);
    assert.ok(line.includes(`€${PRICES.plans[plan].yearly} a year`), line);
    assert.ok(line.includes(`${credits.toLocaleString("en-US")} credits a month`), line);
    assert.ok(line.includes(PLAN_FIT[plan]), line);
    assert.ok(line.includes(`≈ ${Math.floor(credits / TOWN_VIDEO_CREDITS)} 60-second In This Town videos`), line);
    assert.ok(line.includes(`≈ ${Math.floor(credits / QUICK_IMAGE_CREDITS).toLocaleString("en-US")} quick images`), line);
  }
  assert.match(K, /There is no plan above Generative/);
  for (const [pack, credits] of Object.entries(TOPUP_CREDITS)) assert.ok(K.includes(`${credits} credits for €${PRICES.topups[pack].price}`), pack);
});

test("no prices from Stripe: Maestro says 'see the pricing page' and states no money at all", () => {
  const k = zyvoKnowledge({ prices: null, at: AFTER_DEALS });
  // (the affiliate cash-out minimum is a config number, not a Stripe price)
  assert.doesNotMatch(k.split("\n").filter((l) => !l.startsWith("AFFILIATE")).join("\n"), /€\d/);
  assert.match(k, /price: see the pricing page/);
  assert.deepEqual(planFacts(null).map((p) => p.monthly), [null, null, null]);
});

test("every template's price and how many each plan makes: credits ÷ price, rounded down", () => {
  for (const s of STYLES) {
    const line = K.split("\n").find((l) => l.startsWith(`- ${s.name}`));
    assert.ok(line, s.id);
    for (const v of videoPrices(s)) {
      const credits = creditsFor(s, v.seconds); // In This Town: its exact price per length (TOWN_PRICES)
      assert.equal(v.credits, credits, s.id);
      for (const [plan, pc] of Object.entries(PLAN_CREDITS)) {
        const name = { starter: "Starter", pro: "Pro", generative: "Generative" }[plan];
        assert.ok(line.includes(`${name} ${Math.floor(pc / credits)}`), `${s.id} ${v.label} ${name}`);
      }
    }
  }
  assert.equal(videosFor(750, 313), 2);
  assert.equal(videosFor(3200, 313), 10);
});

test("rules, Rewards, Affiliate, Use with Claude and the sign-up bonus come from their own config files", () => {
  for (const f of BILLING_FAQ) assert.ok(K.includes(f.a), f.q);
  assert.ok(K.includes(FAILED_RUNS));
  assert.match(K, /Settings > Billing > Cancel plan/);
  // Rewards and Affiliate only once they are live (_shared/liveFeatures.js); their numbers from their config files
  assert.doesNotMatch(K, /^REWARDS|^AFFILIATE/m, "not live yet: never explained");
  const KL = zyvoKnowledge({ prices: PRICES, at: AFTER_DEALS, maestroLimits: MAESTRO.limits, live: { rewards: true, affiliate: true } });
  for (const t of REWARDS.videoTiers) assert.ok(KL.includes(`${t.views.toLocaleString("en-US")} views → ${t.credits.toLocaleString("en-US")} credits`));
  assert.ok(KL.includes(`you get ${REWARDS.invite.inviterCredits} credits and they get ${REWARDS.invite.friendCredits}`));
  assert.ok(KL.includes(`${AFFILIATE.cashRate * 100}% in cash or ${AFFILIATE.creditRate * 100}% in credits`));
  assert.ok(KL.includes(`get ${AFFILIATE.signupBonusCredits} credits`));
  assert.ok(K.includes(`+${SIGNUP_BONUS.credits} bonus credits on their first plan if they buy within ${SIGNUP_BONUS.days} days`));
  assert.match(K, /Messages a day: Free 10, Starter 100, Pro 300, Generative 600/);
  // the pricing page reads the same words
  // (release on main: the pricing page keeps its own copy of the words; Maestro's must be the same, word for word)
  const norm = (t) => String(t).replace(/&apos;/g, "'").replace(/s+/g, " ");
  const page = norm(read("src/components/pricing/PricingExtras.jsx") + read("src/components/pricing/PricingData.jsx"));
  for (const f of BILLING_FAQ) assert.ok(page.includes(norm(f.a)), `the pricing page says the same: ${f.q}`);
  for (const p of Object.values(PLAN_LINES)) assert.ok(page.includes(norm(p.line)), p.line);
});

test("offers: only what the checkout code really applies, and only while it runs", () => {
  assert.match(K, /OFFERS RIGHT NOW: No discount or coupon is running\./);
  const during = liveOffers(Date.parse("2026-11-20T12:00:00Z"), PRICES);
  assert.equal(during.length, 1);
  assert.match(during[0], new RegExp(`${LAUNCH_DEAL.percentOff}% off the first month \\(€14\\.40 instead of €18\\)`));
  assert.match(systemPrompt(), /never invent a discount, a feature or a number/);
  assert.match(systemPrompt(), /Never pressure, rush or guilt anyone/);
  assert.match(systemPrompt(), /If a cheaper plan fits, say so/);
});

// a Maestro with a scripted Claude: the cards carry the real numbers whatever the model writes
function maestroWith(script, u) {
  const calls = [];
  const store = { countUsage: async () => 0, createChat: async (r) => ({ id: "00000000-0000-0000-0000-00000000c4a7", ...r }), listMessages: async () => [], logUsage: async () => 1, insertMessage: async (r) => ({ id: Math.random(), ...r }), markUsage: async () => {}, updateChat: async () => {}, getChat: async () => null };
  const claude = async (req) => { calls.push(req); return script.shift(); };
  const m = makeMaestro({ store, claude, director: { handle: async () => ({}) }, user: async () => u, prices: async () => PRICES });
  return { m, calls };
}

test("offer_plan: a card with the live price, the real credits and THEIR videos a month; the account line rides along", async () => {
  const { m, calls } = maestroWith([
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "offer_plan", input: { plan: "pro", reason: "One channel, 3 videos a week.", style_id: "in-this-town", length_sec: 60 } }], usage: {} },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Pro fits." }], usage: {} },
  ], { plan: "free", paid: false, owner: false, credits: 120, hasSub: false });
  const r = await m.handle("u1", { action: "send", text: "best plan?" });
  const card = r.messages[1].cards[0];
  assert.equal(card.type, "plan_offer");
  assert.deepEqual([card.plan, card.price, card.credits, card.town, card.images, card.theirs.count, card.theirs.perVideo], ["pro", 38, 1600, 7, 228, 7, 219]);
  assert.equal(card.hasPlan, false);
  assert.match(calls[0].system[1].text, /ACCOUNT \(this user, now\): plan Free; balance 120 credits\./);
  assert.ok(calls[0].system[0].text.includes("ZYVO FACTS"), "the knowledge is in the cached prompt");
  assert.equal(calls[0].system[1].cache_control, undefined, "the account line is not cached");
});

test("offer_credits: the balance, what's needed and the packs with their live prices", async () => {
  const { m } = maestroWith([
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "offer_credits", input: { needed: 313 } }], usage: {} },
    { stop_reason: "end_turn", content: [{ type: "text", text: "This costs 313, you have 120." }], usage: {} },
  ], { plan: "starter", paid: true, owner: false, credits: 120, hasSub: true });
  const r = await m.handle("u1", { action: "send", text: "make it" });
  const card = r.messages[1].cards[0];
  assert.deepEqual([card.type, card.needed, card.have, card.short], ["credits", 313, 120, 193]);
  assert.deepEqual(card.packs.map((p) => [p.pack, p.credits, p.price]), [["mini", 300, 9], ["standard", 500, 14], ["max", 900, 24]]);
  assert.deepEqual(packFacts(PRICES).map((p) => p.credits), Object.values(TOPUP_CREDITS));
  assert.equal(accountLine(null), "ACCOUNT: not known.");
});

test("the cards open the normal checkout only: subscribe() from the pricing page, startCheckout for packs", () => {
  const cards = read("src/components/maestro/MaestroSellCards.jsx");
  assert.match(cards, /import \{ subscribe \} from "\.\.\/pricing\/PlanCards";/);
  assert.match(cards, /subscribe\(\{ planId: card\.plan, billing: card\.billing, account/);
  assert.match(cards, /startCheckout\(\{ type: "topup", pack \}\)/);
  assert.doesNotMatch(cards, /functions\.invoke|stripe\.com|create-checkout-session/, "no payment of its own");
  // a guest goes to sign-up first: startCheckout saves the choice and sends them there (lib/payments.ts)
  assert.match(read("src/lib/payments.ts"), /saveCheckoutIntent\(checked\);\s+window\.location\.href = "\/signup";/);
});

test("offer_plan works out the gap itself: 22 In This Town (60 s) a month on Generative (14) = 2 Max packs; 60 fruit dramas = Max packs", async () => {
  const run = async (input) => {
    const { m } = maestroWith([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "offer_plan", input }], usage: {} },
      { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }], usage: {} },
    ], { plan: "free", paid: false, owner: false, credits: 120, hasSub: false });
    const r = await m.handle("u1", { action: "send", text: "which plan" });
    return r.messages[1].cards[0];
  };
  const town = await run({ plan: "generative", reason: "x", style_id: "in-this-town", length_sec: 60, needed_per_month: 22 });
  assert.deepEqual([town.theirs.count, town.theirs.needed, town.theirs.extra], [14, 22, { name: "Max", count: 2, credits: 900 }]); // 60 s: 22×219−3,200 = 1,618 ≤ 2×900
  const fruit = await run({ plan: "generative", reason: "x", style_id: "ai-fruit-story", length_sec: 15, needed_per_month: 60 });
  const missing = 60 * creditsFor(STYLES.find((s) => s.id === "ai-fruit-story"), 15) - 3200;
  assert.deepEqual([fruit.theirs.count, fruit.theirs.extra.name, fruit.theirs.extra.count], [37, "Max", Math.ceil(missing / 900)]);
  const enough = await run({ plan: "pro", reason: "x", style_id: "in-this-town", needed_per_month: 4 });
  assert.equal(enough.theirs.extra, undefined, "Pro's 5 cover 4: no pack suggested");
});

test("offer_credits picks the smallest pack that is enough (120 + Mini 300 = 420 ≥ 313)", async () => {
  const { m } = maestroWith([
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "offer_credits", input: { needed: 313 } }], usage: {} },
    { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }], usage: {} },
  ], { plan: "free", paid: false, owner: false, credits: 120, hasSub: false });
  const r = await m.handle("u1", { action: "send", text: "make it" });
  assert.equal(r.messages[1].cards[0].smallest, "mini");
});
