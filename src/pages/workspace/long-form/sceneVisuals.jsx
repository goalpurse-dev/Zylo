// sceneVisuals.jsx — Phase 6c-polish. What every Stickman scene picture is
// drawn with, everywhere (drawing grid, review cards, lightbox, player):
// the image + its editable text layer composited on top — what you see is
// what renders. Images load as small WebP thumbnails (Supabase image
// transforms, width+height+contain) with a blur-up, lazily below the fold; the full
// image only on demand. Always 16:9 and object-contain: a scene image is NEVER cropped.
import { useEffect, useRef, useState } from "react";

const FONT_HREF = "https://fonts.googleapis.com/css2?family=Lilita+One&display=swap";
export function useOverlayFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);
}

// The arrow's strokes (shaft + two head strokes) — the same maths as textOverlay.arrowStrokes.
function arrowStrokes(a) {
  const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const L = a.width * 4.5;
  const head = (d) => [a.x2, a.y2, Math.round(a.x2 - L * Math.cos(ang + d)), Math.round(a.y2 - L * Math.sin(ang + d))];
  return [[a.x1, a.y1, a.x2, a.y2], head(0.5), head(-0.5)];
}

function LayerText({ text, box, scale, fill, outline, outlineRadius }) {
  return (
    <text
      x={box.x + box.width / 2} y={box.y + box.height / 2} textAnchor="middle" dominantBaseline="central"
      fontFamily="'Lilita One', system-ui, sans-serif" fontSize={scale} fill={fill}
      stroke={outline ?? "#000"} strokeWidth={Math.max(2, (outlineRadius ?? 8) * 2)} strokeLinejoin="round" paintOrder="stroke"
    >
      {text}
    </text>
  );
}

// The editable text layer (1920x1080 coordinates) — never burned into the image.
// Styles (text upgrade): HEADLINE (yellow), QUESTION (white), BIG_STAT (a big
// number + a small white label under it), CALLOUT (a label + an arrow).
export function OverlayLayer({ layer }) {
  if (!layer?.text) return null;
  const { box, label, arrow } = layer;
  const bandBottom = label ? label.box.y + label.box.height : box.y + box.height;
  const rr = arrow ? Math.max(2, Math.round(arrow.width / 2)) : 0;
  return (
    <svg viewBox="0 0 1920 1080" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" data-text-style={layer.style ?? "HEADLINE"}>
      {layer.darkBand && <rect x={0} y={box.y - 10} width={1920} height={bandBottom - box.y + 20} fill="rgba(0,0,0,0.55)" />}
      {arrow && [2 * (rr + Math.max(2, Math.round(rr * 0.8))), 2 * rr].map((w, pass) => (
        <g key={pass} stroke={pass ? layer.fill ?? "#FFD21F" : layer.outline ?? "#000"} strokeWidth={w} strokeLinecap="round">
          {arrowStrokes(arrow).map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
        </g>
      ))}
      <LayerText text={layer.text} box={box} scale={layer.scale} fill={layer.fill ?? "#FFD21F"} outline={layer.outline} outlineRadius={layer.outlineRadius} />
      {label && <LayerText text={label.text} box={label.box} scale={label.scale} fill={label.fill ?? "#FFFFFF"} outline={layer.outline} outlineRadius={label.outlineRadius} />}
    </svg>
  );
}

// A tiny (32 px) blurred copy shows at once; the thumbnail fades in over it.
const tiny = (thumbUrl) => (thumbUrl ? thumbUrl.replace(/width=\d+/, "width=32").replace(/height=\d+/, "height=18") : null);

// A finished scene is never left blurred: "loaded" belongs to the exact src (a reset
// can't land after a cached image's load event), a cached image is caught on mount
// via img.complete, and a failed load retries once, then falls back to the full image.
const bust = (u) => `${u}${u.includes("?") ? "&" : "?"}r=1`;
export function SceneThumb({ scene, busy = false, eager = false, className = "" }) {
  const imgRef = useRef(null);
  const base = scene.thumbUrl ?? scene.imageUrl;
  const [fail, setFail] = useState({ base, n: 0 });
  const n = fail.base === base ? fail.n : 0;
  const src = !base ? null : n === 0 ? base : n === 1 ? bust(base) : scene.imageUrl && scene.imageUrl !== base ? scene.imageUrl : null;
  const [loadedSrc, setLoadedSrc] = useState(null);
  const loaded = !!src && loadedSrc === src;
  useEffect(() => {
    const el = imgRef.current;
    if (src && el?.complete && el.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);
  return (
    <div className={`relative aspect-video overflow-hidden rounded-xl bg-black ${className}`}>
      {src ? (
        <>
          {!loaded && tiny(scene.thumbUrl) && <img src={tiny(scene.thumbUrl)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain blur-md" />}
          <img
            ref={imgRef} src={src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onLoad={() => setLoadedSrc(src)}
            onError={() => setFail({ base, n: n + 1 })}
            className={`absolute inset-0 h-full w-full object-contain transition-[opacity,filter] duration-700 ${loaded ? "opacity-100" : "opacity-0"} ${busy ? "blur-sm" : ""}`}
          />
          {loaded && <OverlayLayer layer={scene.overlay} />}
          {busy && <div className="zyvo-shimmer absolute inset-0" />}
        </>
      ) : scene.status === "failed" || (base && !src) ? (
        <div className="flex h-full w-full items-center justify-center text-[11.5px] text-white/40">{scene.status === "failed" ? "Couldn't draw this scene" : "Couldn't load this picture"}</div>
      ) : (
        <div className="zyvo-shimmer absolute inset-0" />
      )}
    </div>
  );
}

export const SCENES_CSS = `
.zyvo-shimmer { background: linear-gradient(100deg, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.03) 70%); background-size: 220% 100%; animation: zyvoShimmer 1.4s linear infinite; }
@keyframes zyvoShimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
.zyvo-btn-shimmer { position: relative; overflow: hidden; }
.zyvo-btn-shimmer::after { content: ""; position: absolute; inset: 0; transform: translateX(-120%); background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.45) 50%, transparent 80%); }
.zyvo-btn-shimmer:hover::after { animation: zyvoBtnSweep 0.9s ease-out; }
@keyframes zyvoBtnSweep { to { transform: translateX(120%); } }
.zyvo-ready-glow { animation: zyvoReadyGlow 2.4s ease-out 1; }
@keyframes zyvoReadyGlow { 0% { box-shadow: 0 0 0 0 rgba(190,242,100,0); } 30% { box-shadow: 0 0 0 6px rgba(190,242,100,0.35), 0 0 60px 8px rgba(190,242,100,0.18); } 100% { box-shadow: 0 0 0 0 rgba(190,242,100,0); } }
.zyvo-card { content-visibility: auto; contain-intrinsic-size: 360px; }
@media (prefers-reduced-motion: reduce) { .zyvo-shimmer, .zyvo-ready-glow, .zyvo-btn-shimmer:hover::after { animation: none; } }
`;
