// Results page for the read-only launch audit (since 2026-09-30 22:00 UTC).
//   node scripts/fruit-story/pageLaunchAudit.mjs <outFile> <audit.json> <shotsDir>
import fs from "fs";
import path from "path";
import { renderResultsPage } from "./resultsPage.mjs";

const [outFile, auditFile, dir] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(auditFile, "utf8"));
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const EUR_PER_USD = 1 / 1.1355;
const PER_CREDIT = 0.0233; // € per credit, Starter monthly after Stripe fees (the most common plan)
const U = d.fruit.filter((s) => s.bucket === "users");
const count = (arr, f) => arr.filter(f).length;

const fruitRows = U.map((s) => {
  const img = s.jobs.filter((j) => j.kind === "image"), clip = s.jobs.filter((j) => j.kind === "clip");
  const st = (js) => `${count(js, (j) => j.status === "succeeded")} ok${count(js, (j) => j.status === "failed") ? ` · <b style="color:var(--bad)">${count(js, (j) => j.status === "failed")} failed</b>` : ""}${count(js, (j) => !["succeeded", "failed"].includes(j.status)) ? ` · ${count(js, (j) => !["succeeded", "failed"].includes(j.status))} running` : ""}`;
  return `<tr><td>${esc(s.email)}${s.newUser ? " <span class=sub>(new)</span>" : ""}<br><span class=sub>${esc(s.created.slice(5, 16).replace("T", " "))} · ${esc(s.kind)} · ${s.quality.toUpperCase()} · ${s.lengthSec}s · “${esc(s.title)}”</span></td><td style="text-align:left">${esc(s.status)}${s.finalStatus === "ready" ? " · <b>final video</b>" : ""}</td><td>${st(img)}</td><td>${st(clip)}</td><td>${s.charged}</td><td>${s.refunded}</td><td>${s.net}</td><td>$${s.costUsd.toFixed(2)}</td><td>${s.checks.failed}/${s.checks.total} · ${s.redraws}</td></tr>`;
}).join("");
const fruitTable = `<table><thead><tr><th>User · story</th><th>Status</th><th>Pictures</th><th>Clips</th><th>Charged</th><th>Refunded</th><th>Net cr</th><th>Our cost</th><th>Checks failed · redraws</th></tr></thead><tbody>${fruitRows}</tbody></table>`;

const other = d.otherJobs.filter((j) => j.bucket === "users");
const byTool = {};
for (const j of other) {
  const t = (byTool[j.tool_key] ??= { n: 0, ok: 0, failed: 0, running: 0, charged: 0, users: new Set() });
  t.n++; t.users.add(j.email);
  if (j.status === "succeeded") t.ok++; else if (j.status === "failed") t.failed++; else t.running++;
  if (j.charged) t.charged += j.charge_credits || 0;
}
const TOOL = { "image:fruit-v2": "Clay / Face / Micro / Kit Swap / Cooking pictures (GPT Image 2)", "video:seedance15pro": "Template V2 clips (Seedance 1.5 Pro)", "image:flux2.klein9bkv": "Long Form idea thumbnails", "image:nano.2": "Face ASMR / Kit Swap pictures (Nano Banana 2)", "image:cartoondrive2k": "Cartoon Drive By V2", "image:bts2k": "Behind the Scenes V2", "full-video": "Full video export" };
const otherTable = `<table><thead><tr><th>Tool</th><th>Jobs</th><th>Succeeded</th><th>Failed</th><th>Running</th><th>Credits charged</th><th>Users</th></tr></thead><tbody>${Object.entries(byTool).map(([k, t]) => `<tr><td>${esc(TOOL[k] ?? k)}<br><span class=sub>${esc(k)}</span></td><td>${t.n}</td><td>${t.ok}</td><td class="${t.failed ? "bad" : ""}">${t.failed}</td><td>${t.running}</td><td>${t.charged}</td><td>${t.users.size}</td></tr>`).join("")}</tbody></table>`;

