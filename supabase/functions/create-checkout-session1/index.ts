// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ??
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...cors(req), "content-type": "application/json" },
      });
    }

    const body = await req.json();
    const { type, priceId, successUrl, cancelUrl } = body as {
      type: "subscription" | "topup";
      priceId: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    // Look up or create Stripe customer and save to profiles.stripe_customer_id
    let stripeCustomerId: string | undefined;
    {
      const { data: prof } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();

      stripeCustomerId = prof?.stripe_customer_id ?? undefined;
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      stripeCustomerId = customer.id;
      await supabase.from("profiles")
        .update({ stripe_customer_id: customer.id })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: type === "topup" ? "payment" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl ?? `${new URL(req.url).origin}/billing?state=success`,
      cancel_url:  cancelUrl  ?? `${new URL(req.url).origin}/billing?state=cancelled`,
      metadata: {
        user_id: user.id,
        intent: type, // "topup" | "subscription"
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors(req), "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("create-checkout-session1 error", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Unknown error" }),
      { status: 400, headers: { ...cors(req), "content-type": "application/json" } },
    );
  }
});
