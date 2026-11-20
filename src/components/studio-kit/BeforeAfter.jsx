import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { KIT_MEDIA, useInView, useReducedMotion } from "./studioKitShared";
import "./studioKit.css";

/**
 * "Free kit vs Finish in Zyvo": the owner's real Bedtime Story (Roblox Studio test, 2026-11-19), the same 14 s twice,
 * in sync. Left: the free kit's own output (the raw Studio footage + the voice + add_captions.sh's white one-word
 * captions, timed from the text). Right: Zyvo's finish (our caption style, sound effects, the music bed). Drag the
 * handle (or use the arrow keys); the sound buttons let you hear either side. Muted until asked; loads when on screen.
 */
export default function BeforeAfter() {
  const box = useRef(null);
  const free = useRef(null), zyvo = useRef(null);
  const on = useInView(box, 0.35);
  const still = useReducedMotion();
  const [pos, setPos] = useState(50);
  const [hear, setHear] = useState(null); // null | "free" | "zyvo"
  const hinted = useRef(false);
  const [nudging, setNudging] = useState(false);

  // both play together while on screen; the right one leads, the left one follows it
  useEffect(() => {
    const a = free.current, b = zyvo.current;
    if (!a || !b) return undefined;
    if (!on || (still && !hear)) { a.pause(); b.pause(); return undefined; }
    a.play().catch(() => {}); b.play().catch(() => {});
    const t = setInterval(() => { if (Math.abs(a.currentTime - b.currentTime) > 0.12) a.currentTime = b.currentTime; }, 500);
    return () => clearInterval(t);
  }, [on, still, hear]);
  useEffect(() => {
    if (free.current) free.current.muted = hear !== "free";
    if (zyvo.current) zyvo.current.muted = hear !== "zyvo";
  }, [hear]);
  // a small nudge of the handle the first time it shows, so people see it moves
  useEffect(() => {
    if (!on || hinted.current || still) return undefined;
    hinted.current = true; setNudging(true);
    const steps = [38, 62, 50];
    const timers = steps.map((p, i) => setTimeout(() => setPos(p), 500 + i * 450));
    timers.push(setTimeout(() => setNudging(false), 500 + steps.length * 450));
    return () => { timers.forEach(clearTimeout); setNudging(false); };
  }, [on, still]);

  const src = (s) => (on ? s : undefined);
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div ref={box} className="relative aspect-[9/16] w-full select-none overflow-hidden rounded-[24px] border-2 border-white/15 bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
        <video ref={zyvo} src={src(KIT_MEDIA.zyvo.video)} poster={KIT_MEDIA.zyvo.poster} muted loop playsInline preload="none" aria-label="Finished in Zyvo" className="absolute inset-0 h-full w-full object-cover" />
        <div className={`absolute inset-0 ${nudging ? "transition-[clip-path] duration-300 ease-out" : ""}`} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <video ref={free} src={src(KIT_MEDIA.free.video)} poster={KIT_MEDIA.free.poster} muted loop playsInline preload="none" aria-label="The free kit's video" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-white backdrop-blur">Free kit</span>
        <span className="absolute right-2.5 top-2.5 rounded-full bg-lime-300 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-[#11150D]">Finish in Zyvo</span>
        {/* the handle */}
        <div className={`pointer-events-none absolute inset-y-0 ${nudging ? "transition-[left] duration-300 ease-out" : ""}`} style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -ml-[1.5px] w-[3px] bg-white shadow-[0_0_12px_rgba(0,0,0,0.6)]" />
          <div className="absolute top-1/2 -ml-5 -mt-5 grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-lime-300 text-[15px] font-black text-[#11150D] shadow-lg">⇆</div>
        </div>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Compare the free kit's video with the Zyvo finish"
          className="sk-range absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[["free", "Hear the free kit"], ["zyvo", "Hear Zyvo's finish"]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setHear((h) => (h === k ? null : k))} aria-pressed={hear === k}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-[12.5px] font-bold transition ${hear === k ? "border-lime-300 bg-lime-300 text-[#11150D]" : "border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"}`}>
            {hear === k ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}{label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11.5px] text-white/45">Our Bedtime Story, made with the kit in Roblox Studio. The same 14 seconds, both sides.</p>
    </div>
  );
}
