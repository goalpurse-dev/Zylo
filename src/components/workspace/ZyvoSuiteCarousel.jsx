import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const SUITE_ITEMS = [
  { name: "AI Fruit Story", desc: "Characters, stories, viral content & more", badge: "NEW", image: "/viral-builder/ai-fruit/presets/kicked-out.webp", path: "/workspace/ai-fruit-story" },
  { name: "Face ASMR", desc: "Viral face reveal ASMR videos", badge: "TRENDING", image: "/face/neypreview.png", path: "/workspace/face-asmr" },
  { name: "Nationality Swap", desc: "Reimagine football stars around the world", badge: "NEW", image: "/template/nationality-swap/preview.png", path: "/workspace/footballer-nationality-swap" },
  { name: "Micro Camera", desc: "Animal bodycam goes underground", badge: "NEW", image: "/viral-builder/micro-camera/preview1.png", path: "/workspace/micro-camera-animal" },
  { name: "Video Generator", desc: "Create cinematic videos in seconds", badge: null, image: "/home/videogen.png", path: "/workspace/video-generator" },
  { name: "Viral Skeleton", desc: "Scroll-stopping skeleton content", badge: "TRENDING", image: "/home/skeleton.png", path: "/workspace/skeleton-shorts" },
  { name: "Clay Rescue", desc: "Giant hands save tiny clay worlds", badge: "NEW", image: "/clayrescue/smallpreview.webp", path: "/workspace/clay-rescue" },
  { name: "AI Cooking Matic", desc: "Viral cooking videos on autopilot", badge: "NEW", image: "/templates/AICOOKING/thumbnail.png", path: "/workspace/ai-cooking-matic" },
];

const CARD_WIDTH = 224;
const CARD_HEIGHT = 332;
const CARD_CENTER_HEIGHT = 295;
const CARD_GAP = 4;
const CARD_SPACING = CARD_WIDTH + CARD_GAP;
const STAGE_HEIGHT = CARD_HEIGHT + 42;
const LABEL_ROW_PULLUP = 28;
const PERSPECTIVE = 1400;
const ROTATION_SPEED = 0.105;
const MAX_RENDER_FPS = 30;
const MAX_CARD_TILT = 18;
const HEIGHT_FOCUS_OFFSET = -0.28;

function circularOffset(index, centerIndex) {
  const total = SUITE_ITEMS.length;
  let offset = index - centerIndex;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}

function wrapPhase(phase) {
  const total = SUITE_ITEMS.length;
  return ((phase % total) + total) % total;
}

function arcPosition(offset) {
  return {
    x: offset * CARD_SPACING,
    y: 0,
  };
}

