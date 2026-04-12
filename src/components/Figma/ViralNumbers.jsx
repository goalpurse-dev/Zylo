import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Notification cards that cycle through ── */
const NOTIFS = [
  { handle: "@mia.creates",     text: "just went viral with an AI image",  stat: "2.1M views",    emoji: "🔥" },
  { handle: "@techcreator99",   text: "posted an AI video",                stat: "+48K likes",    emoji: "❤️" },
  { handle: "@growthsarah",     text: "grew her page using Zyvo",          stat: "+12K followers", emoji: "🚀" },
  { handle: "@jake.viral",      text: "hit #1 trending",                   stat: "#1 Trending",   emoji: "⚡" },
  { handle: "@brandstudio_",    text: "turned a prompt into a product ad", stat: "3× ROAS",       emoji: "💰" },
  { handle: "@sofia.content",   text: "generated 40 images in 2 minutes",  stat: "saved 6 hours", emoji: "✨" },
];

/* ── Animated counter ── */
function Counter({ target, suffix = "", duration = 1600 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const steps = duration / 16;
          const inc = target / steps;
          let cur = 0;
          const t = setInterval(() => {
            cur += inc;
            if (cur >= target) { setValue(target); clearInterval(t); }
            else setValue(Math.floor(cur));
          }, 16);
        }
      },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString()}{suffix}
    </span>
  );
}

/* ── Notification pop-up ── */
function NotifCard({ notif }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3"
    >
      <div className="text-2xl shrink-0">{notif.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-semibold truncate">{notif.handle}</div>
        <div className="text-white/55 text-xs truncate">{notif.text}</div>
      </div>
      <div className="shrink-0 text-xs font-bold text-[#C084FC] bg-[#7A3BFF]/20 px-2 py-1 rounded-full whitespace-nowrap">
        {notif.stat}
      </div>
    </motion.div>
  );
}

export default function ViralNumbers() {
  const [notifIndex, setNotifIndex] = useState(0);

  /* Cycle through notifications every 2.8s */
  useEffect(() => {
    const id = setInterval(() => {
      setNotifIndex((i) => (i + 1) % NOTIFS.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { label: "Images created today",  value: 8420, suffix: "+", live: true  },
    { label: "Creators active now",   value: 342,  suffix: "",  live: true  },
    { label: "More views on average", value: 99,   suffix: "%", live: false },
    { label: "Viral posts this week", value: 1240, suffix: "+", live: true  },
  ];

  return (
    <div className="relative">
      {/* Top white-to-transparent gradient */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-[#F7F5FA] to-transparent z-10" />
      {/* Bottom transparent-to-white gradient */}
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[#F7F5FA] to-transparent z-10" />

      <section className="w-full bg-gradient-to-br from-[#1A0533] via-[#1E0A4A] to-[#0D0620] py-28 md:py-40 px-6 overflow-hidden relative">

        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] bg-[#7A3BFF]/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#C084FC]/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-10 md:mb-14">
            {/* LIVE badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 bg-[#7A3BFF]/20 border border-[#7A3BFF]/40 rounded-full px-3.5 py-1.5 text-xs font-bold text-[#C084FC] uppercase tracking-widest mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-[#C084FC] animate-pulse" />
              Live right now
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-4"
            >
              Creators are going viral
              <span className="block bg-gradient-to-r from-[#C084FC] via-[#9D6BFF] to-[#7A3BFF] bg-clip-text text-transparent">
                right now.
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-white/50 text-base md:text-lg max-w-xl mx-auto"
            >
              Join 4,200+ creators already using Zyvo to grow their audience every day.
            </motion.p>
          </div>

          {/* Main grid: stats + notifications */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-start">

            {/* Left: stat grid */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 md:p-6 hover:border-[#7A3BFF]/40 transition group"
                >
                  {s.live && (
                    <div className="flex items-center gap-1.5 mb-2 md:mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Live</span>
                    </div>
                  )}
                  <div className="text-2xl md:text-4xl font-extrabold text-white mb-1">
                    <Counter target={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-white/45 text-[11px] md:text-sm leading-tight">{s.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Right: notification feed */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex flex-col gap-3"
            >
              <div className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1 px-1">
                Recent activity
              </div>

              {/* Fixed-height container prevents layout jump */}
              <div className="relative h-[68px]">
                <AnimatePresence mode="wait">
                  <NotifCard key={notifIndex} notif={NOTIFS[notifIndex]} />
                </AnimatePresence>
              </div>

              {/* Two static below, slightly faded */}
              {[1, 2].map((offset) => (
                <div
                  key={offset}
                  className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 opacity-60"
                >
                  <div className="text-xl">{NOTIFS[(notifIndex + offset) % NOTIFS.length].emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold truncate">
                      {NOTIFS[(notifIndex + offset) % NOTIFS.length].handle}
                    </div>
                    <div className="text-white/40 text-xs truncate">
                      {NOTIFS[(notifIndex + offset) % NOTIFS.length].text}
                    </div>
                  </div>
                  <div className="text-xs text-white/30 shrink-0">
                    {(offset + 1) * 4}s ago
                  </div>
                </div>
              ))}

              {/* CTA inside the section */}
              <motion.a
                href="/signup"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-2 flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-white text-sm transition"
                style={{
                  background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
                  boxShadow: "0 4px 24px rgba(122,59,255,0.45)",
                }}
              >
                Join them — start free →
              </motion.a>
            </motion.div>

          </div>
        </div>
      </section>
    </div>
  );
}
