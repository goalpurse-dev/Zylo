import { useMemo } from "react";
import { videosOf } from "../../data/styles";
import { LoopVideo } from "./StyleCard";
import { useReducedMotion } from "./motion";

/** the soft green glow + faint dot grid behind the Create pages, AI Studio and the Library */
export function PageGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-[-160px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(190,242,100,.16),transparent)]" />
      <div className="absolute right-[-120px] top-[30%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(167,139,250,.10),transparent)]" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
    </div>
  );
}

/** a headline's second half in Zyvo lime (instead of grey) */
export function Lime({ children }) {
  return <span className="bg-gradient-to-r from-lime-200 via-lime-300 to-emerald-300 bg-clip-text text-transparent">{children}</span>;
}

/**
 * Big screens only: our clips coming in from both sides of the hero, tilted toward the middle (3 a side), floating.
 * Phones and tablets don't show it (the hero stays clean there).
 */
export function SideWalls({ styles, offset = 0 }) {
  const reduced = useReducedMotion();
  const clips = useMemo(() => {
    // one clip from each template first, then second clips, so the sides show many different templates
    const per = styles.filter((st) => st.wall !== false).map((st) => [...videosOf(st), ...(st.variants ?? []).filter((v) => v.preview).map((v) => ({ src: v.preview, poster: v.poster }))]);
    const all = [];
    for (let round = 0; round < 4; round++) for (const list of per) if (list[round]) all.push(list[round]);
    const seen = new Set();
    return all.filter((v) => (seen.has(v.src) ? false : (seen.add(v.src), true))).slice(offset, offset + 6);
  }, [styles, offset]);
  if (clips.length < 6) return null;
  const side = (list, dir) => (
    <div className={`pointer-events-none absolute top-10 hidden xl:flex ${dir < 0 ? "left-0 -translate-x-[18%]" : "right-0 translate-x-[18%]"} flex-col gap-5`} style={{ perspective: "1000px" }} aria-hidden="true">
      {list.map((v, i) => (
        <div key={v.src} style={{ transform: `rotateY(${dir * -32}deg) translateX(${dir * (i === 1 ? -40 : 0)}px) scale(${i === 1 ? 1 : 0.86})` }}>
          <div className="aspect-[9/16] w-[118px] overflow-hidden rounded-[16px] border border-white/10 bg-black shadow-[0_20px_50px_rgba(0,0,0,.6)]"
            style={reduced ? undefined : { animation: `zyvoSideFloat ${6 + i}s ease-in-out ${i * -1.3}s infinite` }}>
            <LoopVideo src={v.src} poster={v.poster} className="h-full w-full object-cover" />
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <>
      {side(clips.slice(0, 3), -1)}
      {side(clips.slice(3, 6), 1)}
      <style>{"@keyframes zyvoSideFloat { 0%, 100% { translate: 0 0 } 50% { translate: 0 -8px } }"}</style>
    </>
  );
}
