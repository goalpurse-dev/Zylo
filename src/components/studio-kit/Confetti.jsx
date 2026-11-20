import { useEffect, useRef } from "react";

const COLORS = ["#bef264", "#d9f99d", "#ffffff", "#facc15", "#a3e635", "#86efac"];

/**
 * A one-shot confetti burst over the page (a project just turned Finished). A canvas, ~1.8 s, then it removes itself.
 * Nothing under "reduce motion". fire: change the value (a counter) to burst again; origin: { x, y } in px.
 */
export default function Confetti({ fire, origin }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!fire) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const c = ref.current;
    if (!c) return undefined;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = window.innerWidth * dpr; c.height = window.innerHeight * dpr;
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const ox = origin?.x ?? window.innerWidth / 2, oy = origin?.y ?? window.innerHeight / 3;
    const parts = Array.from({ length: 140 }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1, v = 6 + Math.random() * 9;
      return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, c: COLORS[(Math.random() * COLORS.length) | 0] };
    });
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = now - start;
      g.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.globalAlpha = Math.max(0, 1 - t / 1800); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      }
      if (t < 1800) raf = requestAnimationFrame(tick); else g.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire, origin?.x, origin?.y]);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80] h-full w-full" />;
}
