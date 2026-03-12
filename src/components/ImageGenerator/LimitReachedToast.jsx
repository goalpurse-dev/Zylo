import { useNavigate } from "react-router-dom";

export default function LimitReachedToast({ resetInDays, onClose }) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate("/workspace/pricing");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-[fadeIn_0.25s_ease-out]">
      <div
        className="
          relative
          w-[92%] max-w-md
          rounded-2xl
          border border-[#7A3BFF]/30
          bg-[#0B0E1A]/95
          backdrop-blur-xl
          shadow-[0_0_80px_rgba(122,59,255,0.35)]
          px-6 py-7
        "
      >

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition"
        >
          ✕
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img
            src="/assets/ai/robot.webp"
            alt="Zyvo"
            className="w-14 h-14 rounded-full border border-white/10 shadow-lg"
          />
        </div>

        {/* Title */}
        <div className="text-white text-xl font-semibold text-center">
          Your free generations are finished
        </div>

        {/* Subtext */}
        <div className="text-white/70 text-sm mt-3 text-center leading-relaxed">
          You just created <span className="text-white font-semibold">3 AI images</span>.
          Upgrade to keep generating unlimited content instantly.
        </div>

        {/* Value bullets */}
        <div className="mt-5 space-y-2 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <span className="text-[#7A3BFF]">✓</span>
            Unlimited AI image generations
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#7A3BFF]">✓</span>
            AI product photos & viral images
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#7A3BFF]">✓</span>
            AI video generator
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#7A3BFF]">✓</span>
            Script generator for TikTok & Reels
          </div>
        </div>

        {/* Social proof */}
        <div className="text-xs text-white/50 text-center mt-4">
          Most creators upgrade to keep generating content.
        </div>

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          className="
            mt-6 w-full
            rounded-full
            py-3
            font-medium
            text-white
            bg-gradient-to-r from-[#7A3BFF] to-[#9D6BFF]
            hover:opacity-90
            transition
            shadow-[0_0_25px_rgba(122,59,255,0.5)]
          "
        >
          Unlock Zyvo Pro
        </button>

        {/* Secondary */}
        <button
          onClick={onClose}
          className="w-full text-xs text-white/40 mt-3 hover:text-white transition"
        >
          Maybe later
        </button>

        {/* Reset timer */}
        <div className="text-center text-xs text-white/40 mt-4">
          Free generations reset in{" "}
          <span className="text-white">
            {resetInDays ?? 7} days
          </span>
        </div>

      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
      `}</style>
    </div>
  );
}