// Runs the REAL supabase/functions/stripe-webhook/index.ts against an
// in-memory database (fakeSupabase.ts) and a fake Stripe API. No network, no
// keys, no live data; the permissions below don't even allow network access.
// Covers: signature, subscription, credit pack, failure + retry without double
// credits, missing/duplicate user, subscription status, cancellation, failed
// payment, plan changes in the billing portal (prorated upgrade credits,
// scheduled downgrades). Exits 1 if any check fails. From the repo root:
//   npx -y deno@2.9.6 run --allow-env --allow-read --no-check --no-lock --no-config --import-map=tests/stripe-webhook/import_map.json tests/stripe-webhook/simulate.ts
// It does not prove the SQL of grant_credits_once (the fake copies its
// contract) or real Stripe payloads: that is what the Stripe CLI test run is for.
// deno-lint-ignore-file no-explicit-any
import { db, inject } from "./fakeSupabase.ts";

const SECRET = "whsec_simulation";
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake");
Deno.env.set("STRIPE_SECRET_KEY", "sk_test_fake");
Deno.env.set("STRIPE_WEBHOOK_SECRET_SUPABASE", SECRET);
Deno.env.set("STRIPE_TEST_PRICE_ALIASES", JSON.stringify({ price_test_starter: "price_1TmVZZHtn4q5rIncOuf5aKP4" }));

// ---- fake Stripe API ----
const stripe: { subs: Record<string, any>; lineItems: Record<string, any[]>; failNext: string | null; versions: Set<string> } = { subs: {}, lineItems: {}, failNext: null, versions: new Set() };
globalThis.fetch = ((input: any, init: any) => {
  const url = new URL(String(input));
  stripe.versions.add(init?.headers?.["Stripe-Version"] ?? "(none)");
  const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
  if (stripe.failNext && url.pathname.includes(stripe.failNext)) { stripe.failNext = null; return json({ error: { message: "rate limited" } }, 429); }
  let m;
  if ((m = url.pathname.match(/^\/v1\/checkout\/sessions\/(.+)\/line_items$/))) return json({ data: stripe.lineItems[m[1]] ?? [] });
  if ((m = url.pathname.match(/^\/v1\/prices\/(.+)$/))) return json({ id: m[1], metadata: {} });
  if ((m = url.pathname.match(/^\/v1\/subscriptions\/(.+)$/))) return stripe.subs[m[1]] ? json(stripe.subs[m[1]]) : json({ error: { message: "No such subscription" } }, 404);
  if (url.pathname === "/v1/subscriptions") return json({ data: Object.values(stripe.subs).filter((s) => s.customer === url.searchParams.get("customer") && s.status !== "canceled") });
  return json({ error: { message: `unexpected ${url.pathname}` } }, 500);
}) as any;

const webhook = (await import(new URL("../../supabase/functions/stripe-webhook/index.ts", import.meta.url).href)).default;

// ---- helpers ----
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sign(raw: string, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `t=${t},v1=${hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)))}`;
}
let n = 0;
const evt = (type: string, object: any, id = `evt_${++n}`) => ({ id, type, data: { object } });
async function send(event: any, opts: { sig?: string | null } = {}) {
  const raw = JSON.stringify(event);
  const headers: Record<string, string> = {};
  const sig = opts.sig === undefined ? await sign(raw) : opts.sig;
  if (sig) headers["stripe-signature"] = sig;
  const res = await webhook.fetch(new Request("http://local/stripe-webhook", { method: "POST", body: raw, headers }));
  return { status: res.status, body: await res.json() };
}
let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
}
const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const keep = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  try { return await fn(); } finally { Object.assign(console, keep); }
};
const q = (event: any, opts?: any) => quiet(() => send(event, opts));

