import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { claimPlayback, releasePlayback } from "./playback";

const fmt = (s) => { const v = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`; };

/**
 * The Cutaway video player: the only <video> the result view mounts. Tap to play or pause; minimal controls
 * (play/pause, scrub, time, mute, fullscreen) that fade while it plays. Starting it pauses any other player.
 */
export default function CutawayPlayer({ src, poster, autoPlay = true, className = "" }) {
  const wrap = useRef(null), video = useRef(null), hideTimer = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controls, setControls] = useState(true);

  const wake = useCallback(() => {
    setControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { if (video.current && !video.current.paused) setControls(false); }, 2200);
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return undefined;
    // autoplay with sound may be refused without a tap: then it waits on the big play button
    if (autoPlay) v.play().catch(() => setPlaying(false));
    return () => { window.clearTimeout(hideTimer.current); v.pause(); releasePlayback(v); };
  }, [src, autoPlay]);

  const toggle = () => { const v = video.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); wake(); };
  const seek = (e) => { const v = video.current; if (!v || !duration) return; v.currentTime = (Number(e.target.value) / 1000) * duration; setTime(v.currentTime); wake(); };
  const mute = (e) => { e.stopPropagation(); const v = video.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); wake(); };
  const full = (e) => {
    e.stopPropagation();
    const el = wrap.current, v = video.current;
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    else v?.webkitEnterFullscreen?.(); // iPhone Safari: the video's own fullscreen
  };
  const pct = duration ? (time / duration) * 1000 : 0;

  return (
    <div
      ref={wrap}
      onPointerMove={wake}
      onKeyDown={(e) => { if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); } }}
      tabIndex={0}
      role="region"
      aria-label="Video player"
      className={`group relative overflow-hidden rounded-[26px] border border-white/[0.1] bg-black shadow-[0_24px_70px_rgba(0,0,0,.55)] outline-none focus-visible:ring-2 focus-visible:ring-cutaway/60 ${className}`}
    >
      <video
        ref={video}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        onClick={toggle}
        onPlay={(e) => { claimPlayback(e.currentTarget); setPlaying(true); wake(); }}
        onPause={() => { setPlaying(false); setControls(true); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setControls(true); }}
        className="absolute inset-0 h-full w-full cursor-pointer object-cover"
      />

      {!playing && (
        <button type="button" onClick={toggle} aria-label="Play" className="cw-pop absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-[0_10px_40px_rgba(0,0,0,.45)] transition hover:scale-105 active:scale-95">
          <Play className="ml-1 h-7 w-7 fill-current" />
        </button>
      )}

      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-10 transition-opacity duration-200 ${controls || !playing ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <input
          type="range"
          min="0"
          max="1000"
          step="1"
          value={Math.round(pct)}
          onChange={seek}
          aria-label="Seek"
          className="block h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-cutaway [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          style={{ background: `linear-gradient(90deg, #4ADE80 ${pct / 10}%, rgba(255,255,255,.25) ${pct / 10}%)` }}
        />
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label={playing ? "Pause" : "Play"} className="grid h-8 w-8 place-items-center rounded-full text-white transition hover:bg-white/15 active:scale-95">
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <span className="text-[11px] font-semibold tabular-nums text-white/80">{fmt(time)} / {fmt(duration)}</span>
          <span className="flex-1" />
          <button type="button" onClick={mute} aria-label={muted ? "Unmute" : "Mute"} className="grid h-8 w-8 place-items-center rounded-full text-white transition hover:bg-white/15 active:scale-95">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={full} aria-label="Fullscreen" className="grid h-8 w-8 place-items-center rounded-full text-white transition hover:bg-white/15 active:scale-95">
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
