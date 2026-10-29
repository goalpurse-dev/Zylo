import { useEffect, useRef } from "react";
import { Play } from "lucide-react";

// The hero still: a frame of our own landfill video (540 x 960). The ground "slices open" at CUT (the top of the
// pit, as a share of the height): an earth lid over everything below it slides away and the cut settles in depth.
const POSTER = "/cutaway-explainer/poster.webp";
const BACK_POSTER = "/cutaway-explainer/example-french-drain.jpg";
const CUT = 52;

// The parts the labels point at, in % of the poster (x, y). The short phone crop shows about 36-74% of the height,
// under its HUD and above its title, so it uses its own points (w: [x, y]) and only the parts in that band.
const LABELS = [
  { name: "Gas vent", x: 24, y: 43, side: "right", w: [24, 48] },
  { name: "Dump truck", x: 66, y: 35, side: "right" },
  { name: "Trash layers", x: 46, y: 66, side: "right", w: [44, 57] },
  { name: "Clay liner", x: 18, y: 82, side: "right" },
  { name: "Drain pipe", x: 72, y: 84, side: "left" },
];

const finePointer = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Pointer parallax without React renders: pointer moves only write two CSS variables on the stage (one rAF per
 * frame); every layer reads them in its transform (.cw-tilt, .cw-depth). Touch screens get a slow idle sway instead.
 */
function useParallax() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer() || reduced()) return undefined;
    let raf = 0, px = 0, py = 0;
    const host = el;
    const flush = () => { raf = 0; el.style.setProperty("--px", px.toFixed(3)); el.style.setProperty("--py", py.toFixed(3)); };
    const move = (e) => {
      const r = host.getBoundingClientRect();
      px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      el.classList.add("is-live");
      if (!raf) raf = window.requestAnimationFrame(flush);
    };
    const leave = () => { px = 0; py = 0; el.classList.remove("is-live"); if (!raf) raf = window.requestAnimationFrame(flush); };
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave);
    return () => { host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); if (raf) window.cancelAnimationFrame(raf); };
  }, []);
  return ref;
}

function Label({ name, x, y, side, i }) {
  return (
    <span className="cw-depth absolute left-0 top-0 h-full w-full" style={{ "--z": "14px" }} aria-hidden="true">
      <span className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
        <span className="cw-label absolute left-0 top-0 block" style={{ "--d": `${1500 + i * 140}ms` }}>
          <span className="cw-float absolute left-0 top-0 block" style={{ "--t": `${4.6 + i * 0.7}s`, "--fd": `${i * -0.9}s` }}>
            {/* the 12 px dot is centred on the point: the row starts 6 px before it (or ends 6 px after it) */}
            <span className={`absolute top-0 flex items-center gap-1 whitespace-nowrap ${side === "left" ? "right-[-6px] flex-row-reverse" : "left-[-6px]"}`} style={{ transform: "translateY(-50%)" }}>
              <span className="relative grid h-3 w-3 shrink-0 place-items-center">
                <span className="cw-ping absolute inset-0 rounded-full bg-cutaway/60" />
                <span className="relative h-2 w-2 rounded-full border border-white/80 bg-cutaway shadow-[0_0_10px_rgba(74,222,128,.9)]" />
              </span>
              <span className="h-px w-3 bg-white/60" />
              <span className="rounded-full border border-white/15 bg-black/65 px-2 py-[3px] text-[10px] font-bold leading-[1.2] text-white shadow-[0_6px_18px_rgba(0,0,0,.35)]">{name}</span>
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

/** The poster, cut open at CUT: above-ground stays, the cut below settles in depth while the earth lid slides away. */
function CutawayCanvas({ wide }) {
  return (
    <div className="absolute inset-x-0 aspect-[9/16]" style={wide ? { top: "42%", transform: `translateY(-${CUT}%)` } : { top: 0 }}>
      <div className="cw-depth absolute inset-0" style={{ "--z": "5px" }}>
        {/* above ground */}
        <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: `${CUT}%` }}>
          <img src={POSTER} alt="" width="540" height="960" decoding="async" fetchPriority="high" draggable="false" className="absolute left-0 top-0 h-auto w-full max-w-none select-none" />
        </div>
        {/* below ground: the cut */}
        <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: `${CUT}%` }}>
          <div className="cw-settle absolute inset-x-0" style={{ top: `-${(CUT / (100 - CUT)) * 100}%`, height: `${(100 / (100 - CUT)) * 100}%` }}>
            <img src={POSTER} alt="" width="540" height="960" decoding="async" draggable="false" className="h-full w-full select-none object-cover" />
          </div>
          {/* the earth lid that slides away (soil with a strip of grass on top) */}
          <div className="cw-lid absolute inset-0" aria-hidden="true">
            <div className="h-[7px] bg-gradient-to-b from-[#7BD35A] to-[#3E8E2E]" />
            <div className="h-full bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,.06)_0_2px,transparent_3px),radial-gradient(circle_at_70%_60%,rgba(0,0,0,.25)_0_3px,transparent_4px),linear-gradient(180deg,#6B4426,#3B2414_60%,#24160C)] [background-size:22px_22px,30px_30px,100%_100%]" />
          </div>
          {/* the green scan that runs down the freshly opened cut */}
          <div className="cw-scan pointer-events-none absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-transparent via-cutaway/25 to-transparent" />
        </div>
        {/* the cut line itself flashes as the ground opens */}
        <div className="cw-cut-line pointer-events-none absolute inset-x-0 h-[2px] bg-cutaway shadow-[0_0_18px_4px_rgba(74,222,128,.65)]" style={{ top: `${CUT}%` }} />
      </div>
      {LABELS.filter((l) => !wide || l.w).map((l, i) => <Label key={l.name} name={l.name} side={l.side} x={wide ? l.w[0] : l.x} y={wide ? l.w[1] : l.y} i={i} />)}
    </div>
  );
}

