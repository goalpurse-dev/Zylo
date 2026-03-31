import { useRef, useEffect, useState } from "react";

export default function LatestModels() {
  const mobileScrollRef = useRef(null);
  const desktopScrollRef = useRef(null);
  const isUserInteracting = useRef(false);
  const intervalRef = useRef(null);

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

  // 🔥 AUTO SCROLL (works for both rails)
  useEffect(() => {
    const el = mobileScrollRef.current || desktopScrollRef.current;
    if (!el) return;

    const scrollNext = () => {
      if (isUserInteracting.current) return;

      const card = el.querySelector("div > div");
      if (!card) return;

      const gap = 12;
      const width = card.offsetWidth + gap;
      const maxScroll = el.scrollWidth - el.clientWidth;

      if (el.scrollLeft + width >= maxScroll - 5) {
        el.style.scrollSnapType = "none";
        el.scrollTo({ left: 0, behavior: "auto" });

        setTimeout(() => {
          el.style.scrollSnapType = "x mandatory";
          el.scrollBy({ left: width, behavior: "smooth" });
        }, 60);

        return;
      }

      el.scrollBy({
        left: width,
        behavior: "smooth",
      });
    };

    intervalRef.current = setInterval(scrollNext, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 md:px-6 mt-10">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-[20px] md:text-[28px] font-bold tracking-tight">
          Trending AI Models
        </h2>

        <button className="text-white/50 hover:text-white text-sm">
          More →
        </button>
      </div>

      {/* ✅ MOBILE RAIL */}
      <div className="md:hidden">
        <div
          ref={mobileScrollRef}
          onTouchStart={() => (isUserInteracting.current = true)}
          onTouchEnd={() =>
            setTimeout(() => (isUserInteracting.current = false), 1500)
          }
          className="
            flex gap-3 px-1
            overflow-x-auto overflow-y-hidden
            snap-x snap-mandatory
            scroll-smooth
            touch-pan-x
            [&::-webkit-scrollbar]:hidden
          "
        >
          {models.map((model, i) => (
            <div key={i} className="snap-start shrink-0 w-[92%]">
              <ModelCard model={model} />
            </div>
          ))}
        </div>
      </div>

      {/* ✅ MD GRID (3) */}
      <div className="hidden md:grid lg:hidden grid-cols-3 gap-3">
        {models.map((model, i) => (
          <ModelCard key={i} model={model} compact />
        ))}
      </div>

      {/* ✅ LG + XL RAIL (2 visible) */}
      <div className="hidden lg:block 2xl:hidden">
        <div
          ref={desktopScrollRef}
          onMouseEnter={() => (isUserInteracting.current = true)}
          onMouseLeave={() => (isUserInteracting.current = false)}
          className="
            flex gap-3 px-1
            overflow-x-auto overflow-y-hidden
            snap-x snap-mandatory
            scroll-smooth
            touch-pan-x
            [&::-webkit-scrollbar]:hidden
          "
        >
          {models.map((model, i) => (
            <div key={i} className="snap-start shrink-0 w-[48%]">
              <ModelCard model={model} />
            </div>
          ))}
        </div>
      </div>

      {/* ✅ 2XL GRID (3 clean) */}
      <div className="hidden 2xl:grid grid-cols-3 gap-4">
        {models.map((model, i) => (
          <ModelCard key={i} model={model} />
        ))}
      </div>
    </section>
  );
}

function ModelCard({ model, compact }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`
        group cursor-pointer
        rounded-2xl overflow-hidden
        border border-white/10
        bg-[#090A0A]
        transition
        hover:scale-[1.03]
        ${model.highlight ? "shadow-[0_0_30px_rgba(168,85,247,0.2)]" : ""}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* MEDIA */}
      <div className="relative aspect-[16/9] overflow-hidden">

        {/* IMAGE */}
        <img
          src={model.image}
          alt={model.name}
          className="absolute inset-0 w-full h-full object-cover transition duration-300"
          style={{
            opacity: hovered ? 0 : 1,
          }}
        />

        {/* VIDEO */}
        <video
          src={model.video}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="
            hidden md:block
            absolute inset-0 w-full h-full object-cover
            transition duration-300
          "
          style={{
            opacity: hovered ? 1 : 0,
          }}
        />

        {/* GRADIENT */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* TAG */}
        <div className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/60 text-purple-300 border border-white/10 backdrop-blur">
          {model.tag}
        </div>
      </div>

      {/* TEXT */}
      <div className={`${compact ? "p-2" : "p-3"}`}>
        <div className="
          text-[18px] md:text-[20px]
          font-bold leading-tight
          bg-gradient-to-r from-white via-purple-100 to-purple-500
          bg-clip-text text-transparent
          inline-block
        ">
          {model.name}
        </div>

        <div className="text-white/40 text-xs mt-1">
          {model.desc}
        </div>
      </div>
    </div>
  );
}