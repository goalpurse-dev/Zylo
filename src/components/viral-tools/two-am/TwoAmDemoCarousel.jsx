import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { displayImageUrl } from "./utils/twoAmHelpers";

const WORLD_PREVIEWS = [
  {
    id: "ninjago",
    label: "Ninjago",
    offset: 0,
    images: Array.from(
      { length: 6 },
      (_, index) => `/template/2am-world/ninjago%20(${index + 1}).png`,
    ),
  },
  {
    id: "pokemon",
    label: "Pokémon",
    offset: 3,
    images: Array.from(
      { length: 6 },
      (_, index) => `/template/2am-world/pokemon%20(${index + 2}).png`,
    ),
  },
];

function timeAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function RecentCreationsPanel({ generations, onOpenRecent, compact, fitHeight }) {
  const latest = generations[0];

  return (
    <div className={`flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-lime-300/[0.12] bg-[#101410] p-3 text-left shadow-[0_18px_55px_rgba(0,0,0,0.48),0_0_32px_rgba(190,242,100,0.05)] sm:rounded-[26px] sm:p-4 ${fitHeight ? "h-full min-h-0" : "aspect-[9/16]"}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`${compact ? "text-[11px]" : "text-[12px] sm:text-[14px]"} font-black text-white`}>Recent Creations</p>
          <p className="mt-1 truncate text-[8px] font-semibold text-white/30 sm:text-[10px]">
            {latest ? `${latest.world || latest.user_prompt || "2AM World"} · ${timeAgo(latest.created_at)}` : "Your saved nights"}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-lime-300/20 bg-lime-300/[0.08] px-2 py-1 text-[7px] font-black uppercase tracking-wide text-lime-300 sm:text-[8px]">Latest</span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(190,242,100,.25)_transparent] [scrollbar-width:thin]">
        {generations.slice(0, 5).map((generation, generationIndex) => {
          const completed = (generation.scenes ?? []).filter((scene) => scene.imageUrl);
          return (
            <button
              key={generation.id}
              type="button"
              onClick={() => onOpenRecent?.(generation)}
              className="block w-full rounded-xl border border-white/[0.07] bg-white/[0.025] p-2 text-left transition hover:border-lime-300/35 hover:bg-lime-300/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-black text-white/75 sm:text-[11px]">{generation.world || generation.user_prompt || "2AM World"}</p>
                  <p className="mt-0.5 text-[7px] font-semibold text-white/30 sm:text-[8px]">{completed.length}/6 images · {timeAgo(generation.created_at)}</p>
                </div>
                <span className="text-[8px] font-black text-lime-300/70">Open</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((index) => completed[index]?.imageUrl ? (
                  <img
                    key={index}
                    src={displayImageUrl(completed[index].imageUrl, 220)}
                    alt=""
                    loading={generationIndex === 0 ? "eager" : "lazy"}
                    fetchPriority={generationIndex === 0 ? "high" : "auto"}
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallbackApplied) return;
                      event.currentTarget.dataset.fallbackApplied = "true";
                      event.currentTarget.src = completed[index].imageUrl;
                    }}
                    className="aspect-[9/12] w-full rounded-lg object-cover"
                  />
                ) : (
                  <div key={index} className="aspect-[9/12] rounded-lg border border-dashed border-white/10 bg-black/25" />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorldPreview({ world, activeIndex, direction, compact, fitHeight, onNext }) {
  const worldIndex = (activeIndex + world.offset) % world.images.length;
  const previousWorldIndex =
    (worldIndex - direction + world.images.length) % world.images.length;
  const enteringClass = direction > 0
    ? "animate-[twoAmSlideInFromRight_700ms_cubic-bezier(.22,.61,.36,1)_both]"
    : "animate-[twoAmSlideInFromLeft_700ms_cubic-bezier(.22,.61,.36,1)_both]";
  const leavingClass = direction > 0
    ? "animate-[twoAmSlideOutToLeft_700ms_cubic-bezier(.22,.61,.36,1)_both]"
    : "animate-[twoAmSlideOutToRight_700ms_cubic-bezier(.22,.61,.36,1)_both]";

  return (
    <button
      type="button"
      onClick={onNext}
      className={`group relative min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-black text-left shadow-[0_18px_55px_rgba(0,0,0,0.48),0_0_32px_rgba(190,242,100,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 sm:rounded-[26px] ${fitHeight ? "h-full min-h-0" : "aspect-[9/16]"}`}
      aria-label={`Advance the ${world.label} preview`}
    >
      <img
        key={`leaving-${previousWorldIndex}-${worldIndex}`}
        src={world.images[previousWorldIndex]}
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-cover motion-reduce:hidden ${leavingClass}`}
      />
      <img
        key={`entering-${worldIndex}`}
        src={world.images[worldIndex]}
        alt={`2AM in ${world.label}, slide ${worldIndex + 1}`}
        className={`absolute inset-0 h-full w-full object-cover motion-reduce:animate-none ${enteringClass}`}
        loading="eager"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-lime-300/10 to-transparent" />

      <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex gap-1 sm:inset-x-3 sm:top-3">
        {world.images.map((src, index) => (
          <span
            key={src}
            className={`h-[2px] flex-1 rounded-full transition-colors duration-300 ${
              index <= worldIndex ? "bg-white/90" : "bg-white/25"
            }`}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute left-2.5 top-5 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[7px] font-black uppercase tracking-[0.13em] text-white backdrop-blur-md sm:left-3 sm:top-7 sm:px-2.5 sm:text-[9px]">
        2AM in {world.label}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 px-3 text-center sm:bottom-4">
        <p className={`${compact ? "text-[12px]" : "text-[13px] sm:text-[16px]"} truncate font-black tracking-tight text-white drop-shadow-lg`}>
          {world.label}
        </p>
        <p className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.15em] text-white/60 sm:text-[9px]">
          Slide {worldIndex + 1} of {world.images.length}
        </p>
      </div>

      <div className="pointer-events-none absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/35 text-white/0 backdrop-blur-sm transition group-hover:text-white/80 sm:h-8 sm:w-8">
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
    </button>
  );
}

export default function TwoAmDemoCarousel({ compact = false, fitHeight = false, recentGenerations = [], onOpenRecent }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const hasRecent = recentGenerations.length > 0;

  const move = (direction) => {
    setDirection(direction);
    setActiveIndex(
      (current) =>
        (current + direction + WORLD_PREVIEWS[0].images.length) %
        WORLD_PREVIEWS[0].images.length,
    );
  };

  useEffect(() => {
    (hasRecent ? WORLD_PREVIEWS.slice(0, 1) : WORLD_PREVIEWS).forEach((world) => {
      const nextIndex = (activeIndex + world.offset + 1) % world.images.length;
      const nextImage = new Image();
      nextImage.src = world.images[nextIndex];
    });
  }, [activeIndex, hasRecent]);

  useEffect(() => {
    if (isPaused || reduceMotion) return undefined;

    const timer = window.setTimeout(() => {
      setDirection(1);
      setActiveIndex(
        (current) => (current + 1) % WORLD_PREVIEWS[0].images.length,
      );
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isPaused, reduceMotion]);

  return (
    <div
      className={`mx-auto w-full ${fitHeight ? "flex h-full min-h-0 max-w-[780px] flex-col" : compact ? "max-w-[430px]" : "max-w-[620px]"}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className={`grid grid-cols-2 gap-2.5 sm:gap-4 ${fitHeight ? "min-h-0 flex-1" : ""}`}>
        {(hasRecent ? WORLD_PREVIEWS.slice(0, 1) : WORLD_PREVIEWS).map((world) => (
          <WorldPreview
            key={world.id}
            world={world}
            activeIndex={activeIndex}
            direction={direction}
            compact={compact}
            fitHeight={fitHeight}
            onNext={() => move(1)}
          />
        ))}
        {hasRecent && (
          <RecentCreationsPanel
            generations={recentGenerations}
            onOpenRecent={onOpenRecent}
            compact={compact}
            fitHeight={fitHeight}
          />
        )}
      </div>

      {!hasRecent && <div className="mt-3 flex items-center justify-center gap-3 sm:mt-4">
        <button
          type="button"
          onClick={() => move(-1)}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-white/55 transition hover:border-lime-300/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
          aria-label="Previous slideshow frame"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <div className="flex items-center gap-1.5" aria-label="Slideshow frames">
          {WORLD_PREVIEWS[0].images.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                if (index === activeIndex) return;
                setDirection(index > activeIndex ? 1 : -1);
                setActiveIndex(index);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
                index === activeIndex
                  ? "w-5 bg-lime-300 shadow-[0_0_9px_rgba(190,242,100,0.45)]"
                  : "w-1.5 bg-white/25 hover:bg-white/55"
              }`}
              aria-label={`Show slideshow frame ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => move(1)}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-white/55 transition hover:border-lime-300/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
          aria-label="Next slideshow frame"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>}

      <style>{`
        @keyframes twoAmSlideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes twoAmSlideOutToLeft {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        @keyframes twoAmSlideInFromLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes twoAmSlideOutToRight {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
