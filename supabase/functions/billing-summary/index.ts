// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ||
      "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "access-control-max-age": "86400",
    "content-type": "application/json",
    vary: "Origin, Access-Control-Request-Headers",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

function toParams(qs?: Record<string, string | number | string[]>) {
  const p = new URLSearchParams();
  if (!qs) return p;
  for (const [k, v] of Object.entries(qs)) {
    if (Array.isArray(v)) v.forEach((vv) => p.append(k, String(vv)));
    else p.set(k, String(v));
  }
  return p;
}

async function stripeGet(path: string, qs?: Record<string, any>) {
  const url = new URL(`https://api.stripe.com${path}`);
  const params = toParams(qs);
  if ([...params.keys()].length) url.search = params.toString();

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
  });
  const js = await r.json();
  if (!r.ok) {
    const err: any = new Error(js?.error?.message || `Stripe GET ${path} failed`);
    err._stripe = js;
    err._status = r.status;
    throw err;
  }
  return js;
}

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST")   return json(req, { error: "Method not allowed" }, 405);

    try {
      const auth = req.headers.get("Authorization") || "";
      const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { Authorization: auth } },
      });

      const { data: { user } } = await sbUser.auth.getUser();
      if (!user?.id) return json(req, { error: "Not authenticated" }, 401);

      const { data: prof, error } = await sbUser
        .from("profiles")
        .select("stripe_customer_id, stripe_subscription_id")
        .eq("id", user.id)
        .single();
      if (error) return json(req, { error: error.message }, 400);

      if (!prof?.stripe_customer_id) {
        return json(req, { plan: null, payment_method: null, invoices: [] });
      }

      const customerId = prof.stripe_customer_id as string;

      // Customer + default payment method
      const customer = await stripeGet(`/v1/customers/${customerId}`, {
        "expand[]": ["invoice_settings.default_payment_method"],
      });

      let payment_method: any = null;
      const dpm = customer?.invoice_settings?.default_payment_method;
      if (dpm && typeof dpm === "object") {
        payment_method = {
          brand: dpm.card?.brand || "Card",
          last4: dpm.card?.last4 || "",
          exp: dpm.card
            ? `${String(dpm.card.exp_month).padStart(2, "0")}/${String(dpm.card.exp_year).slice(-2)}`
            : "",
        };
      }

      // Subscription (if any)
      let plan: any = null;
      if (prof.stripe_subscription_id) {
        const sub = await stripeGet(`/v1/subscriptions/${prof.stripe_subscription_id}`);
        const item  = sub?.items?.data?.[0];
        const price = item?.price;

        if (price) {
          plan = {
            nickname: price.nickname || item?.plan?.nickname || "Plan",
            amount: price.unit_amount || 0,
            interval: price.recurring?.interval || item?.plan?.interval || "month",
            price_id: price.id,
            // >>> fields your UI needs <<<
            status: sub.status,                                     // 'active', 'canceled', etc.
            cancel_at_period_end: Boolean(sub.cancel_at_period_end),// true if scheduled to cancel
            current_period_end: sub.current_period_end || null,     // unix seconds
          };
        }
      }

      // Invoices (latest 10)
      const invs = await stripeGet("/v1/invoices", { customer: customerId, limit: 10 });
      const invoices = (invs?.data || []).map((i: any) => ({
        id: i.id,
        amount_paid: i.amount_paid,
        status: i.status,
        created: i.created,
        url: i.hosted_invoice_url || i.invoice_pdf || null,
      }));

      return json(req, { plan, payment_method, invoices });
    } catch (e: any) {
      return json(req, { error: e?.message || String(e), raw: e?._stripe ?? null }, e?._status || 500);
    }
  },
};
