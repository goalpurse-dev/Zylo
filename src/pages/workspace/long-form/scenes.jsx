// scenes.jsx — the Stickman Scenes step (Phase 6c, polished in 6c-polish).
//   • "Building your scenes": stages + server-clock elapsed/ETA, and a grid of
//     big cards that fills live (each card shows its time + line from the
//     start; only the picture area shimmers). A finished card can already be
//     regenerated while the rest are still drawing.
//   • Review: "Your video is ready to watch" — the whole video plays in the
//     browser (StickmanPlayer). Cards in the same grid; clicking one jumps the
//     player there. Regenerate (lime, credits inside) blurs the card while it
//     redraws, fades the new picture in and offers Undo for 10 s. Only real
//     image problems are flagged.
// One scroll (the page); the header is sticky; "Continue to Edit" sits in the
// same sticky bottom bar as every other step. Display only — everything runs
// and recovers on the server. `?replay=1` replays a finished run's fill.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Check, Coins, Maximize2, PenLine, RotateCw, Sparkles, TriangleAlert, Type, Undo2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { fetchLongFormProject } from "./project";
import { CreditsError, LongFormActionFooter, LongFormCreationHeader } from "./shared";
import { formatClock, formatEta, watchProject, unwatchProject } from "./autopilot";
import { fetchScenes, startScenes, updateScene, formatSceneTime, SCENES_POLL_MS } from "./scenes";
import { SceneThumb, SCENES_CSS, useOverlayFont } from "./sceneVisuals";
import StickmanPlayer from "./StickmanPlayer";
import SceneViewer from "./SceneViewer";

const UNDO_MS = 10_000;
// Phase 6e: the last scene list per project, so Back/Continue shows the saved page at once (refreshed behind).
const scenesCache = new Map();

// An icon button with a visible label on hover/focus (and for screen readers).
function IconAction({ label, onClick, children }) {
  return (
    <span className="group/tip relative inline-flex">
      <button type="button" onClick={onClick} aria-label={label} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/60 hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300">{children}</button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#11150D] opacity-0 shadow-lg transition group-hover/tip:opacity-100 group-focus-within/tip:opacity-100">{label}</span>
    </span>
  );
}

