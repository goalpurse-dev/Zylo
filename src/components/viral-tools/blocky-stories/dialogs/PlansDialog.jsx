import { Dialog as HeadlessDialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from "@headlessui/react";
import { Check, Lock, X } from "lucide-react";
import { FOCUS, cx } from "../../../ui/zyvo";
import { PLAN_UNLOCKS } from "../constants";
import { TIERS } from "../pricing/blockyEstimates";

/**
 * "Upgrade your plan to continue": the one upgrade popup of Blocky Stories (owner, 2026-10-09: "don't push
 * users to one plan"). It names no plan to buy: it lists what each plan unlocks and sends the user to the
 * pricing page to choose.
 *   tierId   a locked tier was pressed (V3 on Starter): the plans that include it are highlighted
 *   planCode the user's own plan, marked "Your plan" when it is one of the three
 * With no tierId (the free plan pressed a button past the ideas) every plan is shown the same.
 */
export default function PlansDialog({ open, onClose, tierId = null, planCode = null }) {
  const tier = tierId ? TIERS[tierId] : null;
  const including = tier ? PLAN_UNLOCKS.filter((p) => p.tiers.includes(tier.id)) : [];
  return (
    <HeadlessDialog open={open} onClose={onClose} className="relative z-[300]">
      <DialogBackdrop transition className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 data-[closed]:opacity-0 motion-reduce:transition-none" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          data-testid="plans-dialog"
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-lime-300/[0.13] bg-[#0C0F0D] p-6 shadow-2xl transition duration-200 ease-out data-[closed]:translate-y-3 data-[closed]:opacity-0 motion-reduce:transition-none"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, #BEF264 0%, transparent 70%)" }} />
          <button type="button" onClick={onClose} aria-label="Close" className={cx("absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:text-white", FOCUS)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-300/30 bg-gradient-to-br from-lime-300/20 to-lime-500/20">
            <Lock className="h-6 w-6 text-lime-300" aria-hidden="true" />
          </div>
          <DialogTitle className="mb-1.5 text-center text-xl font-black text-white [text-wrap:balance]">Upgrade your plan to continue</DialogTitle>
          <Description className="mb-4 text-center text-sm leading-relaxed text-white/50">
            {tier
              ? `${tier.label} comes with ${including.map((p) => p.name).join(" and ")}.`
              : "Story ideas are free to try. Here's what each plan makes."}
          </Description>
          <ul className="mb-5 flex flex-col gap-1.5" aria-label="What each plan unlocks">
            {PLAN_UNLOCKS.map((plan) => {
              const included = Boolean(tier) && plan.tiers.includes(tier.id);
              const dimmed = Boolean(tier) && !included;
              return (
                <li
                  key={plan.id}
                  data-plan={plan.id}
                  data-included={included ? "true" : "false"}
                  className={cx(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition",
                    included ? "border-lime-300/50 bg-lime-300/[0.1]" : "border-white/[0.08] bg-white/[0.035]",
                    dimmed && "opacity-45",
                  )}
                >
                  {/* A tick on the plans that include the tier; otherwise a plain bullet (an empty ring reads as something to tap). */}
                  <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full", included && "bg-lime-300 text-[#071006]")} aria-hidden="true">
                    {included ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className={cx("h-1.5 w-1.5 rounded-full", tier ? "bg-white/25" : "bg-lime-300")} />}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug">
                    <span className={cx("font-black", included ? "text-lime-200" : "text-white")}>{plan.name}:</span>{" "}
                    <span className="font-semibold text-white/65">{plan.unlocks}</span>
                    {included && <span className="sr-only">, includes {tier.label}</span>}
                  </span>
                  {planCode === plan.id && <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/60">Your plan</span>}
                </li>
              );
            })}
          </ul>
          <a href="/pricing" className={cx("flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-lime-300 to-lime-500 py-3 text-center text-[15px] font-bold text-[#071006] transition hover:opacity-90", FOCUS)}>
            See plans
          </a>
          <button type="button" onClick={onClose} className={cx("mt-3 w-full rounded-lg py-1 text-center text-sm text-white/40 transition hover:text-white/60", FOCUS)}>
            Not now
          </button>
        </DialogPanel>
      </div>
    </HeadlessDialog>
  );
}