const U = (i: number) => `00000000-0000-4000-8000-00000000000${i}`;
const STARTER = "price_1TmVZZHtn4q5rIncOuf5aKP4";       // current monthly → 750 for new subscriptions
const STARTER_YEARLY = "price_1TmVhxHtn4q5rIncS8sxm6UR";
const MINI = "price_1TGKjDHtn4q5rInczlym0Dcz";          // 300 credits
const prof = (i: number, extra: any = {}) => ({ id: U(i), plan_code: "free", credit_balance: 0, stripe_customer_id: `cus_${i}`, stripe_subscription_id: null, stripe_subscription_status: null, ...extra });
const P = (i: number) => db.profiles.find((p) => p.id === U(i));
const grantsFor = (i: number) => db.credit_grants.filter((g) => g.user_id === U(i)).map((g) => `${g.reason}:${g.amount}:${g.external_id}`);
const now = Math.floor(Date.now() / 1000);
const invoice = (id: string, cus: string, sub: string, price = STARTER, extra: any = {}) => ({
  id, customer: cus, subscription: sub, status: "paid", billing_reason: "subscription_create", created: now, status_transitions: { paid_at: now },
  lines: { data: [{ price: { id: price, recurring: { interval: "month" } }, proration: false, period: { end: now + 2592000 } }] }, ...extra,
});
const subscription = (id: string, cus: string, status: string, price = STARTER, extra: any = {}) => ({ id, customer: cus, status, start_date: now, current_period_end: now + 2592000, cancel_at_period_end: false, items: { data: [{ price: { id: price } }] }, ...extra });

// ================= scenarios =================
console.log("\n1. Signature");
db.profiles.push(prof(1));
check("unsigned → 400", (await q(evt("invoice.payment_succeeded", invoice("in_sig", "cus_1", "sub_sig")), { sig: null })).status, 400);
const forged = JSON.stringify(evt("invoice.payment_succeeded", invoice("in_sig", "cus_1", "sub_sig")));
check("signed with another secret → 400", (await q(JSON.parse(forged), { sig: await sign(forged, "whsec_other") })).status, 400);
check("right secret, 10 minutes old → 400", (await q(JSON.parse(forged), { sig: await sign(forged, SECRET, now - 600) })).status, 400);
check("malformed header → 400", (await q(JSON.parse(forged), { sig: "t=abc,v1=zz" })).status, 400);
check("nothing was granted or recorded", [db.credit_grants.length, db.billing_events_processed.length, P(1).plan_code], [0, 0, "free"]);

console.log("\n2. Successful subscription (checkout + first invoice)");
stripe.subs.sub_1 = subscription("sub_1", "cus_1", "active");
const co1 = evt("checkout.session.completed", { id: "cs_1", mode: "subscription", status: "complete", payment_status: "paid", customer: "cus_1", subscription: "sub_1", metadata: { user_id: U(1) }, client_reference_id: U(1) });
check("checkout → 200", (await q(co1)).status, 200);
const inv1 = evt("invoice.payment_succeeded", invoice("in_1", "cus_1", "sub_1"));
check("invoice → 200 with 750", (await q(inv1)).body, { ok: true, plan_credits: 750, granted: true });
check("plan, credits, subscription id", [P(1).plan_code, P(1).credit_balance, P(1).stripe_subscription_id], ["starter", 750, "sub_1"]);
check("same event again → deduped", (await q(inv1)).body, { ok: true, deduped: true });
check("invoice.paid for the same invoice → no second grant", (await q(evt("invoice.paid", invoice("in_1", "cus_1", "sub_1")))).body, { ok: true, plan_credits: 750, granted: false });
check("balance still 750, one ledger row", [P(1).credit_balance, grantsFor(1)], [750, ["plan_renewal:750:in_1"]]);

console.log("\n3. Invoice arrives BEFORE checkout.session.completed");
db.profiles.push(prof(2));
stripe.subs.sub_2 = subscription("sub_2", "cus_2", "active");
check("invoice first → plan + credits + subscription id adopted", [(await q(evt("invoice.payment_succeeded", invoice("in_2", "cus_2", "sub_2")))).status, P(2).plan_code, P(2).credit_balance, P(2).stripe_subscription_id], [200, "starter", 750, "sub_2"]);

