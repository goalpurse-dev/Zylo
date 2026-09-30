// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const TOPUP_PACK_MAP: Record<string, string> = {
  mini: "price_1TGKjDHtn4q5rInczlym0Dcz",
  standard: "price_1SpZczHtn4q5rInctZoF9rJV",
  max: "price_1TGKjxHtn4q5rIncQzzCGyrR",
};

/** Mirrors the plan side of stripe-webhook/index.ts's PRICE_MAP -- keep in
 *  sync if pricing changes. Used only to label abandoned_checkouts rows for
 *  recovery emails/analytics; never used for billing/credit decisions. */
const PLAN_PRICE_MAP: Record<string, { plan: string; interval?: "yearly" }> = {
  "price_1TmVZZHtn4q5rIncOuf5aKP4": { plan: "starter" },
  "price_1TmVfXHtn4q5rInc9IaN1l3U": { plan: "pro" },
  "price_1TmVg2Htn4q5rIncWL0b3HJr": { plan: "generative" },
  "price_1TmVhxHtn4q5rIncS8sxm6UR": { plan: "starter",    interval: "yearly" },
  "price_1TmVjnHtn4q5rInccPDBIVaX": { plan: "pro",        interval: "yearly" },
  "price_1TmVlUHtn4q5rIncbtWbGyof": { plan: "generative", interval: "yearly" },
  "price_1TGKT6Htn4q5rIncI47V5Ein": { plan: "starter" },
  "price_1TGKSqHtn4q5rIncIf8RPa6e": { plan: "pro" },
  "price_1TGKSSHtn4q5rIncSTurqkCN": { plan: "generative" },
  "price_1T8gM3Htn4q5rInchn8CMEcO": { plan: "starter" },
  "price_1T8gMVHtn4q5rIncWwcUi9mG": { plan: "pro" },
  "price_1T8gMsHtn4q5rIncW0vy8d57": { plan: "generative" },
  "price_1TYWNYHtn4q5rIncWMa3mmvI": { plan: "starter",    interval: "yearly" },
  "price_1TYWOWHtn4q5rIncTmN3GXdy": { plan: "pro",        interval: "yearly" },
  "price_1TYWP8Htn4q5rIncbugChVhS": { plan: "generative", interval: "yearly" },
};

async function stripePost(path: string, body: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json?.error?.message || "Stripe error");
    (err as any).status = res.status;
    (err as any).details = json;
    throw err;
  }
  return json;
}

