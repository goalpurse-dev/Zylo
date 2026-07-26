import { useEffect, useRef, useState } from "react";
import { Flame, Play } from "lucide-react";

import trendVideoOne from "../../assets/home/latest/video9.16-fast.mp4";
import trendVideoTwo from "../../assets/home/latest/videoo9.16-fast.mp4";
import trendVideoThree from "../../assets/home/latest/videooo9.16-fast.mp4";
import trendImage from "../../assets/home/latest/image9.16-fast.webp";

const TRENDS = [
  {
    id: "trend-video-one",
    kind: "video",
    src: trendVideoOne,
    label: "Lost Worlds IRL",
  },
  {
    id: "trend-video-two",
    kind: "video",
    src: trendVideoTwo,
    label: "Lost Worlds IRL",
  },
  {
    id: "trend-video-three",
    kind: "video",
    src: trendVideoThree,
    label: "Lost Worlds IRL",
  },
  {
    id: "trend-image-one",
    kind: "image",
    src: trendImage,
    label: "Lost Worlds IRL",
  },
];

function TrendVideo({ src, label }) {
  const videoRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.35 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="absolute inset-0 bg-[#101014]">
      <div className={`absolute inset-0 transition-opacity duration-500 ${isReady ? "opacity-0" : "opacity-100"}`}>
        <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_35%,rgba(168,85,247,.24),transparent_42%),linear-gradient(145deg,#18131f,#0b0b0e_68%)]" />
        <div className="absolute inset-0 grid place-items-center">
          <Play className="h-8 w-8 fill-white/20 text-white/30" />
        </div>
      </div>

      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="auto"
        aria-label={label}
        onLoadedData={() => setIsReady(true)}
        className={`h-full w-full object-cover transition duration-700 ${isReady ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"}`}
      />
    </div>
  );
}

function TrendCard({ trend }) {
  const isVideo = trend.kind === "video";

  return (
    <article
      className="group relative aspect-[9/16] min-h-0 overflow-hidden rounded-[14px] border border-white/[0.11] bg-[#101014] shadow-[0_22px_65px_rgba(0,0,0,.38)] transition duration-500 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_30px_85px_rgba(0,0,0,.55)]"
    >
      {isVideo ? (
        <TrendVideo src={trend.src} label={trend.label} />
      ) : (
        <img
          src={trend.src}
          alt="Surreal mountain temple seen from an airplane window"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-[1.18] object-cover transition duration-700 group-hover:scale-[1.21]"
        />
      )}

      <div className="pointer-events-none absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-lime-300/25 bg-black/45 text-lime-300 backdrop-blur-xl sm:right-4 sm:top-4">
        <Flame className="h-3.5 w-3.5 fill-current" />
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-inset ring-white/[0.06]" />
    </article>
  );
}

export default function LatestTrends() {
  const carouselRef = useRef(null);
  const [activeTrend, setActiveTrend] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [isCarouselVisible, setIsCarouselVisible] = useState(false);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsCarouselVisible(entry.isIntersecting),
      { threshold: 0.35 },
    );

    observer.observe(carousel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return undefined;

    let animationFrame;
    const updateActiveTrend = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const carouselCenter = carousel.scrollLeft + carousel.clientWidth / 2;
        const cards = Array.from(carousel.querySelectorAll("[data-trend-card]"));
        const closestIndex = cards.reduce((closest, card, index) => {
          const cardCenter = card.offsetLeft + card.clientWidth / 2;
          const closestCard = cards[closest];
          const closestCenter = closestCard.offsetLeft + closestCard.clientWidth / 2;
          return Math.abs(cardCenter - carouselCenter) < Math.abs(closestCenter - carouselCenter) ? index : closest;
        }, 0);

        setActiveTrend(closestIndex);
      });
    };

    carousel.addEventListener("scroll", updateActiveTrend, { passive: true });
    updateActiveTrend();

    return () => {
      cancelAnimationFrame(animationFrame);
      carousel.removeEventListener("scroll", updateActiveTrend);
    };
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    const mobileQuery = window.matchMedia("(max-width: 639px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!carousel || !mobileQuery.matches || reducedMotionQuery.matches || isCarouselPaused || !isCarouselVisible) return undefined;

    const interval = window.setInterval(() => {
      const cards = Array.from(carousel.querySelectorAll("[data-trend-card]"));
      const nextCard = cards[(activeTrend + 1) % cards.length];
      if (!nextCard) return;

      const carouselBox = carousel.getBoundingClientRect();
      const cardBox = nextCard.getBoundingClientRect();
      const targetLeft = carousel.scrollLeft + cardBox.left - carouselBox.left;
      carousel.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    }, 3200);

    return () => window.clearInterval(interval);
  }, [activeTrend, isCarouselPaused, isCarouselVisible]);

  return (
    <section className="relative mt-10 overflow-hidden px-5 py-8 md:mt-14 md:px-[50px] md:py-12" aria-labelledby="latest-trends-title">
      <div className="pointer-events-none absolute inset-x-[8%] top-0 h-px bg-gradient-to-r from-transparent via-lime-300/50 to-transparent" />
      <div className="pointer-events-none absolute left-[8%] top-0 h-64 w-64 rounded-full bg-lime-300/[0.07] blur-[90px]" />
      <div className="pointer-events-none absolute right-[8%] top-24 h-72 w-72 rounded-full bg-lime-300/[0.045] blur-[100px]" />

      <div className="relative mx-auto max-w-[1380px]">
        <div className="mb-5 md:mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <span className="text-[18px] leading-none select-none">🔥</span>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-lime-300">
              Most Viral Templates
            </p>
            <span className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
              <span className="text-[9px] font-bold tracking-widest text-red-400">LIVE</span>
            </span>
          </div>
          <h2 id="latest-trends-title" className="text-[28px] font-black tracking-[-0.045em] text-white sm:text-[34px] md:text-[42px]">
            Lost Worlds IRL
          </h2>
        </div>

        <div
          ref={carouselRef}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4 lg:gap-2 xl:gap-2.5"
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
          onTouchStart={() => setIsCarouselPaused(true)}
          onTouchEnd={() => setIsCarouselPaused(false)}
        >
          {TRENDS.map((trend) => (
            <div
              key={trend.id}
              data-trend-card
              className="w-[clamp(145px,52vw,210px)] shrink-0 snap-center sm:w-auto sm:max-w-none"
            >
              <TrendCard trend={trend} />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 sm:hidden" aria-hidden="true">
          {TRENDS.map((trend, index) => (
            <span
              key={trend.id}
              className={`h-1 rounded-full transition-all ${index === activeTrend ? "w-6 bg-lime-300/80" : "w-1.5 bg-white/20"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
