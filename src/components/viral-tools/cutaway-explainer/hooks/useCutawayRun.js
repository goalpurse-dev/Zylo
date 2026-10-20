import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_STEP_MS, DEMO_VIDEO, DEMO_VIDEO_CLEAN, EXAMPLES, newDemoRun } from "../api/cutawayApi";

const ORDER = ["script", "scene", "render", "done"];

/**
 * One Cutaway run. In the demo (until the 3D planner and render service exist) it walks through
 * Script → Scene → Render on timers and ends on the hand-built landfill video. Finished runs stay in
 * this session's "Recent" list.
 */
export default function useCutawayRun() {
  const [run, setRun] = useState(null);
  const [recent, setRecent] = useState([]);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!run || run.step === "done") return undefined;
    if (run.step === "render") {
      // render shows a percentage, like the real frame counter will
      const t0 = Date.now();
      const tick = () => {
        const pct = Math.min(100, Math.round(((Date.now() - t0) / DEMO_STEP_MS.render) * 100));
        if (pct >= 100) {
          setRun((r) => {
            if (!r) return r;
            const done = { ...r, step: "done", renderPct: 100, finalUrl: r.endCard === false ? DEMO_VIDEO_CLEAN : DEMO_VIDEO };
            setRecent((list) => [done, ...list.filter((x) => x.id !== done.id)].slice(0, 8));
            return done;
          });
          return;
        }
        setRun((r) => (r ? { ...r, renderPct: pct } : r));
        timer.current = window.setTimeout(tick, 120);
      };
      timer.current = window.setTimeout(tick, 120);
      return () => window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      setRun((r) => (r ? { ...r, step: ORDER[ORDER.indexOf(r.step) + 1] } : r));
    }, DEMO_STEP_MS[run.step]);
    return () => window.clearTimeout(timer.current);
  }, [run?.id, run?.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // endCard: in the demo the page mirrors the server rule (endCardFor); the real pipeline decides on the server
  const start = useCallback((topic, lengthSec, soundEffects = true, endCard = true) => { window.clearTimeout(timer.current); setRun(newDemoRun(topic, lengthSec, soundEffects, endCard)); }, []);
  // a finished run of this session, or one of the two examples shown while there are none
  const open = useCallback((id) => { const r = recent.find((x) => x.id === id) ?? EXAMPLES.find((x) => x.id === id); if (r) setRun(r); }, [recent]);
  const reset = useCallback(() => { window.clearTimeout(timer.current); setRun(null); }, []);

  return { run, recent, start, open, reset };
}
