import { useMemo } from "react";
import { videosOf } from "../../data/styles";
import { LoopVideo } from "./StyleCard";
import { useReducedMotion } from "./motion";

/**
 * The Create hub's opener: our own template clips on a wall that curves away from the middle (the middle clips sit
 * further back, the edges come forward), each floating a little. Built from the styles registry, so a new template's
 * clip joins the wall by itself. Phones show the middle 5.
 */
export default function VideoWall({ styles }) {
  const reduced = useReducedMotion();
  const clips = useMemo(() => {
    const all = styles.filter((s) => s.wall !== false).flatMap((s) => [...videosOf(s), ...(s.variants ?? []).filter((v) => v.preview).map((v) => ({ src: v.preview, poster: v.poster }))]);
    const seen = new Set();
    return all.filter((v) => (seen.has(v.src) ? false : (seen.add(v.src), true))).slice(0, 11);
  }, [styles]);
  if (clips.length < 3) return null;
  const c = (clips.length - 1) / 2;

  return (
    <div className="pointer-events-none relative -mx-4 h-[170px] overflow-hidden sm:h-[230px] lg:-mx-6" aria-hidden="true" data-testid="video-wall">
      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "1100px" }}>
        {clips.map((v, i) => {
          const d = i - c;
          const far = Math.abs(d);
          const hideOnPhone = far > 2 ? "hidden sm:block" : "";
          return (
            <div
              key={v.src}
              className={`${hideOnPhone} relative -mx-1 shrink-0 sm:-mx-2`}
              style={{
                transform: `rotateY(${d * -11}deg) translateZ(${far * 26}px) scale(${0.7 + far * 0.07})`,
                zIndex: Math.round(far * 2),
              }}
            >
              <div
                className="aspect-[9/16] w-[74px] overflow-hidden rounded-[14px] border border-white/10 bg-black shadow-[0_18px_40px_rgba(0,0,0,.55)] sm:w-[104px]"
                style={reduced ? undefined : { animation: `zyvoWallFloat ${5 + (i % 3)}s ease-in-out ${i * -0.7}s infinite` }}
              >
                <LoopVideo src={v.src} poster={v.poster} className="h-full w-full object-cover" />
              </div>
            </div>
          );
        })}
      </div>
      {/* fade the wall into the page */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#090A0A] to-transparent" />
      <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#090A0A] to-transparent sm:w-24" />
      <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#090A0A] to-transparent sm:w-24" />
      <style>{"@keyframes zyvoWallFloat { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }"}</style>
    </div>
  );
}
