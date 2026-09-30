// Results page: pricing follow-ups before shipping (free-account audit, plan
// credits, VAT, margins, V2 paid gate, Long Form default, examples, claims).
//   node scripts/fruit-story/pageFollowups.mjs <outFile> <shotsDir> <audit12b.json> <margins.json>
import fs from "fs";
import path from "path";
import { renderResultsPage } from "./resultsPage.mjs";

const [outFile, dir, auditFile, marginsFile] = process.argv.slice(2);
const s = (f) => path.join(dir, `${f}.jpg`);
const audit = JSON.parse(fs.readFileSync(auditFile, "utf8"));
const m = JSON.parse(fs.readFileSync(marginsFile, "utf8"));
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (x) => `${Math.round(x * 100)}%`;
const eur = (x) => `€${x.toFixed(2)}`;

// Per-account real costs (long_form_cost_ledger, USD), from the audit run.
const COSTS = {
  "phase1c-samples-1790422900092": 0.668, "phase1f-fresh-storyplan-1790434686382": 0.365, "phase1g-ab-test-1790436782448": 2.006,
  "phase1final-nichesweep-1790443344546": 0, "phase1final-nichesweep-1790444220717": 0,
  "phase1final-format-myth_vs_reality-1790444300306": 0.213, "phase1final-format-myth_vs_reality-1790444733031": 0.257,
  "phase1final-format-you_vs_x-1790445405324": 0.236,
  "phase1final-accept-ancient-humans-1790446503175": 0.743, "phase1final-accept-ancient-humans-1790447728949": 0.684,
  "phase1final-accept-ancient-humans-1790449526027": 0.772, "phase1final-accept-ancient-humans-1790450193493": 0.761,
};
const SCRIPT = (email) => (email.startsWith("phase1final-accept") ? "phase1FinalAcceptance.mjs" : email.startsWith("phase1final-nichesweep") ? "phase1FinalNicheSweep.mjs" : email.startsWith("phase1final-format") ? "phase1FinalFormatDraftTest.mjs" : "phase1cLib.mjs (createTestUser)");
const auditRows = audit.map((a) => {
  const key = a.email.split("@")[0];
  const how = a.balance >= 100000
    ? `createTestUser upsert 5,000, then <code>${SCRIPT(a.email)}</code> set 200,000 (service-role profile write; no ledger row)`
    : `<code>${SCRIPT(a.email)}</code> upsert 5,000 (service-role profile write; no ledger row)`;
  const res = a.reservation;
  return `<tr><td><b>${esc(a.email)}</b><br><span class="sub">${esc(a.created.slice(0, 16).replace("T", " "))} UTC · balance ${a.balance.toLocaleString("en-US")}</span></td><td style="white-space:normal;text-align:left">${how}</td><td style="white-space:normal;text-align:left">Long Form project “${esc(a.project.topic)}” (${a.project.scene_generation_tier.toUpperCase()}, ${a.project.resolved_length_minutes} min), status ${esc(a.project.status)}: plan/research/script only, <b>no scenes, no video</b> (0 jobs). Reservation ${res.reserved_credits} cr ${res.status}, ${res.committed_credits} spent.</td><td>$${(COSTS[key] ?? 0).toFixed(2)}</td></tr>`;
}).join("");
const auditTable = `<table><thead><tr><th>Account (all @zyvo-internal.test)</th><th>How it got the credits</th><th>What it generated</th><th>Our real cost</th></tr></thead><tbody>${auditRows}</tbody></table>`;

