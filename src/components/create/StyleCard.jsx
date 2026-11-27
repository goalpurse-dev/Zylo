import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { viewsLabel } from "./motion";
import { isWide, videosOf } from "../../data/styles";

/** true on a computer with a mouse (hover exists); false on phones and tablets */
function useCanHover() {
  const [can, setCan] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    if (!mq) return undefined;
    const on = () => setCan(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return can;
}

/**
 * NO STRETCHING OR CROPPING (owner 2026-11-26): the picture or clip is shown whole (object-contain), over a blurred,
 * dimmed copy of its poster that fills the frame, so a 3:4 or square poster in a 9:16 card still looks finished.
 */
function Frame({ poster, children, className = "" }) {
  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      {poster && <img src={poster} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl" loading="lazy" />}
      {children}
    </div>
  );
}

/**
 * A looping, muted preview that never downloads early. Plays while on screen; with `hoverOnly`, on a computer it plays
 * only while the mouse is over it (phones: always while on screen).
 */
export function LoopVideo({ src, poster, className = "", eager = false, hoverOnly = false }) {
  const box = useRef(null);
  const vid = useRef(null);
  const canHover = useCanHover();
  const [onScreen, setOnScreen] = useState(eager);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (eager || !box.current || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.4 });
    io.observe(box.current);
    return () => io.disconnect();
  }, [eager]);
  const play = onScreen && (!hoverOnly || !canHover || hover);
  useEffect(() => {
    const v = vid.current;
    if (!v || !src) return;
    if (play) v.play?.().catch(() => {}); else v.pause?.();
  }, [play, src]);
  return (
    <div ref={box} className={`relative ${className}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Frame poster={poster}>
        {src
          ? <video ref={vid} src={onScreen ? src : undefined} poster={poster} muted loop playsInline preload="none" className="relative h-full w-full object-contain" />
          : <img src={poster} alt="" className="relative h-full w-full object-contain" loading="lazy" />}
      </Frame>
    </div>
  );
}

export function Badge({ badge, top = false }) {
  if (!badge) return null;
  return <span className={`absolute left-2 ${top ? "top-4" : "top-2"} rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${badge === "NEW" ? "bg-lime-300 text-[#11150D]" : "bg-white text-black"}`}>{badge}</span>;
}

/** "2.5M views" with an eye: only for real numbers in the registry */
export function ViewsTag({ views, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur ${className}`}>
      <Eye className="h-3 w-3 text-lime-300" aria-hidden="true" />{viewsLabel(views)} views
    </span>
  );
}

/**
 * Plays a style's videos one after another (on hover on a computer, while on screen on a phone), with story bars along
 * the top. Each clip plays at most `maxSec` seconds before the next. One video: a plain loop.
 */
export function CycleVideo({ videos, poster, className = "", maxSec = 6, hoverOnly = true }) {
  const ref = useRef(null);
  const canHover = useCanHover();
  const [onScreen, setOnScreen] = useState(false);
  const [hover, setHover] = useState(false);
  const [i, setI] = useState(0);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const play = onScreen && (!hoverOnly || !canHover || hover);
  useEffect(() => {
    const v = ref.current?.querySelector("video");
    if (!v) return;
    if (play) v.play?.().catch(() => {}); else v.pause?.();
  }, [play, i]);
  const next = () => { setP(0); setI((n) => (n + 1) % videos.length); };
  const cur = videos[i] ?? null;
  return (
    <div ref={ref} className={`relative h-full w-full ${className}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Frame poster={cur?.poster ?? poster}>
        {cur ? (
          <video
            key={cur.src} src={onScreen ? cur.src : undefined} poster={cur.poster ?? poster} muted playsInline preload="none" loop={videos.length === 1}
            onTimeUpdate={(e) => { const v = e.currentTarget; const len = Math.min(v.duration || maxSec, maxSec); setP(Math.min(1, v.currentTime / len)); if (videos.length > 1 && v.currentTime >= len) next(); }}
            onEnded={videos.length > 1 ? next : undefined}
            className="relative h-full w-full object-contain"
          />
        ) : <img src={poster} alt="" className="relative h-full w-full object-contain" loading="lazy" />}
      </Frame>
      {videos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/45 to-transparent" aria-hidden="true">
          <div className="absolute inset-x-2 top-1.5 flex gap-1">
            {videos.map((v, n) => (
              <span key={v.src} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span className="block h-full rounded-full bg-white" style={{ width: `${n < i ? 100 : n === i ? Math.round(p * 100) : 0}%` }} />
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** one template in a studio's grid: a muted loop on hover (always on phones); "Works with Claude" only in the popup */
export default function StyleCard({ style, onOpen }) {
  const videos = videosOf(style);
  const wide = isWide(style);
  return (
    <button type="button" onClick={() => onOpen(style)} className="group relative block w-full overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.03] text-left transition hover:border-lime-300/40 active:scale-[.98]" data-testid={`style-card-${style.id}`}>
      <div className={`relative w-full overflow-hidden bg-black ${wide ? "aspect-video" : "aspect-[9/16]"}`}>
        <CycleVideo videos={videos} poster={style.poster} className="transition duration-300 group-hover:scale-[1.02]" />
        <Badge badge={style.badge} top={videos.length > 1} />
        {style.variants?.length > 0 && <span className="absolute right-2 top-4 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/85 backdrop-blur">{style.variants.length} versions</span>}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10">
          {style.views > 0 && <ViewsTag views={style.views} className="mb-1.5" />}
          <p className="text-[15px] font-bold leading-tight text-white">{style.name}</p>
          <p className="mt-0.5 line-clamp-1 text-[11.5px] text-white/70">{style.hook.replace(/___/g, "…")}</p>
        </div>
      </div>
    </button>
  );
}
