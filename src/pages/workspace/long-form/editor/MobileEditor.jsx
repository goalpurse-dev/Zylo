// MobileEditor.jsx — Phase 6d-1. The Edit step on phones (< 768 px), CapCut
// style: a slim top bar (back · Edit · Publish), the full-width 16:9 preview
// (tap = play/pause), a control row, a timeline with a CENTRED fixed playhead
// (swipe to scrub, pinch to zoom), and an icon toolbar right above the app's
// bottom nav. Every tool opens a bottom sheet; selecting a scene or a text
// swaps the toolbar for its context actions. Same document, same actions as
// the desktop editor (edit.jsx owns the state).
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Captions, Clapperboard, Copy, Film, ImageUp, Maximize2, Mic, Music, Pause, Pencil, Play, Redo2, RefreshCw, Scissors, Shuffle, Trash2, Type, Undo2, X } from "lucide-react";
import { MOTION_ICONS } from "./EditorTimeline";
import EditorPreview from "./EditorPreview";
import TransitionPicker, { MotionPicker } from "./TransitionPicker";
import { LeftPanel, RightPanel } from "./EditorPanels";
import { thumbOf } from "./editApi";
import { transitionInto, newId, TRANSITIONS } from "../../../../lib/stickmanEdit";

const NAV_H = "calc(78px + env(safe-area-inset-bottom))"; // the app's bottom nav
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Sheet({ title, onClose, children }) {
  const [dy, setDy] = useState(0);
  const start = (e) => {
    const y0 = e.clientY;
    const move = (ev) => setDy(Math.max(0, ev.clientY - y0));
    const up = (ev) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); if (ev.clientY - y0 > 80) onClose(); else setDy(0); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="fixed inset-x-0 top-0 z-[80]" style={{ bottom: NAV_H }} data-testid="mobile-sheet">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[60vh] flex-col rounded-t-2xl border-t border-white/10 bg-[#15181a] shadow-2xl" style={{ transform: `translateY(${dy}px)` }}>
        <div className="flex shrink-0 touch-none flex-col items-center pt-2" onPointerDown={start}>
          <span className="h-1.5 w-10 rounded-full bg-white/25" />
          <div className="flex w-full items-center justify-between px-4 py-2">
            <span className="text-[14px] font-bold text-white">{title}</span>
            <button type="button" aria-label="Close" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-white/60"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">{children}</div>
      </div>
    </div>
  );
}

