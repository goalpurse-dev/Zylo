import { useCallback, useEffect, useRef, useState } from "react";
import { advanceRun, approveImages, regenerateImage, startRun, WORKING_STEPS } from "../api/cutawayApi";

const TICK_MS = 4000;
const MAX_FAILED_TICKS = 5;

/**
 * One Cutaway run. While the server has work (WORKING_STEPS) the page calls
 * "advance" every few seconds; at "approval" it stops and waits for the user.
 * A run left mid-way picks up again when it is opened (open(runId)).
 */
export default function useCutawayRun() {
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const runRef = useRef(null);
  const generation = useRef(0);

  const accept = useCallback((next) => { runRef.current = next; setRun(next); }, []);

  useEffect(() => {
    if (!run?.id || !WORKING_STEPS.has(run.step)) return undefined;
    const mine = generation.current;
    let failed = 0;
    let timer;
    const loop = async () => {
      try {
        const next = await advanceRun(runRef.current.id);
        if (generation.current !== mine) return;
        failed = 0;
        accept(next);
        if (!WORKING_STEPS.has(next.step)) return;
      } catch (e) {
        failed += 1;
        if (failed >= MAX_FAILED_TICKS) { setError(e.message); return; }
      }
      timer = window.setTimeout(loop, TICK_MS);
    };
    timer = window.setTimeout(loop, TICK_MS);
    return () => window.clearTimeout(timer);
  }, [run?.id, run?.step, accept]);

  const act = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try { accept(await fn()); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [accept]);

  const start = useCallback((topic, lengthSec) => { generation.current += 1; accept(null); return act(() => startRun(topic, lengthSec)); }, [act, accept]);
  const regenerate = useCallback((index) => act(() => regenerateImage(runRef.current.id, index)), [act]);
  const approve = useCallback(() => act(() => approveImages(runRef.current.id)), [act]);
  const open = useCallback((runId) => { generation.current += 1; return act(() => advanceRun(runId)); }, [act]);
  const reset = useCallback(() => { generation.current += 1; accept(null); setError(null); }, [accept]);

  return { run, error, busy, start, regenerate, approve, open, reset };
}
