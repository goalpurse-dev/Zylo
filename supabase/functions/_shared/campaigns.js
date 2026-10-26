// _shared/campaigns.js — the scheduled campaigns: what each one says, and when a
// running one must stop. Plain JS, no imports from Deno: the campaign-sender
// function, scripts/warmupCampaign.mjs and the tests read this one file.
// WHO gets a campaign and WHEN is in the database (email_campaigns,
// email_campaign_queue); every send still passes the email gate.
import { APP_URL, REPLY_TO, SENDERS } from "./emailRules.js";

export const CAMPAIGN_WHY = "You're getting this because product updates are turned on for your Zyvo account.";
// The Cutaway Explainer page (src/data/cutawayExplainer.js: CUTAWAY_PATH).
export const CUTAWAY_URL = `${APP_URL}/workspace/cutaway-explainer`;

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// A plain personal email: paragraphs, a signature with the one link, the footer. No images, no layout.
function plainEmail(paragraphs, signature) {
  return (footer) => ({
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222;max-width:560px;">
${paragraphs.map((p) => `<p style="margin:0 0 16px 0;">${esc(p)}</p>`).join("\n")}
<p style="margin:0;">${esc(signature)}<br><a href="${APP_URL}" style="color:#1a56db;">tryzyvo.com</a></p>
${footer.html}
</div>`,
    text: `${paragraphs.join("\n\n")}\n\n${signature}\ntryzyvo.com\n\n--\n${footer.text}`,
  });
}

// A plain email whose one link sits inside a paragraph: the paragraph that contains "tryzyvo.com"
// gets it as a link to `opts.link` (decided when the email is sent). No other link but the footer's unsubscribe.
function plainEmailInlineLink(paragraphs, signature) {
  return (footer, opts = {}) => {
    const href = opts.link ?? APP_URL;
    const para = (p) => {
      const at = p.indexOf("tryzyvo.com");
      const body = at < 0 ? esc(p) : `${esc(p.slice(0, at))}<a href="${esc(href)}" style="color:#1a56db;">tryzyvo.com</a>${esc(p.slice(at + "tryzyvo.com".length))}`;
      return `<p style="margin:0 0 16px 0;">${body}</p>`;
    };
    return {
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222;max-width:560px;">
${paragraphs.map(para).join("\n")}
<p style="margin:0;">${esc(signature)}</p>
${footer.html}
</div>`,
      text: `${paragraphs.map((p) => p.replace("tryzyvo.com", href.replace(/^https:\/\/www\./, ""))).join("\n\n")}\n\n${signature}\n\n--\n${footer.text}`,
    };
  };
}

// The warm-up email, days 1–3 (owner's text). Only the line about when they signed up differs between the days.
const warmup = (signedUpLine, extra = {}) => ({
  from: SENDERS.niko,
  replyTo: REPLY_TO.niko,
  subject: "quick question",
  why: CAMPAIGN_WHY,
  plain: true,
  render: plainEmail([
    "Hey,",
    `I'm Niko, I built Zyvo. ${signedUpLine} and I wanted to say thanks.`,
    "Quick question: what are you hoping to make with Zyvo?",
    "Just hit reply, I read every answer.",
  ], "Niko"),
  ...extra,
});

// The warm-up email from day 4 on (owner's text, second version, 2026-10-26). Its one link always
// goes to tryzyvo.com (owner: "Link always to tryzyvo.com for these days, not the Cutaway page").
const facelessEmail = {
  from: SENDERS.niko,
  replyTo: REPLY_TO.niko,
  subject: "you can make this without showing your face",
  why: CAMPAIGN_WHY,
  plain: true,
  opensTracked: true,
  render: plainEmailInlineLink([
    "Hey,",
    "It's Niko from Zyvo. Thanks for signing up. Here's what you can make with it.",
    "Pick a template and Zyvo makes the whole faceless video for you. Ready to post on TikTok, Shorts or Reels. No camera, no editing.",
    "There are different styles, like 3D, so you can find one that fits your page.",
    "Try it here: tryzyvo.com",
    "If you make something, reply and send it to me. I want to see it.",
  ], "Niko"),
};

