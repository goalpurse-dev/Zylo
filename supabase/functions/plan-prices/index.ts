// plan-prices — the live subscription and top-up prices for the pricing page,
// read from Stripe and cached (10 min in this isolate + a public HTTP cache
// header). Read-only: no user data, no writes. Anyone with the anon key (every
// visitor) may call it.
//
// POST {} (or GET) → { currency, vatIncluded, plans: { starter: { monthly, yearly, credits }, ... },
//                     topups: { mini: { price, credits }, ... }, fetchedAt }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors } from "../shared/cors.ts";
import { PLAN_PRICE_IDS, TOPUP_PRICE_IDS, summarizeStripePrices } from "../_shared/stripePlanPrices.js";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; body: unknown } | null = null;

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${STRIPE_SECRET}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`stripe ${res.status}: ${body?.error?.message ?? "error"}`);
  return body;
}

async function load() {
  const ids = [...Object.values(PLAN_PRICE_IDS).flatMap((p) => [p.monthly, p.yearly]), ...Object.values(TOPUP_PRICE_IDS)];
  const [prices, settings] = await Promise.all([
    Promise.all(ids.map((id) => stripeGet(`prices/${id}`))),
    stripeGet("tax/settings").catch(() => null),
  ]);
  const byId = Object.fromEntries(prices.map((p: any) => [p.id, p]));
  return { ...summarizeStripePrices(byId, settings?.defaults?.tax_behavior ?? null), fetchedAt: new Date().toISOString() };
}

function reply(req: Request, body: unknown, status = 200) {
  const headers = cors(req);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  if (status === 200) headers.set("cache-control", "public, max-age=600");
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (!STRIPE_SECRET) return reply(req, { error: "PRICES_UNAVAILABLE" }, 503);
  try {
    if (!cached || Date.now() - cached.at > TTL_MS) cached = { at: Date.now(), body: await load() };
    return reply(req, cached.body);
  } catch (e) {
    console.error("[plan-prices]", e instanceof Error ? e.message : e);
    // A stale copy beats no prices when Stripe hiccups.
    if (cached) return reply(req, cached.body);
    return reply(req, { error: "PRICES_UNAVAILABLE" }, 503);
  }
});
