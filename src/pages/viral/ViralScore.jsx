import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useSEO } from "../../hooks/useSEO";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const CREDIT_COST       = 5;
const MAX_FILE_MB       = 200;
const MAX_DURATION_S    = 180;
const ACCEPTED_MIME     = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_EXT_LABEL = ".mp4  .mov  .webm";

const STAGES = [
  { id: "uploading",  label: "Uploading video" },
  { id: "frames",     label: "Extracting key frames" },
  { id: "hook",       label: "Reading the hook" },
  { id: "retention",  label: "Predicting retention drops" },
  { id: "plan",       label: "Building improvement plan" },
  { id: "score",      label: "Finalizing Viral Score" },
];
const STAGE_MS = [3500, 2500, 4000, 4000, 5000, 99999];

const SUBSCORES = [
  { key: "hook_score",      label: "Hook Strength" },
  { key: "retention_score", label: "Retention Risk" },
  { key: "pacing_score",    label: "Pacing" },
  { key: "clarity_score",   label: "Clarity" },
  { key: "visual_score",    label: "Visual Engagement" },
  { key: "payoff_score",    label: "Payoff Strength" },
  { key: "rewatch_score",   label: "Rewatch Potential" },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fmtBytes = (b) => {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
};

const fmtDur = (s) => {
  if (!s || !isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
};

const scoreTier = (s) => {
  if (s >= 85) return { label: "Very Strong",    hex: "#10B981", ring: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
  if (s >= 75) return { label: "High Potential", hex: "#7A3BFF", ring: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" };
  if (s >= 60) return { label: "Strong",         hex: "#3B82F6", ring: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" };
  if (s >= 45) return { label: "Decent",         hex: "#F59E0B", ring: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" };
  return              { label: "Weak",           hex: "#EF4444", ring: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" };
};

const scoreHex = (s) => {
  if (s >= 75) return "#10B981";
  if (s >= 60) return "#3B82F6";
  if (s >= 45) return "#F59E0B";
  return "#EF4444";
};

/* ── Frame extraction ── */
async function extractFrames(file, count = 7) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url   = URL.createObjectURL(file);
    video.preload     = "metadata";
    video.muted       = true;
    video.playsInline = true;

    const cleanup = () => { video.src = ""; URL.revokeObjectURL(url); };

    video.onloadedmetadata = async () => {
      const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 30;

      // Timestamps: 0.1s, spread across video, last frame
      const ts = [0.1];
      for (let i = 1; i < count - 1; i++) ts.push(Math.min((dur / (count - 1)) * i, dur - 0.2));
      ts.push(Math.max(dur - 0.3, 0.3));

      const frames = [];
      for (const t of ts) {
        try {
          const b64 = await seekAndCapture(video, t);
          if (b64) frames.push({ timestamp: parseFloat(t.toFixed(2)), base64: b64 });
        } catch { /* skip */ }
      }
      cleanup();
      resolve(frames);
    };

    video.onerror = () => { cleanup(); resolve([]); };
    video.src = url;
  });
}

function seekAndCapture(video, ts) {
  return new Promise((resolve, reject) => {
    const tid = setTimeout(() => { video.onseeked = null; reject(new Error("timeout")); }, 6000);
    video.onseeked = () => {
      clearTimeout(tid);
      video.onseeked = null;
      try {
        const canvas = document.createElement("canvas");
        const MAX    = 512;
        const ratio  = video.videoWidth / (video.videoHeight || 1);
        if (ratio >= 1) { canvas.width = MAX; canvas.height = Math.round(MAX / ratio); }
        else            { canvas.height = MAX; canvas.width = Math.round(MAX * ratio); }
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.55));
      } catch (e) { reject(e); }
    };
    video.currentTime = ts;
  });
}

async function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url   = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = video.duration;
      video.src = "";
      URL.revokeObjectURL(url);
      resolve(isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    video.src = url;
  });
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */

/* Score ring */
function ScoreRing({ score, color, size = 130 }) {
  const r     = size * 0.39;
  const circ  = 2 * Math.PI * r;
  const off   = circ - (score / 100) * circ;
  const cx = cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={size * 0.08} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={color}
        strokeWidth={size * 0.08}
        strokeDasharray={circ}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{
          transition: "stroke-dashoffset 1.3s cubic-bezier(0.4,0,0.2,1)",
          filter: `drop-shadow(0 0 10px ${color}55)`,
        }}
      />
      <text x={cx} y={cy - 7} textAnchor="middle" fill="white" fontSize={size * 0.22} fontWeight="700" fontFamily="system-ui, sans-serif">{score}</text>
      <text x={cx} y={cy + size * 0.15} textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize={size * 0.095} fontFamily="system-ui, sans-serif">/ 100</text>
    </svg>
  );
}

