import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

const FEATURES = [
  { icon: "🎬", text: "Image & video prompts per scene" },
  { icon: "🔥", text: "MrBeast, TikTok Viral, Curiosity Gap styles" },
  { icon: "⚡", text: "AI-optimised hooks that actually retain" },
  { icon: "🎯", text: "Per-scene duration & pacing built in" },
  { icon: "📋", text: "Copy-ready scripts in seconds" },
];

const STYLE_PREVIEWS = [
  { icon: "💥", name: "MrBeast Mode", color: "#f59e0b" },
  { icon: "📱", name: "TikTok Viral", color: "#ec4899" },
  { icon: "🧠", name: "Curiosity Gap", color: "#7A3BFF" },
  { icon: "📖", name: "Story Arc", color: "#10b981" },
];

export default function ScriptUpsellModal({ open, mode, onClose }) {
  const navigate = useNavigate();
  if (!open) return null;

  const isGuest = mode === "guest";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed z-[9999] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[92%] max-w-[440px] max-h-[90dvh] overflow-y-auto rounded-3xl">
        <div
          className="relative rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: "linear-gradient(160deg, #0D0620 0%, #130826 50%, #0B0E1A 100%)" }}
        >
          {/* Top glow line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#7A3BFF] to-transparent" />

          {/* Purple ambient */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#7A3BFF]/25 rounded-full blur-[90px]" />

          <div className="relative px-6 py-7">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Style preview row — teaser of what's locked */}
            <div className="flex items-center gap-2 mb-6">
              {STYLE_PREVIEWS.map((s) => (
                <div
                  key={s.name}
                  className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border"
                  style={{ background: `${s.color}10`, borderColor: `${s.color}25` }}
                >
                  <span className="text-lg leading-none">{s.icon}</span>
                  <span className="text-[9px] text-white/30 font-medium text-center leading-tight px-0.5">{s.name}</span>
                </div>
              ))}
            </div>

            {/* Lock badge */}
            <div className="inline-flex items-center gap-1.5 bg-[#7A3BFF]/15 border border-[#7A3BFF]/30 rounded-full px-3 py-1 mb-3">
              <span className="text-xs">🔒</span>
              <span className="text-[11px] text-[#C084FC] font-semibold">
                {isGuest ? "Sign in to unlock" : "Paid feature"}
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-white text-[22px] font-bold leading-tight mb-2">
              {isGuest
                ? "Get your viral scripts free"
                : "Unlock the Script Builder"}
            </h2>
            <p className="text-white/45 text-sm leading-relaxed mb-5">
              {isGuest
                ? "Create a free account and start generating AI-powered viral scripts with image & video prompts for every scene."
                : "The Script Builder is included on every paid plan — starting from Starter at €12/mo. Pick any plan and get instant access."}
            </p>

            {/* Features */}
            <div className="space-y-2.5 mb-6">
              {FEATURES.map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: "rgba(122,59,255,0.15)", border: "1px solid rgba(122,59,255,0.2)" }}
                  >
                    {icon}
                  </div>
                  <span className="text-white/65 text-[13px]">{text}</span>
                </div>
              ))}
            </div>

            {/* Primary CTA */}
            <button
              onClick={() => navigate(isGuest ? "/signup" : "/workspace/pricing")}
              className="w-full py-4 rounded-2xl text-white font-bold text-[15px] transition-all hover:opacity-90 active:scale-[0.98] mb-3"
              style={{
                background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
                boxShadow: "0 8px 32px rgba(122,59,255,0.40)",
              }}
            >
              {isGuest ? "Create Free Account →" : "Upgrade Plan →"}
            </button>

            {/* Secondary */}
            {isGuest && (
              <button
                onClick={() => navigate("/login")}
                className="w-full py-2.5 rounded-xl text-white/40 text-sm hover:text-white/70 transition-colors"
              >
                Already have an account? Sign in
              </button>
            )}

            <p className="text-white/20 text-xs text-center mt-2">
              {isGuest ? "No credit card · Takes 30 seconds" : "Cancel anytime · Instant access"}
            </p>
          </div>

          {/* Bottom glow */}
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#7A3BFF]/40 to-transparent" />
        </div>
      </div>
    </>,
    document.body
  );
}
