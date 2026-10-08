// Blocky Stories: what a 30-second story costs us and earns, per tier, and how many each plan buys, for the
// prices before the new clip lineup, the prices charged today, and two proposed options. Reads our costs from
// pricing.js and the plans from the site's own price endpoint (Stripe, live). Changes nothing; calls no model.
//   node scripts/blocky/priceOptions.mjs
import { SUPABASE_URL, anonKey } from "./lib.mjs";
import { CLIP_MODELS, PICTURE, SCRIPT, TIERS, TIER_IDS, tierModel } from "../../supabase/functions/_shared/blocky/pricing.js";

const EUR_PER_USD = Number(process.env.EUR_PER_USD || 0.92);   // an assumption, not a live rate
const SECONDS = 30, SCENES = 6;
// Per story, besides the script, the pictures and the clips: 6 picture checks, 6 clip checks (speech-to-text,
// two frames), the final render, the upload text. Remade pictures and clips are NOT in here.
const OTHER_USD = 0.05;

const res = await fetch(`${SUPABASE_URL}/functions/v1/plan-prices`, { method: "POST", headers: { apikey: anonKey(), Authorization: `Bearer ${anonKey()}`, "Content-Type": "application/json" }, body: "{}" });
const { plans } = await res.json();
const PLAN_OF = { v2: "starter", v3: "pro", v4: "generative" };
const PLAN_TIERS = { starter: ["v2"], pro: ["v2", "v3"], generative: ["v2", "v3", "v4"] };
const eurPerCredit = (plan) => plans[plan].monthly / plans[plan].credits;

const costNow = (id, perSec = tierModel(id).costPerSec) => SCRIPT.costUsd + SCENES * PICTURE.costUsd + SECONDS * perSec + OTHER_USD;
const SCENARIOS = [
  { key: "before", label: "Before (old models, old prices)", perSec: { v2: 5, v3: 9, v4: 16 }, script: 0, cost: { v2: 0.11 + SCENES * PICTURE.costUsd + SECONDS * 0.0504 + OTHER_USD, v3: 0.11 + SCENES * PICTURE.costUsd + SECONDS * 0.0817 + OTHER_USD, v4: 0.11 + SCENES * PICTURE.costUsd + SECONDS * 0.15 + OTHER_USD } },
  { key: "today", label: "New models at the old prices + script share", perSec: { v2: 5, v3: 9, v4: 16 }, script: SCRIPT.credits },
  // Option A is what the owner picked on 2026-10-08: it is read from pricing.js, so this row is always the live price.
  { key: "a", label: "Option A: keep a healthy margin (LIVE, from pricing.js)", perSec: Object.fromEntries(TIER_IDS.map((id) => [id, TIERS[id].creditsPerSec])), script: SCRIPT.credits },
  { key: "b", label: "Option B: more videos per plan", perSec: { v2: 3, v3: 6, v4: 15 }, script: SCRIPT.credits },
];
const eur = (n) => `€${n.toFixed(2)}`;
const usd = (n) => `$${n.toFixed(2)}`;
const out = { eurPerUsd: EUR_PER_USD, plans, scenarios: [] };
for (const s of SCENARIOS) {
  const tiers = {};
  for (const id of TIER_IDS) {
    const credits = SCENES * PICTURE.credits + s.script + SECONDS * s.perSec[id];
    const costUsd = s.cost?.[id] ?? costNow(id);
    const revenue = credits * eurPerCredit(PLAN_OF[id]);
    const cost = costUsd * EUR_PER_USD;
    tiers[id] = { perSec: s.perSec[id], credits, costUsd, costEur: cost, revenueEur: revenue, marginEur: revenue - cost, marginPct: Math.round(((revenue - cost) / revenue) * 100) };
  }
  const stories = Object.fromEntries(Object.keys(PLAN_TIERS).map((plan) => [plan, Object.fromEntries(PLAN_TIERS[plan].map((id) => [id, Math.floor(plans[plan].credits / tiers[id].credits)]))]));
  out.scenarios.push({ key: s.key, label: s.label, tiers, stories });
}
if (process.argv.includes("--json")) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }

console.log(`Plans (live): ${Object.entries(plans).map(([k, p]) => `${k} €${p.monthly} for ${p.credits} credits (${(eurPerCredit(k) * 100).toFixed(2)} c a credit)`).join("; ")}`);
console.log(`$1 = €${EUR_PER_USD} (assumed). A 30-second story: ${SCENES} pictures, ${SECONDS} seconds of clips, the script, about ${usd(OTHER_USD)} of checks and render.\n`);
for (const s of out.scenarios) {
  console.log(s.label);
  console.log("| Tier | Credits a second | Story price | Our cost | Worth (monthly plan) | Margin |");
  console.log("|---|---|---|---|---|---|");
  for (const id of TIER_IDS) { const t = s.tiers[id]; console.log(`| ${id.toUpperCase()} | ${t.perSec} | ${t.credits} credits | ${usd(t.costUsd)} = ${eur(t.costEur)} | ${eur(t.revenueEur)} | ${eur(t.marginEur)} (${t.marginPct}%) |`); }
  console.log("");
}
console.log("30-second stories a month");
console.log(`| Plan | Tier | ${out.scenarios.map((s) => s.key === "before" ? "Before" : s.key === "today" ? "Today" : s.key === "a" ? "Option A" : "Option B").join(" | ")} |`);
console.log("|---|---|---|---|---|---|");
for (const plan of Object.keys(PLAN_TIERS)) for (const id of PLAN_TIERS[plan]) console.log(`| ${plan} (€${plans[plan].monthly}, ${plans[plan].credits} credits) | ${id.toUpperCase()} | ${out.scenarios.map((s) => s.stories[plan][id]).join(" | ")} |`);
console.log(`\nV2 is ${CLIP_MODELS["grok-1.5-lite"].name} at ${CLIP_MODELS["grok-1.5-lite"].resolution}: $${CLIP_MODELS["grok-1.5-lite"].costPerSec} a second (at 480p it was $0.0217).`);
