import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock, Coins, Eye, Lock, Megaphone, Users as UsersIcon } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useReferralLink } from "./useReferralLink";
import {
  ConnectedAccountsCard,
  HeroBackdrop,
  HowItWorks,
  LockedTeaser,
  OnboardingChecklist,
  PaidCreatorProgress,
  RateCard,
  Reveal,
  StatCard,
} from "./shared";
import { fmtEur, fmtNumber } from "./utils";
import { ReferralCard } from "./Referral";
import { LeaderboardStrip, LeaderboardTab } from "./Leaderboard";
import { SubmissionsTab } from "./Submissions";
import { PayoutsTab } from "./Payouts";
import { RulesTab } from "./Rules";
import { CASH_CAMPAIGNS, MOCK_PAYOUT_FEED, MOCK_STATS, RATE_CARD } from "./data";
import { BG, BORDER, CARD, SECTION_LABEL, TEXT } from "./tokens";

const ENROLL_KEY_PREFIX = "zyvo:earn-enrolled:";

const TABS = [
  { key: "overview", label: "Overview", path: "/workspace/earn" },
  { key: "submissions", label: "Submissions", path: "/workspace/earn/submissions" },
  { key: "referrals", label: "Referrals", path: "/workspace/earn/referrals" },
  { key: "payouts", label: "Payouts", path: "/workspace/earn/payouts" },
  { key: "leaderboard", label: "Leaderboard", path: "/workspace/earn/leaderboard" },
  { key: "rules", label: "Rules", path: "/workspace/earn/rules" },
];

const NAV_HEIGHT = 56;

