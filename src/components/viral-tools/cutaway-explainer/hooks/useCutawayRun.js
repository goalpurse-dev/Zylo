import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_STEP_MS, demoVideoFor, EXAMPLES, newDemoRun } from "../api/cutawayApi";

const ORDER = ["script", "scene", "render", "done"];
// owner testing on localhost only: the real pipeline (scripts/cutaway/proto3d/m2/localServer.mjs) instead of the demo
export const LOCAL_GENERATION = import.meta.env?.DEV === true && import.meta.env?.VITE_CUTAWAY_LOCAL === "1";

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

  // local mode: the videos already made on this computer fill Recent Creations
  useEffect(() => {
    if (!LOCAL_GENERATION) return;
    fetch("/m2api/runs").then((r) => (r.ok ? r.json() : [])).then((list) => { if (Array.isArray(list) && list.length) setRecent((cur) => (cur.length ? cur : list)); }).catch(() => {});
  }, []);

  // local mode (localhost, VITE_CUTAWAY_LOCAL=1): the real M2 pipeline on this computer, polled once a second
  useEffect(() => {
    if (!run?.local || run.step === "done" || run.step === "failed" || String(run.id).startsWith("pending-")) return undefined;
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(`/m2api/runs/${run.id}`);
        if (r.ok) {
          const s = await r.json();
          if (stop) return;
          setRun((cur) => (cur?.id === s.id ? { ...cur, ...s, credits: cur.credits, kind: cur.kind } : cur));
          if (s.step === "done") setRecent((list) => [{ ...s }, ...list.filter((x) => x.id !== s.id)].slice(0, 8));
          if (s.step === "done" || s.step === "failed") return;
        }
      } catch { /* the runner restarts: keep polling */ }
      if (!stop) timer.current = window.setTimeout(poll, 1000);
    };
    timer.current = window.setTimeout(poll, 600);
    return () => { stop = true; window.clearTimeout(timer.current); };
  }, [run?.id, run?.local]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!run || run.step === "done" || run.example || run.local) return undefined;
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
    if (LOCAL_GENERATION) {
      const base = { topic, lengthSec, soundEffects, endCard, credits, kind, local: true, step: "script", stepAt: Date.now(), renderPct: 0, framesShown: 0, createdAt: new Date().toISOString() };
      setRun({ ...base, id: `pending-${Date.now()}` });
      fetch("/m2api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, lengthSec, endCard }) })
        .then(async (r) => {
          const b = await r.json().catch(() => ({}));
          if (!r.ok) { setRun({ ...base, id: `failed-${Date.now()}`, step: "failed", error: b.error ?? `The local runner said ${r.status}.`, missing: b.missing, closest: b.closest }); return; }
          setRun({ ...base, id: b.id });
        })
        .catch(() => setRun({ ...base, id: `failed-${Date.now()}`, step: "failed", error: "The local runner is not running. Start it with: node scripts/cutaway/proto3d/m2/localServer.mjs" }));
      return;
    }
    setRun({ ...newDemoRun(topic, lengthSec, soundEffects, endCard), credits, kind, stepAt: Date.now(), framesShown: 0 });
  }, []);
  // a finished run of this session, or one of the two examples shown while there are none
  const open = useCallback((id) => { const r = recent.find((x) => x.id === id) ?? EXAMPLES.find((x) => x.id === id); if (r) setRun(r); }, [recent]);
  const reset = useCallback(() => { window.clearTimeout(timer.current); setRun(null); }, []);
  // the viewer's own video only (examples can't be deleted); the real pipeline also deletes it on the server
  const remove = useCallback((id) => { setRecent((list) => list.filter((x) => x.id !== id)); setRun((r) => (r?.id === id ? null : r)); }, []);

  return { run, recent, start, open, reset, remove };
}
