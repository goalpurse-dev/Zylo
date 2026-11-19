// The unfinished-checkout emails (owner, 2026-11-19). Three emails to someone who opened checkout for a plan and didn't pay:
//   1  about 1 hour after they left: the plan they picked, what they get, a button straight back to checkout for it
//   2  about 24 hours: what Zyvo videos look like (an example picture), the launch deal if it is still running
//   3  about 72 hours: a last nudge; says the deal is ending only while it really is
// Rules (the owner's): only checkouts opened after the switch went on (never the old backlog), stop the moment they pay,
// never anyone who paid since, never someone who said no to emails or unsubscribed (email_updates = false), never the
// owner's own test accounts, never the same email twice, an unsubscribe link in every one, small volumes from
// notify.tryzyvo.com. Sent by the checkout-reminders function (every 10 minutes while the switch is on). Pure: the
// timing and the texts are tested in node (tests/checkoutReminders.test.mjs).
import { APP_URL } from "./emailRules.js";
import { LAUNCH_DEAL, launchDealFor, launchDealPrice } from "./launchDeal.js";
import { PLAN_CREDITS, PLAN_PRICE_IDS } from "./stripePlanPrices.js";

const H = 3600000;
export const STEPS = Object.freeze([1, 2, 3]);
// when each email may go, and the last moment it still makes sense (later: that one is skipped, never sent late)
export const TIMING = Object.freeze({
  1: { fromH: 1, untilH: 20, from: "left" },   // 1 h after their LAST checkout visit (they may have come back to it)
  2: { fromH: 24, untilH: 60, from: "opened" }, // counted from their first checkout
  3: { fromH: 72, untilH: 120, from: "opened" },
});
export const MIN_GAP_H = 12; // never two of these within 12 hours

export const STEP_LABELS = Object.freeze({ 1: "1 h: your plan is waiting", 2: "24 h: what Zyvo videos look like", 3: "72 h: last nudge" });
export const STOP_LABELS = Object.freeze({
  paid: "Paid",
  done: "All 3 handled",
  declined: "Said no to emails / unsubscribed",
  owner: "Owner or test account",
  no_email: "No usable email address",
  gate: "Refused by the email gate (suppressed, bounced…)",
});

// The example picture in email 2 (a jpg: some mail apps don't show webp). Change it here.
export const EMAIL_EXAMPLE = Object.freeze({ image: "/onboarding/demo/landfill.jpg", title: "How a landfill works", line: "a 3D how-it-works video, made with Zyvo" });

export const PLAN_NAMES = Object.freeze({ starter: "Starter", pro: "Pro", generative: "Generative" });

/** "starter"/"monthly" for one of today's plan price ids, or null (a legacy price, a top-up: no reminder). */
export function planOfPrice(priceId) {
  for (const [plan, ids] of Object.entries(PLAN_PRICE_IDS)) {
    if (ids.monthly === priceId) return { plan, billing: "monthly" };
    if (ids.yearly === priceId) return { plan, billing: "yearly" };
  }
  return null;
}

/**
 * What to do now for one sequence → { send: step } | { skip: step, why } | { wait: true } | { done: true }.
 *   r: { openedAt, lastOpenedAt, stopped }   sends: [{ step, sentAt, skipped }]
 */
export function nextAction(r, sends = [], now = Date.now()) {
  if (r?.stopped) return { done: true };
  const opened = Date.parse(r.openedAt), left = Date.parse(r.lastOpenedAt ?? r.openedAt);
  if (!Number.isFinite(opened)) return { done: true };
  const had = new Map(sends.map((s) => [Number(s.step), s]));
  const lastSent = Math.max(0, ...sends.filter((s) => s.sentAt && !s.skipped).map((s) => Date.parse(s.sentAt)));
  for (const step of STEPS) {
    if (had.has(step)) continue;
    const t = TIMING[step], base = t.from === "left" ? left : opened;
    if (now > opened + t.untilH * H) return { skip: step, why: "too late" };
    if (now < base + t.fromH * H) return { wait: true };
    if (lastSent && now - lastSent < MIN_GAP_H * H) return { wait: true };
    return { send: step };
  }
  return { done: true };
}

const money = (cents, currency = "eur") => new Intl.NumberFormat("en-IE", { style: "currency", currency: String(currency || "eur").toUpperCase() }).format(cents / 100);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** The button's address: our page that opens checkout for the same plan (signing in first if needed) and counts the click. */
export function continueLink({ id, plan, billing, step }) {
  const q = new URLSearchParams({ plan, billing, t: id, s: String(step), from: "email", r: `checkout_${step}` });
  return `${APP_URL}/billing/continue?${q}`;
}

