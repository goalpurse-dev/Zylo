import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function ViralShowcase() {
  const scrollRef = useRef(null);
  const isUserInteracting = useRef(false);

  const items = [
    { title: "Create Viral Video",          button: "Create Video",    video: "/showcase/bigcard.mp4",  image: "/showcase/bigcard.webp",  big: true,  badge: "Try Now" },
    { title: "Millions of Views Per Week",  button: "Start Creating",  image: "/showcase/card2.webp",   hoverVideo: "/showcase/card2.mp4", badge: "Try Now" },
    { title: "Create Unmatched Images",     button: "Create Image",    image: "/showcase/card3.webp",   hoverVideo: "/showcase/card3.mp4", badge: "Try Now" },
  ];

  const looped = [...items, ...items];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const id = setInterval(() => {
      if (isUserInteracting.current) return;
      const card = el.children[0];
      if (!card) return;
      const step = card.offsetWidth + 12;

      el.scrollBy({ left: step, behavior: "smooth" });

      setTimeout(() => {
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half - step / 2) {
          el.style.scrollSnapType = "none";
          el.scrollLeft = el.scrollLeft - half;
          requestAnimationFrame(() => { el.style.scrollSnapType = "x mandatory"; });
        }
      }, 420);
    }, 5500);

    return () => clearInterval(id);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.55, ease: "easeOut" }}
      className="w-full px-5 md:px-[50px] mt-5 md:mt-8"
    >
      {/* DESKTOP */}
      <div className="hidden md:flex gap-4 w-full">
        <div className="w-[60%] xl:w-[45%]">
          <div className="w-full aspect-[2.35/1]">
            <FeatureCard {...items[0]} />
          </div>
        </div>
        <div className="w-[40%] xl:w-[27.5%] flex">
          <FeatureCard {...items[1]} />
        </div>
        <div className="hidden xl:block w-[27.5%]">
          <FeatureCard {...items[2]} />
        </div>
      </div>

      {/* MOBILE — infinite snap rail */}
      <div className="md:hidden overflow-hidden relative mt-4">
        <div
          ref={scrollRef}
          onTouchStart={() => (isUserInteracting.current = true)}
          onTouchEnd={() => setTimeout(() => (isUserInteracting.current = false), 1500)}
          className="flex gap-3 px-1 overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {looped.map((item, i) => (
            <div key={i} className="snap-start shrink-0 w-[96%]">
              <div className="h-[220px]">
                <FeatureCard {...item} mobile />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function FeatureCard({ title, button, video, image, hoverVideo, big, mobile, badge }) {
  const [hovered, setHovered] = useState(false);
  const showHoverVideo = !mobile && hoverVideo && hovered;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#141416] group cursor-pointer h-full w-full ${mobile ? "h-[220px]" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/*
        Always render the image as the base layer so there is never a black
        flash while the video buffers. It sits below everything else (z-index
        is document order — image first, video on top).
      */}
      <img
        src={image}
        alt={title}
        fetchpriority="high"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Big-card auto-play video (desktop only) */}
      {big && video && !mobile && (
        <video
          src={video}
          poster={image}
          autoPlay muted loop playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Hover video for smaller cards */}
      {showHoverVideo && (
        <video
          src={hoverVideo}
          poster={image}
          autoPlay muted loop playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      {badge && (
        <div className="absolute top-3 right-3 z-10 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-black/50 backdrop-blur-sm border border-white/20 text-white">
          {badge}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 z-10">
        <h3 className="text-white font-bold leading-tight text-[16px] sm:text-[17px] md:text-[18px] xl:text-[16px] 2xl:text-[20px]">
          {title}
        </h3>
        <button className="mt-3 w-fit px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-sm transition">
          {button}
        </button>
      </div>
    </div>
  );
}
