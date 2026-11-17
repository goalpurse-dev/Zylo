// Pure helpers for the affiliate program (no database, no network): codes, money, the funnel, the
// activity feed. Used by affiliate-api, stripe-webhook and the pages; tests/affiliate.test.mjs covers them.
import { AFFILIATE } from "./config.js";

/** A candidate code from any text: A-Z and 0-9 only, upper case, cut to the maximum length. */
export function cleanCode(raw, cfg = AFFILIATE) {
  return String(raw ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]/g, "")
    .slice(0, cfg.codeMaxLength);
}

const RESERVED_PARTS = ["zyvo", "admin", "support", "official", "refund", "stripe"];

/** Why a code can't be used ("too_short", "too_long", "invalid", "reserved"), or null when it can. */
export function codeProblem(code, cfg = AFFILIATE) {
  const c = String(code ?? "");
  if (!/^[A-Z0-9]*$/i.test(c)) return "invalid";
  if (c.length < cfg.codeMinLength) return "too_short";
  if (c.length > cfg.codeMaxLength) return "too_long";
  const lower = c.toLowerCase();
  if (cfg.reservedCodes.includes(lower)) return "reserved";
  // these may not appear anywhere in a code (ZYVOFREE, ADMIN2, OFFICIALSUPPORT…)
  if (RESERVED_PARTS.some((w) => lower.includes(w))) return "reserved";
  return null;
}

export const CODE_PROBLEM_TEXT = {
  too_short: `At least ${AFFILIATE.codeMinLength} letters or numbers.`,
  too_long: `At most ${AFFILIATE.codeMaxLength} letters or numbers.`,
  invalid: "Only letters A–Z and numbers 0–9.",
  reserved: "That word is reserved. Try another.",
  taken: "Someone already has that code.",
  edit_used: "You've already changed your code once.",
};

/**
 * Code candidates for a new affiliate, best first: their name, their email's name, then those with
 * numbers, then a random one. The server takes the first that is valid and free.
 */
export function codeCandidates({ fullName, email, userId }, cfg = AFFILIATE) {
  const out = [];
  const add = (c) => { if (c && !codeProblem(c, cfg) && !out.includes(c)) out.push(c); };
  const fromName = cleanCode(fullName, cfg);
  const fromEmail = cleanCode(String(email ?? "").split("@")[0], cfg);
  const first = cleanCode(String(fullName ?? "").trim().split(/\s+/)[0], cfg);
  for (const base of [fromName, first, fromEmail]) add(base);
  const seed = String(userId ?? "").replace(/[^0-9a-f]/gi, "");
  for (const base of [first || fromName || fromEmail].filter(Boolean)) {
    for (let i = 0; i < 6; i++) {
      const n = seed ? parseInt(seed.slice(i * 2, i * 2 + 4) || "0", 16) % 1000 : Math.floor(Math.random() * 1000);
      add(`${base.slice(0, cfg.codeMaxLength - 3)}${n}`);
    }
  }
  const tail = (seed || Math.random().toString(16).slice(2)).toUpperCase().slice(0, 6);
  add(`CREATOR${tail.slice(0, 4)}`);
  add(`C${tail}`);
  return out;
}

/** The public name shown when someone types this affiliate's code: a first name, never an email. */
export function publicName({ fullName }, code) {
  const first = String(fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const clean = first.replace(/[^\p{L}\p{N}'-]/gu, "").slice(0, 24);
  return clean.length >= 2 ? clean : code;
}

/**
 * The commission for one payment. amountCents: what the referred user paid, before tax, in cents.
 * Cash: rate × amount, in cents. Credits: rate × amount ÷ the credit's value, whole credits (rounded
 * down), with its euro value in cents.
 */
export function commissionFor({ amountCents, type, cashRate, creditRate }, cfg = AFFILIATE) {
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  if (type === "credits") {
    const valueCents = Math.round(amount * Number(creditRate ?? cfg.creditRate));
    const credits = Math.floor(valueCents / Math.round(cfg.creditValueEur * 100));
    return { type: "credits", amountCents: credits * Math.round(cfg.creditValueEur * 100), credits };
  }
  return { type: "cash", amountCents: Math.round(amount * Number(cashRate ?? cfg.cashRate)), credits: 0 };
}

/** When a commission made at `at` becomes available. */
export function availableAt(at, cfg = AFFILIATE) {
  return new Date(new Date(at).getTime() + cfg.holdDays * 86400_000).toISOString();
}

export const eur = (cents, { sign = false, decimals } = {}) => {
  const v = (Number(cents) || 0) / 100;
  const d = decimals ?? (Number.isInteger(v) ? 0 : 2);
  const s = `€${Math.abs(v).toFixed(d)}`;
  return sign ? `${v < 0 ? "−" : "+"}${s}` : v < 0 ? `−${s}` : s;
};

/** Conversion share as a whole percent string, or "–" without a base. */
export function pct(part, whole) {
  if (!whole) return "–";
  const p = (part / whole) * 100;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}

/** "2h ago", "yesterday", "3 days ago", "12 Nov" — the feed's times. */
export function ago(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const PLAN_LABEL = { starter: "Starter", pro: "Pro", generative: "Generative", topup: "Credit pack" };

/**
 * One activity line, with no personal data in it: what happened, never who.
 * item: { kind: "signup" | "buyer" | "unlocked" | "reversed" | "paid", at, plan?, cents?, credits?, type?, status? }
 */
export function activityText(item) {
  const money = item.type === "credits" ? `+${Number(item.credits || 0).toLocaleString("en")} credits` : eur(item.cents, { sign: true });
  if (item.kind === "signup") return "New sign-up";
  if (item.kind === "buyer") return `New buyer · ${PLAN_LABEL[item.plan] ?? "Purchase"} · ${money} ${item.status === "reversed" ? "reversed" : item.status === "pending" ? "pending" : item.status === "paid" && item.type === "credits" ? "added" : item.status ?? ""}`.trim();
  if (item.kind === "payout") return item.type === "credits" ? `${Number(item.credits || 0).toLocaleString("en")} credits added to your account` : `Payout sent · ${eur(item.cents)}`;
  return "Update";
}

/** The 30-day chart: one bucket per day (UTC dates), oldest first. */
export function dailySeries(events, days = 30, now = Date.now()) {
  const out = [];
  const end = new Date(now); end.setUTCHours(0, 0, 0, 0);
  const index = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400_000).toISOString().slice(0, 10);
    index.set(d, out.length);
    out.push({ day: d, signups: 0, buyers: 0 });
  }
  for (const e of events) {
    const k = String(e.at ?? "").slice(0, 10);
    if (!index.has(k)) continue;
    out[index.get(k)][e.kind === "buyer" ? "buyers" : "signups"]++;
  }
  return out;
}

/** Hash an IP (and a server-only salt) with SHA-256; the raw IP is never stored. */
export async function hashIp(ip, salt) {
  if (!ip) return null;
  const data = new TextEncoder().encode(`${salt}|${String(ip).trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

/** The visitor's IP from the platform's headers (first hop of x-forwarded-for). */
export function clientIp(headers) {
  const get = (k) => headers?.get?.(k) ?? null;
  return (get("cf-connecting-ip") || get("x-real-ip") || String(get("x-forwarded-for") ?? "").split(",")[0] || "").trim() || null;
}
