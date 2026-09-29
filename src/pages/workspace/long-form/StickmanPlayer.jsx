// StickmanPlayer.jsx — Phase 6c-polish. The whole video, played instantly in
// the browser: every scene image with its camera motion (the renderer's own
// edl.motionFor values), its text layer on top (never moving with the
// image), hard cuts on the real word timings, and the narration as the
// master clock. Built to be the same player the Edit step will use.
// Sizing (6c-polish 2): a true 16:9 frame that always fits the visible area —
// from its own top down to the sticky bottom bar — width follows; centered.
// Fullscreen shows the true 16:9 frame, letterboxed.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Pause, Play } from "lucide-react";
import { OverlayLayer } from "./sceneVisuals";
import { sceneAt, formatSceneTime } from "./scenes";

const CONTROLS_H = 56;

// The camera at progress k (0..1) of a clip: linear, constant speed (matches edl.cameraAt).
function cameraAt(motion, k) {
  const f = motion?.from ?? { scale: 1, cx: 0.5, cy: 0.5 };
  const t = motion?.to ?? f;
  const lerp = (a, b) => a + (b - a) * Math.max(0, Math.min(1, k));
  return { scale: lerp(f.scale, t.scale), cx: lerp(f.cx, t.cx), cy: lerp(f.cy, t.cy) };
}

// The widest 16:9 frame that fits between the player's top (page scrolled to
// the top) and the sticky bottom bar.
function useFitWidth(wrapRef) {
  const [maxW, setMaxW] = useState(null);
  useLayoutEffect(() => {
    const fit = () => {
      const el = wrapRef.current;
      if (!el) return;
      const sc = document.getElementById("workspace-scroll");
      const topAtRest = el.getBoundingClientRect().top + (sc ? sc.scrollTop : window.scrollY);
      const footer = document.querySelector("[data-long-form-footer]");
      const bottom = footer ? footer.getBoundingClientRect().top : window.innerHeight;
      const frameH = Math.max(200, bottom - topAtRest - CONTROLS_H - 16);
      setMaxW(Math.round((frameH * 16) / 9));
    };
    fit();
    const t = setTimeout(fit, 400); // after the footer mounts
    window.addEventListener("resize", fit);
    return () => { clearTimeout(t); window.removeEventListener("resize", fit); };
  }, [wrapRef]);
  return maxW;
}

const StickmanPlayer = forwardRef(function StickmanPlayer({ scenes, audioUrl, durationSeconds, onSceneChange, glow = false }, ref) {
  const audioRef = useRef(null);
  const boxRef = useRef(null);
  const wrapRef = useRef(null);
  const barRef = useRef(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const raf = useRef(0);
  const maxW = useFitWidth(wrapRef);
  const idx = Math.max(0, sceneAt(scenes, t));
  const scene = scenes[idx];
  const total = durationSeconds ?? 0;

  // Smooth time while playing (timeupdate alone is ~4 Hz).
  useEffect(() => {
    if (!playing) return;
    const tick = () => { setT(audioRef.current?.currentTime ?? 0); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);
  useEffect(() => { onSceneChange?.(idx); }, [idx, onSceneChange]);
  // Preload the next two pictures so every cut is instant.
  useEffect(() => {
    for (const s of scenes.slice(idx + 1, idx + 3)) if (s?.playerUrl) { const im = new Image(); im.src = s.playerUrl; }
  }, [idx, scenes]);
  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const seekTo = useCallback((ms, play = true) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = ms / 1000;
    setT(ms / 1000);
    if (play) a.play().catch(() => {});
  }, []);
  useImperativeHandle(ref, () => ({ seekTo }), [seekTo]);

  const toggle = () => { const a = audioRef.current; if (!a) return; if (a.paused) a.play().catch(() => {}); else a.pause(); };
  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else boxRef.current?.requestFullscreen?.().catch(() => {}); };
  // Scrub bar: click or drag anywhere on it.
  const seekFromPointer = (e) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r || !total) return;
    seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total * 1000, playing);
  };
  const k = scene ? (t * 1000 - scene.startMs) / Math.max(1, scene.endMs - scene.startMs) : 0;
  const cam = cameraAt(scene?.motion, k);
  const pct = total ? Math.min(100, (t / total) * 100) : 0;
  // Fullscreen: the true 16:9 frame, letterboxed inside the screen above the controls.
  const frameStyle = fullscreen ? { width: `min(100vw, calc((100vh - ${CONTROLS_H}px) * 16 / 9))` } : { width: "100%" };

  return (
    <div ref={wrapRef} className="mx-auto w-full" style={{ maxWidth: maxW ? `${maxW}px` : undefined }}>
      <div ref={boxRef} data-testid="stickman-player" className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-black ${fullscreen ? "flex h-full w-full flex-col items-center justify-center rounded-none border-0" : ""} ${glow ? "zyvo-ready-glow" : ""}`}>
        <div className={fullscreen ? "flex min-h-0 w-full flex-1 items-center justify-center" : ""}>
          <div className="relative aspect-video overflow-hidden bg-black" style={frameStyle}>
            {scene?.playerUrl || scene?.imageUrl ? (
              <img
                key={scene.key}
                src={scene.playerUrl ?? scene.imageUrl} alt=""
                className="absolute inset-0 h-full w-full object-contain will-change-transform"
                style={{ transformOrigin: `${cam.cx * 100}% ${cam.cy * 100}%`, transform: `scale(${cam.scale})` }}
              />
            ) : <div className="zyvo-shimmer absolute inset-0" />}
            {/* The text layer sits on top and never zooms with the picture (as in the render). */}
            <OverlayLayer layer={scene?.overlay} />
            {!playing && (
              <button type="button" onClick={toggle} aria-label="Play" className="absolute inset-0 flex items-center justify-center bg-black/25 transition hover:bg-black/15">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-[0_0_40px_rgba(190,242,100,0.35)]"><Play className="h-7 w-7 translate-x-0.5" /></span>
              </button>
            )}
          </div>
        </div>
        <div className="flex w-full items-center gap-3 bg-[#0d0f10] px-4" style={{ height: CONTROLS_H }}>
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/15">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
          </button>
          <span className="w-[92px] shrink-0 text-[12px] tabular-nums text-white/70">{formatSceneTime(t * 1000)} / {formatSceneTime(total * 1000)}</span>
          {/* Scrub bar with a marker at every scene cut. */}
          <div
            ref={barRef} role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(t)} tabIndex={0}
            data-testid="player-scrub"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekFromPointer(e); }}
            onPointerMove={(e) => { if (e.buttons) seekFromPointer(e); }}
            onKeyDown={(e) => { if (e.key === "ArrowRight") seekTo((t + 5) * 1000, playing); if (e.key === "ArrowLeft") seekTo(Math.max(0, t - 5) * 1000, playing); }}
            className="relative h-6 min-w-0 flex-1 cursor-pointer"
          >
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/15" />
            {total > 0 && scenes.slice(1).map((s) => (
              <span key={s.key} className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/25" style={{ left: `${(s.startMs / 1000 / total) * 100}%` }} />
            ))}
            <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-lime-300" style={{ width: `${pct}%` }} />
            <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-300 shadow" style={{ left: `${pct}%` }} />
          </div>
          <span className="hidden shrink-0 text-[11.5px] text-white/45 sm:inline">Scene {scene?.number ?? 1} / {scenes.length}</span>
          <button type="button" aria-label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFs} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden"
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => { if (!playing) setT(e.currentTarget.currentTime); }} />
        )}
      </div>
    </div>
  );
});

export default StickmanPlayer;