function projectedX(offset) {
  return arcPosition(offset).x;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function faceMetrics(offset) {
  const heightProgress = smoothstep(Math.min(Math.abs(offset - HEIGHT_FOCUS_OFFSET) / 3, 1));
  const height = CARD_CENTER_HEIGHT + (CARD_HEIGHT - CARD_CENTER_HEIGHT) * heightProgress;
  const top = (CARD_HEIGHT - height) / 2;

  return { height, top };
}

function labelY(offset) {
  const { height, top } = faceMetrics(offset);
  const slotTop = (STAGE_HEIGHT - CARD_HEIGHT) / 2;
  const labelRowTop = STAGE_HEIGHT - LABEL_ROW_PULLUP;

  return slotTop + top + height + 16 - labelRowTop;
}

function CurvedTitleLine() {
  return (
    <svg viewBox="0 0 600 24" className="h-4 w-full max-w-[620px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="suite-title-line" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff4ed1" stopOpacity="0" />
          <stop offset="15%" stopColor="#8f58ff" />
          <stop offset="50%" stopColor="#ff4ed1" />
          <stop offset="85%" stopColor="#8f58ff" />
          <stop offset="100%" stopColor="#ff4ed1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M 0 4 Q 300 24 600 4" fill="none" stroke="url(#suite-title-line)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MobileSuiteCard({ item, variant = "rail", onClick }) {
  const isGrid = variant === "grid";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/card relative overflow-hidden border border-white/10 bg-[#101312] text-left shadow-[0_16px_38px_rgba(0,0,0,0.36)] ${
        isGrid
          ? "aspect-[1.32/1] w-full rounded-[14px]"
          : "h-[156px] w-[160px] shrink-0 rounded-[14px] sm:h-[156px] sm:w-[160px]"
      }`}
    >
      <img src={item.image} alt={item.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/8 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,.24),transparent_64%)] opacity-70 blur-sm" />
      {item.badge && (
        <span className={`absolute right-2 top-2 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
          item.badge === "NEW" ? "bg-emerald-400 text-black" : "bg-[#f7c948] text-black"
        }`}>
          {item.badge}
        </span>
      )}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center gap-2 text-white">
        <span className="truncate text-[15px] font-extrabold leading-none">{item.name}</span>
      </div>
    </button>
  );
}

function SuiteCard({ item, offset, active, onClick }) {
  const abs = Math.abs(offset);
  const { x, y } = arcPosition(offset);
  const opacity = Math.max(0.06, 1 - abs * 0.2);
  const brightness = Math.max(0.38, 1 - abs * 0.17);
  const innerRotate = Math.max(-MAX_CARD_TILT, Math.min(MAX_CARD_TILT, -offset * 7));
  const sideShade = Math.min(0.42, abs * 0.14);
  const widthCompensation = 1 + Math.min(abs * 0.025, 0.08);
  const { height: faceHeight, top: faceTop } = faceMetrics(offset);

  return (
    <button
      onClick={onClick}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        marginLeft: -CARD_WIDTH / 2,
        marginTop: -CARD_HEIGHT / 2,
        opacity,
        filter: `brightness(${brightness})`,
        pointerEvents: abs <= 2.55 ? "auto" : "none",
        zIndex: 100 - Math.round(abs * 12),
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
      className="group absolute left-1/2 top-1/2 box-border overflow-hidden border-x-[2px] border-black bg-[#090A0A] text-left shadow-[0_24px_80px_rgba(0,0,0,0.55)] transition-[transform,opacity,filter] duration-100 ease-linear [backface-visibility:hidden] hover:!opacity-100"
    >
      <div
        data-arc-face
        style={{
          height: faceHeight,
          top: faceTop,
          transform: `perspective(760px) rotateY(${innerRotate}deg) scaleX(${widthCompensation})`,
          transformOrigin: "center center",
        }}
        className="absolute inset-x-0 overflow-hidden transition-[height,top,transform] duration-100 ease-linear will-change-[height,top,transform]"
      >
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(${offset < 0 ? 90 : 270}deg, rgba(0,0,0,${sideShade}) 0%, transparent 44%, rgba(0,0,0,${sideShade * 0.45}) 100%)`,
          }}
        />
        <div className={`absolute inset-0 ${active ? "bg-gradient-to-t from-black/58 via-transparent to-black/5" : "bg-black/22"}`} />
        {item.badge && (
          <span className={`absolute right-2 top-2 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
            item.badge === "NEW" ? "bg-emerald-400 text-black" : "bg-[#f7c948] text-black"
          }`}>
            {item.badge}
          </span>
        )}
      </div>
    </button>
  );
}

