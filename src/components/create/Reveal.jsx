import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./motion";

/** fades + lifts its child in the first time it scrolls into view (once; instant with reduced motion) */
export default function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined") { setShown(true); return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);
  return (
    <div
      ref={ref}
      className={className}
      style={reduced ? undefined : { opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(18px) scale(.985)", filter: shown ? "none" : "blur(4px)", transition: `opacity 600ms ease ${delay}ms, transform 600ms cubic-bezier(.2,.8,.2,1) ${delay}ms, filter 600ms ease ${delay}ms` }}
    >
      {children}
    </div>
  );
}

