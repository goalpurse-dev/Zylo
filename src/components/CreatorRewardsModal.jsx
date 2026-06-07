import { motion, AnimatePresence } from "framer-motion";
import { Instagram, TrendingUp, X } from "lucide-react";

const INSTAGRAM_URL = "https://instagram.com/zyvo.ai";

const TIERS = [
  { label: "First approved post", credits: 50 },
  { label: "1,000 views", credits: 50 },
  { label: "5,000 views", credits: 150 },
  { label: "10,000 views", credits: 300 },
  { label: "25,000 views", credits: 750 },
  { label: "50,000 views", credits: 1500 },
];

export default function CreatorRewardsModal({ onClose }) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">

        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
          style={{ background: "linear-gradient(145deg, #0D0620, #1A0533, #0B0E1A)" }}
        >
          {/* Top glow line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#7A3BFF] to-transparent" />
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#7A3BFF]/20 rounded-full blur-[80px]" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative px-8 py-10">

            {/* Badge + headline */}
            <div className="text-center mb-5">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 scale-150 bg-[#7A3BFF]/30 rounded-full blur-2xl" />
                <div className="relative w-16 h-16 rounded-full border-2 border-[#7A3BFF]/50 shadow-[0_0_30px_rgba(122,59,255,0.6)] bg-[#1A0533] flex items-center justify-center text-3xl">
                  🔥
                </div>
                <span className="absolute inset-0 rounded-full border border-[#7A3BFF]/40 animate-ping" />
              </div>

              <h2 className="text-white text-2xl font-bold mb-2 leading-tight">
                Earn Free Zyvo Credits
              </h2>
              <p className="text-white/55 text-sm leading-relaxed max-w-sm mx-auto">
                Post a video on TikTok, IG, or YouTube Shorts showing how you make AI videos with Zyvo — the more views you get, the more credits you earn.
              </p>
            </div>

            {/* Reward tiers */}
            <div className="rounded-2xl border border-[#7A3BFF]/25 bg-[#7A3BFF]/10 p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#C084FC]" />
                <span className="text-white/80 text-xs font-bold uppercase tracking-wider">Reward Tiers</span>
              </div>
              <div className="space-y-1.5">
                {TIERS.map((t) => (
                  <div key={t.label} className="flex items-center justify-between text-sm">
                    <span className="text-white/60">{t.label}</span>
                    <span className="text-[#C084FC] font-semibold">+{Intl.NumberFormat().format(t.credits)} credits</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-white/70 text-sm text-center mb-4 leading-relaxed">
              Want the full how-to? DM us <span className="text-white font-semibold">"credit"</span> on Instagram and we'll send you the tutorial on getting started.
            </p>

            {/* Channel button */}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white font-bold text-sm transition hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
                boxShadow: "0 8px 32px rgba(122,59,255,0.4)",
              }}
            >
              <Instagram className="w-4 h-4" />
              DM "credit" on Instagram
            </a>

            <button
              onClick={onClose}
              className="w-full mt-4 text-white/30 text-xs hover:text-white/50 transition"
            >
              Maybe later
            </button>
          </div>

          {/* Bottom glow line */}
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#7A3BFF]/40 to-transparent" />
        </motion.div>

      </div>
    </AnimatePresence>
  );
}
