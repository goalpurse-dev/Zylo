import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FOCUS, cx } from "../../../ui/zyvo";

/**
 * A scene's picture or clip, big. Swipe (or the arrows, or the arrow keys) moves between the scenes that
 * have something to show; Escape, the cross or a tap beside the picture closes it.
 * scenes: the story's scenes; index: the open scene's index in that list.
 */
export default function SceneViewer({ scenes, index, byId, aspect = "9:16", onIndex, onClose }) {
  const shown = scenes.map((s, i) => ({ s, i })).filter(({ s }) => s.imageUrl || s.clipUrl);
  const at = Math.max(0, shown.findIndex(({ i }) => i === index));
  const scene = shown[at]?.s;
  const closeRef = useRef(null);
  const touch = useRef(null);
  const go = useCallback((step) => { const next = shown[at + step]; if (next) onIndex(next.i); }, [shown, at, onIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);
  useEffect(() => { closeRef.current?.focus(); }, []);

  if (!scene) return null;
  const speaker = byId(scene.speakerId)?.name.split(" ")[0] ?? "";
  const isClip = scene.clipStatus === "ready" && scene.clipUrl;
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };
  const arrow = "absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-white transition hover:bg-black/75 disabled:opacity-25";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Scene ${scene.index + 1} of ${scenes.length}, ${isClip ? "clip" : "picture"}`}
      className="fixed inset-0 z-[200] flex flex-col bg-black/92 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <p className="text-[12px] font-black tabular-nums text-white/80">Scene {scene.index + 1} <span className="font-semibold text-white/40">of {scenes.length}</span></p>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className={cx("grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.12]", FOCUS)}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <button type="button" onClick={() => go(-1)} disabled={at === 0} aria-label="Previous scene" className={cx(arrow, "left-2", FOCUS)}><ChevronLeft className="h-6 w-6" aria-hidden="true" /></button>
        {isClip ? (
          <video key={scene.clipUrl} src={scene.clipUrl} poster={scene.imageUrl ?? undefined} controls autoPlay playsInline className={cx("max-h-full max-w-full rounded-2xl bg-black object-contain", aspect === "16:9" ? "aspect-video" : "aspect-[9/16]")} aria-label={`Clip ${scene.index + 1}: ${speaker} says ${scene.line}`} />
        ) : (
          <img key={scene.imageUrl} src={scene.imageUrl} alt={`Scene ${scene.index + 1}: ${speaker} says ${scene.line}`} className={cx("max-h-full max-w-full rounded-2xl object-contain", aspect === "16:9" ? "aspect-video" : "aspect-[9/16]")} />
        )}
        <button type="button" onClick={() => go(1)} disabled={at === shown.length - 1} aria-label="Next scene" className={cx(arrow, "right-2", FOCUS)}><ChevronRight className="h-6 w-6" aria-hidden="true" /></button>
      </div>

      <p className="shrink-0 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 text-center text-[13px] font-semibold leading-relaxed text-white/85">
        <span className="font-black text-white">{speaker}: </span>{scene.line}
      </p>
    </div>
  );
}
