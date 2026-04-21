import { SCRIPT_STYLES } from "../../lib/scriptTemplates";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Platform → short label
const PLATFORM_SHORT = {
  "YouTube Long": "YT Long",
  "YouTube Shorts": "YT Shorts",
  "Instagram Reels": "IG Reels",
  TikTok: "TikTok",
};

// Style → descriptor
const STYLE_LABEL = {
  Shock: "Shock",
  "Curiosity Gap": "Curiosity",
  Storytelling: "Story",
  Authority: "Authority",
};

const PRESETS = SCRIPT_STYLES.filter((s) => s.id !== "custom");
const CUSTOM = SCRIPT_STYLES.find((s) => s.id === "custom");

function StyleCard({ style, onClick }) {
  const platform = style.defaults?.platform;
  const platformShort = PLATFORM_SHORT[platform] || platform;
  const scriptStyle = STYLE_LABEL[style.defaults?.style] || style.defaults?.style;

  return (
    <button
      onClick={onClick}
      className="group relative text-left p-4 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-[#7A3BFF]/[0.06] hover:border-[#7A3BFF]/30 transition-all duration-200 active:scale-[0.98] overflow-hidden"
    >
      {/* Accent left bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-opacity duration-200 opacity-60 group-hover:opacity-100"
        style={{ background: style.accentColor }}
      />

      {/* Top row: icon + arrow */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center text-base overflow-hidden"
          style={{ background: `${style.accentColor}18`, border: `1px solid ${style.accentColor}30` }}
        >
          {style.previewImage
            ? <img src={style.previewImage} alt={style.name} className="w-full h-full object-cover" />
            : style.icon}
        </div>
        <span className="text-white/20 group-hover:text-white/50 text-xs transition-colors mt-1">→</span>
      </div>

      {/* Name */}
      <div className="text-white text-[13px] font-semibold leading-tight mb-1">
        {style.name}
      </div>

      {/* Tagline */}
      <div className="text-white/35 text-[11px] leading-snug mb-3">
        {style.tagline}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-1.5">
        {platformShort && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-md font-medium"
            style={{
              background: `${style.accentColor}15`,
              color: style.accentColor,
              border: `1px solid ${style.accentColor}25`,
            }}
          >
            {platformShort}
          </span>
        )}
        {scriptStyle && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-white/35 border border-white/[0.06] font-medium">
            {scriptStyle}
          </span>
        )}
      </div>
    </button>
  );
}

export default function ScriptStylePicker({ onSelect, history = [], onViewHistory }) {
  return (
    <div className="px-5 py-6 flex flex-col gap-6">

      {/* Recent scripts — shown first so mobile users see history immediately */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/30 text-[11px] font-semibold uppercase tracking-widest">Recent</span>
            <span className="text-white/15 text-[10px]">({history.length})</span>
          </div>
          {history.slice(0, 4).map((entry) => (
            <button
              key={entry.id}
              onClick={() => onViewHistory?.(entry)}
              className="w-full text-left flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-[#7A3BFF]/[0.06] hover:border-[#7A3BFF]/25 transition-all px-3.5 py-2.5"
            >
              <span className="text-base leading-none shrink-0">{entry.presetIcon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white/65 text-xs font-medium">{entry.preset}</span>
                  {entry.platform && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.07] text-white/30 border border-white/[0.06]">
                      {PLATFORM_SHORT[entry.platform] || entry.platform}
                    </span>
                  )}
                  <span className="text-white/20 text-[10px] ml-auto shrink-0">{timeAgo(entry.createdAt)}</span>
                </div>
                <p className="text-white/25 text-[11px] mt-0.5 truncate">{entry.idea || "No description"}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Section header */}
      <div>
        <h2 className="text-white text-base font-bold tracking-tight">Choose your style</h2>
        <p className="text-white/30 text-xs mt-1">
          Each preset has a tuned creative engine. Pick one and go.
        </p>
      </div>

      {/* Style grid — 2 columns */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          {PRESETS.map((style) => (
            <StyleCard key={style.id} style={style} onClick={() => onSelect(style)} />
          ))}
        </div>

        {/* Custom — full width, different visual treatment */}
        {CUSTOM && (
          <button
            onClick={() => onSelect(CUSTOM)}
            className="group w-full text-left px-4 py-3.5 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-[#7A3BFF]/[0.06] hover:border-[#7A3BFF]/30 transition-all duration-200 active:scale-[0.99] flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-base">
                {CUSTOM.icon}
              </div>
              <div>
                <div className="text-white text-[13px] font-semibold">{CUSTOM.name}</div>
                <div className="text-white/30 text-[11px] mt-0.5">{CUSTOM.tagline}</div>
              </div>
            </div>
            <span className="text-white/20 group-hover:text-white/55 text-sm transition-colors">→</span>
          </button>
        )}
      </div>

    </div>
  );
}
