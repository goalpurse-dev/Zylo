const MIN = 10;
const MAX = 1200; // 20 minutes

const QUICK_PICKS = [
  { label: "15s", s: 15 },
  { label: "30s", s: 30 },
  { label: "60s", s: 60 },
  { label: "3m", s: 180 },
  { label: "5m", s: 300 },
  { label: "10m", s: 600 },
  { label: "20m", s: 1200 },
];

function fmt(s) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

export default function DurationSlider({ value, onChange, sceneCount }) {
  const pct = ((value - MIN) / (MAX - MIN)) * 100;

  const hookSec = value <= 20 ? 2 : 3;
  const ctaSec  = value <= 20 ? 2 : value <= 60 ? 3 : 5;
  const bodySec = Math.max(0, value - hookSec - ctaSec);

  // Use user-chosen scene count (if set), else show auto estimate
  const displayScenes = sceneCount && sceneCount !== "auto" ? parseInt(sceneCount)
    : value <= 20  ? 2
    : value <= 45  ? 3
    : value <= 90  ? 5
    : value <= 210 ? 7
    : value <= 600 ? 10
    : 15;

  const perScene = displayScenes > 0 ? Math.round(bodySec / displayScenes) : 0;

  return (
    <div className="space-y-5">

      {/* Big time display */}
      <div className="text-center select-none">
        <div className="text-[52px] leading-none font-bold text-white tabular-nums tracking-tight">
          {fmt(value)}
        </div>
        <div className="text-white/25 text-xs mt-2 tracking-wide">
          {displayScenes} scene{displayScenes !== 1 ? "s" : ""}
          {perScene > 0 && <> &nbsp;·&nbsp; ~{fmt(perScene)}/scene</>}
          &nbsp;·&nbsp; hook {fmt(hookSec)} &nbsp;·&nbsp; CTA {fmt(ctaSec)}
        </div>
      </div>

      {/* Slider */}
      <div className="px-1 pt-1">
        <input
          type="range" min={MIN} max={MAX} step="1" value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="script-slider w-full"
          style={{ background: `linear-gradient(to right, #7A3BFF ${pct}%, rgba(255,255,255,0.10) ${pct}%)` }}
        />
        <div className="flex justify-between text-white/20 text-[10px] mt-2 px-0.5 select-none">
          <span>10s</span><span>1m</span><span>3m</span><span>5m</span><span>10m</span><span>20m</span>
        </div>
      </div>

      {/* Timeline bar */}
      <div>
        <div className="text-[10px] text-white/20 uppercase tracking-widest font-semibold mb-2">Timeline</div>
        <div className="flex w-full h-9 rounded-xl overflow-hidden gap-px">
          <div className="bg-[#7A3BFF]/40 flex items-center justify-center shrink-0 transition-all duration-150 min-w-[10%]"
            style={{ width: `${Math.max((hookSec / value) * 100, 8)}%` }}>
            <span className="text-[10px] text-white/70 font-semibold">Hook</span>
          </div>
          {Array.from({ length: Math.min(displayScenes, 12) }).map((_, i) => (
            <div key={i} className="bg-white/[0.05] border-r border-white/[0.04] flex items-center justify-center min-w-0 overflow-hidden flex-1">
              <span className="text-[10px] text-white/30 font-medium truncate px-0.5">S{i + 1}</span>
            </div>
          ))}
          {displayScenes > 12 && (
            <div className="bg-white/[0.05] flex items-center justify-center px-1 shrink-0">
              <span className="text-[9px] text-white/25">+{displayScenes - 12}</span>
            </div>
          )}
          <div className="bg-emerald-500/25 flex items-center justify-center shrink-0 transition-all duration-150 min-w-[8%]"
            style={{ width: `${Math.max((ctaSec / value) * 100, 7)}%` }}>
            <span className="text-[10px] text-white/70 font-semibold">CTA</span>
          </div>
        </div>
        <div className="flex justify-between mt-1.5 px-0.5 select-none">
          <span className="text-[9px] text-white/20">{fmt(hookSec)}</span>
          <span className="text-[9px] text-white/15">body {fmt(bodySec)}</span>
          <span className="text-[9px] text-white/20">{fmt(ctaSec)}</span>
        </div>
      </div>

      {/* Quick picks */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PICKS.map(({ label, s }) => (
          <button key={s} onClick={() => onChange(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 ${
              value === s
                ? "bg-[#7A3BFF]/25 border-[#7A3BFF]/50 text-white"
                : "bg-white/[0.04] border-white/[0.08] text-white/35 hover:bg-white/[0.07] hover:text-white/65 hover:border-white/15"
            }`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