console.log("\n4. Handler fails, Stripe retries, no double credits");
db.profiles.push(prof(3));
stripe.subs.sub_3 = subscription("sub_3", "cus_3", "active");
const inv3 = evt("invoice.payment_succeeded", invoice("in_3", "cus_3", "sub_3"));
inject.fail = (c) => (c.op === "rpc:grant_credits_once" ? "connection reset" : null);
check("credit grant fails → 500", (await q(inv3)).status, 500);
check("event NOT recorded, no credits yet", [db.billing_events_processed.some((e) => e.event_id === inv3.id), P(3).credit_balance], [false, 0]);
inject.fail = null;
check("retry of the same event → 200, granted", (await q(inv3)).body, { ok: true, plan_credits: 750, granted: true });
check("third delivery → deduped", (await q(inv3)).body, { ok: true, deduped: true });
check("exactly 750", [P(3).credit_balance, grantsFor(3)], [750, ["plan_renewal:750:in_3"]]);
const inv3b = evt("invoice.payment_succeeded", invoice("in_3b", "cus_3", "sub_3", STARTER, { billing_reason: "subscription_cycle" }));
inject.fail = (c) => (c.table === "profiles" && c.op === "update" ? "db timeout" : null);
check("profile update fails → 500", (await q(inv3b)).status, 500);
inject.fail = (c) => (c.table === "billing_events_processed" && c.op === "insert" ? "db timeout" : null);
check("handler ok but recording the event fails → still 200", (await q(inv3b)).status, 200);
inject.fail = null;
check("so the next delivery re-runs the handler: no second grant", (await q(inv3b)).body, { ok: true, plan_credits: 750, granted: false });
check("750 + 750, never more", [P(3).credit_balance, grantsFor(3).length], [1500, 2]);

console.log("\n5. Credit pack");
stripe.lineItems.cs_pack = [{ price: { id: MINI }, quantity: 1 }];
const pack = evt("checkout.session.completed", { id: "cs_pack", mode: "payment", status: "complete", payment_status: "paid", customer: "cus_3", metadata: { user_id: U(3) } });
stripe.failNext = "line_items";
check("Stripe line-item lookup fails → 500 (not 0 credits)", (await q(pack)).status, 500);
check("retry → 300", (await q(pack)).body, { ok: true, topup_credits: 300, granted: true });
check("retry again → deduped, balance 1800", [(await q(pack)).body, P(3).credit_balance], [{ ok: true, deduped: true }, 1800]);
stripe.lineItems.cs_unknown = [{ price: { id: "price_unknown" }, quantity: 1 }];
check("paid pack with an unknown price → 500", (await q(evt("checkout.session.completed", { id: "cs_unknown", mode: "payment", status: "complete", payment_status: "paid", customer: "cus_3", metadata: { user_id: U(3) } }))).status, 500);

console.log("\n6. No user / duplicate customer");
check("paid invoice, unknown customer → 500", (await q(evt("invoice.payment_succeeded", invoice("in_x", "cus_nobody", "sub_x")))).status, 500);
check("paid checkout, no user → 500", (await q(evt("checkout.session.completed", { id: "cs_x", mode: "payment", payment_status: "paid", customer: "cus_nobody", metadata: {} }))).status, 500);
db.profiles.push(prof(4, { stripe_customer_id: "cus_dup" }), prof(5, { stripe_customer_id: "cus_dup" }));
stripe.subs.sub_dup = subscription("sub_dup", "cus_dup", "active");
check("customer on two profiles, no metadata → 500", (await q(evt("invoice.payment_succeeded", invoice("in_dup", "cus_dup", "sub_dup")))).status, 500);
check("same, metadata names the user → that user gets it", [(await q(evt("invoice.payment_succeeded", invoice("in_dup", "cus_dup", "sub_dup", STARTER, { subscription_details: { metadata: { user_id: U(5) } } })))).status, P(4).credit_balance, P(5).credit_balance], [200, 0, 750]);
check("unmapped recurring price on a paid invoice → 500", (await q(evt("invoice.payment_succeeded", invoice("in_unmapped", "cus_1", "sub_1", "price_not_in_map")))).status, 500);

console.log("\n7. Subscription status (H3)");
db.profiles.push(prof(6));
check("incomplete_expired on a free user → stays free, no status written", [(await q(evt("customer.subscription.updated", subscription("sub_dead", "cus_6", "incomplete_expired")))).body.reason, P(6).plan_code, P(6).stripe_subscription_status], ["not-current-subscription", "free", null]);
check("incomplete_expired of an OLD attempt, user pays on sub_1 → untouched", [(await q(evt("customer.subscription.updated", subscription("sub_old_attempt", "cus_1", "incomplete_expired")))).body.reason, P(1).plan_code, P(1).stripe_subscription_status], ["not-current-subscription", "starter", "paid"]);
db.profiles.push(prof(7, { plan_code: "affiliate" }));
check("affiliate with a failed attempt keeps affiliate", [(await q(evt("customer.subscription.updated", subscription("sub_aff", "cus_7", "incomplete_expired")))).status, P(7).plan_code], [200, "affiliate"]);
check("current subscription past_due → plan kept, status stored", [(await q(evt("customer.subscription.updated", subscription("sub_1", "cus_1", "past_due")))).status, P(1).plan_code, P(1).stripe_subscription_status], [200, "starter", "past_due"]);
stripe.subs.sub_1.status = "unpaid";
check("current subscription unpaid → free, status stored, id kept", [(await q(evt("customer.subscription.updated", subscription("sub_1", "cus_1", "unpaid")))).status, P(1).plan_code, P(1).stripe_subscription_status, P(1).stripe_subscription_id], [200, "free", "unpaid", "sub_1"]);
check("…then paid again (active) → plan back", [(await q(evt("customer.subscription.updated", subscription("sub_1", "cus_1", "active")))).status, P(1).plan_code, P(1).stripe_subscription_status], [200, "starter", "active"]);
check("active subscription, none stored → adopted", [(await q(evt("customer.subscription.updated", subscription("sub_6", "cus_6", "active")))).status, P(6).plan_code, P(6).stripe_subscription_id], [200, "starter", "sub_6"]);

