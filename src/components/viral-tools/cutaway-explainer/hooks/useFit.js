import { useLayoutEffect, useRef, useState } from "react";

/**
 * The largest box of a given aspect ratio (width / height) that fits inside the element `ref` points at, kept up
 * to date as it resizes. The 9:16 player and the generating card use it on desktop, so they are as big as the
 * panel allows in both directions and never push the details column off the side.
 */
/**
 * Phones: the largest box of `ratio` that fits between the element's top and the bottom nav (the app's
 * .ftg-bottom-nav, or the bottom of the screen), leaving `reserveBelow` px for what comes under it (Download and
 * "Make one like this"), and no wider than the element. So the whole 9:16 video is always on screen, never cropped,
 * on any phone height (667 px tall included). Re-measured on resize and when the browser bars show or hide.
 */
export function useFitScreen(ratio = 9 / 16, { reserveBelow = 0, minHeight = 200 } = {}) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const nav = document.querySelector(".ftg-bottom-nav");
      const viewH = window.visualViewport?.height ?? window.innerHeight;
      const bottom = nav && nav.getBoundingClientRect().height > 0 ? Math.min(viewH, nav.getBoundingClientRect().top) : viewH;
      const scroller = el.closest(".overflow-y-auto");
      const top = r.top + (scroller?.scrollTop ?? 0); // where it sits with its panel scrolled to the top
      const h = Math.max(minHeight, bottom - top - reserveBelow);
      const w = Math.min(r.width, h * ratio);
      setSize({ width: Math.floor(w), height: Math.floor(w / ratio) });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); };
  }, [ratio, reserveBelow, minHeight]);
  return [ref, size];
}

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