/** The launch deal as it applies to this plan right now: { first, endsDay } or null. */
export function dealNow({ plan, billing, amount, currency }, now = Date.now()) {
  if (!launchDealFor({ plan, billing, at: now, paidBefore: false }).apply || !(amount > 0)) return null;
  const end = new Date(LAUNCH_DEAL.endsAt);
  return {
    first: money(launchDealPrice(amount), currency),
    percent: LAUNCH_DEAL.percentOff,
    // in Finnish time, as the deal is defined; hours left decide "today"/"tomorrow"
    endsDay: end.toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/Helsinki" }),
    hoursLeft: Math.max(0, Math.round((end.getTime() - now) / H)),
  };
}

const button = (url, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td style="border-radius:10px;background:#BEF264">
  <a href="${esc(url)}" style="display:inline-block;padding:13px 24px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#11150D;text-decoration:none">${esc(label)}</a></td></tr></table>`;
const p = (s) => `<p style="margin:0 0 14px">${s}</p>`;
const page = (inner, footer) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#222222;max-width:520px">${inner}${footer.html}</div>`;

/**
 * One email → { subject, why, render(footer) → { html, text } }.
 *   r: { id, plan, billing, amount (the normal price in cents), currency }
 */
export function reminderEmail(step, r, now = Date.now()) {
  const name = PLAN_NAMES[r.plan] ?? "Zyvo";
  const credits = PLAN_CREDITS[r.plan];
  const price = r.amount > 0 ? `${money(r.amount, r.currency)} a ${r.billing === "yearly" ? "year" : "month"}` : "";
  const deal = dealNow(r, now);
  const link = continueLink({ id: r.id, plan: r.plan, billing: r.billing, step });
  const dealLine = deal ? `Launch deal: ${name} is ${deal.first} for your first month (normally ${money(r.amount, r.currency)}), until ${deal.endsDay} 23:59 Finnish time.` : "";
  const why = "You're getting this because you started a checkout on Zyvo.";
  const gets = [
    credits ? `${credits.toLocaleString("en-US")} credits every month` : null,
    "every template: story videos, explainers, images and more",
    "cancel anytime",
  ].filter(Boolean);

  if (step === 1) {
    const lines = [
      "Hi,",
      `You picked the ${esc(name)} plan on Zyvo, but the checkout didn't finish. It's saved, so you can pick up where you left off:`,
    ];
    return {
      subject: `Your ${name} plan is waiting`,
      why,
      render: (footer) => ({
        html: page(`${p(lines[0])}${p(lines[1])}
          <p style="margin:0 0 6px;font-weight:700">${esc(name)}${price ? ` · ${esc(price)}` : ""}</p>
          <ul style="margin:0 0 14px;padding-left:20px">${gets.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>
          ${deal ? p(`<b>${esc(dealLine)}</b>`) : ""}
          ${button(link, `Finish my ${name} checkout`)}
          ${p("If something went wrong at checkout, just reply to this email and I'll help.")}
          ${p("Niko, Zyvo")}`, footer),
        text: [lines[0], "", lines[1], "", `${name}${price ? ` · ${price}` : ""}`, ...gets.map((g) => `- ${g}`), "", ...(deal ? [dealLine, ""] : []), `Finish my checkout: ${link}`, "", "If something went wrong at checkout, just reply to this email and I'll help.", "", "Niko, Zyvo", "", footer.text].join("\n"),
      }),
    };
  }

  if (step === 2) {
    const img = `${APP_URL}${EMAIL_EXAMPLE.image}`;
    return {
      subject: "Here's what you can make with Zyvo",
      why,
      render: (footer) => ({
        html: page(`${p("Hi,")}
          ${p("Here's a video made with Zyvo. You type the idea; Zyvo writes the script, adds the voice and makes every scene.")}
          <a href="${esc(link)}" style="display:block;margin:0 0 8px"><img src="${esc(img)}" alt="${esc(EMAIL_EXAMPLE.title)}" width="240" style="display:block;width:240px;max-width:100%;border-radius:14px;border:0"></a>
          <p style="margin:0 0 16px;font-size:13px;color:#666">${esc(EMAIL_EXAMPLE.title)}: ${esc(EMAIL_EXAMPLE.line)}</p>
          ${deal ? p(`<b>${esc(dealLine)}</b>`) : ""}
          ${button(link, `Make my own with ${name}`)}
          ${p("Niko, Zyvo")}`, footer),
        text: ["Hi,", "", "Here's a video made with Zyvo. You type the idea; Zyvo writes the script, adds the voice and makes every scene.", "", `${EMAIL_EXAMPLE.title}: ${img}`, "", ...(deal ? [dealLine, ""] : []), `Make my own with ${name}: ${link}`, "", "Niko, Zyvo", "", footer.text].join("\n"),
      }),
    };
  }

  // step 3: the deal only if it is really still on, and "ending" only while it ends within the next 3 days
  const ending = deal && deal.hoursLeft <= 72;
  const lastLine = ending
    ? `The launch deal ends ${deal.hoursLeft <= 24 ? "today" : deal.endsDay} at 23:59 Finnish time: ${name} is ${deal.first} for your first month until then.`
    : deal ? dealLine : "";
  return {
    subject: ending ? `The ${name} launch deal ends ${deal.hoursLeft <= 24 ? "today" : deal.endsDay}` : `Still want your ${name} plan?`,
    why,
    render: (footer) => ({
      html: page(`${p("Hi,")}
        ${p(`A last note about the ${esc(name)} plan you picked. It's still there if you want it${price ? `: ${esc(price)}, cancel anytime` : ""}.`)}
        ${lastLine ? p(`<b>${esc(lastLine)}</b>`) : ""}
        ${button(link, `Finish my ${name} checkout`)}
        ${p("This is the last email about it. If Zyvo isn't for you, no worries, and if something got in the way, reply and tell me.")}
        ${p("Niko, Zyvo")}`, footer),
      text: ["Hi,", "", `A last note about the ${name} plan you picked. It's still there if you want it${price ? `: ${price}, cancel anytime` : ""}.`, "", ...(lastLine ? [lastLine, ""] : []), `Finish my checkout: ${link}`, "", "This is the last email about it. If Zyvo isn't for you, no worries, and if something got in the way, reply and tell me.", "", "Niko, Zyvo", "", footer.text].join("\n"),
    }),
  };
}

/**
 * The admin numbers, one row per email: sent, opened (and opened more than a minute after delivery: fewer machine
 * opens), clicked (our page counts the click), paid after it. sends: [{ reminder_id, step, resend_id, sent_at,
 * clicked_at }], reminders: [{ id, paid_at }], emailEvents: [{ resend_id, type, created_at }].
 * @param {{ sends?: any[], reminders?: any[], emailEvents?: any[] }} [input]
 */
export function reminderStats({ sends = [], reminders = [], emailEvents = [] } = {}) {
  const first = (type) => {
    const m = new Map();
    for (const e of emailEvents) if (e.type === type) { const t = Date.parse(e.created_at); if (!m.has(e.resend_id) || t < m.get(e.resend_id)) m.set(e.resend_id, t); }
    return m;
  };
  const delivered = first("email.delivered"), opened = first("email.opened"), bounced = first("email.bounced"), spam = first("email.complained");
  const paidAt = new Map(reminders.filter((r) => r.paid_at).map((r) => [r.id, Date.parse(r.paid_at)]));
  const pct = (n, of) => (of > 0 ? Math.round((n / of) * 100) : 0);
  return STEPS.map((step) => {
    const rows = sends.filter((s) => Number(s.step) === step && s.resend_id);
    const r = { step, label: STEP_LABELS[step], sent: rows.length, delivered: 0, bounced: 0, spam: 0, opened: 0, openedLater: 0, clicked: 0, paid: 0 };
    for (const s of rows) {
      const id = s.resend_id, at = Date.parse(s.sent_at);
      if (delivered.has(id)) r.delivered++;
      if (bounced.has(id)) r.bounced++;
      if (spam.has(id)) r.spam++;
      if (opened.has(id)) { r.opened++; if (opened.get(id) - (delivered.get(id) ?? at) > 60000) r.openedLater++; }
      if (s.clicked_at) r.clicked++;
      if (paidAt.has(s.reminder_id) && paidAt.get(s.reminder_id) > at) r.paid++;
    }
    return { ...r, openPct: pct(r.opened, r.sent), clickPct: pct(r.clicked, r.sent), paidPct: pct(r.paid, r.sent) };
  });
}
