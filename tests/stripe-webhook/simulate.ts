// Runs the REAL supabase/functions/stripe-webhook/index.ts against an
// in-memory database (fakeSupabase.ts) and a fake Stripe API. No network, no
// keys, no live data; the permissions below don't even allow network access.
// Covers: signature, subscription, credit pack, failure + retry without double
// credits, missing/duplicate user, subscription status, cancellation, failed
// payment. Exits 1 if any check fails. From the repo root:
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

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nall checks passed");
Deno.exit(failed ? 1 : 0);
