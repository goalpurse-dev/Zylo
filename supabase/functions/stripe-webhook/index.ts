// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PLAN_PRICE_MAP, planCreditsFor, prorationCreditShare } from "../_shared/stripePlanPrices.js";

/* =================== CONFIG =================== */
/** Recurring plan prices → plan + monthly credits (current and legacy), with the
 *  early grant for current-price subscriptions started before NEW_GRANT_CUTOFF.
 *  One source for the webhook, the pricing page and tests: _shared/stripePlanPrices.js */
const PRICE_MAP: Record<string, { plan: "starter" | "pro" | "generative"; credits: number; earlyCredits?: number; interval?: "yearly" }> = { ...(PLAN_PRICE_MAP as any) };

/** One-time top-up map (fallback if Price.metadata.credits is not set) */
const TOPUP_PRICE_MAP: Record<string, number> = {
  "price_1TGKjDHtn4q5rInczlym0Dcz": 300,
  "price_1SpZczHtn4q5rInctZoF9rJV": 500,
  "price_1TGKjxHtn4q5rIncQzzCGyrR": 900,
};

/** The Stripe API version this code reads (invoice.subscription, line.price,
 *  subscription.current_period_end). It is the account default and the version
 *  of this webhook endpoint in the Dashboard; sent on every request so the
 *  responses keep this shape if the account default is ever upgraded. Event
 *  payloads follow the ENDPOINT's version, which only the Dashboard can change. */
const STRIPE_API_VERSION = "2022-08-01";

/** Stripe's own default: a signature older than this is a replay. */
const SIGNATURE_TOLERANCE_SECONDS = 300;
/* ============================================== */

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET  = Deno.env.get("STRIPE_SECRET_KEY")!;
// The signing secret of THIS endpoint (…supabase.co/functions/v1/stripe-webhook).
// STRIPE_WEBHOOK_SECRET is the old name, still read so nothing breaks before the
// new one is set.
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET_SUPABASE") || Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

// Test mode only (Stripe CLI runs): test-mode prices have other ids than the
// live ones in the maps above. STRIPE_TEST_PRICE_ALIASES = {"<test price id>":
// "<live price id>"} lets a test price stand in for a live one. Ignored with a
// live key.
if (/^(sk|rk)_test_/.test(STRIPE_SECRET ?? "")) {
  try {
    const aliases: Record<string, string> = JSON.parse(Deno.env.get("STRIPE_TEST_PRICE_ALIASES") || "{}");
    for (const [testId, liveId] of Object.entries(aliases)) {
      if (PRICE_MAP[liveId]) PRICE_MAP[testId] = PRICE_MAP[liveId];
      if (TOPUP_PRICE_MAP[liveId]) TOPUP_PRICE_MAP[testId] = TOPUP_PRICE_MAP[liveId];
    }
  } catch (e) {
    console.error("[stripe-webhook] STRIPE_TEST_PRICE_ALIASES is not valid JSON:", e);
  }
}

/* ---------- CORS / responses ---------- */
function cors(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ||
      "authorization, x-client-info, apikey, content-type, stripe-signature",
    "content-type": "application/json",
    vary: "Origin",
  };
}
const respond = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

/* ---------- Deno-safe Stripe signature verification ---------- */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2) throw new Error("invalid hex length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  return out;
}
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
/** HMAC-SHA256 of `${t}.${raw body}` against every v1 signature in the header
 *  (Stripe sends two while a secret is being rolled). */
async function verifyStripeSignature(raw: string, sigHeader: string | null, secret: string): Promise<boolean> {
  if (!sigHeader) return false;
  let ts = "";
  const provided: string[] = [];
  for (const part of sigHeader.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") ts = v;
    else if (k === "v1") provided.push(v);
  }
  if (!ts || !provided.length) return false;
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const computed = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${raw}`)));
  return provided.some((v1) => {
    try { return timingSafeEqualBytes(computed, hexToBytes(v1)); } catch { return false; }
  });
}

/* ---------- Supabase helpers ---------- */
const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

/** The data of a Supabase call; any error throws, so the event fails and Stripe retries it. */
function must<T>(res: { data: T; error: any }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message ?? JSON.stringify(res.error)}`);
  return res.data;
}