console.log("\n8. Cancellation (M5)");
check("deleted subscription that is NOT current → plan kept", [(await q(evt("customer.subscription.deleted", subscription("sub_other", "cus_1", "canceled")))).body.reason, P(1).plan_code, P(1).stripe_subscription_id], ["not-current-subscription", "starter", "sub_1"]);
stripe.subs.sub_1.status = "canceled";
check("current subscription deleted → free, id cleared", [(await q(evt("customer.subscription.deleted", subscription("sub_1", "cus_1", "canceled")))).body, P(1).plan_code, P(1).stripe_subscription_id, P(1).stripe_subscription_status], [{ received: true, plan: "free" }, "free", null, "canceled"]);
check("credits stay after cancelling", P(1).credit_balance, 750);
stripe.subs.sub_2.status = "canceled";
stripe.subs.sub_2b = subscription("sub_2b", "cus_2", "active", STARTER_YEARLY);
check("current deleted but the customer pays for another → plan moves to it", [(await q(evt("customer.subscription.deleted", subscription("sub_2", "cus_2", "canceled")))).body, P(2).plan_code, P(2).stripe_subscription_id], [{ received: true, moved_to: "sub_2b" }, "starter", "sub_2b"]);

console.log("\n9. Failed payment (M1), then the same invoice is paid");
const failedInv = invoice("in_3c", "cus_3", "sub_3", STARTER, { status: "open", billing_reason: "subscription_cycle" });
check("payment_failed on the current subscription → 200, past_due", [(await q(evt("invoice.payment_failed", failedInv))).body, P(3).stripe_subscription_status, P(3).plan_code], [{ ok: true, failed_invoice: "in_3c", marked_past_due: true }, "past_due", "starter"]);
check("audit row uses its own id", grantsFor(3).at(-1), "invoice_failed:0:failed:in_3c");
check("second failure of the same invoice → still 200", (await q(evt("invoice.payment_failed", failedInv))).status, 200);
check("the invoice is paid later → credits ARE granted", [(await q(evt("invoice.payment_succeeded", invoice("in_3c", "cus_3", "sub_3", STARTER, { billing_reason: "subscription_cycle" })))).body, P(3).credit_balance, P(3).stripe_subscription_status], [{ ok: true, plan_credits: 750, granted: true }, 2550, "paid"]);
check("declined first payment in checkout (no current subscription) → status untouched", [(await q(evt("invoice.payment_failed", invoice("in_7", "cus_7", "sub_aff", STARTER, { status: "open" })))).body.marked_past_due, P(7).stripe_subscription_status], [false, null]);
inject.fail = (c) => (c.table === "credit_grants" && c.op === "insert" ? "check constraint" : null);
check("audit row can't be written → event still 200", (await q(evt("invoice.payment_failed", invoice("in_3d", "cus_3", "sub_3", STARTER, { status: "open" })))).status, 200);
inject.fail = null;

