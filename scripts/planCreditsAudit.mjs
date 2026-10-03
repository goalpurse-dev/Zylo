// $0, READ-ONLY: what do subscribers actually receive each month?
// Plan grants (credit_grants reason plan_renewal, and the yearly monthly top-up
// amount on profiles) against the plan promise 750 / 1,600 / 3,200. Prints
// counts only, plus user ids (no emails) for anyone on a different amount.
//   node --env-file=.env.local scripts/planCreditsAudit.mjs
import { createClient } from "@supabase/supabase-js";
import { PLAN_CREDITS, EARLY_PLAN_CREDITS, NEW_GRANT_CUTOFF } from "../supabase/functions/_shared/stripePlanPrices.js";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = async (build) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) return out;
  }
};
const paid = await all(() => admin.from("profiles").select("id, plan_code, billing_interval, annual_credits_per_month, stripe_subscription_status, cancel_at_period_end, current_period_end").in("plan_code", ["starter", "pro", "generative"]).order("id"));
const grants = await all(() => admin.from("credit_grants").select("user_id, amount, reason, created_at, external_id").eq("reason", "plan_renewal").order("created_at"));
const last = new Map();
for (const g of grants) last.set(g.user_id, g);
const tally = (rows, key) => rows.reduce((m, r) => { const k = key(r); m[k] = (m[k] ?? 0) + 1; return m; }, {});
const label = (plan, amount) => amount === PLAN_CREDITS[plan] ? "current" : amount === EARLY_PLAN_CREDITS[plan] ? "early (900/1,900/3,900)" : [600, 1200, 2500].includes(amount) ? "legacy (600/1,200/2,500)" : `other`;

console.log("promise", PLAN_CREDITS, "| cutoff", NEW_GRANT_CUTOFF);
console.log("paid profiles:", paid.length, tally(paid, (p) => `${p.plan_code}/${p.billing_interval ?? "?"}/${p.stripe_subscription_status ?? "?"}`));
const active = paid.filter((p) => ["active", "paid", "trialing", "past_due"].includes(p.stripe_subscription_status ?? ""));
const rows = active.map((p) => {
  const g = last.get(p.id);
  const amount = p.billing_interval === "yearly" && p.annual_credits_per_month ? p.annual_credits_per_month : g?.amount ?? null;
  return { id: p.id, plan: p.plan_code, interval: p.billing_interval, amount, lastGrantAt: g?.created_at ?? null, kind: amount == null ? "no grant on record" : label(p.plan_code, amount), cancelling: p.cancel_at_period_end };
});
console.log("active subscribers by monthly amount:", tally(rows, (r) => `${r.plan} ${r.amount} [${r.kind}]`));
const afterCutoff = grants.filter((g) => Date.parse(g.created_at) >= Date.parse(NEW_GRANT_CUTOFF));
console.log("plan grants since the cutoff:", afterCutoff.length, tally(afterCutoff, (g) => String(g.amount)));
const different = rows.filter((r) => r.kind !== "current");
console.log("active subscribers NOT on 750 / 1,600 / 3,200:", different.length);
for (const r of different) console.log(` ${r.id} ${r.plan} ${r.interval ?? "?"} ${r.amount ?? "-"} ${r.kind} last ${r.lastGrantAt?.slice(0, 10) ?? "-"}${r.cancelling ? " (cancelling)" : ""}`);