// Margin table: per product, one row per revenue source.
let marginRows = "";
for (const p of m.products) {
  marginRows += `<tr class="group"><td colspan="6">${esc(p.label)} · ${p.credits} credits · real cost ${eur(p.eur)} ($${p.usd.toFixed(2)})${p.estimate ? " · estimate" : ""}${p.note ? ` <span class="sub">· ${esc(p.note)}</span>` : ""}</td></tr>`;
  for (const r of p.rows) {
    const cls = (x) => (x < m.flag ? "bad" : "");
    marginRows += `<tr><td>${esc(r.source)}</td><td>${eur(r.revNow)}</td><td class="${cls(r.marginNow)}">${pct(r.marginNow)}</td><td>${eur(r.revLater)}</td><td class="${cls(r.marginLater)}">${pct(r.marginLater)}</td><td>${eur(r.revNow / p.credits * 1000)}</td></tr>`;
  }
}
const marginTable = `<table><thead><tr><th>Product × how the credits were bought</th><th>Revenue NOW</th><th>Margin NOW</th><th>Revenue LATER (VAT 25.5%)</th><th>Margin LATER</th><th>Revenue / 1,000 cr NOW</th></tr></thead><tbody>${marginRows}</tbody></table>`;
const perCredit = `<table><thead><tr><th>Source</th><th>Price</th><th>Credits</th><th>€ / credit after Stripe fee NOW</th><th>LATER (VAT inside the price)</th></tr></thead><tbody>${m.sources.map((x) => `<tr><td>${esc(x.label.split(" (")[0])}</td><td>€${x.gross}</td><td>${x.credits.toLocaleString("en-US")}</td><td>€${x.now.toFixed(4)}</td><td>€${x.later.toFixed(4)}</td></tr>`).join("")}${m.early.map((e) => `<tr><td>${e.plan[0].toUpperCase() + e.plan.slice(1)} early subscribers (900 / 1,900 / 3,900)</td><td>monthly · yearly</td><td>—</td><td>€${e.monthlyNow.toFixed(4)} · €${e.yearlyNow.toFixed(4)}</td><td>€${e.monthlyLater.toFixed(4)} · €${e.yearlyLater.toFixed(4)}</td></tr>`).join("")}</tbody></table>`;

