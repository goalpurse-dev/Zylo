import { useEffect, useState } from "react";

// True once the visitor has done anything on the page: scrolled, tapped, moved
// the pointer or pressed a key. Loop videos wait for it (HomeV2Sections.jsx
// LazyLoopVideo), so a page's first load is its text and posters only.
const EVENTS = ["scroll", "wheel", "touchstart", "pointerdown", "pointermove", "keydown"];
let happened = false;
const waiting = new Set();

function onFirst() {
  happened = true;
  EVENTS.forEach((name) => window.removeEventListener(name, onFirst, true));
  waiting.forEach((notify) => notify());
  waiting.clear();
}

export function useFirstInteraction() {
  const [done, setDone] = useState(happened);
  useEffect(() => {
    if (happened) { setDone(true); return undefined; }
    const notify = () => setDone(true);
    if (!waiting.size) EVENTS.forEach((name) => window.addEventListener(name, onFirst, { capture: true, passive: true }));
    waiting.add(notify);
    return () => { waiting.delete(notify); };
  }, []);
  return done;
}
