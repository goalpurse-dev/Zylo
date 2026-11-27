import { useEffect, useState } from "react";

/** true when the device asks for less motion (then nothing types, slides or fades) */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * A placeholder that types itself: each line letter by letter, a pause, then erased, then the next line.
 * Off (returns `fallback`) while `active` is false or the device asks for less motion.
 */
export function useTypewriter(lines, { active = true, fallback = "", typeMs = 45, eraseMs = 18, holdMs = 1600 } = {}) {
  const reduced = useReducedMotion();
  const [text, setText] = useState(fallback);
  const key = lines.join("\u0001");
  useEffect(() => {
    if (!active || reduced || !lines.length) { setText(fallback); return undefined; }
    let line = 0, pos = 0, erasing = false, timer;
    const tick = () => {
      const full = lines[line];
      if (!erasing) {
        pos += 1;
        setText(full.slice(0, pos));
        if (pos >= full.length) { erasing = true; timer = setTimeout(tick, holdMs); return; }
        timer = setTimeout(tick, typeMs);
      } else {
        pos -= 1;
        setText(full.slice(0, Math.max(0, pos)));
        if (pos <= 0) { erasing = false; line = (line + 1) % lines.length; timer = setTimeout(tick, 350); return; }
        timer = setTimeout(tick, eraseMs);
      }
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [key, active, reduced, fallback, typeMs, eraseMs, holdMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return text;
}

/** "12.4M views" from a number */
export const viewsLabel = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n)).replace(".0M", "M");