console.log("\n10. Yearly plan and other events");
db.profiles.push(prof(8));
stripe.subs.sub_8 = subscription("sub_8", "cus_8", "active", STARTER_YEARLY);
check("yearly invoice → 750 now, monthly top-up fields set from the payment time", [(await q(evt("invoice.payment_succeeded", invoice("in_8", "cus_8", "sub_8", STARTER_YEARLY)))).status, P(8).credit_balance, P(8).billing_interval, P(8).annual_credits_per_month, P(8).annual_credits_last_topup], [200, 750, "yearly", 750, new Date(now * 1000).toISOString()]);
db.profiles.push(prof(9));
stripe.subs.sub_9 = subscription("sub_9", "cus_9", "active", "price_test_starter");
check("test-mode price alias maps to Starter", [(await q(evt("invoice.payment_succeeded", invoice("in_9", "cus_9", "sub_9", "price_test_starter")))).status, P(9).plan_code, P(9).credit_balance], [200, "starter", 750]);
check("unknown event type → 200 ignored", (await q(evt("charge.succeeded", { id: "ch_1" }))).body, { ignored: true, type: "charge.succeeded" });
check("every Stripe request pinned to 2022-08-01", [...stripe.versions], ["2022-08-01"]);

// ================= plan changes in the billing portal =================
// Stripe invoices an upgrade as two proration lines: unused time on the old
// price (negative) and remaining time on the new one (positive). Amounts below
// are what Stripe would charge, in cents, for the stated share of the period.
const PRO = "price_1TmVfXHtn4q5rInc9IaN1l3U";
const PRO_YEARLY = "price_1TmVjnHtn4q5rInccPDBIVaX";
const GENERATIVE = "price_1TmVg2Htn4q5rIncWL0b3HJr";
const LEGACY_STARTER = "price_1TGKT6Htn4q5rIncI47V5Ein";
const PRICE: Record<string, { unit: number; interval: "month" | "year" }> = {
  [STARTER]: { unit: 1800, interval: "month" }, [PRO]: { unit: 3800, interval: "month" }, [GENERATIVE]: { unit: 7800, interval: "month" },
  [STARTER_YEARLY]: { unit: 18000, interval: "year" }, [PRO_YEARLY]: { unit: 38400, interval: "year" }, [LEGACY_STARTER]: { unit: 1199, interval: "month" },
};
const DAY = 86400;
/** One invoice line. share: the part of the price's period the line covers; proration lines are signed. */
const line = (price: string, share: number, sign: 1 | -1 | 0, start = now, end = now + 30 * DAY) => ({
  amount: (sign || 1) * Math.round(PRICE[price].unit * share), proration: sign !== 0, quantity: 1,
  price: { id: price, unit_amount: PRICE[price].unit, recurring: { interval: PRICE[price].interval } }, period: { start, end },
});
const changeInvoice = (id: string, cus: string, sub: string, lines: any[], extra: any = {}) => ({
  id, customer: cus, subscription: sub, status: "paid", billing_reason: "subscription_update", created: now, status_transitions: { paid_at: now }, lines: { data: lines }, ...extra,
});
const euros = (lines: any[]) => `€${(lines.reduce((s, l) => s + l.amount, 0) / 100).toFixed(2)}`;
const iso = (unix: number) => new Date(unix * 1000).toISOString();
const numbers: string[] = [];
const note = (label: string, lines: any[], credits: number, extra = "") => numbers.push(`  ${label.padEnd(62)} pays ${euros(lines).padStart(8)}  →  ${String(credits).padStart(4)} credits${extra ? `   ${extra}` : ""}`);

