// emails/marketing.js — the ONLY way a campaign script sends email.
//
// A campaign script gives a template and a campaign name; everything that
// decides WHO may get it and HOW it goes out is here and in the database gate
// (claim_email_send, migration 20261103100000_email_guard.sql):
//   - only profiles with email_updates = true (checked again by the gate at send time)
//   - never an address on email_suppressions (bounced, complained, invalid)
//   - once per campaign per address, at most 3 emails per address in 24 hours
//   - from mail.tryzyvo.com, with the one-click unsubscribe headers, a footer
//     link and the company line (COMPANY_FOOTER: no company line, no campaign)
//   - one email at a time, slowly; a run sends at most MAX_PER_RUN
// tests/emailRules.test.mjs fails when a script calls Resend without this file.
import { COMPANY_FOOTER, SENDERS, REPLY_TO, checkEmailAddress, emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { unsubscribeLinks } from "./unsubscribeLink.js";

export const DEFAULT_PER_RUN = 200;
export const MAX_PER_RUN = 1000;
const PAUSE_BETWEEN_SENDS_MS = 1000;
export const CAMPAIGN_WHY = "You're getting this because product updates are turned on for your Zyvo account.";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const all = async (build) => {
  const out = [];
  for (let from = 0; ; from += 1000) { // PostgREST returns at most 1000 rows per call
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) return out;
  }
};

// Why a campaign can't go out at all right now (empty array = it can).
export function campaignBlockers(env = process.env) {
  const out = [];
  if (!COMPANY_FOOTER) out.push("COMPANY_FOOTER is empty in supabase/functions/_shared/emailRules.js (business name + postal address)");
  if (!env.EMAIL_UNSUBSCRIBE_SECRET) out.push("EMAIL_UNSUBSCRIBE_SECRET is missing in .env.local");
  if (!(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)) out.push("SUPABASE_URL is missing in .env.local");
  return out;
}

// Everyone a campaign may be sent to: email_updates = true, a usable address, one row per address, not suppressed.
export async function marketingRecipients(admin) {
  const [profiles, suppressed] = await Promise.all([
    all(() => admin.from("profiles").select("id, email, full_name").eq("email_updates", true).not("email", "is", null).order("id")),
    all(() => admin.from("email_suppressions").select("email").order("email")),
  ]);
  const never = new Set(suppressed.map((s) => s.email));
  const seen = new Set();
  const skipped = { badAddress: 0, duplicate: 0, suppressed: 0 };
  const list = [];
  for (const p of profiles) {
    const check = checkEmailAddress(p.email);
    if (!check.ok) { skipped.badAddress++; continue; }
    if (seen.has(check.email)) { skipped.duplicate++; continue; }
    seen.add(check.email);
    if (never.has(check.email)) { skipped.suppressed++; continue; }
    list.push({ id: p.id, email: check.email, full_name: p.full_name });
  }
  return { list, skipped, optedIn: profiles.length };
}

// The message for one person. render({ name, footer, unsubscribeUrl }) → { subject, html, text }.
export function campaignMessage({ profile, campaign, render, env = process.env }) {
  const links = unsubscribeLinks(profile.id, { secret: env.EMAIL_UNSUBSCRIBE_SECRET, supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, app: "https://www.tryzyvo.com" });
  const footer = emailFooter({ unsubscribeUrl: links.pageUrl, why: CAMPAIGN_WHY });
  const m = render({ name: profile.full_name, footer, unsubscribeUrl: links.pageUrl });
  return {
    from: SENDERS.updates,
    replyTo: REPLY_TO.updates,
    to: profile.email,
    subject: m.subject,
    html: m.html,
    text: m.text,
    // One-click unsubscribe (RFC 8058) — Gmail and Yahoo require this for bulk senders.
    headers: { "List-Unsubscribe": `<${links.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: [{ name: "campaign", value: campaign }],
  };
}

// One email to one person, through the gate. → { sent: true, resendId } or { sent: false, reason }.
// test: a proof copy to an address that need not be a subscriber (kind "test:…", 20 a day at most).
export async function sendMarketing({ admin, resend, campaign, profile, render, test = false }) {
  const blockers = campaignBlockers();
  if (blockers.length) return { sent: false, reason: `blocked: ${blockers[0]}` };
  const { data: claim, error: gateError } = await admin.rpc("claim_email_send", {
    p_email: profile.email,
    p_kind: test ? `test:${campaign}:${Date.now()}` : `campaign:${campaign}`,
    p_category: test ? "test" : "marketing",
  });
  if (gateError || !claim) return { sent: false, reason: `gate_unavailable: ${gateError?.message ?? "no answer"}` };
  if (!claim.ok) return { sent: false, reason: claim.reason };

  const release = () => admin.from("email_sends").delete().eq("id", claim.id);
  try {
    const m = campaignMessage({ profile, campaign, render });
    const { data, error } = await resend.emails.send(test ? { ...m, subject: `[TEST] ${m.subject}` } : m, { idempotencyKey: `email-send-${claim.id}` });
    if (error) { await release(); return { sent: false, reason: `send_failed: ${error.message}` }; }
    return { sent: true, resendId: data?.id ?? null };
  } catch (e) {
    await release();
    return { sent: false, reason: `send_failed: ${e.message}` };
  }
}

// A slow run over a list: one at a time, at most `count` emails, stops early when Resend keeps failing.
export async function sendCampaign({ admin, resend, campaign, recipients, render, count = DEFAULT_PER_RUN, onResult = () => {} }) {
  const limit = Math.min(Math.max(1, Number(count) || DEFAULT_PER_RUN), MAX_PER_RUN);
  const totals = { sent: 0, skipped: {}, failed: 0 };
  let failuresInARow = 0;
  for (const profile of recipients) {
    if (totals.sent >= limit) break;
    const r = await sendMarketing({ admin, resend, campaign, profile, render });
    onResult(profile, r);
    if (r.sent) { totals.sent++; failuresInARow = 0; await sleep(PAUSE_BETWEEN_SENDS_MS); continue; }
    if (/^(send_failed|gate_unavailable|blocked)/.test(r.reason)) {
      totals.failed++;
      if (r.reason.startsWith("blocked") || ++failuresInARow >= 5) { totals.stopped = r.reason; break; }
      await sleep(PAUSE_BETWEEN_SENDS_MS);
    } else {
      totals.skipped[r.reason] = (totals.skipped[r.reason] ?? 0) + 1; // no_consent, suppressed, already_sent, daily_limit
    }
  }
  return totals;
}