type Profile = { id: string; plan_code: string | null; stripe_subscription_id: string | null; annual_credits_last_topup: string | null };
const PROFILE_COLUMNS = "id, plan_code, stripe_subscription_id, annual_credits_last_topup";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function profilesByCustomerId(customerId: string): Promise<Profile[]> {
  if (!customerId || customerId === "undefined" || customerId === "null") return [];
  return must(
    await sb.from("profiles").select(PROFILE_COLUMNS).eq("stripe_customer_id", customerId).limit(5),
    `profiles lookup for customer ${customerId}`,
  ) ?? [];
}
async function profileById(userId: string): Promise<Profile | null> {
  return must(
    await sb.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
    `profile lookup for user ${userId}`,
  );
}

/**
 * The profile a Stripe object belongs to: the one holding the customer id, or
 * a user id our checkout wrote into metadata (hints). hintsFirst = trust the
 * metadata before the customer id (checkout sessions, which we create).
 * A customer id on several profiles is logged; a hint among them decides,
 * otherwise this throws: guessing could credit the wrong account.
 */
async function resolveProfile(o: { eventId: string; customerId: string; hints: unknown[]; hintsFirst?: boolean }): Promise<Profile | null> {
  const hinted = async () => {
    for (const h of o.hints) {
      if (typeof h !== "string" || !UUID_RE.test(h)) continue;
      const p = await profileById(h);
      if (p) return p;
    }
    return null;
  };
  let byHint: Profile | null = null;
  if (o.hintsFirst) {
    byHint = await hinted();
    if (byHint) return byHint;
  }
  const matches = await profilesByCustomerId(o.customerId);
  if (matches.length === 1) return matches[0];
  if (!o.hintsFirst) byHint = await hinted();
  if (matches.length > 1) {
    console.error(`[stripe-webhook] DUPLICATE_CUSTOMER event=${o.eventId} customer=${o.customerId} is on ${matches.length} profiles: ${matches.map((m) => m.id).join(", ")}`);
    const pick = byHint && matches.find((m) => m.id === byHint!.id);
    if (pick) return pick;
    throw new Error(`customer ${o.customerId} is on ${matches.length} profiles and no metadata says which one`);
  }
  return byHint;
}

/** A paid event without a profile must never pass quietly: Stripe keeps retrying it. */
function noUserForPaidEvent(type: string, eventId: string, customerId: string): Error {
  console.error(`[stripe-webhook] NO_USER_FOR_PAID_EVENT type=${type} event=${eventId} customer=${customerId || "(none)"}: money was taken and no profile matches`);
  return new Error(`no profile for customer ${customerId || "(none)"} on paid event ${eventId}`);
}

/** Updates one profile row; an error or a missing row throws. */
async function updateProfile(userId: string, patch: Record<string, unknown>, what: string) {
  const rows = must<any[] | null>(await sb.from("profiles").update(patch).eq("id", userId).select("id"), `${what} (user ${userId})`);
  if (!rows?.length) throw new Error(`${what}: no profile row for user ${userId}`);
}

/**
 * Adds credits exactly once per external id (invoice or checkout session id).
 * grant_credits_once writes the credit_grants row and the balance in one
 * transaction, so a retry after any failure can neither repeat nor skip a
 * grant. Returns false when this id was already granted.
 */
async function grantCreditsOnce(userId: string, amount: number, reason: string, externalId: string): Promise<boolean> {
  if (amount <= 0) return false;
  if (!externalId) throw new Error(`credit grant (${reason}) has no external id`);
  const granted = must(
    await sb.rpc("grant_credits_once", { p_user_id: userId, p_amount: amount, p_reason: reason, p_external_id: externalId }),
    `grant ${amount} credits (${reason} ${externalId}) to user ${userId}`,
  );
  if (!granted) console.log(`[stripe-webhook] credits for ${externalId} were already granted`);
  return granted === true;
}

