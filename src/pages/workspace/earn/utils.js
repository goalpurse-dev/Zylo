import { useEffect, useState } from "react";

export function fmtNumber(n) {
  return Math.round(n).toLocaleString();
}

export function fmtEur(n) {
  return `€${n.toFixed(2)}`;
}

export function useCountUp(target, { duration = 600, decimals = 0, active = true } = {}) {
  const [value, setValue] = useState(active ? 0 : target);

  useEffect(() => {
    if (!active) { setValue(target); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);

  return decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
}

// Deterministic hash → HSL gradient, used for per-handle avatar circles.
export function hashGradient(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 140) % 360;
  return `linear-gradient(135deg, hsl(${h1} 65% 52%), hsl(${h2} 60% 24%))`;
}
