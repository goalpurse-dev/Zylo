// The rewards-api function's logic (index.ts wires it up). POST { action, ...args }.
//   signed in  me, submit, recheck, claimInvite
//   admin      adminOverview, adminReview, adminCancelInvite, adminTestInvitePayment, adminTestInviteRefund
// Paid plans only for submitting and invite rewards (REWARDS.paidPlans); free users get the page data, locked.
// Admin = a verified email in ADMIN_EMAILS (as the Content Machine and /admin/affiliates).
import { REWARDS } from "./config.js";
import { isPaidPlan, newInviteCode, parseVideoUrl, tierByViews } from "./rules.js";
import { AFFILIATE } from "../affiliate/config.js";
import { cleanCode, clientIp, hashIp } from "../affiliate/rules.js";

const n = (v) => Number(v) || 0;
class HttpError extends Error { constructor(status, code, message) { super(message ?? code); this.status = status; this.code = code; } }
const fail = (status, code, message) => { throw new HttpError(status, code, message); };
function must(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message ?? JSON.stringify(res.error)}`);
  return res.data;
}

export function createRewardsHandler({ sb, getUser, adminEmails = [], salt = "", cors, cfg = REWARDS, now = () => Date.now() }) {
  const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: cors(req) });
  async function currentUser(req) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    try { const { data, error } = await getUser(token); return error ? null : data?.user ?? null; } catch { return null; }
  }
  const isAdmin = (u) => Boolean(u?.email && u.email_confirmed_at && adminEmails.includes(String(u.email).trim().toLowerCase()));
  const ipHashOf = (req) => hashIp(clientIp(req.headers), salt);

  async function planOf(userId) {
    const p = must(await sb.from("profiles").select("plan_code").eq("id", userId).maybeSingle(), "profile");
    return String(p?.plan_code ?? "free").toLowerCase();
  }
  async function inviteCode(userId) {
    for (let i = 0; i < 4; i++) {
      const code = must(await sb.rpc("rewards_invite_code", { p_user_id: userId, p_new_code: newInviteCode() }), "invite code");
      if (code) return code;
    }
    throw new Error("could not make an invite code");
  }
  async function rateOk(req, user) {
    const ip = await ipHashOf(req);
    const keys = [ip ? `ip:${ip}` : null, user ? `user:${user.id}` : null].filter(Boolean);
    return must(await sb.rpc("affiliate_rate_ok", { p_keys: keys, p_max: AFFILIATE.codeChecksPerMinute, p_window_seconds: 60 }), "rate limit") === true;
  }

  // the live credit price of one In This Town video (cfg.freeVideo.toolKey), for "≈ N free videos"; 10 minutes in memory
  let priceCache = null;
  async function videoPrice() {
    if (priceCache && now() - priceCache.at < 600_000) return priceCache.credits;
    const { data } = await sb.from("tool_prices").select("flat_credits").eq("tool_key", cfg.freeVideo.toolKey).maybeSingle();
    const credits = Number(data?.flat_credits) > 0 ? Number(data.flat_credits) : cfg.freeVideo.fallbackCredits;
    priceCache = { at: now(), credits };
    return credits;
  }
  async function publicConfig() {
    return {
      tiers: cfg.videoTiers, submissionsPerWeek: cfg.submissionsPerWeek, invite: cfg.invite, badgePath: cfg.badgePath, paidPlans: cfg.paidPlans,
      freeVideo: { label: cfg.freeVideo.label, credits: await videoPrice() },
    };
  }

  async function mePayload(user) {
    const plan = await planOf(user.id);
    const paid = isPaidPlan(plan, cfg);
    const weekAgo = new Date(now() - 7 * 86400_000).toISOString();
    const [subs, aff, invitesRes] = await Promise.all([
      sb.from("reward_submissions").select("id, url, platform, claimed_views, status, tier_views, credits_paid, reject_reason, recheck, created_at, reviewed_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      sb.from("affiliates").select("code, status").eq("user_id", user.id).maybeSingle(),
      sb.from("invites").select("status, inviter_credits").eq("inviter_user_id", user.id).limit(5000),
    ]);
    const submissions = must(subs, "submissions") ?? [];
    const affiliate = must(aff, "affiliate");
    const invites = must(invitesRes, "invites") ?? [];
    // an active affiliate's invite link IS their affiliate link (one referrer, no double rewards)
    const invite = affiliate?.status === "active"
      ? { kind: "affiliate", code: affiliate.code, link: `${cfg.siteUrl}/?ref=${affiliate.code}` }
      : { kind: "invite", code: await inviteCode(user.id) };
    if (invite.kind === "invite") invite.link = `${cfg.siteUrl}/?invite=${invite.code}`;
    return {
      plan, paid,
      submissions: submissions.map((s) => ({
        id: s.id, url: s.url, platform: s.platform, claimedViews: s.claimed_views, status: s.status, tierViews: s.tier_views,
        creditsPaid: s.credits_paid, rejectReason: s.reject_reason, recheck: s.recheck, createdAt: s.created_at, reviewedAt: s.reviewed_at,
      })),
      weekLeft: Math.max(0, cfg.submissionsPerWeek - submissions.filter((s) => s.created_at > weekAgo).length),
      creditsFromVideos: submissions.reduce((a, s) => a + n(s.credits_paid), 0),
      invite,
      inviteStats: {
        joined: invites.filter((i) => i.status !== "cancelled").length,
        bought: invites.filter((i) => ["rewarded", "no_credit", "reversed"].includes(i.status)).length,
        credits: invites.filter((i) => i.status === "rewarded").reduce((a, i) => a + n(i.inviter_credits), 0),
      },
      config: await publicConfig(),
    };
  }

  async function adminOverview() {
    const [queue, decided, invites] = await Promise.all([
      sb.from("reward_submissions").select("*").eq("status", "in_review").order("updated_at", { ascending: true }).limit(300),
      sb.from("reward_submissions").select("*").neq("status", "in_review").order("reviewed_at", { ascending: false }).limit(60),
      sb.from("invites").select("*").order("created_at", { ascending: false }).limit(300),
    ]);
    const q = must(queue, "queue") ?? [];
    const d = must(decided, "decided") ?? [];
    const inv = must(invites, "invites") ?? [];
    const emails = new Map();
    for (const id of [...new Set([...q, ...d].map((s) => s.user_id).concat(inv.flatMap((i) => [i.inviter_user_id, i.invited_user_id])))].slice(0, 400)) {
      try { const { data } = await sb.auth.admin.getUserById(id); if (data?.user?.email) emails.set(id, data.user.email); } catch { /* unknown */ }
    }
    const sub = (s) => ({
      id: s.id, url: s.url, platform: s.platform, claimedViews: s.claimed_views, status: s.status, tierViews: s.tier_views, creditsPaid: s.credits_paid,
      rejectReason: s.reject_reason, recheck: s.recheck, createdAt: s.created_at, updatedAt: s.updated_at, reviewedAt: s.reviewed_at, email: emails.get(s.user_id) ?? null,
    });
    return {
      queue: q.map(sub), decided: d.map(sub),
      invites: inv.map((i) => ({
        id: i.id, inviter: emails.get(i.inviter_user_id) ?? null, friend: emails.get(i.invited_user_id) ?? null, status: i.status, reason: i.reason,
        inviterCredits: i.inviter_credits, friendCredits: i.friend_credits, createdAt: i.created_at, rewardedAt: i.rewarded_at,
      })),
      config: await publicConfig(),
    };
  }
  async function userIdByEmail(email) {
    const want = String(email ?? "").trim().toLowerCase();
    for (let page = 1; want && page <= 20; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      const hit = data?.users?.find((u) => String(u.email ?? "").toLowerCase() === want);
      if (hit) return hit.id;
      if ((data?.users?.length ?? 0) < 1000) break;
    }
    return null;
  }

  async function route(req, body) {
    const action = String(body?.action ?? "");
    if (action === "config") return await publicConfig(); // the page for signed-out visitors (tiers + the live video price)
    const user = await currentUser(req);
    if (action.startsWith("admin")) {
      if (!isAdmin(user)) fail(404, "NOT_FOUND", "Requested function was not found");
      switch (action) {
        case "adminOverview": return await adminOverview();
        case "adminReview": {
          const approve = body.approve === true;
          const tier = approve ? tierByViews(body.tierViews, cfg) : null;
          if (approve && !tier) return { ok: false, problem: "Pick a tier." };
          const r = must(await sb.rpc("rewards_review", {
            p_id: String(body.id ?? ""), p_approve: approve, p_tier_views: tier?.views ?? null, p_tier_credits: tier?.credits ?? null,
            p_reason: String(body.reason ?? "").slice(0, 300), p_admin: user.email,
          }), "review");
          return { ok: ["approved", "rejected"].includes(r?.result), ...r };
        }
        case "adminCancelInvite": {
          const r = must(await sb.rpc("rewards_cancel_invite", { p_invite_id: String(body.id ?? ""), p_reason: String(body.reason ?? "cancelled by admin").slice(0, 200) }), "cancel invite");
          return { ok: true, ...r };
        }
        // test tools (no money moves): the invited friend's "first purchase" and its refund
        case "adminTestInvitePayment": {
          const id = body.userId || await userIdByEmail(body.email);
          if (!id) return { ok: false, problem: "No account with that email." };
          const r = must(await sb.rpc("rewards_record_payment", {
            p_user_id: id, p_payment_id: `sim_${crypto.randomUUID()}`, p_payment_intent: null, p_inviter_credits: cfg.invite.inviterCredits,
            p_friend_credits: cfg.invite.friendCredits, p_max_per_month: cfg.invite.maxPerMonth, p_ip_days: cfg.invite.ipCooldownDays, p_paid_plans: [...cfg.paidPlans],
          }), "test invite payment");
          return { ok: true, ...r };
        }
        case "adminTestInviteRefund": {
          const id = body.userId || await userIdByEmail(body.email);
          if (!id) return { ok: false, problem: "No account with that email." };
          const i = must(await sb.from("invites").select("payment_id").eq("invited_user_id", id).maybeSingle(), "invite");
          if (!i?.payment_id) return { ok: false, problem: "That friend has no rewarded purchase." };
          const r = must(await sb.rpc("rewards_reverse_payment", { p_payment_id: i.payment_id, p_payment_intent: null, p_window_days: cfg.invite.clawbackDays, p_reason: "test refund" }), "test refund");
          return { ok: true, ...r };
        }
        default: fail(400, "UNKNOWN_ACTION", "Unknown action.");
      }
    }
    if (!user) fail(401, "AUTH_REQUIRED", "Please sign in.");
    switch (action) {
      case "me": return await mePayload(user);
      case "submit": {
        if (!isPaidPlan(await planOf(user.id), cfg)) return { ok: false, problem: "locked" };
        const v = parseVideoUrl(body.url);
        if (!v) return { ok: false, problem: "url" };
        const views = body.views === "" || body.views == null ? -1 : Math.floor(Number(String(body.views).replace(/[^0-9]/g, "") || -1));
        const r = must(await sb.rpc("rewards_submit", {
          p_user_id: user.id, p_url: v.url, p_url_key: v.key, p_platform: v.platform, p_views: Number.isFinite(views) ? views : -1, p_week_limit: cfg.submissionsPerWeek,
        }), "submit");
        return { ok: r?.result === "submitted", problem: r?.result === "submitted" ? null : r?.result, platform: v.platform };
      }
      case "recheck": {
        if (!isPaidPlan(await planOf(user.id), cfg)) return { ok: false, problem: "locked" };
        const views = body.views === "" || body.views == null ? -1 : Math.floor(Number(String(body.views).replace(/[^0-9]/g, "") || -1));
        const r = must(await sb.rpc("rewards_recheck", { p_user_id: user.id, p_id: String(body.id ?? ""), p_views: Number.isFinite(views) ? views : -1 }), "recheck");
        return { ok: r?.result === "requeued", problem: r?.result === "requeued" ? null : r?.result };
      }
      case "claimInvite": {
        const code = cleanCode(body.code).slice(0, 12);
        if (!code) return { result: "unknown_code" };
        if (!(await rateOk(req, user))) return { result: "rate_limited" };
        const r = must(await sb.rpc("rewards_claim_invite", { p_user_id: user.id, p_code: code, p_ip_hash: await ipHashOf(req), p_window_days: cfg.invite.windowDays }), "claim invite");
        return { result: r?.result, code: r?.code ?? null };
      }
      default: fail(400, "UNKNOWN_ACTION", "Unknown action.");
    }
  }

  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
    let body;
    try { body = await req.json(); } catch { return json(req, { error: "Invalid JSON" }, 400); }
    try {
      return json(req, { ok: true, data: await route(req, body) });
    } catch (e) {
      if (e instanceof HttpError) return json(req, { ok: false, code: e.code, message: e.message }, e.status);
      console.error(`[rewards-api] ${body?.action}:`, e instanceof Error ? e.message : String(e));
      return json(req, { ok: false, code: "SERVER", message: "Something went wrong. Try again." }, 500);
    }
  };
}
