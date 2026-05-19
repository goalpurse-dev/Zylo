import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, Flame } from "lucide-react";

/* ─── Data ─────────────────────────────────────────────────── */
const items = [
  {
    title:  "AI Fruit Story",
    badge:  "#1 This Week 🔥",
    views:  "4.7M",
    image:  "/viral-builder/ai-fruit/presets/cheating.webp",
    glow:   "rgba(168,85,247,0.65)",
    border: "#A855F7",
    rank:   1,
    path:   "/workspace/ai-fruit-story",
  },
  {
    title:  "Viral Skeleton",
    badge:  "Exploding 💀",
    views:  "3.2M",
    image:  "/styles/skeleton2.webp",
    glow:   "rgba(255,107,53,0.55)",
    border: "#FF6B35",
    rank:   2,
  },
  {
    title:  "Lego Style",
    badge:  "All-Time Top",
    views:  "1.8M",
    image:  "/styles/lego2.webp",
    glow:   "rgba(255,215,0,0.5)",
    border: "#FFD700",
    rank:   3,
  },
  {
    title:  "Cinematic",
    badge:  "Rising Fast ↑",
    views:  "2.1M",
    image:  "/styles/cinematic2.webp",
    glow:   "rgba(122,59,255,0.55)",
    border: "#7A3BFF",
    rank:   4,
  },
  {
    title:  "3D Cartoon",
    badge:  "Fan Favourite",
    views:  "940K",
    image:  "/styles/cartoon2.webp",
    glow:   "rgba(0,212,255,0.45)",
    border: "#00D4FF",
    rank:   5,
  },
];

/* ─── Component ─────────────────────────────────────────────── */
export default function WhatsHot() {
  const scrollRef            = useRef(null);
  const isUserInteracting    = useRef(false);
  const navigate             = useNavigate();

  /* auto-scroll loop on mobile */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const CARD_W  = 160; // px (matches w-[160px] below)
    const GAP     = 12;
    const STEP    = CARD_W + GAP;

    const id = setInterval(() => {
      if (isUserInteracting.current) return;
      el.scrollBy({ left: STEP, behavior: "smooth" });

      setTimeout(() => {
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half - STEP) {
          el.style.scrollSnapType = "none";
          el.scrollLeft -= half;
          requestAnimationFrame(() => {
            el.style.scrollSnapType = "x mandatory";
          });
        }
      }, 420);
    }, 2600);

    return () => clearInterval(id);
  }, []);

  const looped = [...items, ...items];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.52, ease: "easeOut" }}
      className="w-full max-w-7xl mx-auto px-5 md:px-8 mt-8"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <motion.span
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="text-[26px] leading-none select-none"
          >
            🔥
          </motion.span>
          <h2 className="text-white text-[20px] md:text-[28px] font-bold tracking-tight">
            What&apos;s Hot Right Now
          </h2>
        </div>

        {/* live pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-red-400 text-[11px] font-bold tracking-widest">LIVE</span>
        </div>
      </div>

      {/* ── Mobile auto-scroll strip ── */}
      <div className="md:hidden overflow-hidden">
        <div
          ref={scrollRef}
          onTouchStart={() => (isUserInteracting.current = true)}
          onTouchEnd={() => setTimeout(() => (isUserInteracting.current = false), 1800)}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {looped.map((item, i) => (
            <div key={i} className="snap-start shrink-0 w-[160px]">
              <HotCard item={item} navigate={navigate} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Desktop row ── */}
      <div className="hidden md:flex gap-4">
        {items.map((item, i) => (
          <motion.div
            key={item.title}
            className="flex-1"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07, duration: 0.45, ease: "easeOut" }}
          >
            <HotCard item={item} navigate={navigate} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

/* ─── Card ──────────────────────────────────────────────────── */
function HotCard({ item, navigate }) {
  return (
    <button
      type="button"
      onClick={() => navigate(item.path || "/workspace/image-generator")}
      className="group relative w-full overflow-hidden rounded-2xl block text-left focus:outline-none"
      style={{ aspectRatio: "3 / 4.4" }}
    >
      {/* image */}
      <img
        src={item.image}
        alt={item.title}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
      />

      {/* base gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />

      {/* animated glow border */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-400 opacity-0 group-hover:opacity-100"
        style={{ boxShadow: `inset 0 0 0 1.5px ${item.border}99, 0 0 24px ${item.glow}` }}
      />

      {/* idle subtle border */}
      <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none" />

      {/* ── Top: badge + rank ── */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1">
        {/* badge */}
        <div
          className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide backdrop-blur-sm truncate"
          style={{
            background: `${item.border}28`,
            border: `1px solid ${item.border}55`,
            color: item.border,
          }}
        >
          {item.badge}
        </div>

        {/* rank number */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/15">
          <span className="text-white font-black text-[10px] leading-none">
            {item.rank}
          </span>
        </div>
      </div>

      {/* ── Bottom: info ── */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-bold text-[14px] leading-tight drop-shadow-md">
          {item.title}
        </p>

        <div className="flex items-center gap-1 mt-1">
          <TrendingUp size={10} className="text-white/50 flex-shrink-0" />
          <span className="text-white/50 text-[10px] font-medium">
            {item.views} views / wk
          </span>
        </div>

        {/* CTA — visible at all times on mobile, hover on desktop */}
        <div
          className="
            mt-2 w-full py-1.5 rounded-xl
            bg-white/15 backdrop-blur-sm
            text-white text-[11px] font-semibold text-center
            border border-white/10
            transition-all duration-300
            md:opacity-0 md:translate-y-1
            md:group-hover:opacity-100 md:group-hover:translate-y-0
          "
        >
          Try this style →
        </div>
      </div>
    </button>
  );
}
