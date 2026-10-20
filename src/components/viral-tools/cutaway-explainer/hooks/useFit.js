import { useLayoutEffect, useRef, useState } from "react";

/**
 * The largest box of a given aspect ratio (width / height) that fits inside the element `ref` points at, kept up
 * to date as it resizes. The 9:16 player and the generating card use it on desktop, so they are as big as the
 * panel allows in both directions and never push the details column off the side.
 */
export default function useFit(ratio = 9 / 16) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const w = Math.min(width, height * ratio);
      setSize({ width: Math.floor(w), height: Math.floor(w / ratio) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);
  return [ref, size];
}
