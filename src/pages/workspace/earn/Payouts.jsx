import { Link } from "react-router-dom";
import { RATE_CARD, PAYOUT_METHODS } from "./data";
import { fmtEur } from "./utils";
import { BG, BORDER, CARD, SECTION_LABEL, TEXT } from "./tokens";

export function PayoutsTab({ tier }) {
  const earnedEur = 12.4;
  const pct = Math.min(100, (earnedEur / RATE_CARD.payoutThresholdEur) * 100);

  return (
    <div className="space-y-6">
      <div className={`${CARD} p-5`}>
        <p className={SECTION_LABEL}>Payout progress</p>
        <p className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums ${TEXT.primary}`}>
          {fmtEur(earnedEur)} <span className={`text-sm font-semibold ${TEXT.tertiary}`}>/ €{RATE_CARD.payoutThresholdEur} threshold</span>
        </p>
        <div className={`mt-4 h-[3px] w-full overflow-hidden rounded-full ${BG.elevated}`}>
          <div className="h-full rounded-full bg-lime-400" style={{ width: `${Math.max(pct, 1.5)}%` }} />
        </div>
        <p className={`mt-3 text-[12px] ${TEXT.tertiary}`}>
          Paid out {RATE_CARD.payoutSchedule.toLowerCase()} once you cross the threshold.
        </p>
      </div>

      {tier === "paid" ? (
        <div className={`${CARD} p-5`}>
          <p className={SECTION_LABEL}>Payout method</p>
          <div className="mt-3 space-y-2">
            {PAYOUT_METHODS.map((m) => (
              <label key={m.id} className={`flex items-center gap-3 rounded-[10px] border ${BORDER.subtle} ${BG.elevated} px-3 py-2.5 text-[13px] ${TEXT.secondary}`}>
                <input type="radio" name="payout-method" className="accent-lime-400" />
                {m.label}
              </label>
            ))}
          </div>
          <p className={`mt-4 border-t ${BORDER.subtle} pt-3 text-[11.5px] leading-relaxed ${TEXT.secondary}`}>
            You're responsible for reporting and paying any taxes owed on payouts in your jurisdiction.{" "}
            <Link to="/workspace/earn/rules" className="font-semibold text-[#d0d6e0] underline decoration-white/20 underline-offset-2 transition hover:text-lime-300">
              Read the full policy →
            </Link>
          </p>
        </div>
      ) : (
        <div className={`rounded-[13px] border border-dashed ${BORDER.subtle} ${BG.surface} p-6 text-center`}>
          <p className={`text-[13px] font-semibold ${TEXT.primary}`}>Payout method setup unlocks at Paid Creator status</p>
          <p className={`mt-1.5 text-[12px] ${TEXT.tertiary}`}>Reach 100K verified lifetime views to add a payout method.</p>
        </div>
      )}
    </div>
  );
}