const html = await renderResultsPage({
  title: "Pricing Ship Check",
  intro: "The ten fixes before you push. Code is committed locally on laptop-transfer and nothing is pushed. Some changes are already live on the backend because Supabase deploys and migrations don't wait for a push. The stripe-webhook, job-worker and billing-summary functions were deployed, and one migration was applied (V2 paid gate). Four short videos were uploaded to public-assets/pricing, as you approved. Cost: $0, no paid AI calls.",
  stats: [
    { value: "12 / 12", label: "suspicious free accounts are our own Long Form test accounts (26 Sep); none made a video", tone: "good" },
    { value: "750 / 1,600 / 3,200", label: "credits for new subscriptions since 30 Sep 22:30 UTC (webhook v183); 86 existing keep theirs", tone: "good" },
    { value: "€0 VAT", label: "on the last 100 paid invoices (Stripe Tax on, not collecting anywhere)", tone: "good" },
    { value: "Long Form V3/V4", label: "the only products under 35% margin: V3 24–38% and V4 15–29% once VAT applies", tone: "warn" },
  ],
  sections: [
    {
      heading: "1. The 12 free accounts with 199,696 / 5,000 credits (read-only)",
      text: "All 12 are <b>internal test accounts created on 26 Sep 2026</b> by the repo's Long Form Phase 1 scripts (<code>scripts/phase1cLib.mjs</code> createTestUser, <code>phase1FinalAcceptance.mjs</code>, <code>phase1FinalNicheSweep.mjs</code>, <code>phase1FinalFormatDraftTest.mjs</code>). None were created by the Fruit scripts in this session, which use your own account. The balances were written straight to <code>profiles</code> with the service key: no credit_grants, credit ledger or Stripe rows, and not the old deduct_credits hole. 199,696 = 200,000 − 304 still reserved; 5,000 = reservation released. Nobody can sign in: the password was a random UUID that was never stored, and the domain can't receive mail. 11 more of the same kind (4,726 / 4,696 credits) exist from the same runs.",
      html: auditTable,
      layout: "list",
      cards: [{
        title: "Proposed cleanup (not done): tidy, not urgent",
        body: [
          "They're ours and can't be used from outside, so there's nothing to claw back from a stranger.",
          "Still worth tidying: set the 23 internal accounts' <code>credit_balance</code> to 0, release the 7 open reservations (7 × 304 cr), and optionally delete the auth users. That's one SQL script I can show you first.",
          "To stop it recurring, the Long Form test scripts could grant credits through a ledger row tagged <code>internal_test</code>, or sweep their users at the end of a run.",
        ],
      }],
    },
    {
      heading: "2. Plan credits: the page is the promise",
      layout: "list",
      cards: [
        {
          title: "Done: new subscriptions get 750 / 1,600 / 3,200 a month",
          tone: "good",
          body: [
            "The webhook reads one shared map (<code>_shared/stripePlanPrices.js</code> PLAN_PRICE_MAP, tested against the page). On today's price ids, a subscription that started <b>after 30 Sep 22:30 UTC</b> gets 750 / 1,600 / 3,200; one that started earlier keeps 900 / 1,900 / 3,900 for as long as it lives; legacy prices keep 600 / 1,200 / 2,500. Yearly plans get the same amount each month.",
            "The start date comes from Stripe (<code>subscription.start_date</code>). If that lookup fails, a first invoice counts as new and a renewal as existing, so an existing subscriber never drops.",
            "Deployed as a minimal patch on the live webhook (v183, verify_jwt off as before). The local file also has abandoned-checkout code that was never deployed; that code did <b>not</b> ship.",
          ],
        },
        {
          title: "Today's live subscriptions (Stripe: 82 active + 4 past due)",
          body: [
            "<b>39 on today's prices (keep 900 / 1,900 / 3,900):</b> 37 Starter €18/mo, 2 Pro €38/mo.",
            "<b>47 on legacy prices (keep 600 / 1,200 / 2,500):</b> Starter €11.99/mo × 33, €104/yr × 4, $11.99 × 3; Pro €24.99 × 3, €218/yr × 2, $24.99 × 1; Generative €49.99 × 1.",
            "Not counted: 86 unpaid, 221 cancelled and 212 incomplete-expired subscriptions.",
          ],
        },
        {
          title: "What the page promised at each time",
          body: [
            "<b>Mar–Jul 2026, legacy prices live:</b> “$12 / $25 / $50 a month” (yearly $10 / $21 / $42), <b>600 / 1,200 / 2,500 credits</b>, “Up to 200 AI images / 30 AI videos / 300 viral scripts” (Starter), crossed-out $32 on Pro. Stripe charged €11.99 / €24.99 / €49.99 and granted exactly what the page said.",
            "<b>12 Jul – 30 Sep, today's prices:</b> the page said “$20 / $42 / $85” with <b>750 / 1,600 / 3,200 credits</b>, but Stripe charged €18 / €38 / €78 and granted <b>900 / 1,900 / 3,900</b>. Those 39 subscribers got more than promised, so keeping their grant is the fair choice.",
          ],
        },
      ],
    },
    {
      heading: "3. VAT (report only; the page claims are removed)",
      layout: "list",
      cards: [{
        title: "Stripe Tax is on, but no VAT is collected",
        body: [
          "Stripe Tax settings: <b>active</b>, head office Finland, default behavior “inferred by currency” (EUR prices count as VAT-inclusive). <b>Registrations: none.</b>",
          "Checkout sends <code>automatic_tax[enabled]=true</code>. On the last 100 paid invoices (24 Aug – 30 Sep, 93 EUR + 7 USD), <b>tax = €0.00 on every one</b>, reason <code>not_collecting</code>. Customers pay exactly €18 / €38 / €78.",
          "Each invoice still carries a €0 tax entry. Worth opening one invoice PDF to check it doesn't print a confusing “VAT 0%” line.",
          "10 of the last 20 checkout sessions ended in <code>requires_location_inputs</code>: automatic tax makes checkout ask for the buyer's address. Until you register, turning <code>automatic_tax</code> off would remove that step (a one-line change in create-checkout-session, not done). Also check whether Stripe Tax bills a fee for these transactions.",
          "Removed from the pricing page: “Prices include VAT” and the VAT FAQ. <code>plan-prices</code> still reports vatIncluded, but nothing shows it.",
        ],
      }],
    },
    {
      heading: "4. Margins from real logged costs",
      text: `Costs come from fruit_jobs, fruit_ai_calls and the Long Form cost ledger of your 3 finished videos. Rate: ECB ${m.rateDate}, €1 = $${m.usdPerEur} (about €0.881 per $1). Revenue = the price the credits were bought at, minus Stripe's ~1.5% + €0.25 per charge. NOW = no VAT. LATER = the same prices with 25.5% Finnish VAT inside them. Red = under 35%.`,
      html: perCredit + "<br>" + marginTable,
      layout: "list",
      cards: [{
        title: "How each cost was built, and what to watch",
        tone: "warn",
        body: [
          `<b>Fruit</b>: pictures $${m.fruitUnit.picture.toFixed(4)} each (${4} or 6 per story), picture check $${m.fruitUnit.check.toFixed(4)}, planner $${m.fruitUnit.planner.toFixed(4)} (+ repairs), captions and final render under $0.002. Clips: V2 Wan 2.6 Flash $${m.fruitUnit.clipRate.v2.perSec.toFixed(4)}/s (${m.fruitUnit.clipRate.v2.clips} real clips), V3 Seedance 2.0 Mini $${m.fruitUnit.clipRate.v3.perSec.toFixed(4)}/s (${m.fruitUnit.clipRate.v3.clips} clips), V4 Veo 3.1 Fast $${m.fruitUnit.clipRate.v4.perSec.toFixed(4)}/s (<b>only ${m.fruitUnit.clipRate.v4.clips} clip</b>: thin evidence). Fruit sits at 52–63% NOW and 43–53% LATER on every tier.`,
          `<b>Long Form</b>: scripts, research, narration and render ≈ $${m.lfUnit.nonImagePer10.toFixed(2)} per 10 min; ≈ ${Math.round(m.lfUnit.scenesPer10)} scene images per 10 min including retries. The Stickman recipe renders V2 with FLUX.2 Klein ($${m.lfScene.v2.toFixed(4)} per scene with upscale) and V3 with Nano Banana 2 Lite ($${m.lfScene.v3.toFixed(4)} with upscale and text QA). V4 = V3 + best-of-2 on hook and short-text beats + strict QA: <b>an estimate</b>, as no V4 video is logged.`,
          "<b>Under 35%:</b> Long Form V3 on yearly plans (40–41% NOW, 24–25% LATER) and on packs once VAT applies (31–35%). Long Form V4 is below 35% almost everywhere after VAT (15–29%) and on Generative yearly already NOW (33%). Options: raise V3/V4 per-minute prices (for example V3 90, V4 120), cut the V3 image count (fewer retries), or accept it until VAT registration.",
          "Early subscribers (900 / 1,900 / 3,900 on today's prices) pay ~17% less per credit than new ones, so their Long Form V3/V4 margins are lower still. There are 39 of them.",
        ],
      }],
    },
    {
      heading: "5–7. Free accounts, generators, Long Form default",
      layout: "list",
      cards: [
        {
          title: "5. V2 of paid tools now needs a paid plan (server)",
          tone: "good",
          body: [
            "Migration applied: <code>min_plan = starter</code> on image:fruit-v2, video:fruit-v2, video:seedance15pro, image:nano.2, image:bts2k, image:cartoondrive2k, image:thirtydays1k, image:twoam1k. job-worker (v477) now ranks affiliates as Starter, so they keep V2. 2AM's start function refuses free users instead of quietly giving them V2.",
            "Untouched on purpose: <code>image:flux.base</code>, the Image Generator's free allowance (<b>5 free images every 30 days</b>, 0 credits). I was wrong last round when I said free users get nothing; the Free copy now says this.",
            "Also blocked for free users now, as a side effect: Nano Banana 2 in the Image Generator and V2 in the Video Generator. Both were already blocked in the browser.",
            "Free accounts no longer see “Add Credits” or credit packs. The server still sells a pack if someone calls checkout directly; a one-line check in create-checkout-session would close that (not done).",
            "Not live-tested with a real free job: it is the same gate that already blocks V3/V4.",
          ],
        },
        { title: "6. Generators", body: ["No server tier rule; the pages make no tier claim for them."] },
        {
          title: "7. Long Form default tier",
          body: ["Starter → V2, Pro → V3, Generative → V3. V4 is only ever the user's own pick (tested)."],
          image: s("longform-setup-pro"),
        },
      ],
    },
    {
      heading: "8. Real videos from Zyvo tools",
      text: "The Fruit video (9:16) is on the left; your two Long Form videos (first 60 s each, 720p, V3) are stacked on the right. Measured on desktop, both sides start and end on the same pixel (3825 → 4539). On phones they stack vertically.",
      cards: [
        { image: s("desktop-examples"), title: "Desktop" },
        { image: s("phone-examples"), title: "Phone" },
      ],
    },
    {
      heading: "9. Every plan includes",
      layout: "list",
      cards: [{
        image: s("desktop-included"),
        title: "Six lines, each checked",
        body: [
          "Every Zyvo tool and template · Long Form YouTube videos · Watermark-free exports (no export adds a watermark) · Your creations saved in your library (“private” was too strong: files are served from public links with random names) · Email support (the /support contact page) · Cancel anytime (Stripe portal).",
          "Removed: Brand creation, Viral Video/Script Builder. Script writing is built into some tools (Fruit, Long Form, 2AM, 30 Days) but not every one, so it's left out.",
        ],
      }],
    },
    {
      heading: "10. Old claims elsewhere, and € in every paywall",
      layout: "list",
      cards: [
        {
          title: "Fixed (copy and prices only, same rules as the pricing page)",
          tone: "good",
          body: [
            "<b>Paywalls</b> (Face ASMR, which Clay/Micro/Kit Swap/CDB/BTS/Fruit v2 also use; 2AM; original Fruit), the Script upsell and the onboarding plan picker: live € prices and “Billed €180/yr”; “save up to 17%” from Stripe; credits from the shared constant; “Recommended” instead of “Popular”. Removed: typed “~25 AI videos”, “Unlimited history”, the crossed-out $54 and the “17% OFF” badge.",
            "<b>Landing pricing section</b> (Reddit) and <b>PricingHome</b>: live € prices, real credits and features. Removed: “23 spots left”, “78% choose Pro”, “12,000+”, Enterprise, and the Free card's “10 minutes, 1 avatar, watermark” text.",
            "<b>Live home page (/)</b>: FAQ free plan → “5 AI images every 30 days”; “Join 4,200+ creators” → “18,700+ creators have signed up”.",
            "<b>Face ASMR and Micro Camera landing pages</b>: fake 4.9-star review markup removed from the structured data Google reads.",
            "<b>Billing settings</b>: the plan price now shows in its real currency (billing-summary returns it; deployed).",
          ],
        },
        {
          title: "Correction, and what's still live (your call)",
          tone: "warn",
          body: [
            "LaunchUI.jsx and CreatorSuiteLanding.jsx had <b>no fake claims</b>; my earlier list matched “78%” inside a CSS width. Sorry for the noise.",
            "The landing Reddit pricing section, PricingHome and the studio pages are <b>not routed</b> in App.jsx today, so they weren't live. They're fixed anyway.",
            "<b>Still live on the home page (/), untouched:</b> three invented reviews (“Marcus Lee, 120K Followers”…); counters that look live but are typed (“Images created today 8,420+”, “Creators active now 342”, “99% more views”, “1,240+ viral posts this week”); rotating fake notifications (“@mia.creates 2.1M views”, “3× ROAS”); “300% higher engagement growth”. Proposal: remove the reviews and the notification column, and replace the counters with real ones (18,700+ sign-ups, the real example videos).",
            "Blog posts still quote old Zyvo prices and allowances (“€12/month — 200 images”, “10 free images a month”). <code>Figma/Pricing.jsx</code> ($25/$50/$90) isn't used anywhere.",
          ],
        },
        { image: s("paywall"), title: "A paywall now: live € prices, Recommended, real credits" },
      ],
    },
  ],
  decisions: [
    "<b>Before you push:</b> should I remove the invented reviews, the fake live counters and the notification toasts from the home page (/)? They are the last clearly fake claims on a live page.",
    "<b>Internal test accounts:</b> OK to zero the 23 balances and release the 7 open reservations? I'll show the SQL first.",
    "<b>Long Form margins:</b> raise V3/V4 per-minute prices, or leave them until VAT registration?",
    "<b>Checkout:</b> turn off <code>automatic_tax</code> until you're VAT-registered (fewer address prompts), and refuse credit packs for free accounts on the server?",
  ],
});
fs.writeFileSync(outFile, html);
console.log("written", outFile, (html.length / 1024).toFixed(0) + " KB");
