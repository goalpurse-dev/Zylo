import { X, ImageIcon, Zap, Star } from "lucide-react";
import { createPortal } from "react-dom";

export default function GuestGenerateModal({ open, onClose, onSignup }) {
  if (!open) return null;

  return createPortal(
    <>
      {/* BACKDROP */}
      <div
        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* MODAL */}
      <div className="fixed z-[9999] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[92%] max-w-[420px]">
        <div
          className="relative rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: "linear-gradient(160deg, #0D0620, #1A0533, #0B0E1A)" }}
        >
          {/* Top glow line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#7A3BFF] to-transparent" />

          {/* Purple ambient */}
          <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#7A3BFF]/20 rounded-full blur-[80px]" />

          <div className="relative px-7 py-8">
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className="relative inline-flex mb-5">
              <div className="w-14 h-14 rounded-2xl bg-[#7A3BFF]/20 border border-[#7A3BFF]/30 flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-[#C084FC]" />
              </div>
              <div className="absolute -inset-1 bg-[#7A3BFF]/20 rounded-2xl blur-lg -z-10" />
            </div>

            {/* Headline */}
            <h2 className="text-white text-2xl font-bold leading-tight mb-1">
              Start generating for free
            </h2>
            <p className="text-white/50 text-sm mb-6">
              Create an account and get 5 free AI image generations — no card needed.
            </p>

            {/* Free badge */}
            <div className="flex items-center gap-3 bg-[#7A3BFF]/15 border border-[#7A3BFF]/30 rounded-2xl px-4 py-3 mb-6">
              <Zap className="w-5 h-5 text-[#C084FC] shrink-0" />
              <div>
                <div className="text-white font-bold text-base leading-tight">10 Free Generations</div>
                <div className="text-white/40 text-xs">resets monthly · no credit card</div>
              </div>
            </div>

            {/* Sample images */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {["/assets/toast/1.webp", "/assets/toast/4.webp", "/assets/toast/5.webp", "/assets/toast/2.webp"].map((src, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden border border-white/10">
                  <img src={src} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>

            {/* Perks */}
            <div className="flex items-center justify-between text-xs text-white/50 mb-6 px-1">
              {[
                { icon: Star, label: "20+ styles" },
                { icon: Zap, label: "Instant results" },
                { icon: ImageIcon, label: "HD quality" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={onSignup}
              className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
                boxShadow: "0 8px 32px rgba(122,59,255,0.45)",
              }}
            >
              Create Free Account →
            </button>

            <p className="text-white/25 text-xs text-center mt-4">
              No credit card · Takes 30 seconds
            </p>
          </div>

          {/* Bottom glow line */}
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#7A3BFF]/40 to-transparent" />
        </div>
      </div>
    </>,
    document.body
  );
}
