// EditorTimeline.jsx — Phase 6d-1. The bottom timeline: Text · Captions ·
// Scenes · Voiceover (waveform) · Music, a playhead, zoom, and snapping (to
// words, cuts and the playhead). Drag the line between two scenes to move the
// cut (snaps to a word, min 1.5 s each side); drag a text block to move it or
// its ends to trim it. Drags preview live and commit ONE undo step on release.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Captions, Film, Mic, Music, Square, Type, ZoomIn, ZoomOut } from "lucide-react";
// The camera move of each scene, shown on its clip.
export const MOTION_ICONS = { push_in: ZoomIn, pull_out: ZoomOut, pan_left: ArrowLeft, pan_right: ArrowRight, hold: Square };
import { snapMs, snapTargets, transitionInto, TEXT_STYLE_LABELS, TRANSITIONS } from "../../../../lib/stickmanEdit";
import { thumbOf } from "./editApi";

const LABEL_W = 92;
// Ctrl on Windows/Linux, ⌘ on a Mac.
const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
const ROWS = [
  { key: "text", label: "Text", icon: Type, h: 34 },
  { key: "captions", label: "Captions", icon: Captions, h: 26 },
  { key: "scenes", label: "Scenes", icon: Film, h: 58 },
  { key: "voice", label: "Voiceover", icon: Mic, h: 40 },
  { key: "music", label: "Music", icon: Music, h: 26 },
];
const fmt = (ms) => { const s = Math.max(0, ms / 1000); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };

function Waveform({ peaks, widthPx, height }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !peaks?.length) return;
    const w = Math.min(32000, Math.max(1, Math.round(widthPx)));
    c.width = w; c.height = height;
    const g = c.getContext("2d");
    g.clearRect(0, 0, w, height);
    g.fillStyle = "rgba(190,242,100,0.55)";
    for (let x = 0; x < w; x++) {
      const p = peaks[Math.floor((x / w) * peaks.length)] ?? 0;
      const h = Math.max(1, p * (height - 4));
      g.fillRect(x, (height - h) / 2, 1, h);
    }
  }, [peaks, widthPx, height]);
  return <canvas ref={ref} className="absolute left-0 top-0" style={{ width: widthPx, height }} />;
}

