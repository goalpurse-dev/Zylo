// deno-lint-ignore-file no-explicit-any
// _shared/userEmail.ts — the ONLY way an edge function emails a user.
//
// Every email first passes the database gate claim_email_send (migrations
// 20261103100000_email_guard.sql and 20261104100000_email_guard_limits.sql):
// suppressed addresses get nothing; the same email is sent once; marketing
// needs email_updates = true, at most 1 per address in 24 hours and none in
// the first 24 hours after sign-up; account emails ("your video is ready",
// the welcome email) are counted on their own, so marketing never uses up
// their room. Then it goes out with a signed unsubscribe link, the one-click
// List-Unsubscribe headers and the shared footer.
// Owner alerts (adminAlert.ts) don't come through here: they go to ALERT_EMAIL only.
import { APP_URL, emailFooter } from "./emailRules.js";

const RESEND_API_KEY = () => Deno.env.get("RESEND_API_KEY") ?? "";
const UNSUBSCRIBE_SECRET = () => Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET") ?? "";

export type EmailCategory = "marketing" | "account" | "test"; // test: a proof copy for the owner (20 a day)
export type Claim = { ok: true; id: number } | { ok: false; reason: string };
// Reasons that will never change for this email: don't retry it.
export const FINAL_REASONS = new Set(["bad_address", "bad_request", "suppressed", "no_consent", "already_sent"]);

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// The same signed links as emails/unsubscribeLink.js; checked by the email-unsubscribe function.
export async function unsubscribeLinks(userId: string): Promise<{ pageUrl: string; oneClickUrl: string } | null> {
  const secret = UNSUBSCRIBE_SECRET();
  if (!secret || !userId) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const token = b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsub:${userId}`))));
  const q = `u=${encodeURIComponent(userId)}&t=${token}`;
  return { pageUrl: `${APP_URL}/unsubscribe?${q}`, oneClickUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe?${q}` };
}

// Step 1: ask the gate. Nothing may be sent without an ok claim.
export async function claimEmail(sb: any, to: string, kind: string, category: EmailCategory): Promise<Claim> {
  const { data, error } = await sb.rpc("claim_email_send", { p_email: to, p_kind: kind, p_category: category });
  if (error || !data) {
    console.error("[userEmail] the email gate did not answer, nothing sent:", error?.message ?? "no data");
    return { ok: false, reason: "gate_unavailable" };
  }
  return data as Claim;
}

// The email was not sent after all: give the claim back so a later attempt can send it.
export async function releaseEmail(sb: any, claimId: number): Promise<void> {
  const { error } = await sb.from("email_sends").delete().eq("id", claimId);
  if (error) console.error("[userEmail] could not release claim", claimId, error.message);
}

export type ClaimedEmail = {
  claimId: number;
  to: string;
  userId: string;                    // the profile the unsubscribe link is signed for
  from: string;
  replyTo?: string;
  subject: string;
  why: string;                       // footer line: why this person gets this email
  render: (footer: { html: string; text: string }) => { html: string; text?: string };
  tags?: { name: string; value: string }[];
  plain?: boolean;                   // the plain footer of a personal email (emailFooter's plain)
};

// Step 2: send a claimed email. On any failure the claim is released and false comes back.
export async function sendClaimedEmail(sb: any, m: ClaimedEmail): Promise<boolean> {
  return (await sendClaimedEmailWithId(sb, m)) !== null;
}

// The same, for a caller that keeps Resend's id of the email (campaigns: to match bounces and complaints). null = not sent.
export async function sendClaimedEmailWithId(sb: any, m: ClaimedEmail): Promise<string | null> {
  try {
    const links = await unsubscribeLinks(m.userId);
    if (!RESEND_API_KEY() || !links) throw new Error("RESEND_API_KEY or EMAIL_UNSUBSCRIBE_SECRET is not set");
    const body = m.render(emailFooter({ unsubscribeUrl: links.pageUrl, why: m.why, plain: m.plain === true }));
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `email-send-${m.claimId}`,
      },
      body: JSON.stringify({
        from: m.from,
        to: m.to,
        reply_to: m.replyTo,
        subject: m.subject,
        html: body.html,
        text: body.text,
        // One-click unsubscribe (RFC 8058): the button Gmail and Yahoo show next to the sender.
        headers: { "List-Unsubscribe": `<${links.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: m.tags,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const sent = await res.json().catch(() => ({}));
    return String(sent?.id ?? "");
  } catch (e) {
    console.error("[userEmail] send failed, claim released:", String((e as any)?.message ?? e));
    await releaseEmail(sb, m.claimId);
    return null;
  }
}
