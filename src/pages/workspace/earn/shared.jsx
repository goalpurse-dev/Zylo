import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Info, Instagram, Music2, Send, Twitter, Wallet, Wand2, Youtube } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { MILESTONES, ONBOARDING_STEPS, RATE_CARD } from "./data";
import { fmtNumber, useCountUp } from "./utils";
import { BG, BORDER, CARD, CARD_SM, HOVER, SECTION_LABEL, TEXT } from "./tokens";

// ── Scroll-triggered entry animation ──────────────────────────────────────
export function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-[400ms] ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────
export function Skeleton({ className }) {
  return <div className={`animate-pulse rounded-[8px] ${BG.elevated} ${className}`} />;
}

export function InfoTip({ text }) {
  return (
    <span className="group/tip relative inline-flex">
      <Info className={`h-3 w-3 ${TEXT.tertiary} transition group-hover/tip:text-[#d0d6e0]`} />
      <span className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-44 -translate-x-1/2 rounded-[8px] border ${BORDER.strong} ${BG.elevated} px-2.5 py-1.5 text-[11px] leading-snug ${TEXT.secondary} opacity-0 transition group-hover/tip:opacity-100`}>
        {text}
      </span>
    </span>
  );
}

const STATUS_STYLES = {
  verified: "border-lime-400/25 bg-lime-400/[0.08] text-lime-300",
  pending: `${BORDER.subtle} ${BG.elevated} ${TEXT.tertiary}`,
  rejected: "border-rose-400/25 bg-rose-400/[0.08] text-rose-300",
};

export function StatusBadge({ status, reason }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}
      title={reason || (status === "pending" ? "Verified 48h after posting — see Rules" : undefined)}
    >
      {label}
    </span>
  );
}

// ── Rate card ─────────────────────────────────────────────────────────────
function RateStat({ value, label, sublabel, tip, description, glow }) {
  return (
    <div className="relative flex w-full flex-col items-start gap-2">
      {glow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-8 -inset-y-6 -z-10 rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(198,240,60,0.05), transparent 70%)" }}
        />
      )}
      <p className={`text-[40px] font-semibold leading-none tracking-[-0.02em] ${TEXT.primary} tabular-nums`}>{value}</p>
      <div className={`flex h-8 flex-col justify-start text-[11px] font-medium uppercase leading-[16px] tracking-[0.06em] ${TEXT.tertiary}`}>
        <span>{label}</span>
        <span className="inline-flex items-center gap-1">
          {sublabel}
          {tip && <InfoTip text={tip} />}
        </span>
      </div>
      {description && (
        <p className={`max-w-[30ch] text-[13px] leading-[1.5] ${TEXT.secondary}`}>{description}</p>
      )}
    </div>
  );
}

export function RateCard() {
  return (
    <div className={`relative overflow-hidden ${CARD} p-6`}>
      <p className={SECTION_LABEL}>The rate card</p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[repeat(3,1fr)]">
        <RateStat
          value={`${RATE_CARD.creditsPerThousandViews}`}
          label="credits per"
          sublabel="1,000 views"
          tip="Views counted by the platform's own analytics, 48h after posting."
          description="Verified views only — see the definition below."
          glow
        />
        <RateStat
          value={`${RATE_CARD.referralCommissionPct}%`}
          label="referral"
          sublabel="commission"
          tip="Commission is credited once the referral's purchase completes."
          description={`Paid on the first purchase a referred signup makes, within a ${RATE_CARD.cookieWindowDays}-day cookie window.`}
        />
        <RateStat
          value={`€${RATE_CARD.payoutThresholdEur}`}
          label="payout"
          sublabel="threshold"
          tip="Minimum earned credits required before a payout is issued."
          description={`Paid ${RATE_CARD.payoutSchedule.toLowerCase()} · ${RATE_CARD.creditsPerEur} credits ≈ €1.00`}
        />
      </div>

      <p className={`mt-5 border-t ${BORDER.subtle} pt-3 text-[13px] leading-relaxed ${TEXT.secondary}`}>
        A "verified view" is one confirmed by the platform's own analytics, 48h after posting.{" "}
        <Link
          to="/workspace/earn/rules"
          className="font-semibold text-[#d0d6e0] underline decoration-white/20 underline-offset-2 transition hover:text-lime-300"
        >
          See full rules →
        </Link>
      </p>
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────
const HOW_IT_WORKS_STEPS = [
  { n: "01", title: "Create", body: "Make content with any Zyvo tool.", icon: Wand2 },
  { n: "02", title: "Post", body: "Publish it with your tracking link attached.", icon: Send },
  { n: "03", title: "Get paid", body: "Verified views convert to credits — and cash once you unlock Paid Creator.", icon: Wallet },
];

export function HowItWorks() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-9 z-0 hidden h-px bg-[rgba(255,255,255,0.06)] md:block" />
      <div className="grid gap-3 md:grid-cols-3">
        {HOW_IT_WORKS_STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.n} className={`relative z-10 ${CARD} p-5`}>
              <div className="flex items-center justify-between">
                <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1a1b1d] font-mono text-[11px] font-semibold text-lime-300">
                  {s.n}
                </span>
                <Icon className={`h-7 w-7 ${TEXT.secondary}`} strokeWidth={1.5} />
              </div>
              <p className={`mt-3 text-[17px] font-semibold ${TEXT.primary}`}>{s.title}</p>
              <p className={`mt-1.5 min-h-[45px] text-[14px] leading-[1.6] ${TEXT.secondary}`}>{s.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Onboarding checklist ──────────────────────────────────────────────────
export function OnboardingChecklist({ completedKeys = [] }) {
  const doneCount = completedKeys.length;
  const pct = Math.round((doneCount / ONBOARDING_STEPS.length) * 100);

  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between">
        <p className={SECTION_LABEL}>Get set up</p>
        <span className={`text-[11px] font-semibold tabular-nums ${TEXT.tertiary}`}>{doneCount}/{ONBOARDING_STEPS.length}</span>
      </div>

      <div className={`mt-3 h-[3px] w-full overflow-hidden rounded-full ${BG.elevated}`}>
        <div
          className="h-full rounded-full bg-lime-400 transition-all duration-500"
          style={{ width: `${Math.max(pct, doneCount ? 4 : 2)}%` }}
        />
      </div>

      <div className="mt-3 space-y-1">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = completedKeys.includes(step.key);
          const isAnchor = step.href.startsWith("#");
          const rowClass = "flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors duration-150 ease-out hover:bg-[#1a1b1d]";
          const inner = (
            <>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                done ? "border-lime-400/40 bg-lime-400/15 text-lime-300" : `${BORDER.strong} ${TEXT.tertiary}`
              }`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13px] font-semibold ${done ? `${TEXT.disabled} line-through` : TEXT.primary}`}>
                  {step.title}
                </span>
                <span className={`block text-[11.5px] ${TEXT.tertiary}`}>{step.description}</span>
              </span>
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${TEXT.disabled}`} />
            </>
          );
          return isAnchor ? (
            <a key={step.key} href={step.href} className={rowClass}>{inner}</a>
          ) : (
            <Link key={step.key} to={step.href} className={rowClass}>{inner}</Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Paid Creator progress ────────────────────────────────────────────────
export function PaidCreatorProgress({ verifiedViews = 0 }) {
  const target = 100_000;
  const pct = Math.min(100, (verifiedViews / target) * 100);
  const filledPct = verifiedViews > 0 ? Math.max(pct, 1.2) : 0.9;
  const next = MILESTONES.find((m) => verifiedViews < m.views);

  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between">
        <p className={SECTION_LABEL}>Paid Creator status</p>
        <span className={`rounded-full border ${BORDER.subtle} ${BG.elevated} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TEXT.tertiary}`}>
          {verifiedViews >= target ? "Unlocked" : "Locked"}
        </span>
      </div>

      <p className={`mt-4 text-2xl font-semibold tracking-tight tabular-nums ${TEXT.primary}`}>
        {fmtNumber(verifiedViews)} <span className={`text-sm font-semibold ${TEXT.tertiary}`}>/ 100K verified views</span>
      </p>

      <div className="relative mt-6 h-3">
        <div className={`absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full ${BG.elevated}`}>
          <div className="h-full rounded-full bg-lime-400" style={{ width: `${filledPct}%` }} />
        </div>
        {MILESTONES.map((m) => {
          const reached = verifiedViews >= m.views;
          return (
            <div
              key={m.views}
              className="group/ms absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(m.views / target) * 100}%` }}
            >
              <div className={`h-2 w-2 rounded-full border-2 ${
                reached ? "border-lime-300 bg-lime-300" : `${BORDER.strong} ${BG.surface}`
              }`} />
              <div className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-36 -translate-x-1/2 rounded-[8px] border ${BORDER.strong} ${BG.elevated} px-2.5 py-1.5 text-[10.5px] leading-snug ${TEXT.secondary} opacity-0 transition group-hover/ms:opacity-100`}>
                <span className={`font-semibold ${TEXT.primary}`}>{m.label} views</span> — {m.unlock}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`mt-2 flex justify-between text-[10px] font-semibold tabular-nums ${TEXT.disabled}`}>
        {MILESTONES.map((m) => <span key={m.views}>{m.label}</span>)}
      </div>

      <p className={`mt-4 text-[12px] leading-relaxed ${TEXT.tertiary}`}>
        {next ? (
          <>{fmtNumber(next.views - verifiedViews)} views to unlock <span className={TEXT.secondary}>{next.unlock}</span></>
        ) : (
          "All milestones unlocked."
        )}
      </p>
    </div>
  );
}

// ── Hero backdrop: subtle grain + low-opacity lime glow, bottom-left ─────
const NOISE_BG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("${NOISE_BG}")` }} />
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -left-24 h-[520px] w-[520px] rounded-full blur-[130px]"
        style={{ background: "rgba(198,240,60,0.04)" }}
      />
    </div>
  );
}

// ── Locked-tab teaser ─────────────────────────────────────────────────────
export function LockedTeaser({ icon: Icon, title, body, onJoin }) {
  return (
    <div className={`flex flex-col items-center rounded-[13px] border border-dashed ${BORDER.subtle} ${BG.surface} px-6 py-14 text-center`}>
      {Icon && (
        <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-[11px] border ${BORDER.subtle} ${BG.elevated} ${TEXT.tertiary}`}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className={`text-[15px] font-semibold ${TEXT.primary}`}>{title}</p>
      <p className={`mt-1.5 max-w-sm text-[13px] leading-relaxed ${TEXT.secondary}`}>{body}</p>
      <button
        onClick={onJoin}
        className="mt-5 rounded-[9px] bg-lime-400 px-4 py-2.5 text-[13px] font-semibold text-[#0a1006] transition hover:bg-lime-300"
      >
        Join Creator Program
      </button>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────
export function StatCard({ label, tip, value, decimals = 0, delta, secondary, icon: Icon, loading, elevated }) {
  const count = useCountUp(value, { active: !loading, decimals });
  const cardClass = elevated
    ? `rounded-[11px] border border-[rgba(255,255,255,0.06)] bg-[#1a1b1d] ${HOVER}`
    : CARD_SM;

  if (loading) {
    return (
      <div className={`${cardClass} p-3.5 sm:p-4`}>
        <Skeleton className="h-7 w-16" />
        {secondary && <Skeleton className="mt-1 h-2.5 w-14" />}
        <Skeleton className="mt-2.5 h-3 w-24" />
        <Skeleton className="mt-1.5 h-2.5 w-20" />
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-3.5 sm:p-4`}>
      <p className={`text-[22px] font-semibold tabular-nums tracking-tight sm:text-[24px] ${TEXT.primary}`}>
        {decimals > 0 ? count.toFixed(decimals) : fmtNumber(count)}
      </p>
      {secondary && <p className={`mt-0.5 text-[11px] tabular-nums ${TEXT.tertiary}`}>{secondary}</p>}

      <div className="mt-1.5 flex items-center gap-1.5">
        {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${TEXT.tertiary}`} />}
        <p className={`text-[12.5px] font-medium ${TEXT.tertiary}`}>{label}</p>
        {tip && <InfoTip text={tip} />}
      </div>

      {delta ? (
        <p className="mt-1 text-[11px] font-semibold text-lime-300/80">{delta}</p>
      ) : (
        <p className={`mt-1 text-[11px] ${TEXT.disabled}`}>No data yet</p>
      )}
    </div>
  );
}

// ── Connected accounts (real data via get_my_social_accounts) ───────────
const PLATFORM_META = {
  instagram: { label: "Instagram", Icon: Instagram, connectable: true },
  youtube: { label: "YouTube", Icon: Youtube, connectable: true },
  tiktok: { label: "TikTok", Icon: Music2, connectable: true },
  x: { label: "X (Twitter)", Icon: Twitter, connectable: false },
};

function timeAgo(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ConnectedAccountsCard() {
  const [accounts, setAccounts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_my_social_accounts");
      if (!cancelled) setAccounts(data ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={`${CARD} p-5`}>
      <p className={SECTION_LABEL}>Connected accounts</p>
      <p className={`mt-1.5 text-[13px] ${TEXT.secondary}`}>Verification only runs on accounts you've connected.</p>

      <div className="mt-3.5 space-y-1">
        {Object.entries(PLATFORM_META).map(([id, meta]) => {
          const account = accounts?.find((a) => a.platform === id);
          const Icon = meta.Icon;
          return (
            <div key={id} className="flex items-center gap-3 rounded-[10px] px-1.5 py-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border ${BORDER.subtle} ${BG.elevated} ${TEXT.secondary}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13px] font-semibold ${TEXT.primary}`}>{meta.label}</span>
                <span className={`block truncate text-[11.5px] ${TEXT.tertiary}`}>
                  {account
                    ? (account.display_name || account.username || "Connected")
                    : meta.connectable ? "Not connected" : "Coming soon"}
                </span>
              </span>
              {account ? (
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full border border-lime-400/25 bg-lime-400/[0.08] px-2 py-0.5 text-[10px] font-semibold text-lime-300">
                    Connected
                  </span>
                  <span className={`text-[10px] ${TEXT.disabled}`}>{timeAgo(account.updated_at || account.connected_at)}</span>
                </span>
              ) : meta.connectable ? (
                <Link
                  to="/workspace/connections"
                  className={`shrink-0 rounded-[8px] border ${BORDER.subtle} ${BG.elevated} px-2.5 py-1.5 text-[11px] font-semibold ${TEXT.secondary} transition hover:border-[rgba(255,255,255,0.12)] hover:text-[#f7f8f8]`}
                >
                  Connect
                </Link>
              ) : (
                <span className={`shrink-0 rounded-full border ${BORDER.subtle} ${BG.surface} px-2 py-0.5 text-[10px] font-semibold ${TEXT.disabled}`}>
                  Soon
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
