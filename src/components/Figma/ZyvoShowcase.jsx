import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const IMAGES = [
  "/assets/showcase/image5.webp",
  "/assets/showcase/image4.webp",
  "/assets/showcase/image2.webp",
  "/assets/showcase/image3.webp",
  "/assets/showcase/image6.webp",
];

const REACTIONS = ["❤️", "🔥", "👍", "✨", "💜"];

/* ── Single image card with floating reactions ── */
function ImageCard({ src, index, total, spawnDelay }) {
  const [particles, setParticles] = useState([]);

  const middle = Math.floor(total / 2);
  const distance = Math.abs(index - middle);

  useEffect(() => {
    let interval;

    const spawn = () => {
      const emoji = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
      const x = 15 + Math.random() * 55; // 15–70% from left
      const id = Date.now() + Math.random();
      setParticles((prev) => [...prev.slice(-5), { id, emoji, x }]);
    };

    const timer = setTimeout(() => {
      spawn();
      interval = setInterval(spawn, 2200 + Math.random() * 800);
    }, spawnDelay);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [spawnDelay]);

  const remove = (id) => setParticles((p) => p.filter((r) => r.id !== id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.12, duration: 0.5, ease: "easeOut" }}
      className={`
        relative transition-all duration-500 cursor-pointer
        ${distance === 0 ? "scale-100 translate-y-0 z-30"
          : distance === 1 ? "scale-95 translate-y-5 z-20"
          : "scale-90 translate-y-10 z-10"}
        hover:scale-[1.06] hover:-translate-y-3
      `}
    >
      <div className="relative w-[150px] md:w-[175px] aspect-[9/16] rounded-2xl overflow-hidden shadow-xl shadow-purple-900/15">
        <img
          src={src}
          alt="Created with Zyvo"
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Subtle dark gradient at bottom so reactions are visible */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        {/* Floating reactions */}
        <AnimatePresence>
          {particles.map(({ id, emoji, x }) => (
            <motion.span
              key={id}
              initial={{ opacity: 1, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -90, scale: 1.4 }}
              exit={{}}
              transition={{ duration: 1.7, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => remove(id)}
              className="absolute bottom-8 text-2xl pointer-events-none select-none z-20 drop-shadow-md"
              style={{ left: `${x}%` }}
            >
              {emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── Main section ── */
export default function ZyvoShowcase() {
  return (
    <section className="w-full bg-[#F7F5FA] py-16 md:py-24 overflow-hidden">

      {/* ── Desktop: fan layout ── */}
      <div className="hidden md:flex justify-center items-end gap-5 px-6">
        {IMAGES.map((src, i) => (
          <ImageCard
            key={src}
            src={src}
            index={i}
            total={IMAGES.length}
            spawnDelay={800 + i * 600}
          />
        ))}
      </div>

      {/* ── Mobile: horizontal snap-scroll ── */}
      <div className="md:hidden">
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-6 pb-4"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {IMAGES.map((src, i) => (
            <div key={src} className="shrink-0 snap-center relative">
              <div className="relative w-[150px] aspect-[9/16] rounded-2xl overflow-hidden shadow-xl shadow-purple-900/15">
                <img
                  src={src}
                  alt="Created with Zyvo"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                {/* Static like count badge */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-xs font-semibold">
                  ❤️ {(12 + i * 7).toFixed(0)}k
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Scroll hint dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {IMAGES.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${i === 2 ? "w-4 h-1.5 bg-[#7A3BFF]" : "w-1.5 h-1.5 bg-[#7A3BFF]/20"}`}
            />
          ))}
        </div>
      </div>

    </section>
  );
}