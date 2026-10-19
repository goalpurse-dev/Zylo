import { createPortal } from "react-dom";
import { Lock, Sparkles, X } from "lucide-react";

/** "Remove watermark" on a plan below Pro: same look as the other templates' upgrade prompts. */
export default function CutawayUpgradeModal({ open, onClose }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#111315] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cutaway-upgrade-title">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, #F5C042 0%, transparent 70%)" }} />
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#F5C042]/30 bg-gradient-to-br from-[#F5C042]/20 to-[#7A3BFF]/20">
          <Lock className="h-7 w-7 text-[#F5C042]" />
        </div>
        <h2 id="cutaway-upgrade-title" className="mb-2 text-center text-xl font-black text-white">Removing the watermark is a Pro feature</h2>
        <p className="mb-6 text-center text-sm leading-relaxed text-white/50">On your plan, every Cutaway video ends with a short “Make videos like this with Zyvo” sign after “Congratulations”. On Pro and above you can switch it off.</p>
        <a href="/pricing" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] py-3 text-center text-[15px] font-bold text-white transition hover:opacity-90">
          <Sparkles className="h-4 w-4" />
          Upgrade to Pro
        </a>
        <button type="button" onClick={onClose} className="mt-3 w-full py-1 text-center text-sm text-white/40 transition hover:text-white/60">Not now</button>
      </div>
    </div>,
    document.body,
  );
}
