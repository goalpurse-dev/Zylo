// TransitionPicker.jsx — Phase 6d-1 polish. Transition and camera-move
// pickers. Photosensitivity: every tile is a neutral dark card showing the
// REAL scenes at rest (current + next); the move plays ONCE on hover or tap,
// then stops — no looping, no bright fills; with prefers-reduced-motion it
// never plays (a static icon says what it is). Selected = a thin lime border.
// The animation is the editor preview's own look (transitionLook / camera).
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Circle, Minus, MoveLeft, MoveRight, Scissors, Shuffle, Sparkles, Square, Sun, Wind, ZoomIn, ZoomOut, Moon, Layers } from "lucide-react";
import { TRANSITIONS, TRANSITION_KINDS, MOTION_MODES, MOTION_MODE_LABELS, motionOf, cameraAt } from "../../../../lib/stickmanEdit";
import { transitionLook } from "./EditorPreview";
import { thumbOf } from "./editApi";

const TRANSITION_ICON = { cut: Scissors, fade: Layers, whip: Wind, zoom: ZoomIn, flash: Sun, slide_left: MoveLeft, slide_right: MoveRight, dip: Moon, circle: Circle };
const MOTION_ICON = { push_in: ZoomIn, pull_out: ZoomOut, pan_left: ArrowLeft, pan_right: ArrowRight, hold: Square, mix: Shuffle };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Plays a 0..1 progress once over `ms`, then returns to rest (null).
function usePlayOnce() {
  const [q, setQ] = useState(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const play = (ms) => {
    if (reducedMotion()) return;
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const tick = (now) => { const k = (now - t0) / ms; if (k >= 1) { setQ(null); return; } setQ(k); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
  };
  return [q, play];
}

function Img({ src, style }) {
  return src ? <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={style} /> : <span className="absolute inset-0 bg-[#23282c]" style={style} />;
}

function Tile({ label, sub, Icon, selected, onPick, testid, onPlay, children }) {
  return (
    <button type="button" data-testid={testid} onClick={() => { onPlay(); onPick(); }} onMouseEnter={onPlay}
      className={`grid min-h-[44px] gap-1 rounded-lg border bg-[#16191b] p-1.5 text-left text-[11px] font-semibold ${selected ? "border-lime-300/80 text-white" : "border-white/[0.08] text-white/70 hover:border-white/20"}`}>
      <span className="relative block aspect-video w-full overflow-hidden rounded-md bg-[#0d0f10]">
        {children}
        <span className="absolute bottom-1 left-1 grid h-5 w-5 place-items-center rounded bg-black/60 text-white/85"><Icon className="h-3 w-3" /></span>
      </span>
      <span className="leading-tight">{label}{sub && <span className="block text-[10px] font-medium text-white/40">{sub}</span>}</span>
    </button>
  );
}

function TransitionTile({ kind, a, b, selected, onPick }) {
  const [q, play] = usePlayOnce();
  const look = q == null ? null : transitionLook(kind, q);
  const ms = Math.max(700, (TRANSITIONS[kind].ms || 200) * 3);
  return (
    <Tile testid={`transition-${kind}`} label={TRANSITIONS[kind].label} sub={TRANSITIONS[kind].ms ? `${(TRANSITIONS[kind].ms / 1000).toFixed(2).replace(/0$/, "")} s` : "default"} Icon={TRANSITION_ICON[kind] ?? Minus} selected={selected} onPick={onPick} onPlay={() => play(ms)}>
      {look ? (
        <>
          <span className="absolute inset-0" style={look.a}><Img src={a} /></span>
          <span className="absolute inset-0" style={look.b}><Img src={b} /></span>
          {look.veil && <span className="absolute inset-0" style={look.veil} />}
        </>
      ) : (
        // At rest: the two real scenes, side by side.
        <>
          <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden"><Img src={a} /></span>
          <span className="absolute inset-y-0 right-0 w-1/2 overflow-hidden border-l border-black/70"><Img src={b} /></span>
        </>
      )}
    </Tile>
  );
}

function MotionTile({ mode, image, selected, onPick }) {
  const [q, play] = usePlayOnce();
  // The real move, exaggerated x4 so it reads in a small tile; Mix shows a zoom then a pan.
  const kind = mode === "mix" ? (q != null && q > 0.5 ? "pan_right" : "push_in") : mode;
  const m = motionOf(kind, 6000);
  const k = q == null ? 0 : mode === "mix" ? (q > 0.5 ? (q - 0.5) * 2 : q * 2) : q;
  const cam = cameraAt(m, k);
  const scale = 1 + (cam.scale - 1) * 4, dx = (0.5 - cam.cx) * 4 * 100;
  return (
    <Tile testid={`motion-mode-${mode}`} label={MOTION_MODE_LABELS[mode]} sub={mode === "mix" ? "varied, automatic" : null} Icon={MOTION_ICON[mode]} selected={selected} onPick={onPick} onPlay={() => play(1400)}>
      <Img src={image} style={{ transform: `translateX(${dx}%) scale(${scale})`, transformOrigin: "50% 50%" }} />
    </Tile>
  );
}

export function MotionPicker({ value, image, onPick, testid = "motion-picker", modes = MOTION_MODES }) {
  return (
    <div className="grid gap-2" data-testid={testid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
      {modes.map((m) => <MotionTile key={m} mode={m} image={thumbOf(image, 320)} selected={value === m} onPick={() => onPick(m)} />)}
    </div>
  );
}

export default function TransitionPicker({ value, onPick, onApplyAll, onAutoMix, scope = "cut", a, b }) {
  const A = thumbOf(a, 320), B = thumbOf(b, 320);
  return (
    <div className="grid gap-3" data-testid="transition-picker">
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
        {TRANSITION_KINDS.map((k) => <TransitionTile key={k} kind={k} a={A} b={B} selected={value === k} onPick={() => onPick(k)} />)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {scope === "cut" && <button type="button" data-testid="transition-apply-all" onClick={() => onApplyAll(value)} className="min-h-[44px] rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12px] font-semibold text-white/80 hover:bg-white/[0.08]">Apply to all cuts</button>}
        <button type="button" data-testid="transition-auto-mix" onClick={onAutoMix} className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-lime-300 px-3 text-[12px] font-bold text-[#11150D] hover:bg-lime-200 ${scope === "cut" ? "" : "col-span-2"}`}><Sparkles className="h-3.5 w-3.5" /> Auto mix</button>
      </div>
      <p className="text-[11px] leading-relaxed text-white/40">Auto mix: hard cuts inside a section, a punchy transition on a new section or a big reveal (at most one per ~20 s, Flash at most twice), a dip to black before the ending. Transitions never move the voice.</p>
    </div>
  );
}
