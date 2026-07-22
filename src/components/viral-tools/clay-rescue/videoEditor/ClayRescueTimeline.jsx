import { useEffect, useRef, useState } from "react";
import { X, GripVertical } from "lucide-react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ClipThumb({ videoUrl }) {
  return (
    <video
      src={videoUrl}
      className="absolute inset-0 h-full w-full object-cover"
      muted
      preload="metadata"
      onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1; }}
    />
  );
}

/** One clip block: draggable (reorder) with its own trim-start / trim-end handles. */
function ClipBlock({ clip, index, dragOverIndex, onDragStart, onDragOver, onDrop, onDragEnd, onTrimDragStart, onDelete }) {
  const pct = (t) => (clip.duration > 0 ? (t / clip.duration) * 100 : 0);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(index); }}
      onDragEnd={onDragEnd}
      className={`relative h-full w-[110px] shrink-0 cursor-grab overflow-hidden rounded-lg border bg-black transition active:cursor-grabbing ${
        dragOverIndex === index ? "border-[#A87AFF] ring-2 ring-[#A87AFF]/50" : "border-white/10"
      }`}
    >
      <ClipThumb videoUrl={clip.videoUrl} />
      <div className="absolute inset-0 bg-black/25" />

      {/* Dimmed regions outside the trim range */}
      <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${pct(clip.trimStart)}%` }} />
      <div className="absolute inset-y-0 right-0 bg-black/60" style={{ width: `${100 - pct(clip.trimEnd)}%` }} />

      {/* Trim handles */}
      <button
        type="button"
        onMouseDown={onTrimDragStart(clip.id, "start")}
        onTouchStart={onTrimDragStart(clip.id, "start")}
        className="absolute bottom-0 top-0 z-10 w-2.5 cursor-ew-resize bg-white/70 hover:bg-white"
        style={{ left: `calc(${pct(clip.trimStart)}% - 5px)` }}
        title="Trim start"
      />
      <button
        type="button"
        onMouseDown={onTrimDragStart(clip.id, "end")}
        onTouchStart={onTrimDragStart(clip.id, "end")}
        className="absolute bottom-0 top-0 z-10 w-2.5 cursor-ew-resize bg-white/70 hover:bg-white"
        style={{ left: `calc(${pct(clip.trimEnd)}% - 5px)` }}
        title="Trim end"
      />

      <div className="absolute left-1 top-1 z-20 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white/70">
        <GripVertical className="h-2.5 w-2.5" /> {index + 1}
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(clip.id); }}
        className="absolute right-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/70 transition hover:bg-red-500/80 hover:text-white"
        title="Remove clip"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="absolute bottom-1 left-1/2 z-20 -translate-x-1/2 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white/70">
        {(clip.trimEnd - clip.trimStart).toFixed(1)}s
      </div>
    </div>
  );
}

export default function ClayRescueTimeline({ clips, onReorder, onTrim, onDelete }) {
  const containerRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [trimDrag, setTrimDrag] = useState(null); // { clipId, edge }

  const onDragStart = (index) => setDragIndex(index);
  const onDragOver = (index) => setDragOverIndex(index);
  const onDrop = (index) => {
    if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const onDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  const onTrimDragStart = (clipId, edge) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setTrimDrag({ clipId, edge });
  };

  useEffect(() => {
    if (!trimDrag) return;
    const clip = clips.find((c) => c.id === trimDrag.clipId);
    if (!clip) return;

    const move = (e) => {
      const point = e.touches ? e.touches[0] : e;
      const blockEl = containerRef.current?.querySelector(`[data-clip-id="${trimDrag.clipId}"]`);
      if (!blockEl) return;
      const rect = blockEl.getBoundingClientRect();
      const pct = clamp((point.clientX - rect.left) / rect.width, 0, 1);
      const t = pct * clip.duration;

      if (trimDrag.edge === "start") {
        onTrim(clip.id, { trimStart: clamp(t, 0, clip.trimEnd - 0.3) });
      } else {
        onTrim(clip.id, { trimEnd: clamp(t, clip.trimStart + 0.3, clip.duration) });
      }
    };
    const up = () => setTrimDrag(null);

    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [trimDrag, clips, onTrim]);

  if (!clips.length) return null;

  return (
    <div className="max-h-[200px] rounded-2xl border border-white/[0.07] bg-[#111315] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Edit clips</p>
        <p className="text-[10px] text-white/25">Drag to reorder · drag edges to trim · ✕ to remove</p>
      </div>
      <div
        ref={containerRef}
        className="flex h-[140px] gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent]"
      >
        {clips.map((clip, i) => (
          <div key={clip.id} data-clip-id={clip.id} className="h-full shrink-0">
            <ClipBlock
              clip={clip}
              index={i}
              dragOverIndex={dragOverIndex}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onTrimDragStart={onTrimDragStart}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
