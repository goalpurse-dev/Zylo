import { Lock } from "lucide-react";
import { PLAN_LABELS } from "../../../lib/planGating";
import SectionLabel from "./SectionLabel";
import { FOCUS, cx } from "./styles";

/**
 * V2 / V3 / V4 quality cards with plan locks (Cartoon Drive By style).
 *
 *   tiers: [{ id, label, tag, minPlan }]
 *   allowedIds: tier ids the user's plan can use
 *   onLockedClick(tier): open the upgrade dialog for a locked tier
 */
export default function QualityCards({ tiers, value, allowedIds, onChange, onLockedClick, label = "Quality", hint, disabled = false }) {
  return (
    <div>
      <SectionLabel hint={hint}>{label}</SectionLabel>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={label}>
        {tiers.map((tier) => {
          const locked = !allowedIds.includes(tier.id);
          const active = value === tier.id;
          const planName = PLAN_LABELS[tier.minPlan] ?? tier.minPlan;
          return (
            <button
              key={tier.id}
              type="button"
              aria-pressed={active && !locked}
              aria-label={locked ? `${tier.label}, needs the ${planName} plan` : `${tier.label}, ${tier.tag}`}
              disabled={disabled}
              onClick={() => (locked ? onLockedClick?.(tier) : onChange(tier.id))}
              className={cx(
                "relative h-[56px] rounded-xl border px-2 py-1.5 text-center transition disabled:cursor-not-allowed lg:h-[48px]",
                FOCUS,
                active && !locked ? "border-lime-300/50 bg-lime-300/[0.1]" : "border-white/[0.08] bg-white/[0.035] hover:border-white/15",
              )}
            >
              <span className={cx("block text-[13px] font-black", locked ? "text-white/30" : active ? "text-lime-300" : "text-white")}>
                {locked && <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" />}
                {tier.label}
              </span>
              <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-wide text-white/30">
                {locked ? planName : tier.tag}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
