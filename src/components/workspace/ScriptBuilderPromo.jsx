import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { PenLine, ArrowRight, Sparkles } from "lucide-react";

/* ─── Script lines ───────────────────────────────────────────────────────── */
const LINES = [
  {
    label: "HOOK",
    accent: "#7A3BFF",
    bg: "linear-gradient(135deg, #F5F0FF 0%, #EDE8FF 100%)",
    border: "#DDD6FE",
    text: "You won't believe what I found inside a $1 thrift store jacket…",
  },
  {
    label: "SCENE",
    accent: "#6B7280",
    bg: "#F9FAFB",
    border: "#E5E7EB",
    text: "I'm walking through rows of dusty racks, camera shaking — then I spot it.",
  },
  {
    label: "CTA",
    accent: "#059669",
    bg: "linear-gradient(135deg, #F0FDF9 0%, #ECFDF5 100%)",
    border: "#A7F3D0",
    text: "Follow for part 2. I tested this on 12 more items — results are insane.",
  },
];

const STYLES = [
  { name: "MrBeast",     icon: "⚡", accent: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  { name: "Storyteller", icon: "🎭", accent: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" },
  { name: "POV",         icon: "🎥", accent: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD" },
  { name: "Trend",       icon: "🔥", accent: "#B91C1C", bg: "#FFF5F5", border: "#FECACA" },
  { name: "Tutorial",    icon: "📚", accent: "#047857", bg: "#F0FDF4", border: "#A7F3D0" },
  { name: "Controversy", icon: "⚔️", accent: "#C2410C", bg: "#FFF7ED", border: "#FED7AA" },
  { name: "Emotional",   icon: "💜", accent: "#7C3AED", bg: "#FAF5FF", border: "#E9D5FF" },
];

/* ─── Floating badge ─────────────────────────────────────────────────────── */
function FloatBadge({ children, className, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute z-10 bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-100 px-3.5 py-2.5 flex items-center gap-2.5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ─── TypeWriter ─────────────────────────────────────────────────────────── */
function TypeWriter({ text, delay = 0, speed = 15 }) {
  const [displayed, setDisplayed] = useState("");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const t = setTimeout(() => {
      const id = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(id);
      }, speed);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(t);
  }, [inView, text, delay, speed]);

  return (
    <span ref={ref}>
      {displayed || <span className="opacity-0">{text[0]}</span>}
      {displayed.length < text.length && (
        <span className="animate-pulse text-gray-300">|</span>
      )}
    </span>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default function ScriptBuilderPromo() {
  const navigate = useNavigate();

  return (
    <section className="relative w-full bg-[#F7F5FA] py-20 md:py-28 px-6 overflow-hidden">

      {/* ── Background magic ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#7A3BFF]/[0.06] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[#C084FC]/[0.07] rounded-full blur-[100px]" />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#6EE7B7]/[0.06] rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-5xl mx-auto">

        {/* ── Centered headline ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="text-center mb-14 md:mb-18"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-semibold text-[#7A3BFF] mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7A3BFF] animate-pulse" />
            Introducing · Viral Script Builder
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#7A3BFF] text-white text-[9px] font-bold leading-none">BETA</span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-[1.08] tracking-tight">
            Your next viral video,{" "}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-[#7A3BFF] via-[#9D4EDD] to-[#C77DFF] bg-clip-text text-transparent">
                fully scripted
              </span>
              <span className="absolute inset-0 blur-2xl opacity-25 bg-gradient-to-r from-[#7A3BFF] to-[#C77DFF] pointer-events-none" />
            </span>
          </h2>

          <p className="mt-5 text-lg text-gray-500 max-w-[500px] mx-auto leading-relaxed">
            Type your idea. Get a complete hook, scene-by-scene breakdown, and
            CTA — with image <em>&</em> video prompts included. In under 60 seconds.
          </p>
        </motion.div>

        {/* ── Big card + floating badges ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="relative mx-auto max-w-2xl mb-14"
        >
          {/* Purple glow behind card */}
          <div className="absolute inset-6 bg-gradient-to-br from-[#9D6BFF]/25 to-[#7A3BFF]/15 rounded-3xl blur-2xl -z-10" />

          {/* Floating badges */}
          <FloatBadge className="-top-4 -left-4 md:-left-16" delay={0.6}>
            <span className="text-xl">🔥</span>
            <div>
              <p className="text-[11px] font-bold text-gray-800 leading-tight">2.4M views</p>
              <p className="text-[10px] text-gray-400">hook score: 9.4</p>
            </div>
          </FloatBadge>

          <FloatBadge className="-top-4 -right-4 md:-right-16" delay={0.75}>
            <span className="text-xl">⚡</span>
            <div>
              <p className="text-[11px] font-bold text-gray-800 leading-tight">Ready in 8s</p>
              <p className="text-[10px] text-gray-400">gpt-4o-mini</p>
            </div>
          </FloatBadge>

          <FloatBadge className="-bottom-4 -left-4 md:-left-14" delay={0.9}>
            <span className="text-xl">📸</span>
            <div>
              <p className="text-[11px] font-bold text-gray-800 leading-tight">Visual prompts</p>
              <p className="text-[10px] text-gray-400">per every scene</p>
            </div>
          </FloatBadge>

          <FloatBadge className="-bottom-4 -right-4 md:-right-14" delay={1.05}>
            <div className="flex gap-1 text-base">📱🎬🎵</div>
            <div>
              <p className="text-[11px] font-bold text-gray-800 leading-tight">All platforms</p>
              <p className="text-[10px] text-gray-400">TikTok · Reels · YT</p>
            </div>
          </FloatBadge>

          {/* Main card */}
          <div className="bg-white rounded-3xl shadow-2xl shadow-purple-900/[0.12] border border-gray-100 overflow-hidden">

            {/* Window bar */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-300" />
                <div className="w-3 h-3 rounded-full bg-yellow-300" />
                <div className="w-3 h-3 rounded-full bg-green-300" />
              </div>
              <span className="text-gray-400 text-[11px] font-mono ml-2">MrBeast Style · Thrift Store Find</span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-600">generating</span>
              </div>
            </div>

            {/* Script content */}
            <div className="px-6 py-5 space-y-3">
              {LINES.map((line, i) => (
                <div
                  key={i}
                  className="rounded-2xl px-4 py-3.5"
                  style={{ background: line.bg, border: `1px solid ${line.border}` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: line.accent }} />
                    <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: line.accent }}>
                      {line.label}
                    </span>
                  </div>
                  <p className="text-gray-700 text-[13px] md:text-sm leading-relaxed">
                    <TypeWriter text={line.text} delay={i * 1000} speed={13} />
                  </p>
                </div>
              ))}
            </div>

            {/* Bottom strip */}
            <div className="mx-5 mb-5 rounded-2xl bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-100 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-[#7A3BFF]/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-[#7A3BFF]" />
                </div>
                <div>
                  <p className="text-[#7A3BFF] text-[11px] font-bold leading-tight">Image & video prompts included</p>
                  <p className="text-purple-400 text-[10px]">Ready to paste into any AI image/video tool</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#7A3BFF] shrink-0">3 scenes →</span>
            </div>
          </div>
        </motion.div>

        {/* ── Style pills ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="mb-10"
        >
          <p className="text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            7 creator styles
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {STYLES.map((s, i) => (
              <motion.button
                key={i}
                whileHover={{ y: -3, scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate("/workspace/viral-script")}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all font-semibold text-[13px]"
                style={{ background: s.bg, border: `1.5px solid ${s.border}`, color: s.accent }}
              >
                <span className="text-base leading-none">{s.icon}</span>
                {s.name}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Stats row ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="grid grid-cols-3 gap-4 mb-10 max-w-lg mx-auto"
        >
          {[
            { val: "60s",   label: "Avg. generation time" },
            { val: "7",     label: "Style presets" },
            { val: "100%",  label: "Platform-optimised" },
          ].map(({ val, label }, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">{val}</p>
              <p className="text-[11px] text-gray-400 mt-1 leading-tight">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="flex flex-col items-center gap-3"
        >
          <button
            onClick={() => navigate("/workspace/viral-script")}
            className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] text-white font-semibold text-[15px] shadow-lg shadow-purple-500/25 hover:scale-[1.03] hover:shadow-purple-500/40 transition-all duration-200"
          >
            <PenLine size={18} />
            Write My Script Free
            <ArrowRight size={16} />
          </button>
          <p className="text-sm text-gray-400">No credit card · 2 credits per script</p>
        </motion.div>

      </div>
    </section>
  );
}
