// SceneViewer.jsx — Phase 6c-polish 2. The full-size view of one scene: the
// whole 16:9 image fitted to the screen (never cropped) on a dark backdrop,
// its text layer on top, "Scene 12 · 0:31–0:33", the narration line and the
// summary — and the actions right there: Regenerate (lime, credits inside),
// Edit description, Edit text, ▶ play this scene (audio from its start to its
// end), Undo after a regenerate. ← / → (buttons and arrow keys) move between
// scenes; Esc or ✕ closes.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Coins, Pause, PenLine, Play, RotateCw, TriangleAlert, Type, Undo2, X } from "lucide-react";
import { OverlayLayer } from "./sceneVisuals";
import { formatSceneTime } from "./scenes";

export default function SceneViewer({ scenes, index, onIndex, onClose, credits, busy, pending, undoable, audioUrl, onAction }) {
  const scene = scenes[index];
  const [mode, setMode] = useState(null); // null | "describe" | "text"
  const [draft, setDraft] = useState("");
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setMode(null); setLoaded(false); audioRef.current?.pause(); }, [index]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < scenes.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, scenes.length, onClose, onIndex]);
  useEffect(() => () => audioRef.current?.pause(), []);
  if (!scene) return null;

  // ▶ this scene only: from its start, stopping at its end.
  const playScene = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); return; }
    a.currentTime = scene.startMs / 1000;
    a.play().catch(() => {});
  };
  const drawing = pending || scene.status === "queued" || scene.status === "rendering";

  return (
    <div data-testid="scene-viewer" className="fixed inset-0 z-[120] flex flex-col bg-[#050606]/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Scene ${scene.number}`}>
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3">
        <p data-testid="scene-viewer-title" className="text-[14px] font-semibold tabular-nums text-white">Scene {scene.number} · {formatSceneTime(scene.startMs)}–{formatSceneTime(scene.endMs)} <span className="font-normal text-white/40">of {scenes.length}</span></p>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-4 w-4" /></button>
      </div>

      {/* The image: the whole 16:9 frame, fitted to what's left of the screen. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 sm:px-20">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black" style={{ width: "min(100%, calc((100vh - 290px) * 16 / 9))" }}>
          {scene.imageUrl ? (
            <>
              <img src={scene.imageUrl} alt="" onLoad={() => setLoaded(true)} className={`absolute inset-0 h-full w-full object-contain transition-[opacity,filter] duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${pending ? "blur-sm" : ""}`} />
              {loaded && <OverlayLayer layer={scene.overlay} />}
              {(pending || !loaded) && <div className="zyvo-shimmer absolute inset-0" />}
            </>
          ) : <div className="zyvo-shimmer absolute inset-0" />}
          {undoable && (
            <button type="button" onClick={() => onAction("undo")} className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
          )}
        </div>
        <button type="button" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Previous scene" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25 sm:left-5"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" disabled={index === scenes.length - 1} onClick={() => onIndex(index + 1)} aria-label="Next scene" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-25 sm:right-5"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* The scene's words + actions. */}
      <div className="mx-auto w-full max-w-[1100px] shrink-0 px-5 pb-5 pt-4">
        <p className="line-clamp-2 text-[15px] leading-snug text-white">“{scene.narration}”</p>
        {scene.summary && <p className="mt-1 line-clamp-1 text-[12.5px] text-white/50">{scene.summary}</p>}
        {scene.warnings?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">{scene.warnings.map((w) => <span key={w} className="inline-flex items-center gap-1 rounded-full bg-red-400/10 px-2 py-0.5 text-[11px] font-semibold text-red-200"><TriangleAlert className="h-3 w-3" />{w}</span>)}</div>
        )}
        {mode ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={mode === "text" ? "On-screen words (up to 5) — empty for none" : "Describe what you want to see…"}
              className="min-w-[240px] flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-lime-300/40" />
            <button type="button" disabled={busy} onClick={async () => { if (await onAction(mode === "text" ? "text" : "describe", mode === "text" ? { text: draft } : { description: draft })) setMode(null); }}
              className="zyvo-btn-shimmer inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-4 py-2 text-[13px] font-bold text-[#11150D] disabled:opacity-50">
              {mode === "text" ? "Save · free" : <>Regenerate <Coins className="h-3.5 w-3.5" />{credits}</>}
            </button>
            <button type="button" onClick={() => setMode(null)} className="px-2 text-[12.5px] text-white/50 hover:text-white">Cancel</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || drawing} onClick={() => onAction("regenerate")} data-testid="viewer-regenerate"
              className="zyvo-btn-shimmer inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-4 py-2 text-[13px] font-bold text-[#11150D] hover:bg-lime-200 disabled:opacity-50">
              {drawing ? <RotateCw className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}{drawing ? "Drawing…" : "Regenerate"} <span className="inline-flex items-center gap-0.5 rounded bg-black/10 px-1"><Coins className="h-3.5 w-3.5" />{credits}</span>
            </button>
            <button type="button" disabled={drawing} onClick={() => { setDraft(scene.summary ?? ""); setMode("describe"); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[13px] font-semibold text-white/80 hover:border-white/30 hover:text-white disabled:opacity-40"><PenLine className="h-4 w-4" />Edit description</button>
            <button type="button" disabled={drawing || !scene.imageUrl} onClick={() => { setDraft(scene.overlayText ?? ""); setMode("text"); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[13px] font-semibold text-white/80 hover:border-white/30 hover:text-white disabled:opacity-40"><Type className="h-4 w-4" />Edit text</button>
            <button type="button" onClick={playScene} data-testid="viewer-play" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[13px] font-semibold text-white/80 hover:border-white/30 hover:text-white">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? "Pause" : "Play this scene"}</button>
            {undoable && <button type="button" onClick={() => onAction("undo")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[13px] font-semibold text-white/80 hover:border-white/30 hover:text-white"><Undo2 className="h-4 w-4" />Undo</button>}
          </div>
        )}
      </div>
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => { if (e.currentTarget.currentTime * 1000 >= scene.endMs) e.currentTarget.pause(); }} />
      )}
    </div>
  );
}
