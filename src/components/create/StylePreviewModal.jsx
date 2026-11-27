import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Volume2, VolumeX, X } from "lucide-react";
import { creditsFor, isWide, videosOf } from "../../data/styles";
import { LoopVideo, ViewsTag } from "./StyleCard";

/**
 * A template's preview popup: the main video, 2-3 more examples (swipe on mobile), one example prompt, what's included,
 * the price range and "Use this template" (closes, puts the template in the prompt bar, focuses the text box).
 */
export default function StylePreviewModal({ style, onClose, onUse }) {
  // the style's videos, then each version's preview (so picking a version can show it)
  const videos = [...videosOf(style), ...(style.variants ?? []).filter((v) => v.preview).map((v) => ({ src: v.preview, poster: v.poster }))]
    .filter((v, i, a) => a.findIndex((x) => x.src === v.src) === i);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const [variant, setVariant] = useState(null);
  const wide = isWide(style);
  useEffect(() => { setProgress(0); }, [active]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const lo = creditsFor(style, Math.min(...style.lengths)), hi = creditsFor(style, Math.max(...style.lengths));
  const inc = style.included ?? {};
  const main = videos[active];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close preview" className="absolute inset-0 bg-black/75 backdrop-blur-[6px]" onClick={onClose} />
      <section role="dialog" aria-label={`${style.name} preview`} className="relative max-h-[92dvh] w-full max-w-[760px] overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#121416] p-4 sm:rounded-[26px] sm:p-5" data-testid="style-preview">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-white/70 hover:text-white"><X className="h-3.5 w-3.5" />Close</button>
        <div className={`grid gap-4 ${wide ? "" : "sm:grid-cols-[minmax(0,260px)_1fr]"}`}>
          <div>
            <div className={`relative mx-auto w-full overflow-hidden rounded-[18px] bg-black ${wide ? "aspect-video" : "aspect-[9/16] max-w-[260px]"}`} data-testid="preview-player">
              {main ? (
                <video
                  key={main.src} src={main.src} poster={main.poster ?? style.poster} autoPlay muted={muted} playsInline
                  loop={videos.length === 1}
                  onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
                  onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration); }}
                  onEnded={() => { setProgress(0); setActive((i) => (i + 1) % videos.length); }}
                  className="h-full w-full cursor-pointer object-contain"
                />
              ) : <img src={style.poster} alt="" className="h-full w-full object-cover" />}
              {/* story-style bars: one per example, the playing one fills as it plays */}
              {videos.length > 1 && <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/55 to-transparent" aria-hidden="true" />}
              {videos.length > 1 && (
                <div className="pointer-events-none absolute inset-x-2 top-2 flex gap-1" aria-hidden="true">
                  {videos.map((v, i) => (
                    <span key={v.src} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                      <span className="block h-full rounded-full bg-white" style={{ width: `${i < active ? 100 : i === active ? Math.round(progress * 100) : 0}%`, transition: "width 250ms linear" }} />
                    </span>
                  ))}
                </div>
              )}
              {videos.length > 1 && (
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white/85 backdrop-blur" aria-live="polite">
                  {String(active + 1).padStart(2, "0")} <span className="text-white/40">/ {String(videos.length).padStart(2, "0")}</span>
                </span>
              )}
              {main && (
                <button type="button" onClick={() => setMuted((m) => !m)} className="absolute right-2 top-4 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
                  {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}{muted ? "Sound on" : "Sound off"}
                </button>
              )}
              {main?.views > 0 && <ViewsTag views={main.views} className="absolute bottom-2 left-2" />}
            </div>
            {videos.length > 1 && (
              <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1" aria-label="More examples">
                {videos.map((v, i) => (
                  <button key={v.src} type="button" onClick={() => setActive(i)} aria-label={`Example ${i + 1}`} aria-pressed={i === active} className={`relative aspect-[9/16] w-16 shrink-0 snap-start overflow-hidden rounded-lg border ${i === active ? "border-lime-300" : "border-white/10"}`}>
                    <LoopVideo src={v.src} poster={v.poster ?? style.poster} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <h2 className="pr-16 text-[22px] font-black leading-tight text-white">{style.name}</h2>
            <p className="mt-1 text-[14px] text-white/65">{style.direction}</p>
            {style.variants?.length > 0 && (
              <div className="mt-4" role="radiogroup" aria-label="Pick a version">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Pick a version</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {[{ id: null, name: "Any", poster: style.poster }, ...style.variants].map((v) => (
                    <button key={v.id ?? "any"} type="button" role="radio" aria-checked={variant === v.id}
                      onClick={() => { setVariant(v.id); const vv = v.id ? style.variants.find((x) => x.id === v.id) : null; if (vv?.preview) { const at = videos.findIndex((x) => x.src === vv.preview); if (at >= 0) setActive(at); } }}
                      className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] font-semibold transition ${variant === v.id ? "border-lime-300 bg-lime-300/[0.1] text-lime-200" : "border-white/10 text-white/70 hover:border-white/25"}`}>
                      <img src={v.poster} alt="" className="h-7 w-7 rounded-full object-cover" />{v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Example idea</p>
              <p className="mt-1 text-[14px] text-white">“{(variant && style.variants?.find((x) => x.id === variant)?.ideas?.[0]) || style.examplePrompt}”</p>
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-2 text-[13px]">
              {[["Voice", inc.voice], ["Captions", inc.captions], ["Music", inc.music]].map(([k, on]) => (
                <li key={k} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${on ? "bg-lime-300/[0.08] text-lime-200" : "bg-white/[0.03] text-white/35 line-through"}`}>{on && <Check className="h-3.5 w-3.5" />}{k}</li>
              ))}
            </ul>
            <p className="mt-4 text-[14px] text-white/70">Price: <span className="font-semibold text-white">{lo === hi ? `about ${lo}` : `about ${lo}–${hi}`} credits</span>{style.tier === "paid" ? " · paid plans" : " · free plan too"}</p>
            {style.worksInClaude && <p className="mt-1 text-[13px] text-white/50">Can also be made with your own Claude for fewer credits.</p>}
            <button type="button" onClick={() => onUse(style, variant)} className="mt-auto w-full rounded-xl bg-lime-300 px-4 py-3.5 text-[16px] font-black text-[#11150D] hover:bg-lime-200 active:scale-[.99] sm:mt-6" data-testid="use-template">
              Use this template
            </button>
            <a href={style.engine.path} className="mt-2 text-center text-[12px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline">Open the classic {style.name} page</a>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