/* ---------- main ---------- */
export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

    try {
      if (!STRIPE_SECRET) return json(req, { error: "Stripe key missing" }, 500);

     const {
  type,
  priceId,
  pack,
  successUrl,
  cancelUrl,
  customer,
  userId: bodyUserId,
  email: bodyEmail
} = await req.json();

     let finalPriceId = priceId;

if (type === "topup") {
  finalPriceId = TOPUP_PACK_MAP[pack];
}

if (type === "topup" && !TOPUP_PACK_MAP[pack]) {
  return json(req, { error: "Invalid pack" }, 400);
}

if (!finalPriceId || !successUrl || !cancelUrl || !type) {
  return json(req, { error: "Missing required params" }, 400);
}

      // get current user from the Authorization header sent by your frontend
      const authHeader = req.headers.get("Authorization") || "";
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
 const {
  data: { user },
} = await sb.auth.getUser();

/* 🔒 Prevent checkout if not logged in */
if (!user?.id) {
  return json(req, { error: "User must be logged in to purchase." }, 401);
}

      // fetch email from profiles if missing
      let email = user?.email ?? bodyEmail ?? "";
      let stripeCustomerId = customer || "";
      if (!email && user?.id) {
        const { data: prof } = await sb
          .from("profiles")
          .select("email, stripe_customer_id")
          .eq("id", user.id)
          .single();
        email = prof?.email ?? "";
        stripeCustomerId = stripeCustomerId || prof?.stripe_customer_id || "";
      } else if (user?.id) {
        const { data: prof } = await sb
          .from("profiles")
          .select("stripe_customer_id")
          .eq("id", user.id)
          .single();
        stripeCustomerId = stripeCustomerId || prof?.stripe_customer_id || "";
      }

      if (!stripeCustomerId && user?.id) {
        const customerBody = new URLSearchParams();
        if (email) customerBody.set("email", email);
        customerBody.set("metadata[supabase_user_id]", user.id);
        const createdCustomer = await stripePost("/v1/customers", customerBody);
        stripeCustomerId = createdCustomer.id;

        await sbAdmin
          .from("profiles")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", user.id);
      }

      const isSubscription = type === "subscription";
      const isTopup = type === "topup"; // one-time payment

      // Build Checkout Session request
    const body = new URLSearchParams({
  success_url: successUrl,
  cancel_url: cancelUrl,
  mode: isSubscription ? "subscription" : "payment",
  "line_items[0][price]": finalPriceId,
  "line_items[0][quantity]": "1",
  allow_promotion_codes: "true",
  // Automatic tax is off: not VAT-registered yet (turnover under the Finnish
  // EUR 20,000 limit), so no VAT is charged and checkout doesn't ask for an address.
  // Turn back on after VAT registration.
  // "automatic_tax[enabled]": "true",
  "customer_update[address]": "auto"
});

      // Attach identity & helpful metadata for webhook fulfillment
      const userId = user?.id ?? bodyUserId ?? "";
      if (userId) {
        body.set("client_reference_id", userId);
        body.set("metadata[user_id]", userId);
      }
      if (email && !stripeCustomerId) {
        body.set("customer_email", email);
        body.set("metadata[email]", email);
      }
      if (email) body.set("metadata[email]", email);
      // tag kind so webhook can branch
      body.set("metadata[kind]", isTopup ? "topup" : "subscription");

      // Also tag the created PaymentIntent (for mode=payment)
      if (!isSubscription) {
        if (userId) body.set("payment_intent_data[metadata][user_id]", userId);
        if (email) body.set("payment_intent_data[metadata][email]", email);
        body.set("payment_intent_data[metadata][kind]", "topup");
      }

      if (isSubscription) {
        if (userId) body.set("subscription_data[metadata][user_id]", userId);
        if (email) body.set("subscription_data[metadata][email]", email);
        body.set("subscription_data[metadata][kind]", "subscription");
      }

      // Optional: pass a known Stripe customer if you store it
      if (stripeCustomerId) body.set("customer", stripeCustomerId);

      // Lets Stripe generate a post-expiry recovery link (used by the
      // recovery-email sender's Email 3 CTA once a session has expired).
      // Not yet verified in Stripe test mode against every mode/config
      // combination -- see the retry-without-it fallback below, which
      // guarantees this can never break checkout creation itself.
      body.set("after_expiration[recovery][enabled]", "true");

      async function postCheckoutSession(b: URLSearchParams) {
        const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: b,
        });
        const j: any = await res.json();
        return { res, j };
      }

      let { res: stripeRes, j: stripeJson } = await postCheckoutSession(body);

      if (!stripeRes.ok && String(stripeJson?.error?.param || "").startsWith("after_expiration")) {
        console.error(
          "[create-checkout-session] after_expiration.recovery rejected by Stripe, retrying without it:",
          stripeJson?.error?.message,
        );
        const retryBody = new URLSearchParams(body);
        retryBody.delete("after_expiration[recovery][enabled]");
        ({ res: stripeRes, j: stripeJson } = await postCheckoutSession(retryBody));
      }

      if (!stripeRes.ok) {
        const msg = stripeJson?.error?.message || "Stripe error";
        return json(req, { error: msg, details: stripeJson }, stripeRes.status);
      }

      // ── Phase 2/3: server-side abandoned-checkout tracking ─────────────────
      // Source of truth for recovery tracking as of this rebuild. Must NEVER
      // block or fail the actual checkout -- Stripe already succeeded above,
      // so the caller gets their URL regardless of what happens in here.
      try {
        const planInfo = isSubscription ? PLAN_PRICE_MAP[finalPriceId] : undefined;
        const nowIso = new Date().toISOString();

        const { data: newRow, error: insertErr } = await sbAdmin
          .from("abandoned_checkouts")
          .insert({
            user_id: userId || null,
            email,
            stripe_customer_id: stripeCustomerId || null,
            stripe_session_id: stripeJson.id,
            checkout_url: stripeJson.url,
            purchase_type: isTopup ? "topup" : "subscription",
            plan_code: planInfo?.plan ?? null,
            pack: isTopup ? pack : null,
            billing_interval: planInfo?.interval ?? (isSubscription ? "monthly" : null),
            price_id: finalPriceId,
            amount: stripeJson.amount_total ?? null,
            currency: stripeJson.currency ?? null,
            expires_at: stripeJson.expires_at
              ? new Date(stripeJson.expires_at * 1000).toISOString()
              : null,
            status: "pending",
            paid: false,
            recovered: false,
            recovery_stage: 0,
            recovery_system_version: "v2",
            updated_at: nowIso,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error(
            "[create-checkout-session] abandoned_checkouts insert failed (non-fatal):",
            insertErr.message,
          );
        } else if (newRow?.id) {
          const { error: eventErr } = await sbAdmin.from("abandoned_checkout_events").insert({
            checkout_id: newRow.id,
            event_type: "checkout_started",
            amount: stripeJson.amount_total ?? null,
            currency: stripeJson.currency ?? null,
          });
          if (eventErr) {
            console.error(
              "[create-checkout-session] checkout_started event insert failed (non-fatal):",
              eventErr.message,
            );
          }

          // Phase 3: supersede this user's older unpaid v2 rows -- the
          // newest session owns the active recovery sequence. Never touches
          // converted/paid rows, and never touches legacy (v1) rows.
          if (userId) {
            const { error: supersedeErr } = await sbAdmin
              .from("abandoned_checkouts")
              .update({ status: "superseded", updated_at: nowIso })
              .eq("user_id", userId)
              .eq("recovery_system_version", "v2")
              .neq("id", newRow.id)
              .eq("paid", false)
              .in("status", ["pending", "in_sequence", "expired"]);
            if (supersedeErr) {
              console.error(
                "[create-checkout-session] supersede update failed (non-fatal):",
                supersedeErr.message,
              );
            }
          }
        }
      } catch (trackingErr) {
        console.error(
          "[create-checkout-session] abandoned-checkout tracking threw (non-fatal):",
          trackingErr,
        );
      }

      return json(req, { url: stripeJson.url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(req, { error: `Failed to create session: ${msg}` }, 500);
    }
  },
};
