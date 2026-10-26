import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { OFFER, OFFER_EMAIL_LINE, formatCountdown, offerBonusFor, offerLive, offerMsLeft } from "../supabase/functions/_shared/offer.js";

// The +50 bonus offer (owner, 2026-10-26): +50 credits when a plan is bought or upgraded, once per
// account, until Sunday 1 Nov 23:59 Finnish time, judged by the payment time on the server. After
// the end nothing is given and nothing is shown, without a deploy. The purchase flow itself is run
// through the real webhook in tests/stripe-webhook/simulateOffer.ts (Deno).
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

test("the window: from going live to Sunday 1 Nov 23:59:59 in Helsinki", () => {
  assert.equal(OFFER.bonusCredits, 50);
  assert.deepEqual(OFFER.plans, ["starter", "pro", "generative"]);
  // 23:59:59 Helsinki on 1 Nov = 21:59:59 UTC (winter time, UTC+2, since 25 Oct).
  assert.equal(new Date(OFFER.endsAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki" }), "01/11/2026, 23:59:59");
  assert.equal(offerLive("2026-10-28T12:00:00Z"), true);
  assert.equal(offerLive("2026-11-01T21:59:59Z"), true, "Sunday 23:59:59 Finnish: still on");
  assert.equal(offerLive("2026-11-01T22:00:00Z"), false, "Monday 00:00 Finnish: over");
  assert.equal(offerLive("2026-10-26T12:00:00Z"), false, "before it went live");
  assert.equal(offerMsLeft("2026-11-01T22:00:00Z"), 0);
  assert.equal(offerMsLeft("2026-11-01T21:00:00Z"), 3599999);
  assert.equal(formatCountdown(3 * 86400e3 + 4 * 3600e3 + 12 * 60e3 + 9e3), "3d 04h 12m 09s");
  assert.equal(formatCountdown(4 * 3600e3 + 5e3), "4h 00m 05s");
  assert.equal(formatCountdown(61e3), "1m 01s");
});

test("who gets it: a plan bought or upgraded during the offer; not renewals, smaller plans or late payments", () => {
  const wed = "2026-10-28T12:00:00Z";
  assert.equal(offerBonusFor({ billingReason: "subscription_create", planAfter: "starter", planBefore: "free", paidAt: wed }).eligible, true);
  assert.equal(offerBonusFor({ billingReason: "subscription_create", planAfter: "generative", planBefore: "pro", paidAt: wed }).eligible, true, "a new subscription on any plan");
  assert.equal(offerBonusFor({ billingReason: "subscription_update", planAfter: "pro", planBefore: "starter", paidAt: wed }).eligible, true, "an upgrade");
  assert.match(offerBonusFor({ billingReason: "subscription_update", planAfter: "starter", planBefore: "pro", paidAt: wed }).why, /not an upgrade/);
  assert.match(offerBonusFor({ billingReason: "subscription_update", planAfter: "pro", planBefore: "pro", paidAt: wed }).why, /not an upgrade/, "monthly → yearly of the same plan");
  assert.match(offerBonusFor({ billingReason: "subscription_cycle", planAfter: "pro", planBefore: "pro", paidAt: wed }).why, /not a purchase or an upgrade/, "a renewal");
  assert.match(offerBonusFor({ billingReason: "subscription_create", planAfter: "starter", planBefore: "free", paidAt: "2026-11-01T22:00:01Z" }).why, /outside the offer window/, "paid after Sunday 23:59");
  assert.match(offerBonusFor({ billingReason: "manual", planAfter: undefined, paidAt: wed }).why, /not a plan purchase/);
});

test("the server is the limit: the webhook judges by the payment time and the database gives it once", () => {
  const w = read("supabase/functions/stripe-webhook/index.ts");
  assert.match(w, /const paidAtIso = unixToIso\(inv\?\.status_transitions\?\.paid_at\) \?\? unixToIso\(inv\?\.created\)/);
  assert.match(w, /offerBonusFor\(\{ billingReason: inv\?\.billing_reason, planAfter: plan \?\? changedTo\?\.plan, planBefore: profile\.plan_code, paidAt: paidAtIso \}, OFFER_NOW\)/);
  assert.match(w, /sb\.rpc\("grant_offer_bonus", \{ p_user_id: userId, p_offer_id: OFFER_NOW\.id, p_credits: OFFER_NOW\.bonusCredits, p_invoice_id: inv\.id, p_paid_at: paidAtIso \}\)/);
  const sql = read("supabase/migrations/20261108400000_offer_bonus.sql");
  assert.match(sql, /primary key \(user_id, offer_id\)/, "once per account");
  assert.match(sql, /on conflict \(user_id, offer_id\) do nothing;/);
  assert.match(sql, /return grant_credits_once\(p_user_id, p_credits, 'offer_bonus', p_offer_id \|\| ':' \|\| p_user_id::text\);/);
  assert.match(sql, /revoke all on function public\.grant_offer_bonus\(uuid, text, integer, text, timestamptz\) from public, anon, authenticated/);
  assert.match(sql, /for select to authenticated using \(auth\.uid\(\) = user_id\)/, "people can read their own row (the success page), nothing more");
});

test("the website reads the same window and shows nothing outside it", () => {
  const hook = read("src/lib/useOffer.js");
  assert.match(hook, /from "\.\.\/\.\.\/supabase\/functions\/_shared\/offer\.js"/, "one source of truth with the webhook");
  assert.match(hook, /const \[msLeft, setMsLeft\] = useState\(0\);/, "not live until it has checked the clock in the browser (prerendered HTML never carries it)");
  const ui = read("src/components/offer/OfferBanners.jsx");
  assert.equal(ui.split("if (!live) return null;").length - 1, 2, "banner and news bar render nothing outside the window");
  assert.match(ui, /\+\{bonus\} bonus credits on every plan — ends Sunday/);
  assert.match(ui, /\+\{bonus\} bonus credits on every plan until Sunday/);
  assert.match(ui, /<Link to="\/pricing"/);
  assert.match(ui, /\{live && \(\s*<span[^>]*data-testid="offer-credits">\s*\+ \{bonus\} bonus/);
  assert.match(read("src/pages/Pricing.jsx"), /<OfferBanner \/>\s*<header/);
  assert.match(read("src/components/pricing/PlanCards.jsx"), /<OfferCredits credits=\{PRICING_PLANS\[planId\]\.credits\} \/>/);
  assert.match(read("src/pages/workspace/layout.jsx"), /location\.pathname === "\/" && offer\.live \? <OfferBar \/> : <AnnouncementBar \/>/);
  const ok = read("src/pages/billing/Success.jsx");
  assert.match(ok, /from\("offer_redemptions"\)\.select\("credits"\)\.eq\("user_id", session\.user\.id\)\.eq\("offer_id", OFFER\.id\)/, "only when the webhook really gave it");
  assert.match(ok, /\+\{bonus\} bonus credits added/);
});

test("the email line: the owner's words", () => {
  assert.equal(OFFER_EMAIL_LINE, "This week only: get 50 bonus credits on top of any plan you upgrade to. Ends Sunday.");
});
