import { motion, AnimatePresence } from "framer-motion";
import { ImageIcon, Video, TrendingUp } from "lucide-react";

export default function WelcomeModal({ onClose }) {
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
          className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: "linear-gradient(145deg, #0D0620, #1A0533, #0B0E1A)" }}
        >
          {/* Top glow line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#7A3BFF] to-transparent" />

          {/* Purple ambient */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#7A3BFF]/20 rounded-full blur-[80px]" />

          <div className="relative px-8 py-10 text-center">

            {/* Robot icon */}
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 scale-150 bg-[#7A3BFF]/30 rounded-full blur-2xl" />
              <img
                src="/assets/ai/robot.webp"
                alt="Zyvo AI"
                className="relative w-20 h-20 rounded-full border-2 border-[#7A3BFF]/50 shadow-[0_0_30px_rgba(122,59,255,0.6)]"
              />
              {/* pulse ring */}
              <span className="absolute inset-0 rounded-full border border-[#7A3BFF]/40 animate-ping" />
            </div>

            {/* Headline */}
            <h2 className="text-white text-2xl font-bold mb-2 leading-tight">
              Welcome to Zyvo! 🎉
            </h2>
            <p className="text-[#C084FC] font-semibold text-sm mb-6">
              Your account is ready
            </p>

            {/* Free credit badge */}
            <div className="inline-flex items-center gap-2 bg-[#7A3BFF]/20 border border-[#7A3BFF]/40 rounded-2xl px-5 py-3 mb-6">
              <span className="text-2xl">⚡</span>
              <div className="text-left">
                <div className="text-white font-bold text-lg leading-tight">10 free images to start</div>
                <div className="text-white/50 text-xs">resets every month · no card needed</div>
              </div>
            </div>

            {/* Perks */}
            <div className="space-y-2.5 mb-8 text-left">
              {[
                { icon: ImageIcon,   text: "Generate scroll-stopping images with 20+ styles" },
                { icon: Video,       text: "Create viral short-form videos in seconds" },
                { icon: TrendingUp,  text: "Content built to grow your audience fast" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-[#7A3BFF]/20 border border-[#7A3BFF]/30 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-[#C084FC]" />
                  </div>
                  <span className="text-white/70 text-sm">{text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => {
                // Signal FirstGenFlow to begin the guided tour
                localStorage.setItem("zyvo_ftg_start", "1");
                window.dispatchEvent(new CustomEvent("zyvo:ftg:start"));
                onClose();
              }}
              className="w-full py-4 rounded-2xl text-white font-bold text-base transition hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
                boxShadow: "0 8px 32px rgba(122,59,255,0.5)",
              }}
            >
              Create my first image →
            </button>

            <p className="text-white/25 text-xs mt-4">
              Tap anywhere outside or press "Start Creating" to continue
            </p>
          </div>

          {/* Bottom glow line */}
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#7A3BFF]/40 to-transparent" />
        </motion.div>

      </div>
    </AnimatePresence>
  );
}
