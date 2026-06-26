import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const models = [
  {
    name: "Nano Banana 2",
    desc: "Best and realistic image generation",
    image: "/trendmodel/nanobanana.webp",
    video: "/trendmodel/nanobanana.mp4",
    tag: "BEST",
    highlight: true,
    path: "/workspace/image-generator",
  },
  {
    name: "MiniMax Hailou 2.3 Fast",
    desc: "Ultra fast video generation",
    image: "/trendmodel/hailou.webp",
    video: "/trendmodel/minimax.mp4",
    tag: "FAST",
    path: "/workspace/video-generator",
  },
  {
    name: "Runway Gen-4",
    desc: "Cinematic video generation",
    image: "/trendmodel/runway.webp",
    video: "/trendmodel/runway.mp4",
    tag: "PRO",
    path: "/workspace/video-generator",
  },
];

// Duplicate for seamless infinite loop
const loopedModels = [...models, ...models];

function ModelCard({ model, compact, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`
        group cursor-pointer rounded-2xl overflow-hidden
        border border-white/10 bg-[#090A0A]
        transition hover:scale-[1.02] hover:border-purple-500/30
        ${model.highlight ? "shadow-[0_0_30px_rgba(168,85,247,0.2)]" : ""}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {/* Image always rendered — never black, fades out when video is ready */}
        <img
          src={model.image}
          alt={model.name}
          fetchpriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition duration-300"
          style={{ opacity: hovered ? 0 : 1 }}
        />
        <video
          src={model.video}
          poster={model.image}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="hidden md:block absolute inset-0 w-full h-full object-cover transition duration-300"
          style={{ opacity: hovered ? 1 : 0 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/60 text-purple-300 border border-white/10 backdrop-blur">
          {model.tag}
        </div>
      </div>
      <div className={`${compact ? "p-2" : "p-3"}`}>
        <div className="text-[18px] md:text-[20px] font-bold leading-tight bg-gradient-to-r from-white via-purple-100 to-purple-500 bg-clip-text text-transparent inline-block">
          {model.name}
        </div>
        <div className="text-white/40 text-xs mt-1">{model.desc}</div>
      </div>
    </div>
  );
}

export default function LatestModels() {
  const navigate = useNavigate();
  const mobileRef = useRef(null);
  const isUserInteracting = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const el = mobileRef.current;
    if (!el) return;

    const scrollNext = () => {
      if (isUserInteracting.current) return;
      const card = el.children[0];
      if (!card) return;
      const step = card.offsetWidth + 12;

      el.scrollBy({ left: step, behavior: "smooth" });

      // After smooth animation finishes, silently jump to equivalent position in first copy
      setTimeout(() => {
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half - step / 2) {
          el.style.scrollSnapType = "none";
          el.scrollLeft = el.scrollLeft - half;
          requestAnimationFrame(() => {
            el.style.scrollSnapType = "x mandatory";
          });
        }
      }, 420);
    };

    intervalRef.current = setInterval(scrollNext, 4500);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-7xl mx-auto px-5 md:px-8 mt-8"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-[20px] md:text-[28px] font-bold tracking-tight">
          Trending AI Models
        </h2>
        <button onClick={() => navigate("/workspace/image-generator")} className="text-white/50 hover:text-white text-sm transition">More →</button>
      </div>

      {/* Mobile — infinite snap rail */}
      <div className="md:hidden">
        <div
          ref={mobileRef}
          onTouchStart={() => (isUserInteracting.current = true)}
          onTouchEnd={() => setTimeout(() => (isUserInteracting.current = false), 1500)}
          className="flex gap-3 px-1 overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {loopedModels.map((model, i) => (
            <div key={i} className="snap-start shrink-0 w-[92%]">
              <ModelCard model={model} onClick={() => navigate(model.path)} />
            </div>
          ))}
        </div>
      </div>

      {/* MD grid */}
      <div className="hidden md:grid lg:hidden grid-cols-3 gap-3">
        {models.map((model, i) => (
          <ModelCard key={i} model={model} compact onClick={() => navigate(model.path)} />
        ))}
      </div>

      {/* LG rail */}
      <div className="hidden lg:grid 2xl:hidden grid-cols-3 gap-3">
        {models.map((model, i) => (
          <ModelCard key={i} model={model} onClick={() => navigate(model.path)} />
        ))}
      </div>

      {/* 2XL grid */}
      <div className="hidden 2xl:grid grid-cols-3 gap-4">
        {models.map((model, i) => (
          <ModelCard key={i} model={model} onClick={() => navigate(model.path)} />
        ))}
      </div>
    </motion.section>
  );
}
