// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_PORTAL_CONFIGURATION_ID =
  Deno.env.get("STRIPE_PORTAL_CONFIGURATION_ID") ??
  "bpc_1SP5HjHtn4q5rIncIIBsA3c6";

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "*";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ??
      "authorization, x-client-info, apikey, content-type",
    vary: "Origin, Access-Control-Request-Headers",
    "content-type": "application/json",
  };
}

function send(req: Request, body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(req),
  });
}

async function stripePost(path: string, body: URLSearchParams) {
  const r = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const js = await r.json();
  if (!r.ok) {
    const err: any = new Error(js.error?.message || "Stripe error");
    err._stripe = js;
    err._status = r.status;
    throw err;
  }
  return js;
}

/**
 * 🔥 Force PRODUCT MODE in the stripe portal config
 */
async function enforceProductMode() {
  const form = new URLSearchParams();

  // enable subscription switching
  form.set("features[subscription_update][enabled]", "true");

  // PRODUCT MODE ON
  form.set("features[subscription_update][products][enabled]", "true");

  // PRICE MODE OFF
  form.set("features[subscription_update][prices][enabled]", "false");

  // proration
  form.set("features[subscription_update][proration_behavior]", "create_prorations");

  form.set("features[subscription_update][prices][intervals][]", "month");

  await fetch(
    `https://api.stripe.com/v1/billing_portal/configurations/${STRIPE_PORTAL_CONFIGURATION_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    }
  );
}

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: cors(req) });
    }

    if (req.method !== "POST") {
      return send(req, { error: "Method not allowed" }, 405);
    }

    try {
      // 🔥 ALWAYS enforce product mode before creating a session
      await enforceProductMode();

      const auth = req.headers.get("Authorization") || "";
      const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { Authorization: auth } },
      });
      const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

      const { data: { user } } = await sbUser.auth.getUser();
      if (!user?.id) return send(req, { error: "Not authenticated" }, 401);

      const { data: prof } = await sbUser
        .from("profiles")
        .select("stripe_customer_id, stripe_subscription_id, email")
        .eq("id", user.id)
        .single();

      let customerId = prof?.stripe_customer_id;

      // Create customer if missing
      if (!customerId) {
        const form = new URLSearchParams();
        form.set("email", user.email ?? prof?.email ?? "");
        form.set("metadata[supabase_user_id]", user.id);

        const customer = await stripePost("/v1/customers", form);
        customerId = customer.id;

        await sbAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", user.id);
      }

      const origin = req.headers.get("origin") ?? "https://zylo.ai";
      const returnUrl = new URL("/settings", origin);

      const subId = prof?.stripe_subscription_id;
      const base = new URLSearchParams();

      base.set("customer", customerId);
      base.set("return_url", returnUrl.toString());
      base.set("configuration", STRIPE_PORTAL_CONFIGURATION_ID);

      // Deep-link to subscription update if user already subscribed
      if (subId) {
        const form = new URLSearchParams(base);
        form.set("flow_data[type]", "subscription_update");
        form.set(
          "flow_data[subscription_update][subscription]",
          subId
        );

        try {
          const session = await stripePost("/v1/billing_portal/sessions", form);
          return send(req, { url: session.url });
        } catch {
          // fallback to home
        }
      }

      // No subscription → open main portal
      const home = new URLSearchParams(base);
      const session = await stripePost("/v1/billing_portal/sessions", home);

      return send(req, { url: session.url });

    } catch (e: any) {
      return send(
        req,
        { error: e.message, raw: e._stripe ?? null },
        e._status || 500
      );
    }
  },
};
