// The emails the outbox sends (email_outbox.template → subject, html, text).
// Plain JS with no imports, so the same file runs in the email-sender edge
// function and in the tests. A template gets { payload, profile, links } and
// only states what those say: no amounts or promises are typed in here.

// Who the mail is from. Replies go to support in both cases.
// Two sending domains, because click tracking is a per-domain switch in Resend
// and so is the reputation a domain earns:
//   tryzyvo.com       transactional (welcome, receipts, plan changes; Supabase
//                     Auth sends from it too). Click tracking OFF: links stay
//                     the tryzyvo.com addresses the reader sees.
//   mail.tryzyvo.com  marketing (campaigns, reminders). Click tracking ON.
export const SENDERS = {
  transactional: "Zyvo <hello@tryzyvo.com>",
  marketing: "Zyvo <updates@mail.tryzyvo.com>",
};
export const REPLY_TO = "support@tryzyvo.com";
export const APP = "https://www.tryzyvo.com";

const PLAN_NAMES = { starter: "Starter", pro: "Pro", generative: "Generative" };
// Quality tiers per plan, as on the pricing page (components/pricing/PricingData PLAN_COPY).
const PLAN_TIERS = { starter: "V2", pro: "V2 and V3", generative: "V2, V3 and V4" };

// Brand (the same palette as emails/LongFormLaunchEmail.js)
const BG = "#0A0B0D", CARD = "#131518", LINE = "#24272C", TEXT = "#FFFFFF", MUTED = "#A3A8B3", LIME = "#C5F35B";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => Number(n).toLocaleString("en-US");
const planName = (code) => PLAN_NAMES[String(code ?? "").toLowerCase()] ?? null;
/** "4 Nov 2026" from an ISO string or unix seconds; null when there is no date. */
export function formatDate(value) {
  if (value == null || value === "") return null;
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * One layout for every email: logo, a card with heading + paragraphs + one
 * button, a footer. paragraphs are already-escaped HTML strings.
 */
function layout({ subject, preheader, heading, paragraphs, button, footer }) {
  const p = paragraphs.map((html) => `<p style="margin:0 0 16px 0;font:400 15px/1.6 ${FONT};color:${MUTED};">${html}</p>`).join("\n    ");
  const cta = button ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td style="border-radius:12px;background:${LIME};">
      <a href="${button.url}" target="_blank" style="display:inline-block;padding:14px 26px;font:800 15px ${FONT};color:${BG};text-decoration:none;border-radius:12px;">${esc(button.label)}</a>
    </td></tr></table>` : "";
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 20px 4px;font:800 22px ${FONT};color:${TEXT};"><span style="color:${LIME};">Z</span>yvo</td></tr>
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:30px 28px;">
    <h1 style="margin:0 0 16px 0;font:800 26px/1.2 ${FONT};color:${TEXT};">${esc(heading)}</h1>
    ${p}${cta}
  </td></tr>
  <tr><td style="padding:22px 8px 0 8px;text-align:center;font:400 12px/1.6 ${FONT};color:#6B707C;">
    ${footer}
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const link = (url, label) => `<a href="${url}" style="color:${LIME};text-decoration:underline;">${esc(label)}</a>`;
const strong = (s) => `<span style="color:${TEXT};font-weight:700;">${esc(s)}</span>`;

// Why the reader gets the mail, per category.
const transactionalFooter = `You're getting this because you have a Zyvo account. Questions? Just reply, or write to ${link(`mailto:${REPLY_TO}`, REPLY_TO)}.<br>${link(APP, "tryzyvo.com")}`;
const marketingFooter = (links) => `You're getting this because product updates are turned on for your Zyvo account.<br>${link(links.pageUrl, "Unsubscribe from updates")} &nbsp;·&nbsp; ${link(APP, "tryzyvo.com")}`;

export const TEMPLATES = {
  /** A new account. Says what a free account includes and where to start. */
  welcome() {
    const subject = "Welcome to Zyvo";
    return {
      subject,
      html: layout({
        subject,
        preheader: "Your account is ready. Here is where to start.",
        heading: "Welcome to Zyvo",
        paragraphs: [
          "Your account is ready.",
          `Zyvo turns one idea into finished videos: ${strong("Long Form")} makes full 8–15 minute YouTube explainers, and ${strong("Short Form")} makes 9:16 clips for TikTok, Reels and Shorts.`,
          `Your free account includes 5 AI images every 30 days and a look around every tool. Making videos needs a plan: ${link(`${APP}/pricing`, "see the plans")}.`,
        ],
        button: { url: APP, label: "Open Zyvo" },
        footer: transactionalFooter,
      }),
      text: `Welcome to Zyvo

Your account is ready.

Zyvo turns one idea into finished videos: Long Form makes full 8–15 minute YouTube explainers, and Short Form makes 9:16 clips for TikTok, Reels and Shorts.

Your free account includes 5 AI images every 30 days and a look around every tool. Making videos needs a plan: ${APP}/pricing

Open Zyvo: ${APP}

Questions? Just reply, or write to ${REPLY_TO}.`,
    };
  },

  /**
   * The first payment of a subscription.
   * payload: { plan, credits, interval: "monthly" | "yearly", period_end (ISO) }
   */
  plan_welcome({ payload }) {
    const plan = planName(payload.plan);
    if (!plan) throw new Error(`plan_welcome: unknown plan ${payload.plan}`);
    const credits = Number(payload.credits);
    const yearly = payload.interval === "yearly";
    const renews = formatDate(payload.period_end);
    const tiers = PLAN_TIERS[String(payload.plan).toLowerCase()];
    const subject = `You're now a Zyvo partner: ${plan} is active`;
    const creditsLine = credits > 0
      ? (yearly ? `${num(credits)} credits are in your account now, and ${num(credits)} more arrive every month of your plan year.` : `${num(credits)} credits are in your account now, and ${num(credits)} more arrive with every monthly renewal.`)
      : "Your plan is active.";
    const renewLine = renews ? `Your plan renews on ${renews}. You can change or cancel it any time in your billing settings.` : "You can change or cancel your plan any time in your billing settings.";
    return {
      subject,
      html: layout({
        subject,
        preheader: `${plan} is active${credits > 0 ? ` and ${num(credits)} credits are in your account` : ""}.`,
        heading: "You're now a Zyvo partner",
        paragraphs: [
          `Thank you. Your ${strong(plan)} plan is active.`,
          esc(creditsLine),
          `${esc(plan)} includes every Zyvo tool and template at ${esc(tiers)} quality, Long Form YouTube videos and watermark-free exports.`,
          `${esc(renewLine)} ${link(`${APP}/settings?tab=billing`, "Billing settings")}`,
          "Stripe sends your receipt in a separate email.",
        ],
        button: { url: APP, label: "Start creating" },
        footer: transactionalFooter,
      }),
      text: `You're now a Zyvo partner

Thank you. Your ${plan} plan is active.

${creditsLine}

${plan} includes every Zyvo tool and template at ${tiers} quality, Long Form YouTube videos and watermark-free exports.

${renewLine}
Billing settings: ${APP}/settings?tab=billing

Stripe sends your receipt in a separate email.

Start creating: ${APP}

Questions? Just reply, or write to ${REPLY_TO}.`,
    };
  },

  /**
   * A paid credit pack. payload: { credits }. The balance is the profile's, read when the mail is sent.
   */
  pack_confirmation({ payload, profile }) {
    const credits = Number(payload.credits);
    if (!(credits > 0)) throw new Error("pack_confirmation: no credits in the payload");
    const balance = Number(profile?.credit_balance);
    const subject = `${num(credits)} credits added to your Zyvo account`;
    const balanceLine = Number.isFinite(balance) && balance >= credits ? `Your balance is now ${num(balance)} credits.` : null;
    return {
      subject,
      html: layout({
        subject,
        preheader: `Your credit pack is in: ${num(credits)} credits.`,
        heading: `${num(credits)} credits added`,
        paragraphs: [
          `Thank you. Your credit pack is in: ${strong(`${num(credits)} credits`)} were added to your account.`,
          ...(balanceLine ? [esc(balanceLine)] : []),
          "Pack credits never expire and stack on top of your plan.",
          "Stripe sends your receipt in a separate email.",
        ],
        button: { url: APP, label: "Open Zyvo" },
        footer: transactionalFooter,
      }),
      text: `${num(credits)} credits added

Thank you. Your credit pack is in: ${num(credits)} credits were added to your account.
${balanceLine ? `${balanceLine}\n` : ""}
Pack credits never expire and stack on top of your plan.

Stripe sends your receipt in a separate email.

Open Zyvo: ${APP}

Questions? Just reply, or write to ${REPLY_TO}.`,
    };
  },

  /**
   * The subscription is over (cancelled at period end, or unpaid after Stripe's retries).
   * payload: { plan, reason: "canceled" | "unpaid" | ... }
   */
  plan_ended({ payload, profile }) {
    const plan = planName(payload.plan);
    const what = plan ? `${plan} plan` : "plan";
    const unpaid = payload.reason === "unpaid";
    const balance = Number(profile?.credit_balance);
    const subject = "Your Zyvo plan has ended";
    const why = unpaid
      ? `Your ${what} has ended because the last payment didn't go through.`
      : `Your ${what} has ended.`;
    const keep = Number.isFinite(balance) && balance > 0
      ? `The ${num(balance)} credits on your account stay yours, and your creations stay in your library.`
      : "Your creations stay in your library.";
    return {
      subject,
      html: layout({
        subject,
        preheader: `${why} You can come back any time.`,
        heading: "Your plan has ended",
        paragraphs: [
          esc(why),
          esc(keep),
          "Your account is now on the free plan: 5 AI images every 30 days. Making new videos needs a plan again.",
          "You can pick a plan again whenever you like.",
        ],
        button: { url: `${APP}/pricing`, label: "See the plans" },
        footer: transactionalFooter,
      }),
      text: `Your plan has ended

${why}

${keep}

Your account is now on the free plan: 5 AI images every 30 days. Making new videos needs a plan again.

You can pick a plan again whenever you like: ${APP}/pricing

Questions? Just reply, or write to ${REPLY_TO}.`,
    };
  },
};

/**
 * { subject, html, text } for one outbox row. Throws for an unknown template or
 * a payload the template can't use: the row is then marked failed, not retried.
 * links: { pageUrl, oneClickUrl } for marketing mail (unsubscribe), else null.
 */
export function renderEmail(template, { payload = {}, profile = null, links = null } = {}) {
  const make = TEMPLATES[template];
  if (!make) throw new Error(`unknown email template: ${template}`);
  return make({ payload: payload ?? {}, profile, links, marketingFooter });
}