/* Copy button */
function CopyBtn({ text, className = "" }) {
  const [ok, setOk] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); });
  };
  return (
    <button
      onClick={copy}
      className={`shrink-0 text-[11px] px-2.5 py-1 rounded-lg border transition-all ${ok ? "text-emerald-400 border-emerald-500/30" : "text-white/30 border-white/10 hover:text-white/70 hover:border-white/25"} ${className}`}
    >
      {ok ? "✓ Copied" : "Copy"}
    </button>
  );
}

/* Sub-score card */
function SubScoreCard({ label, score }) {
  const hex = scoreHex(score);
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/55 text-[12px] font-medium leading-tight">{label}</span>
        <span className="text-[13px] font-bold" style={{ color: hex }}>
          {score}<span className="text-white/20 text-[10px] font-normal">/100</span>
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: hex, boxShadow: `0 0 8px ${hex}50`, transition: "width 1.1s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </div>
    </div>
  );
}

/* Timeline */
function Timeline({ notes, duration }) {
  if (!notes?.length || !duration) return null;

  const COLOR_MAP = {
    "weak hook":      "#EF4444",
    "drop-off":       "#F59E0B",
    "drop off":       "#F59E0B",
    "dead zone":      "#EF4444",
    "strong moment":  "#10B981",
    "best moment":    "#10B981",
    "peak":           "#10B981",
    "engagement":     "#7A3BFF",
  };
  const noteColor = (label = "") => {
    const lower = label.toLowerCase();
    for (const [k, v] of Object.entries(COLOR_MAP)) if (lower.includes(k)) return v;
    return "#7A3BFF";
  };

  return (
    <div>
      {/* Visual bar */}
      <div className="relative h-3 bg-white/[0.05] rounded-full overflow-hidden mb-2">
        {notes.map((n, i) => {
          const left  = Math.max(0, Math.min(99, (n.start / duration) * 100));
          const width = Math.max(1.5, Math.min(100 - left, ((n.end - n.start) / duration) * 100));
          return (
            <div key={i} className="absolute h-full rounded-full opacity-80"
              style={{ left: `${left}%`, width: `${width}%`, background: noteColor(n.label) }} />
          );
        })}
      </div>
      {/* Tick labels */}
      <div className="relative h-5 mb-5 select-none">
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <span key={f} className="absolute text-white/20 text-[10px]"
            style={{ left: `${f * 100}%`, transform: "translateX(-50%)" }}>
            {fmtDur(f * duration)}
          </span>
        ))}
      </div>
      {/* Notes */}
      <div className="space-y-2.5">
        {notes.map((n, i) => {
          const c = noteColor(n.label);
          return (
            <div key={i} className="flex gap-3 items-start bg-white/[0.025] rounded-xl border border-white/[0.05] px-4 py-3.5">
              <div className="shrink-0 flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                <span className="text-[10px] text-white/35 font-mono whitespace-nowrap">
                  {fmtDur(n.start)}–{fmtDur(n.end)}
                </span>
              </div>
              <div>
                <p className="text-[12px] font-semibold mb-1" style={{ color: c }}>{n.label}</p>
                <p className="text-white/45 text-[12px] leading-relaxed">{n.note}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Upsell gate modal */
function UpsellGate({ mode, onClose }) {
  if (!mode) return null;
  const isGuest   = mode === "guest";
  const isCredits = mode === "credits";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative bg-[#181a1f] rounded-2xl border border-white/10 p-8 max-w-sm w-full text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: "0 0 60px rgba(122,59,255,0.15)" }}
      >
        <div className="text-4xl mb-4">{isCredits ? "💎" : isGuest ? "👤" : "⚡"}</div>
        <h2 className="text-white font-bold text-lg mb-2">
          {isGuest   ? "Sign in to analyze" :
           isCredits ? "Not enough credits" :
                       "Upgrade to use Viral Score"}
        </h2>
        <p className="text-white/45 text-sm mb-6 leading-relaxed">
          {isGuest
            ? "Create a free Zyvo account to analyze your videos and get your full viral report."
            : isCredits
            ? `You need ${CREDIT_COST} credits to run an analysis. Top up your balance to continue.`
            : "Viral Score is a premium tool. Upgrade your plan to unlock AI-powered video analysis."}
        </p>
        <a
          href={isGuest ? "/signup" : "/pricing"}
          className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)" }}
        >
          {isGuest ? "Sign Up Free" : isCredits ? "Add Credits" : "View Plans"}
        </a>
        <button onClick={onClose} className="block mx-auto mt-4 text-white/25 text-sm hover:text-white/55 transition-colors">
          Maybe later
        </button>
      </div>
    </div>
  );
}

/* Empty state (right panel before upload) */
function EmptyState() {
  const cards = [
    {
      icon: "⚡",
      label: "Viral Score",
      desc: "Overall virality potential out of 100",
      glow: "rgba(122,59,255,0.25)",
      border: "border-[#7A3BFF]/30",
      iconBg: "bg-[#7A3BFF]/30",
      bg: "bg-[#7A3BFF]/10",
    },
    {
      icon: "🪝",
      label: "Hook Breakdown",
      desc: "Frame-by-frame read of your first 3 seconds",
      glow: "rgba(255,87,178,0.25)",
      border: "border-[#FF57B2]/30",
      iconBg: "bg-[#FF57B2]/25",
      bg: "bg-[#FF57B2]/10",
    },
    {
      icon: "📉",
      label: "Retention Risk",
      desc: "Pinpoints exactly where viewers drop off",
      glow: "rgba(245,158,11,0.25)",
      border: "border-[#F59E0B]/30",
      iconBg: "bg-[#F59E0B]/25",
      bg: "bg-[#F59E0B]/10",
    },
    {
      icon: "🔧",
      label: "Top Fixes",
      desc: "3–5 specific edits you can make right now",
      glow: "rgba(59,130,246,0.25)",
      border: "border-[#3B82F6]/30",
      iconBg: "bg-[#3B82F6]/25",
      bg: "bg-[#3B82F6]/10",
    },
    {
      icon: "✍️",
      label: "Rewritten Hooks",
      desc: "3 stronger openings written for your video",
      glow: "rgba(16,185,129,0.25)",
      border: "border-[#10B981]/30",
      iconBg: "bg-[#10B981]/25",
      bg: "bg-[#10B981]/10",
    },
    {
      icon: "🎞️",
      label: "Retention Timeline",
      desc: "Visual map of every high and low moment",
      glow: "rgba(168,85,247,0.25)",
      border: "border-[#A855F7]/30",
      iconBg: "bg-[#A855F7]/25",
      bg: "bg-[#A855F7]/10",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 overflow-y-auto">
      {/* Sad logo */}
      <div className="flex flex-col items-center mb-8">
        <img src="/assets/logos/sadzyvo.webp" className="w-16 h-16 mb-4" alt="" />
        <p className="text-white font-semibold text-sm mb-1">No creations yet</p>
        <p className="text-white/40 text-[12px]">Upload a video on the left to get your Viral Score</p>
      </div>

      {/* Feature cards grid */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`${c.bg} border ${c.border} rounded-2xl p-4 text-left`}
            style={{ boxShadow: `0 0 20px ${c.glow}` }}
          >
            <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center text-[17px] mb-3`}>
              {c.icon}
            </div>
            <p className="font-bold text-white text-[13px] mb-1">{c.label}</p>
            <p className="text-white/50 text-[11px] leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Loading state */
function LoadingState({ currentStage }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16">
      <div className="w-full max-w-xs">
        <p className="text-white/30 text-[11px] font-semibold uppercase tracking-widest text-center mb-8">
          Analyzing your video
        </p>
        <div className="space-y-3">
          {STAGES.map((s, i) => {
            const done    = i < currentStage;
            const active  = i === currentStage;
            const pending = i > currentStage;
            return (
              <div key={s.id} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-500 ${active ? "bg-[#7A3BFF]/12 border border-[#7A3BFF]/25" : "border border-transparent"}`}>
                {/* Icon */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${done ? "bg-emerald-500/20" : active ? "bg-[#7A3BFF]/25" : "bg-white/[0.04]"}`}>
                  {done   && <span className="text-emerald-400 text-[11px]">✓</span>}
                  {active && (
                    <span className="block w-2 h-2 rounded-full bg-[#7A3BFF]"
                      style={{ animation: "pulse 1.2s ease-in-out infinite" }} />
                  )}
                  {pending && <span className="block w-1.5 h-1.5 rounded-full bg-white/15" />}
                </div>
                {/* Label */}
                <span className={`text-[13px] font-medium transition-all duration-300 ${done ? "text-white/40" : active ? "text-white" : "text-white/20"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Progress bar */}
        <div className="mt-8 h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.round(((currentStage + 1) / STAGES.length) * 100)}%`,
              background: "linear-gradient(90deg, #7A3BFF, #9D6BFF)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* Failed state */
function FailedState({ message, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl mb-5">❌</div>
      <h2 className="text-white font-bold text-base mb-2">Analysis Failed</h2>
      <p className="text-white/40 text-sm max-w-xs leading-relaxed mb-6">{message || "Something went wrong during analysis."}</p>
      <button
        onClick={onReset}
        className="px-6 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-medium hover:text-white hover:border-white/25 transition-all"
      >
        Try again
      </button>
    </div>
  );
}

/* Full results view */
function ResultView({ report }) {
  const tier = scoreTier(report.overall_score ?? 0);
  const dur  = Number(report.duration_seconds ?? 0);

  return (
    <div className="overflow-y-auto h-full">
      <div className="px-5 py-6 space-y-5 pb-16">

        {/* ── Score Card ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex gap-5 items-center" style={{ animation: "fadeIn 0.4s ease both" }}>
          <div className="shrink-0">
            <ScoreRing score={report.overall_score ?? 0} color={tier.hex} size={120} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border mb-3 ${tier.bg}`}>
              <span style={{ color: tier.hex }}>●</span>
              <span style={{ color: tier.hex }}>{tier.label}</span>
            </div>
            <p className="text-white/80 text-[14px] leading-relaxed">{report.verdict}</p>
          </div>
        </div>

        {/* ── Sub-scores ── */}
        <div style={{ animation: "fadeIn 0.4s 0.08s ease both", opacity: 0 }}>
          <SectionLabel>Score Breakdown</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {SUBSCORES.map((s) => (
              <SubScoreCard key={s.key} label={s.label} score={report[s.key] ?? 0} />
            ))}
          </div>
        </div>

        {/* ── Brutal Truth ── */}
        {(report.biggest_problem || report.biggest_opportunity) && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden" style={{ animation: "fadeIn 0.4s 0.15s ease both", opacity: 0 }}>
            <div className="px-5 py-3 border-b border-white/[0.05] bg-white/[0.02]">
              <span className="text-white/40 text-[11px] font-bold uppercase tracking-widest">Brutal Truth</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
              {report.biggest_problem && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center text-[10px]">⚠</div>
                    <span className="text-red-400 text-[11px] font-bold uppercase tracking-wider">Biggest Problem</span>
                  </div>
                  <p className="text-white/60 text-[13px] leading-relaxed">{report.biggest_problem}</p>
                </div>
              )}
              {report.biggest_opportunity && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-[10px]">✦</div>
                    <span className="text-emerald-400 text-[11px] font-bold uppercase tracking-wider">Biggest Opportunity</span>
                  </div>
                  <p className="text-white/60 text-[13px] leading-relaxed">{report.biggest_opportunity}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        {report.timeline_notes?.length > 0 && (
          <div style={{ animation: "fadeIn 0.4s 0.22s ease both", opacity: 0 }}>
            <SectionLabel>Retention Timeline</SectionLabel>
            <div className="bg-white/[0.025] rounded-2xl border border-white/[0.06] p-5">
              <Timeline notes={report.timeline_notes} duration={dur || 30} />
            </div>
          </div>
        )}

        {/* ── Top Fixes ── */}
        {report.top_fixes?.length > 0 && (
          <div style={{ animation: "fadeIn 0.4s 0.28s ease both", opacity: 0 }}>
            <SectionLabel>Top Fixes</SectionLabel>
            <div className="space-y-2.5">
              {report.top_fixes.map((fix, i) => (
                <div key={i} className="flex gap-3 items-start bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#7A3BFF]/20 flex items-center justify-center text-[#9B6DFF] text-[11px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-white/70 text-[13px] leading-relaxed">{fix}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rewritten Hooks ── */}
        {report.rewritten_hooks?.length > 0 && (
          <div style={{ animation: "fadeIn 0.4s 0.34s ease both", opacity: 0 }}>
            <SectionLabel>Rewritten Hooks</SectionLabel>
            <div className="space-y-2.5">
              {report.rewritten_hooks.map((hook, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5">
                  <span className="text-[#9B6DFF] text-[11px] font-bold shrink-0 mt-0.5 w-5">#{i + 1}</span>
                  <p className="text-white/75 text-[13px] leading-relaxed flex-1">"{hook}"</p>
                  <CopyBtn text={hook} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Caption + Structure ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ animation: "fadeIn 0.4s 0.40s ease both", opacity: 0 }}>
          {report.improved_caption && (
            <div>
              <SectionLabel>Improved Caption</SectionLabel>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-white/65 text-[13px] leading-relaxed mb-3">{report.improved_caption}</p>
                <CopyBtn text={report.improved_caption} />
              </div>
            </div>
          )}
          {report.improved_structure?.length > 0 && (
            <div>
              <SectionLabel>Improved Structure</SectionLabel>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
                {report.improved_structure.map((step, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span className="text-white/25 text-[11px] font-mono shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <p className="text-white/60 text-[12px] leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2.5 px-0.5">{children}</p>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function ViralScore() {
  useSEO({
    title: "Viral Score Analyzer — Rate Your Short-Form Video | Zyvo",
    description:
      "Upload your TikTok, Reel, or YouTube Short and get a detailed virality report: hook strength, retention risk, top fixes, and rewritten hooks — powered by AI.",
    canonical: "https://www.tryzyvo.com/workspace/viral-score",
  });

  /* ── state ── */
  const [file,          setFile]          = useState(null);
  const [previewUrl,    setPreviewUrl]     = useState(null);
  const [fileDuration,  setFileDuration]  = useState(null);
  const [dragOver,      setDragOver]      = useState(false);

  const [status,        setStatus]        = useState("idle");   // idle | analyzing | completed | failed
  const [currentStage,  setCurrentStage]  = useState(0);
  const [report,        setReport]        = useState(null);
  const [reportId,      setReportId]      = useState(null);
  const [errorMsg,      setErrorMsg]      = useState("");

  const [userId,        setUserId]        = useState(null);
  const [planCode,      setPlanCode]      = useState(null);
  const [upsellMode,    setUpsellMode]    = useState(null);

  const [mobileView,    setMobileView]    = useState("input");  // input | result

  const stageTimerRef  = useRef(null);
  const channelRef     = useRef(null);
  const fileInputRef   = useRef(null);

  /* ── Auth init ── */
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth?.session?.user;
      if (!mounted) return;
      if (!user) { setUserId(null); setPlanCode(null); return; }
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("plan_code").eq("id", user.id).single();
      if (mounted) setPlanCode((profile?.plan_code || "free").toLowerCase());
    };
    init();
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) init();
      else { setUserId(null); setPlanCode(null); }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      clearTimeout(stageTimerRef.current);
      channelRef.current?.unsubscribe();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /* ── Stage animation ── */
  const startStageAnimation = useCallback(() => {
    let idx = 0;
    const advance = () => {
      if (idx < STAGES.length - 2) {
        idx++;
        setCurrentStage(idx);
        stageTimerRef.current = setTimeout(advance, STAGE_MS[idx]);
      }
    };
    stageTimerRef.current = setTimeout(advance, STAGE_MS[0]);
  }, []);

  /* ── Realtime subscription ── */
  const subscribeToReport = useCallback((id) => {
    const channel = supabase
      .channel(`viral-score-${id}`)
      .on("postgres_changes", {
        event:  "UPDATE",
        schema: "public",
        table:  "viral_score_reports",
        filter: `id=eq.${id}`,
      }, (payload) => {
        const r = payload.new;
        if (r.status === "completed") {
          clearTimeout(stageTimerRef.current);
          setCurrentStage(STAGES.length - 1);
          setTimeout(() => {
            setReport(r);
            setStatus("completed");
            setMobileView("result");
          }, 600);
          channel.unsubscribe();
        } else if (r.status === "failed") {
          clearTimeout(stageTimerRef.current);
          setStatus("failed");
          setErrorMsg(r.error_message || "Analysis failed. Please try again.");
          channel.unsubscribe();
        }
      })
      .subscribe();
    channelRef.current = channel;

    // Fallback: poll every 3s
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("viral_score_reports")
        .select("*")
        .eq("id", id)
        .single();
      if (data?.status === "completed") {
        clearInterval(pollInterval);
        clearTimeout(stageTimerRef.current);
        setCurrentStage(STAGES.length - 1);
        setTimeout(() => { setReport(data); setStatus("completed"); setMobileView("result"); }, 600);
      } else if (data?.status === "failed") {
        clearInterval(pollInterval);
        clearTimeout(stageTimerRef.current);
        setStatus("failed");
        setErrorMsg(data.error_message || "Analysis failed.");
      }
    }, 3000);
    // Store cleanup
    const origUnsub = channel.unsubscribe.bind(channel);
    channel.unsubscribe = () => { origUnsub(); clearInterval(pollInterval); };
    channelRef.current = channel;
  }, []);

  /* ── File handling ── */
  const handleFile = useCallback(async (f) => {
    if (!f) return;
    if (!ACCEPTED_MIME.includes(f.type)) {
      setErrorMsg("Unsupported format. Please upload an MP4, MOV, or WebM file.");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setErrorMsg(`File too large. Maximum size is ${MAX_FILE_MB} MB.`);
      return;
    }
    setErrorMsg("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setFile(f);
    setPreviewUrl(url);
    const dur = await getVideoDuration(f);
    if (dur && dur > MAX_DURATION_S) {
      setErrorMsg(`Video is too long (${fmtDur(dur)}). Max is ${fmtDur(MAX_DURATION_S)}.`);
      setFile(null);
      setPreviewUrl(null);
      URL.revokeObjectURL(url);
      return;
    }
    setFileDuration(dur);
  }, [previewUrl]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleRemoveFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setFileDuration(null);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ── Main analysis flow ── */
  const handleAnalyze = async () => {
    if (!file) return;

    // Gate: auth
    if (!userId) { setUpsellMode("guest"); return; }
    // Gate: plan
    if (planCode === "free") { setUpsellMode("free"); return; }

    // Deduct credits first
    const { error: creditErr } = await supabase.rpc("deduct_credits", {
      uid: userId, amount: CREDIT_COST,
    });
    if (creditErr) {
      if (creditErr.message?.includes("INSUFFICIENT_CREDITS")) { setUpsellMode("credits"); return; }
      setErrorMsg("Failed to check credits. Please try again.");
      return;
    }

    // Start UI
    setStatus("analyzing");
    setCurrentStage(0);
    setErrorMsg("");
    startStageAnimation();

    try {
      // Extract frames
      const frames = await extractFrames(file, 7);

      // Upload video
      const ext  = file.name.split(".").pop() || "mp4";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("viral-score-videos")
        .upload(path, file, { upsert: false });
      if (upErr) throw new Error("Upload failed: " + upErr.message);

      // Create report row
      const { data: row, error: insertErr } = await supabase
        .from("viral_score_reports")
        .insert({
          user_id:          userId,
          video_path:       path,
          source_type:      "upload",
          status:           "processing",
          duration_seconds: fileDuration ?? null,
        })
        .select()
        .single();
      if (insertErr || !row) throw new Error("Failed to create report row.");
      setReportId(row.id);

      // Subscribe to updates
      subscribeToReport(row.id);

      // Call edge function (fire-and-forget — result comes via realtime)
      supabase.functions.invoke("analyze-viral-score", {
        body: { reportId: row.id, frames, duration: fileDuration ?? 30 },
      }).then(({ error: fnErr }) => {
        if (fnErr) {
          clearTimeout(stageTimerRef.current);
          setStatus("failed");
          setErrorMsg(fnErr.message || "Analysis failed. Please try again.");
        }
      });

    } catch (e) {
      clearTimeout(stageTimerRef.current);
      setStatus("failed");
      setErrorMsg(e.message || "Something went wrong. Please try again.");
    }
  };

  const handleReset = () => {
    clearTimeout(stageTimerRef.current);
    channelRef.current?.unsubscribe();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setFileDuration(null);
    setStatus("idle");
    setCurrentStage(0);
    setReport(null);
    setReportId(null);
    setErrorMsg("");
    setMobileView("input");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isAnalyzing = status === "analyzing";
  const rightView   = status === "idle"      ? "empty"
                    : status === "analyzing"  ? "loading"
                    : status === "completed"  ? "result"
                    : "failed";

  /* ═══════════════ LEFT PANEL ═══════════════ */
  const LeftPanel = (
    <div className={`w-full xl:max-w-[420px] xl:min-w-[380px] border-r border-white/[0.06] bg-[#111314] flex flex-col ${mobileView === "result" ? "hidden xl:flex" : "flex"}`}>

      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: "linear-gradient(135deg, #7A3BFF, #FF57B2)", boxShadow: "0 0 16px rgba(122,59,255,0.5)" }}
          >
            ⚡
          </div>
          <div>
            <h1 className="text-white text-sm font-bold leading-tight flex items-center gap-2">
              Viral Score
              <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-[#FF57B2]/20 text-[#FF57B2] border border-[#FF57B2]/30">beta</span>
            </h1>
            <p className="text-white/50 text-[11px]">AI-powered virality analysis</p>
          </div>
        </div>
        {status === "completed" && (
          <button onClick={handleReset} className="text-[11px] text-white/35 hover:text-white/70 border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg transition-all">
            + New
          </button>
        )}
        {status === "completed" && (
          <button
            onClick={() => setMobileView("result")}
            className="xl:hidden text-[11px] text-[#9B6DFF] border border-[#7A3BFF]/40 px-3 py-1.5 rounded-lg font-medium hover:bg-[#7A3BFF]/10 transition-all"
          >
            View Report →
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-24 xl:pb-6">
        <div className="px-5 py-5 space-y-4">

          {/* Upload zone */}
          {!file && !isAnalyzing && status !== "completed" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 py-14 cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? "border-[#9B6DFF] bg-[#7A3BFF]/12"
                    : "border-[#7A3BFF]/40 hover:border-[#7A3BFF]/70 hover:bg-[#7A3BFF]/06"
                }`}
                style={{
                  boxShadow: dragOver
                    ? "0 0 40px rgba(122,59,255,0.3), inset 0 0 60px rgba(122,59,255,0.08)"
                    : "0 0 20px rgba(122,59,255,0.12)",
                }}
              >
                {/* Upload icon */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${dragOver ? "bg-[#7A3BFF]/40" : "bg-[#7A3BFF]/20"}`}
                  style={{ boxShadow: "0 0 20px rgba(122,59,255,0.3)" }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={dragOver ? "#C4A0FF" : "#9B6DFF"} strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className={`text-[14px] font-bold mb-1 transition-colors ${dragOver ? "text-white" : "text-white/80"}`}>
                    {dragOver ? "Drop to analyze" : "Drop your video here"}
                  </p>
                  <p className="text-white/40 text-[12px]">or click to browse</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center px-4">
                  {[
                    { ext: "MP4", color: "text-[#9B6DFF] bg-[#7A3BFF]/20 border-[#7A3BFF]/30" },
                    { ext: "MOV", color: "text-[#FF57B2] bg-[#FF57B2]/15 border-[#FF57B2]/25" },
                    { ext: "WebM", color: "text-[#60A5FA] bg-[#3B82F6]/15 border-[#3B82F6]/25" },
                  ].map(({ ext, color }) => (
                    <span key={ext} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border font-mono ${color}`}>{ext}</span>
                  ))}
                  <span className="text-white/30 text-[10px]">· max {MAX_FILE_MB}MB · {fmtDur(MAX_DURATION_S)}</span>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </>
          )}

          {/* File preview */}
          {file && status !== "completed" && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
              {/* Video preview */}
              <div className="relative w-full bg-black" style={{ aspectRatio: "9/5" }}>
                {previewUrl && (
                  <video
                    src={previewUrl}
                    className="w-full h-full object-contain"
                    controls
                    muted
                    playsInline
                    style={{ maxHeight: 220 }}
                  />
                )}
                {!isAnalyzing && (
                  <button
                    onClick={handleRemoveFile}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/80 transition-all text-[11px]"
                  >
                    ✕
                  </button>
                )}
              </div>
              {/* File meta */}
              <div className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white/70 text-[12px] font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {fileDuration && <span className="text-white/30 text-[11px]">{fmtDur(fileDuration)}</span>}
                    <span className="text-white/20 text-[11px]">·</span>
                    <span className="text-white/30 text-[11px]">{fmtBytes(file.size)}</span>
                    <span className="text-white/20 text-[11px]">·</span>
                    <span className="text-white/30 text-[11px] uppercase">{file.name.split(".").pop()}</span>
                  </div>
                </div>
                {!isAnalyzing && (
                  <button onClick={handleRemoveFile} className="text-white/25 hover:text-white/60 text-[11px] shrink-0 transition-colors mt-0.5">
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {errorMsg && status === "idle" && (
            <div className="flex items-start gap-2.5 bg-red-500/08 border border-red-500/20 rounded-xl px-4 py-3">
              <span className="text-red-400 text-[13px] shrink-0">⚠</span>
              <p className="text-red-400/80 text-[12px] leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Analyze button */}
          {file && !isAnalyzing && status !== "completed" && (
            <button
              onClick={handleAnalyze}
              disabled={!!errorMsg}
              className="w-full py-4 rounded-xl font-bold text-white text-[15px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
              style={{
                background: "linear-gradient(135deg, #7A3BFF 0%, #FF57B2 100%)",
                boxShadow: "0 4px 32px rgba(122,59,255,0.45), 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              ⚡ Analyze Video
              <span className="text-white/50 text-[12px] font-normal">· {CREDIT_COST} credits</span>
            </button>
          )}

          {/* TikTok link — coming soon */}
          <div className="rounded-xl border border-[#FF57B2]/15 bg-[#FF57B2]/05 px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/60 text-[12px] font-semibold flex items-center gap-2">
                <span>🎵</span> Analyze from TikTok URL
              </label>
              <span className="text-[10px] text-[#FF57B2]/70 bg-[#FF57B2]/10 border border-[#FF57B2]/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                Coming soon
              </span>
            </div>
            <input
              disabled
              type="url"
              placeholder="https://www.tiktok.com/@..."
              className="w-full bg-transparent text-white/30 text-[12px] placeholder-white/20 outline-none cursor-not-allowed"
            />
          </div>

        </div>
      </div>
    </div>
  );

  /* ═══════════════ RIGHT PANEL ═══════════════ */
  const RightPanel = (
    <div className="hidden xl:flex flex-1 flex-col overflow-hidden bg-[#111314]">
      {/* Right header */}
      <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
          {rightView === "empty" ? "Output" : rightView === "loading" ? "Analyzing…" : rightView === "result" ? "Viral Score Report" : "Analysis Failed"}
        </span>
        {status === "completed" && (
          <button onClick={handleReset} className="text-xs text-white/35 hover:text-white/70 border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg transition-all">
            + New Analysis
          </button>
        )}
      </div>

      {/* Right body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {rightView === "empty"   && <EmptyState />}
        {rightView === "loading" && <LoadingState currentStage={currentStage} />}
        {rightView === "result"  && report && <ResultView report={report} />}
        {rightView === "failed"  && <FailedState message={errorMsg} onReset={handleReset} />}
      </div>
    </div>
  );

  /* ═══════════════ MOBILE RESULT OVERLAY ═══════════════ */
  const MobileResult = mobileView === "result" && status !== "idle" && (
    <div className="xl:hidden flex flex-col w-full h-full bg-[#111314]">
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <button
          onClick={() => setMobileView("input")}
          className="flex items-center gap-2 text-white/45 hover:text-white/80 text-sm transition-colors"
        >
          <span className="text-base">←</span>
          <span>Back</span>
        </button>
        <span className="text-white text-sm font-semibold">
          {rightView === "loading" ? "Analyzing…" : rightView === "result" ? "Viral Score Report" : "Analysis Failed"}
        </span>
        {status === "completed" && (
          <button onClick={handleReset} className="text-xs text-[#9B6DFF] font-medium hover:text-[#B88FFF] transition-colors">New</button>
        )}
        {status !== "completed" && <div className="w-8" />}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {rightView === "loading" && <LoadingState currentStage={currentStage} />}
        {rightView === "result"  && report && <ResultView report={report} />}
        {rightView === "failed"  && <FailedState message={errorMsg} onReset={handleReset} />}
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex overflow-hidden bg-[#111314]">
      {MobileResult || LeftPanel}
      {RightPanel}
      <UpsellGate mode={upsellMode} onClose={() => setUpsellMode(null)} />
    </div>
  );
}
