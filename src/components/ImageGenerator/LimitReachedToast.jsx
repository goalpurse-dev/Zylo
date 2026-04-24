import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LimitReachedToast({ resetAt, onClose }) {
  const navigate = useNavigate();
  const [daysLeft, setDaysLeft] = useState(null);

  useEffect(() => {
    if (!resetAt) return;
    const ms = new Date(resetAt).getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    setDaysLeft(Math.max(1, days));
  }, [resetAt]);

  const handleUpgrade = () => {
    onClose();
    navigate("/workspace/pricing");
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px] md:hidden"
        onClick={onClose}
      />

      <div
        className="fixed bottom-6 right-4 md:right-6 z-[9999] w-[340px] max-w-[calc(100vw-2rem)]"
        style={{ animation: "slideNotifUp 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
      >
        <div className="relative rounded-2xl border border-[#7A3BFF]/35 bg-[#0B0E1A] backdrop-blur-xl shadow-[0_8px_60px_rgba(122,59,255,0.45),0_2px_20px_rgba(0,0,0,0.8)]">

          {/* Top accent line */}
          <div className="absolute top-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-[#7A3BFF]/50 to-transparent" />

          <div className="px-5 py-5">

            {/* Header: icon + sender + close */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative shrink-0">
                <img
                  src="/assets/ai/robot.webp"
                  alt="Zyvo AI"
                  className="w-11 h-11 rounded-full border border-[#7A3BFF]/30 shadow-[0_0_18px_rgba(122,59,255,0.5)]"
                />
                <div className="absolute inset-0 rounded-full bg-[#7A3BFF]/20 blur-md animate-pulse pointer-events-none" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold leading-tight">Zyvo AI</div>
                <div className="text-[#9D6BFF] text-xs font-medium mt-0.5">Monthly limit reached</div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-white/30 hover:text-white hover:bg-white/10 transition text-xs"
              >
                ✕
              </button>
            </div>

            {/* Progress bar: 10/10 */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-white/40">Free generations used</span>
                <span className="text-xs font-bold text-white tabular-nums">5 / 5</span>
              </div>
              <div className="h-1.5 w-full bg-white/[0.07] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7A3BFF] to-[#C084FC]"
                  style={{ width: "100%", boxShadow: "0 0 8px rgba(122,59,255,0.7)" }}
                />
              </div>
            </div>

            {/* Message */}
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              You've used all <span className="text-white font-semibold">5 free generations</span> this month.
              Upgrade to keep creating viral content.
            </p>

            {/* Perks list */}
            <div className="space-y-2 mb-4">
              {[
                "Unlimited AI image generations",
                "AI video generator",
                "Pro models & premium styles",
                "Product photos & brand kits",
              ].map((perk) => (
                <div key={perk} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-[#7A3BFF]/15 border border-[#7A3BFF]/35 flex items-center justify-center shrink-0">
                    <span className="text-[#9D6BFF] text-[9px] font-bold leading-none">✓</span>
                  </div>
                  <span className="text-sm text-white/75">{perk}</span>
                </div>
              ))}
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex -space-x-1.5">
                {["🧑‍💻", "👩‍🎨", "🧑‍🚀", "👩‍💼"].map((emoji, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full bg-[#1C1F2E] border border-[#7A3BFF]/20 flex items-center justify-center text-[11px] leading-none"
                  >
                    {emoji}
                  </div>
                ))}
              </div>
              <span className="text-xs text-white/35">4,200+ creators on Zyvo</span>
            </div>

            {/* CTA */}
            <button
              onClick={handleUpgrade}
              className="w-full rounded-full py-2.5 font-semibold text-white text-sm transition active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
                boxShadow: "0 4px 20px rgba(122,59,255,0.55)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
            >
              Upgrade Now →
            </button>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={onClose}
                className="text-xs text-white/25 hover:text-white/50 transition"
              >
                Maybe later
              </button>
              {daysLeft !== null && (
                <span className="text-xs text-white/25">
                  Resets in {daysLeft}d
                </span>
              )}
            </div>

          </div>
        </div>

        <style>{`
          @keyframes slideNotifUp {
            from { opacity: 0; transform: translateY(16px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0)   scale(1);    }
          }
        `}</style>
      </div>
    </>
  );
}