const fruitNet = U.reduce((s, x) => s + x.net, 0), fruitUsd = U.reduce((s, x) => s + x.costUsd, 0);
const lfP = d.lf[0];
const seedCredits = byTool["video:seedance15pro"]?.charged ?? 0;
const seedSec = seedCredits / 2.5;
const otherImgUsd = ((byTool["image:nano.2"]?.ok ?? 0) + (byTool["image:cartoondrive2k"]?.ok ?? 0) + (byTool["image:bts2k"]?.ok ?? 0)) * 0.06923 + (byTool["image:flux2.klein9bkv"]?.ok ?? 0) * 0.00169;
const otherLo = seedSec * 0.0239 + otherImgUsd, otherHi = seedSec * 0.052529 + otherImgUsd;
const otherCredits = Object.values(byTool).reduce((s, t) => s + t.charged, 0);
const money = (credits, usd) => { const rev = credits * PER_CREDIT, cost = usd * EUR_PER_USD; return { rev, cost, margin: rev ? (rev - cost) / rev : 0 }; };
const mf = money(fruitNet, fruitUsd), ml = money(lfP.reservation.reserved, lfP.costUsd), moLo = money(otherCredits, otherHi), moHi = money(otherCredits, otherLo);
const moneyTable = `<table><thead><tr><th>Tool</th><th>Credits (net)</th><th>Revenue ≈ (€0.0233/cr)</th><th>Real AI cost</th><th>Margin</th></tr></thead><tbody>
<tr><td>AI Fruit Story v2 (logged: fruit_jobs + fruit_ai_calls)</td><td>${fruitNet}</td><td>€${mf.rev.toFixed(2)}</td><td>$${fruitUsd.toFixed(2)} = €${mf.cost.toFixed(2)}</td><td>${Math.round(mf.margin * 100)}%</td></tr>
<tr><td>Long Form (logged: cost ledger) <span class=sub>600 cr reserved, not yet committed</span></td><td>${lfP.reservation.reserved}</td><td>€${ml.rev.toFixed(2)}</td><td>$${lfP.costUsd.toFixed(2)} = €${ml.cost.toFixed(2)}</td><td>${Math.round(ml.margin * 100)}%</td></tr>
<tr><td>Other tools (<b>estimated</b> from providers.ts: these jobs log no real cost)</td><td>${otherCredits}</td><td>€${(otherCredits * PER_CREDIT).toFixed(2)}</td><td>$${otherLo.toFixed(2)}–$${otherHi.toFixed(2)}</td><td>${Math.round(moLo.margin * 100)}–${Math.round(moHi.margin * 100)}%</td></tr>
</tbody></table>`;

const c = d.checkout;
const sessTable = `<table><thead><tr><th>Checkout (UTC)</th><th>Plan</th><th>Result</th><th>Automatic tax</th><th>Tax</th><th>Asked address</th></tr></thead><tbody>${c.sessions.map((s) => `<tr><td>${esc(s.created.slice(5, 16).replace("T", " "))}</td><td>€${s.amount} ${esc(s.mode)}</td><td class="${s.status === "complete" ? "" : ""}">${s.status === "complete" ? "<b>paid</b>" : "abandoned"}</td><td>${s.automaticTax ? "<b>on</b> (before the change)" : "off"}</td><td>€${s.tax}</td><td>${s.askedAddress ? "yes" : "no"}</td></tr>`).join("")}</tbody></table>`;
const grantTable = `<table><thead><tr><th>Grant (UTC)</th><th>User</th><th>Reason</th><th>Credits</th><th>Expected</th></tr></thead><tbody>${c.grants.map((g) => {
  const inv = c.invoices.find((i) => i.id === g.external_id); const legacy = inv?.price === "price_1TGKT6Htn4q5rIncI47V5Ein";
  const exp = legacy ? 600 : g.created_at < "2026-09-30T22:30:00Z" ? 900 : 750;
  return `<tr><td>${esc(g.created_at.slice(5, 16).replace("T", " "))}</td><td>${esc(g.email)}</td><td>${esc(inv?.reason ?? g.reason)}${legacy ? " (legacy €11.99)" : ""}</td><td>${g.amount}</td><td class="${g.amount === exp ? "" : "bad"}">${exp}${g.amount === exp ? " ✓" : ""}${exp === 900 ? " (started 22:05, before the 22:30 cutoff)" : ""}</td></tr>`;
}).join("")}</tbody></table>`;

