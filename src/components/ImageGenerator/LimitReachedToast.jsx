import { useNavigate } from "react-router-dom";

export default function LimitReachedToast({ resetInDays, onClose }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_0.25s_ease-out]">
      <div
        className="
          relative
          w-[92%] max-w-md
          rounded-2xl
          border border-[#7A3BFF]/30
          bg-[#0B0E1A]/90
          backdrop-blur-xl
          shadow-[0_0_60px_rgba(122,59,255,0.35)]
          px-6 py-6
        "
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition"
        >
          ✕
        </button>

        {/* Zyvo Logo */}
        <div className="flex justify-center mb-4">
          <img
            src="/assets/ai/robot.webp"
            alt="Zyvo"
            className="w-14 h-14 rounded-full border border-white/10 shadow-lg"
          />
        </div>

        {/* Title */}
        <div className="text-white text-lg font-semibold text-center">
          You’ve used all 3 free generations this week.
        </div>

        {/* Subtext */}
        <div className="text-white/70 text-sm mt-3 text-center leading-relaxed">
          Upgrade to keep creating instantly — or your limit resets in{" "}
          <span className="text-white font-medium">
            {resetInDays ?? 7} days
          </span>.
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            onClose();
            navigate("/workspace/pricing");
          }}
          className="
            mt-6 w-full
            rounded-full
            border border-[#7A3BFF]/40
            bg-white/5
            backdrop-blur-md
            py-3
            text-white
            hover:bg-[#7A3BFF]/20
            transition
          "
        >
          Upgrade
        </button>
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