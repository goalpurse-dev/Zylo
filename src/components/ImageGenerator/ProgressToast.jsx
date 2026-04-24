import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const FREE_LIMIT = 5;

export default function ProgressToast({ remaining, onClose, duration = 5000 }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (remaining === 0) return;
    if (!duration) return;
    const t = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(t);
  }, [duration, onClose, remaining]);

  let accentColor = "#7A3BFF";
  let glowColor   = "rgba(122,59,255,0.25)";
  let badge       = null;
  let message     = "";
  let showUpgrade = false;

  if (remaining >= 3) {
    message = `${remaining} free images left this month.`;
  } else if (remaining === 2) {
    accentColor = "#C084FC";
    glowColor   = "rgba(192,132,252,0.3)";
    badge       = "Almost out";
    message     = `2 free images left — make them count!`;
    showUpgrade = true;
  } else if (remaining === 1) {
    accentColor = "#E879F9";
    glowColor   = "rgba(232,121,249,0.3)";
    badge       = "Last one!";
    message     = `1 free image left this month.`;
    showUpgrade = true;
  } else {
    accentColor = "#E879F9";
    glowColor   = "rgba(232,121,249,0.3)";
    badge       = "All used";
    message     = "You've used all your free images this month.";
    showUpgrade = true;
  }

  return (
    <div
      className="fixed right-4 md:right-6 z-[9999]"
      style={{
        bottom: "calc(var(--ftg-toast-bottom, 24px) + env(safe-area-inset-bottom))",
        animation: "slideNotifIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}
    >
      {/* Responsive bottom offset: above bottom nav on mobile, standard on desktop */}
      <style>{`
        @media (max-width: 1023px) { :root { --ftg-toast-bottom: 82px; } }
        @media (min-width: 1024px) { :root { --ftg-toast-bottom: 24px; } }
      `}</style>
      <div
        className="relative flex items-start gap-3.5 w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border backdrop-blur-xl px-4 py-4"
        style={{
          borderColor: `${accentColor}30`,
          background: "#0B0E1A",
          boxShadow: `0 4px 30px ${glowColor}, 0 2px 12px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 inset-x-5 h-px rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}50, transparent)` }}
        />

        {/* Zyvo icon */}
        <div className="relative shrink-0">
          <img
            src="/assets/ai/robot.webp"
            alt="Zyvo AI"
            className="w-10 h-10 rounded-full border"
            style={{ borderColor: `${accentColor}30`, boxShadow: `0 0 14px ${accentColor}40` }}
          />
          <div
            className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
            style={{ background: `${accentColor}20`, filter: "blur(8px)" }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white text-sm font-semibold leading-tight">Zyvo AI</span>
            {badge && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}30` }}
              >
                {badge}
              </span>
            )}
          </div>

          <p className="text-white/65 text-sm leading-snug">{message}</p>

          {showUpgrade && (
            <button
              onClick={() => { onClose?.(); navigate("/workspace/pricing"); }}
              className="mt-2.5 text-xs px-3 py-1.5 rounded-full border text-white transition"
              style={{
                borderColor: `${accentColor}40`,
                background: `${accentColor}15`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = `${accentColor}30`)}
              onMouseLeave={(e) => (e.currentTarget.style.background = `${accentColor}15`)}
            >
              Upgrade →
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded-full text-white/25 hover:text-white hover:bg-white/10 transition text-xs shrink-0"
        >
          ✕
        </button>
      </div>

      <style>{`
        @keyframes slideNotifIn {
          from { opacity: 0; transform: translateX(16px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}