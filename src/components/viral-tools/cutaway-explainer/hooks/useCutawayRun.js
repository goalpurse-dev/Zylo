import { useCallback, useEffect, useRef, useState } from "react";
import { CutawayApiError, cutawayServer, DEMO_STEP_MS, demoVideoFor, EXAMPLES, isWorking, newDemoRun } from "../api/cutawayApi";
import { emitCreditRefund, emitCreditSpend } from "../../../../lib/creditPopEvents";

const ORDER = ["script", "scene", "render", "done"];
// owner testing on localhost only: the real pipeline (scripts/cutaway/proto3d/m2/localServer.mjs) instead of the server
export const LOCAL_GENERATION = import.meta.env?.DEV === true && import.meta.env?.VITE_CUTAWAY_LOCAL === "1";

// How often a run being made is asked about: every 3 s while the tab is on screen, every 15 s while it is hidden
// (and at once when it comes back); after failed asks it backs off, up to 30 s.
export const POLL_MS = 3000;
export const POLL_HIDDEN_MS = 15000;
const POLL_MAX_MS = 30000;

/**
 * Client-side times the generating view animates from: when the narration first arrived (it types out from
 * there) and when the parts list did (they pop in from there). The server sends neither; they are kept per run.
 */
function stamp(prev, next) {
  const now = Date.now();
  return {
    ...next,
    narrationAt: prev?.narrationAt ?? (next.narration ? next.narrationAt ?? now : null),
    partsAt: prev?.partsAt ?? (next.parts?.length ? next.partsAt ?? now : null),
  };
}

/**
 * One Cutaway run, from one of three sources:
 *  - mode "server" (previews and production): cutaway-api. start() charges and returns the RunView; `status` is
 *    polled while it is queued / script / scene / render. `list` fills Recent Creations and resumes a run that is
 *    still being made after a reload.
 *  - LOCAL_GENERATION (localhost, VITE_CUTAWAY_LOCAL=1): the M2 runner on this computer, polled once a second.
 *  - mode "mock" (local dev only, ?mock=): the timed demo (Script -> Scene -> Render -> the example closest to the
 *    topic), nothing charged. A mock run marked `frozen` stays in its state (for screenshots of each state).
 * start() resolves { ok: true } or { ok: false, error: CutawayApiError }; the studio maps the error to the right
 * popup or message. A run that finishes while the page is open gets doneAt (the reveal); a failed run whose credits
 * went back fires the app's "+N credits" pop once.
 */
