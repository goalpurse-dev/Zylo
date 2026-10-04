// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { allowedReturnUrl, appOriginFor, originOf } from "../_shared/appOrigins.js";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_PORTAL_CONFIGURATION_ID =
  "bpc_1Spa1lHtn4q5rIncTIFJqWHF";
// Optional extra origin the portal may return to (besides tryzyvo.com and localhost).
const EXTRA_ORIGINS = [originOf(Deno.env.get("APP_ORIGIN") ?? "")].filter(Boolean) as string[];

// Where the portal may send the customer back to (returnPath from the app).
const RETURN_PATHS = ["/settings", "/pricing", "/"];
const DEFAULT_RETURN_PATH = "/settings";

/** flow (from the app) → the portal screen to open. Anything else opens the portal home,
 *  which lists the plan, the payment methods and the invoice history. */
const FLOW_TYPES: Record<string, "subscription_update" | "payment_method_update"> = {
  change_plan: "subscription_update",
  payment_method: "payment_method_update",
  update: "payment_method_update", // older app builds send "update" from the card buttons
};

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

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: cors(req) });
    }

    if (req.method !== "POST") {
      return send(req, { error: "Method not allowed" }, 405);
    }

    try {
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

      const { flow, returnPath } = await req.json().catch(() => ({}));

      // Back to our own site only, and only to a known page.
      const origin = appOriginFor(req.headers.get("Origin") || "", EXTRA_ORIGINS);
      const returnUrl = allowedReturnUrl(returnPath, origin, RETURN_PATHS, DEFAULT_RETURN_PATH);

      const subId = prof?.stripe_subscription_id;
      const base = new URLSearchParams();

      base.set("customer", customerId);
      base.set("return_url", returnUrl);
      base.set("configuration", STRIPE_PORTAL_CONFIGURATION_ID);

      // Open the screen the button asked for. If Stripe refuses the deep link
      // (plan changes need a live subscription and products in the portal
      // configuration), the portal home still opens.
      const flowType = FLOW_TYPES[String(flow ?? "")];
      if (flowType === "payment_method_update" || (flowType === "subscription_update" && subId)) {
        const form = new URLSearchParams(base);
        form.set("flow_data[type]", flowType);
        if (flowType === "subscription_update") {
          form.set("flow_data[subscription_update][subscription]", subId);
        }

        try {
          const session = await stripePost("/v1/billing_portal/sessions", form);
          return send(req, { url: session.url });
        } catch (e: any) {
          console.warn(`[create-portal-session] ${flowType} deep link refused, opening the portal home:`, e?.message);
        }
      }

      const session = await stripePost("/v1/billing_portal/sessions", base);

      return send(req, { url: session.url });

    } catch (e: any) {
      console.error("[create-portal-session] failed:", e?.message, JSON.stringify(e?._stripe?.error ?? null));
      return send(req, { error: e.message }, e._status || 500);
    }
  },
};
