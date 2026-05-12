import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView, animate } from "framer-motion";

const CHARS = [
  "/viral-builder/ai-fruit/characters/bossmango.png",
  "/viral-builder/ai-fruit/characters/orangemom.png",
  "/viral-builder/ai-fruit/characters/hotpeach.webp",
  "/viral-builder/ai-fruit/characters/banana.png",
  "/viral-builder/ai-fruit/characters/strawberrymom.png",
  "/viral-builder/ai-fruit/characters/gangsterpineapple.png",
];

const HEARTS = ["❤️","🧡","💛","💜","🔥","❤️","💕","🧡"];

const SAMPLE = "A fruit catches their partner cheating and reveals everything at dinner.";

function TypingPrompt({ text, inView }) {
  const [shown, setShown] = useState("");
  const [done, setDone]   = useState(false);
  useEffect(() => {
    if (!inView) return;
    setShown(""); setDone(false);
    let i = 0;
    const id = setInterval(() => {
      setShown(text.slice(0, i + 1)); i++;
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, 28);
    return () => clearInterval(id);
  }, [inView, text]);
  return (
    <span className="font-mono text-[12px] leading-relaxed text-[#7C3AED]">
      {shown}
      {!done && <span className="inline-block w-0.5 h-[13px] bg-purple-500 ml-0.5 animate-pulse align-middle" />}
    </span>
  );
}

/* Floating heart that rises and fades */
function FloatingHeart({ emoji, delay, x }) {
  return (
    <motion.span
      className="pointer-events-none absolute bottom-8 text-base select-none"
      style={{ left: x }}
      initial={{ y: 0, opacity: 0, scale: 0.5 }}
      animate={{ y: -90, opacity: [0, 1, 1, 0], scale: [0.5, 1.1, 1, 0.8] }}
      transition={{ duration: 2.2, delay, repeat: Infinity, repeatDelay: 1.5, ease: "easeOut" }}
    >
      {emoji}
    </motion.span>
  );
}

/* Counting number animation */
function CountUp({ to, suffix = "", inView }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(0, to, {
      duration: 1.6, ease: "easeOut",
      onUpdate: v => setVal(Math.floor(v)),
    });
    return () => ctrl.stop();
  }, [inView, to]);
  return <>{val.toLocaleString()}{suffix}</>;
}

