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

/* ---------- main ---------- */
export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

    try {
      if (!STRIPE_SECRET) return json(req, { error: "Stripe key missing" }, 500);

      const { type, priceId, successUrl, cancelUrl, customer } = await req.json();

      if (!priceId || !successUrl || !cancelUrl || !type) {
        return json(req, { error: "Missing required params" }, 400);
      }

      // get current user from the Authorization header sent by your frontend
      const authHeader = req.headers.get("Authorization") || "";
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
      } = await sb.auth.getUser();

      // fetch email from profiles if missing
      let email = user?.email ?? "";
      if (!email && user?.id) {
        const { data: prof } = await sb
          .from("profiles")
          .select("email")
          .eq("id", user.id)
          .single();
        email = prof?.email ?? "";
      }

      const isSubscription = type === "subscription";
      const isTopup = type === "topup"; // one-time payment

      // Build Checkout Session request
      const body = new URLSearchParams({
        success_url: successUrl,
        cancel_url: cancelUrl,
        mode: isSubscription ? "subscription" : "payment",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        allow_promotion_codes: "true",
        "automatic_tax[enabled]": "true",
      });

      // Attach identity & helpful metadata for webhook fulfillment
      const userId = user?.id ?? "";
      if (userId) {
        body.set("client_reference_id", userId);
        body.set("metadata[user_id]", userId);
      }
      if (email) {
        body.set("customer_email", email);
        body.set("metadata[email]", email);
      }
      // tag kind so webhook can branch
      body.set("metadata[kind]", isTopup ? "topup" : "subscription");

      // Also tag the created PaymentIntent (for mode=payment)
      if (!isSubscription) {
        if (userId) body.set("payment_intent_data[metadata][user_id]", userId);
        if (email) body.set("payment_intent_data[metadata][email]", email);
        body.set("payment_intent_data[metadata][kind]", "topup");
      }

      // Optional: pass a known Stripe customer if you store it
      if (customer) body.set("customer", customer);

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body,
      });

      const stripeJson: any = await stripeRes.json();

      if (!stripeRes.ok) {
        const msg = stripeJson?.error?.message || "Stripe error";
        return json(req, { error: msg, details: stripeJson }, stripeRes.status);
      }

      return json(req, { url: stripeJson.url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(req, { error: `Failed to create session: ${msg}` }, 500);
    }
  },
};
