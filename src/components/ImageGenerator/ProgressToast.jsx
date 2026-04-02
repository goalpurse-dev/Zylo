import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ProgressToast({
  remaining,
  onClose,
  duration = 4500,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (remaining === 0) return; // don't auto-close final one
    if (!duration) return;

    const t = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(t);
  }, [duration, onClose, remaining]);

  let message = "";
  let showUpgrade = false;

  if (remaining > 1) {
    message = `Nice. ${remaining} free generations remaining.`;
  } else if (remaining === 1) {
    message = `You're on fire. 1 more to go.`;
  } else {
    message =
      "That was your final free generation. Upgrade to continue creating.";
    showUpgrade = true;
  }

  return (
    <div 
    style={{
  bottom: "calc(140px + env(safe-area-inset-bottom))"
}}
    className="fixed right-4  md:right-6 z-[9999] animate-[slideInUp_0.35s_ease-out]">
      <div
        className="
          relative
          flex items-start gap-4
          max-w-sm
          rounded-2xl
          border border-[#7A3BFF]/30
          bg-[#0B0E1A]/85
          backdrop-blur-xl
          shadow-[0_0_40px_rgba(122,59,255,0.25)]
          px-5 py-4
        "
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <img
            src="/assets/ai/robot.webp"
            alt="Zyvo AI"
            className="w-10 h-10 rounded-full border border-white/10"
          />
          <div className="absolute inset-0 rounded-full bg-[#7A3BFF]/30 blur-md opacity-60 animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="text-white font-semibold text-sm">
            Zyvo AI
          </div>

          <div className="text-white/70 text-sm mt-1 leading-relaxed">
            {message}
          </div>

          {showUpgrade && (
            <button
              onClick={() => {
                onClose?.();
                navigate("/workspace/pricing");
              }}
              className="
                mt-3
                text-sm
                px-4 py-2
                rounded-full
                border border-[#7A3BFF]/40
                bg-white/5
                backdrop-blur-md
                text-white
                hover:bg-[#7A3BFF]/20
                transition
              "
            >
              Upgrade
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/40 hover:text-white transition text-sm"
        >
          ✕
        </button>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}