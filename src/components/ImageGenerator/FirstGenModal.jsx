import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

export default function FirstGenModal({ imageUrl, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handlePlans = () => {
    onClose();
    navigate("/workspace/pricing");
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Wrapper */}
      <div
        className="relative w-full max-w-[420px] max-h-[90dvh] flex flex-col"
        style={{ animation: "fgmEnter 0.4s cubic-bezier(0.34,1.4,0.64,1) forwards" }}
      >
        {/* X button — outside the card, never clipped */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-50 w-8 h-8 flex items-center justify-center rounded-full text-white/80 hover:text-white transition text-sm shadow-lg"
          style={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          ✕
        </button>

        {/* Card — scrollable, rounded, never overflows screen */}
        <div className="w-full rounded-[28px] overflow-hidden overflow-y-auto shadow-[0_40px_120px_rgba(0,0,0,0.9)]">

          {/* Generated image — fixed height on mobile, taller on desktop */}
          {imageUrl && (
            <div className="relative w-full h-52 sm:h-72 bg-[#0B0E1A] shrink-0">
              <img
                src={imageUrl}
                alt="Your generated image"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#0D0F1C] to-transparent" />
            </div>
          )}

          {/* Card body */}
          <div
            className="bg-[#0D0F1C] px-5 pt-4 pb-6"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
          >
            <h2 className="text-white text-[20px] font-bold leading-tight mb-2">
              Like what you're seeing?
            </h2>
            <p className="text-white/55 text-[13px] leading-relaxed mb-4">
              Paid plans unlock unlimited generations, premium models, AI video, viral scripts, and 4× sharper outputs.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {["Unlimited images", "AI video", "Viral scripts", "Premium models", "No watermark"].map((f) => (
                <span
                  key={f}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(122,59,255,0.15)", color: "#C084FC", border: "1px solid rgba(122,59,255,0.25)" }}
                >
                  {f}
                </span>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handlePlans}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-[15px] mb-2.5 transition active:scale-[0.98] hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #7A3BFF, #A855F7)",
                boxShadow: "0 8px 32px rgba(122,59,255,0.5)",
              }}
            >
              See Plans →
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 text-white/30 text-sm font-medium hover:text-white/55 transition"
            >
              Keep using free
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fgmEnter {
          from { opacity: 0; transform: scale(0.92) translateY(20px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>,
    document.body
  );
}