console.log("\n11. Upgrade on a monthly plan (credits in step with the money)");
{
  db.profiles.push(prof(10, { plan_code: "starter", credit_balance: 750, stripe_subscription_id: "sub_10", stripe_subscription_status: "paid" }));
  stripe.subs.sub_10 = subscription("sub_10", "cus_10", "active", PRO);
  const lines = [line(STARTER, 0.5, -1), line(PRO, 0.5, 1)];
  const up = evt("invoice.payment_succeeded", changeInvoice("in_up_10", "cus_10", "sub_10", lines));
  check("Starter → Pro with half the month left: 0.5 × (1,600 − 750) = 425", (await q(up)).body, { ok: true, plan_credits: 0, plan_change: true, credits: 425, granted: true });
  check("plan is Pro, balance 750 + 425, grant keyed by the proration invoice", [P(10).plan_code, P(10).credit_balance, grantsFor(10)], ["pro", 1175, ["plan_upgrade:425:in_up_10"]]);
  note("monthly Starter → Pro, 15 of 30 days left", lines, 425);
  check("REPLAY of the same event → deduped", (await q(up)).body, { ok: true, deduped: true });
  check("REPLAY as invoice.paid (another event id, same invoice) → no second grant", (await q(evt("invoice.paid", changeInvoice("in_up_10", "cus_10", "sub_10", lines)))).body, { ok: true, plan_credits: 0, plan_change: true, credits: 425, granted: false });
  check("balance unchanged after both replays", [P(10).credit_balance, grantsFor(10).length], [1175, 1]);
  check("the next renewal is a full Pro month", [(await q(evt("invoice.payment_succeeded", invoice("in_cycle_10", "cus_10", "sub_10", PRO, { billing_reason: "subscription_cycle" })))).body, P(10).credit_balance], [{ ok: true, plan_credits: 1600, granted: true }, 2775]);

  db.profiles.push(prof(11, { plan_code: "starter", credit_balance: 750, stripe_subscription_id: "sub_11", stripe_subscription_status: "paid" }));
  stripe.subs.sub_11 = subscription("sub_11", "cus_11", "active", PRO);
  const last = [line(STARTER, 1 / 30, -1), line(PRO, 1 / 30, 1)];
  check("on the LAST day (1 of 30): 28 credits, not 850", [(await q(evt("invoice.payment_succeeded", changeInvoice("in_up_11", "cus_11", "sub_11", last)))).body.credits, P(11).credit_balance, P(11).plan_code], [28, 778, "pro"]);
  note("monthly Starter → Pro, last day (1 of 30)", last, 28);

  db.profiles.push(prof(16, { plan_code: "starter", credit_balance: 900, stripe_subscription_id: "sub_16", stripe_subscription_status: "paid" }));
  stripe.subs.sub_16 = subscription("sub_16", "cus_16", "active", PRO, { start_date: Math.floor(Date.parse("2026-09-01T00:00:00Z") / 1000) });
  const early = [line(STARTER, 0.5, -1), line(PRO, 0.5, 1)];
  check("subscription from before 30 Sep keeps its larger amounts: 0.5 × (1,900 − 900) = 500", (await q(evt("invoice.payment_succeeded", changeInvoice("in_up_16", "cus_16", "sub_16", early)))).body.credits, 500);
  note("same, subscription started before 30 Sep (900 → 1,900)", early, 500);

  db.profiles.push(prof(17, { plan_code: "starter", credit_balance: 600, stripe_subscription_id: "sub_17", stripe_subscription_status: "paid" }));
  stripe.subs.sub_17 = subscription("sub_17", "cus_17", "active", PRO, { start_date: Math.floor(Date.parse("2026-05-01T00:00:00Z") / 1000) });
  const legacy = [line(LEGACY_STARTER, 0.5, -1), line(PRO, 0.5, 1)];
  check("legacy Starter (€11.99, 600) → today's Pro, half the month left: 0.5 × 1,900 − 0.5 × 600 = 650", (await q(evt("invoice.payment_succeeded", changeInvoice("in_up_17", "cus_17", "sub_17", legacy)))).body.credits, 650);
  note("legacy Starter €11.99 → Pro, 15 of 30 days left", legacy, 650);
}