// "Still want to hear from me?" for people who signed up more than 6 months ago (built 2026-10-26,
// NOT queued: the owner decides when). Gentle version: nothing to do to stay, one click to leave.
const stillWantToHear = {
  from: SENDERS.niko,
  replyTo: REPLY_TO.niko,
  subject: "still want to hear from me?",
  why: CAMPAIGN_WHY,
  plain: true,
  opensTracked: true,
  render: plainEmail([
    "Hey,",
    "It's Niko from Zyvo. You signed up a while back, and I don't want to fill your inbox with emails you don't read.",
    "So, quick check: do you still want the occasional update from me? New templates, new ways to make videos without showing your face.",
    "If yes, you don't need to do anything. If not, the unsubscribe link is right below: one click and you won't hear from me again.",
    "Either way, thanks for trying Zyvo.",
  ], "Niko"),
};

export const CAMPAIGNS = {
  // Day 1 (2026-10-11): the 200 newest people who are ON. Sent before open tracking was switched on.
  warmup_day1: warmup("You signed up recently"),
  // Days 2 and 3 (owner, 2026-10-12): the next 300, then the next 500, older sign-ups. Day 3 runs
  // only if day 2 went well (email_campaigns.depends_on, previousCampaignProblem below).
  // opensTracked: open tracking is on for mail.tryzyvo.com since 2026-10-12 (the owner's choice).
  warmup_day2: warmup("You signed up for Zyvo a while ago", { opensTracked: true }),
  warmup_day3: warmup("You signed up for Zyvo a while ago", { opensTracked: true }),
  // Days 4–7 (owner, 2026-10-26): the new email. Day 4: the 1,000 who got "quick question";
  // days 5–7: people from the last 6 months who had no warm-up email yet (1,250, 1,500, the rest).
  warmup_day4: facelessEmail,
  warmup_day5: facelessEmail,
  warmup_day6: facelessEmail,
  warmup_day7: facelessEmail,
  // "Still want to hear from me?" (owner, 2026-10-26: the gentle version), for the people who are
  // ON and signed up before 2026-04-26, split over two days after day 7.
  still_want_updates: stillWantToHear,
  still_want_updates_1: stillWantToHear,
  still_want_updates_2: stillWantToHear,
};

// The owner's stop rules for a running campaign (2026-10-10):
//   - any spam complaint                         → stop
//   - bounces over 2% of the emails sent so far  → stop (a single bounce never
//     stops it on its own: 1 of the first 20 is 5%, and it says nothing yet)
// And one of ours: Resend refusing 5 sends means something is broken.
export const MAX_BOUNCE_RATE = 0.02;
export function campaignStopReason({ sent = 0, bounced = 0, complained = 0, failed = 0 }) {
  if (complained > 0) return `a spam complaint (${complained})`;
  if (bounced >= 2 && bounced > sent * MAX_BOUNCE_RATE) return `bounces over 2%: ${bounced} of ${sent} sent`;
  if (failed >= 5) return `Resend refused ${failed} sends`;
  return null;
}

// A campaign with depends_on may only run if the one before it went well (owner, 2026-10-12):
// it finished, with 0 spam complaints and bounces UNDER 2% of what it sent. → the problem, or null.
// prev: the earlier campaign's row (or null), n: its campaignNumbers.
export function previousCampaignProblem(prev, n) {
  if (!prev) return "the campaign before it does not exist";
  if (prev.status === "stopped") return `${prev.id} was stopped (${prev.stop_reason ?? "no reason recorded"})`;
  if (prev.status !== "done") return `${prev.id} has not finished (it is "${prev.status}")`;
  if (!n || n.sent === 0) return `${prev.id} sent nothing`;
  if (n.complained > 0) return `${prev.id} had a spam complaint (${n.complained})`;
  if (n.bounced >= n.sent * MAX_BOUNCE_RATE) return `${prev.id} had bounces of 2% or more: ${n.bounced} of ${n.sent}`;
  return null;
}

