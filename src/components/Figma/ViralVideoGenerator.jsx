import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Film, TrendingUp, Clock } from "lucide-react";

const perks = [
  { icon: Film,       text: "3+ powerful video AI models" },
  { icon: TrendingUp, text: "Built for TikTok, Reels & Shorts virality" },
  { icon: Clock,      text: "Fast rendering + affordable pricing" },
];

export default function ViralVideoGenerator() {
  return (
    <section className="relative w-full py-16 md:py-24 px-6 overflow-hidden bg-[#F7F5FA]">

      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#C084FC]/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#7A3BFF]/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-20 items-center">

        {/* LEFT — VIDEO (bottom on mobile) */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: "easeOut", delay: 0.1 }}
          className="relative order-2 md:order-1"
        >
          {/* Glow behind card */}
          <div className="absolute inset-4 bg-gradient-to-br from-[#9D6BFF]/30 to-[#7A3BFF]/20 rounded-3xl blur-2xl -z-10" />

          {/* Video card */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/20 aspect-square group">
            <video
              src="/assets/video/fire.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#7A3BFF]/15 via-transparent to-transparent pointer-events-none" />

            {/* Play badge center */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center">
                <div className="w-0 h-0 border-t-8 border-b-8 border-l-14 border-t-transparent border-b-transparent border-l-white ml-1" />
              </div>
            </div>
          </div>

          {/* Floating badge — top right */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="absolute -top-4 -right-4 flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 shadow-xl shadow-black/10 border border-purple-100"
          >
            <span className="text-lg">🎬</span>
            <div>
              <div className="text-xs font-bold text-gray-900">AI Video</div>
              <div className="text-xs text-[#7A3BFF] font-semibold">Ready in seconds</div>
            </div>
          </motion.div>

          {/* Floating badge — bottom left */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="absolute -bottom-4 -left-4 flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 shadow-xl shadow-black/10 border border-purple-100"
          >
            <span className="text-lg">🚀</span>
            <div>
              <div className="text-xs font-bold text-gray-900">+48K likes</div>
              <div className="text-xs text-gray-400">from one post</div>
            </div>
          </motion.div>
        </motion.div>

        {/* RIGHT — TEXT (top on mobile) */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="text-left order-1 md:order-2"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-[#7A3BFF] uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7A3BFF] animate-pulse" />
            Video Generator
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-[1.05] tracking-tight mb-5">
            Go viral with{" "}
            <span className="bg-gradient-to-r from-[#7A3BFF] via-[#9D6BFF] to-[#C084FC] bg-clip-text text-transparent">
              AI video
            </span>
            <span className="block">in seconds</span>
          </h2>

          <p className="text-lg text-gray-500 mb-10 max-w-md leading-relaxed">
            Create engaging short-form videos using 10+ AI models — optimized for TikTok, Reels, and YouTube Shorts. No editing needed.
          </p>

          {/* Perks */}
          <div className="space-y-3.5 mb-10">
            {perks.map((p) => (
              <div key={p.text} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#7A3BFF]/10 shrink-0">
                  <p.icon className="w-3.5 h-3.5 text-[#7A3BFF]" />
                </div>
                <span className="text-gray-700 text-sm font-medium">{p.text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/workspace/video-generator"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-bold text-sm transition"
              style={{
                background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
                boxShadow: "0 8px 32px rgba(122,59,255,0.4)",
              }}
            >
              Try Video Generator →
            </Link>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
