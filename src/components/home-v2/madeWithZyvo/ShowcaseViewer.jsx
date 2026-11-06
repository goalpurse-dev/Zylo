// Full-screen TikTok-style viewer for "Made with Zyvo": swipe / arrows / wheel between videos, a sound toggle,
// and "Use this template". Rendered only while open (so Home's server HTML never contains a portal).
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp, Volume2, VolumeX, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackLaunch } from "../../launch/launch";

let soundOn = true; // remembered while the page is open

export default function ShowcaseViewer({ items, start = 0, onClose }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(start);
  const [dir, setDir] = useState(1);
  const [muted, setMuted] = useState(!soundOn);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const videoRef = useRef(null);
  const touch = useRef(null);
  const wheelAt = useRef(0);
  const item = items[index];
  const count = items.length;

  const go = useCallback((step) => {
    if (count < 2) return;
    setDir(step);
    setReady(false);
    setProgress(0);
    setIndex((i) => (i + step + count) % count);
  }, [count]);

  // Keys, and the page underneath stays still.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "m" || e.key === "M") setMuted((m) => !m);
    };
    document.addEventListener("keydown", onKey);
    const scroller = document.getElementById("workspace-scroll");
    const before = [document.body.style.overflow, scroller?.style.overflow];
    document.body.style.overflow = "hidden";
    if (scroller) scroller.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before[0];
      if (scroller) scroller.style.overflow = before[1] ?? "";
    };
  }, [go, onClose]);

  useEffect(() => { soundOn = !muted; if (videoRef.current) videoRef.current.muted = muted; }, [muted]);

  // Play the current video; if the browser refuses sound, play it muted.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted || !item.sound;
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
    // the next poster is fetched early so a swipe never shows an empty frame
    const next = items[(index + 1) % count];
    if (next) { const img = new Image(); img.src = next.poster; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onTouchStart = (e) => { touch.current = { y: e.touches[0].clientY, x: e.touches[0].clientX }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    touch.current = null;
    if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) go(dy < 0 ? 1 : -1);
    else if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  };
  const onWheel = (e) => {
    const now = Date.now();
    if (Math.abs(e.deltaY) < 25 || now - wheelAt.current < 600) return;
    wheelAt.current = now;
    go(e.deltaY > 0 ? 1 : -1);
  };

  const useTemplate = () => {
    trackLaunch("community_use_template", { placement: "community_viewer", target: item.template.path, videoId: item.id });
    onClose();
    navigate(item.template.path);
  };

  const slide = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : {
    initial: (d) => ({ y: d > 0 ? "18%" : "-18%", opacity: 0 }),
    animate: { y: 0, opacity: 1 },
    exit: (d) => ({ y: d > 0 ? "-18%" : "18%", opacity: 0 }),
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.template.name} video ${index + 1} of ${count}`}
      onClick={onClose}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-testid="mwz-viewer"
    >
      <div className="relative h-full w-full sm:h-[min(92dvh,900px)] sm:w-auto sm:aspect-[9/16]" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <Motion.div
            key={item.id}
            custom={dir}
            {...slide}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 overflow-hidden bg-black sm:rounded-[22px] sm:border sm:border-white/10 sm:shadow-[0_40px_120px_rgba(0,0,0,.7)]"
          >
            <img src={item.poster} alt="" className="absolute inset-0 h-full w-full object-contain" />
            <video
              // only ever set: the outgoing video unmounts after the incoming one mounts (exit animation)
              ref={(el) => { if (el) videoRef.current = el; }}
              src={item.src}
              poster={item.poster}
              playsInline
              loop
              preload="auto"
              muted={muted || !item.sound}
              onPlaying={() => setReady(true)}
              onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
              onClick={(e) => { const v = e.currentTarget; if (v.paused) v.play().catch(() => {}); else v.pause(); }}
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
            />
            {!ready && <div className="absolute inset-0 grid place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" /></div>}
          </Motion.div>
        </AnimatePresence>

        {/* top: progress, counter, sound, close */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-3 pb-8 pt-[max(10px,env(safe-area-inset-top))] sm:rounded-t-[22px]">
          <div className="h-[3px] overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white/90" style={{ width: `${progress * 100}%` }} /></div>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur">{index + 1} / {count}</span>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              disabled={!item.sound}
              aria-label={muted || !item.sound ? "Sound on" : "Sound off"}
              title={item.sound ? "Sound (M)" : "This clip has no sound"}
              className="pointer-events-auto ml-auto grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 disabled:opacity-40"
            >
              {muted || !item.sound ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65">
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* bottom: template + the big button */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-16 sm:rounded-b-[22px]">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur">{item.template.name}</span>
          <p className="mt-2 text-[13px] text-white/70">{item.template.desc}</p>
          <button
            type="button"
            onClick={useTemplate}
            className="mt-3 flex w-full items-center justify-center rounded-[16px] bg-lime-300 py-3.5 text-[15px] font-black text-[#11150D] shadow-[0_12px_34px_-10px_rgba(190,242,100,.7)] transition hover:bg-lime-200 active:scale-[0.985]"
            data-testid="mwz-use-template"
          >
            Use this template
          </button>
        </div>

        {/* desktop arrows */}
        {count > 1 && (
          <div className="absolute -right-16 top-1/2 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
            <button type="button" onClick={() => go(-1)} aria-label="Previous video" className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20"><ChevronUp className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Next video" className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20"><ChevronDown className="h-5 w-5" /></button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
