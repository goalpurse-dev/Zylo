import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_STEP_MS, demoVideoFor, EXAMPLES, newDemoRun } from "../api/cutawayApi";

const ORDER = ["script", "scene", "render", "done"];

/**
 * One Cutaway run. In the demo (until the 3D planner and render service exist) it walks through
 * Script → Scene → Render on timers and ends on the example closest to the topic. Each step records when it
 * started (stepAt), so the page can type the script out, pop the scene parts in and show a render ETA; the render
 * releases its low-res frames as it goes (framesShown), like a browser render would. Finished runs stay in this
 * session's "Recent" list; remove() deletes one.
 */
export default function useCutawayRun() {
  const [run, setRun] = useState(null);
  const [recent, setRecent] = useState([]);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!run || run.step === "done" || run.example) return undefined;
    if (run.step === "render") {
      const t0 = run.stepAt ?? Date.now();
      const tick = () => {
        const pct = Math.min(100, Math.round(((Date.now() - t0) / DEMO_STEP_MS.render) * 100));
        if (pct >= 100) {
          setRun((r) => {
            if (!r) return r;
            const done = { ...r, step: "done", renderPct: 100, framesShown: r.frames?.length ?? 0, finalUrl: demoVideoFor(r), doneAt: Date.now() };
            setRecent((list) => [done, ...list.filter((x) => x.id !== done.id)].slice(0, 8));
            return done;
          });
          return;
        }
        setRun((r) => (r ? { ...r, renderPct: pct, framesShown: Math.floor((pct / 100) * (r.frames?.length ?? 0)) } : r));
        timer.current = window.setTimeout(tick, 120);
      };
      timer.current = window.setTimeout(tick, 120);
      return () => window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      setRun((r) => (r ? { ...r, step: ORDER[ORDER.indexOf(r.step) + 1], stepAt: Date.now() } : r));
    }, DEMO_STEP_MS[run.step]);
    return () => window.clearTimeout(timer.current);
  }, [run?.id, run?.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // endCard: in the demo the page mirrors the server rule (endCardFor); the real pipeline decides on the server
  // credits / kind: what the quote said (the real pipeline reads them back from the server's charge)
  const start = useCallback((topic, lengthSec, soundEffects = true, endCard = true, { credits = null, kind = null } = {}) => {
    window.clearTimeout(timer.current);
    setRun({ ...newDemoRun(topic, lengthSec, soundEffects, endCard), credits, kind, stepAt: Date.now(), framesShown: 0 });
  }, []);
  // a finished run of this session, or one of the two examples shown while there are none
  const open = useCallback((id) => { const r = recent.find((x) => x.id === id) ?? EXAMPLES.find((x) => x.id === id); if (r) setRun(r); }, [recent]);
  const reset = useCallback(() => { window.clearTimeout(timer.current); setRun(null); }, []);
  // the viewer's own video only (examples can't be deleted); the real pipeline also deletes it on the server
  const remove = useCallback((id) => { setRecent((list) => list.filter((x) => x.id !== id)); setRun((r) => (r?.id === id ? null : r)); }, []);

  return { run, recent, start, open, reset, remove };
}
