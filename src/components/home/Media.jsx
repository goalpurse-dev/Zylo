import React from "react";

/* ---------- Your images ---------- */
import media1 from "../../assets/home/media1.png";
import media2 from "../../assets/grid/image/dragob.jpg";
import media3 from "../../assets/grid/image/horse.jpg";
import media4 from "../../assets/grid/image/land.jpg";
import media5 from "../../assets/grid/image/samurai.jpg";
import media6 from "../../assets/grid/image/wolf.jpg";
import media7 from "../../assets/home/media2.png";
import media8 from "../../assets/home/media3.jpg";
import media9 from "../../assets/home/media4.jpg";
import media10 from "../../assets/home/media5.jpg";
import media11 from "../../assets/home/media6.jpg";
import media12 from "../../assets/home/media7.jpg";
import media13 from "../../assets/home/media8.jpg";
import media14 from "../../assets/home/media9.jpg";

const cn = (...a) => a.filter(Boolean).join(" ");

export default function UnderHeroMedia({
  title = "Made with Zylo",
  speedSec = 36,
  className = "",
}) {
  const images = [media1, media2, media3, media4, media5, media6, media7, media8, media9, media10, media11, media12, media13, media14];
  const loopImages = [...images, ...images];

  return (
    <section className={cn("w-full", className)} aria-label={title}>
      <style>{`
        @keyframes zylo-marquee-ltr {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .zylo-marquee { animation: zylo-marquee-ltr linear infinite; }
        .zylo-marquee-wrap:hover .zylo-marquee { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .zylo-marquee { animation: none !important; transform: none !important; }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center mt-10 mb-4">
  <h3 className="text-3xl md:text-4xl font-extrabold text-white text-center">
    {title}
  </h3>
  <div className="mt-2 text-xs md:text-sm text-zinc-400 text-center">
    Auto-scrolling 9:16 →
  </div>
</div>

      <div className="zylo-marquee-wrap relative mt-4 md:mt-5">
        {/* edge fades */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-[#0c1218] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[#0c1218] to-transparent" />

        <div className="overflow-hidden">
          <div
            className={cn("zylo-marquee flex w-[200%] will-change-transform")}
            style={{ animationDuration: `${speedSec}s`, animationDelay: `-${speedSec / 2}s` }}
          >
            <StripRow images={loopImages.slice(0, images.length)} />
            <StripRow images={loopImages.slice(images.length)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StripRow({ images }) {
  return (
    <div className="flex">
      {images.map((src, i) => (
        <Card key={`${i}-${src}`} src={src} />
      ))}
    </div>
  );
}

function Card({ src }) {
  return (
    <figure
      className={cn(
        "relative shrink-0 mx-3",
        "w-[180px] sm:w-[220px] md:w-[260px] lg:w-[300px]",
        "rounded-3xl shadow-lg overflow-hidden bg-white/5"
      )}
      style={{ aspectRatio: "9 / 16" }}
    >
      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
    </figure>
  );
}