const html = await renderResultsPage({
  title: "Launch Audit",
  intro: `Read-only audit from <b>1 Oct 01:00 Finland (30 Sep 22:00 UTC) to ${esc(d.window.until.slice(0, 16).replace("T", " "))} UTC</b>, about 13.5 hours. Internal test accounts are excluded, and your own account made nothing in this window. Nothing was changed.`,
  stats: [
    { value: "Runware empty", label: "since 07:24 UTC (low from 00:03): every AI Fruit job has failed since 07:38, and every Runware tool is down now", tone: "bad" },
    { value: "0 mismatches", label: "credits: every charge matches tool_prices; all 33 failed Fruit jobs refunded exactly once; nobody charged for something they didn't get", tone: "good" },
    { value: "750 ✓", label: "new Starter subscriptions got exactly 750 (one at 22:05 got 900 by design); €0 tax, no address prompts", tone: "good" },
    { value: "110 / min", label: "Long Form V4 live on the site (Setup page and pricing page) and in tool_prices", tone: "good" },
  ],
  sections: [
    {
      heading: "Summary: what needs fixing, most urgent first",
      layout: "list",
      cards: [
        {
          title: "1. Top up Runware now: every Runware tool is down", tone: "bad",
          body: [
            "From <b>00:03 UTC</b> Runware refused clips with “Insufficient available balance. Some of your credits are currently reserved” (12 clips + 5 pictures). From <b>07:24</b> it refused everything with “Insufficient credits” (15 clips + 1 picture). <b>No AI Fruit job has succeeded since 07:38</b>, and the other tools' last successes were 03:00–06:10.",
            "Users saw “AI Fruit Story is taking a short break on our side. You weren't charged. Try again in a few minutes.” Every failed job was refunded, but 3 of 10 stories lost clips: one lost all 15 clips, one 8 of 13, one 3 of 12.",
            "The out-of-credit alert only fired at <b>08:42</b>, 8.5 hours late: it matches Runware's “insufficientCredits” code, not the earlier “insufficient available balance” text.",
            "<b>Fix:</b> top up the Runware wallet and turn on auto-reload there. In code, treat both Runware balance messages as provider-out-of-credit (alert at the first one), and ideally read the Runware balance on a schedule and alert below a threshold.",
          ],
        },
        {
          title: "2. GPT Image 2 pictures have been broken since at least 27 Sep (not a launch issue)", tone: "bad",
          body: [
            "Every <code>image:fruit-v2</code> job (OpenAI GPT Image 2 via Runware: pictures for Kit Swap, Clay Rescue, Face ASMR, Micro Camera and Cooking Matic) fails with <code>PROVIDER_UNSUPPORTED_PARAMETER</code>. Users see “This image couldn't be generated due to a provider configuration issue.” In this window: 34 failures across 2 users (tonierhard9 × 28, charbelelias225 × 6), plus 3 queued right now that will fail the same way. Nothing was charged. Not one of these jobs has succeeded since at least 20 Sep.",
            "<b>Fix:</b> look at the exact Runware request (model <code>openai:gpt-image@2</code>, size 768×1376, quality “low”) against what Runware accepts today; most likely the size or the quality parameter. Then do one test call (about $0.01) and redeploy job-worker or the image function.",
          ],
        },
        {
          title: "3. The picture check is too strict: 42% of pictures flagged, 36 redraws", tone: "warn",
          body: [
            "60 of 144 checks failed. <b>55 were “N figures instead of M”</b>: extra fruit-headed people in the background, which the scene prompts ask for. Only 13 involved human heads and 4 a wrong fruit head. Each fail costs a redraw ($1.32 in total) and slows the story; a second fail shows the user a warning plus a free regenerate (7 used).",
            "<b>Fix:</b> fail only on human heads, a missing character or a wrong fruit head; treat extra fruit-headed figures as fine.",
          ],
        },
        {
          title: "4. Watch: real costs aren't logged for the shared-queue tools", tone: "warn",
          body: [
            "Clay, Face ASMR, Micro Camera, Kit Swap, Cartoon Drive By and Behind the Scenes jobs store no provider cost, so their margin is an estimate. Template V2 clips (Seedance 1.5 Pro) could be as low as 24% if they render at 720p.",
            "<b>Fix:</b> store Runware's returned <code>cost</code> on each job (as Fruit does).",
          ],
        },
        {
          title: "Fine: no action needed",
          tone: "good",
          body: [
            "Credits: 0 mismatches. Every picture was charged 4 and every clip ceil(rate × seconds); every failed job was refunded exactly once with the same amount; no charged job is missing its result. Long Form reserved exactly 8 min × 75 = 600.",
            "Nothing is stuck over 15 minutes. All 25 clips and 105 pictures came back by webhook (none needed the checker), clips in 63 s median and 109 s at most.",
            "The Long Form project (woolly mammoths, V3, 8 min) isn't stuck: its autopilot finished at 00:04 (plan, research, script, voice and scene images) and it's waiting for the user's next step. Its 600 credits are reserved, not spent.",
            "No free account was refused a paid tool (0 plan-gate refusals) and nobody bought a credit pack.",
          ],
        },
      ],
    },
    {
      heading: "1. What users made",
      text: `<b>${d.users.active} active users</b> (excluding internal accounts and you), <b>${d.users.firstTimeCreators} of them first-time creators</b>. ${d.users.newSignups} new sign-ups, ${d.users.newSignupsPaid} of whom subscribed. AI Fruit v2: ${U.length} stories (${count(U, (s) => s.kind === "single")} singles, ${count(U, (s) => s.kind !== "single")} series episodes); quality ${count(U, (s) => s.quality === "v2")} × V2, ${count(U, (s) => s.quality === "v3")} × V3, 0 × V4. <b>Only 1 reached a final video</b> (“The Bill”, V3). 4 stopped after the pictures, 5 have clips but no final (3 of them lost clips to the Runware outage). Long Form: 1 project (V3), waiting for the user. Other tools: below.`,
      html: fruitTable + "<br>" + otherTable,
    },
    {
      heading: "4. Money",
      text: "Revenue is priced at €0.0233 per credit (Starter monthly after Stripe fees, the plan all new subscribers chose), at $1 = €0.881. Credits spent may include balances bought earlier.",
      html: moneyTable,
    },
    {
      heading: "5. Checkouts",
      text: "13 checkouts: 3 paid (all Starter €18 a month) and 10 abandoned. Tax was €0 on every invoice. Automatic tax was on only for the first checkout (22:04 UTC, before the change); no checkout asked for an address. No credit packs were bought. One renewal invoice (€18, 10:10 UTC) is still open, waiting on the card.",
      html: sessTable + "<br>" + grantTable,
    },
    {
      heading: "6. Prices live",
      text: `tool_prices longform:v4 = <b>110</b> credits per minute since ${esc(d.live.v4ChangedAt.slice(0, 16).replace("T", " "))} UTC. The live Long Form Setup page shows 25 / 75 / 110 credits per minute, and the live pricing page's Long Form tab shows V4 at 880 / 1,100 / 1,320 / 1,650 credits for 8 / 10 / 12 / 15 min. The quote and reservation read the same row. No V4 video was ordered in the window, so there's no real V4 charge to check yet.`,
      cards: [{ image: path.join(dir, "prod-longform.jpg"), title: "Live: tryzyvo.com/long-form/create" }],
    },
  ],
  decisions: [
    "<b>Now:</b> top up Runware and enable auto-reload. Everything else waits on that.",
    "<b>Then, with your go:</b> (a) the alert also catches “insufficient available balance” and checks the balance on a schedule; (b) fix the GPT Image 2 request (one ~$0.01 test call); (c) loosen the picture check to ignore extra fruit-headed figures; (d) log real Runware cost on shared-queue jobs.",
    "The 3 users whose stories lost clips (beenuptownbee, bussyqueefxo, muhammedumair913) were refunded automatically. A short “sorry, it's fixed, try again” email once Runware is topped up would help.",
  ],
});
fs.writeFileSync(outFile, html);
console.log("written", outFile, (html.length / 1024).toFixed(0) + " KB");
