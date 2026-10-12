// _shared/campaigns.js — the scheduled campaigns: what each one says, and when a
// running one must stop. Plain JS, no imports from Deno: the campaign-sender
// function, scripts/warmupCampaign.mjs and the tests read this one file.
// WHO gets a campaign and WHEN is in the database (email_campaigns,
// email_campaign_queue); every send still passes the email gate.
import { APP_URL, REPLY_TO, SENDERS } from "./emailRules.js";

export const CAMPAIGN_WHY = "You're getting this because product updates are turned on for your Zyvo account.";

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

// The warm-up email (owner's text). Only the line about when they signed up differs between the days.
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

export const CAMPAIGNS = {
  // Day 1 (2026-10-11): the 200 newest people who are ON. Sent before open tracking was switched on.
  warmup_day1: warmup("You signed up recently"),
  // Days 2 and 3 (owner, 2026-10-12): the next 300, then the next 500, older sign-ups. Day 3 runs
  // only if day 2 went well (email_campaigns.depends_on, previousCampaignProblem below).
  // opensTracked: open tracking is on for mail.tryzyvo.com since 2026-10-12 (the owner's choice).
  warmup_day2: warmup("You signed up for Zyvo a while ago", { opensTracked: true }),
  warmup_day3: warmup("You signed up for Zyvo a while ago", { opensTracked: true }),
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

// Everything the stop rules and the report need, counted fresh. sb: a service-role Supabase client.
export async function campaignNumbers(sb, id, startsAt) {
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
  const { data: recipients } = await sb.from("email_campaign_queue").select("profile_id").eq("campaign", id).eq("status", "sent");
  const got = new Set((recipients ?? []).map((r) => r.profile_id));
  const { data: log } = await sb.from("system_logs").select("user_id, event").eq("source", "email-unsubscribe").gte("created_at", startsAt).order("created_at");
  const out = new Set();
  for (const u of log ?? []) {
    if (!got.has(u.user_id)) continue;
    if (u.event === "email_unsubscribed") out.add(u.user_id); else out.delete(u.user_id);
  }
  return { sent, queued: queued + sending, skipped, failed, delivered, bounced: bounces + suppressed, bouncedPermanent: permanent + suppressed, complained, opened, unsubscribed: out.size };
}

// The numbers of a campaign in a few lines (the report email and scripts/warmupCampaign.mjs --report).
export function campaignReportText(id, c, n) {
  const pct = (x) => (n.sent ? ` (${((x / n.sent) * 100).toFixed(1)}%)` : "");
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
    "Replies: they arrive at niko@tryzyvo.com; they can't be counted from here.",
    "Gmail does not report spam complaints to us: its spam rate shows in Google Postmaster Tools a day or two later.",
  ].join("\n");
}