export default function EditorTimeline({ doc, clips, words, phrases, peaks, t, onSeek, zoom, setZoom, selection, onSelect, onMoveCut, onUpdateText, musicName, playing = false }) {
  // Follow the playhead only until the user scrolls; Play, clicking the ruler
  // or a clip, or "Follow playhead" turns it back on. The user's intent is read
  // from the INPUT (wheel, touch, a press on the scrollbar) — never from scroll
  // events, which the browser merges with our own follow-scrolls.
  const [follow, setFollow] = useState(true);
  const stopFollow = () => setFollow(false);
  useEffect(() => { if (playing) setFollow(true); }, [playing]);
  const scrollRef = useRef(null);
  const [drag, setDrag] = useState(null); // live preview of a drag
  const [scrollX, setScrollX] = useState(0); // re-render (and re-cull) on every scroll
  const durMs = doc.audio.durationMs;
  const [viewW, setViewW] = useState(900);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth - LABEL_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pxPerMs = (viewW / durMs) * zoom;
  const widthPx = durMs * pxPerMs;
  const x = (ms) => ms * pxPerMs;
  const msAt = (clientX) => { const r = scrollRef.current.getBoundingClientRect(); return Math.max(0, Math.min(durMs, (clientX - r.left - LABEL_W + scrollRef.current.scrollLeft) / pxPerMs)); };
  const playMs = t * 1000;
  // Keep the playhead in view — only while following (never fights the user's scroll).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !follow) return;
    const px = x(playMs);
    if (px < el.scrollLeft || px > el.scrollLeft + el.clientWidth - LABEL_W - 40) { const to = Math.min(el.scrollWidth - el.clientWidth, Math.max(0, px - 120)); if (Math.abs(to - el.scrollLeft) > 1) el.scrollLeft = to; }
  }, [Math.floor(playMs / 250), zoom, follow]); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = (e) => setScrollX(e.currentTarget.scrollLeft);

  const within = 8 / pxPerMs; // snap radius: 8 px on screen
  const startCutDrag = (index) => (e) => {
    e.stopPropagation(); e.preventDefault();
    const clip = clips[index];
    const x0 = e.clientX;
    let moved = false;
    const move = (ev) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; if (moved) setDrag({ kind: "cut", index, ms: snapMs(msAt(ev.clientX), snapTargets(doc, words, playMs, clip.id), within) }); };
    // A click (no drag) selects the cut (its transition); a drag moves it.
    const up = (ev) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setDrag(null); if (!moved) { onSelect({ kind: "cut", id: clip.id }); return; } onMoveCut(index, snapMs(msAt(ev.clientX), snapTargets(doc, words, playMs, clip.id), within)); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const startTextDrag = (item, mode) => (e) => {
    e.stopPropagation(); e.preventDefault();
    onSelect({ kind: "text", id: item.id });
    const m0 = msAt(e.clientX);
    const targets = [...snapTargets(doc, words, playMs), ...doc.texts.filter((o) => o.id !== item.id).flatMap((o) => [o.startMs, o.endMs])];
    const calc = (ev) => {
      const d = msAt(ev.clientX) - m0;
      if (mode === "start") return { startMs: Math.min(item.endMs - 300, Math.max(0, snapMs(item.startMs + d, targets, within))) };
      if (mode === "end") return { endMs: Math.max(item.startMs + 300, Math.min(durMs, snapMs(item.endMs + d, targets, within))) };
      const len = item.endMs - item.startMs;
      let s = snapMs(item.startMs + d, targets, within);
      const e2 = snapMs(s + len, targets, within);
      if (e2 !== s + len) s = e2 - len;
      s = Math.max(0, Math.min(durMs - len, s));
      return { startMs: Math.round(s), endMs: Math.round(s + len) };
    };
    const move = (ev) => setDrag({ kind: "text", id: item.id, patch: calc(ev) });
    const up = (ev) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setDrag(null); onUpdateText(item.id, calc(ev)); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const scrub = (e) => {
    if (e.button !== 0) return;
    // A press on the scrollbars scrolls; it never seeks.
    const el = scrollRef.current, r = el.getBoundingClientRect();
    if (e.clientY > r.top + el.clientHeight || e.clientX > r.left + el.clientWidth) { stopFollow(); return; }
    setFollow(true);
    onSeek(msAt(e.clientX));
    const move = (ev) => onSeek(msAt(ev.clientX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const texts = useMemo(() => doc.texts.map((it) => (drag?.kind === "text" && drag.id === it.id ? { ...it, ...drag.patch } : it)), [doc.texts, drag]);
  const ticks = useMemo(() => {
    const stepS = [1, 2, 5, 10, 15, 30, 60, 120].find((s) => s * 1000 * pxPerMs >= 70) ?? 120;
    const out = [];
    for (let s = 0; s * 1000 <= durMs; s += stepS) out.push(s * 1000);
    return out;
  }, [durMs, pxPerMs]);
  const visible = (a, b) => { const el = scrollRef.current; if (!el) return true; const L = scrollX - 400, R = scrollX + el.clientWidth + 400; return x(b) >= L && x(a) <= R; };

  return (
    <div className="flex h-full flex-col border-t border-white/[0.08] bg-[#0e1012]" data-testid="edit-timeline">
      <div className="flex min-w-0 items-center gap-3 whitespace-nowrap border-b border-white/[0.06] px-3 py-1.5 text-[11.5px] text-white/55">
        <span className="tabular-nums text-white/80" data-testid="edit-time">{fmt(playMs)} / {fmt(durMs)}</span>
        <span data-testid="edit-hint" className="hidden truncate whitespace-nowrap md:inline">Space play · J/K/L · S split · {MOD}+Z undo · {MOD}+Shift+Z redo</span>
        {!follow && <button type="button" data-testid="follow-playhead" onClick={() => setFollow(true)} className="ml-auto shrink-0 rounded-md border border-lime-300/40 px-2 py-0.5 text-[11px] font-semibold text-lime-200 hover:bg-lime-300/10">Follow playhead</button>}
        <label className={`${follow ? "ml-auto " : ""}flex shrink-0 items-center gap-2`}>Zoom
          <input data-testid="edit-zoom" type="range" min={1} max={60} step={0.5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-32 accent-lime-300" />
        </label>
      </div>
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto" onPointerDown={scrub} onScroll={onScroll} onWheel={stopFollow} onTouchStart={stopFollow}>
        <div className="relative" style={{ width: widthPx + LABEL_W + 40 }}>
          {/* ruler */}
          <div className="relative h-5 border-b border-white/[0.05]" style={{ marginLeft: LABEL_W }}>
            {ticks.map((m) => <span key={m} className="absolute top-0 h-full border-l border-white/10 pl-1 text-[10px] text-white/35" style={{ left: x(m) }}>{fmt(m)}</span>)}
          </div>
          {ROWS.map((row) => (
            <div key={row.key} className="relative flex border-b border-white/[0.04]" style={{ height: row.h }} data-testid={`track-${row.key}`}>
              <div className="sticky left-0 z-20 flex w-[92px] shrink-0 items-center gap-1.5 bg-[#0e1012] px-2 text-[11px] font-semibold text-white/50"><row.icon className="h-3.5 w-3.5" />{row.label}</div>
              <div className="relative flex-1">
                {row.key === "scenes" && clips.map((c, i) => {
                  const s = drag?.kind === "cut" && drag.index === i ? drag.ms : c.startMs;
                  const e = drag?.kind === "cut" && drag.index === i + 1 ? drag.ms : c.endMs;
                  if (!visible(s, e)) return null;
                  const sel = selection?.kind === "clip" && selection.id === c.id;
                  return (
                    <div key={c.id} data-testid="timeline-clip" data-clip-index={i} className={`absolute top-1 bottom-1 overflow-hidden rounded-md border ${sel ? "border-lime-300" : c.needsImage ? "border-amber-300/70" : "border-white/15"} bg-[#1b1f22]`} style={{ left: x(s), width: Math.max(2, x(e) - x(s) - 1) }}
                      onPointerDown={(ev) => { ev.stopPropagation(); setFollow(true); onSelect({ kind: "clip", id: c.id }); onSeek(Math.max(s, msAt(ev.clientX))); }}>
                      {x(e) - x(s) > 30 && <img src={thumbOf(c.image, 160, c.imageVersion)} alt="" draggable={false} className="h-full w-auto object-contain opacity-80" />}
                      <span className="absolute bottom-0 left-1 text-[9.5px] font-semibold text-white/70">{i + 1}</span>
                      {x(e) - x(s) > 26 && MOTION_ICONS[c.motion] && (() => { const Icon = MOTION_ICONS[c.motion]; return <span data-testid="clip-motion" data-motion={c.motion} className="pointer-events-none absolute right-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-sm bg-black/60 text-white/80"><Icon className="h-2.5 w-2.5" /></span>; })()}
                      {i > 0 && <span data-testid="cut-handle" onPointerDown={startCutDrag(i)} className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-lime-300/0 hover:bg-lime-300/60" />}
                    </div>
                  );
                })}
                {row.key === "scenes" && clips.map((c, i) => {
                  if (i === 0 || !visible(c.startMs, c.startMs)) return null;
                  const kind = transitionInto(doc, c, i);
                  const sel = selection?.kind === "cut" && selection.id === c.id;
                  return <button key={`cut-${c.id}`} type="button" data-testid="cut-marker" data-kind={kind} title={`Transition: ${TRANSITIONS[kind]?.label}`} onPointerDown={(ev) => { ev.stopPropagation(); onSelect({ kind: "cut", id: c.id }); }}
                    className={`absolute -top-0.5 z-20 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border ${sel ? "border-white bg-lime-300" : kind !== "cut" ? "border-lime-200 bg-lime-400" : "border-white/30 bg-[#2a2f33]"}`} style={{ left: x(c.startMs) }} />;
                })}
                {row.key === "text" && texts.map((it) => {
                  if (!visible(it.startMs, it.endMs)) return null;
                  const sel = selection?.kind === "text" && selection.id === it.id;
                  return (
                    <div key={it.id} data-testid="timeline-text" className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border px-1.5 text-[10.5px] font-bold ${sel ? "border-lime-300 bg-lime-300/25 text-lime-100" : "border-amber-300/40 bg-amber-300/15 text-amber-100"}`} style={{ left: x(it.startMs), width: Math.max(6, x(it.endMs) - x(it.startMs)) }} onPointerDown={startTextDrag(it, "move")} title={`${TEXT_STYLE_LABELS[it.style]}: ${it.text}`}>
                      <span className="pointer-events-none truncate">{it.text}</span>
                      <span onPointerDown={startTextDrag(it, "start")} className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize" />
                      <span onPointerDown={startTextDrag(it, "end")} className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize" />
                    </div>
                  );
                })}
                {row.key === "captions" && doc.captions?.enabled && phrases.map((p, k) => (visible(p.startMs, p.endMs) ? <div key={k} className="absolute top-1 bottom-1 rounded bg-sky-300/20" style={{ left: x(p.startMs), width: Math.max(2, x(p.endMs) - x(p.startMs) - 1) }} onPointerDown={(ev) => { ev.stopPropagation(); onSelect({ kind: "captions" }); onSeek(msAt(ev.clientX)); }} /> : null))}
                {row.key === "voice" && <Waveform peaks={peaks} widthPx={widthPx} height={row.h} />}
                {row.key === "music" && doc.music?.url && <div className="absolute top-1 bottom-1 flex items-center rounded bg-fuchsia-300/15 px-2 text-[10.5px] text-fuchsia-100" style={{ left: 0, width: widthPx }} onPointerDown={(ev) => { ev.stopPropagation(); onSelect({ kind: "music" }); }}>{musicName ?? "Music"}{doc.music.duck !== false ? " · auto-duck" : ""}</div>}
              </div>
            </div>
          ))}
          {/* playhead + drag guide */}
          <div className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-lime-300" style={{ left: LABEL_W + x(playMs) }} data-testid="playhead"><span className="absolute -left-1.5 -top-0.5 h-3 w-3 rotate-45 bg-lime-300" /></div>
          {drag?.kind === "cut" && <div className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-white" style={{ left: LABEL_W + x(drag.ms) }} />}
        </div>
      </div>
    </div>
  );
}