/**
 * Event dedupe. An event is recorded only AFTER its handler succeeded, so a
 * failed one is run again when Stripe retries. Both calls fail open: every
 * handler is safe to run twice (credits are guarded by grantCreditsOnce).
 */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  const { data, error } = await sb.from("billing_events_processed").select("event_id").eq("event_id", eventId).maybeSingle();
  if (error) {
    console.warn("[stripe-webhook] billing_events_processed lookup failed, handling the event anyway:", error.message);
    return false;
  }
  return Boolean(data);
}
async function markProcessed(eventId: string) {
  const { error } = await sb.from("billing_events_processed").insert({ event_id: eventId });
  // 23505 = a concurrent delivery of the same event recorded it first.
  if (error && error.code !== "23505") console.warn("[stripe-webhook] billing_events_processed insert failed:", error.message);
}

/* ---------- Stripe read helpers ---------- */
/** GET from Stripe; a failed request throws (the event fails and Stripe retries). */
async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET}`, "Stripe-Version": STRIPE_API_VERSION },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Stripe GET ${path.split("?")[0]} failed: ${res.status} ${body?.error?.message ?? ""}`);
  return body;
}
async function fetchCheckoutLineItems(sessionId: string): Promise<any[]> {
  const li = await stripeGet(`checkout/sessions/${sessionId}/line_items?limit=100`);
  if (!Array.isArray(li?.data)) throw new Error(`Stripe returned no line items list for checkout ${sessionId}`);
  return li.data;
}
async function fetchPriceCreditsFromMetadata(priceId: string): Promise<number | null> {
  const price = await stripeGet(`prices/${priceId}`);
  const raw = price?.metadata?.credits;
  if (!raw) return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function invoiceSubscriptionId(inv: any, lines: any[]): string | null {
  const subId = inv?.subscription ?? inv?.parent?.subscription_details?.subscription
    ?? lines.find((ln) => ln?.subscription)?.subscription ?? lines[0]?.parent?.subscription_item_details?.subscription;
  const id = typeof subId === "string" ? subId : subId?.id;
  return id || null;
}
/**
 * The invoice's subscription start (unix seconds), which decides the early vs
 * new grant on current prices. Only looked up when a line has an early grant.
 * If Stripe can't be asked: a first invoice is a new subscription (now); any
 * other invoice is treated as an existing one (0 → early grant), so a lookup
 * failure never cuts an existing subscriber's credits.
 */
async function subscriptionStartUnix(inv: any, lines: any[]): Promise<number | undefined> {
  const needs = lines.some((ln) => PRICE_MAP[ln?.price?.id]?.earlyCredits);
  if (!needs) return undefined;
  const fallback = inv?.billing_reason === "subscription_create" ? Math.floor(Date.now() / 1000) : 0;
  const id = invoiceSubscriptionId(inv, lines);
  if (!id) return fallback;
  try {
    const sub = await stripeGet(`subscriptions/${id}`);
    return Number.isFinite(sub?.start_date) ? sub.start_date : fallback;
  } catch (e) {
    console.error("[stripe-webhook] subscription lookup failed:", e);
    return fallback;
  }
}
/** Another subscription of this customer that still pays for a plan (a double purchase). */
async function otherLiveSubscription(customerId: string, exceptId: string): Promise<any | null> {
  const list = await stripeGet(`subscriptions?customer=${encodeURIComponent(customerId)}&limit=20`);
  if (!Array.isArray(list?.data)) throw new Error(`Stripe returned no subscriptions list for customer ${customerId}`);
  return list.data.find((x: any) => x?.id !== exceptId && (x?.status === "active" || x?.status === "trialing")) ?? null;
}

const unixToIso = (seconds: unknown) => (typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000).toISOString() : null);

/** Profile fields for a subscription that pays for the plan (active or trialing). */
function livePlanPatch(sub: any): Record<string, unknown> {
  const periodEnd = unixToIso(sub?.current_period_end);
  const patch: Record<string, unknown> = {
    stripe_subscription_id:     sub.id,
    stripe_subscription_status: sub?.status ?? null,
    cancel_at_period_end:       Boolean(sub?.cancel_at_period_end),
    current_period_end:         periodEnd,
  };
  const mapping = PRICE_MAP[sub?.items?.data?.[0]?.price?.id];
  if (mapping) {
    patch.plan_code      = mapping.plan;
    patch.plan_renews_at = periodEnd;
  }
  return patch;
}

