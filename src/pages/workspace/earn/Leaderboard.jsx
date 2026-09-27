import { Link } from "react-router-dom";
import { CARD, TEXT } from "./tokens";
import { fmtNumber, hashGradient } from "./utils";
import { CREDITS_PAID_THIS_MONTH, MOCK_LEADERBOARD } from "./data";

function Avatar({ handle }) {
  return <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full" style={{ background: hashGradient(handle) }} />;
}

function LeaderboardRow({ rank, handle, credits }) {
  const top3 = rank <= 3;
  return (
    <div className="flex h-11 items-center gap-3 px-1">
      <span className={`w-6 shrink-0 text-[13px] tabular-nums ${TEXT.tertiary}`}>{rank}</span>
      <Avatar handle={handle} />
      <span className={`min-w-0 flex-1 truncate text-[13.5px] font-medium ${top3 ? "text-lime-300" : TEXT.secondary}`}>
        {handle}
      </span>
      <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${TEXT.primary}`}>{fmtNumber(credits)}</span>
    </div>
  );
}

function MonthlyStat() {
  return (
    <div>
      <p className={`text-[32px] font-semibold tracking-[-0.02em] tabular-nums ${TEXT.primary}`}>
        {fmtNumber(CREDITS_PAID_THIS_MONTH)}
      </p>
      <p className={`mt-1 text-[13px] ${TEXT.tertiary}`}>credits paid to creators this month</p>
    </div>
  );
}

export function LeaderboardStrip() {
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-start justify-between gap-3">
        <MonthlyStat />
        <Link to="/workspace/earn/leaderboard" className={`shrink-0 text-[12px] font-medium ${TEXT.tertiary} transition hover:text-[#d0d6e0]`}>
          View all →
        </Link>
      </div>

      <div className="mt-5 divide-y divide-[rgba(255,255,255,0.06)]">
        {MOCK_LEADERBOARD.slice(0, 5).map((c, i) => (
          <LeaderboardRow key={c.handle} rank={i + 1} handle={c.handle} credits={c.credits} />
        ))}
      </div>
    </div>
  );
}

export function LeaderboardTab() {
  return (
    <div className={`${CARD} p-6`}>
      <MonthlyStat />

      <div className="mt-5 divide-y divide-[rgba(255,255,255,0.06)]">
        {MOCK_LEADERBOARD.map((c, i) => (
          <LeaderboardRow key={c.handle} rank={i + 1} handle={c.handle} credits={c.credits} />
        ))}
      </div>

      <p className={`mt-4 text-[11.5px] ${TEXT.disabled}`}>Handles are anonymized. Rankings reset on the 1st of each month.</p>
    </div>
  );
}
