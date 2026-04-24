import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

export default function WelcomeScreen({ onClose }) {
  const navigate = useNavigate();

  const handleStart = () => {
    onClose();
    navigate("/workspace/image-generator");
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#07080F] px-5">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-[#7A3BFF]/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#C084FC]/6 blur-[100px]" />
      </div>

      {/* Content */}
      <div
        className="relative w-full max-w-[420px] flex flex-col items-center text-center"
        style={{ animation: "wsEnter 0.5s cubic-bezier(0.22,1,0.36,1) forwards" }}
      >
        {/* Logo mark */}
        <div className="relative mb-8">
          <div className="absolute inset-0 scale-[2] bg-[#7A3BFF]/20 rounded-full blur-2xl" />
          <img
            src="/assets/ai/robot.webp"
            alt="Zyvo"
            className="relative w-20 h-20 rounded-full border-2 border-[#7A3BFF]/50"
            style={{ boxShadow: "0 0 40px rgba(122,59,255,0.55)" }}
          />
          <span className="absolute inset-0 rounded-full border border-[#7A3BFF]/40 animate-ping" />
        </div>

        {/* Headline */}
        <h1 className="text-white text-[32px] sm:text-[38px] font-extrabold leading-tight tracking-tight mb-3">
          You're in.
        </h1>

        {/* Credits pill */}
        <div
          className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 mb-5"
          style={{
            background: "rgba(122,59,255,0.12)",
            border: "1px solid rgba(122,59,255,0.3)",
          }}
        >
          <span className="text-xl">⚡</span>
          <div className="text-left">
            <div className="text-white font-bold text-[17px] leading-tight">5 free generations</div>
            <div className="text-white/45 text-[12px]">No credit card · Cancel anytime</div>
          </div>
        </div>

        {/* Sub copy */}
        <p className="text-white/50 text-[15px] leading-relaxed mb-10 max-w-[340px]">
          Generate scroll-stopping AI images, viral short-form videos, and full video scripts — all from a single platform.
        </p>

        {/* What you can make — 3 pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {[
            { emoji: "🖼️", label: "AI Images" },
            { emoji: "🎬", label: "AI Videos" },
            { emoji: "✍️", label: "Viral Scripts" },
          ].map(({ emoji, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-white/70"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={handleStart}
          className="w-full py-4 rounded-2xl text-white font-bold text-[17px] transition active:scale-[0.98] hover:brightness-110"
          style={{
            background: "linear-gradient(135deg, #7A3BFF, #A855F7)",
            boxShadow: "0 12px 40px rgba(122,59,255,0.5)",
          }}
        >
          Generate my first image →
        </button>

        {/* Skip */}
        <button
          onClick={onClose}
          className="mt-4 text-white/25 text-sm hover:text-white/50 transition"
        >
          Explore on my own
        </button>
      </div>

      <style>{`
        @keyframes wsEnter {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