/* ---------- event handlers ---------- */
/** Handles one verified event. Returns the response body; throws to make Stripe retry. */
async function handleEvent(type: string, eventId: string, obj: any): Promise<Record<string, unknown>> {

  /* ── checkout.session.completed ───────────────────────────────────── */
  if (type === "checkout.session.completed") {
    const s = obj;

    // Only act on sessions that actually have a paid/completing status.
    // failed/canceled/requires_action sessions must be ignored here.
    // (Async payment methods may complete with payment_status = "unpaid";
    //  credits are granted on the matching async_payment_succeeded event.)

    const customerId = s?.customer ? String(s.customer) : "";
    const profile = await resolveProfile({ eventId, customerId, hints: [s?.metadata?.user_id, s?.client_reference_id], hintsFirst: true });
    if (!profile) throw noUserForPaidEvent(type, eventId, customerId);
    const userId = profile.id;

    // One-time top-ups — only when payment_status is confirmed "paid"
    if (s?.mode === "payment" && s?.payment_status === "paid") {
      const items = await fetchCheckoutLineItems(s.id);
      let totalCredits = 0;
      for (const it of items) {
        const priceId: string | undefined = it?.price?.id;
        const qty: number = it?.quantity ?? 1;
        if (!priceId) throw new Error(`checkout ${s.id} has a line item without a price`);
        let per = await fetchPriceCreditsFromMetadata(priceId);
        if (per == null) per = TOPUP_PRICE_MAP[priceId] ?? 0;
        totalCredits += (per || 0) * qty;
      }
      // Paid, so it must be worth credits: fail loudly instead of answering 200 with nothing granted.
      if (totalCredits <= 0) {
        throw new Error(`paid checkout ${s.id} maps to 0 credits (prices: ${items.map((it) => it?.price?.id).join(", ") || "none"})`);
      }
      const granted = await grantCreditsOnce(userId, totalCredits, "topup", s.id);
      return { ok: true, topup_credits: totalCredits, granted };
    }

    // Initial subscription checkout — store IDs; credits come on invoice.payment_succeeded
    if (s?.mode === "subscription" && s?.status === "complete") {
      const patch: any = {};
      if (s.subscription) patch.stripe_subscription_id = s.subscription;
      if (s.customer)     patch.stripe_customer_id     = s.customer;
      if (Object.keys(patch).length) await updateProfile(userId, patch, "store checkout subscription ids");
      return { ok: true };
    }

    // Any other checkout state (unpaid async, abandoned, etc.) — ignore
    return { ok: true, reason: "checkout-no-action" };
  }

  /* ── invoice.payment_succeeded / invoice.paid ─────────────────────── */
  //   The endpoint listens to invoice.payment_succeeded; invoice.paid is the
  //   same payment under another name, and the grant is keyed by invoice id,
  //   so receiving both can never grant twice.
  if (type === "invoice.payment_succeeded" || type === "invoice.paid") {
    const inv = obj;
    const lines: any[] = inv?.lines?.data ?? [];
    const customerId = String(inv?.customer ?? "");
    const profile = await resolveProfile({
      eventId,
      customerId,
      hints: [
        inv?.metadata?.user_id,
        inv?.subscription_details?.metadata?.user_id,
        inv?.parent?.subscription_details?.metadata?.user_id,
        lines[0]?.metadata?.user_id,
      ],
    });
    if (!profile) throw noUserForPaidEvent(type, eventId, customerId);
    const userId = profile.id;

    // Plan credits. A normal recurring line gives the plan's monthly credits.
    // A proration line (a plan change in the billing portal: "unused time" on
    // the old price, "remaining time" on the new one) takes back or gives its
    // share of them, in step with the money (prorationCreditShare).
    let planCredits = 0;   // from normal lines
    let changeCredits = 0; // from proration lines; negative for unused time
    let hasProration = false;
    let plan: "starter" | "pro" | "generative" | undefined;
    let detectedInterval: "yearly" | undefined;
    // The price a plan change moved to (its positive proration line).
    let changedTo: { plan: "starter" | "pro" | "generative"; perMonth: number; yearly: boolean; raiseTopupNow: boolean } | undefined;
    const lastTopup = profile.annual_credits_last_topup ? Date.parse(profile.annual_credits_last_topup) / 1000 : NaN;
    const subStart = await subscriptionStartUnix(inv, lines);
    for (const ln of lines) {
      const priceId: string | undefined = ln?.price?.id;
      const isRecurring = ln?.plan || ln?.price?.recurring;
      const isProration = Boolean(ln?.proration);
      if (!priceId || !isRecurring) continue;
      const map = PRICE_MAP[priceId];
      // A paid plan line we can't map would leave a paying user without plan or credits.
      if (!map) throw new Error(`invoice ${inv?.id} has a recurring price that is not in PLAN_PRICE_MAP: ${priceId}`);
      if (!isProration) {
        planCredits += planCreditsFor(map, subStart);
        plan = map.plan;
        if (map.interval === "yearly") detectedInterval = "yearly";
        continue;
      }
      const amount = Number(ln?.amount) || 0;
      if (!amount) continue;
      hasProration = true;
      const perMonth = planCreditsFor(map, subStart);
      const { share, monthsPaid } = prorationCreditShare(ln, map, lastTopup);
      changeCredits += Math.sign(amount) * share * perMonth;
      if (amount > 0) {
        // In the last month of a yearly plan the top-up amount waits for the paid renewal.
        changedTo = { plan: map.plan, perMonth, yearly: map.interval === "yearly", raiseTopupNow: monthsPaid == null || monthsPaid >= 1 };
      }
    }
    // The payment succeeded, so the plan on the invoice is theirs (whichever event arrives first).
    if (!plan && changedTo) plan = changedTo.plan;
    // One grant per invoice. A change to a smaller plan can't take credits back: never below 0.
    const credits = Math.max(0, Math.round(planCredits + changeCredits));

    const periodEndIso = unixToIso(lines[0]?.period?.end);
    const patch: Record<string, unknown> = {
      stripe_subscription_status: inv?.status ?? "paid",
      cancel_at_period_end:       Boolean(inv?.subscription_details?.cancel_at_period_end),
      current_period_end:         periodEndIso,
      plan_renews_at:             periodEndIso,
    };
    if (plan) {
      patch.plan_code = plan;
      // Remember which subscription pays for the plan when checkout hasn't stored it (yet).
      const subId = invoiceSubscriptionId(inv, lines);
      if (subId && !profile.stripe_subscription_id) patch.stripe_subscription_id = subId;
    }
    if (detectedInterval === "yearly") {
      patch.billing_interval         = "yearly";
      patch.annual_credits_per_month = planCredits;
      // The payment time, not "now": a retried event must not move the monthly top-up date.
      patch.annual_credits_last_topup = unixToIso(inv?.status_transitions?.paid_at) ?? unixToIso(inv?.created) ?? new Date().toISOString();
    } else if (planCredits > 0) {
      patch.billing_interval          = "monthly";
      patch.annual_credits_per_month  = 0;
      patch.annual_credits_last_topup = null;
    } else if (changedTo?.yearly && changedTo.raiseTopupNow) {
      // A yearly plan changed mid-year: the monthly top-ups use the new amount
      // from the next one on. The top-up date stays where it is.
      patch.billing_interval         = "yearly";
      patch.annual_credits_per_month = changedTo.perMonth;
    }
    await updateProfile(userId, patch, `apply paid invoice ${inv?.id}`);

    const granted = credits > 0
      ? await grantCreditsOnce(userId, credits, hasProration ? "plan_upgrade" : "plan_renewal", inv.id)
      : false;

    return hasProration
      ? { ok: true, plan_credits: planCredits, plan_change: true, credits, granted }
      : { ok: true, plan_credits: planCredits, granted };
  }

  /* ── invoice.payment_failed ───────────────────────────────────────── */
  //   Covers: insufficient funds, dunning, 3D Secure failures on
  //   subscription invoices.  No credits are ever added.
  if (type === "invoice.payment_failed") {
    const inv = obj;
    const lines: any[] = inv?.lines?.data ?? [];
    const customerId = String(inv?.customer ?? "");
    const profile = await resolveProfile({ eventId, customerId, hints: [inv?.metadata?.user_id, inv?.subscription_details?.metadata?.user_id] });
    if (!profile) {
      console.warn(`[stripe-webhook] ${type} event=${eventId} customer=${customerId}: no profile, nothing to mark`);
      return { ok: true, reason: "no-user" };
    }

    // Only the subscription that pays for the plan can make the account past due;
    // a declined first payment in checkout belongs to a subscription that never started.
    // A failed payment for a plan change (billing portal) is not that either:
    // Stripe leaves the subscription on its paid plan and voids the invoice, and
    // the subscription's real status still arrives in customer.subscription.updated.
    const subId = invoiceSubscriptionId(inv, lines);
    const isPlanChange = inv?.billing_reason === "subscription_update";
    const isCurrent = Boolean(subId) && subId === profile.stripe_subscription_id && !isPlanChange;
    if (isCurrent) {
      await updateProfile(profile.id, { stripe_subscription_status: "past_due" }, `mark past_due for invoice ${inv?.id}`);
    }

    // Optional audit row. Its external id must NOT be the invoice id: that id is
    // the key of the credit grant when the same invoice is paid later. A failed
    // write is logged and never fails the event.
    const audit = await sb.from("credit_grants").insert({
      user_id:     profile.id,
      reason:      "invoice_failed",
      amount:      0,
      external_id: `failed:${inv?.id}`,
    });
    if (audit.error && audit.error.code !== "23505") {
      console.warn(`[stripe-webhook] invoice_failed audit row for ${inv?.id} not written:`, audit.error.message);
    }

    return { ok: true, failed_invoice: inv?.id, marked_past_due: isCurrent };
  }

  /* ── customer.subscription.updated ───────────────────────────────── */
  if (type === "customer.subscription.updated") {
    const sub = obj;
    const customerId = String(sub?.customer ?? "");
    const profile = await resolveProfile({ eventId, customerId, hints: [sub?.metadata?.user_id] });
    if (!profile) return { ok: true, reason: "no-user" };

    const status = String(sub?.status ?? "");
    const paysForPlan = status === "active" || status === "trialing";
    const endsPlan = status === "incomplete_expired" || status === "unpaid" || status === "canceled";
    const stored = profile.stripe_subscription_id;

    // A subscription that is not the one on the profile (an abandoned first
    // payment, an older duplicate) must not change the plan or the stored status.
    // The exception: no subscription is stored yet and this one is live → adopt it.
    if (stored !== sub.id && !(paysForPlan && !stored)) {
      console.log(`[stripe-webhook] ${type} event=${eventId}: ${sub?.id} (${status}) is not the current subscription of user ${profile.id}, ignored`);
      return { ok: true, reason: "not-current-subscription" };
    }

    // Only an active or trialing subscription gives a paid plan.
    if (paysForPlan) {
      await updateProfile(profile.id, livePlanPatch(sub), `apply subscription ${sub.id} (${status})`);
      return { received: true, status };
    }

    // The current subscription stopped paying for the plan → free, unless the
    // customer has another live subscription (then that one becomes current).
    if (endsPlan) {
      const other = await otherLiveSubscription(customerId, sub.id);
      if (other) {
        console.warn(`[stripe-webhook] ${type} event=${eventId}: ${sub.id} is ${status} but user ${profile.id} also has ${other.id} (${other.status}); keeping the plan on that one`);
        await updateProfile(profile.id, livePlanPatch(other), `move plan to subscription ${other.id}`);
        return { received: true, status, moved_to: other.id };
      }
      await updateProfile(profile.id, {
        plan_code:                  "free",
        stripe_subscription_status: status,
        cancel_at_period_end:       Boolean(sub?.cancel_at_period_end),
        current_period_end:         unixToIso(sub?.current_period_end),
      }, `set free: subscription ${sub.id} is ${status}`);
      return { received: true, status, plan: "free" };
    }

    // past_due, incomplete, paused: keep the plan, store the status.
    await updateProfile(profile.id, {
      stripe_subscription_status: status || null,
      cancel_at_period_end:       Boolean(sub?.cancel_at_period_end),
      current_period_end:         unixToIso(sub?.current_period_end),
    }, `store status ${status} of subscription ${sub.id}`);
    return { received: true, status };
  }

  /* ── customer.subscription.deleted ───────────────────────────────── */
  if (type === "customer.subscription.deleted") {
    const sub = obj;
    const customerId = String(sub?.customer ?? "");
    const profile = await resolveProfile({ eventId, customerId, hints: [sub?.metadata?.user_id] });
    if (!profile) return { received: true, reason: "no-user" };

    // Only the subscription on the profile can end the plan.
    if (profile.stripe_subscription_id !== sub.id) {
      console.log(`[stripe-webhook] ${type} event=${eventId}: ${sub?.id} is not the current subscription of user ${profile.id}, plan kept`);
      return { received: true, reason: "not-current-subscription" };
    }

    const other = await otherLiveSubscription(customerId, sub.id);
    if (other) {
      console.warn(`[stripe-webhook] ${type} event=${eventId}: ${sub.id} ended but user ${profile.id} also has ${other.id} (${other.status}); keeping the plan on that one`);
      await updateProfile(profile.id, livePlanPatch(other), `move plan to subscription ${other.id}`);
      return { received: true, moved_to: other.id };
    }

    await updateProfile(profile.id, {
      plan_code:                  "free",
      stripe_subscription_status: "canceled",
      cancel_at_period_end:       false,
      current_period_end:         unixToIso(sub?.current_period_end),
      stripe_subscription_id:     null,
      billing_interval:           "monthly",
      annual_credits_per_month:   0,
      annual_credits_last_topup:  null,
    }, `set free: subscription ${sub.id} was deleted`);
    return { received: true, plan: "free" };
  }

  // ── All other events (payment_intent.*, charge.*, 3DS events, etc.) ──
  // Answered 200 so Stripe stops retrying events this function doesn't use.
  console.log(`[stripe-webhook] ignored unsupported event: ${type}`);
  return { ignored: true, type };
}