export default function AIFruitPromo() {
  const navigate = useNavigate();
  const ref      = useRef(null);
  const videoRef = useRef(null);
  const inView   = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (inView && videoRef.current) videoRef.current.play().catch(() => {});
  }, [inView]);

  return (
    <section ref={ref} className="w-full bg-[#F7F5FA] py-12 md:py-14">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">

        {/* ── Badge + headline (tight) ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="mb-7 text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-100 border border-purple-200/70 px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-purple-600">AI Fruit Story — Now Live</span>
          </div>
          <h2 className="text-[30px] font-black leading-[1.05] tracking-tight text-[#0d0d12] sm:text-[42px] lg:text-[50px]">
            One sentence.{" "}
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
              A full viral video.
            </span>
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-gray-400 sm:text-[14px]">
            Type your drama idea → Zyvo builds every scene → full video ready to post.
          </p>
        </motion.div>

        {/* ── Main 2-col ── */}
        <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:gap-8">

          {/* ── LEFT: phone + social proof ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative flex flex-shrink-0 justify-center lg:block"
          >
            <div className="relative w-[148px] sm:w-[160px]">
              {/* Purple glow */}
              <div className="absolute -inset-6 rounded-full bg-purple-300/20 blur-3xl" />

              {/* Phone */}
              <div className="relative overflow-hidden rounded-[32px] border-2 border-purple-200 bg-black shadow-[0_20px_56px_rgba(124,58,237,0.25)]">
                <div className="aspect-[9/19.5] overflow-hidden">
                  <video ref={videoRef} src="/viral-builder/ai-fruit/result.mp4"
                    className="h-full w-full object-cover" muted loop playsInline preload="metadata" />
                </div>

                {/* Floating hearts over video */}
                {inView && HEARTS.map((h, i) => (
                  <FloatingHeart key={i} emoji={h} delay={i * 0.55} x={`${12 + (i % 3) * 28}%`} />
                ))}
              </div>
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-gray-200" />

              {/* LIVE badge */}
              <div className="absolute -right-6 top-5 flex items-center gap-1.5 rounded-full border border-red-100 bg-white px-2.5 py-1.5 shadow-md">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-[10px] font-bold text-red-500">LIVE</span>
              </div>

              {/* Animated view count */}
              {inView && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="absolute -left-7 bottom-14 rounded-[10px] border border-gray-100 bg-white px-3 py-2 shadow-lg"
                >
                  <div className="text-[13px] font-black text-[#0d0d12]">
                    <CountUp to={4700000} inView={inView} />
                  </div>
                  <div className="text-[9px] font-medium text-gray-400">views/wk 📈</div>
                </motion.div>
              )}

              {/* Likes badge */}
              {inView && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9, duration: 0.4 }}
                  className="absolute -right-7 bottom-5 rounded-[10px] border border-purple-100 bg-white px-3 py-2 shadow-lg"
                >
                  <div className="text-[12px] font-black text-[#7C3AED]">
                    ❤️ <CountUp to={847000} inView={inView} />
                  </div>
                  <div className="text-[9px] font-medium text-gray-400">likes</div>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* ── RIGHT: everything ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-1 flex-col gap-4"
          >
            {/* Prompt */}
            <div className="rounded-[14px] border border-gray-200/80 bg-white px-4 py-3 shadow-sm">
              <div className="mb-2 flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <div className="h-2 w-2 rounded-full bg-yellow-400" />
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Your prompt</span>
              </div>
              <TypingPrompt text={SAMPLE} inView={inView} />
            </div>

            {/* Steps — horizontal pills */}
            <div className="flex items-center gap-2">
              {["Type idea", "AI generates", "Video ready"].map((label, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.35, delay: 0.35 + i * 0.08 }}
                  className="flex flex-1 items-center gap-2 rounded-[12px] border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-[11px] font-black text-white shadow-[0_3px_10px_rgba(124,58,237,0.4)]">
                    {i + 1}
                  </div>
                  <span className="text-[12px] font-semibold text-gray-700 leading-tight">{label}</span>
                  {i === 2 && <span className="ml-auto text-green-500 text-[11px] font-bold">✓</span>}
                </motion.div>
              ))}
            </div>

            {/* Scene images — 3 col */}
            <div className="grid grid-cols-3 gap-2">
              {[
                "/viral-builder/ai-fruit/presets/cheating.webp",
                "/viral-builder/ai-fruit/presets/baby.webp",
                "/viral-builder/ai-fruit/presets/secret-twin.webp",
              ].map((src, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.92 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.3, delay: 0.5 + i * 0.07 }}
                  className="overflow-hidden rounded-[12px] border border-gray-100 shadow-sm"
                  style={{ aspectRatio: "9/12" }}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                </motion.div>
              ))}
            </div>

            {/* CTA + stacked avatars */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.7 }}
              className="flex items-center gap-4"
            >
              {/* Stacked avatars */}
              <div className="flex flex-shrink-0 items-center">
                {CHARS.map((src, i) => (
                  <div
                    key={i}
                    className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-[#F7F5FA] shadow-sm ring-1 ring-purple-100"
                    style={{ marginLeft: i === 0 ? 0 : -10, zIndex: CHARS.length - i }}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
                  </div>
                ))}
              </div>

              {/* CTA button */}
              <motion.button
                onClick={() => navigate("/workspace/ai-fruit-story")}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="flex-1 rounded-[13px] py-3.5 text-[14px] font-black text-white shadow-[0_8px_24px_rgba(124,58,237,0.4)] transition"
                style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
              >
                Build My First Fruit Video →
              </motion.button>
            </motion.div>

            {/* Social proof line */}
            <motion.div
              initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.85 }}
              className="flex items-center justify-center gap-4 text-[11px] text-gray-400"
            >
              <span>🔥 Trending on TikTok</span>
              <span className="text-gray-200">·</span>
              <span>⚡ No editing required</span>
              <span className="text-gray-200">·</span>
              <span>🎬 6 cinematic scenes</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