console.log("\n12. Upgrade on a yearly plan (credits come monthly; never worth more than the money)");
{
  // 9 months of the year left, 20 of 30 days of the credit month left.
  db.profiles.push(prof(12, { plan_code: "starter", credit_balance: 750, stripe_subscription_id: "sub_12", stripe_subscription_status: "paid", billing_interval: "yearly", annual_credits_per_month: 750, annual_credits_last_topup: iso(now - 10 * DAY) }));
  stripe.subs.sub_12 = subscription("sub_12", "cus_12", "active", PRO_YEARLY);
  const mid = [line(STARTER_YEARLY, 0.75, -1, now, now + 274 * DAY), line(PRO_YEARLY, 0.75, 1, now, now + 274 * DAY)];
  check("9 months left, 20 days of the credit month left: (20 ÷ 30) × 850 = 567", (await q(evt("invoice.payment_succeeded", changeInvoice("in_up_12", "cus_12", "sub_12", mid)))).body, { ok: true, plan_credits: 0, plan_change: true, credits: 567, granted: true });
  check("monthly top-up is now 1,600; the top-up date did not move", [P(12).plan_code, P(12).annual_credits_per_month, P(12).annual_credits_last_topup, P(12).billing_interval, P(12).credit_balance], ["pro", 1600, iso(now - 10 * DAY), "yearly", 1317]);
  note("yearly Starter → yearly Pro, 9 months left, 20 days left in month", mid, 567, "top-ups: 1,600 from the next one");

  // Right after a top-up, half the year left: nearly the whole month's difference.
  db.profiles.push(prof(14, { plan_code: "starter", credit_balance: 750, stripe_subscription_id: "sub_14", stripe_subscription_status: "paid", billing_interval: "yearly", annual_credits_per_month: 750, annual_credits_last_topup: iso(now - 3600) }));
  stripe.subs.sub_14 = subscription("sub_14", "cus_14", "active", PRO_YEARLY);
  const fresh = [line(STARTER_YEARLY, 0.5, -1, now, now + 183 * DAY), line(PRO_YEARLY, 0.5, 1, now, now + 183 * DAY)];
  check("RIGHT AFTER A TOP-UP, 6 months left: 849 (the whole month is still ahead)", [(await q(evt("invoice.payment_succeeded", changeInvoice("in_up_14", "cus_14", "sub_14", fresh)))).body.credits, P(14).annual_credits_per_month], [849, 1600]);
  note("yearly Starter → yearly Pro, right after a top-up, 6 months left", fresh, 849, "top-ups: 1,600 from the next one");

  // LAST DAYS OF THE YEAR, right after a top-up: the exploit the cap closes.
  db.profiles.push(prof(13, { plan_code: "starter", credit_balance: 750, stripe_subscription_id: "sub_13", stripe_subscription_status: "paid", billing_interval: "yearly", annual_credits_per_month: 750, annual_credits_last_topup: iso(now - 3600) }));
  stripe.subs.sub_13 = subscription("sub_13", "cus_13", "active", PRO_YEARLY);
  const lastDays = [line(STARTER_YEARLY, 3 / 365, -1, now, now + 3 * DAY), line(PRO_YEARLY, 3 / 365, 1, now, now + 3 * DAY)];
  const uncapped = Math.round((1 - 3600 / (30 * DAY)) * 850);
  const capped = (await q(evt("invoice.payment_succeeded", changeInvoice("in_up_13", "cus_13", "sub_13", lastDays)))).body.credits;
  check(`LAST 3 DAYS OF THE YEAR, right after a top-up: 84 credits for €1.68 (it would be ${uncapped} without the cap)`, [capped, uncapped], [84, 849]);
  check("…and the monthly top-up stays 750 until the renewal is paid", [P(13).plan_code, P(13).annual_credits_per_month, P(13).credit_balance], ["pro", 750, 834]);
  note("yearly Starter → yearly Pro, 3 days of the year left, after top-up", lastDays, 84, `(${uncapped} without the cap) top-ups: still 750`);
  check("the paid renewal at the Pro yearly price then gives 1,600 and sets the top-up to 1,600", [(await q(evt("invoice.payment_succeeded", invoice("in_renew_13", "cus_13", "sub_13", PRO_YEARLY, { billing_reason: "subscription_cycle" })))).body, P(13).annual_credits_per_month], [{ ok: true, plan_credits: 1600, granted: true }, 1600]);

  // 20 days of the year left, top-up due in 3 days: exactly what the money pays for, now.
  db.profiles.push(prof(18, { plan_code: "starter", credit_balance: 750, stripe_subscription_id: "sub_18", stripe_subscription_status: "paid", billing_interval: "yearly", annual_credits_per_month: 750, annual_credits_last_topup: iso(now - 27 * DAY) }));
  stripe.subs.sub_18 = subscription("sub_18", "cus_18", "active", PRO_YEARLY);
  const lastMonth = [line(STARTER_YEARLY, 20 / 365, -1, now, now + 20 * DAY), line(PRO_YEARLY, 20 / 365, 1, now, now + 20 * DAY)];
  check("20 days of the year left: 20 ÷ 365 × 12 months × 850 = 559, top-up stays 750", [(await q(evt("invoice.payment_succeeded", changeInvoice("in_up_18", "cus_18", "sub_18", lastMonth)))).body.credits, P(18).annual_credits_per_month], [559, 750]);
  note("yearly Starter → yearly Pro, 20 days of the year left", lastMonth, 559, "top-ups: still 750");
}