export default function useCutawayRun({ mode = "server", listOnMount = false, initialRun = null, initialRecent = [], mockStartError = null } = {}) {
  const [run, setRun] = useState(initialRun);
  const [recent, setRecent] = useState(initialRecent);
  const [starting, setStarting] = useState(false);
  const timer = useRef(0);
  const watched = useRef(new Set()); // runs seen working on this page (they get the reveal / the refund pop)
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const remember = useCallback((r) => setRecent((list) => [r, ...list.filter((x) => x.id !== r.id)].slice(0, 20)), []);

  // A run leaves "working": the reveal for a video that finished here, the refund pop for one that failed here.
  const settle = useCallback((r) => {
    const seen = watched.current.has(r.id);
    watched.current.delete(r.id);
    if (r.step === "done") {
      const done = seen ? { ...r, doneAt: Date.now() } : r;
      remember(done);
      return done;
    }
    if (r.step === "failed") {
      if (seen && r.refunded && r.credits > 0) emitCreditRefund(r.credits, "Your credits are back");
      remember(r);
    }
    return r;
  }, [remember]);

  // ---------- server: Recent Creations, and a run still being made after a reload ----------
  useEffect(() => {
    if (mode !== "server" || !listOnMount || LOCAL_GENERATION) return undefined;
    let live = true;
    cutawayServer.list().then((runs) => {
      if (!live) return;
      setRecent(runs);
      const working = runs.find(isWorking);
      if (working) { watched.current.add(working.id); setRun((cur) => cur ?? stamp(null, working)); }
    }).catch(() => { /* the examples stay; Generate still works */ });
    return () => { live = false; };
  }, [mode, listOnMount]);

  // ---------- server: poll `status` while the run is being made ----------
  const pollId = run?.server && isWorking(run) ? run.id : null;
  useEffect(() => {
    if (!pollId) return undefined;
    let stop = false, inflight = false, fails = 0, t = 0;
    const schedule = (ms) => { window.clearTimeout(t); t = window.setTimeout(poll, ms); };
    async function poll() {
      if (stop || inflight) return;
      if (document.hidden) { schedule(POLL_HIDDEN_MS); return; }
      inflight = true;
      let finished = false;
      try {
        const v = await cutawayServer.status(pollId);
        fails = 0;
        if (stop || !v) return;
        finished = !isWorking(v);
        const cur = runRef.current;
        if (cur?.id !== v.id) return;
        const next = stamp(cur, { ...cur, ...v });
        // settle() outside a state updater: its credit pop must fire once, also under StrictMode
        setRun(finished ? settle(next) : next);
      } catch (e) {
        fails += 1;
        if (e instanceof CutawayApiError && (e.code === "NOT_FOUND" || e.code === "SIGN_IN")) {
          finished = true;
          setRun((cur) => (cur?.id === pollId ? { ...cur, step: "failed", status: "failed", error: e.message, refunded: false, lost: true } : cur));
        }
      } finally {
        inflight = false;
      }
      if (!stop && !finished) schedule(fails ? Math.min(POLL_MS * 2 ** fails, POLL_MAX_MS) : POLL_MS);
    }
    const onVisible = () => { if (!document.hidden && !stop) { window.clearTimeout(t); poll(); } };
    document.addEventListener("visibilitychange", onVisible);
    schedule(POLL_MS);
    return () => { stop = true; window.clearTimeout(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [pollId, settle]);

  // ---------- local runner (localhost only) ----------
  useEffect(() => {
    if (!LOCAL_GENERATION) return;
    fetch("/m2api/runs").then((r) => (r.ok ? r.json() : [])).then((list) => { if (Array.isArray(list) && list.length) setRecent((cur) => (cur.length ? cur : list)); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!LOCAL_GENERATION || !run?.local || run.step === "done" || run.step === "failed" || String(run.id).startsWith("pending-")) return undefined;
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(`/m2api/runs/${run.id}`);
        if (r.ok) {
          const s = await r.json();
          if (stop) return;
          setRun((cur) => (cur?.id === s.id ? stamp(cur, { ...cur, ...s, credits: cur.credits, kind: cur.kind, ...(s.step === "done" ? { doneAt: Date.now() } : {}) }) : cur));
          if (s.step === "done") remember({ ...s });
          if (s.step === "done" || s.step === "failed") return;
        }
      } catch { /* the runner restarts: keep polling */ }
      if (!stop) timer.current = window.setTimeout(poll, 1000);
    };
    timer.current = window.setTimeout(poll, 600);
    return () => { stop = true; window.clearTimeout(timer.current); };
  }, [run?.id, run?.local]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- mock (local dev): the timed demo ----------
  useEffect(() => {
    if (!run || !run.demo || run.frozen || run.step === "done" || run.step === "failed") return undefined;
    if (run.step === "render") {
      const t0 = run.stepAt ?? Date.now();
      const tick = () => {
        const pct = Math.min(100, Math.round(((Date.now() - t0) / DEMO_STEP_MS.render) * 100));
        if (pct >= 100) {
          setRun((r) => {
            if (!r) return r;
            const done = { ...r, step: "done", status: "done", renderPct: 100, framesShown: r.frames?.length ?? 0, finalUrl: demoVideoFor(r), downloadUrl: demoVideoFor(r), doneAt: Date.now() };
            remember(done);
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
      setRun((r) => {
        if (!r) return r;
        const step = ORDER[ORDER.indexOf(r.step) + 1];
        return { ...r, step, status: step, stepAt: Date.now(), partsAt: step === "scene" ? Date.now() : r.partsAt };
      });
    }, DEMO_STEP_MS[run.step]);
    return () => window.clearTimeout(timer.current);
  }, [run?.id, run?.step, run?.frozen]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Start a video. input: { topic, lengthSec, soundEffects, removeWatermark }; meta: { credits, kind, endCard }
   * (what the page's quote said: used by the demo and the local runner; the server charges its own quote).
   */
  const start = useCallback(async (input, meta = {}) => {
    window.clearTimeout(timer.current);
    const { topic, lengthSec, soundEffects = true, removeWatermark = false } = input;
    if (LOCAL_GENERATION) {
      const base = { topic, lengthSec, soundEffects, endCard: meta.endCard ?? true, credits: meta.credits ?? null, kind: meta.kind ?? null, local: true, step: "script", status: "script", stepAt: Date.now(), renderPct: 0, framesShown: 0, createdAt: new Date().toISOString() };
      setRun({ ...base, id: `pending-${Date.now()}` });
      fetch("/m2api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, lengthSec, endCard: base.endCard }) })
        .then(async (r) => {
          const b = await r.json().catch(() => ({}));
          if (!r.ok) { setRun({ ...base, id: `failed-${Date.now()}`, step: "failed", status: "failed", error: b.error ?? `The local runner said ${r.status}.`, missing: b.missing, closest: b.closest }); return; }
          setRun({ ...base, id: b.id });
        })
        .catch(() => setRun({ ...base, id: `failed-${Date.now()}`, step: "failed", status: "failed", error: "The local runner is not running. Start it with: node scripts/cutaway/proto3d/m2/localServer.mjs" }));
      return { ok: true };
    }
    setStarting(true);
    try {
      if (mode === "mock") {
        await new Promise((r) => window.setTimeout(r, 900)); // a server round trip, so "Starting…" is seen
        if (mockStartError) return { ok: false, error: mockStartError };
        const r = { ...newDemoRun(topic, lengthSec, soundEffects, meta.endCard ?? true), credits: meta.credits ?? null, kind: meta.kind ?? null, status: "script", stepAt: Date.now(), narrationAt: Date.now(), framesShown: 0 };
        watched.current.add(r.id);
        setRun(r);
        if (r.credits) emitCreditSpend(r.credits);
        return { ok: true };
      }
      const view = await cutawayServer.start({ topic, lengthSec, removeWatermark });
      if (!view?.id) throw new CutawayApiError("SERVER");
      watched.current.add(view.id);
      setRun(stamp(null, view));
      if (view.credits > 0) emitCreditSpend(view.credits);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof CutawayApiError ? e : new CutawayApiError("SERVER") };
    } finally {
      setStarting(false);
    }
  }, [mode, mockStartError]);

  // a run of the list (finished, failed or still being made), or one of the two examples shown while there are none
  const open = useCallback((id) => {
    const r = recent.find((x) => x.id === id) ?? EXAMPLES.find((x) => x.id === id);
    if (!r) return;
    if (isWorking(r)) watched.current.add(r.id);
    setRun({ ...r, doneAt: undefined });
  }, [recent]);
  const reset = useCallback(() => { window.clearTimeout(timer.current); setRun(null); }, []);
  // the viewer's own video only (examples can't be deleted); on the server it is deleted too
  const remove = useCallback((id) => {
    setRecent((list) => list.filter((x) => x.id !== id));
    setRun((r) => (r?.id === id ? null : r));
    if (mode === "server" && !LOCAL_GENERATION && !String(id).startsWith("example-")) cutawayServer.remove(id).catch(() => { /* gone already, or back on the next list */ });
  }, [mode]);
  // owner only: approve (or take back) the layout of a finished run; the server reuses an approved layout for everyone
  const approveLayout = useCallback(async (id, approve) => {
    const apply = (value) => {
      setRun((r) => (r?.id === id ? { ...r, layoutApproved: value } : r));
      setRecent((list) => list.map((x) => (x.id === id ? { ...x, layoutApproved: value } : x)));
    };
    apply(approve);
    if (mode !== "server" || LOCAL_GENERATION) return { ok: true };
    try {
      const res = await cutawayServer.approveLayout(id, approve);
      apply(typeof res?.approved === "boolean" ? res.approved : approve);
      return { ok: true };
    } catch (e) {
      apply(!approve);
      return { ok: false, error: e };
    }
  }, [mode]);

  return { run, recent, starting, start, open, reset, remove, approveLayout };
}
