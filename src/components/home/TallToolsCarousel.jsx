import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

/* Posters — swap to whatever you like */
import img1 from "../../assets/home/hero7.png";
import img2 from "../../assets/home/hero6.png";
import img3 from "../../assets/home/hero2.png";
import img4 from "../../assets/home/hero4.png";
import img5 from "../../assets/home/hero5.png";

const ITEMS = [
  { title: "Brand workspace", to: "/brand/workspace", poster: img1 },

  { title: "Ad studio",       to: "/ad-studio",       poster: img4 },
  { title: "Product photos",  to: "/product-photos",  poster: img3 },
  { title: "Enhancements",    to: "/enhancements",    poster: img5 },
];

const cn = (...a) => a.filter(Boolean).join(" ");

/* ---------------------- CARD ---------------------- */
function ToolCard({ title, to, poster }) {
  return (
    <div
      className={cn(
        "tool-card",                // used for measurement
        "relative shrink-0",        // NO horizontal margins anymore
        "w-[360px] md:w-[410px] lg:w-[460px]",
        "rounded-[28px] overflow-hidden border border-white/10 bg-white/5 shadow-2xl transition-transform",
        "hover:scale-[1.02] hover:bg-white/10 hover:shadow-[0_0_35px_rgba(255,255,255,0.12)]"
      )}
      style={{ aspectRatio: "1 / 1" }}
      title={title}
    >
      <Link to={to} className="absolute inset-0 z-10" aria-label={title} />
      <img
        src={poster}
        alt=""
        className="h-full w-full object-cover opacity-95 transition group-hover:opacity-100"
        draggable={false}
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />
      <div className="absolute left-5 right-5 top-5">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white/90 bg-black/40 backdrop-blur">
          Tools
        </div>
      </div>
      <div className="absolute left-5 right-5 bottom-5">
        <h3 className="text-2xl md:text-[26px] font-extrabold text-white leading-tight drop-shadow">{title}</h3>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm md:text-base font-semibold text-white bg-gradient-to-r from-[#1677FF] to-[#7A3BFF] shadow-md">
          Open
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- MAIN ---------------------- */
export default function SquareToolsCarousel({
  speedSec = 60,
  title = "Brand tools",
  className = "",
}) {
  const wrapRef = useRef(null);
  const viewportRef = useRef(null);

  const onHover = (paused) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const track = wrap.querySelector(".zylo-marquee");
    if (track) track.style.animationPlayState = paused ? "paused" : "running";
  };

  // measure to center exactly 3 cards (with track gap) on mount + resize
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const compute = () => {
      const firstCard = wrap.querySelector(".tool-card");
      if (!firstCard) return;

      const cardW = firstCard.getBoundingClientRect().width;

      // Read the gap from the track (we set it via --gap on the track)
      const track = wrap.querySelector(".zylo-track");
      const gapPx = parseFloat(getComputedStyle(track).getPropertyValue("--gap") || "24");

      const threeWidth = 3 * cardW + 2 * gapPx;
      if (viewportRef.current) {
        viewportRef.current.style.width = `${threeWidth}px`;
        viewportRef.current.style.maxWidth = "100%";
        viewportRef.current.style.margin = "0 auto";
      }
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    const firstCard = wrap.querySelector(".tool-card");
    if (firstCard) ro.observe(firstCard);
    return () => ro.disconnect();
  }, []);

  const LOOP = [...ITEMS, ...ITEMS];

  return (
    <section className={cn("pt-16 pb-16", className)} aria-label={title}>
      <style>{`
        /* start perfectly centered using --start-offset; scroll L→R so new items come from left but anchor is center */
        @keyframes zylo-marquee-ltr {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .zylo-marquee {
          animation: zylo-marquee-ltr linear infinite;
          will-change: transform;
        }
        .zylo-marquee-wrap:hover .zylo-marquee { animation-play-state: paused; }

        /* fade edges — no partial pops */
        .blend-mask {
          --fade: 12%;
          -webkit-mask-image: linear-gradient(
            to right,
            transparent 0%,
            black var(--fade),
            black calc(100% - var(--fade)),
            transparent 100%
          );
          mask-image: linear-gradient(
            to right,
            transparent 0%,
            black var(--fade),
            black calc(100% - var(--fade)),
            transparent 100%
          );
        }

        @media (prefers-reduced-motion: reduce) {
          .zylo-marquee { animation: none !important; transform: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[96vw] px-4 md:px-6">
        <div className="mb-8 text-center">
          <h3 className="text-4xl md:text-5xl font-black tracking-tight text-white">{title}</h3>
          <div className="mt-2 text-xs text-zinc-400">Auto-scrolling 1:1 — 3 centered</div>
        </div>

        <div
          ref={wrapRef}
          className="zylo-marquee-wrap relative blend-mask"
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
        >
          <div className="overflow-hidden" ref={viewportRef}>
            <div
              className="zylo-marquee zylo-track flex w-[200%] py-4"
              style={{
                "--gap": "24px",                 // adjust gap here; JS reads it
                gap: "var(--gap)",               // real space between cards
                animationDuration: `${speedSec}s`,
                animationDelay: "0s",
                animationFillMode: "both",
                transform: "translateX(0)",
              }}
            >
              <div className="flex gap-[var(--gap)]">
                {LOOP.slice(0, ITEMS.length).map((it, i) => (
                  <ToolCard key={`a-${i}`} {...it} />
                ))}
              </div>
              <div className="flex gap-[var(--gap)]">
                {LOOP.slice(ITEMS.length).map((it, i) => (
                  <ToolCard key={`b-${i}`} {...it} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
