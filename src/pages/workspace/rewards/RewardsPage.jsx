// /rewards — free credits for paying users (owner's brief, 2026-11-25). Part 1: post "Made with Zyvo" videos, earn by
// views (tiers in _shared/rewards/config.js, with "≈ N free videos" from the live In This Town price). Part 2: invite a
// friend, both get credits on their first purchase. Free plans see everything, locked ("Included with every paid plan").
// Cash for creators is the separate Affiliate program (/affiliate).
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, ChevronDown, Copy, Download, ExternalLink, Gift, Link2, Lock, RefreshCw, Send, Share2, ShoppingBag, Sparkles, UserPlus, Video, Wallet } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { REWARDS } from "../../../../supabase/functions/_shared/rewards/config.js";
import { PLATFORM_NAMES, freeVideos, freeVideosLabel, maxCredits, parseVideoUrl, viewsLabel } from "../../../../supabase/functions/_shared/rewards/rules.js";
import { rewardsApi } from "../../../lib/rewards";
import { AFFILIATE_PATH } from "../../../lib/affiliate";
import { CARD, LABEL } from "../affiliate/ui.js";

const fmt = (n) => Number(n || 0).toLocaleString("en");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}

/** Over a locked part: the upsell (free plans and signed-out visitors). */
function Locked({ signedIn, children }) {
  const navigate = useNavigate();
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-35 blur-[1.5px]" aria-hidden="true">{children}</div>
      <div className="absolute inset-0 grid place-items-center p-3">
        <div className="max-w-[320px] rounded-2xl border border-lime-300/30 bg-[#111312]/95 px-4 py-3.5 text-center shadow-xl" data-testid="rewards-locked">
          <p className="flex items-center justify-center gap-1.5 text-[14.5px] font-bold text-white"><Lock className="h-4 w-4 text-lime-300" aria-hidden="true" />Included with every paid plan</p>
          <button type="button" onClick={() => navigate(signedIn ? "/pricing" : "/signup")}
            className="mt-2.5 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-lime-300 px-4 text-[14px] font-black text-[#11150D] hover:bg-lime-200">
            {signedIn ? "See plans" : "Sign up free"}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Tiers({ config }) {
  const price = config.freeVideo?.credits;
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Views and credits" data-testid="rewards-tiers">
      {config.tiers.map((t, i) => {
        const nv = freeVideos(t.credits, i, price);
        return (
          <li key={t.views} className={`rounded-2xl border p-3 ${i === config.tiers.length - 1 ? "col-span-2 border-lime-300/40 bg-lime-300/[0.08] sm:col-span-1" : "border-white/10 bg-white/[0.035]"}`}>
            <p className="text-[12px] font-semibold text-white/55">{viewsLabel(t.views)} views</p>
            <p className="mt-0.5 text-[19px] font-black tabular-nums text-white">{fmt(t.credits)} <span className="text-[12px] font-bold text-white/50">credits</span></p>
            {nv > 0 && <p className="mt-0.5 text-[12px] font-semibold text-lime-200/90">{freeVideosLabel(nv)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function SubmitForm({ weekLeft, onSubmitted }) {
  const [url, setUrl] = useState("");
  const [views, setViews] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const parsed = url.trim() ? parseVideoUrl(url) : null;
  const submit = async (e) => {
    e.preventDefault();
    if (!parsed) { setProblem("Paste a TikTok, Instagram Reel or YouTube Shorts link."); return; }
    setBusy(true); setProblem(null);
    try {
      const r = await rewardsApi("submit", { url, views: views.replace(/[^0-9]/g, "") });
      if (r.ok) { toast.success("Sent for review"); setUrl(""); setViews(""); onSubmitted(); }
      else setProblem({ duplicate: "That video was already sent.", weekly_limit: `You've sent ${REWARDS.submissionsPerWeek} videos this week. Try again in a few days.`, url: "Paste a TikTok, Instagram Reel or YouTube Shorts link.", locked: "Included with every paid plan." }[r.problem] ?? "Couldn't send it. Try again.");
    } catch (err) { setProblem(err.message); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className={`${CARD} p-4 sm:p-5`} aria-label="Send a video" data-testid="rewards-submit">
      <div className="flex items-center justify-between gap-2">
        <p className={LABEL}>Send your video</p>
        <span className="text-[12px] text-white/45">{weekLeft} of {REWARDS.submissionsPerWeek} left this week</span>
      </div>
      <div className={`mt-2.5 flex items-center rounded-xl border bg-white/[0.05] ${url.trim() && !parsed ? "border-amber-300/60" : "border-white/10 focus-within:border-lime-300/60"}`}>
        <Link2 className="ml-3.5 h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste the TikTok, Reel or Shorts link" inputMode="url" autoComplete="off" aria-label="Video link" data-testid="rewards-url"
          className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[15px] text-white outline-none placeholder:text-white/35" />
        {parsed && <span className="mr-3 shrink-0 rounded-full bg-lime-300/15 px-2 py-0.5 text-[11.5px] font-bold text-lime-200" data-testid="rewards-platform">{PLATFORM_NAMES[parsed.platform]}</span>}
      </div>
      <input value={views} onChange={(e) => setViews(e.target.value)} placeholder="Views right now (optional)" inputMode="numeric" aria-label="Views right now (optional)"
        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 text-[14.5px] text-white outline-none placeholder:text-white/35 focus:border-lime-300/60" />
      {problem && <p className="mt-2 text-[13px] text-amber-200" role="alert">{problem}</p>}
      <button type="submit" disabled={busy || !weekLeft} className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 text-[15.5px] font-black text-[#11150D] hover:bg-lime-200 disabled:opacity-50">
        <Send className="h-4 w-4" aria-hidden="true" />{busy ? "Sending…" : "Send for review"}
      </button>
      <p className="mt-2 text-[12px] text-white/40">Any time, no deadline. The "Made with Zyvo" badge must be visible for the whole video.</p>
    </form>
  );
}

function Submissions({ items, onChanged }) {
  const [open, setOpen] = useState(null);
  const [views, setViews] = useState("");
  const recheck = async (id) => {
    try {
      const r = await rewardsApi("recheck", { id, views: views.replace(/[^0-9]/g, "") });
      if (r.ok) { toast.success("Sent back for review"); setOpen(null); setViews(""); onChanged(); }
      else toast.error({ too_soon: "You can ask for a re-check once a day.", in_review: "It's already in review." }[r.problem] ?? "Couldn't send it.");
    } catch (e) { toast.error(e.message); }
  };
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="My submissions" data-testid="rewards-submissions">
      <p className={LABEL}>My submissions</p>
      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-[13.5px] text-white/50">Nothing yet. Your first {fmt(REWARDS.videoTiers[0].views)} views are worth {fmt(REWARDS.videoTiers[0].credits)} credits.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {items.map((s) => {
            const tier = s.tierViews ? REWARDS.videoTiers.find((t) => t.views === Number(s.tierViews)) : null;
            return (
              <li key={s.id} className="py-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-white/70"><Video className="h-4 w-4" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 truncate text-[13.5px] font-semibold text-white hover:underline">
                      <span className="truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span><ExternalLink className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
                    </a>
                    <p className="mt-0.5 text-[12.5px]">
                      {s.status === "in_review" && <span className="text-amber-200">In review{s.recheck ? " (re-check)" : ""}</span>}
                      {s.status === "approved" && <span className="text-lime-300">Approved: {tier ? viewsLabel(tier.views) : ""} views · +{fmt(s.creditsPaid)} credits</span>}
                      {s.status === "rejected" && <span className="text-white/55">Rejected{s.rejectReason ? `: ${s.rejectReason}` : ""}</span>}
                      <span className="text-white/35"> · {PLATFORM_NAMES[s.platform]} · {fmtDate(s.createdAt)}</span>
                    </p>
                  </div>
                  {s.status !== "in_review" && (
                    <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[12px] font-semibold text-white/75 hover:bg-white/10">
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Re-check views
                    </button>
                  )}
                </div>
                {open === s.id && (
                  <div className="mt-2 flex gap-2 pl-12">
                    <input value={views} onChange={(e) => setViews(e.target.value)} placeholder="Views now" inputMode="numeric" aria-label="Views now"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 text-[14px] text-white outline-none focus:border-lime-300/60" />
                    <button type="button" onClick={() => recheck(s.id)} className="rounded-lg bg-lime-300 px-3 text-[13px] font-black text-[#11150D]">Send</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-white/40">Hit a higher tier later? Re-check: you get only the difference to the new tier.</p>
    </section>
  );
}

function StatIcon({ icon }) {
  const Icon = icon;
  return <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
}

function InviteCard({ me, onCopy }) {
  const inv = me?.invite;
  const link = inv?.link ?? `${REWARDS.siteUrl}/?invite=YOURCODE`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const stats = me?.inviteStats ?? { joined: 0, bought: 0, credits: 0 };
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="Your invite link" data-testid="rewards-invite">
      <p className={LABEL}>Your invite link</p>
      <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-dashed border-lime-300/30 bg-lime-300/[0.05] p-3">
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-white" data-testid="rewards-invite-link">{link.replace(/^https?:\/\//, "")}</p>
        <button type="button" onClick={() => onCopy(link, "Link copied")} aria-label="Copy invite link" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime-300 text-[#11150D]"><Copy className="h-4 w-4" aria-hidden="true" /></button>
        {canShare && (
          <button type="button" aria-label="Share invite link" onClick={() => navigator.share({ title: "Zyvo", text: `Make videos with Zyvo — get ${REWARDS.invite.friendCredits} bonus credits with my link`, url: link }).catch(() => {})}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white"><Share2 className="h-4 w-4" aria-hidden="true" /></button>
        )}
      </div>
      {inv?.kind === "affiliate" && <p className="mt-2 text-[12.5px] text-white/55">You're an affiliate, so your invite link is your affiliate link: invites count there. <Link to={AFFILIATE_PATH} className="font-semibold text-lime-300 hover:underline">Open Affiliate →</Link></p>}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[["Joined", stats.joined, UserPlus], ["Bought a plan", stats.bought, ShoppingBag], ["Credits earned", stats.credits, Wallet]].map(([label, v, icon]) => (
          <div key={label} className="rounded-2xl bg-white/[0.04] p-3">
            <p className="flex items-center gap-1 text-[11.5px] font-semibold text-white/50"><StatIcon icon={icon} />{label}</p>
            <p className="mt-1 text-[20px] font-black tabular-nums text-white">{fmt(v)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RulesFaq() {
  const t = REWARDS.videoTiers, i = REWARDS.invite;
  const items = [
    ["Who can earn?", "Everyone on a paid plan. Free plans can see this page; videos and invites unlock with any paid plan."],
    ["How do video rewards work?", `Add the "Made with Zyvo" badge (visible the whole video), post on TikTok, Instagram Reels or YouTube Shorts, and send the link here. We check the views by hand: ${t.map((x) => `${viewsLabel(x.views)} → ${fmt(x.credits)}`).join(", ")} credits.`],
    ["What if my video keeps growing?", "Press Re-check views (once a day). When it reaches a higher tier you get only the difference — the credits already paid count."],
    ["Limits?", `Up to ${REWARDS.submissionsPerWeek} videos a week. Each video can be sent only once, by anyone. Videos must be made with Zyvo.`],
    ["How do invites work?", `Share your link. When your friend makes their first purchase (a plan or a credit pack), you get ${fmt(i.inviterCredits)} credits and they get ${fmt(i.friendCredits)}. Signing up alone doesn't count.`],
    ["Invite rules", `Your friend opens your link before, or within ${i.windowDays} days of, creating their account. Up to ${i.maxPerMonth} invite rewards a month, and only while you're on a paid plan. No inviting yourself. Several sign-ups from the same connection within ${i.ipCooldownDays} days still count, but get no credits.`],
    ["One referrer per person", "If someone came through a creator's affiliate code or link, the creator gets them, not the invite. An affiliate's invite link is their affiliate link."],
    ["Refunds", `If the friend's first purchase is refunded or disputed within ${i.clawbackDays} days, the invite credits that haven't been used yet are taken back from both.`],
  ];
  return (
    <section className={`${CARD} p-1.5`} aria-label="Rules and FAQ">
      <details className="group">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between rounded-[18px] px-3.5 text-[15px] font-bold text-white hover:bg-white/[0.03]">
          Rules &amp; FAQ <ChevronDown className="h-4 w-4 text-white/50 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <dl className="space-y-3 px-3.5 pb-4 pt-1">
          {items.map(([q, a]) => <div key={q}><dt className="text-[14px] font-semibold text-white">{q}</dt><dd className="mt-0.5 text-[13.5px] leading-snug text-white/55">{a}</dd></div>)}
        </dl>
      </details>
    </section>
  );
}

export default function RewardsPage() {
  const { user, loading } = useAuth();
  const [me, setMe] = useState(null);
  const [config, setConfig] = useState({ tiers: REWARDS.videoTiers, freeVideo: { credits: REWARDS.freeVideo.fallbackCredits } });
  const [error, setError] = useState(null);

  useEffect(() => { document.title = "Rewards · Free credits on Zyvo"; }, []);
  const load = useCallback(async () => {
    setError(null);
    try {
      if (user) { const m = await rewardsApi("me"); setMe(m); setConfig(m.config); }
      else setConfig(await rewardsApi("config"));
    } catch (e) { if (user) setError(e.message); }
  }, [user]);
  useEffect(() => { if (!loading) load(); }, [loading, load]);

  const onCopy = async (text, msg) => { if (await copyText(text)) toast.success(msg); else toast.error("Couldn't copy. Long-press to copy instead."); };
  const paid = Boolean(me?.paid);
  const signedIn = Boolean(user);
  const steps = [
    { icon: BadgeCheck, title: "Add the \"Made with Zyvo\" badge", text: "Visible for the whole video." },
    { icon: Send, title: "Post it, then paste the link here", text: "TikTok, Reels or Shorts — any time, no deadline." },
    { icon: Gift, title: "We review and add credits", text: "Checked by hand. Bigger reach, bigger tier." },
  ];
  const badge = (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1"><p className="text-[14.5px] font-bold text-white">The "Made with Zyvo" badge</p><p className="text-[12.5px] text-white/50">Transparent PNG for a corner of your video.</p></div>
        <a href={REWARDS.badgePath} download="made-with-zyvo.png" data-testid="rewards-badge-download" className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-lime-300 px-3.5 text-[13.5px] font-black text-[#11150D]">
          <Download className="h-4 w-4" aria-hidden="true" />Download
        </a>
      </div>
      <div className="mt-3 grid place-items-center rounded-xl bg-[repeating-conic-gradient(rgba(255,255,255,0.06)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-3">
        <img src={REWARDS.badgePath} alt="Made with Zyvo badge" className="h-9 w-auto max-w-full" />
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-[#090A0A] pb-[calc(110px+env(safe-area-inset-bottom))] lg:pb-12" data-testid="rewards-page">
      <div className="mx-auto w-full max-w-[880px] space-y-3 px-4 pt-4 sm:px-6 sm:pt-6">
        {error && <div className={`${CARD} p-4 text-center text-[14px] text-white`}>{error} <button type="button" onClick={load} className="ml-2 font-bold text-lime-300">Try again</button></div>}

        {/* Part 1: videos */}
        <section className="relative overflow-hidden rounded-[26px] border border-lime-300/20 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(190,242,100,0.16),rgba(9,10,10,0)_60%)] px-5 pb-5 pt-7 sm:px-8 sm:pt-9">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 text-[12px] font-bold text-lime-200"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Rewards · free credits</span>
          <h1 className="mt-3.5 text-[30px] font-black leading-[1.08] tracking-[-0.03em] text-white sm:text-[40px]">Post your Zyvo videos. Earn up to {fmt(maxCredits())} credits.</h1>
          {me && !paid && <p className="mt-2 text-[13.5px] text-white/55">You're on the free plan: everything below unlocks with any paid plan.</p>}
          <div className="mt-5"><Tiers config={config} /></div>
        </section>

        <ol className="grid gap-2.5 sm:grid-cols-3" aria-label="How it works">
          {steps.map((s, i) => (
            <li key={s.title} className={`${CARD} flex gap-3.5 p-4`}>
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-lime-300/25 bg-gradient-to-b from-lime-300/25 to-lime-300/[0.06] text-lime-200">
                <s.icon className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-[11px] font-black text-[#11150D]">{i + 1}</span>
              </span>
              <div><h3 className="text-[15px] font-bold text-white">{s.title}</h3><p className="mt-0.5 text-[13px] leading-snug text-white/55">{s.text}</p></div>
            </li>
          ))}
        </ol>

        {paid ? (
          <>
            {badge}
            <SubmitForm weekLeft={me.weekLeft} onSubmitted={load} />
            <Submissions items={me.submissions} onChanged={load} />
          </>
        ) : (
          <Locked signedIn={signedIn}><div className="space-y-3">{badge}<SubmitForm weekLeft={REWARDS.submissionsPerWeek} onSubmitted={() => {}} /></div></Locked>
        )}

        {/* Part 2: invites */}
        <section className="pt-3" aria-labelledby="rewards-invite-title">
          <h2 id="rewards-invite-title" className="px-1 text-[24px] font-black leading-tight tracking-tight text-white">Invite a friend. You both get credits.</h2>
          <p className="mt-1 px-1 text-[14px] text-white/60">When they make their first purchase: <b className="text-lime-300">+{fmt(REWARDS.invite.inviterCredits)}</b> for you, <b className="text-lime-300">+{fmt(REWARDS.invite.friendCredits)}</b> for them.</p>
        </section>
        {paid ? <InviteCard me={me} onCopy={onCopy} /> : <Locked signedIn={signedIn}><InviteCard me={null} onCopy={() => {}} /></Locked>}

        <Link to={AFFILIATE_PATH} className={`${CARD} flex items-center gap-3 p-4 transition hover:border-white/20`} data-testid="rewards-to-affiliate">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lime-300"><Wallet className="h-5 w-5" aria-hidden="true" /></span>
          <span className="flex-1 text-[14.5px] font-bold text-white">Want cash instead? Become an affiliate</span>
          <ArrowRight className="h-4 w-4 text-white/50" aria-hidden="true" />
        </Link>

        <RulesFaq />
      </div>
    </div>
  );
}