// The owner's rule of 2026-10-26: a day does not START if the owner alerts showed Runware or the
// voice provider failing in the last 3 hours. Then that day and every later day move one day
// forward (postpone_campaigns) and the owner is emailed; nothing is cancelled. The alerts are emails; what they are sent from is in
// the database, and that is what this reads (the same conditions that send those alert emails):
//   runware: the provider_balance_guard row for "runware" — paused now (out of balance, low
//            balance or "failing every scene"), or an alert sent in the window
//   voice:   system_logs of generate-long-form-narration-audio — a voiceover failed for good, the
//            provider refused our account (401/402/403, quota, payment, key), or a voiceover
//            paused 3 times or more ("keeps failing")
// → the problem in words, or null.
const VOICE_ACCOUNT = /\b40[123]\b|quota_exceeded|insufficient|payment|invalid_api_key|unusual_activity|missing_permissions/i;
export function providerProblem({ runware, voiceLogs = [], sinceIso }) {
  const out = [];
  if (runware && (runware.paused === true || (runware.alerted_at && runware.alerted_at >= sinceIso))) {
    out.push(`Runware is ${runware.paused ? "paused" : "alerting"} (${String(runware.last_error ?? "no detail").slice(0, 100)})`);
  }
  const failed = voiceLogs.filter((l) => l.event === "narration_failed").length;
  const refused = voiceLogs.filter((l) => l.event === "narration_paused" && VOICE_ACCOUNT.test(String(l.details?.error ?? ""))).length;
  const stuck = voiceLogs.filter((l) => l.event === "narration_paused" && Number(l.details?.tries ?? 0) >= 3).length;
  if (failed || refused || stuck) out.push(`the voice provider is failing (${failed} voiceovers failed for good, ${refused} refusals of our account, ${stuck} paused 3+ times)`);
  return out.length ? out.join("; and ") : null;
}

// Plans bought within `hours` of a person's campaign email (owner, 2026-10-26).
// recipients: [{ profile_id, sent_at }], grants: credit_grants rows of those people
// ({ user_id, reason, created_at }) from before the first email on. A purchase is a grant made by a
// payment: "plan_upgrade", "topup", or "plan_renewal" when it is that person's FIRST paid plan
// (a renewal of a plan they already had is not caused by an email and is not counted).
const PAID = new Set(["plan_renewal", "plan_upgrade", "topup"]);
export function purchasesAfter(recipients, grants, hours = 48) {
  const sentAt = new Map(recipients.map((r) => [r.profile_id, Date.parse(r.sent_at)]));
  const byUser = new Map();
  for (const g of grants) if (PAID.has(g.reason) && sentAt.has(g.user_id)) (byUser.get(g.user_id) ?? byUser.set(g.user_id, []).get(g.user_id)).push(g);
  const out = { people: 0, firstPlan: 0, upgrade: 0, topup: 0 };
  for (const [user, list] of byUser) {
    const t0 = sentAt.get(user), t1 = t0 + hours * 3600_000;
    const hadPlanBefore = list.some((g) => (g.reason === "plan_renewal" || g.reason === "plan_upgrade") && Date.parse(g.created_at) < t0);
    const kinds = new Set();
    for (const g of list) {
      const t = Date.parse(g.created_at);
      if (t < t0 || t > t1) continue;
      if (g.reason === "plan_upgrade") kinds.add("upgrade");
      else if (g.reason === "topup") kinds.add("topup");
      else if (!hadPlanBefore) kinds.add("firstPlan");
    }
    if (kinds.size) { out.people++; for (const k of kinds) out[k]++; }
  }
  return out;
}

