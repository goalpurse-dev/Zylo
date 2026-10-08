// Blocky Stories' prices against what things really cost us (owner, 2026-10-08: the user pays 2× our real
// cost at 1 credit = €0.024, no VAT). Everything is read from pricing.js (the prices, the costs, the basis)
// and the plans from the site's own price endpoint (Stripe, live). Changes nothing; calls no model.
//   node scripts/blocky/priceOptions.mjs
import { SUPABASE_URL, anonKey } from "./lib.mjs";
import { BASIS, PICTURE, SCRIPT, TIERS, TIER_IDS, creditsToEur, markupOf, priceCredits, realCostUsd, tierModel } from "../../supabase/functions/_shared/blocky/pricing.js";

const res = await fetch(`${SUPABASE_URL}/functions/v1/plan-prices`, { method: "POST", headers: { apikey: anonKey(), Authorization: `Bearer ${anonKey()}`, "Content-Type": "application/json" }, body: "{}" });
const { plans } = await res.json();
const PLAN_TIERS = { starter: ["v2"], pro: ["v2", "v3"], generative: ["v2", "v3", "v4"] };
// "Option A", live for a few hours on 2026-10-08, is the "before".
const BEFORE = { picture: 4, script: 15, perSec: { v2: 4, v3: 8, v4: 16 } };
const SECONDS = 30, SCENES = BASIS.scenesPer30s;
const eur = (n) => `€${n.toFixed(2)}`;
const usd = (n, d = 2) => `$${n.toFixed(d)}`;
const x = (n) => `${n.toFixed(2)}×`;
// The 30-second story as the settings step shows it: the script, six pictures, and 30 seconds of the tier's rate.
const storyNow = (id) => SCRIPT.credits + SCENES * PICTURE.credits + Math.ceil(TIERS[id].creditsPerSec * SECONDS - 1e-9);
const storyBefore = (id) => BEFORE.script + SCENES * BEFORE.picture + BEFORE.perSec[id] * SECONDS;
const costUsd = (id) => realCostUsd.story(id, SECONDS, SECONDS / SCENES);

console.log(`Basis: 1 credit = €${BASIS.eurPerCredit.toFixed(3)} (Starter, €18 for 750 credits, no VAT); $1 = €${BASIS.eurPerUsd}; the user pays ${BASIS.markup}× our real cost.\n`);
console.log("A 30-second story (the script, 6 pictures with their checks, 30 seconds of clips with their checks, the final render)");
console.log("| Tier | Model | Credits a second (before → now) | Story price (before → now) | In euros (now) | Our real cost | The user pays |");
console.log("|---|---|---|---|---|---|---|");
for (const id of TIER_IDS) console.log(`| ${id.toUpperCase()} | ${tierModel(id).name} | ${BEFORE.perSec[id]} → ${TIERS[id].creditsPerSec} | ${storyBefore(id)} → ${storyNow(id)} credits | ${eur(creditsToEur(storyNow(id)))} | ${usd(costUsd(id))} = ${eur(costUsd(id) * BASIS.eurPerUsd)} | ${x(markupOf(storyNow(id), costUsd(id)))} |`);

console.log("\nThe single prices");
console.log("| What | Before → now | Our real cost | The user pays |");
console.log("|---|---|---|---|");
console.log(`| A scene picture, an edit, a regenerate | ${BEFORE.picture} → ${PICTURE.credits} credits | ${usd(realCostUsd.picture(), 4)} | ${x(markupOf(PICTURE.credits, realCostUsd.picture()))} |`);
console.log(`| The script's share of the picture step | ${BEFORE.script} → ${SCRIPT.credits} credits | ${usd(realCostUsd.script())} | ${x(markupOf(SCRIPT.credits, realCostUsd.script()))} |`);
for (const id of TIER_IDS) { const s = tierModel(id).durations.includes(5) ? 5 : 6; console.log(`| A ${s}-second ${id.toUpperCase()} clip (also a clip made again) | ${BEFORE.perSec[id] * s} → ${priceCredits.clip(id, s)} credits | ${usd(realCostUsd.clip(id, s), 3)} | ${x(markupOf(priceCredits.clip(id, s), realCostUsd.clip(id, s)))} |`); }

console.log("\n30-second stories a month");
console.log("| Plan | Tier | Before | Now |");
console.log("|---|---|---|---|");
for (const plan of Object.keys(PLAN_TIERS)) for (const id of PLAN_TIERS[plan]) console.log(`| ${plan} (€${plans[plan].monthly}, ${plans[plan].credits} credits) | ${id.toUpperCase()} | ${Math.floor(plans[plan].credits / storyBefore(id))} | ${Math.floor(plans[plan].credits / storyNow(id))} |`);

console.log("\nWhat the user pays against our cost, by how the credits were bought (a 30-second story)");
console.log("| Plan | A credit is worth | " + TIER_IDS.map((id) => id.toUpperCase()).join(" | ") + " |");
console.log("|---|---|---|---|---|");
for (const plan of Object.keys(PLAN_TIERS)) {
  for (const [label, value] of [["monthly", plans[plan].monthly / plans[plan].credits], ["yearly", plans[plan].yearly / 12 / plans[plan].credits]]) {
    console.log(`| ${plan}, ${label} | ${(value * 100).toFixed(2)} c | ${TIER_IDS.map((id) => (PLAN_TIERS[plan].includes(id) ? x(markupOf(storyNow(id), costUsd(id), value)) : "–")).join(" | ")} |`);
  }
}
console.log("\nNot in the cost: pictures and clips made twice (a failed check, a fallback model), writing sessions nobody picks, idea batches, payment fees.");
