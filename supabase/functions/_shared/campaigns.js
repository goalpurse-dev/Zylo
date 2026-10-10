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

export const CAMPAIGNS = {
  // The warm-up, day 1 (owner's text, 2026-10-10): the 200 newest people who are ON.
  warmup_day1: {
    from: SENDERS.niko,
    replyTo: REPLY_TO.niko,
    subject: "quick question",
    why: CAMPAIGN_WHY,
    plain: true,
    render: plainEmail([
      "Hey,",
      "I'm Niko, I built Zyvo. You signed up recently and I wanted to say thanks.",
      "Quick question: what are you hoping to make with Zyvo?",
      "Just hit reply, I read every answer.",
    ], "Niko"),
  },
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

// Everything the stop rules and the report need, counted fresh. sb: a service-role Supabase client.
export async function campaignNumbers(sb, id, startsAt) {
  const count = async (table, build) => (await build(sb.from(table).select("id", { count: "exact", head: true }).eq("campaign", id))).count ?? 0;
  const q = (status) => count("email_campaign_queue", (x) => x.eq("status", status));
  const ev = (type) => count("email_events", (x) => x.eq("type", type));
  const [sent, queued, sending, skipped, failed, delivered, bounces, suppressed, complained, permanent] = await Promise.all([
    q("sent"), q("queued"), q("sending"), q("skipped"), q("failed"),
    ev("email.delivered"), ev("email.bounced"), ev("email.suppressed"), ev("email.complained"),
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
  return { sent, queued: queued + sending, skipped, failed, delivered, bounced: bounces + suppressed, bouncedPermanent: permanent + suppressed, complained, unsubscribed: out.size };
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
    "Opens: not measured (open tracking is off: it would add a hidden image to a plain email).",
    "Replies: they arrive at niko@tryzyvo.com; they can't be counted from here.",
    "Gmail does not report spam complaints to us: its spam rate shows in Google Postmaster Tools a day or two later.",
  ].join("\n");
}
