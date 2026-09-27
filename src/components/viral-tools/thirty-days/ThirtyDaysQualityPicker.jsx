import { useState } from "react";
import ThirtyDaysUpgradeModal from "./ThirtyDaysUpgradeModal";

const PLAN_RANK = { free: 0, guest: 0, affiliate: 1, starter: 1, pro: 2, generative: 3 };

export default function ThirtyDaysQualityPicker({ tiers, value, planCode = "free", onChange, detailForTier }) {
  const [upgradeTier, setUpgradeTier] = useState(null);

  const chooseTier = (tier) => {
    const locked = (PLAN_RANK[planCode] ?? 0) < (PLAN_RANK[tier.minPlan] ?? 0);
    if (locked) {
      setUpgradeTier(tier);
      return;
    }
    onChange(tier.id);
  };

  return (
    <div>
      <p className="text-xs font-bold text-white/75">Quality</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {Object.values(tiers).map((tier) => {
          const locked = (PLAN_RANK[planCode] ?? 0) < (PLAN_RANK[tier.minPlan] ?? 0);
          const active = value === tier.id && !locked;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => chooseTier(tier)}
              className={`h-11 min-w-0 rounded-lg px-2 text-center transition ${active ? "bg-lime-300/[.11] ring-1 ring-inset ring-lime-300/45" : "bg-[#101511] hover:bg-[#141B16]"}`}
            >
              <strong className={`block text-[13px] leading-4 ${active ? "text-lime-300" : locked ? "text-white/35" : "text-white/75"}`}>{tier.label}</strong>
              <span className={`block truncate text-[8px] leading-3 ${locked ? "text-white/25" : "text-white/32"}`}>
                {locked ? `${tier.minPlan}+` : detailForTier?.(tier)}
              </span>
            </button>
          );
        })}
      </div>
      <ThirtyDaysUpgradeModal open={!!upgradeTier} tier={upgradeTier} onClose={() => setUpgradeTier(null)} />
    </div>
  );
}
