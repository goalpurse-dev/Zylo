// src/components/GenerationLimitToast.jsx
import React, { useEffect, useState } from "react";
import { X, Zap } from "lucide-react";

export default function GenerationLimitToast({
  message,
  duration = 4500,
  onClose,
}) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // enter animation
    const enter = setTimeout(() => setVisible(true), 10);

    // auto close
    let auto;
    if (duration > 0) {
      auto = setTimeout(() => handleClose(), duration);
    }

    return () => {
      clearTimeout(enter);
      clearTimeout(auto);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (leaving) return;
    setLeaving(true);
    // match transition duration
    setTimeout(() => {
      onClose?.();
    }, 220);
  };

  return (
    <div
      className={`
        fixed right-3 top-4 z-[90]
        max-w-[260px] sm:max-w-xs
        px-3.5 py-2.5
        rounded-2xl
        bg-black/85 backdrop-blur-2xl
        border border-blue-500/40
        shadow-[0_0_22px_rgba(22,119,255,0.85)]
        flex items-start gap-2.5
        text-white/85 text-[10px]
        transition-transform duration-200 ease-out
        ${
          visible && !leaving
            ? "translate-x-0"
            : "translate-x-full"
        }
      `}
    >
      <div className="mt-0.5">
        <Zap className="w-4 h-4 text-blue-400" />
      </div>

      <div className="flex-1">
        <div className="text-[10px] font-semibold text-blue-300 mb-0.5">
          Parallel limit reached
        </div>
        <div className="leading-snug text-[9.5px] text-white/75">
          {message ||
            "You’ve hit your current plan’s max active generations. Let one finish or upgrade to unlock more slots."}
        </div>
      </div>

      <button
        onClick={handleClose}
        className="mt-0.5 ml-1 text-white/45 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
