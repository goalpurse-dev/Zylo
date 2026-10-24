import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Lock, Sparkles, X } from "lucide-react";

/**
 * "Remove watermark" on a plan below Pro: the same kind of prompt the other templates show for a locked option
 * (e.g. CartoonDriveByUpgradeModal), in the Cutaway green. It sends the user to the pricing page to choose.
 */
export default function CutawayUpgradeModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="cw-reveal relative w-full max-w-sm overflow-hidden rounded-3xl border border-cutaway/[0.16] bg-[#0C0F0D] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cutaway-upgrade-title">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, #4ADE80 0%, transparent 70%)" }} />
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cutaway/30 bg-gradient-to-br from-cutaway/20 to-cutaway-deep/20">
          <Lock className="cw-wiggle h-7 w-7 text-cutaway" />
        </div>
        <h2 id="cutaway-upgrade-title" className="mb-2 text-center text-xl font-black text-white">Removing the watermark is a Pro feature</h2>
        <p className="mb-6 text-center text-sm leading-relaxed text-white/50">On your plan, every Cutaway video ends with a short “Make videos like this with Zyvo” sign after “Congratulations”. On Pro and above you can switch it off.</p>
        <a href="/pricing" className="cw-press flex w-full items-center justify-center gap-2 rounded-2xl bg-cutaway py-3 text-center text-[15px] font-black text-cutaway-ink hover:bg-cutaway-soft">
          <Sparkles className="h-4 w-4" />
          Upgrade to Pro
        </a>
        <button type="button" onClick={onClose} className="mt-3 w-full py-1 text-center text-sm text-white/40 transition hover:text-white/60">Not now</button>
      </div>
    </div>,
    document.body,
  );
}