export default function ZyvoSuiteCarousel() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(Math.floor(SUITE_ITEMS.length / 2));
  const [showMobileMore, setShowMobileMore] = useState(false);
  const phaseRef = useRef(Math.floor(SUITE_ITEMS.length / 2));
  const desktopSectionRef = useRef(null);

  const orderedItems = useMemo(
    () => SUITE_ITEMS
      .map((item, index) => ({ ...item, index, offset: circularOffset(index, phase) }))
      .sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset)),
    [phase]
  );

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 801px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!desktop.matches || reducedMotion.matches) return undefined;

    let isVisible = false;
    let frameId;
    let lastFrame;
    let lastRender = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        lastFrame = undefined;
      },
      { rootMargin: "120px 0px" },
    );
    if (desktopSectionRef.current) observer.observe(desktopSectionRef.current);

    const tick = (now) => {
      if (isVisible && !document.hidden) {
        if (lastFrame === undefined) lastFrame = now;
        const elapsedSeconds = Math.min((now - lastFrame) / 1000, 0.1);
        lastFrame = now;
        phaseRef.current = wrapPhase(phaseRef.current + elapsedSeconds * ROTATION_SPEED);

        if (now - lastRender >= 1000 / MAX_RENDER_FPS) {
          setPhase(phaseRef.current);
          lastRender = now;
        }
      } else {
        lastFrame = undefined;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  function goPrev() {
    phaseRef.current = wrapPhase(Math.round(phaseRef.current) - 1);
    setPhase(phaseRef.current);
  }

  function goNext() {
    phaseRef.current = wrapPhase(Math.round(phaseRef.current) + 1);
    setPhase(phaseRef.current);
  }

  return (
    <>
      <section className="mx-auto mt-6 hidden w-full max-w-7xl px-4 max-[800px]:block">
        {showMobileMore ? (
          <div data-testid="zyvo-mobile-quick-start" className="rounded-t-[2px] bg-[#050606] px-3 pb-8 pt-5">
            <div className="mb-7 flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowMobileMore(false)}
                aria-label="Back"
                data-testid="zyvo-mobile-back"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="text-[16px] font-extrabold text-white">Quick Start</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {SUITE_ITEMS.map((item) => (
                <MobileSuiteCard key={item.name} item={item} variant="grid" onClick={() => navigate(item.path)} />
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[20px] font-black tracking-tight text-white">zyvo suite</h2>
              <button
                type="button"
                onClick={() => setShowMobileMore(true)}
                aria-label="Open zyvo suite quick start"
                data-testid="zyvo-mobile-more"
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-extrabold text-white transition hover:bg-white/10"
              >
                More
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUITE_ITEMS.map((item) => (
                <MobileSuiteCard key={item.name} item={item} onClick={() => navigate(item.path)} />
              ))}
            </div>

          </div>
        )}
      </section>

      <Motion.section
      ref={desktopSectionRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative mx-auto mt-3 w-full overflow-hidden px-0 md:px-[50px] max-[800px]:hidden"
    >
      <div className="relative z-20 mb-[-22px] flex flex-col items-center text-center">
        <h2 className="bg-gradient-to-r from-[#ffb4e8] via-[#ff4ed1] to-[#8f58ff] bg-clip-text text-[32px] font-black tracking-tight text-transparent md:text-[44px]">
          zyvo suite
        </h2>
        <CurvedTitleLine />
      </div>

      <div className="relative mt-0">
        <button
          onClick={goPrev}
          aria-label="Previous"
          className="absolute left-5 top-[174px] z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition hover:bg-white md:left-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={goNext}
          aria-label="Next"
          className="absolute right-5 top-[174px] z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition hover:bg-white md:right-0"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[365px] bg-[linear-gradient(90deg,#090A0A_0%,rgba(9,10,10,.98)_7%,rgba(9,10,10,.48)_20%,transparent_34%,transparent_66%,rgba(9,10,10,.48)_80%,rgba(9,10,10,.98)_93%,#090A0A_100%)]" />

        <div className="relative overflow-hidden" style={{ height: STAGE_HEIGHT }}>
          <div
            className="pointer-events-auto relative mx-auto h-full w-full"
            style={{
              perspective: PERSPECTIVE,
              transformStyle: "preserve-3d",
              perspectiveOrigin: "50% 44%",
            }}
          >
            {orderedItems.map((item) => (
              <SuiteCard
                key={item.name}
                item={item}
                offset={item.offset}
                active={Math.abs(item.offset) < 0.35}
                onClick={() => {
                  if (Math.abs(item.offset) < 0.32) navigate(item.path);
                  else {
                    phaseRef.current = item.index;
                    setPhase(item.index);
                  }
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative" style={{ height: 102, marginTop: -LABEL_ROW_PULLUP }}>
          {orderedItems.map((item) => {
            const offset = item.offset;
            const isCenter = Math.abs(offset) < 0.32;
            const abs = Math.abs(offset);
            const isVisible = abs <= 2.45;

            return (
              <div
                key={item.name}
                style={{
                  width: CARD_WIDTH,
                  marginLeft: -CARD_WIDTH / 2,
                  transform: `translate3d(${projectedX(offset)}px, ${labelY(offset)}px, 0)`,
                  opacity: isVisible ? Math.max(0.34, 1 - abs * 0.22) : 0,
                }}
                className="absolute left-1/2 top-0 z-30 flex flex-col items-center transition-[transform,opacity] duration-100 ease-linear will-change-transform"
              >
                <span className={`text-center text-[13px] font-semibold leading-tight transition-colors duration-300 ${
                  isCenter ? "text-white" : "text-white/35"
                }`}>
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      </Motion.section>
    </>
  );
}
