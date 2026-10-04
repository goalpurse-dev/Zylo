// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PLAN_PRICE_IDS, TOPUP_PRICE_IDS } from "../_shared/stripePlanPrices.js";
import { allowedAppUrl, appOriginFor, originOf, withCheckoutSessionId } from "../_shared/appOrigins.js";

/* ---------- CORS helpers ---------- */
function cors(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ||
      "authorization, x-client-info, apikey, content-type",
    "content-type": "application/json",
    vary: "Origin",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

/* ---------- ENV ---------- */
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Optional extra origin Stripe may return to (besides tryzyvo.com and localhost).
const EXTRA_ORIGINS = [originOf(Deno.env.get("APP_ORIGIN") ?? "")].filter(Boolean) as string[];

/** The plan prices checkout sells: today's six (monthly + yearly). Legacy prices
 *  stay in PLAN_PRICE_MAP for existing subscribers and are not sold here. */
const PLAN_PRICES_ON_SALE = new Set(Object.values(PLAN_PRICE_IDS as Record<string, { monthly: string; yearly: string }>).flatMap((p) => [p.monthly, p.yearly]));
const TOPUP_PACKS: Record<string, string> = TOPUP_PRICE_IDS;

/** A subscription in one of these states already pays (or owes) for a plan: a second one would double-bill. */
const LIVE_SUBSCRIPTION = new Set(["active", "trialing", "past_due"]);

async function stripe(method: "GET" | "POST", path: string, body?: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const data: any = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

/** Stripe's answer when the stored customer id no longer exists (deleted, or from test mode). */
function isMissingCustomer(data: any) {
  const err = data?.error;
  return err?.code === "resource_missing" && (err?.param === "customer" || /no such customer/i.test(String(err?.message ?? "")));
}

/* ---------- main ---------- */
export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

    try {
      if (!STRIPE_SECRET) return json(req, { error: "Stripe key missing" }, 500);

      // Only these fields are read. A customer id, user id or email sent by the
      // browser is ignored: identity comes from the signed-in user alone.
      const { type, priceId, pack, successUrl, cancelUrl } = await req.json().catch(() => ({}));

      const isSubscription = type === "subscription";
      const isTopup = type === "topup"; // one-time payment
      if (!isSubscription && !isTopup) return json(req, { error: "Missing required params" }, 400);

      let finalPriceId: string;
      if (isTopup) {
        finalPriceId = TOPUP_PACKS[pack];
        if (!finalPriceId) return json(req, { error: "Invalid pack" }, 400);
      } else {
        if (!PLAN_PRICES_ON_SALE.has(priceId)) return json(req, { error: "Invalid plan", code: "INVALID_PLAN" }, 400);
        finalPriceId = priceId;
      }

      // get current user from the Authorization header sent by your frontend
      const authHeader = req.headers.get("Authorization") || "";
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: { user } } = await sb.auth.getUser();

      /* 🔒 Prevent checkout if not logged in */
      if (!user?.id) {
        return json(req, { error: "User must be logged in to purchase.", code: "NOT_SIGNED_IN" }, 401);
      }

      const { data: prof, error: profErr } = await sbAdmin
        .from("profiles")
        .select("email, stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profErr || !prof) {
        // No profile row = the webhook could not give this user what they pay for.
        console.error("[create-checkout-session] profile lookup failed:", user.id, profErr?.message ?? "no profile row");
        return json(req, { error: "Your account isn't ready yet. Please try again in a moment.", code: "PROFILE_UNAVAILABLE" }, 500);
      }

      const email = user.email ?? prof.email ?? "";
      let stripeCustomerId: string = prof.stripe_customer_id || "";
      let customerIsNew = false;

      /** A new Stripe customer for this user, saved on the profile. */
      const createCustomer = async () => {
        const customerBody = new URLSearchParams();
        if (email) customerBody.set("email", email);
        customerBody.set("metadata[supabase_user_id]", user.id);
        const created = await stripe("POST", "/v1/customers", customerBody);
        if (!created.ok) throw new Error(created.data?.error?.message || "could not create the Stripe customer");
        const { error: saveErr } = await sbAdmin
          .from("profiles")
          .update({ stripe_customer_id: created.data.id })
          .eq("id", user.id);
        if (saveErr) throw new Error(`could not save the Stripe customer: ${saveErr.message}`);
        stripeCustomerId = created.data.id;
        customerIsNew = true;
      };

      if (!stripeCustomerId) await createCustomer();

      // One subscription per user: someone who already has one changes it in the
      // billing portal. Asked from Stripe, not the profile, so it is never stale.
      if (isSubscription && !customerIsNew) {
        const subs = await stripe("GET", `/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&limit=20`);
        if (subs.ok) {
          const live = (subs.data?.data ?? []).find((s: any) => LIVE_SUBSCRIPTION.has(s?.status));
          if (live) {
            return json(req, {
              error: "You already have an active subscription. You can change it in billing.",
              code: "ALREADY_SUBSCRIBED",
            }, 409);
          }
        } else if (isMissingCustomer(subs.data)) {
          console.warn("[create-checkout-session] stored customer is gone in Stripe, creating a new one:", stripeCustomerId, "user", user.id);
          await createCustomer();
        } else {
          // Not worth blocking a purchase over: the webhook copes with a second subscription.
          console.error("[create-checkout-session] subscription check failed:", subs.data?.error?.message);
        }
      }

      // Stripe may only send the customer back to our own site. Anything else
      // falls back to the standard pages on the caller's (or the main) origin.
      const appOrigin = appOriginFor(req.headers.get("Origin") || "", EXTRA_ORIGINS);
      const finalSuccessUrl = withCheckoutSessionId(allowedAppUrl(successUrl, EXTRA_ORIGINS) ?? `${appOrigin}/billing/success`);
      const finalCancelUrl = allowedAppUrl(cancelUrl, EXTRA_ORIGINS) ?? `${appOrigin}/billing/cancel`;

      // Build Checkout Session request
      const body = new URLSearchParams({
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        mode: isSubscription ? "subscription" : "payment",
        "line_items[0][price]": finalPriceId,
        "line_items[0][quantity]": "1",
        allow_promotion_codes: "true",
        // Automatic tax is off: not VAT-registered yet (turnover under the Finnish
        // EUR 20,000 limit), so no VAT is charged and checkout doesn't ask for an address.
        // Turn back on after VAT registration.
        // "automatic_tax[enabled]": "true",
        "customer_update[address]": "auto",
        customer: stripeCustomerId,
      });

      // Attach identity & helpful metadata for webhook fulfillment
      const userId = user.id;
      body.set("client_reference_id", userId);
      body.set("metadata[user_id]", userId);
      if (email) body.set("metadata[email]", email);
      // tag kind so webhook can branch
      body.set("metadata[kind]", isTopup ? "topup" : "subscription");

      // Also tag the created PaymentIntent (for mode=payment)
      if (!isSubscription) {
        body.set("payment_intent_data[metadata][user_id]", userId);
        if (email) body.set("payment_intent_data[metadata][email]", email);
        body.set("payment_intent_data[metadata][kind]", "topup");
      }

      if (isSubscription) {
        body.set("subscription_data[metadata][user_id]", userId);
        if (email) body.set("subscription_data[metadata][email]", email);
        body.set("subscription_data[metadata][kind]", "subscription");
      }

      let session = await stripe("POST", "/v1/checkout/sessions", body);

      // "No such customer": the stored id is dead. Make a new customer and try once more.
      if (!session.ok && isMissingCustomer(session.data) && !customerIsNew) {
        console.warn("[create-checkout-session] stored customer is gone in Stripe, creating a new one:", stripeCustomerId, "user", user.id);
        await createCustomer();
        body.set("customer", stripeCustomerId);
        session = await stripe("POST", "/v1/checkout/sessions", body);
      }

      if (!session.ok) {
        console.error("[create-checkout-session] Stripe refused the session:", session.status, JSON.stringify(session.data?.error ?? null), "user", user.id);
        return json(req, { error: session.data?.error?.message || "Stripe error", code: "STRIPE_ERROR" }, session.status);
      }

      return json(req, { url: session.data.url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[create-checkout-session] failed:", msg);
      return json(req, { error: `Failed to create session: ${msg}` }, 500);
    }
  },
};
