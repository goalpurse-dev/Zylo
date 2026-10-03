// $0, READ-ONLY (GET only): does anything in Stripe state plan credits, and
// does it say 750 / 1,600 / 3,200? Reads the six current plan prices with
// their products: price metadata/nickname, product name, description,
// metadata and marketing features. Never prints the key.
//   node --env-file=.env.local scripts/stripePlanCreditsCheck.mjs
import { PLAN_PRICE_IDS, PLAN_CREDITS } from "../supabase/functions/_shared/stripePlanPrices.js";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
console.log("mode:", key.startsWith("sk_live") || key.startsWith("rk_live") ? "live" : "test");
const get = async (path) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(`stripe ${res.status}: ${body?.error?.message}`);
  return body;
};
for (const [plan, ids] of Object.entries(PLAN_PRICE_IDS)) {
  for (const [interval, id] of Object.entries(ids)) {
    const price = await get(`prices/${id}?expand[]=product`);
    const product = price.product;
    const text = JSON.stringify({ nickname: price.nickname, priceMeta: price.metadata, name: product.name, description: product.description, productMeta: product.metadata, features: (product.marketing_features ?? []).map((f) => f.name) });
    const numbers = [...text.matchAll(/\b\d[\d,.]{2,}\b/g)].map((m) => Number(m[0].replace(/[,.]/g, ""))).filter((n) => n >= 500 && n <= 5000);
    const wrong = numbers.filter((n) => n !== PLAN_CREDITS[plan]);
    console.log(`${plan} ${interval}: ${price.unit_amount / 100} ${price.currency} active=${price.active} | ${text.slice(0, 420)} | credit-like numbers: ${numbers.join(",") || "none"}${wrong.length ? `  <-- not ${PLAN_CREDITS[plan]}` : ""}`);
  }
}
