// Results page for the pricing page update + redesign (Long Form tiers, live
// Stripe prices, honest copy, plan finder), with desktop and phone screenshots.
//   node scripts/fruit-story/pagePricing.mjs <outFile> <shotsDir>
import fs from "fs";
import path from "path";
import { renderResultsPage } from "./resultsPage.mjs";

const [outFile, dir] = process.argv.slice(2);
const s = (f) => path.join(dir, `${f}.jpg`);

const html = await renderResultsPage({
  title: "Pricing Page Redesign",
  intro: "The new /workspace/pricing page, the Long Form tier gate and the checks you asked for. Everything is committed locally on laptop-transfer; nothing is pushed. Edge functions were deployed (plan-prices, and the three Long Form functions) and one migration was applied (tool_prices longform rows). Cost: $0, no paid AI calls.",
  stats: [
    { value: "€18 / €38 / €78", label: "monthly prices, read live from Stripe (VAT included); yearly €15 / €32 / €65 a month", tone: "good" },
    { value: "17% / 16% / 17%", label: "real yearly saving: €36 / €72 / €156 compared to monthly", tone: "good" },
    { value: "900 / 1,900 / 3,900", label: "credits a month the Stripe webhook actually grants (the old page said 750 / 1,600 / 3,200)", tone: "warn" },
    { value: "403 on V4", label: "Long Form now refuses tiers above the plan on the server (live check on your Pro account)", tone: "good" },
  ],
  sections: [
    {
      heading: "1. What you asked me to check and report",
      layout: "list",
      cards: [
        {
          title: "Video & Image Generator: change the copy, don't enforce (waiting for your OK)",
          tone: "warn",
          body: [
            "The generators have <b>no V2/V3/V4 tiers</b>: they list providers' models (Nano Banana 2, Veo 3.1 Lite, Flux…) and every paid plan can use all of them. Only free users are blocked, in the browser.",
            "In the last 60 days Starter subscribers used <b>Nano Banana 2 (23 jobs)</b> and <b>Veo 3.1 Lite (18 jobs)</b>. A server \"V2 only\" rule would take those away, and first needs a decision on which models count as V2.",
            "<b>Recommendation: change the copy.</b> I did neither yet. The new page makes no tier claim for the generators (\"Video & Image Generator\" ✓ on every paid plan), and the tier strip says it applies to templates and Long Form.",
          ],
        },
        {
          title: "\"Any\" includes the FREE plan: free users with credits can make paid-tool V2 videos (reported, not fixed)",
          tone: "bad",
          body: [
            "job-worker only gates V3/V4 keys. The V2 keys (<code>image:fruit-v2</code>, <code>video:seedance15pro</code>, <code>image:bts2k</code>, <code>image:cartoondrive2k</code>, <code>image:nano.2</code>) have no min_plan, so a free account with credits passes.",
            "<b>252 free accounts hold credits</b> (median 506; 66 hold 1,000+; the largest 200,000). <b>12 free-user jobs succeeded in the last 30 days</b> (Cartoon Drive By, Seedance V2, Flux base).",
            "Worth a look: in the last 7 days <b>6 new free accounts received 199,696 credits each</b> and 6 received 5,000. New sign-ups normally get 0.",
          ],
        },
        {
          title: "Priority queue: real, kept as \"Faster queue on busy days\"",
          tone: "good",
          body: [
            "job-worker picks queued jobs <code>order by priority, created_at</code> with getPlanPriority: Generative 1, Pro 2, Starter 3, free 9. Pro says \"Faster queue on busy days\", Generative \"First in the queue on busy days\".",
            "Footnote on the page: it applies to tools on the shared queue. Fruit v2 and Long Form run their own pipelines.",
            "Side note: the browser sends the priority with the job (<code>src/lib/jobs.ts</code>); the server doesn't recompute it from the plan.",
          ],
        },
        {
          title: "Enterprise (SSO, custom models, SLAs): no support found, removed",
          body: ["No SSO, roles, workspace or SLA code exists. The Enterprise card is gone. The Free card now says what Free really is: look around, making videos needs a plan."],
        },
        {
          title: "Found along the way",
          tone: "warn",
          body: [
            "<b>Plan credits:</b> the old page (and the Fruit paywall) used 750 / 1,600 / 3,200, but checkout grants 900 / 1,900 / 3,900 on today's prices (older price ids grant 600 / 1,200 / 2,500). Renewals in the last 30 days confirm it: 34 × 900 on Starter. Both now read one shared constant, and a test compares it with the webhook.",
            "<b>\"5 image generations to start\"</b> (Free card and FAQ): there's no such allowance; sign-ups get 0 credits. Reworded.",
            "<b>Other pages still carry the old claims</b> (not touched): the landing <code>Reddit/Pricing.jsx</code> section, <code>LaunchUI.jsx</code> and <code>CreatorSuiteLanding.jsx</code>.",
            "<b>The Long Form example isn't on the page yet.</b> Copying your video's 60 s excerpt into the public bucket was blocked by a permission check. It needs your OK first. The page shows only entries that have a public link.",
          ],
        },
      ],
    },
    {
      heading: "2. Tiers: lowest plan per tier, on the server",
      layout: "list",
      cards: [{
        title: "After this change",
        body: [
          "<b>Long Form</b>: V2 Starter · V3 Pro · V4 Generative. New: <code>tool_prices</code> longform:v2/v3/v4 (25 / 75 / 90 credits per minute) are checked by the quote, setup and tier-save functions before anything is saved or reserved. The picker locks tiers the plan lacks (tap = see plans) and defaults to the best allowed tier (Pro → V3, Generative → V4).",
          "<b>AI Fruit Story v2</b>: Starter · Pro · Generative (tool_prices + charge function).",
          "<b>Fruit v1, Clay Rescue, Face ASMR, Micro Camera, Kit Swap, Cartoon Drive By, Behind the Scenes</b>: V2 any plan <i>(free included, see above)</i> · V3 Pro · V4 Generative (job-worker).",
          "<b>30 Days</b>: Starter · Pro · Generative. <b>2AM</b>: Starter · Pro · Generative (quietly lowers the tier instead of refusing). <b>Cooking Matic</b>: any paid plan. <b>Generators</b>: any paid plan, no tiers.",
        ],
        meta: [["Live check (your Pro account, 10 min)", "V2 250 cr · V3 750 cr · V4 refused (403 PLAN_UPGRADE_REQUIRED)"]],
      }, { image: s("longform-setup-pro"), title: "Long Form Setup on Pro: prices from tool_prices, V3 picked, V4 locked (Generative)" }],
    },
    {
      heading: "3. The new page (desktop, signed in as Pro, fruit_v2 on)",
      text: "Cards open with the credits box in plain words, then price (real monthly price crossed out on yearly), the key button, the saving and the tier strip. Numbers load from live data; a failed source shows Retry, never a made-up number.",
      cards: [
        { image: s("desktop-pro-top"), title: "Hero, toggle (save up to 17%, from Stripe), cards" },
        { image: s("desktop-guest-card-bottom"), title: "Buttons, savings, tier strips (as a guest: Fruit numbers are the original tool's 30 s)" },
        { image: s("desktop-pro-finder"), title: "Plan finder: picks → cheapest plan that fits, credits bar, V3/V4 need Pro/Generative" },
        { image: s("desktop-pro-longform"), title: "What can you create: Long Form tab, 8–15 min × V2–V4, — where not included" },
        { image: s("desktop-pro-compare"), title: "Compare: Free / Starter / Pro / Generative, plan buttons in the header, View more" },
        { image: s("desktop-guest-examples"), title: "Made with Zyvo (Ken Reads Everything) and Every plan includes" },
      ],
    },
    {
      heading: "4. Phone (390 px)",
      text: "The recommended plan shows first. There's no sideways scrolling: the compare table shows one plan at a time with a plan switcher, and the estimates table fits all three plans.",
      cards: [
        { image: s("phone-guest-top"), title: "Top: Pro first" },
        { image: s("phone-pro-card-bottom"), title: "Card: current plan, saving, tier strip" },
        { image: s("phone-guest-finder"), title: "Plan finder" },
        { image: s("phone-guest-compare"), title: "Compare, one plan at a time" },
        { image: s("phone-guest-longform"), title: "Long Form tab" },
      ],
    },
    {
      heading: "5. Copy: before → after",
      layout: "list",
      cards: [{
        title: "Every change backed by data, or removed",
        body: [
          "\"Go viral. Or it's free.\" → <b>\"Make more videos every month.\"</b> + \"Every number on this page comes from today's live prices.\"",
          "\"2,000,850 creations\" (random counter), \"800+ active creators\", \"4.9★\" → removed; <b>\"18,700+ creators signed up\"</b> under the hero (18,736 sign-ups on 30 Sep).",
          "\"Pro plan: 23 spots left\", \"78% of creators choose Pro\", \"What 80% of viral creators use\", Most Popular → <b>\"Recommended: unlocks V3\"</b> (Pro is 15% of paid subscribers).",
          "Crossed-out $54, $20/$42/$85, \"Save 20/17/18%\", \"≈ $0.67 per day\", \"saving up to $119/yr\" → € from Stripe: €18/€38/€78, 17/16/17%, €0.60 a day, save €36/€72/€156.",
          "Testimonials (no source) → <b>Made with Zyvo</b>: the real \"Ken Reads Everything\" video (the Long Form sample waits for your OK).",
          "\"complete 20 seconds / 20s AI Fruit Story videos\" → \"20-second\" everywhere (tested).",
          "New: \"Prices include VAT\" (Stripe prices are VAT-inclusive for EUR), a V2/V3/V4 FAQ, and a VAT FAQ.",
        ],
      }],
    },
  ],
  decisions: [
    "<b>Generators:</b> OK to keep the copy change (no tier claim) instead of a server \"V2 only\" rule? Enforcing would take Nano Banana 2 and Veo 3.1 Lite away from current Starter users.",
    "<b>Free accounts with credits</b> can run V2 paid-tool jobs: want a server rule (V2 keys min_plan starter), and a look at the new free accounts holding 199,696 credits?",
    "<b>Long Form example:</b> may I upload the 60 s excerpt of \"How did ancient humans hunt\" (your V3 video, 720p, 3.5 MB) to the public assets bucket for the page?",
    "<b>Default tier:</b> Setup now defaults to the best tier the plan allows (Generative → V4 at 90/min). Keep that, or default to V3 where allowed?",
    "<b>More polish I'd suggest:</b> a sticky \"Get Pro · €32/mo\" bar on phones after the cards scroll away; show the same live € prices in the paywalls; and fix the landing page's pricing section, which still has the old claims.",
  ],
});
fs.writeFileSync(outFile, html);
console.log("written", outFile, (html.length / 1024).toFixed(0) + " KB");
