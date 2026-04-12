import { X, VideoIcon, Zap, Crown } from "lucide-react";
import { createPortal } from "react-dom";

export default function GuestVideoModal({ open, onClose, onSignup }) {
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
                <VideoIcon className="w-7 h-7 text-[#C084FC]" />
              </div>
              <div className="absolute -inset-1 bg-[#7A3BFF]/20 rounded-2xl blur-lg -z-10" />
            </div>

            {/* Headline */}
            <h2 className="text-white text-2xl font-bold leading-tight mb-1">
              Create viral AI videos
            </h2>
            <p className="text-white/50 text-sm mb-6">
              Sign up for free to unlock AI video generation and start creating content that stops the scroll.
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { stat: "3+", label: "AI Models" },
                { stat: "5s", label: "Avg. gen time" },
                { stat: "4K", label: "Max quality" },
              ].map(({ stat, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-2xl bg-white/[0.04] border border-white/8 py-3 gap-0.5"
                >
                  <span className="text-white font-bold text-lg leading-tight">{stat}</span>
                  <span className="text-white/40 text-[10px]">{label}</span>
                </div>
              ))}
            </div>

            {/* Features */}
            <div className="space-y-2.5 mb-7">
              {[
                { icon: VideoIcon, text: "Cinematic AI videos from text prompts" },
                { icon: Zap, text: "Image-to-video with your own references" },
                { icon: Crown, text: "Watermark-free exports, yours to keep" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#7A3BFF]/20 border border-[#7A3BFF]/30 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#C084FC]" />
                  </div>
                  <span className="text-white/70 text-sm">{text}</span>
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
              Get Started Free →
            </button>

            <p className="text-white/25 text-xs text-center mt-4">
              Free account · No credit card needed
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