function SceneCard({ scene, credits, active, pending, undoable, busy, drawing, paused, onOpen, onView, onAction }) {
  const [mode, setMode] = useState(null); // null | "describe" | "text"
  const [draft, setDraft] = useState("");
  const rendering = pending || scene.status === "queued" || scene.status === "rendering";
  const finished = !!scene.imageUrl && !rendering;
  return (
    <article data-testid="scene-card" className={`zyvo-card flex flex-col gap-3 rounded-2xl border p-3 transition ${active ? "border-lime-300/60 bg-lime-300/[0.05]" : "border-white/[0.07] bg-[#131516] hover:border-white/15"}`}>
      <div className="group relative">
        <button type="button" onClick={onView} className="block w-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300" aria-label={`Open scene ${scene.number}`}>
          <SceneThumb scene={scene} busy={pending} />
        </button>
        {finished && (
          <button type="button" onClick={onView} aria-label="View full size" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-black/55 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100">
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
        {undoable && (
          <button type="button" onClick={() => onAction("undo")} className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[12px] font-semibold text-white shadow">
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
        )}
      </div>
      {/* The words: click to play the video from this scene (the picture opens the viewer). */}
      <div
        role="button" tabIndex={drawing || !scene.imageUrl ? -1 : 0} aria-label={`Play the video from scene ${scene.number}`}
        onClick={() => { if (!drawing && scene.imageUrl) onOpen(); }}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !drawing && scene.imageUrl) { e.preventDefault(); onOpen(); } }}
        className={`min-w-0 rounded-lg px-0.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${drawing || !scene.imageUrl ? "" : "cursor-pointer"}`}
      >
        <p className="text-[11.5px] font-semibold tabular-nums text-white/40">Scene {scene.number} · {formatSceneTime(scene.startMs)}–{formatSceneTime(scene.endMs)}</p>
        <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-white/90">“{scene.narration}”</p>
        {!drawing && <p className="mt-1 line-clamp-1 text-[12px] text-white/45">{scene.summary}</p>}
        {(scene.warnings.length > 0 || scene.overlayText) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {scene.overlayText && <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-200"><Type className="h-3 w-3" />On-screen text</span>}
            {scene.warnings.map((w) => <span key={w} className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-red-200"><TriangleAlert className="h-3 w-3" />{w}</span>)}
          </div>
        )}
      </div>
      {mode ? (
        <div className="flex flex-col gap-2 px-0.5">
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={mode === "text" ? "On-screen words (up to 5) — empty for none" : "Describe what you want to see…"}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[12.5px] text-white outline-none placeholder:text-white/30 focus:border-lime-300/40" />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={async () => { if (await onAction(mode === "text" ? "text" : "describe", mode === "text" ? { text: draft } : { description: draft })) setMode(null); }}
              className="zyvo-btn-shimmer inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-[12.5px] font-bold text-[#11150D] disabled:opacity-50">
              {mode === "text" ? "Save · free" : <>Regenerate <Coins className="h-3.5 w-3.5" />{credits}</>}
            </button>
            <button type="button" onClick={() => setMode(null)} className="rounded-lg px-3 text-[12px] text-white/50 hover:text-white">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-2 px-0.5">
          {rendering ? (
            paused && scene.status === "queued"
              ? <span data-testid="scene-paused" className="inline-flex items-center gap-1.5 text-[12px] text-amber-200/80"><RotateCw className="h-3.5 w-3.5" />Paused, continues automatically</span>
              : <span className="inline-flex items-center gap-1.5 text-[12px] text-white/45"><RotateCw className="h-3.5 w-3.5 animate-spin" />Drawing…</span>
          ) : (
            <>
              {/* A scene WE failed to draw is redrawn free (the server charges 0 for it). */}
              <button type="button" disabled={busy || (!finished && scene.status !== "failed")} onClick={() => onAction("regenerate")} data-testid={scene.status === "failed" ? "try-again-free" : "regenerate"}
                className="zyvo-btn-shimmer inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-1.5 text-[12px] font-bold text-[#11150D] transition hover:bg-lime-200 disabled:opacity-50">
                {scene.status === "failed"
                  ? <><RotateCw className="h-3.5 w-3.5" />Try again (free)</>
                  : <><RotateCw className="h-3.5 w-3.5" />Regenerate <span className="inline-flex items-center gap-0.5 rounded bg-black/10 px-1"><Coins className="h-3 w-3" />{credits}</span></>}
              </button>
              {!drawing && (
                <>
                  <IconAction label="Edit description" onClick={() => { setDraft(scene.summary ?? ""); setMode("describe"); }}><PenLine className="h-3.5 w-3.5" /></IconAction>
                  {finished && <IconAction label="Edit text" onClick={() => { setDraft(scene.overlayText ?? ""); setMode("text"); }}><Type className="h-3.5 w-3.5" /></IconAction>}
                </>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

// 1 per row on phones, 2 on tablets, 3 on desktop, 4 only on very wide screens.
const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1800px]:grid-cols-4";

function Notice({ notice }) {
  // Phase 7: a paid redraw refused for credits shows the Add credits link.
  if (notice.tone === "error" && /^Not enough credits/i.test(notice.text)) return <CreditsError message={notice.text} className="mb-4 rounded-lg bg-red-400/10 px-3 py-2 text-[12.5px] text-red-200" />;
  return <p className={`mb-4 rounded-lg px-3 py-2 text-[12.5px] ${notice.tone === "error" ? "bg-red-400/10 text-red-200" : notice.tone === "ok" ? "bg-lime-300/10 text-lime-200" : "bg-white/[0.05] text-white/70"}`}>{notice.text}</p>;
}

// ------------------------------ Page ------------------------------
export default function LongFormScenes() {
  const { id: projectId } = useParams();
  return <ScenesPage key={projectId} projectId={projectId} />;
}

// Phase 6e: `embedded` = the drawing stage of the generating screen (no header or footer;
// when the drawing is done it calls onDone, which opens the Scenes home).
export function ScenesPage({ projectId, embedded = false, onDone = null }) {
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const replay = params.get("replay") === "1";
  const dryRun = params.get("dryrun") === "1";
  useOverlayFont();
  const [project, setProject] = useState(null);
  const [data, setData] = useState(() => scenesCache.get(projectId) ?? null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState({}); // scene number -> version being replaced
  const [undoable, setUndoable] = useState({}); // scene number -> until (ms)
  const [viewerIdx, setViewerIdx] = useState(null); // the scene viewer (index into the list)
  const [activeIdx, setActiveIdx] = useState(-1);
  const [replayN, setReplayN] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  // First paint: the player + 12 cards; the rest one frame later (instant Back/Continue on 150-scene videos).
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setTimeout(() => setShowAll(true), 0)); return () => cancelAnimationFrame(r); }, []);
  const offsetRef = useRef(0);
  const playerRef = useRef(null);
  const playerBoxRef = useRef(null);
  const replayStart = useRef(Date.now());

  useEffect(() => { document.title = "Scenes | Zyvo"; fetchLongFormProject(projectId).then(setProject); }, [projectId]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    const r = await fetchScenes(projectId);
    if (!r.ok) { setError(r.message); return null; }
    if (r.run?.serverNow) offsetRef.current = Date.now() - Date.parse(r.run.serverNow);
    scenesCache.set(projectId, r);
    setData(r);
    return r;
  }, [projectId]);

  // Poll: fast while drawing or redrawing, slow otherwise.
  const pendingCount = Object.keys(pending).length;
  useEffect(() => {
    let alive = true;
    let timer;
    const poll = async () => {
      const r = await load();
      if (!alive || replay) return;
      const running = r?.run?.status === "running";
      if (running) watchProject(projectId); else unwatchProject(projectId);
      timer = setTimeout(poll, running || pendingCount ? SCENES_POLL_MS : 20000);
    };
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [projectId, load, replay, pendingCount]);

  // Realtime: a scene row changed -> refresh at once (the poll above stays as the fallback).
  useEffect(() => {
    if (replay) return undefined;
    let timer;
    const channel = supabase.channel(`lf-scenes-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "long_form_scene_images", filter: `project_id=eq.${projectId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(load, 400);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [projectId, load, replay]);

  // A redraw landed -> fade the new picture in and offer Undo for 10 s.
  useEffect(() => {
    if (!data?.scenes || !pendingCount) return;
    const landed = data.scenes.filter((s) => pending[s.number] != null && s.version > pending[s.number] && (s.status === "ready" || s.status === "failed"));
    if (!landed.length) return;
    setPending((p) => { const n = { ...p }; for (const s of landed) delete n[s.number]; return n; });
    setUndoable((u) => { const n = { ...u }; for (const s of landed) if (s.status === "ready") n[s.number] = Date.now() + UNDO_MS; return n; });
  }, [data, pending, pendingCount]);
  useEffect(() => { setUndoable((u) => (Object.values(u).some((until) => until <= now) ? Object.fromEntries(Object.entries(u).filter(([, until]) => until > now)) : u)); }, [now]);

  // The "ready" moment: once per project, the first time the finished review opens.
  useEffect(() => {
    if (!data?.run || data.run.status !== "done" || !data.counts?.scenes) return;
    const k = `zyvo_scenes_celebrated:${projectId}`;
    try { if (!localStorage.getItem(k)) { localStorage.setItem(k, "1"); setCelebrate(true); } } catch { /* storage unavailable */ }
  }, [data?.run, data?.counts?.scenes, projectId]);

  // Embedded (generating screen): the drawing finished -> hand over to the Scenes home.
  useEffect(() => {
    if (embedded && data && !replay && !(data.run && data.run.status !== "done" && !data.run.regenerating)) onDone?.();
  }, [embedded, data, replay, onDone]);

  // Replay (testing): re-plays a finished run's fill at ~8x the measured pace.
  useEffect(() => {
    if (!replay || !data?.scenes?.length) return;
    replayStart.current = Date.now();
    const t = setInterval(() => setReplayN((n) => Math.min(data.scenes.length + 4, n + 1)), 212);
    return () => clearInterval(t);
  }, [replay, data?.scenes?.length]);

  const act = async (scene, action, args = {}) => {
    setBusy(true);
    setNotice(null);
    const r = await updateScene(projectId, action, { sceneNumber: scene?.number, dryRun: action === "text" || action === "undo" ? false : dryRun, ...args });
    setBusy(false);
    if (!r.ok) { setNotice({ tone: "error", text: r.message }); return false; }
    if (r.dryRun) { setNotice({ tone: "info", text: `Test mode: this would draw ${r.scenes} scene${r.scenes === 1 ? "" : "s"} for ${r.credits} credits.` }); return true; }
    if (action === "undo") setUndoable((u) => { const n = { ...u }; delete n[scene.number]; return n; });
    if (["regenerate", "describe"].includes(action) && scene) setPending((p) => ({ ...p, [scene.number]: scene.version ?? 1 }));
    if (action === "regenerate_flagged") setPending((p) => { const n = { ...p }; for (const s of data.scenes) if (s.flagged) n[s.number] = s.version ?? 1; return n; });
    if (action === "text") setNotice({ tone: "ok", text: "On-screen text updated." });
    await load();
    return true;
  };

  const header = <LongFormCreationHeader current="scenes" project={project} stickman />;
  const shell = (children, footer = null) => embedded ? (<><style>{SCENES_CSS}</style>{children}</>) : (
    <div className="mx-auto max-w-[1440px] px-4 py-8 pb-32 lg:px-8 lg:py-10">
      {header}
      <style>{SCENES_CSS}</style>
      {children}
      {footer}
      {viewerIdx != null && data?.scenes?.[viewerIdx] && (
        <SceneViewer
          scenes={data.scenes} index={viewerIdx} onIndex={setViewerIdx} onClose={() => setViewerIdx(null)} credits={data.creditsPerScene} busy={busy} audioUrl={data.audio?.url}
          pending={pending[data.scenes[viewerIdx].number] != null} undoable={undoable[data.scenes[viewerIdx].number] != null}
          onAction={(action, args) => act(data.scenes[viewerIdx], action, args)}
        />
      )}
    </div>
  );
  if (error) return shell(<p className="text-white/60">{error}</p>);
  if (!data) return shell(<div className="zyvo-shimmer h-40 rounded-2xl" />);

  const cardProps = (s, i, drawing) => ({
    scene: s, credits: data.creditsPerScene, active: i === activeIdx, pending: pending[s.number] != null, undoable: undoable[s.number] != null, busy, drawing,
    // Runware balance guard: a waiting scene says so, never just "Drawing…".
    paused: !!data?.drawingPaused,
    // The words jump the player there; the picture (or ⤢) opens the scene viewer.
    onOpen: () => {
      if (!s.imageUrl || drawing) return;
      playerRef.current?.seekTo(s.startMs, true);
      playerBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    onView: () => { if (s.imageUrl || s.status === "failed") setViewerIdx(i); },
    onAction: (action, args) => act(s, action, args),
  });

  // ---------------- Building (live or replay) ----------------
  const building = replay || (data.run && data.run.status !== "done" && !data.run.regenerating);
  if (building) {
    let run = data.run;
    let scenes = data.scenes;
    if (replay) {
      const planning = replayN < 4;
      const drawn = Math.max(0, replayN - 4);
      scenes = data.scenes.map((s, i) => (!planning && i < drawn ? s : { ...s, imageUrl: null, thumbUrl: null, status: "rendering", overlay: null }));
      run = { status: "running", stage: planning ? "beats" : drawn >= data.scenes.length ? "finishing" : "drawing", startedAt: new Date(replayStart.current).toISOString(), total: planning ? 0 : data.scenes.length, drawn, etaSeconds: [Math.round(((data.scenes.length - drawn) * 9.7) / 6), Math.round(((data.scenes.length - drawn) * 12.1) / 6) + 20] };
    }
    const offset = replay ? 0 : offsetRef.current;
    const elapsed = run?.startedAt ? Math.max(0, (now - offset - Date.parse(run.startedAt)) / 1000) : 0;
    const stageIdx = run?.stage === "beats" ? 0 : run?.stage === "drawing" ? 1 : run?.stage === "finishing" ? 2 : 3;
    const total = run?.total || 0;
    const drawn = run?.drawn ?? scenes.filter((s) => s.imageUrl).length;
    const labels = ["Planning scenes", total ? `Drawing (${drawn} of ${total})` : "Drawing", "Finishing"];
    const placeholders = Array.from({ length: 9 }, (_, i) => ({ key: `p${i}`, number: i + 1, startMs: 0, endMs: 0, narration: "…", warnings: [], status: "queued" }));
    return shell(
      <>
        <div className="mb-6">
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white">Building your scenes</h1>
          <p className="mt-1.5 text-[14px] text-white/45">You can leave — we'll notify you when they're ready.{replay ? " (replay)" : ""}</p>
        </div>
        <div className="sticky top-[var(--lf-header-h,64px)] z-20 mb-6 rounded-2xl border border-white/[0.09] bg-[#151719]/95 p-5 backdrop-blur">
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {labels.map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${i < stageIdx ? "bg-lime-300 text-[#11150D]" : i === stageIdx ? "border border-lime-300 text-lime-300" : "border border-white/15 text-white/30"}`}>{i < stageIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                <span className={`text-[13px] font-semibold ${i === stageIdx ? "text-white" : i < stageIdx ? "text-white/60" : "text-white/30"}`}>{l}</span>
                {i < labels.length - 1 && <span className="mx-1 h-px w-6 bg-white/10" />}
              </li>
            ))}
          </ol>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-lime-300 transition-[width] duration-700" style={{ width: `${total ? Math.max(3, Math.round((drawn / total) * 100)) : 4}%` }} />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12.5px] tabular-nums">
            <span data-testid="scenes-counter" className="font-semibold text-white/85">{total ? `${drawn} of ${total} scenes drawn` : "Planning every scene against your voiceover…"}</span>
            {!run?.failed && <span className="text-white/45"><span data-testid="scenes-elapsed">{formatClock(elapsed)} elapsed</span>{run?.etaSeconds?.[1] ? ` · ${formatEta(run.etaSeconds)}` : ""}</span>}
          </div>
          {data?.drawingPaused && (
            <p data-testid="drawing-paused" className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-[13px] text-amber-100"><RotateCw className="h-4 w-4 shrink-0" />Drawing is paused for a moment, your video continues automatically.</p>
          )}
          {run?.failed && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3">
              <p className="flex items-center gap-2 text-[13px] text-red-200"><TriangleAlert className="h-4 w-4" />{run.failed.message}</p>
              <button type="button" onClick={async () => { await startScenes(projectId, { retry: true }); load(); }} className="rounded-lg bg-lime-300 px-3 py-1.5 text-[12.5px] font-bold text-[#11150D]">Retry (free)</button>
            </div>
          )}
        </div>
        {notice && <Notice notice={notice} />}
        <div data-testid="scenes-grid" className={GRID}>
          {(scenes.length ? scenes : placeholders).map((s, i) => <SceneCard key={s.key} {...cardProps(s, i, true)} />)}
        </div>
      </>,
    );
  }

  if (embedded) return null; // the generating screen moves on to the Scenes home

  // ---------------- Review ----------------
  // Failed scenes are redrawn free; only the flagged scenes that did draw are charged.
  const failedFlagged = data.scenes.filter((x) => x.flagged && x.status === "failed").length;
  const flaggedCost = (data.counts.flagged - failedFlagged) * data.creditsPerScene;
  return shell(
    <>
      <div className="sticky top-[var(--lf-header-h,64px)] z-20 -mx-1 mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0f1112]/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-white">Scenes</p>
          <p data-testid="scenes-counts" className="text-[12px] text-white/50">
            {celebrate ? <span className="font-semibold text-lime-300">{data.counts.drawn} of {data.counts.scenes} scenes drawn ✓</span> : `${data.counts.scenes} scenes`}
            {" · "}{data.counts.flagged ? `${data.counts.flagged} need a look` : "nothing flagged"}
          </p>
          {data.drawingPaused && <p data-testid="drawing-paused" className="mt-1 flex items-center gap-1.5 text-[12px] text-amber-100"><RotateCw className="h-3.5 w-3.5 shrink-0" />Drawing is paused for a moment, your video continues automatically.</p>}
        </div>
        {data.counts.flagged > 0 && (
          <button type="button" disabled={busy} onClick={() => act(null, "regenerate_flagged")} className="zyvo-btn-shimmer inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-[12.5px] font-bold text-[#11150D] disabled:opacity-50">
            {flaggedCost === 0
              ? <><RotateCw className="h-4 w-4" />Try again (free) · {failedFlagged}</>
              : <><Sparkles className="h-4 w-4" />Regenerate flagged <span className="inline-flex items-center gap-0.5 rounded bg-black/10 px-1"><Coins className="h-3 w-3" />{flaggedCost}</span>{failedFlagged > 0 && <span className="text-[11px] font-semibold opacity-70">· {failedFlagged} free</span>}</>}
          </button>
        )}
      </div>
      {notice && <Notice notice={notice} />}

      <section ref={playerBoxRef} className="mb-8 scroll-mt-[calc(var(--lf-header-h,64px)+84px)]">
        <h1 className="mb-3 text-[24px] font-bold tracking-[-0.02em] text-white lg:text-[28px]">Your video is ready to watch</h1>
        <div className="mx-auto max-w-[1100px]">
          <StickmanPlayer ref={playerRef} scenes={data.scenes} audioUrl={data.audio?.url} durationSeconds={data.audio?.durationSeconds} onSceneChange={setActiveIdx} glow={celebrate} />
        </div>
      </section>

      <div data-testid="scenes-list" className={GRID}>
        {(showAll ? data.scenes : data.scenes.slice(0, 12)).map((s, i) => <SceneCard key={s.key} {...cardProps(s, i, false)} />)}
      </div>
    </>,
    <LongFormActionFooter secondaryLabel="Idea" onSecondary={() => navigate(`/long-form/project/${projectId}/idea`)} primaryLabel="Continue to Edit" onPrimary={() => navigate(`/long-form/project/${projectId}/edit`)} maxWidthClassName="max-w-[1440px]" />,
  );
}
