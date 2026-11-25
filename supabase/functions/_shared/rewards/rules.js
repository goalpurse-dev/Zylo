// Rewards: pure helpers (video links, tiers, invite codes). Used by rewards-api, the /rewards page and tests.
import { REWARDS } from "./config.js";

export const PLATFORM_NAMES = { tiktok: "TikTok", instagram: "Instagram Reels", youtube: "YouTube Shorts" };

/**
 * A TikTok / Instagram Reel / YouTube Short link → { platform, key, url } or null.
 * key is what makes two links "the same video" (duplicates are blocked on it): the platform and the video id,
 * or for TikTok's short share links (vm./vt.tiktok.com/XXXX) the share code.
 */
export function parseVideoUrl(raw) {
  let u;
  try { u = new URL(String(raw ?? "").trim().replace(/^(?!https?:\/\/)/i, "https://")); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  const parts = u.pathname.split("/").filter(Boolean);
  if (host === "tiktok.com") {
    const i = parts.indexOf("video");
    const id = i >= 0 ? parts[i + 1] : null;
    if (id && /^\d{8,25}$/.test(id) && parts[0]?.startsWith("@")) return { platform: "tiktok", key: `tiktok:${id}`, url: `https://www.tiktok.com/${parts[0]}/video/${id}` };
    return null;
  }
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    const code = parts[0];
    return code && /^[A-Za-z0-9]{5,20}$/.test(code) ? { platform: "tiktok", key: `tiktok-share:${code}`, url: `https://${host}/${code}/` } : null;
  }
  if (host === "instagram.com") {
    const i = parts.findIndex((p) => p === "reel" || p === "reels" || p === "p");
    const id = i >= 0 ? parts[i + 1] : null;
    return id && /^[A-Za-z0-9_-]{5,40}$/.test(id) ? { platform: "instagram", key: `instagram:${id}`, url: `https://www.instagram.com/reel/${id}/` } : null;
  }
  if (host === "youtube.com") {
    const id = parts[0] === "shorts" ? parts[1] : null;
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? { platform: "youtube", key: `youtube:${id}`, url: `https://www.youtube.com/shorts/${id}` } : null;
  }
  return null;
}

/** The highest tier these views reach, or null below the first. */
export function tierFor(views, cfg = REWARDS) {
  const v = Number(views) || 0;
  let best = null;
  for (const t of cfg.videoTiers) if (v >= t.views) best = t;
  return best;
}

/** The tier with exactly this many views (what the admin picks), or null. */
export const tierByViews = (views, cfg = REWARDS) => cfg.videoTiers.find((t) => t.views === Number(views)) ?? null;

/** What an approval pays: the new tier's credits minus what this video already got (never below 0). */
export const upgradeCredits = (tierCredits, alreadyPaid) => Math.max(0, Math.round(Number(tierCredits) || 0) - Math.round(Number(alreadyPaid) || 0));

export const maxCredits = (cfg = REWARDS) => Math.max(...cfg.videoTiers.map((t) => t.credits));

/**
 * "≈ N free videos": credits ÷ one In This Town video's price, rounded down; the first tier shows at least 1.
 * videoPrice: the live price (rewards-api reads it), else the config's fallback.
 */
export function freeVideos(credits, tierIndex, videoPrice, cfg = REWARDS) {
  const price = Number(videoPrice) > 0 ? Number(videoPrice) : cfg.freeVideo.fallbackCredits;
  const n = Math.floor((Number(credits) || 0) / price);
  return tierIndex === 0 ? Math.max(1, n) : n;
}
export const freeVideosLabel = (n) => `≈ ${n.toLocaleString("en")} free video${n === 1 ? "" : "s"}`;

/** "5,000+" / "1M+" for the chips. */
export function viewsLabel(v) {
  if (v >= 1_000_000) return `${v / 1_000_000}M+`;
  return `${Number(v).toLocaleString("en")}+`;
}

/** A new invite code: 8 letters and numbers without look-alikes (no 0/O, 1/I/L). */
export function newInviteCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export const isPaidPlan = (plan, cfg = REWARDS) => cfg.paidPlans.includes(String(plan ?? "free").toLowerCase().trim());
