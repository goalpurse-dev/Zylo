import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function NoCreditsModal({ open, onClose, creditsNeeded = 0, creditBalance = 0 }) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#111315] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15 border border-orange-500/20">
          <img src="/icons/whitecredit.png" alt="" className="h-8 w-8 object-contain opacity-90" />
        </div>

        <h2 className="text-center text-xl font-black text-white mb-2">
          {creditBalance === 0 ? "0 credits" : "Not enough credits"}
        </h2>
        <p className="text-center text-sm text-white/50 mb-6 leading-relaxed">
          {creditBalance === 0
            ? "You have 0 credits."
            : `You only have ${creditBalance} credits.`}
          {creditsNeeded > 0
            ? ` You need ${creditsNeeded} credits to make this video.`
            : " Get credits to make your video."}
        </p>

        <a
          href="/workspace/pricing"
          className="block w-full rounded-2xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] py-3 text-center text-[15px] font-bold text-white hover:opacity-90 transition"
        >
          Get Credits
        </a>
        <button
          onClick={onClose}
          className="mt-3 w-full text-center text-sm text-white/40 hover:text-white/60 transition py-1"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
