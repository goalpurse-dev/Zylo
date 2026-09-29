// EditorPreview.jsx — Phase 6d-1. The Edit step's preview: the scene image
// with its camera motion (the renderer's frame-exact maths from
// stickmanEdit.js), the text track and the captions drawn on top in
// 1920x1080 coordinates (never moving with the picture), the quick fade.
// Text can be dragged to a new position; the selected text shows a frame.
import { useEffect, useMemo, useRef } from "react";
import { cameraAt, progressAt, textsAt, captionAt, mainText, transitionWindows, TEXT_FILL, CAPTION_Y, CAPTION_SCALE, EDIT_FPS } from "../../../../lib/stickmanEdit";
import { thumbOf } from "./editApi";

function arrowStrokes(a) {
  const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const L = a.width * 4.5;
  const head = (d) => [a.x2, a.y2, Math.round(a.x2 - L * Math.cos(ang + d)), Math.round(a.y2 - L * Math.sin(ang + d))];
  return [[a.x1, a.y1, a.x2, a.y2], head(0.5), head(-0.5)];
}
const outlineOf = (scale) => Math.max(3, Math.ceil(scale * 0.11));

export function TextItemSvg({ item, selected, onPointerDown }) {
  const fill = TEXT_FILL[item.style] ?? "#FFD21F";
  const r = outlineOf(item.scale);
  const rr = item.arrow ? Math.max(2, Math.round(item.arrow.width / 2)) : 0;
  const txt = mainText(item);
  const w = txt.length * item.scale * 0.52;
  return (
    <g data-testid="preview-text" data-style={item.style} onPointerDown={onPointerDown} style={{ cursor: onPointerDown ? "move" : "default" }}>
      {item.darkBand && <rect x={0} y={item.y - item.scale * 0.62} width={1920} height={item.scale * 1.24 + (item.label ? item.label.scale * 1.3 : 0)} fill="rgba(0,0,0,0.55)" />}
      {item.arrow && [2 * (rr + Math.max(2, Math.round(rr * 0.8))), 2 * rr].map((sw, pass) => (
        <g key={pass} stroke={pass ? fill : "#000"} strokeWidth={sw} strokeLinecap="round">
          {arrowStrokes(item.arrow).map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
        </g>
      ))}
      <text x={item.x} y={item.y} textAnchor="middle" dominantBaseline="central" fontFamily="'Lilita One', system-ui, sans-serif" fontSize={item.scale} fill={fill} stroke="#000" strokeWidth={2 * r} strokeLinejoin="round" paintOrder="stroke">{txt}</text>
      {item.label && <text x={item.x} y={item.label.y} textAnchor="middle" dominantBaseline="central" fontFamily="'Lilita One', system-ui, sans-serif" fontSize={item.label.scale} fill="#FFFFFF" stroke="#000" strokeWidth={2 * outlineOf(item.label.scale)} strokeLinejoin="round" paintOrder="stroke">{item.label.text}</text>}
      {selected && <rect x={item.x - w / 2 - 16} y={item.y - item.scale * 0.7} width={w + 32} height={item.scale * 1.4 + (item.label ? item.label.scale * 1.4 : 0)} fill="none" stroke="#bef264" strokeWidth={4} strokeDasharray="14 10" />}
    </g>
  );
}

// Captions: one phrase at a time, bottom centre. highlight = the spoken word
// in yellow; simple = plain white; boxed = white on a dark box.
export function CaptionSvg({ cap, style }) {
  if (!cap) return null;
  const words = cap.phrase.words;
  const text = words.map((w) => String(w.text).toUpperCase());
  const approxW = text.join(" ").length * CAPTION_SCALE * 0.5;
  return (
    <g data-testid="preview-caption" data-style={style}>
      {style === "boxed" && <rect x={960 - approxW / 2 - 28} y={CAPTION_Y - CAPTION_SCALE * 0.72} width={approxW + 56} height={CAPTION_SCALE * 1.44} rx={18} fill="rgba(0,0,0,0.72)" />}
      <text x={960} y={CAPTION_Y} textAnchor="middle" dominantBaseline="central" fontFamily="'Lilita One', system-ui, sans-serif" fontSize={CAPTION_SCALE}
        stroke={style === "boxed" ? "none" : "#000"} strokeWidth={style === "highlight" ? 14 : 8} strokeLinejoin="round" paintOrder="stroke">
        {text.map((t, j) => <tspan key={j} fill={style === "highlight" && j === cap.active ? "#FFD21F" : "#FFFFFF"}>{j ? ` ${t}` : t}</tspan>)}
      </text>
    </g>
  );
}

// How each transition looks at progress q (0..1, frame k of n = k/n — the
// same frames and progress as FFmpeg's xfade in the render; the look is a
// close CSS match of that xfade).
export function transitionLook(kind, q) {
  const tri = 1 - Math.abs(2 * q - 1);
  switch (kind) {
    case "fade": return { b: { opacity: q } };
    // Photosensitivity-safe: a cross-fade under a soft off-white veil, at most 70 % (the render's geq veil).
    case "flash": return { b: { opacity: q }, veil: { background: "#F5F2EA", opacity: 0.7 * tri } };
    case "dip": return { a: { opacity: q < 0.5 ? 1 : 0 }, b: { opacity: q < 0.5 ? 0 : 1 }, veil: { background: "#000", opacity: Math.min(1, tri * 1.6) } };
    case "zoom": return { a: { transform: `scale(${1 + q})`, opacity: 1 - q }, b: { opacity: q } };
    case "slide_left": return { a: { transform: `translateX(${-q * 100}%)` }, b: { transform: `translateX(${(1 - q) * 100}%)` } };
    case "whip": return { a: { transform: `translateX(${-q * 100}%)`, filter: "blur(6px)" }, b: { transform: `translateX(${(1 - q) * 100}%)`, filter: "blur(6px)" } };
    case "slide_right": return { a: { transform: `translateX(${q * 100}%)` }, b: { transform: `translateX(${-(1 - q) * 100}%)` } };
    case "circle": return { b: { clipPath: `circle(${(q * 72).toFixed(2)}% at 50% 50%)` } };
    default: return { b: { opacity: 1 } };
  }
}

function Picture({ clip, ms, wrap }) {
  const cam = cameraAt(clip.motionPath, progressAt(clip, ms));
  return (
    <div className="absolute inset-0" style={wrap}>
      <img src={thumbOf(clip.image, 1920, clip.imageVersion) ?? clip.image} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain"
        style={{ transformOrigin: `${cam.cx * 100}% ${cam.cy * 100}%`, transform: `scale(${cam.scale})` }} />
    </div>
  );
}

export default function EditorPreview({ doc, clips, t, phrases, selectedTextId, onSelectText, onMoveText, maxWidth }) {
  const svgRef = useRef(null);
  const ms = t * 1000;
  let i = 0;
  for (let j = 0; j < clips.length; j++) if (clips[j].startMs <= ms) i = j; else break;
  const clip = clips[i];
  // The next two pictures load ahead, so every cut is instant.
  useEffect(() => { for (const c of clips.slice(i + 1, i + 3)) if (c?.image) { const im = new Image(); im.src = thumbOf(c.image, 1920, c.imageVersion); } }, [i, clips]);
  // A transition window around a cut: both pictures, frame-exact.
  const windows = useMemo(() => transitionWindows(doc, clips), [doc, clips]);
  const frame = Math.floor((ms * EDIT_FPS) / 1000);
  const win = windows.find((w) => frame >= w.startFrame && frame < w.endFrame);
  const look = win ? transitionLook(win.kind, (frame - win.startFrame) / win.frames) : null;
  const cap = doc.captions?.enabled ? captionAt(phrases, ms) : null;
  const toSvg = (e) => { const r = svgRef.current.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 1920, y: ((e.clientY - r.top) / r.height) * 1080 }; };
  const startDrag = (item) => (e) => {
    e.stopPropagation();
    onSelectText?.(item.id);
    if (!onMoveText) return;
    const p0 = toSvg(e), x0 = item.x, y0 = item.y;
    const move = (ev) => { const p = toSvg(ev); onMoveText(item.id, { x: Math.round(Math.max(40, Math.min(1880, x0 + p.x - p0.x))), y: Math.round(Math.max(40, Math.min(1040, y0 + p.y - p0.y))) }, false); };
    const up = (ev) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); const p = toSvg(ev); onMoveText(item.id, { x: Math.round(Math.max(40, Math.min(1880, x0 + p.x - p0.x))), y: Math.round(Math.max(40, Math.min(1040, y0 + p.y - p0.y))) }, true); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="mx-auto w-full" style={{ maxWidth }}>
      <div data-testid="edit-preview" className="relative aspect-video w-full overflow-hidden rounded-xl bg-black" onPointerDown={() => onSelectText?.(null)}>
        {win ? (
          <div data-testid="preview-transition" data-kind={win.kind} className="absolute inset-0">
            <Picture clip={clips[win.index - 1]} ms={ms} wrap={look.a} />
            <Picture clip={clips[win.index]} ms={ms} wrap={look.b} />
            {look.veil && <div className="absolute inset-0" style={look.veil} />}
          </div>
        ) : clip && <Picture key={clip.id} clip={clip} ms={ms} />}
        <svg ref={svgRef} viewBox="0 0 1920 1080" className="absolute inset-0 h-full w-full">
          {textsAt(doc, ms).map((item) => <TextItemSvg key={item.id} item={item} selected={item.id === selectedTextId} onPointerDown={startDrag(item)} />)}
          <CaptionSvg cap={cap} style={doc.captions?.style} />
        </svg>
        {clip?.needsImage && <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11.5px] font-semibold text-amber-200">New scene — picture not generated yet</span>}
      </div>
    </div>
  );
}