function SubNav({ activeKey }) {
  return (
    <div
      className="sticky top-0 z-40 w-full border-b border-[rgba(255,255,255,0.06)] bg-[#0f1011]/[0.92]"
      style={{ height: NAV_HEIGHT, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div
        className="mx-auto flex h-full max-w-[1200px] items-stretch gap-5 overflow-x-auto px-5 lg:px-8 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {TABS.map((t) => {
          const active = activeKey === t.key;
          return (
            <Link
              key={t.key}
              to={t.path}
              className={`relative flex h-full shrink-0 items-center text-[13px] font-medium transition-colors duration-150 ${
                active ? "text-[#f7f8f8]" : "text-[#8a8f98] hover:text-[#d0d6e0]"
              }`}
            >
              {t.label}
              {active && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-lime-400" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CompactHeader({ state }) {
  const tierLabel =
    state === "PAID_TIER_UNLOCKED" ? "Paid Creator" : state === "ACTIVE" ? "Active Creator" : "Creator Program";
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[32px] font-semibold tracking-[-0.02em] text-[#f7f8f8]">Create. Post. Earn.</h1>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/25 bg-lime-400/[0.08] px-3 py-1 text-[11px] font-semibold text-lime-300">
        <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
        {tierLabel}
      </span>
    </div>
  );
}

function StatsGrid({ loading, elevated }) {
  const s = MOCK_STATS;
  return (
    <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
      <StatCard
        label="Total views"
        tip="Views across all connected accounts, matched to posts using your tracking link."
        icon={Eye}
        value={s.totalViews.value}
        delta={s.totalViews.delta}
        loading={loading}
        elevated={elevated}
      />
      <StatCard
        label="Pending credits"
        tip="Credits from submissions still inside the 48h verification window."
        icon={Clock}
        value={s.pendingCredits.value}
        secondary={`≈ ${fmtEur(s.pendingCredits.value / RATE_CARD.creditsPerEur)}`}
        delta={s.pendingCredits.delta}
        loading={loading}
        elevated={elevated}
      />
      <StatCard
        label="Earned credits"
        tip="Credits confirmed after verification — ready to convert toward payout."
        icon={Coins}
        value={s.earnedCredits.value}
        secondary={`≈ ${fmtEur(s.earnedCredits.value / RATE_CARD.creditsPerEur)}`}
        delta={s.earnedCredits.delta}
        loading={loading}
        elevated={elevated}
      />
      <StatCard
        label="Referral earnings"
        tip={`${RATE_CARD.referralCommissionPct}% commission on referred signups, within the ${RATE_CARD.cookieWindowDays}-day cookie window.`}
        icon={UsersIcon}
        value={s.referralEarnings.value}
        decimals={2}
        delta={s.referralEarnings.delta}
        loading={loading}
        elevated={elevated}
      />
    </div>
  );
}

const MARQUEE_ROW_UNIT = 44; // row height (36px) + margin-bottom (8px)
const MARQUEE_VISIBLE_ROWS = 5;

function PayoutMarquee() {
  const rows = [...MOCK_PAYOUT_FEED, ...MOCK_PAYOUT_FEED];
  return (
    <div
      className="earn-marquee-viewport relative w-full overflow-hidden"
      style={{
        height: MARQUEE_ROW_UNIT * MARQUEE_VISIBLE_ROWS,
        maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
      }}
    >
      <div className="earn-marquee-track">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`mb-2 flex h-9 w-full items-center gap-2 rounded-[10px] border ${BORDER.subtle} ${BG.surface} px-3.5`}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400/70" />
            <p className={`min-w-0 flex-1 truncate text-[12.5px] ${TEXT.secondary}`}>
              <span className={`font-medium ${TEXT.primary}`}>{r.handle}</span> earned{" "}
              <span className={`font-semibold tabular-nums ${TEXT.primary}`}>{fmtNumber(r.credits)}</span> credits · {r.timeAgo}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero({ onJoin }) {
  return (
    <div
      className="relative isolate grid min-h-[260px] gap-8 overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[#131415] px-6 py-8 sm:px-10 lg:grid-cols-2 lg:items-center lg:gap-16"
    >
      <HeroBackdrop />
      <div className="relative max-w-lg">
        <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.06)] bg-[#1a1b1d] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#8a8f98]">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
          Creator Rewards
        </span>
        <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f7f8f8] sm:text-[46px]">
          Create. Post. Earn.
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-[#d0d6e0]">
          Create with Zyvo. Publish to your audience. Earn rewards from verified performance.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={onJoin}
            className="flex items-center gap-1.5 rounded-[9px] bg-lime-400 px-5 py-3 text-[13.5px] font-semibold text-[#0a1006] transition hover:bg-lime-300"
          >
            Join Creator Program
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <Link
            to="/workspace/earn/rules"
            className="rounded-[9px] border border-[rgba(255,255,255,0.06)] px-5 py-3 text-[13.5px] font-medium text-[#d0d6e0] transition hover:border-[rgba(255,255,255,0.12)]"
          >
            See the rules
          </Link>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <PayoutMarquee />
      </div>
    </div>
  );
}

function LockedStatsPreview() {
  return (
    <div>
      <p className={SECTION_LABEL}>What you'll track once you join</p>
      <div className={`relative mt-4 overflow-hidden ${CARD} p-6`}>
        <div className="pointer-events-none select-none opacity-50 blur-[4px]">
          <StatsGrid loading={false} elevated />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`inline-flex items-center gap-2 rounded-full border ${BORDER.strong} bg-[#1a1b1d] px-4 py-2.5 text-[13px] font-medium ${TEXT.secondary}`}
          >
            <Lock className="h-3.5 w-3.5" />
            Unlocks when you join
          </span>
        </div>
      </div>
    </div>
  );
}

function NotEnrolledOverview({ onJoin }) {
  return (
    <div className="space-y-20">
      <Reveal><Hero onJoin={onJoin} /></Reveal>
      <Reveal delay={60}><RateCard /></Reveal>
      <Reveal delay={120}>
        <div>
          <p className={SECTION_LABEL}>How it works</p>
          <div className="mt-4"><HowItWorks /></div>
        </div>
      </Reveal>
      <Reveal delay={180}><LeaderboardStrip /></Reveal>
      <Reveal delay={240}><LockedStatsPreview /></Reveal>
    </div>
  );
}

function LockedTab({ title, body, onJoin }) {
  return <LockedTeaser icon={Lock} title={title} body={body} onJoin={onJoin} />;
}

function CashCampaigns() {
  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-lime-300" />
        <p className={SECTION_LABEL}>Cash campaigns</p>
      </div>
      <div className="space-y-2">
        {CASH_CAMPAIGNS.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between gap-3 rounded-[10px] border ${BORDER.subtle} ${BG.elevated} px-3.5 py-3`}
          >
            <div className="min-w-0">
              <p className={`truncate text-[13px] font-semibold ${TEXT.primary}`}>{c.title}</p>
              <p className={`text-[11.5px] ${TEXT.tertiary}`}>{c.deadline}</p>
            </div>
            <span className="shrink-0 rounded-full border border-lime-400/25 bg-lime-400/[0.08] px-2.5 py-1 text-[11px] font-semibold text-lime-300">
              {c.payout}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EarnPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [enrolled, setEnrolled] = useState(false);
  useEffect(() => {
    if (!user) return;
    setEnrolled(localStorage.getItem(ENROLL_KEY_PREFIX + user.id) === "1");
  }, [user]);

  // Keep anchor jumps / scroll-into-view clear of the sticky sub-nav.
  useEffect(() => {
    const el = document.getElementById("workspace-scroll");
    if (!el) return;
    const prev = el.style.scrollPaddingTop;
    el.style.scrollPaddingTop = `${NAV_HEIGHT + 24}px`;
    return () => { el.style.scrollPaddingTop = prev; };
  }, []);

  const previewParam = searchParams.get("state");
  const state = useMemo(() => {
    if (previewParam === "active") return "ACTIVE";
    if (previewParam === "paid") return "PAID_TIER_UNLOCKED";
    if (previewParam === "enrolled") return "ENROLLED_NO_ACTIVITY";
    if (previewParam === "not_enrolled") return "NOT_ENROLLED";
    return enrolled ? "ENROLLED_NO_ACTIVITY" : "NOT_ENROLLED";
  }, [previewParam, enrolled]);

  const isEnrolled = state !== "NOT_ENROLLED";
  const hasActivity = state === "ACTIVE" || state === "PAID_TIER_UNLOCKED";
  const tier = state === "PAID_TIER_UNLOCKED" ? "paid" : "active";

  const { link, loading: linkLoading, error: linkError } = useReferralLink(isEnrolled ? user : null);

  const [dashLoading, setDashLoading] = useState(true);
  useEffect(() => {
    if (!hasActivity) return;
    setDashLoading(true);
    const t = setTimeout(() => setDashLoading(false), 550);
    return () => clearTimeout(t);
  }, [hasActivity, state]);

  const joinCreatorProgram = () => {
    if (user) localStorage.setItem(ENROLL_KEY_PREFIX + user.id, "1");
    setEnrolled(true);
    if (location.pathname !== "/workspace/earn") navigate("/workspace/earn");
  };

  const activeTab = TABS.find((t) => t.path === location.pathname)?.key ?? "overview";
  const verifiedViews = state === "PAID_TIER_UNLOCKED" ? 128_400 : state === "ACTIVE" ? 43_200 : 0;

  const sidebar = isEnrolled && (
    <div className="space-y-6 lg:w-[320px] lg:shrink-0">
      <PaidCreatorProgress verifiedViews={verifiedViews} />
      <RateCard />
      <ConnectedAccountsCard />
    </div>
  );

  let overviewContent;
  if (state === "NOT_ENROLLED") {
    overviewContent = <NotEnrolledOverview onJoin={joinCreatorProgram} />;
  } else if (state === "ENROLLED_NO_ACTIVITY") {
    overviewContent = (
      <div className="space-y-20">
        <Reveal><OnboardingChecklist completedKeys={[]} /></Reveal>
        <Reveal delay={60}><ReferralCard link={link} loading={linkLoading} error={linkError} /></Reveal>
      </div>
    );
  } else {
    overviewContent = (
      <div className="space-y-20">
        <Reveal><StatsGrid loading={dashLoading} /></Reveal>
        {tier === "paid" && <Reveal delay={60}><CashCampaigns /></Reveal>}
        <Reveal delay={tier === "paid" ? 120 : 60}>
          <ReferralCard link={link} loading={linkLoading} error={linkError} showStats title="Referrals" />
        </Reveal>
      </div>
    );
  }

  let tabContent = overviewContent;
  if (activeTab === "submissions") {
    tabContent = isEnrolled ? (
      <SubmissionsTab />
    ) : (
      <LockedTab
        title="Submissions unlock once you join"
        body="Track every post, its verified views, and the credits it earned — all in one table."
        onJoin={joinCreatorProgram}
      />
    );
  } else if (activeTab === "referrals") {
    tabContent = isEnrolled ? (
      <ReferralCard link={link} loading={linkLoading} error={linkError} showStats title="Your referral link" />
    ) : (
      <LockedTab
        title="Start earning referral commission"
        body={`Earn ${RATE_CARD.referralCommissionPct}% commission on signups from your link, tracked for ${RATE_CARD.cookieWindowDays} days.`}
        onJoin={joinCreatorProgram}
      />
    );
  } else if (activeTab === "payouts") {
    tabContent = isEnrolled ? (
      <PayoutsTab tier={tier} />
    ) : (
      <LockedTab
        title="Payouts unlock once you join"
        body={`€${RATE_CARD.payoutThresholdEur} minimum · ${RATE_CARD.payoutSchedule.toLowerCase()}.`}
        onJoin={joinCreatorProgram}
      />
    );
  } else if (activeTab === "leaderboard") {
    tabContent = <LeaderboardTab />;
  } else if (activeTab === "rules") {
    tabContent = <RulesTab />;
  } else {
    tabContent = overviewContent;
  }

  const showSidebar = isEnrolled && activeTab !== "leaderboard" && activeTab !== "rules";

  return (
    <div className="earn-page min-h-screen bg-[#08090a]">
      <SubNav activeKey={activeTab} />

      <div className="mx-auto max-w-[1200px] px-5 pb-28 pt-8 lg:px-8 lg:pb-12">
        {isEnrolled && <CompactHeader state={state} />}

        {showSidebar ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 space-y-6">{tabContent}</div>
            {sidebar}
          </div>
        ) : (
          tabContent
        )}
      </div>
    </div>
  );
}