// All rows of a query, 1,000 at a time (PostgREST returns at most 1,000 per call).
async function allRows(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

// Everything the stop rules and the report need, counted fresh. sb: a service-role Supabase client.
// withPurchases: also count plans bought within 48 hours (for the reports, not for every tick).
export async function campaignNumbers(sb, id, startsAt, { withPurchases = false } = {}) {
  const count = async (table, build) => (await build(sb.from(table).select("id", { count: "exact", head: true }).eq("campaign", id))).count ?? 0;
  const q = (status) => count("email_campaign_queue", (x) => x.eq("status", status));
  const ev = (type) => count("email_events", (x) => x.eq("type", type));
  // email_events holds one row per email and type, so "opened" counts emails opened at least once.
  const [sent, queued, sending, skipped, failed, delivered, bounces, suppressed, complained, opened, permanent] = await Promise.all([
    q("sent"), q("queued"), q("sending"), q("skipped"), q("failed"),
    ev("email.delivered"), ev("email.bounced"), ev("email.suppressed"), ev("email.complained"), ev("email.opened"),
    count("email_events", (x) => x.eq("type", "email.bounced").ilike("detail", "permanent%")),
  ]);
  // Unsubscribes of this campaign's recipients since it started (the email-unsubscribe function logs each one; an Undo takes it back).
  const recipients = await allRows(() => sb.from("email_campaign_queue").select("profile_id, sent_at").eq("campaign", id).eq("status", "sent").order("id"));
  const got = new Set(recipients.map((r) => r.profile_id));
  const log = await allRows(() => sb.from("system_logs").select("user_id, event").eq("source", "email-unsubscribe").gte("created_at", startsAt).order("created_at"));
  const out = new Set();
  for (const u of log) {
    if (!got.has(u.user_id)) continue;
    if (u.event === "email_unsubscribed") out.add(u.user_id); else out.delete(u.user_id);
  }
  const n = { sent, queued: queued + sending, skipped, failed, delivered, bounced: bounces + suppressed, bouncedPermanent: permanent + suppressed, complained, opened, unsubscribed: out.size };
  if (withPurchases && recipients.length) {
    const ids = [...got];
    const grants = [];
    for (let i = 0; i < ids.length; i += 200) {
      grants.push(...await allRows(() => sb.from("credit_grants").select("user_id, reason, created_at").in("user_id", ids.slice(i, i + 200)).in("reason", [...PAID]).order("id")));
    }
    n.purchases = purchasesAfter(recipients, grants, 48);
  }
  return n;
}

// The numbers of a campaign in a few lines (the report email and scripts/warmupCampaign.mjs --report).
export function campaignReportText(id, c, n) {
  const pct = (x) => (n.sent ? ` (${((x / n.sent) * 100).toFixed(1)}%)` : "");
  const p = n.purchases;
  return [
    `Campaign ${id}: ${c.status}${c.stop_reason ? ` — stopped because of ${c.stop_reason}` : ""}`,
    `Planned: ${c.planned}`,
    `Sent: ${n.sent}`,
    `Delivered (accepted by the receiving mail server): ${n.delivered}`,
    `Bounced: ${n.bounced}${pct(n.bounced)}${n.bounced ? ` — permanent ${n.bouncedPermanent}, temporary ${n.bounced - n.bouncedPermanent}` : ""}`,
    `Spam complaints: ${n.complained}`,
    `Unsubscribes: ${n.unsubscribed}${pct(n.unsubscribed)}`,
    `Not sent: ${n.skipped} skipped by the lock or the window, ${n.failed} failed, ${n.queued} still waiting`,
    CAMPAIGNS[id]?.opensTracked
      ? `Opened: ${n.opened ?? 0}${pct(n.opened ?? 0)} — a rough number: some mail apps open every email by themselves, and readers who block images are not counted`
      : "Opens: not measured (open tracking was off for this one).",
    ...(p ? [`Bought within 48 hours of their email: ${p.people}${pct(p.people)} — first plan ${p.firstPlan}, upgrade ${p.upgrade}, credit top-up ${p.topup} (renewals of a plan they already had are not counted; the 48 hours may still be running)`] : []),
    "Replies: they arrive at niko@tryzyvo.com; they can't be counted from here.",
    "Gmail does not report spam complaints to us: its spam rate shows in Google Postmaster Tools a day or two later.",
  ].join("\n");
}
