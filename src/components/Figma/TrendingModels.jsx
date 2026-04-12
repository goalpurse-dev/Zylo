import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const models = [
  {
    name: "Nano Banana 2",
    desc: "Best and realistic image generation",
    image: "/trendmodel/nanobanana.webp",
    video: "/trendmodel/nanobanana.mp4",
    tag: "BEST",
    highlight: true,
  },
  {
    name: "MiniMax Hailou 2.3 Fast",
    desc: "Ultra fast video generation",
    image: "/trendmodel/hailou.webp",
    video: "/trendmodel/minimax.mp4",
    tag: "FAST",
  },
  {
    name: "Runway Gen-4",
    desc: "Cinematic video generation",
    image: "/trendmodel/runway.webp",
    video: "/trendmodel/runway.mp4",
    tag: "PRO",
  },
];

function ModelCard({ model }) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (hovered) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [hovered]);

  return (
    <div
      className={`
        group cursor-pointer rounded-2xl overflow-hidden border transition-all duration-300
        ${model.highlight
          ? "border-[#7A3BFF]/30 shadow-[0_4px_30px_rgba(122,59,255,0.12)]"
          : "border-purple-100 hover:border-purple-300 shadow-sm hover:shadow-lg"
        }
        bg-white
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* MEDIA — fixed height so images always fill */}
      <div className="relative w-full h-44 md:h-48 overflow-hidden bg-gray-200">

        {/* Always-visible image */}
        <img
          src={model.image}
          alt={model.name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: hovered ? 0 : 1, transition: "opacity 0.3s" }}
        />

        {/* Video — desktop hover only, never autoPlay to avoid mobile issues */}
        <video
          ref={videoRef}
          src={model.video}
          muted
          loop
          playsInline
          preload="none"
          className="hidden md:block absolute inset-0 w-full h-full object-cover"
          style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.3s" }}
        />

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />

        {/* Tag */}
        <div
          className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${
            model.highlight
              ? "bg-[#7A3BFF] text-white"
              : "bg-white/90 text-[#7A3BFF] border border-purple-200"
          }`}
        >
          {model.tag}
        </div>
      </div>

      {/* TEXT */}
      <div className="p-4">
        <div className="font-bold text-gray-900 text-base leading-tight mb-0.5">
          {model.name}
        </div>
        <div className="text-gray-400 text-xs">{model.desc}</div>
      </div>
    </div>
  );
}

export default function TrendingModels() {
  const mobileRef = useRef(null);
  const isUserInteracting = useRef(false);

  useEffect(() => {
    const el = mobileRef.current;
    if (!el) return;
    const scrollNext = () => {
      if (isUserInteracting.current) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 5) {
        el.style.scrollSnapType = "none";
        el.scrollTo({ left: 0, behavior: "auto" });
        setTimeout(() => { el.style.scrollSnapType = "x mandatory"; }, 60);
        return;
      }
      const card = el.children[0];
      if (card) el.scrollBy({ left: card.offsetWidth + 12, behavior: "smooth" });
    };
    const id = setInterval(scrollNext, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="w-full bg-[#F7F5FA] py-12 md:py-20 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-[#7A3BFF] uppercase tracking-widest mb-3"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#7A3BFF] animate-pulse" />
              Live on Zyvo
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08, duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight"
            >
              Trending AI{" "}
              <span className="bg-gradient-to-r from-[#7A3BFF] to-[#C084FC] bg-clip-text text-transparent">
                Models
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.13, duration: 0.45 }}
              className="text-gray-400 text-sm mt-1.5"
            >
              The most powerful AI models creators are using right now.
            </motion.p>
          </div>

          <Link
            to="/signup"
            className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-[#7A3BFF] hover:underline shrink-0 pb-1"
          >
            Try free →
          </Link>
        </div>

        {/* Mobile carousel */}
        <div className="md:hidden -mx-6 px-6">
          <div
            ref={mobileRef}
            onTouchStart={() => (isUserInteracting.current = true)}
            onTouchEnd={() => setTimeout(() => (isUserInteracting.current = false), 1500)}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden pb-2"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
          >
            {models.map((model, i) => (
              <div key={i} className="snap-start shrink-0 w-[80vw]">
                <ModelCard model={model} />
              </div>
            ))}
            <div className="shrink-0 w-4" />
          </div>
        </div>

        {/* Desktop grid */}
        <div className="hidden md:grid grid-cols-3 gap-5">
          {models.map((model, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
            >
              <ModelCard model={model} />
            </motion.div>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="md:hidden mt-5 text-center">
          <Link to="/signup" className="text-sm font-semibold text-[#7A3BFF] hover:underline">
            Try them free →
          </Link>
        </div>

      </div>
    </section>
  );
}
