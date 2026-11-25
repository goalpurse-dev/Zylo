// Rewards in the browser: the rewards-api calls and the ?invite=CODE a visitor arrived with (kept 60 days).
// An affiliate code or link always wins: the invite is claimed only after the affiliate claims, and the server refuses
// it for anyone an affiliate referred. An affiliate's own invite link is their ?ref link (the server says "use_affiliate").
import { supabase } from "./supabaseClient";
import { REWARDS } from "../../supabase/functions/_shared/rewards/config.js";
import { affiliateApi } from "./affiliate";

export const REWARDS_PATH = "/rewards";
const KEY = "zyvo:invite";

export async function rewardsApi(action, body = {}) {
  const { data, error } = await supabase.functions.invoke("rewards-api", { body: { action, ...body } });
  if (error) {
    let message = "Couldn't reach the server. Try again.";
    let code = null;
    try { const j = await error.context.json(); code = j?.code ?? null; if (j?.message && code !== "NOT_FOUND") message = j.message; } catch { /* no body */ }
    const e = new Error(message);
    e.status = error?.context?.status;
    e.code = code;
    throw e;
  }
  if (!data?.ok) throw new Error(data?.message ?? "Something went wrong.");
  return data.data;
}

const cleanInvite = (raw) => String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

/** ?invite=CODE in the address: remembered (a newer link replaces an older one) and taken out of the address bar. */
export function captureInviteFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("invite");
  if (raw == null) return;
  params.delete("invite");
  const rest = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
  const code = cleanInvite(raw);
  if (code.length < 6) return;
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* not remembered */ }
}

function readInvite() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw);
    return code && Date.now() - at < REWARDS.invite.linkDays * 86400_000 ? code : null;
  } catch { return null; }
}
const clearInvite = () => { try { localStorage.removeItem(KEY); } catch { /* nothing */ } };

const FINAL = new Set(["joined", "already_invited", "affiliate_referred", "unknown_code", "self", "too_old", "already_paid", "no_profile", "use_affiliate"]);

/** A new account that came through an invite link: the inviter, once. Call after the affiliate claims. */
export async function claimStoredInvite() {
  const code = readInvite();
  if (!code) return null;
  try {
    const r = await rewardsApi("claimInvite", { code });
    if (r?.result === "use_affiliate" && r.code) await affiliateApi("claim", { code: r.code, source: "link" }).catch(() => null);
    if (FINAL.has(r?.result)) clearInvite();
    return r;
  } catch {
    return null;
  }
}