/* ---------- main ---------- */
export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST")   return respond(req, { error: "Method not allowed" }, 405);

    // ── 1. Read the raw body (the signature covers these exact bytes) ───────
    let raw: string;
    try {
      raw = await req.text();
    } catch (e) {
      console.error("[stripe-webhook] failed to read body:", e);
      return respond(req, { error: "Failed to read request body" }, 400);
    }

    // ── 2. Verify Stripe signature ────────────────────────────────────────────
    //    Unsigned, wrongly signed, malformed or stale → 400, before anything runs.
    if (!WEBHOOK_SECRET) {
      console.error("[stripe-webhook] no signing secret: set STRIPE_WEBHOOK_SECRET_SUPABASE");
      return respond(req, { error: "Webhook secret not configured" }, 500);
    }
    const sig = req.headers.get("stripe-signature");
    let valid: boolean;
    try {
      valid = await verifyStripeSignature(raw, sig, WEBHOOK_SECRET);
    } catch (e) {
      console.error("[stripe-webhook] signature verification threw:", e);
      return respond(req, { error: "Signature verification error" }, 400);
    }
    if (!valid) return respond(req, { error: "Invalid signature" }, 400);

    // ── 3. Parse event ────────────────────────────────────────────────────────
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      return respond(req, { error: "Invalid JSON payload" }, 400);
    }

    const type: string = event?.type ?? "";
    const eventId: string = event?.id ?? "";
    if (!type || !eventId) return respond(req, { error: "Event without id or type" }, 400);
    const obj: any = event?.data?.object ?? {};

    console.log(`[stripe-webhook] received ${type} id=${eventId}`);

    // ── 4. Deduplication ──────────────────────────────────────────────────────
    if (await alreadyProcessed(eventId)) {
      console.log(`[stripe-webhook] deduped ${type} id=${eventId}`);
      return respond(req, { ok: true, deduped: true });
    }

    // ── 5. Handle, then record ────────────────────────────────────────────────
    //    The event is recorded as processed only after the handler succeeded.
    //    Any failure answers 500 with nothing recorded, so Stripe's retry runs
    //    the handler again.
    try {
      const body = await handleEvent(type, eventId, obj);
      await markProcessed(eventId);
      return respond(req, body);
    } catch (e) {
      console.error(`[stripe-webhook] error handling ${type} id=${eventId}:`,
        e instanceof Error ? e.message : String(e));
      return respond(req, { error: "internal error" }, 500);
    }
  },
};
