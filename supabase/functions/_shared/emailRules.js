// _shared/emailRules.js — the rules every email to a user follows. Plain JS, no
// imports: the edge functions (_shared/userEmail.ts), the campaign scripts
// (emails/marketing.js) and the sign-up screens (src/lib/emailCheck.js) all read
// this one file, so a sender, a footer or an address rule changes in one place.

// Who sends the email: the last line of every footer.
// COMPANY_ADDRESS is the ONE place to add a postal address later (a PO box is
// fine), e.g. "PL 123, 00101 Helsinki, Finland": it then appears in every email
// after the next deploy of the email functions. Anti-spam law (CAN-SPAM) asks
// for a postal address in marketing email; the owner chose on 2026-10-10 to
// send with the name and the support address until there is one.
export const COMPANY_NAME = "ZyvoAI";
export const COMPANY_ADDRESS = "";
export const COMPANY_CONTACT = "support@tryzyvo.com";
export const COMPANY_FOOTER = [COMPANY_NAME, COMPANY_ADDRESS, COMPANY_CONTACT].filter(Boolean).join(" · ");

// Marketing and other promotional mail: mail.tryzyvo.com only. Password resets
// (Supabase Auth) and owner alerts stay on tryzyvo.com, so a bad campaign can't
// drag those into spam. tests/emailRules.test.mjs holds this split.
export const SENDERS = {
  updates: "Zyvo <updates@mail.tryzyvo.com>",          // campaigns
  founder: "Niko from Zyvo <niko@mail.tryzyvo.com>",   // welcome, checkout reminders
  niko: "Niko <niko@mail.tryzyvo.com>",                // plain personal emails (the warm-up)
};
// Replies go to tryzyvo.com mailboxes (Cloudflare forwards them to the owner).
export const REPLY_TO = { updates: "support@tryzyvo.com", founder: "niko@tryzyvo.com", niko: "niko@tryzyvo.com" };
export const APP_URL = "https://www.tryzyvo.com";      // www: tryzyvo.com answers with a redirect

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The footer of every email to a user: why they got it, how to stop it, who we are.
// plain: for a plain personal email (no layout, left-aligned, and no second link to the site).
export function emailFooter({ unsubscribeUrl, why, plain = false }) {
  if (!unsubscribeUrl) throw new Error("emailFooter needs an unsubscribeUrl");
  const link = "color:#8A8F98;text-decoration:underline;";
  if (plain) {
    return {
      html: `<p style="margin:28px 0 0 0;font-size:12px;line-height:1.6;color:#8A8F98;">${esc(why)}<br>
    <a href="${esc(unsubscribeUrl)}" style="${link}">Unsubscribe</a><br>
    ${esc(COMPANY_FOOTER)}</p>`,
      text: `${why}\nUnsubscribe: ${unsubscribeUrl}\n${COMPANY_FOOTER}`,
    };
  }
  const html = `<div style="padding:24px 8px 0 8px;text-align:center;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#8A8F98;">
    ${esc(why)}<br>
    <a href="${esc(unsubscribeUrl)}" style="${link}">Unsubscribe</a>
    &nbsp;·&nbsp; <a href="${APP_URL}" style="${link}">tryzyvo.com</a><br>
    ${esc(COMPANY_FOOTER)}
  </div>`;
  const text = `${why}\nUnsubscribe: ${unsubscribeUrl}\n${COMPANY_FOOTER}`;
  return { html, text };
}

/* ---------- Which Resend events mean "never write to this address again"? ---------- */
//   email.complained            → the reader pressed "spam"
//   email.bounced, permanent    → the address doesn't exist (or blocks us for good)
//   email.suppressed            → Resend already refuses this address
// A transient bounce (full inbox, server busy) is not a dead address: null.
export function stopReason(type, data) {
  if (type === "email.complained") return "complained";
  if (type === "email.suppressed") return "bounced";
  if (type === "email.bounced") {
    const kind = String(data?.bounce?.type ?? "").toLowerCase();
    return kind === "" || kind === "permanent" ? "bounced" : null;
  }
  return null;
}

/* ---------- Is this an address we should accept at sign-up or write to? ---------- */
const FORMAT = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const BIG = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];
// Real providers one letter away from a big one: never "corrected".
const REAL_LOOKALIKES = new Set(["ymail.com", "mail.com", "email.com", "gmx.com", "qmail.com", "live.com", "msn.com", "me.com", "mac.com", "aol.com"]);
const TLD_TYPOS = { con: "com", cmo: "com", ocm: "com", vom: "com", xom: "com", comm: "com", coom: "com", cim: "com", nte: "net", ner: "net", ogr: "org" };
// Throwaway inboxes. Privacy relays (duck.com, privaterelay.appleid.com, …) deliver to a real person and are fine.
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net",
  "tempmail.plus", "tempmailo.com", "tempail.com", "tempr.email", "tmpmail.org", "tmpmail.net", "mail.tm",
  "yopmail.com", "yopmail.fr", "yopmail.net", "trashmail.com", "trashmail.de", "getnada.com", "nada.email",
  "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "fakemail.net", "emailfake.com",
  "mohmal.com", "emailondeck.com", "moakt.com", "mailnesia.com", "mintemail.com", "mytemp.email",
  "discard.email", "burnermail.io", "inboxkitten.com", "minutemail.com", "mailcatch.com", "getairmail.com",
  "spam4.me", "mailsac.com", "tempinbox.com", "example.com", "example.org", "test.com",
]);

// Edits between two words; two swapped neighbours ("gmial") count as one.
function editDistance(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
    }
  }
  return m[a.length][b.length];
}

// "gmsil.com" → "gmail.com", "iclou.com" → "icloud.com", "gmail.con" → "gmail.com"; null when the domain looks fine.
export function domainSuggestion(domain) {
  if (BIG.includes(domain) || REAL_LOOKALIKES.has(domain)) return null;
  const dot = domain.lastIndexOf(".");
  const tld = TLD_TYPOS[domain.slice(dot + 1)];
  if (tld) return `${domain.slice(0, dot)}.${tld}`;
  return BIG.find((b) => editDistance(domain, b) === 1) ?? null;
}

// → { ok: true, email } or { ok: false, email, reason: "format" | "typo" | "disposable", suggestion? }
// (the check-email function adds reason "no_mail_server" after a DNS lookup).
export function checkEmailAddress(raw) {
  const email = String(raw ?? "").trim().toLowerCase();
  if (email.length > 254 || !FORMAT.test(email)) return { ok: false, email, reason: "format" };
  const [local, domain] = email.split("@");
  if (domain.endsWith(".test") || domain.endsWith(".invalid") || domain.endsWith(".localhost") || DISPOSABLE.has(domain)) {
    return { ok: false, email, reason: "disposable" };
  }
  const better = domainSuggestion(domain);
  if (better) return { ok: false, email, reason: "typo", suggestion: `${local}@${better}` };
  return { ok: true, email };
}

// The sentence a sign-up screen shows.
export function emailProblemMessage(check) {
  if (!check || check.ok) return "";
  if (check.reason === "typo") return `Did you mean ${check.suggestion}? Check the address and try again.`;
  if (check.reason === "disposable") return "Use an email address you can keep: temporary inboxes don't work with Zyvo.";
  if (check.reason === "no_mail_server") return "That address can't receive email. Check it and try again.";
  return "That email address doesn't look right. Check it and try again.";
}