// The timeline: the playhead stays in the middle; the tracks move under it.
function MobileTimeline({ doc, clips, phrases, peaks, t, onSeek, selection, onSelect, onScrubStart }) {
  const ref = useRef(null);
  const canvasRef = useRef(null);
  const [W, setW] = useState(360);
  const [pxPerS, setPxPerS] = useState(46);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); return () => ro.disconnect(); }, []);
  const dur = doc.audio.durationMs / 1000;
  const x = (s) => W / 2 + (s - t) * pxPerS;
  const vis = (a, b) => x(b) >= -40 && x(a) <= W + 40;
  const rows = [
    { key: "scenes", icon: Film, h: 50 },
    { key: "text", icon: Type, h: 30 },
    ...(doc.captions?.enabled ? [{ key: "captions", icon: Captions, h: 22 }] : []),
    { key: "voice", icon: Mic, h: 34 },
    ...(doc.music?.url ? [{ key: "music", icon: Music, h: 22 }] : []),
  ];
  // Pointers: one = scrub (a tap selects what's under it), two = pinch zoom.
  const ptrs = useRef(new Map());
  const gesture = useRef(null);
  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) { gesture.current = { kind: "scrub", x0: e.clientX, t0: t, moved: false, target: e.target }; onScrubStart?.(); }
    if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), z0: pxPerS }; }
  };
  const onMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" && ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; setPxPerS(Math.max(6, Math.min(240, (g.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, g.d0)))); return; }
    if (g.kind === "scrub") { const dx = e.clientX - g.x0; if (Math.abs(dx) > 6) g.moved = true; if (g.moved) onSeek(Math.max(0, Math.min(dur, g.t0 - dx / pxPerS)) * 1000); }
  };
  const onUp = (e) => {
    const g = gesture.current;
    ptrs.current.delete(e.pointerId);
    if (g?.kind === "scrub" && !g.moved) {
      const hit = g.target?.closest?.("[data-sel]");
      if (hit) { const [kind, id] = hit.getAttribute("data-sel").split(":"); onSelect({ kind, id }); } else onSelect(null);
    }
    if (!ptrs.current.size) gesture.current = null;
  };
  // Waveform: only the visible seconds are drawn.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !peaks?.length) return;
    c.width = Math.round(W); c.height = 34;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, 34);
    g.fillStyle = "rgba(190,242,100,0.55)";
    for (let px = 0; px < c.width; px++) {
      const s = t + (px - W / 2) / pxPerS;
      if (s < 0 || s > dur) continue;
      const h = Math.max(1, (peaks[Math.floor((s / dur) * peaks.length)] ?? 0) * 30);
      g.fillRect(px, (34 - h) / 2, 1, h);
    }
  }, [peaks, W, t, pxPerS, dur]);
  let top = 0;
  return (
    <div ref={ref} data-testid="mobile-timeline" className="relative min-h-0 flex-1 touch-none select-none overflow-hidden bg-[#0e1012]" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {rows.map((row) => {
        const y = top; top += row.h + 4;
        return (
          <div key={row.key} className="absolute inset-x-0" style={{ top: y + 8, height: row.h }} data-testid={`mtrack-${row.key}`}>
            {row.key === "scenes" && clips.map((c, i) => vis(c.startMs / 1000, c.endMs / 1000) && (
              <div key={c.id} data-sel={`clip:${c.id}`} className={`absolute top-0 h-full overflow-hidden rounded-md border ${selection?.kind === "clip" && selection.id === c.id ? "border-2 border-lime-300" : c.needsImage ? "border-amber-300/70" : "border-white/15"} bg-[#1b1f22]`} style={{ left: x(c.startMs / 1000), width: Math.max(2, (c.endMs - c.startMs) / 1000 * pxPerS - 2) }}>
                <img src={thumbOf(c.image, 160, c.imageVersion)} alt="" draggable={false} className="pointer-events-none h-full w-auto max-w-none object-contain" />
                <span className="pointer-events-none absolute bottom-0 left-1 text-[9px] font-bold text-white/70">{i + 1}</span>
                {MOTION_ICONS[c.motion] && (() => { const Icon = MOTION_ICONS[c.motion]; return <span className="pointer-events-none absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-sm bg-black/60 text-white/80"><Icon className="h-2.5 w-2.5" /></span>; })()}
              </div>
            ))}
            {row.key === "scenes" && clips.map((c, i) => i > 0 && vis(c.startMs / 1000, c.startMs / 1000) && (
              <span key={`m-${c.id}`} data-sel={`cut:${c.id}`} className="absolute top-1/2 z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center" style={{ left: x(c.startMs / 1000) }}>
                <span className={`h-3 w-3 rotate-45 rounded-[2px] border ${selection?.kind === "cut" && selection.id === c.id ? "border-white bg-lime-300" : transitionInto(doc, c, i) !== "cut" ? "border-lime-200 bg-lime-400" : "border-white/40 bg-[#2a2f33]"}`} />
              </span>
            ))}
            {row.key === "text" && doc.texts.map((it) => vis(it.startMs / 1000, it.endMs / 1000) && (
              <div key={it.id} data-sel={`text:${it.id}`} className={`absolute top-0 flex h-full items-center overflow-hidden rounded-md border px-1.5 text-[10px] font-bold ${selection?.kind === "text" && selection.id === it.id ? "border-lime-300 bg-lime-300/25 text-lime-100" : "border-amber-300/40 bg-amber-300/15 text-amber-100"}`} style={{ left: x(it.startMs / 1000), width: Math.max(8, (it.endMs - it.startMs) / 1000 * pxPerS) }}>
                <span className="pointer-events-none truncate">{it.text}</span>
              </div>
            ))}
            {row.key === "captions" && phrases.map((p, k) => vis(p.startMs / 1000, p.endMs / 1000) && <div key={k} data-sel="captions:all" className="absolute top-0 h-full rounded bg-sky-300/20" style={{ left: x(p.startMs / 1000), width: Math.max(2, (p.endMs - p.startMs) / 1000 * pxPerS - 1) }} />)}
            {row.key === "voice" && <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />}
            {row.key === "music" && <div data-sel="music:all" className="absolute top-0 h-full rounded bg-fuchsia-300/15 px-2 text-[10px] leading-[22px] text-fuchsia-100" style={{ left: x(0), width: dur * pxPerS }}>{doc.music.name ?? "Music"}</div>}
            <span className="pointer-events-none absolute left-0 top-0 z-20 grid h-full w-8 place-items-center bg-gradient-to-r from-[#0e1012] via-[#0e1012]/90 to-transparent text-white/45"><row.icon className="h-3.5 w-3.5" /></span>
          </div>
        );
      })}
      <div className="pointer-events-none absolute bottom-0 top-0 z-30 w-0.5 -translate-x-1/2 bg-white" style={{ left: "50%" }} data-testid="mobile-playhead"><span className="absolute -left-[5px] -top-0.5 h-3 w-3 rotate-45 bg-white" /></div>
    </div>
  );
}

const TOOLS = [{ key: "Text", icon: Type }, { key: "Captions", icon: Captions }, { key: "Audio", icon: Music }, { key: "Motion", icon: Clapperboard }];

