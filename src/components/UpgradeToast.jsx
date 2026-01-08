import React, { useEffect } from "react";
import { X, Crown } from "lucide-react";

// Reuse your brand gradient + colors
const zyloGrad =
  "bg-gradient-to-r from-[#7A3BFF] via-[#5C9DFF] to-[#2AF0FF]";
const CARD =
  "rounded-2xl border border-white/10 bg-[#0B0F14]/80 backdrop-blur";

export default function UpgradeToast({
  open,
  plan = "Pro",               // "Pro" | "Generative"
  message = "Upgrade required to use this feature.",
  actionText,                 // defaults to "Upgrade to {plan}"
  onUpgrade,
  onClose,
  duration = 4200,            // auto-dismiss ms (disabled if 0)
}) {
  useEffect(() => {
    if (!open || !duration) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div className="fixed z-[60] top-4 right-4 w-[360px] animate-[toastIn_.28s_ease-out_forwards]">
      <style>{`
        @keyframes toastIn {
          0%   { opacity: 0; transform: translateY(-8px) scale(.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className={`${CARD} shadow-xl overflow-hidden`}>
        {/* Header strip */}
        <div className={`h-1.5 ${zyloGrad}`} />

        <div className="p-4 flex gap-3">
          {/* Icon bubble */}
          <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center">
            <Crown className="h-5 w-5 text-white/90" />
          </div>

          {/* Text */}
          <div className="flex-1">
            <div className="text-sm font-bold text-white">
              Upgrade for <span className="text-white/90">{plan}</span>
            </div>
            <div className="text-xs text-white/70 mt-0.5">
              {message}
            </div>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={onUpgrade}
                className={`inline-flex items-center justify-center h-9 px-3.5 rounded-xl text-sm font-semibold text-white ${zyloGrad} shadow-md hover:opacity-[.95]`}
              >
                {actionText || `Upgrade to ${plan}`}
              </button>
              <button
                onClick={onClose}
                className="h-9 px-3 rounded-xl text-sm font-semibold text-white/80 hover:bg-white/10 border border-white/10"
              >
                Later
              </button>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="self-start -mr-1 -mt-1 p-2 text-white/60 hover:text-white"
            aria-label="Close upgrade notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
