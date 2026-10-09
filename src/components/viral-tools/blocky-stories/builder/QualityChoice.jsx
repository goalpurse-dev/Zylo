import { Lock } from "lucide-react";
import { FOCUS, cx } from "../../../ui/zyvo";
import { PLAN_LABELS } from "../../../../lib/planGating";
import { TIERS, TIER_IDS } from "../pricing/blockyEstimates";

const TIER_LIST = TIER_IDS.map((id) => TIERS[id]);

/**
 * V2 / V3 / V4 as three buttons. A tier above the user's plan stays in view with a lock and where it
 * starts ("Available on Pro"); pressing it opens the upgrade popup instead of selecting it. The server
 * refuses a tier above the plan too (blocky-story-api), so this is a signpost, not the guard.
 *   allowed: tier ids the viewer may select;  labelledBy: id of the visible label
 */
export default function QualityChoice({ value, allowed, onChange, onLocked, labelledBy, size = "sm" }) {
  return (
    <div className="flex min-w-0 flex-1 items-stretch gap-1.5" role="group" aria-labelledby={labelledBy}>
      {TIER_LIST.map((tier) => {
        const locked = !allowed.includes(tier.id);
        const selected = !locked && value === tier.id;
        const plan = PLAN_LABELS[tier.minPlan] ?? tier.minPlan;
        return (
          <button
            key={tier.id}
            type="button"
            aria-pressed={selected}
            aria-label={locked ? `${tier.label}, locked: available on ${plan}` : `${tier.label}, ${tier.tag}`}
            onClick={() => (locked ? onLocked(tier.id) : onChange({ tierId: tier.id }))}
            className={cx(
              "flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border px-1 leading-tight transition",
              size === "lg" ? "min-h-[52px] py-2" : "py-1.5",
              FOCUS,
              selected ? "border-lime-300/60 bg-lime-300/[0.12] text-lime-200" : locked ? "border-white/[0.06] bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/60" : "border-white/[0.08] bg-white/[0.035] text-white/75 hover:border-white/25",
            )}
          >
            <span className="flex items-center gap-1 text-[12px] font-black">{locked && <Lock className="h-3 w-3" aria-hidden="true" />}{tier.label}</span>
            <span className="text-center text-[9px] font-bold leading-[1.2] opacity-70 [text-wrap:balance]">{locked ? `Available on ${plan}` : tier.tag}</span>
          </button>
        );
      })}
    </div>
  );
}