export default function MobileEditor(p) {
  const { doc, clips, t, playing, toggle, seek, undo, redo, canUndo, canRedo, phrases, peaks, selection, setSelection, actions, meta, busy, onAddText, onUploadMusic, onMoveText, onBack, onPublish, saveState } = p;
  const [sheet, setSheet] = useState(null);
  const fileRef = useRef(null);
  const boxRef = useRef(null);
  const selClip = selection?.kind === "clip" ? clips.find((c) => c.id === selection.id) : null;
  const selIndex = selClip ? clips.indexOf(selClip) : -1;
  const selText = selection?.kind === "text" ? doc.texts.find((x) => x.id === selection.id) : null;
  const cutIndex = selection?.kind === "cut" ? clips.findIndex((c) => c.id === selection.id) : -1;
  useEffect(() => { if (selection?.kind === "cut") setSheet("Transitions"); if (selection?.kind === "captions") setSheet("Captions"); if (selection?.kind === "music") setSheet("Audio"); }, [selection]);
  const pickTransitionFor = useMemo(() => (cutIndex > 0 ? clips[cutIndex] : selIndex > 0 ? clips[selIndex] : null), [cutIndex, selIndex, clips]);

  const tap = useRef(null);
  const previewDown = (e) => { tap.current = { x: e.clientX, y: e.clientY, onText: !!e.target.closest?.("[data-testid=preview-text]") }; };
  const previewUp = (e) => { const s = tap.current; tap.current = null; if (s && !s.onText && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) toggle(); };
  const fullscreen = () => { const el = boxRef.current; if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else el?.requestFullscreen?.().catch(() => {}); };
  const splitSelected = () => { if (selClip && (t * 1000 < selClip.startMs || t * 1000 >= selClip.endMs)) seek((selClip.startMs + selClip.endMs) / 2); setTimeout(() => actions.onSplit(), 0); };
  const duplicateText = () => { const it = selText; const len = it.endMs - it.startMs; const copy = { ...it, id: newId("txt"), startMs: it.endMs, endMs: Math.min(doc.audio.durationMs, it.endMs + len) }; actions.commitDoc({ ...doc, texts: [...doc.texts, copy] }); setSelection({ kind: "text", id: copy.id }); };

  const Tool = ({ icon: Icon, label, onClick, testid, danger }) => (
    <button type="button" data-testid={testid} onClick={onClick} className={`flex min-h-[52px] min-w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[10.5px] font-semibold ${danger ? "text-red-300" : "text-white/80"} active:bg-white/10`}>
      <Icon className="h-5 w-5" />{label}
    </button>
  );

  return (
    <div data-testid="mobile-editor" className="flex flex-col bg-[#0b0d0e]" style={{ height: `calc(100dvh - var(--zyvo-content-top, 56px) - ${NAV_H})` }}>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/[0.06] px-1">
        <button type="button" aria-label="Back to Scenes" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full text-white/80"><ArrowLeft className="h-5 w-5" /></button>
        <span className="flex-1 text-[15px] font-bold text-white">Edit <span className="ml-1 text-[11px] font-medium text-white/35">{saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : "Saving…"}</span></span>
        <button type="button" data-testid="mobile-publish" onClick={onPublish} className="mr-1 h-9 min-h-[44px] rounded-full bg-lime-300 px-4 text-[13px] font-bold text-[#11150D]">Publish</button>
      </div>
      <div ref={boxRef} className="shrink-0 bg-black" onPointerDown={previewDown} onPointerUp={previewUp}>
        <EditorPreview doc={doc} clips={clips} t={t} phrases={phrases} selectedTextId={selText?.id}
          onSelectText={(id) => id && setSelection({ kind: "text", id })} onMoveText={onMoveText} />
      </div>
      <div className="flex h-12 shrink-0 items-center justify-between px-2 text-white/75">
        <div className="flex">
          <button type="button" aria-label="Undo" disabled={!canUndo} onClick={undo} className="grid h-11 w-11 place-items-center rounded-full disabled:opacity-30"><Undo2 className="h-5 w-5" /></button>
          <button type="button" aria-label="Redo" disabled={!canRedo} onClick={redo} className="grid h-11 w-11 place-items-center rounded-full disabled:opacity-30"><Redo2 className="h-5 w-5" /></button>
        </div>
        <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={toggle} className="grid h-11 w-11 place-items-center rounded-full bg-lime-300 text-[#11150D]">{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}</button>
        <span className="w-[92px] text-center text-[12px] tabular-nums">{fmt(t)} / {fmt(doc.audio.durationMs / 1000)}</span>
        <button type="button" aria-label="Full screen" onClick={fullscreen} className="grid h-11 w-11 place-items-center rounded-full"><Maximize2 className="h-5 w-5" /></button>
      </div>
      <MobileTimeline doc={doc} clips={clips} phrases={phrases} peaks={peaks} t={t} onSeek={seek} selection={selection} onSelect={setSelection} />
      {/* The toolbar, right above the app's bottom nav; a selection swaps in its actions. */}
      <div data-testid="mobile-toolbar" className="flex h-16 shrink-0 items-center gap-1 overflow-x-auto border-t border-white/[0.08] bg-[#121416] px-1">
        {selClip ? (
          <>
            <button type="button" aria-label="Back to tools" data-testid="context-close" onClick={() => setSelection(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/70"><X className="h-5 w-5" /></button>
            <Tool icon={Scissors} label="Split" testid="ctx-split" onClick={splitSelected} />
            <Tool icon={Clapperboard} label="Motion" testid="ctx-motion" onClick={() => setSheet("SceneMotion")} />
            <Tool icon={Shuffle} label="Transition" testid="ctx-transition" onClick={() => setSheet("Transitions")} />
            <Tool icon={ImageUp} label="Replace" testid="ctx-replace" onClick={() => fileRef.current?.click()} />
            <Tool icon={RefreshCw} label={selClip.needsImage ? "Generate" : "Regenerate"} testid="ctx-regenerate" onClick={() => (selClip.needsImage ? actions.onGenerateSplit(selClip) : actions.onRegenerate(selClip))} />
            <Tool icon={Trash2} label="Delete" testid="ctx-delete" danger onClick={() => actions.onDeleteClip(selClip.id)} />
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && actions.onUploadImage(selClip, e.target.files[0])} />
          </>
        ) : selText ? (
          <>
            <button type="button" aria-label="Back to tools" data-testid="context-close" onClick={() => setSelection(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/70"><X className="h-5 w-5" /></button>
            <Tool icon={Pencil} label="Edit" testid="ctx-edit" onClick={() => setSheet("EditText")} />
            <Tool icon={Type} label="Style" testid="ctx-style" onClick={() => setSheet("EditText")} />
            <Tool icon={Copy} label="Duplicate" testid="ctx-duplicate" onClick={duplicateText} />
            <Tool icon={Trash2} label="Delete" testid="ctx-delete" danger onClick={() => actions.onDeleteText(selText.id)} />
          </>
        ) : TOOLS.map((tool) => <Tool key={tool.key} icon={tool.icon} label={tool.key} testid={`tool-${tool.key.toLowerCase()}`} onClick={() => setSheet(tool.key)} />)}
      </div>

      {sheet === "Transitions" && (
        <Sheet title={pickTransitionFor ? `Transition into scene ${clips.indexOf(pickTransitionFor) + 1}` : "Transitions · all cuts"} onClose={() => { setSheet(null); if (selection?.kind === "cut") setSelection(null); }}>
          <div className="px-4">
            {pickTransitionFor
              ? <TransitionPicker a={clips[clips.indexOf(pickTransitionFor) - 1]?.image} b={pickTransitionFor.image} value={transitionInto(doc, pickTransitionFor, clips.indexOf(pickTransitionFor))} onPick={(k) => actions.onTransitionCut(pickTransitionFor.id, k)} onApplyAll={actions.onApplyAll} onAutoMix={actions.onAutoMix} />
              : <TransitionPicker scope="all" value={null} onPick={actions.onApplyAll} onApplyAll={actions.onApplyAll} onAutoMix={actions.onAutoMix} />}
            {pickTransitionFor == null && selClip && selIndex === 0 && <p className="mt-2 text-[11.5px] text-white/45">The first scene has no cut before it.</p>}
          </div>
        </Sheet>
      )}
      {sheet === "EditText" && selText && (
        <Sheet title="Text" onClose={() => setSheet(null)}>
          <RightPanel doc={doc} clips={clips} selection={selection} text={selText} t={t} phrases={phrases} words={[]} {...actions} />
        </Sheet>
      )}
      {["Text", "Captions", "Audio", "Motion"].includes(sheet) && (
        <Sheet title={sheet} onClose={() => { setSheet(null); if (["captions", "music"].includes(selection?.kind)) setSelection(null); }}>
          <LeftPanel bare tab={sheet} setTab={() => {}} doc={doc} clips={clips} t={t} busy={busy} {...actions}
            onAddText={(style) => { onAddText(style); setSheet(null); }} onUploadMusic={onUploadMusic} />
        </Sheet>
      )}
      {sheet === "SceneMotion" && selClip && (
        <Sheet title={`Camera move · scene ${selIndex + 1}`} onClose={() => setSheet(null)}>
          <div className="px-4"><MotionPicker testid="scene-motion" value={selClip.motionManual ? selClip.motion : "mix"} image={selClip.image} onPick={(m) => actions.onClipMotion(selClip.id, m)} /></div>
        </Sheet>
      )}
      {TRANSITIONS && null}
    </div>
  );
}
