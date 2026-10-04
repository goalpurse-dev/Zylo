// Sends what is due in email_outbox. No Supabase or Resend code in here: the
// caller passes `deps`, so the same logic runs in the email-sender edge function
// and in the tests (against an in-memory Postgres and a fake Resend).
//
// deps:
//   claim(limit)                 → rows (public.claim_emails)
//   finish(id, result, providerId, error)   (public.finish_email)
//   profileOf(userId)            → { id, email, email_updates, welcome_email_sent, credit_balance, plan_code } | null
//   send(message, idempotencyKey) → { ok, status, id, error }   (status 0 = no answer)
//   unsubscribeLinks(userId)     → { pageUrl, oneClickUrl }   (marketing mail only)
//   markWelcomeSent(userId)
//   pause(ms)                    wait between sends (Resend allows 2 requests a second)
import { REPLY_TO, SENDERS, renderEmail } from "./templates.js";

/** Resend answers that are worth another try later: no answer, rate limit, server error, bad key (fixable). */
const retryable = (status) => status === 0 || status === 401 || status === 403 || status === 408 || status === 409 || status === 429 || status >= 500;

/**
 * Decides and sends one claimed row.
 * Returns { result: "sent" | "retry" | "failed" | "skipped" | "canceled", providerId?, error? }.
 */
export async function processRow(row, deps) {
  const profile = row.user_id ? await deps.profileOf(row.user_id) : null;
  if (row.user_id && !profile) return { result: "canceled", error: "the account no longer exists" };

  const to = row.to_email || profile?.email;
  if (!to) return { result: "canceled", error: "no email address" };

  // Marketing mail only with an explicit yes, as it stands at the moment of sending.
  const marketing = row.category === "marketing";
  if (marketing && profile?.email_updates !== true) return { result: "skipped", error: "no marketing consent" };

  // The welcome mail may already have gone out through the old signup endpoint.
  if (row.template === "welcome" && profile?.welcome_email_sent === true) return { result: "skipped", error: "welcome already sent" };

  let rendered, links = null;
  try {
    if (marketing) links = await deps.unsubscribeLinks(row.user_id);
    rendered = renderEmail(row.template, { payload: row.payload, profile, links });
  } catch (e) {
    return { result: "failed", error: `render: ${e instanceof Error ? e.message : String(e)}` };
  }

  const message = {
    from: marketing ? SENDERS.marketing : SENDERS.transactional,
    to: [to],
    reply_to: REPLY_TO,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: [{ name: "template", value: String(row.template).replace(/[^A-Za-z0-9_-]/g, "_") }],
    // One-click unsubscribe (RFC 8058): required by Gmail and Yahoo for bulk mail.
    ...(marketing ? { headers: { "List-Unsubscribe": `<${links.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
  };

  // The row's id as Resend's idempotency key: a second attempt for the same row
  // (a run that died after sending, two overlapping runs) is not a second email.
  const sent = await deps.send(message, `outbox-${row.id}`);
  if (sent.ok) {
    if (row.template === "welcome" && row.user_id) await deps.markWelcomeSent(row.user_id).catch(() => {});
    return { result: "sent", providerId: sent.id ?? null };
  }
  const error = `resend ${sent.status}: ${sent.error ?? "no answer"}`;
  return { result: retryable(sent.status) ? "retry" : "failed", error };
}

/** One sender run. Returns { claimed, sent, retry, failed, skipped, canceled }. */
export async function processOutbox(deps, { limit = 10, pauseMs = 600 } = {}) {
  const summary = { claimed: 0, sent: 0, retry: 0, failed: 0, skipped: 0, canceled: 0 };
  const rows = await deps.claim(limit);
  summary.claimed = rows.length;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let outcome;
    try {
      outcome = await processRow(row, deps);
    } catch (e) {
      // Anything unexpected (a database hiccup): try this row again later.
      outcome = { result: "retry", error: e instanceof Error ? e.message : String(e) };
    }
    try {
      const status = await deps.finish(row.id, outcome.result, outcome.providerId ?? null, outcome.error ?? null);
      // finish_email turns the 6th retry into a final failure.
      summary[outcome.result === "retry" && status === "failed" ? "failed" : outcome.result] += 1;
    } catch (e) {
      // The row stays 'sending' and is claimed again in 10 minutes; Resend's
      // idempotency key keeps that from sending a second email.
      console.error(`[email-outbox] could not record the result of row ${row.id}:`, e instanceof Error ? e.message : e);
      summary[outcome.result] += 1;
    }
    if (outcome.result === "sent" && i < rows.length - 1 && pauseMs > 0) await deps.pause(pauseMs);
  }
  return summary;
}

/**
 * Signed unsubscribe links, the same as emails/unsubscribeLink.js makes:
 * token = base64url(HMAC-SHA256(secret, "unsub:" + userId)), checked by the
 * email-unsubscribe edge function.
 */
export async function unsubscribeLinks(userId, { secret, supabaseUrl, app = "https://tryzyvo.com" }) {
  if (!secret) throw new Error("EMAIL_UNSUBSCRIBE_SECRET is not set");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsub:${userId}`)));
  let bin = "";
  for (const b of mac) bin += String.fromCharCode(b);
  const token = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const q = `u=${encodeURIComponent(userId)}&t=${token}`;
  return { pageUrl: `${app}/unsubscribe?${q}`, oneClickUrl: `${supabaseUrl}/functions/v1/email-unsubscribe?${q}` };
}
