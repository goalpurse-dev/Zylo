// Signed, per-user unsubscribe links for Zyvo product emails.
// token = base64url(HMAC-SHA256(EMAIL_UNSUBSCRIBE_SECRET, "unsub:" + userId)),
// checked by the email-unsubscribe edge function (same secret, set as a
// Supabase function secret). Links never expire; editing u or t breaks them.
import crypto from "node:crypto";

export function unsubscribeToken(userId, secret) {
  if (!secret) throw new Error("EMAIL_UNSUBSCRIBE_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(`unsub:${userId}`).digest("base64url");
}

// pageUrl: the footer link (tryzyvo.com/unsubscribe — unsubscribes on open, with Undo).
// oneClickUrl: the List-Unsubscribe header target (RFC 8058 one-click POST): api/email-unsubscribe.js,
// which passes it on to the email-unsubscribe function (supabaseUrl is no longer used here).
export function unsubscribeLinks(userId, { secret, supabaseUrl, app = "https://tryzyvo.com" }) {
  const q = `u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId, secret)}`;
  return {
    pageUrl: `${app}/unsubscribe?${q}`,
    // On our own domain (owner, 2026-10-29): www, because tryzyvo.com answers a POST with a redirect.
    oneClickUrl: `https://www.tryzyvo.com/api/email-unsubscribe?${q}`,
  };
}
