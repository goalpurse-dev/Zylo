// The +50 bonus offer through the REAL supabase/functions/stripe-webhook/index.ts, with Stripe-shaped
// events (the same harness as simulate.ts: in-memory database, fake Stripe API, no network, no keys).
// The offer window is the real one (supabase/functions/_shared/offer.js); each invoice carries its own
// payment time, so "after Sunday 23:59" is simulated by the payment time, exactly as the webhook judges it.
//   npx -y deno@2.9.6 run --allow-env --allow-read --no-check --no-lock --no-config --import-map=tests/stripe-webhook/import_map.json tests/stripe-webhook/simulateOffer.ts
// The SQL of grant_offer_bonus is proven on the database itself (a rolled-back run), not here.
// deno-lint-ignore-file no-explicit-any
import { db } from "./fakeSupabase.ts";

const SECRET = "whsec_simulation";
Deno.env.set("SUPABASE_URL", "http://fake");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake");
Deno.env.set("STRIPE_SECRET_KEY", "sk_test_fake");
Deno.env.set("STRIPE_WEBHOOK_SECRET_SUPABASE", SECRET);
Deno.env.set("SIMULATION_OFFER_JSON", "{}"); // = the real offer, unchanged

const stripe: { subs: Record<string, any>; lineItems: Record<string, any[]> } = { subs: {}, lineItems: {} };
globalThis.fetch = ((input: any) => {
  const url = new URL(String(input));
  const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
  let m;
  if ((m = url.pathname.match(/^\/v1\/checkout\/sessions\/(.+)\/line_items$/))) return json({ data: stripe.lineItems[m[1]] ?? [] });
  if ((m = url.pathname.match(/^\/v1\/prices\/(.+)$/))) return json({ id: m[1], metadata: {} });
  if ((m = url.pathname.match(/^\/v1\/subscriptions\/(.+)$/))) return stripe.subs[m[1]] ? json(stripe.subs[m[1]]) : json({ error: { message: "No such subscription" } }, 404);
  if (url.pathname === "/v1/subscriptions") return json({ data: Object.values(stripe.subs).filter((s) => s.customer === url.searchParams.get("customer") && s.status !== "canceled") });
  return json({ error: { message: `unexpected ${url.pathname}` } }, 500);
}) as any;

const { OFFER } = await import(new URL("../../supabase/functions/_shared/offer.js", import.meta.url).href);
const webhook = (await import(new URL("../../supabase/functions/stripe-webhook/index.ts", import.meta.url).href)).default;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sign(raw: string, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `t=${t},v1=${hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)))}`;
}
let n = 0;
const evt = (type: string, object: any) => ({ id: `evt_offer_${++n}`, type, data: { object } });
async function send(event: any) {
  const raw = JSON.stringify(event);
  const keep = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => {};
  try {
    const res = await webhook.fetch(new Request("http://local/stripe-webhook", { method: "POST", body: raw, headers: { "stripe-signature": await sign(raw) } }));
    return { status: res.status, body: await res.json() };
  } finally { Object.assign(console, keep); }
}
let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
}

const U = (i: number) => `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`;
const STARTER = "price_1TmVZZHtn4q5rIncOuf5aKP4", PRO = "price_1TmVfXHtn4q5rInc9IaN1l3U", MINI = "price_1TGKjDHtn4q5rInczlym0Dcz";
const PRICE: Record<string, number> = { [STARTER]: 1800, [PRO]: 3800 };
const prof = (i: number, extra: any = {}) => ({ id: U(i), plan_code: "free", credit_balance: 0, stripe_customer_id: `cus_o${i}`, stripe_subscription_id: null, stripe_subscription_status: null, ...extra });
const P = (i: number) => db.profiles.find((p) => p.id === U(i));
const grantsFor = (i: number) => db.credit_grants.filter((g) => g.user_id === U(i)).map((g) => `${g.reason}:${g.amount}`);
const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const now = Math.floor(Date.now() / 1000);
const subscription = (id: string, cus: string, price: string) => ({ id, customer: cus, status: "active", start_date: now, current_period_end: now + 2592000, cancel_at_period_end: false, items: { data: [{ price: { id: price } }] } });
const invoice = (id: string, i: number, paidIso: string, price = STARTER, billing_reason = "subscription_create") => ({
  id, customer: `cus_o${i}`, subscription: `sub_o${i}`, status: "paid", billing_reason, created: at(paidIso), status_transitions: { paid_at: at(paidIso) },
  lines: { data: [{ price: { id: price, recurring: { interval: "month" } }, proration: false, period: { end: now + 2592000 } }] },
});
const upgrade = (id: string, i: number, paidIso: string, from: string, to: string) => ({
  id, customer: `cus_o${i}`, subscription: `sub_o${i}`, status: "paid", billing_reason: "subscription_update", created: at(paidIso), status_transitions: { paid_at: at(paidIso) },
  lines: { data: [
    { amount: -Math.round(PRICE[from] / 2), proration: true, quantity: 1, price: { id: from, unit_amount: PRICE[from], recurring: { interval: "month" } }, period: { start: now, end: now + 30 * 86400 } },
    { amount: Math.round(PRICE[to] / 2), proration: true, quantity: 1, price: { id: to, unit_amount: PRICE[to], recurring: { interval: "month" } }, period: { start: now, end: now + 30 * 86400 } },
  ] },
});
const WED = "2026-10-28T12:00:00Z"; // inside the offer
console.log(`offer ${OFFER.id}: +${OFFER.bonusCredits}, ${OFFER.startsAt} → ${OFFER.endsAt}`);