/**
 * The template's hero: a live cutaway built from our own render (no video, no library): layered parallax that
 * follows the pointer on desktop and sways slowly on phones, the ground slicing open on first view, the parts
 * labelled in depth. variant "tall" (9:16, desktop) or "wide" (a 16:11 crop for phones). Space is reserved by the
 * aspect ratio, so nothing shifts while the image loads.
 */
export default function CutawayHero({ variant = "tall", onWatch, children, className = "", style }) {
  const stage = useParallax();
  const wide = variant === "wide";
  const touch = !finePointer();
  return (
    <div ref={stage} style={style} className={`relative [perspective:1100px] ${className}`}>
      {!wide && (
        <div aria-hidden="true" className="cw-depth pointer-events-none absolute inset-0 max-sm:hidden" style={{ "--z": "-10px" }}>
          <img src={BACK_POSTER} alt="" width="216" height="384" decoding="async" className="cw-back-card absolute -left-[18%] top-[7%] aspect-[9/16] w-[78%] rounded-[24px] border border-white/10 object-cover shadow-[0_30px_60px_rgba(0,0,0,.5)]" />
        </div>
      )}
      <div className="cw-stage-in relative h-full w-full">
      <div className={`relative h-full w-full ${touch ? "cw-sway" : "cw-tilt"}`}>
        <div className={`relative overflow-hidden border border-cutaway/20 bg-[#0D100E] shadow-[0_30px_80px_-20px_rgba(0,0,0,.8),0_0_0_1px_rgba(74,222,128,.05)] ${wide ? "aspect-[16/11] w-full rounded-[22px]" : "h-full w-full rounded-[28px]"}`}>
          {/* a soft green bloom behind the cut */}
          <div aria-hidden="true" className="cw-depth pointer-events-none absolute -inset-10 bg-[radial-gradient(ellipse_at_50%_62%,rgba(74,222,128,.22),transparent_60%)]" style={{ "--z": "-6px" }} />
          <CutawayCanvas wide={wide} />
          {/* HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />
          <div className="cw-depth absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2 py-1 backdrop-blur-[2px]" style={{ "--z": "9px" }}>
            <span className="relative grid h-2 w-2 place-items-center"><span className="cw-ping absolute inset-0 rounded-full bg-cutaway" /><span className="relative h-1.5 w-1.5 rounded-full bg-cutaway" /></span>
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/85">3D cutaway</span>
          </div>
          {onWatch && (
            <span className="cw-depth absolute right-3 top-3" style={{ "--z": "9px" }}>
              <button type="button" onClick={onWatch} className="cw-press flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-black text-black shadow-[0_8px_24px_rgba(0,0,0,.35)] hover:bg-cutaway-soft">
                <Play className="h-3 w-3 fill-current" />Watch an example
              </button>
            </span>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
          {children && <div className="cw-depth absolute inset-x-0 bottom-0 p-4" style={{ "--z": "7px" }}>{children}</div>}
        </div>
      </div>
      </div>
    </div>
  );
}