console.log("\n13. Monthly → yearly, and a switch to a smaller plan");
{
  db.profiles.push(prof(15, { plan_code: "pro", credit_balance: 1600, stripe_subscription_id: "sub_15", stripe_subscription_status: "paid", billing_interval: "monthly", annual_credits_per_month: 0, annual_credits_last_topup: null }));
  stripe.subs.sub_15 = subscription("sub_15", "cus_15", "active", PRO_YEARLY);
  const toYearly = [line(PRO, 0.5, -1), line(PRO_YEARLY, 1, 0, now, now + 365 * DAY)];
  const ev = evt("invoice.payment_succeeded", changeInvoice("in_up_15", "cus_15", "sub_15", toYearly));
  check("MONTHLY → YEARLY Pro with half the month left: 1,600 for the new month − 800 already given = 800", (await q(ev)).body, { ok: true, plan_credits: 1600, plan_change: true, credits: 800, granted: true });
  check("the paid period on the profile is the new YEAR (not the old month's unused time on the first line)", P(15).current_period_end, iso(now + 365 * DAY));
  check("yearly billing, 1,600 a month, top-up cycle starts at the payment", [P(15).billing_interval, P(15).annual_credits_per_month, P(15).annual_credits_last_topup, P(15).credit_balance, grantsFor(15)], ["yearly", 1600, iso(now), 2400, ["plan_upgrade:800:in_up_15"]]);
  note("monthly Pro → yearly Pro, 15 of 30 days left", toYearly, 800, "top-ups: 1,600, cycle restarts");
  check("REPLAY → deduped, balance unchanged", [(await q(ev)).body, P(15).credit_balance], [{ ok: true, deduped: true }, 2400]);

  db.profiles.push(prof(19, { plan_code: "generative", credit_balance: 3200, stripe_subscription_id: "sub_19", stripe_subscription_status: "paid" }));
  stripe.subs.sub_19 = subscription("sub_19", "cus_19", "active", STARTER_YEARLY);
  const down = [line(GENERATIVE, 0.5, -1), line(STARTER_YEARLY, 1, 0, now, now + 365 * DAY)];
  check("monthly Generative → yearly Starter (Stripe applies it at once): no credits taken back, none added", [(await q(evt("invoice.payment_succeeded", changeInvoice("in_up_19", "cus_19", "sub_19", down)))).body, P(19).plan_code, P(19).credit_balance, grantsFor(19).length], [{ ok: true, plan_credits: 750, plan_change: true, credits: 0, granted: false }, "starter", 3200, 0]);
  note("monthly Generative → yearly Starter, 15 of 30 days left", down, 0, "750 − 1,600 is below zero: nothing granted");
}

console.log("\n14. Failed plan-change payment, and a scheduled downgrade");
{
  db.profiles.push(prof(20, { plan_code: "starter", credit_balance: 100, stripe_subscription_id: "sub_20", stripe_subscription_status: "active" }));
  const failed20 = changeInvoice("in_fail_20", "cus_20", "sub_20", [line(STARTER, 0.5, -1), line(PRO, 0.5, 1)], { status: "open" });
  check("payment for the upgrade fails → plan stays Starter, no credits, NOT marked past due", [(await q(evt("invoice.payment_failed", failed20))).body, P(20).plan_code, P(20).credit_balance, P(20).stripe_subscription_status], [{ ok: true, failed_invoice: "in_fail_20", marked_past_due: false }, "starter", 100, "active"]);
  check("a failed RENEWAL still marks past due", [(await q(evt("invoice.payment_failed", invoice("in_fail_20b", "cus_20", "sub_20", STARTER, { status: "open", billing_reason: "subscription_cycle" })))).body.marked_past_due, P(20).stripe_subscription_status], [true, "past_due"]);

  db.profiles.push(prof(21, { plan_code: "pro", credit_balance: 1600, stripe_subscription_id: "sub_21", stripe_subscription_status: "active" }));
  stripe.subs.sub_21 = subscription("sub_21", "cus_21", "active", PRO);
  check("downgrade booked in the portal (schedule attached, price unchanged) → still Pro", [(await q(evt("customer.subscription.updated", subscription("sub_21", "cus_21", "active", PRO, { schedule: "sub_sched_1" })))).status, P(21).plan_code], [200, "pro"]);
  check("period ends, Stripe switches the price → now Starter", [(await q(evt("customer.subscription.updated", subscription("sub_21", "cus_21", "active", STARTER)))).status, P(21).plan_code], [200, "starter"]);
  check("and the renewal at the Starter price gives 750", (await q(evt("invoice.payment_succeeded", invoice("in_cycle_21", "cus_21", "sub_21", STARTER, { billing_reason: "subscription_cycle" })))).body, { ok: true, plan_credits: 750, granted: true });
}

console.log("\nPlan-change numbers (new-subscriber amounts 750 / 1,600 / 3,200 unless noted):");
for (const n of numbers) console.log(n);

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nall checks passed");
Deno.exit(failed ? 1 : 0);
