import { useEffect, useRef, useState } from "react";
import { Check, MessageSquareText, Smartphone, Sparkles, Wrench } from "lucide-react";
import { KIT_MEDIA, useInView, useMedia, useReducedMotion } from "./studioKitShared";
import "./studioKit.css";

const STEPS = [
  { key: "claude", label: "Claude writes", icon: MessageSquareText },
  { key: "studio", label: "Studio builds", icon: Wrench },
  { key: "video", label: "Video ready", icon: Smartphone },
];
const STEP_MS = 4200;

/**
 * The free Studio flow as a loop: a Claude chat writes the story -> Roblox Studio builds the town (the owner's real
 * Studio test: blockout, world, light, cast) -> the finished vertical video. Three panels in a row on wide screens,
 * one at a time on phones. Runs only while on screen; "reduce motion": all three, still.
 */
export default function FlowLoop({ compact = false }) {
  const ref = useRef(null);
  const on = useInView(ref);
  const still = useReducedMotion();
  const wide = useMedia("(min-width: 768px)");
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (!on || still) return undefined;
    const t = setInterval(() => setAt((a) => (a + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [on, still]);

  const panels = [
    <ChatPanel key="c" active={still || at === 0} still={still} />,
    <StudioPanel key="s" active={still || at === 1} still={still} />,
    <PhonePanel key="v" active={still || at === 2} playing={on && !still && at === 2} />,
  ];

  return (
    <div ref={ref} className="w-full">
      {/* the step rail: three nodes, the line's pulse runs toward the active one */}
      <ol className="mx-auto mb-4 flex max-w-[620px] items-center" aria-label="How the free kit works">
        {STEPS.map((s, i) => {
          const Icon = s.icon, live = still || i === at, done = !still && i < at;
          return (
            <li key={s.key} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
              <button type="button" onClick={() => setAt(i)} className="flex flex-col items-center gap-1.5" aria-current={live ? "step" : undefined}>
                <span className={`grid h-11 w-11 place-items-center rounded-full border-2 transition-colors duration-300 ${live ? "sk-glow border-lime-300 bg-lime-300 text-[#11150D]" : done ? "border-lime-300 bg-lime-300/15 text-lime-200" : "border-white/15 bg-white/[0.04] text-white/45"}`}>
                  {done ? <Check className="sk-pop h-5 w-5" aria-hidden="true" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
                </span>
                <span className={`whitespace-nowrap text-[12.5px] font-black ${live ? "text-white" : "text-white/50"}`}>{i + 1}. {s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span className="sk-line relative mx-2 mb-6 h-1 flex-1 rounded-full bg-white/10">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-lime-300/60 transition-all duration-500" style={{ width: still || at > i ? "100%" : "0%" }} />
                  {!still && at === i && <span className="sk-pulse" />}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {wide || still ? (
        <div className={`grid items-stretch gap-3 ${compact ? "md:grid-cols-[1fr_1.3fr_0.62fr]" : "md:grid-cols-[1fr_1.35fr_0.62fr]"}`}>{panels}</div>
      ) : (
        <div className="relative mx-auto h-[420px] max-w-[360px]">
          {panels.map((p, i) => (
            <div key={i} className={`sk-xfade absolute inset-0 ${i === at ? "opacity-100" : "pointer-events-none opacity-0"}`}>{p}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Frame({ active, children, className = "" }) {
  return (
    <div className={`relative h-full overflow-hidden rounded-2xl border-2 bg-[#0F1311] transition-all duration-500 ${active ? "border-lime-300/70 shadow-[0_0_40px_-8px_rgba(190,242,100,0.45)]" : "border-white/10 opacity-60"} ${className}`}>
      {children}
    </div>
  );
}

/** 1. a Claude chat: the user's ask, then the story typing out */
function ChatPanel({ active, still }) {
  const line = KIT_MEDIA.line;
  const [n, setN] = useState(line.length);
  useEffect(() => {
    if (still) return undefined;
    if (!active) return undefined; // the last text stays while another step shows
    let i = 0;
    setN(0);
    const t = setInterval(() => { i += 2; setN(Math.min(line.length, i)); if (i >= line.length) clearInterval(t); }, 45);
    return () => clearInterval(t);
  }, [active, still, line.length]);
  return (
    <Frame active={active} className="flex min-h-[260px] flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#d97757]" />
        <span className="text-[12px] font-black text-white/80">Claude</span>
        <span className="ml-auto rounded-md bg-lime-300/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-lime-200">Zyvo Studio Kit</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.09] px-3 py-2 text-[13px] leading-snug text-white/90">{KIT_MEDIA.prompt}</p>
        <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-white/[0.08] bg-black/30 px-3 py-2.5">
          <p className="mb-1 flex items-center gap-1 text-[10.5px] font-black uppercase tracking-[0.12em] text-lime-300"><Sparkles className="h-3 w-3" aria-hidden="true" />Line 1 · the hook</p>
          <p className={`text-[14px] font-semibold leading-snug text-white ${active && n < line.length ? "sk-caret" : ""}`}>{line.slice(0, n) || " "}</p>
        </div>
        <p className={`mt-auto text-[12px] text-white/45 transition-opacity duration-300 ${n >= line.length ? "opacity-100" : "opacity-0"}`}>30 lines · 60 shots planned · approved</p>
      </div>
    </Frame>
  );
}

/** 2. Roblox Studio builds the town: the real Studio test frames, one stage after another */
function StudioPanel({ active, still }) {
  const [k, setK] = useState(3);
  useEffect(() => {
    if (still) return undefined;
    if (!active) return undefined; // the built town stays while another step shows
    setK(0);
    const t = setInterval(() => setK((x) => Math.min(3, x + 1)), 950);
    return () => clearInterval(t);
  }, [active, still]);
  return (
    <Frame active={active} className="flex min-h-[260px] flex-col">
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-3.5 py-2.5">
        <span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" /><span className="h-2 w-2 rounded-full bg-white/25" />
        <span className="ml-2 text-[12px] font-black text-white/80">Roblox Studio</span>
        <span className="ml-auto text-[10.5px] font-bold text-white/40">your PC</span>
      </div>
      <div className="relative flex-1 bg-black">
        {KIT_MEDIA.build.map((src, i) => (
          <img key={src} src={src} alt={i === 3 ? "The town's main street in Roblox Studio, built and cast" : ""} loading="lazy" decoding="async"
            className={`sk-xfade absolute inset-0 h-full w-full object-cover ${i <= k ? "opacity-100" : "opacity-0"}`} />
        ))}
        <div className="absolute inset-x-2 bottom-2 flex flex-wrap gap-1">
          {KIT_MEDIA.buildLabels.map((l, i) => (
            <span key={l} className={`rounded-full px-2 py-0.5 text-[10.5px] font-black backdrop-blur transition-colors duration-300 ${i <= k ? "bg-lime-300 text-[#11150D]" : "bg-black/50 text-white/60"}`}>{l}</span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** 3. the finished vertical video (muted; plays only while it is the active step) */
function PhonePanel({ active, playing }) {
  const v = useRef(null);
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    if (playing) { el.muted = true; el.currentTime = 0; el.play().catch(() => {}); } else el.pause();
  }, [playing]);
  return (
    <Frame active={active} className="mx-auto flex w-full max-w-[236px] items-center justify-center rounded-[26px] bg-black p-1.5 md:max-w-none">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[20px] bg-black">
        <video ref={v} src={playing ? KIT_MEDIA.zyvo.video : undefined} poster={KIT_MEDIA.zyvo.poster} muted playsInline loop preload="none" aria-label="The finished Bedtime Story video" className="h-full w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/90 backdrop-blur">9:16 · ready</span>
      </div>
    </Frame>
  );
}
