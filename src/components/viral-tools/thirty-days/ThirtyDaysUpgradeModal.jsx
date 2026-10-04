import { createPortal } from "react-dom";
import { Lock, Sparkles, X } from "lucide-react";

const PLAN_LABELS = {
  starter: "Starter",
  affiliate: "Starter",
  pro: "Pro",
  generative: "Generative",
};

const TIER_COPY = {
  "thirtydays-v2": {
    title: "V2 is a Starter feature",
    body: "Upgrade to Starter to generate complete 30 Days videos.",
  },
  "thirtydays-v3": {
    title: "V3 is a Pro feature",
    body: "Upgrade to Pro to unlock the sharper V3 quality tier for 30 Days videos.",
  },
  "thirtydays-v4": {
    title: "V4 is a Generative feature",
    body: "Upgrade to Generative to unlock the highest-quality 30 Days tier.",
  },
};

export default function ThirtyDaysUpgradeModal({ open, onClose, tier }) {
  if (!open || !tier) return null;
  const copy = TIER_COPY[tier.id] ?? {
    title: "This quality needs a higher plan",
    body: "Upgrade your plan to unlock this quality tier.",
  };
  const planLabel = PLAN_LABELS[tier.minPlan] ?? tier.minPlan;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="thirty-days-upgrade-title"
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-lime-300/[0.13] bg-[#0C0F0D] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-lime-300/25 blur-3xl" />
        <button type="button" onClick={onClose} aria-label="Close upgrade prompt" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-white/45 transition hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <div className="relative mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-lime-300/25 bg-lime-300/10">
          <Lock className="h-6 w-6 text-lime-300" />
        </div>
        <h2 id="thirty-days-upgrade-title" className="text-center text-xl font-black text-white">{copy.title}</h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-white/50">{copy.body}</p>
        <a href="/pricing" className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 py-3 text-sm font-black text-[#11150D] transition hover:bg-lime-200">
          <Sparkles className="h-4 w-4" />Upgrade to {planLabel}
        </a>
        <button type="button" onClick={onClose} className="mt-3 w-full py-1 text-sm text-white/35 transition hover:text-white/60">Not now</button>
      </div>
    </div>,
    document.body,
  );
}
