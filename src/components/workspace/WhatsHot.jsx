import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, TrendingUp } from "lucide-react";

/* ─── Data ─────────────────────────────────────────────────── */
const items = [
  {
    title:  "2AM Worlds",
    views:  "6.2M",
    image:  "/template/2am-world/preview.png",
    accent: "#BEF264",
    rank:   1,
    path:   "/workspace/two-am",
  },
  {
    title:  "Clay Rescue",
    views:  "5.1M",
    image:  "/clayrescue/smallpreview.webp",
    accent: "#A855F7",
    rank:   2,
    path:   "/workspace/clay-rescue",
  },
  {
    title:  "AI Fruit Story",
    views:  "4.7M",
    image:  "/viral-builder/ai-fruit/presets/cheating.webp",
    accent: "#A855F7",
    rank:   3,
    path:   "/workspace/ai-fruit-story",
  },
  {
    title:  "Micro Camera",
    views:  "2.8M",
    image:  "/viral-builder/micro-camera/preview1.png",
    accent: "#7A3BFF",
    rank:   4,
    path:   "/workspace/micro-camera-animal",
  },
  {
    title:  "Viral Skeleton",
    views:  "3.2M",
    image:  "/home/viral-templates/skeleton.webp",
    accent: "#FF6B35",
    rank:   5,
    path:   "/workspace/skeleton-shorts",
  },
  {
    title:  "Face ASMR",
    views:  "2.1M",
    image:  "/face/neypreview.png",
    accent: "#EC4899",
    rank:   6,
    path:   "/workspace/face-asmr",
  },
  {
    title:  "AI Cooking Matic",
    views:  "1.8M",
    image:  "/home/viral-templates/cook.webp",
    accent: "#FFB020",
    rank:   7,
    path:   "/workspace/ai-cooking-matic",
  },
  {
    title:  "Nationality Swap",
    views:  "1.4M",
    image:  "/home/viral-templates/nationalityswap.webp",
    accent: "#22D3EE",
    rank:   8,
    path:   "/workspace/footballer-nationality-swap",
  },
];

/* ─── Component ─────────────────────────────────────────────── */
export default function WhatsHot() {
  const navigate = useNavigate();

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.52, ease: "easeOut" }}
      className="w-full px-5 md:px-[50px] mt-8"
    >
      {/* ── Header ── */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5 md:mb-6">
        <span className="text-[20px] leading-none select-none">🔥</span>
        <h2 className="text-white text-[20px] md:text-[28px] font-bold tracking-tight">
          Most Viral Templates
        </h2>
        <span className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-red-400 text-[11px] font-bold tracking-widest">LIVE</span>
        </span>
      </div>

      {/* ── Ranked template grid — full width, wraps to as many rows as needed ── */}
      <div className="relative">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
            >
              <HotCard item={item} navigate={navigate} />
            </motion.div>
          ))}
        </div>

        {/* bottom fade — sinks the last row into the page background */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#090A0A] via-[#090A0A]/70 to-transparent sm:h-32 md:h-40" />

        {/* explore templates CTA — floats over the fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center sm:bottom-6">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("zyvo:open-create-menu"))}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-lime-500/40 bg-[#101312]/90 px-5 py-2.5 text-[13px] font-bold text-lime-300 backdrop-blur-sm transition hover:bg-lime-300 hover:text-black"
          >
            Explore Templates
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
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
      className="group relative isolate flex w-full flex-col gap-1 rounded-[16px] border border-white/[0.07] bg-[#101312] p-1 text-left transition-colors duration-200 hover:border-lime-300/30 hover:bg-[#151915]"
    >
      <div className="relative aspect-[343/195] w-full overflow-hidden rounded-xl bg-black">
        <img
          src={item.image}
          alt={item.title}
          loading="lazy"
          fetchPriority="low"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />

        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ boxShadow: `inset 0 0 0 1.5px ${item.accent}99, 0 0 24px ${item.accent}55` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 p-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black text-black"
            style={{ background: item.rank === 1 ? "#BEF264" : "#84CC16" }}
          >
            {item.rank}
          </span>
          <p className="truncate text-[12.5px] font-semibold text-white">{item.title}</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 text-white/40">
          <TrendingUp className="h-2.5 w-2.5" />
          <span className="text-[10px] font-semibold">{item.views}</span>
        </div>
      </div>
    </button>
  );
}
