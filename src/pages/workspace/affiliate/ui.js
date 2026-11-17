// Shared styles, formatters and the count-up hook for the /affiliate page (kept out of parts.jsx so that
// file exports only components).
import { useEffect, useRef, useState } from "react";

export const CARD = "rounded-[22px] border border-white/[0.09] bg-white/[0.035]";
export const LABEL = "text-[11.5px] font-bold uppercase tracking-[0.12em] text-white/45";
export const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
export const fmtCredits = (n) => `${Number(n || 0).toLocaleString("en")} credits`;

/** Counts from the last value up to `target` (eased); jumps straight there with reduced motion. */
export function useCountUp(target, ms = 900) {
  const [v, setV] = useState(reduceMotion() ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduceMotion()) { setV(target); return undefined; }
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / ms);
      setV(a + (target - a) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
