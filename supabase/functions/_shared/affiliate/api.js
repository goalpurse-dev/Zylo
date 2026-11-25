// The affiliate-api function's logic (index.ts only wires it up). POST { action, ...args }.
//   public    click (a ?ref=CODE visit), lookup (the survey's live check)
//   signed in me, join, setCode, setPayout, claim, claimStatus, markSeen
//   admin     adminOverview, adminUpdate, adminMarkPaid, adminResolveFlag, adminTestPayment, adminTestRefund, adminTestAge
// Admin = a verified email in ADMIN_EMAILS (as the Content Machine); anyone else gets NOT_FOUND for those.
// Referred users are never named to the affiliate: the page gets times, plans and amounts only.
import { AFFILIATE } from "./config.js";
import { cleanCode, codeCandidates, codeProblem, clientIp, dailySeries, hashIp, normalizeHandles, publicName } from "./rules.js";

// The name a follower sees when they type the code: the creator's @handle (what their viewers know), else a first name.
function displayNameFor(handles, fullName, code) {
  const social = handles.find((h) => h.platform !== "other");
  return social ? `@${social.handle}`.slice(0, 40) : publicName({ fullName }, code);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PAID_REASONS = ["topup", "plan_renewal", "plan_upgrade"];
const CLICK_DEDUPE_MS = 30 * 60 * 1000;
const n = (v) => Number(v) || 0;

class HttpError extends Error {
  constructor(status, code, message) { super(message ?? code); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new HttpError(status, code, message); };

function must(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message ?? JSON.stringify(res.error)}`);
  return res.data;
}

export function createAffiliateHandler({ sb, getUser, adminEmails = [], salt = "", cors, cfg = AFFILIATE, now = () => Date.now() }) {
  const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: cors(req) });

  async function currentUser(req) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    try {
      const { data, error } = await getUser(token);
      return error ? null : data?.user ?? null;
    } catch { return null; }
  }
  const isAdmin = (user) => Boolean(user?.email && user.email_confirmed_at && adminEmails.includes(String(user.email).trim().toLowerCase()));
  const ipHashOf = (req) => hashIp(clientIp(req.headers), salt);

  async function affiliateByUser(userId) {
    return must(await sb.from("affiliates").select("*").eq("user_id", userId).maybeSingle(), "affiliate lookup");
  }
  async function affiliateByCode(code) {
    const c = cleanCode(code, cfg);
    if (!c) return null;
    // codes are stored upper case, so an exact match on the cleaned code is the case-insensitive match
    return must(await sb.from("affiliates").select("id, user_id, code, display_name, status").eq("code", c).maybeSingle(), "code lookup");
  }
  async function stats(affiliateId) {
    const rows = must(await sb.rpc("affiliate_stats", { p_affiliate_id: affiliateId }), "affiliate stats") ?? [];
    return rows;
  }

  /* ---------- what a new user may still do with a code ---------- */
  async function claimEligibility(userId) {
    const ref = must(await sb.from("referrals").select("id, affiliate_id, created_at").eq("referred_user_id", userId).maybeSingle(), "referral lookup");
    if (ref) {
      const a = must(await sb.from("affiliates").select("code, display_name").eq("id", ref.affiliate_id).maybeSingle(), "affiliate lookup");
      return { eligible: false, reason: "already_attributed", creator: a ? { code: a.code, displayName: a.display_name } : null };
    }
    const p = must(await sb.from("profiles").select("created_at, plan_code").eq("id", userId).maybeSingle(), "profile lookup");
    if (!p) return { eligible: false, reason: "no_profile" };
    if (now() - Date.parse(p.created_at) > cfg.claimWindowDays * 86400_000) return { eligible: false, reason: "too_old" };
    if (String(p.plan_code ?? "free").toLowerCase() !== "free") return { eligible: false, reason: "already_paid" };
    const paid = must(await sb.from("credit_grants").select("id").eq("user_id", userId).in("reason", PAID_REASONS).limit(1), "payment lookup");
    if (paid?.length) return { eligible: false, reason: "already_paid" };
    return { eligible: true, bonusCredits: cfg.signupBonusCredits };
  }

  /* ---------- the affiliate's page ---------- */
  async function mePayload(user, req) {
    const a = await affiliateByUser(user.id);
    if (!a) return { joined: false, claim: await claimEligibility(user.id), config: publicConfig() };

    // check-on-read: whatever finished its hold is released now (the daily job does the same for everyone)
    must(await sb.rpc("affiliate_release_due", { p_affiliate_id: a.id }), "release due");
    // remember this IP (hashed) for the self-referral check: the last 10
    const ip = await ipHashOf(req);
    if (ip && !a.ip_hashes?.includes(ip)) {
      await sb.from("affiliates").update({ ip_hashes: [ip, ...(a.ip_hashes ?? [])].slice(0, 10) }).eq("id", a.id);
    }

    const [s] = await stats(a.id);
    const since = new Date(now() - 30 * 86400_000).toISOString();
    const [refs, coms, pays, clicks30] = await Promise.all([
      sb.from("referrals").select("created_at, review_status").eq("affiliate_id", a.id).neq("review_status", "rejected").order("created_at", { ascending: false }).limit(200),
      sb.from("commissions").select("created_at, plan, commission_amount, commission_credits, type, status, available_at, on_hold, paid_at").eq("affiliate_id", a.id).order("created_at", { ascending: false }).limit(200),
      sb.from("payouts").select("paid_at, amount, credits, method").eq("affiliate_id", a.id).order("paid_at", { ascending: false }).limit(20),
      sb.from("referral_clicks").select("created_at").eq("affiliate_id", a.id).gte("created_at", since).limit(5000),
    ]);
    const referrals = must(refs, "referrals") ?? [];
    const commissions = must(coms, "commissions") ?? [];
    const payouts = must(pays, "payouts") ?? [];

    const events = [
      ...referrals.map((r) => ({ kind: "signup", at: r.created_at })),
      ...commissions.filter((c) => c.status !== "reversed").map((c) => ({ kind: "buyer", at: c.created_at })),
    ];
    const activity = [
      ...referrals.slice(0, 20).map((r) => ({ kind: "signup", at: r.created_at })),
      ...commissions.slice(0, 20).map((c) => ({
        kind: "buyer", at: c.created_at, plan: c.plan, cents: c.commission_amount, credits: c.commission_credits, type: c.type,
        status: c.status, unlocksAt: c.status === "pending" ? c.available_at : null, review: c.on_hold && c.status === "pending",
      })),
      ...payouts.filter((p) => p.method !== "credits").map((p) => ({ kind: "payout", at: p.paid_at, cents: p.amount, type: "cash" })),
    ].sort((x, y) => Date.parse(y.at) - Date.parse(x.at)).slice(0, 25);

    const lastSeen = a.last_seen_at ? Date.parse(a.last_seen_at) : null;
    const newer = (iso) => lastSeen != null && Date.parse(iso) > lastSeen;
    return {
      joined: true,
      affiliate: {
        code: a.code, displayName: a.display_name, status: a.status, cashRate: n(a.cash_rate), creditRate: n(a.credit_rate),
        payoutType: a.payout_type, payoutMethod: a.payout_method, payoutEmail: a.payout_email,
        codeEditsLeft: Math.max(0, cfg.codeEditsAllowed - n(a.code_edits)), createdAt: a.created_at, handles: a.handles ?? [],
        link: `${cfg.siteUrl}/?ref=${a.code}`,
      },
      stats: {
        clicks: n(s?.clicks), signups: n(s?.signups), buyers: n(s?.buyers),
        earnedCents: n(s?.pending_cents) + n(s?.available_cents) + n(s?.paid_cents),
      },
      earnings: {
        pendingCents: n(s?.pending_cents), pendingCredits: n(s?.pending_credits), nextUnlockAt: s?.next_unlock_at ?? null,
        availableCents: n(s?.available_cents), paidCents: n(s?.paid_cents), paidCredits: n(s?.paid_credits),
        minPayoutCents: Math.round(cfg.minCashPayoutEur * 100),
      },
      series: dailySeries(events, 30, now()),
      clicks30: (must(clicks30, "clicks") ?? []).length,
      activity,
      lastSeenAt: a.last_seen_at,
      newSince: lastSeen == null ? { signups: 0, buyers: 0 } : {
        signups: referrals.filter((r) => newer(r.created_at)).length,
        buyers: commissions.filter((c) => c.status !== "reversed" && newer(c.created_at)).length,
      },
      config: publicConfig(),
    };
  }

  function publicConfig() {
    return {
      cashRate: cfg.cashRate, creditRate: cfg.creditRate, creditValueEur: cfg.creditValueEur, holdDays: cfg.holdDays,
      minCashPayoutEur: cfg.minCashPayoutEur, signupBonusCredits: cfg.signupBonusCredits, siteUrl: cfg.siteUrl,
      codeMinLength: cfg.codeMinLength, codeMaxLength: cfg.codeMaxLength, example: cfg.example, claimWindowDays: cfg.claimWindowDays,
    };
  }

  /** false when this IP or account has checked too many codes this minute (the call is then not counted). */
  async function rateOk(req, user) {
    const ip = await ipHashOf(req);
    const keys = [ip ? `ip:${ip}` : null, user ? `user:${user.id}` : null].filter(Boolean);
    if (!keys.length) return true;
    return must(await sb.rpc("affiliate_rate_ok", { p_keys: keys, p_max: cfg.codeChecksPerMinute, p_window_seconds: 60 }), "rate limit") === true;
  }

  async function claim(user, req, { code, source, platform }) {
    const src = source === "link" ? "link" : "code";
    const c = cleanCode(code, cfg);
    if (!c || codeProblem(c, cfg)) return { result: "unknown_code" };
    // typed codes are rate-limited; the stored link's one automatic claim is not a guess
    if (src === "code" && !(await rateOk(req, user))) return { result: "rate_limited" };
    const r = must(await sb.rpc("affiliate_claim", {
      p_user_id: user.id, p_code: c, p_source: src, p_ip_hash: await ipHashOf(req), p_window_days: cfg.claimWindowDays,
      p_bonus_credits: cfg.signupBonusCredits, p_link_bonus: cfg.linkSignupBonus, p_flag_same_ip: cfg.flagSameIp, p_max_per_ip: cfg.maxReferralsPerIp,
      p_platform: cfg.creatorPlatforms.includes(platform) ? platform : null, p_ip_bonus_days: cfg.ipBonusCooldownDays,
    }), "claim");
    return { result: r?.result, displayName: r?.display_name ?? null, code: r?.code ?? null, bonusCredits: n(r?.bonus_credits), bonusSkipped: r?.bonus_skipped ?? null };
  }

  /* ---------- admin ---------- */
  async function adminOverview() {
    must(await sb.rpc("affiliate_release_due", { p_affiliate_id: null }), "release due");
    const [affs, statRows, flagged, recentPayouts, platformRows] = await Promise.all([
      sb.from("affiliates").select("*").order("created_at", { ascending: false }).limit(1000),
      sb.rpc("affiliate_stats", { p_affiliate_id: null }),
      sb.from("referrals").select("id, affiliate_id, referred_user_id, source, flag_reason, created_at, ip_hash").eq("flagged", true).eq("review_status", "none").order("created_at", { ascending: false }).limit(200),
      sb.from("payouts").select("id, affiliate_id, amount, credits, method, reference, paid_to, paid_at").neq("method", "credits").order("paid_at", { ascending: false }).limit(50),
      sb.from("referrals").select("affiliate_id, platform").neq("review_status", "rejected").limit(50000),
    ]);
    // where each creator's sign-ups came from: the platform picked in the survey, or "other" (link without it)
    const platforms = new Map();
    for (const r of must(platformRows, "platforms") ?? []) {
      const m = platforms.get(r.affiliate_id) ?? { tiktok: 0, youtube: 0, instagram: 0, other: 0 };
      m[r.platform ?? "other"] = (m[r.platform ?? "other"] ?? 0) + 1;
      platforms.set(r.affiliate_id, m);
    }
    const list = must(affs, "affiliates") ?? [];
    const byId = new Map((must(statRows, "stats") ?? []).map((r) => [r.affiliate_id, r]));
    const emails = await emailsFor([...list.map((a) => a.user_id), ...(must(flagged, "flagged") ?? []).map((f) => f.referred_user_id)]);
    const minCents = Math.round(cfg.minCashPayoutEur * 100);
    const affiliates = list.map((a) => {
      const s = byId.get(a.id) ?? {};
      return {
        id: a.id, code: a.code, displayName: a.display_name, email: emails.get(a.user_id) ?? null, status: a.status, handles: a.handles ?? [],
        cashRate: n(a.cash_rate), creditRate: n(a.credit_rate), payoutType: a.payout_type, payoutMethod: a.payout_method, payoutEmail: a.payout_email,
        clicks: n(s.clicks), signups: n(s.signups), buyers: n(s.buyers), flagged: n(s.flagged),
        pendingCents: n(s.pending_cents), availableCents: n(s.available_cents), paidCents: n(s.paid_cents), createdAt: a.created_at, note: a.admin_note,
        platforms: platforms.get(a.id) ?? { tiktok: 0, youtube: 0, instagram: 0, other: 0 },
      };
    });
    const codeOf = new Map(list.map((a) => [a.id, a.code]));
    return {
      affiliates,
      payoutQueue: affiliates.filter((a) => a.status === "active" && a.availableCents >= minCents)
        .map((a) => ({ id: a.id, code: a.code, email: a.email, payoutMethod: a.payoutMethod, payoutEmail: a.payoutEmail, amountCents: a.availableCents })),
      flagged: (must(flagged, "flagged") ?? []).map((f) => ({
        id: f.id, affiliateCode: codeOf.get(f.affiliate_id) ?? "?", referredEmail: emails.get(f.referred_user_id) ?? null,
        source: f.source, reason: f.flag_reason, createdAt: f.created_at,
      })),
      payouts: (must(recentPayouts, "payouts") ?? []).map((p) => ({ ...p, code: codeOf.get(p.affiliate_id) ?? "?" })),
      config: { ...publicConfig(), minCashPayoutCents: minCents },
    };
  }
  async function emailsFor(ids) {
    const out = new Map();
    for (const id of [...new Set(ids)].slice(0, 300)) {
      try {
        const { data } = await sb.auth.admin.getUserById(id);
        if (data?.user?.email) out.set(id, data.user.email);
      } catch { /* shown as unknown */ }
    }
    return out;
  }
  async function userIdByEmail(email) {
    const want = String(email ?? "").trim().toLowerCase();
    if (!want) return null;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      const hit = data?.users?.find((u) => String(u.email ?? "").toLowerCase() === want);
      if (hit) return hit.id;
      if ((data?.users?.length ?? 0) < 1000) break;
    }
    return null;
  }

  /* ---------- routing ---------- */
  async function route(req, body) {
    const action = String(body?.action ?? "");

    if (action === "click") {
      const a = await affiliateByCode(body.code);
      if (!a || a.status !== "active") return { valid: false };
      const ip = await ipHashOf(req);
      if (ip) {
        const recent = must(await sb.from("referral_clicks").select("id").eq("affiliate_id", a.id).eq("ip_hash", ip)
          .gte("created_at", new Date(now() - CLICK_DEDUPE_MS).toISOString()).limit(1), "click dedupe");
        if (recent?.length) return { valid: true, counted: false };
      }
      must(await sb.from("referral_clicks").insert({ affiliate_id: a.id, ip_hash: ip, user_agent: String(body.ua ?? req.headers.get("user-agent") ?? "").slice(0, 300) }), "click");
      return { valid: true, counted: true };
    }

    const user = await currentUser(req);

    if (action === "lookup") {
      const c = cleanCode(body.code, cfg);
      if (!c || codeProblem(c, cfg)) return { valid: false };
      if (!(await rateOk(req, user))) return { valid: false, reason: "rate_limited" };
      const a = await affiliateByCode(c);
      if (!a || a.status !== "active") return { valid: false };
      if (user && a.user_id === user.id) return { valid: false, reason: "self" };
      return { valid: true, code: a.code, displayName: a.display_name };
    }

    if (action.startsWith("admin")) {
      if (!isAdmin(user)) fail(404, "NOT_FOUND", "Requested function was not found");
      return await adminRoute(action, body, user);
    }

    if (!user) fail(401, "AUTH_REQUIRED", "Please sign in.");

    switch (action) {
      case "me": return await mePayload(user, req);
      case "claimStatus": return await claimEligibility(user.id);
      case "claim": return await claim(user, req, body);
      case "markSeen": {
        await sb.from("affiliates").update({ last_seen_at: new Date(now()).toISOString() }).eq("user_id", user.id);
        return { ok: true };
      }
      case "suggestCode": {
        // "Your code will be …" before joining: the first free candidate for these channels
        const meta = user.user_metadata ?? {};
        const candidates = codeCandidates({ fullName: meta.full_name || meta.name || "", email: user.email, userId: user.id, handles: body.handles }, cfg);
        return { code: must(await sb.rpc("affiliate_free_code", { p_candidates: candidates }), "suggest code") ?? null };
      }
      case "join": {
        const handles = normalizeHandles(body.handles);
        if (!handles.length) return { ok: false, problem: "handles" };
        const meta = user.user_metadata ?? {};
        const fullName = meta.full_name || meta.name || "";
        const candidates = codeCandidates({ fullName, email: user.email, userId: user.id, handles }, cfg);
        const r = must(await sb.rpc("affiliate_join", {
          p_user_id: user.id, p_candidates: candidates, p_display_name: displayNameFor(handles, fullName, candidates[0] ?? "Creator"),
          p_cash_rate: cfg.cashRate, p_credit_rate: cfg.creditRate, p_ip_hash: await ipHashOf(req), p_handles: handles,
        }), "join");
        if (r?.result === "no_free_code") fail(409, "NO_CODE", "Couldn't make a code. Try again.");
        if (r?.result === "no_handles") return { ok: false, problem: "handles" };
        return await mePayload(user, req);
      }
      case "setHandles": {
        const a = await affiliateByUser(user.id);
        if (!a) fail(400, "NOT_JOINED", "Join first.");
        const handles = normalizeHandles(body.handles);
        if (!handles.length) return { ok: false, problem: "handles" };
        must(await sb.from("affiliates").update({ handles, updated_at: new Date(now()).toISOString() }).eq("id", a.id), "handles");
        return { ok: true, handles };
      }
      case "setCode": {
        const a = await affiliateByUser(user.id);
        if (!a) fail(400, "NOT_JOINED", "Join first.");
        const c = cleanCode(body.code, cfg);
        const problem = codeProblem(c, cfg);
        if (problem) return { ok: false, problem };
        const r = must(await sb.rpc("affiliate_set_code", { p_affiliate_id: a.id, p_code: c, p_by_admin: false, p_max_edits: cfg.codeEditsAllowed }), "set code");
        if (r?.result === "changed" || r?.result === "unchanged") return { ok: true, code: r.code };
        return { ok: false, problem: r?.result ?? "invalid" };
      }
      case "setPayout": {
        const a = await affiliateByUser(user.id);
        if (!a) fail(400, "NOT_JOINED", "Join first.");
        const type = body.type === "credits" ? "credits" : "cash";
        const patch = { payout_type: type, updated_at: new Date(now()).toISOString() };
        if (type === "cash" || body.email != null) {
          const method = body.method === "wise" ? "wise" : "paypal";
          const email = String(body.email ?? "").trim().slice(0, 200);
          if (type === "cash" && !EMAIL_RE.test(email)) return { ok: false, problem: "email" };
          if (email && EMAIL_RE.test(email)) { patch.payout_method = method; patch.payout_email = email; }
        }
        must(await sb.from("affiliates").update(patch).eq("id", a.id), "payout settings");
        return { ok: true };
      }
      default: fail(400, "UNKNOWN_ACTION", "Unknown action.");
    }
  }

  async function adminRoute(action, body, user) {
    switch (action) {
      case "adminOverview": return await adminOverview();
      case "adminUpdate": {
        const id = String(body.affiliateId ?? "");
        const patch = { updated_at: new Date(now()).toISOString() };
        if (body.status === "active" || body.status === "disabled") patch.status = body.status;
        for (const [k, col, max] of [["cashRate", "cash_rate", 1], ["creditRate", "credit_rate", 2]]) {
          if (body[k] == null) continue;
          const v = Number(body[k]);
          if (!(v >= 0 && v <= max)) return { ok: false, problem: `${k} must be between 0 and ${max}` };
          patch[col] = v;
        }
        if (typeof body.note === "string") patch.admin_note = body.note.slice(0, 500);
        must(await sb.from("affiliates").update(patch).eq("id", id), "admin update");
        if (body.code != null) {
          const c = cleanCode(body.code, cfg);
          const problem = codeProblem(c, cfg);
          if (problem) return { ok: false, problem };
          const r = must(await sb.rpc("affiliate_set_code", { p_affiliate_id: id, p_code: c, p_by_admin: true, p_max_edits: cfg.codeEditsAllowed }), "admin code");
          if (!["changed", "unchanged"].includes(r?.result)) return { ok: false, problem: r?.result };
        }
        return { ok: true };
      }
      case "adminMarkPaid": {
        const r = must(await sb.rpc("affiliate_mark_paid", {
          p_affiliate_id: String(body.affiliateId ?? ""), p_min_cents: Math.round(cfg.minCashPayoutEur * 100),
          p_reference: String(body.reference ?? "").slice(0, 200), p_admin: user.email,
        }), "mark paid");
        return { ok: r?.result === "paid", ...r };
      }
      case "adminResolveFlag": {
        const r = must(await sb.rpc("affiliate_resolve_flag", {
          p_referral_id: String(body.referralId ?? ""), p_approve: body.approve === true,
          p_bonus_credits: cfg.signupBonusCredits, p_link_bonus: cfg.linkSignupBonus,
        }), "resolve flag");
        return { ok: true, ...r };
      }
      // Test tools (no money moves): a made-up first payment for a referred user, its refund, and skipping the hold.
      case "adminTestPayment": {
        const userId = body.userId || await userIdByEmail(body.email);
        if (!userId) return { ok: false, problem: "No account with that email." };
        const cents = Math.round(Number(body.amountEur) * 100);
        if (!(cents > 0)) return { ok: false, problem: "Amount must be more than 0." };
        const r = must(await sb.rpc("affiliate_record_payment", {
          p_user_id: userId, p_payment_id: `sim_${crypto.randomUUID()}`, p_payment_intent: null, p_amount_cents: cents, p_currency: "eur",
          p_plan: ["starter", "pro", "generative", "topup"].includes(body.plan) ? body.plan : "pro", p_paid_at: new Date(now()).toISOString(),
          p_hold_days: cfg.holdDays, p_credit_value_cents: Math.round(cfg.creditValueEur * 100), p_is_test: true,
        }), "test payment");
        return { ok: r?.result === "created", ...r };
      }
      case "adminTestRefund": {
        const userId = body.userId || await userIdByEmail(body.email);
        if (!userId) return { ok: false, problem: "No account with that email." };
        const c = must(await sb.from("commissions").select("payment_id").eq("referred_user_id", userId).maybeSingle(), "commission lookup");
        if (!c) return { ok: false, problem: "That account has no commission." };
        const r = must(await sb.rpc("affiliate_reverse_payment", { p_payment_id: c.payment_id, p_payment_intent: null, p_reason: "test refund" }), "test refund");
        return { ok: true, ...r };
      }
      case "adminTestAge": {
        // "30 days later": this affiliate's pending commissions reach the end of their hold now, then the release runs
        const id = String(body.affiliateId ?? "");
        must(await sb.from("commissions").update({ available_at: new Date(now() - 60_000).toISOString() }).eq("affiliate_id", id).eq("status", "pending"), "test age");
        const released = must(await sb.rpc("affiliate_release_due", { p_affiliate_id: id }), "release");
        return { ok: true, released };
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
      console.error(`[affiliate-api] ${body?.action}:`, e instanceof Error ? e.message : String(e));
      return json(req, { ok: false, code: "SERVER", message: "Something went wrong. Try again." }, 500);
    }
  };
}
