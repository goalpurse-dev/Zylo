import { Dialog as HeadlessDialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from "@headlessui/react";
import { Lock, Sparkles, X } from "lucide-react";
import { PLAN_LABELS } from "../../../lib/planGating";
import { FOCUS, cx } from "./styles";

/**
 * "V3 is a Pro feature" upsell for a locked tier, styled like
 * CartoonDriveByUpgradeModal (lime lock tile, corner glow, lime CTA).
 */
export default function UpgradeDialog({ open, onClose, title, body, requiredPlan }) {
  const planLabel = PLAN_LABELS[requiredPlan] ?? requiredPlan ?? "a higher plan";
  return (
    <HeadlessDialog open={open} onClose={onClose} className="relative z-[300]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 data-[closed]:opacity-0 motion-reduce:transition-none"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-lime-300/[0.13] bg-[#0C0F0D] p-6 shadow-2xl transition duration-200 ease-out data-[closed]:translate-y-3 data-[closed]:opacity-0 motion-reduce:transition-none"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, #BEF264 0%, transparent 70%)" }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cx("absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:text-white", FOCUS)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/30 bg-gradient-to-br from-lime-300/20 to-lime-500/20">
            <Lock className="h-7 w-7 text-lime-300" aria-hidden="true" />
          </div>
          <DialogTitle className="mb-2 text-center text-xl font-black text-white">{title}</DialogTitle>
          <Description className="mb-6 text-center text-sm leading-relaxed text-white/50">{body}</Description>
          <a
            href="/pricing"
            className={cx("flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-300 to-lime-500 py-3 text-center text-[15px] font-bold text-[#071006] transition hover:opacity-90", FOCUS)}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Upgrade to {planLabel}
          </a>
          <button
            type="button"
            onClick={onClose}
            className={cx("mt-3 w-full rounded-lg py-1 text-center text-sm text-white/40 transition hover:text-white/60", FOCUS)}
          >
            Not now
          </button>
        </DialogPanel>
      </div>
    </HeadlessDialog>
  );
}