console.log("\n1. A plan bought during the offer: plan credits + 50, once");
db.profiles.push(prof(1)); stripe.subs.sub_o1 = subscription("sub_o1", "cus_o1", STARTER);
const buy = evt("invoice.payment_succeeded", invoice("in_o1", 1, WED));
check("Starter bought Wed 28 Oct → 750 + bonus", (await send(buy)).body, { ok: true, plan_credits: 750, granted: true, bonus: true });
check("balance 800, two grants, one redemption", [P(1).credit_balance, grantsFor(1), db.offer_redemptions.filter((r) => r.user_id === U(1)).length], [800, ["plan_renewal:750", "offer_bonus:50"], 1]);
check("the same event again → deduped", (await send(buy)).body.deduped, true);
check("the same invoice as invoice.paid (another event) → no second bonus", (await send(evt("invoice.paid", invoice("in_o1", 1, WED)))).body, { ok: true, plan_credits: 750, granted: false, bonus: false });
check("still 800", P(1).credit_balance, 800);

console.log("\n2. Once per account: the same person upgrades later in the week");
stripe.subs.sub_o1 = subscription("sub_o1", "cus_o1", PRO);
check("Starter → Pro on Fri 30 Oct: upgrade credits, no second bonus", (await send(evt("invoice.payment_succeeded", upgrade("in_o1_up", 1, "2026-10-30T12:00:00Z", STARTER, PRO)))).body, { ok: true, plan_credits: 0, plan_change: true, credits: 425, granted: true, bonus: false });
check("bonus grants for this account: one", grantsFor(1).filter((g) => g.startsWith("offer_bonus")).length, 1);

console.log("\n3. An upgrade is a purchase too (first bonus for that account)");
db.profiles.push(prof(2, { plan_code: "starter", credit_balance: 750, stripe_subscription_id: "sub_o2", stripe_subscription_status: "paid" })); stripe.subs.sub_o2 = subscription("sub_o2", "cus_o2", PRO);
check("Starter → Pro during the offer → upgrade credits + bonus", (await send(evt("invoice.payment_succeeded", upgrade("in_o2_up", 2, WED, STARTER, PRO)))).body, { ok: true, plan_credits: 0, plan_change: true, credits: 425, granted: true, bonus: true });

console.log("\n4. Not purchases: a smaller plan, a renewal, a credit top-up");
db.profiles.push(prof(3, { plan_code: "pro", credit_balance: 1600, stripe_subscription_id: "sub_o3", stripe_subscription_status: "paid" })); stripe.subs.sub_o3 = subscription("sub_o3", "cus_o3", STARTER);
const down = await send(evt("invoice.payment_succeeded", upgrade("in_o3_down", 3, WED, PRO, STARTER)));
check("Pro → Starter → no bonus", [down.status, down.body.bonus, grantsFor(3).filter((g) => g.startsWith("offer_bonus")).length], [200, undefined, 0]);
db.profiles.push(prof(4, { plan_code: "starter", credit_balance: 750, stripe_subscription_id: "sub_o4", stripe_subscription_status: "paid" })); stripe.subs.sub_o4 = subscription("sub_o4", "cus_o4", STARTER);
check("renewal of the same plan during the offer → 750, no bonus", (await send(evt("invoice.payment_succeeded", invoice("in_o4_cycle", 4, WED, STARTER, "subscription_cycle")))).body, { ok: true, plan_credits: 750, granted: true });
stripe.lineItems.cs_o4_pack = [{ price: { id: MINI }, quantity: 1 }];
check("credit top-up during the offer → 300, no bonus", (await send(evt("checkout.session.completed", { id: "cs_o4_pack", mode: "payment", status: "complete", payment_status: "paid", customer: "cus_o4", metadata: { user_id: U(4) } }))).body, { ok: true, topup_credits: 300, granted: true });
check("account 4: no bonus at all", grantsFor(4).filter((g) => g.startsWith("offer_bonus")).length, 0);

console.log("\n5. The deadline, by the payment time: Sunday 1 Nov 23:59 Finnish time");
db.profiles.push(prof(5)); stripe.subs.sub_o5 = subscription("sub_o5", "cus_o5", STARTER);
check("paid Sun 23:59:00 Finnish (21:59:00 UTC) → bonus", (await send(evt("invoice.payment_succeeded", invoice("in_o5", 5, "2026-11-01T21:59:00Z")))).body, { ok: true, plan_credits: 750, granted: true, bonus: true });
db.profiles.push(prof(6)); stripe.subs.sub_o6 = subscription("sub_o6", "cus_o6", STARTER);
check("paid Mon 00:00:01 Finnish (22:00:01 UTC) → no bonus", (await send(evt("invoice.payment_succeeded", invoice("in_o6", 6, "2026-11-01T22:00:01Z")))).body, { ok: true, plan_credits: 750, granted: true });
db.profiles.push(prof(7)); stripe.subs.sub_o7 = subscription("sub_o7", "cus_o7", STARTER);
check("paid next week → no bonus", (await send(evt("invoice.payment_succeeded", invoice("in_o7", 7, "2026-11-05T10:00:00Z")))).body, { ok: true, plan_credits: 750, granted: true });
db.profiles.push(prof(8)); stripe.subs.sub_o8 = subscription("sub_o8", "cus_o8", STARTER);
check("paid before the offer went live → no bonus", (await send(evt("invoice.payment_succeeded", invoice("in_o8", 8, "2026-10-26T12:00:00Z")))).body, { ok: true, plan_credits: 750, granted: true });
check("bonuses given in all of this: accounts 1, 2 and 5 only", db.offer_redemptions.map((r) => r.user_id).sort(), [U(1), U(2), U(5)].sort());

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nall offer checks passed");
if (failed) Deno.exit(1);
