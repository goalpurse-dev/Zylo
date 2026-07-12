import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X, ChevronLeft, ChevronDown, Sparkles, Send, AlertTriangle,
  Upload, Clock, Loader2, CheckCircle2, CalendarClock, Check,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const MAX_CAPTION   = 2200;
const MAX_YT_TITLE  = 100;
const ACCEPTED      = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

/* ── Instagram gradient icon ─────────────────────────────────────────────── */
function IgIconGradient({ size = 16 }) {
  const id = "ig-grad-pm";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#FCAF45" />
          <stop offset="30%"  stopColor="#FD1D1D" />
          <stop offset="70%"  stopColor="#C13584" />
          <stop offset="100%" stopColor="#833AB4" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

/* ── Video thumbnail card ─────────────────────────────────────────────────── */
function VideoThumb({ video, selected, onClick, postStatus }) {
  const ref = useRef(null);
  // postStatus: array of platforms ("instagram" | "youtube" | "tiktok") already posted/scheduled here, or null.
  // This is informational only — the video stays fully reusable.
  const platforms = postStatus || [];

  return (
    <button
      onClick={onClick}
      className={`group relative aspect-[9/16] w-full overflow-hidden rounded-xl border-2 transition-all ${
        selected
          ? "border-[#7A3BFF] ring-2 ring-[#7A3BFF]/30"
          : "border-transparent hover:border-white/20"
      }`}
    >
      <video
        ref={ref}
        src={video.result_url}
        className="h-full w-full object-cover"
        muted preload="metadata"
        onMouseEnter={() => ref.current?.play().catch(() => {})}
        onMouseLeave={() => { if (ref.current) { ref.current.pause(); ref.current.currentTime = 0; } }}
      />

      {/* Already posted/scheduled badges — informational, doesn't block reuse */}
      {platforms.length > 0 && (
        <div className="absolute left-1.5 top-1.5 flex items-center -space-x-1.5">
          {platforms.includes("youtube") && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1420] ring-1 ring-black/50">
              <YtIcon size={11} />
            </span>
          )}
          {platforms.includes("instagram") && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1420] ring-1 ring-black/50">
              <IgIconGradient size={11} />
            </span>
          )}
          {platforms.includes("tiktok") && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1420] ring-1 ring-black/50">
              <TtIcon size={11} />
            </span>
          )}
        </div>
      )}

      {/* Selected indicator */}
      {selected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#7A3BFF]">
          <CheckCircle2 className="h-3 w-3 text-white" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
    </button>
  );
}

/* ── YouTube icon ────────────────────────────────────────────────────────── */
function YtIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-[#FF0000]">
      <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
  );
}

/* ── TikTok icon ─────────────────────────────────────────────────────────── */
function TtIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-white">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.79a8.18 8.18 0 004.78 1.52V6.85a4.85 4.85 0 01-1.01-.16z"/>
    </svg>
  );
}

/* ── Platform metadata helpers ───────────────────────────────────────────── */
const PLATFORM_LABELS = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" };

function PlatformIcon({ platform, size = 16 }) {
  if (platform === "youtube") return <YtIcon size={size} />;
  if (platform === "tiktok")  return <TtIcon size={size} />;
  return <IgIconGradient size={size} />;
}

const TT_PRIVACY_LABELS = {
  PUBLIC_TO_EVERYONE:    "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends (mutual follows)",
  FOLLOWER_OF_CREATOR:   "Followers",
  SELF_ONLY:             "Only me",
};

/* ── Platform selector pill ──────────────────────────────────────────────── */
function PlatformPill({ account, selected, onToggle }) {
  const isYT = account.platform === "youtube";
  const platform = account.platform;
  return (
    <button
      onClick={onToggle}
      className={`relative flex w-full items-center gap-2 overflow-hidden rounded-xl border px-4 py-2.5 transition-all duration-300 ${
        selected
          ? "border-[#7A3BFF]/25 bg-[#151220] text-white shadow-[0_0_0_1px_rgba(122,59,255,0.08)]"
          : "border-white/[0.07] bg-white/[0.03] text-white/50 hover:border-white/15"
      }`}
    >
      {selected && (
        <>
          {/* dark → subtly-brighter wave, low-key like a shadow catching light */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#7A3BFF]/10 to-[#7A3BFF]/25" />
          {/* faint looping shimmer sweep for a "dynamic" feel */}
          <span className="absolute inset-0 overflow-hidden">
            <span
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
              style={{ animation: "shimmer 3.2s ease-in-out infinite" }}
            />
          </span>
        </>
      )}

      <div className="relative z-[1] flex flex-1 items-center gap-2 min-w-0">
        <PlatformIcon platform={platform} size={16} />
        <div className="text-left flex-1 min-w-0">
          <p className="text-xs font-semibold leading-none">{PLATFORM_LABELS[platform] ?? platform}</p>
          <p className={`mt-0.5 text-[10px] leading-none ${selected ? "text-white/50" : "text-white/40"}`}>
            {isYT ? (account.display_name || account.username || account.platform_user_id) : `@${account.username || account.platform_user_id}`}
          </p>
        </div>
      </div>

      <div
        className={`relative z-[1] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
          selected ? "border-[#9F5CFF]/70 bg-[#7A3BFF]/20 scale-100" : "border-white/20 scale-90"
        }`}
      >
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
    </button>
  );
}

/* ── Per-platform caption card (collapsible when 2+ platforms selected) ──── */
const CAPTION_CARD_ACCENTS = {
  youtube: {
    border: "border-red-500/25",
    wash:   "bg-gradient-to-b from-red-500/[0.07] to-transparent",
    badge:  "bg-red-500/15 border border-red-500/25",
    ring:   "shadow-[0_0_0_1px_rgba(255,0,0,0.08)]",
    sublabel: "Title & description",
  },
  instagram: {
    border: "border-fuchsia-500/25",
    wash:   "bg-gradient-to-b from-fuchsia-500/[0.06] via-orange-400/[0.03] to-transparent",
    badge:  "bg-white/[0.06] border border-white/10",
    ring:   "shadow-[0_0_0_1px_rgba(219,39,119,0.08)]",
    sublabel: "Caption & hashtags",
  },
  tiktok: {
    border: "border-white/20",
    wash:   "bg-gradient-to-b from-white/[0.05] to-transparent",
    badge:  "bg-white/[0.08] border border-white/15",
    ring:   "shadow-[0_0_0_1px_rgba(255,255,255,0.06)]",
    sublabel: "Caption & posting options",
  },
};

function CaptionCard({
  platform,       // "youtube" | "instagram" | "tiktok"
  collapsible,
  open,
  onToggle,
  ready,          // has content already — shows a little "ready" glow
  children,
}) {
  const accent = CAPTION_CARD_ACCENTS[platform] ?? CAPTION_CARD_ACCENTS.instagram;

  return (
    <div className={`rounded-2xl border ${accent.border} ${accent.wash} ${accent.ring} overflow-hidden transition-all`}>
      <button
        type="button"
        onClick={collapsible ? onToggle : undefined}
        className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left ${collapsible ? "cursor-pointer active:scale-[.995]" : "cursor-default"} transition`}
      >
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent.badge}`}>
          <PlatformIcon platform={platform} size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-bold text-white leading-none">{PLATFORM_LABELS[platform] ?? platform}</p>
            {ready && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            )}
          </div>
          <p className="mt-1 text-[10px] text-white/35 leading-none">
            {accent.sublabel}
          </p>
        </div>
        {collapsible && (
          <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: (!collapsible || open) ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-3.5 pb-3.5 pt-0.5 space-y-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Calendar helpers ────────────────────────────────────────────────────── */
function VideoFirstFrame({ src }) {
  const ref = useRef(null);
  return (
    <video
      ref={ref}
      src={src}
      className="absolute inset-0 h-full w-full object-cover brightness-[0.45]"
      muted playsInline preload="metadata"
      onLoadedMetadata={() => { if (ref.current) ref.current.currentTime = 0.1; }}
    />
  );
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function ScheduleCalendar({ scheduledJobs = [], videos = [], selectedDate, onSelectDate }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const minDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 1); return d; }, [today]);
  const maxDate = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 30); return d; }, [today]);

  const [viewYear, setViewYear]   = useState(minDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(minDate.getMonth());

  // Build booked map: dateStr → { time, thumbnail }
  const bookedMap = useMemo(() => {
    const map = {};
    for (const job of scheduledJobs) {
      if (!job.scheduled_for) continue;
      const d   = new Date(job.scheduled_for);
      const key = d.toLocaleDateString("sv"); // YYYY-MM-DD
      if (!map[key]) {
        const video = videos.find(v => v.id === job.creation_id);
        map[key] = {
          time:      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
          thumbnail: video?.result_url ?? null,
        };
      }
    }
    return map;
  }, [scheduledJobs, videos]);

  // Grid: Mon-aligned weeks containing the view month
  const days = useMemo(() => {
    const first     = new Date(viewYear, viewMonth, 1);
    const last      = new Date(viewYear, viewMonth + 1, 0);
    const startOff  = (first.getDay() + 6) % 7; // Mon=0
    const endOff    = (7 - last.getDay()) % 7;
    const grid      = [];
    for (let i = -startOff; i <= last.getDate() - 1 + endOff; i++) {
      const d = new Date(viewYear, viewMonth, 1 + i);
      grid.push(d);
    }
    return grid;
  }, [viewYear, viewMonth]);

  function changeMonth(delta) {
    let m = viewMonth + delta, y = viewYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setViewMonth(m); setViewYear(y);
  }

  const prevFirst = new Date(viewYear, viewMonth - 1, 1);
  const nextFirst = new Date(viewYear, viewMonth + 1, 1);
  const canPrev   = new Date(viewYear, viewMonth, 0) >= minDate; // last day of prev month >= min
  const canNext   = nextFirst <= maxDate;

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-[#7A3BFF]/30 bg-[#0c0e12] p-3 select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2.5">
        <button
          onClick={() => changeMonth(-1)} disabled={!canPrev}
          className="h-6 w-6 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-default transition text-sm"
        >‹</button>
        <p className="text-[12px] font-bold text-white">{monthLabel}</p>
        <button
          onClick={() => changeMonth(1)} disabled={!canNext}
          className="h-6 w-6 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-default transition text-sm"
        >›</button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-semibold text-white/20 py-0.5">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-[3px]">
        {days.map(day => {
          const key          = day.toLocaleDateString("sv");
          const inMonth      = day.getMonth() === viewMonth;
          const isValid      = day >= minDate && day <= maxDate;
          const isSelected   = selectedDate === key;
          const booked       = bookedMap[key];

          return (
            <button
              key={key}
              disabled={!isValid}
              onClick={() => isValid && onSelectDate(key)}
              className={`relative aspect-square rounded-lg overflow-hidden transition-all ${
                !inMonth    ? "opacity-20" : ""
              } ${
                !isValid    ? "cursor-default opacity-25 bg-white/[0.02]" :
                isSelected  ? "ring-2 ring-[#7A3BFF] ring-offset-[2px] ring-offset-[#0c0e12] bg-[#7A3BFF]/30 cursor-pointer" :
                booked      ? "cursor-pointer" :
                              "bg-white/[0.04] hover:bg-white/[0.09] cursor-pointer"
              }`}
            >
              {/* Thumbnail for booked day */}
              {booked?.thumbnail && <VideoFirstFrame src={booked.thumbnail} />}
              {booked && !booked.thumbnail && (
                <div className="absolute inset-0 bg-[#7A3BFF]/25" />
              )}

              {/* Date number */}
              <span className={`absolute top-0.5 left-1 text-[10px] font-bold z-10 leading-none ${
                isSelected ? "text-white" : booked ? "text-white" : isValid ? "text-white/65" : "text-white/20"
              }`}>
                {day.getDate()}
              </span>

              {/* Time badge for booked */}
              {booked && (
                <span className="absolute bottom-0.5 inset-x-0 text-center text-[7.5px] font-bold text-emerald-300 z-10 leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {booked.time}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-[10px] text-white/20 text-center">
        Available <span className="text-white/35 font-semibold">tomorrow → +30 days</span>
      </p>
    </div>
  );
}

/* ── Main drawer ─────────────────────────────────────────────────────────── */
export default function PostModal({
  igAccounts = [],
  ytAccounts = [],
  ttAccounts = [],
  videos: videosProp = [],
  loadingVideos: loadingProp = false,
  onConnectInstagram,
  onClose,
  onPublished,
  // Map of creation_id → 'scheduled' | 'published'
  videoPostStatus = {},
  // Array of queued/scheduled publish jobs (for calendar thumbnail preview)
  scheduledJobs = [],
  // "YYYY-MM-DD" — when set (e.g. opened via a queue day's "Add Video"),
  // step 2 opens straight into the Schedule section with this date preset.
  initialScheduleDate = null,
}) {
  const allAccounts = useMemo(() => [...ytAccounts, ...igAccounts, ...ttAccounts], [igAccounts, ytAccounts, ttAccounts]);

  const [visible, setVisible]                   = useState(false);
  const [step, setStep]                         = useState(1);   // 1=pick, 2=details
  const [selectedVideo, setSelectedVideo]       = useState(null);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [igCaption, setIgCaption]               = useState("");
  const [ytTitle, setYtTitle]                   = useState("");
  const [ytDescription, setYtDescription]       = useState("");
  const [ytCardOpen, setYtCardOpen]             = useState(true);
  const [igCardOpen, setIgCardOpen]             = useState(true);
  const [ttCardOpen, setTtCardOpen]             = useState(true);
  const [generatingIgCaption, setGeneratingIgCaption] = useState(false);
  const [generatingYtDescription, setGeneratingYtDescription] = useState(false);
  // TikTok
  const [ttCaption, setTtCaption]               = useState("");
  const [ttPublishMode, setTtPublishMode]       = useState("draft"); // "draft" | "direct"
  const [ttPrivacyLevel, setTtPrivacyLevel]     = useState("");
  const [ttDisableComment, setTtDisableComment] = useState(false);
  const [ttDisableDuet, setTtDisableDuet]       = useState(false);
  const [ttDisableStitch, setTtDisableStitch]   = useState(false);
  const [ttOptions, setTtOptions]               = useState(null);   // creator_info response
  const [ttOptionsAccountId, setTtOptionsAccountId] = useState(null);
  const [loadingTtOptions, setLoadingTtOptions] = useState(false);
  const [ttOptionsError, setTtOptionsError]     = useState("");
  const [publishing, setPublishing]             = useState(false);
  const [publishError, setPublishError]         = useState("");
  const [dragging, setDragging]                 = useState(false);
  const [uploading, setUploading]               = useState(false);
  const [uploadProgress, setUploadProgress]     = useState(0);
  // Schedule state
  const [scheduleMode, setScheduleMode]         = useState(false);
  const [scheduleDate, setScheduleDate]         = useState("");
  const [scheduleTime, setScheduleTime]         = useState("09:00");
  const fileInputRef = useRef(null);
  const textareaRef  = useRef(null);
  const ytTitleRef   = useRef(null);
  const ytDescRef    = useRef(null);

  function autoGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  // Which selected accounts are YouTube
  const selectedYtAccounts = useMemo(
    () => selectedAccounts.filter(id => ytAccounts.some(a => a.id === id)),
    [selectedAccounts, ytAccounts],
  );
  const hasYtSelected = selectedYtAccounts.length > 0;
  const hasIgSelected = selectedAccounts.some(id => igAccounts.some(a => a.id === id));
  const selectedTtAccounts = useMemo(
    () => selectedAccounts.filter(id => ttAccounts.some(a => a.id === id)),
    [selectedAccounts, ttAccounts],
  );
  const hasTtSelected = selectedTtAccounts.length > 0;
  const selectedPlatformCount = [hasYtSelected, hasIgSelected, hasTtSelected].filter(Boolean).length;

  // Other posts already scheduled for the currently-picked date — shown as a
  // preview under the time picker so it's obvious the day isn't empty.
  const sameDayBookings = useMemo(() => {
    if (!scheduleDate) return [];
    return scheduledJobs
      .filter(job => job.scheduled_for && new Date(job.scheduled_for).toLocaleDateString("sv") === scheduleDate)
      .map(job => ({
        ...job,
        video: videosProp.find(v => v.id === job.creation_id),
        time: new Date(job.scheduled_for).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      }))
      .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
  }, [scheduleDate, scheduledJobs, videosProp]);

  // Date bounds for scheduling
  const minDate = new Date(); minDate.setDate(minDate.getDate() + 1);
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);
  const minDateStr = minDate.toISOString().slice(0, 10);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  // Entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Pre-select first connected account. Scheduling only supports Instagram
  // today, so when opened straight into the Schedule section, prefer an
  // Instagram account over the usual YouTube-first default.
  useEffect(() => {
    if (allAccounts.length > 0 && selectedAccounts.length === 0) {
      const preferred = initialScheduleDate ? (igAccounts[0] || allAccounts[0]) : allAccounts[0];
      setSelectedAccounts([preferred.id]);
    }
  }, [allAccounts]);

  // Escape key
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Fetch TikTok's creator_info (allowed privacy levels, duet/stitch/comment
  // toggles, whether Direct Post is enabled) the moment a TikTok account is
  // selected — the UI must render these actual options, never hardcode them.
  useEffect(() => {
    const accountId = selectedTtAccounts[0];
    if (!accountId || accountId === ttOptionsAccountId || loadingTtOptions) return;

    let cancelled = false;
    (async () => {
      setLoadingTtOptions(true);
      setTtOptionsError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-publish-video`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ social_account_id: accountId, mode: "options" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load TikTok posting options.");
        if (cancelled) return;
        setTtOptions(json);
        setTtOptionsAccountId(accountId);
        setTtPrivacyLevel(json.privacy_level_options?.[0] || "SELF_ONLY");
        setTtDisableComment(!!json.comment_disabled);
        setTtDisableDuet(!!json.duet_disabled);
        setTtDisableStitch(!!json.stitch_disabled);
        setTtPublishMode(json.direct_post_enabled ? "direct" : "draft");
      } catch (e) {
        if (!cancelled) setTtOptionsError(e.message || "Could not load TikTok posting options.");
      } finally {
        if (!cancelled) setLoadingTtOptions(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedTtAccounts, ttOptionsAccountId, loadingTtOptions]);

  /* ── File handling ──────────────────────────────────────────────────────── */
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      alert("Please select an MP4, MOV, or WebM video file.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext  = file.name.split(".").pop() || "mp4";
      // "published" isn't a real bucket in this project (confirmed via
      // `supabase storage ls` — every custom upload here was 400ing with
      // "Bucket not found"). "public-assets" is the real bucket for
      // public, user-published content — src/lib/storage.ts's
      // `publishToPublic()` already uses it under this same
      // `published/<uid>/...` path convention.
      const path = `published/${user.id}/custom-uploads/${Date.now()}.${ext}`;

      // Supabase JS client upload (no XHR progress API, simulate progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(p => Math.min(p + 12, 85));
      }, 300);

      const { error: uploadErr } = await supabase.storage
        .from("public-assets")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      clearInterval(progressInterval);

      if (uploadErr) throw uploadErr;

      setUploadProgress(100);

      const { data: { publicUrl } } = supabase.storage
        .from("public-assets")
        .getPublicUrl(path);

      // Brief pause so user sees 100%
      await new Promise(r => setTimeout(r, 400));

      setSelectedVideo({
        id:          null,          // custom upload — no creation_id
        result_url:  publicUrl,
        prompt:      file.name.replace(/\.[^/.]+$/, ""),
        created_at:  new Date().toISOString(),
        isCustom:    true,
        customUrl:   publicUrl,
      });
      setStep(2);
      if (initialScheduleDate && !hasYtSelected && !hasTtSelected) {
        setScheduleDate(initialScheduleDate);
        setScheduleMode(true);
      }
    } catch (e) {
      alert(e.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [initialScheduleDate, hasYtSelected, hasTtSelected]);

  function onFileInput(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }
  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  /* ── Pick a video from exports ──────────────────────────────────────────── */
  function pickVideo(video) {
    setSelectedVideo(video);
    setIgCaption("");
    setYtDescription("");
    setTtCaption("");
    setStep(2);
    if (initialScheduleDate && !hasYtSelected && !hasTtSelected) {
      setScheduleDate(initialScheduleDate);
      setScheduleMode(true);
    }
    if (video.prompt) generateCaption(video.prompt);
  }

  /* ── AI caption ─────────────────────────────────────────────────────────── */
  async function generateCaption(promptOverride) {
    const prompt = promptOverride ?? selectedVideo?.prompt;
    if (!prompt) return;
    setGeneratingIgCaption(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-caption`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platform: "instagram" }),
      });
      const json = await res.json();
      if (json.caption) { setIgCaption(json.caption); setTimeout(() => textareaRef.current?.focus(), 50); }
    } catch { /* silent */ } finally {
      setGeneratingIgCaption(false);
    }
  }

  async function generateYtDescription() {
    const prompt = selectedVideo?.prompt;
    if (!prompt) return;
    setGeneratingYtDescription(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-caption`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platform: "youtube" }),
      });
      const json = await res.json();
      if (json.caption) {
        setYtDescription(json.caption.slice(0, MAX_CAPTION));
        setTimeout(() => ytDescRef.current?.focus(), 50);
      }
    } catch { /* silent */ } finally {
      setGeneratingYtDescription(false);
    }
  }

  /* ── Publish (immediate or scheduled) ───────────────────────────────────── */
  async function submitPost(scheduledFor = null) {
    if (selectedAccounts.length === 0) { setPublishError("Select at least one account."); return; }
    if (!selectedVideo) return;
    if (hasYtSelected && !ytTitle.trim()) { setPublishError("A title is required for YouTube videos."); return; }
    setPublishing(true);
    setPublishError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const videoBase = selectedVideo.isCustom
        ? { video_url: selectedVideo.customUrl }
        : { creation_id: selectedVideo.id };

      for (const accountId of selectedAccounts) {
        const isYT = ytAccounts.some(a => a.id === accountId);
        const isTT = ttAccounts.some(a => a.id === accountId);
        if (isYT) {
          const payload = {
            social_account_id: accountId,
            ...videoBase,
            title:       ytTitle.trim().slice(0, MAX_YT_TITLE),
            description: ytDescription.trim(),
            privacy_status: "public",
          };
          const res = await fetch(`${SUPABASE_URL}/functions/v1/youtube-publish-video`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Failed to start YouTube upload");
        } else if (isTT) {
          const payload = {
            social_account_id: accountId,
            ...videoBase,
            title:           ttCaption.trim().slice(0, MAX_CAPTION),
            publish_mode:    ttPublishMode,
            privacy_level:   ttPrivacyLevel,
            disable_comment: ttDisableComment,
            disable_duet:    ttDisableDuet,
            disable_stitch:  ttDisableStitch,
          };
          const res = await fetch(`${SUPABASE_URL}/functions/v1/tiktok-publish-video`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Failed to start TikTok upload");
        } else {
          const payload = {
            social_account_id: accountId,
            caption: igCaption.trim(),
            ...videoBase,
            ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
          };
          const res = await fetch(`${SUPABASE_URL}/functions/v1/instagram-publish-reel`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Failed to start publishing");
        }
      }
      onPublished();
    } catch (e) {
      setPublishError(e.message || "Something went wrong. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  function handlePublishNow() { submitPost(null); }

  function handleScheduleSubmit() {
    if (!scheduleDate) { setPublishError("Pick a date to schedule."); return; }
    const iso = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    submitPost(iso);
  }

  function toggleAccount(id) {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return createPortal(
    <div className="fixed inset-0 z-[9000] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Drawer — slides in from right */}
      <div
        className="relative z-10 flex flex-col h-full w-full max-w-[400px] bg-[#0e1012] border-l border-white/[0.07] shadow-2xl transition-transform duration-[250ms] ease-out"
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3.5 shrink-0">
          {step === 2 && (
            <button
              onClick={() => { setStep(1); setPublishError(""); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-[14px] font-bold text-white leading-none">
              {step === 1 ? "Publish New Content" : "Post Details"}
            </h2>
          </div>
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {[1,2].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "w-4 bg-[#7A3BFF]" : s < step ? "w-2 bg-[#7A3BFF]/40" : "w-2 bg-white/15"}`} />
            ))}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Step 1: Pick video ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto">

            {/* Schedule Custom Video */}
            <div className="px-4 pt-5 pb-4">
              <h3 className="text-[13px] font-bold text-white mb-3">Schedule Custom Video</h3>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition ${
                  dragging
                    ? "border-[#7A3BFF] bg-[#7A3BFF]/10"
                    : "border-white/[0.10] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-7 w-7 text-[#9F5CFF] animate-spin" />
                    <p className="text-sm text-white/60 font-medium">Uploading… {uploadProgress}%</p>
                    <div className="w-32 h-1 rounded-full bg-white/10 overflow-hidden mt-1">
                      <div
                        className="h-full bg-[#7A3BFF] rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25">
                      <Upload className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] text-white/60 leading-snug">
                        Drop a video or{" "}
                        <span className="text-[#9F5CFF] font-semibold">click here</span>{" "}
                        to browse files
                      </p>
                      <p className="mt-1 text-[11px] text-white/25">MP4, MOV, WebM · max 1 GB</p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={onFileInput}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="mx-4 border-t border-white/[0.06]" />

            {/* My Exports — only fully-assembled, ready-to-post videos (tool_key
                = full-video) reach this list at all; the query in publish.jsx
                filters out raw single-clip generations before they get here. */}
            <div className="px-4 pt-4 pb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-white">My Exports</h3>
                {!loadingProp && videosProp.length > 0 && (
                  <span className="text-[11px] text-white/30">{videosProp.length} video{videosProp.length !== 1 ? "s" : ""}</span>
                )}
              </div>

              {loadingProp ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="aspect-[9/16] rounded-xl bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : videosProp.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.07]">
                    <Send className="h-5 w-5 text-white/20" />
                  </div>
                  <p className="text-[13px] font-semibold text-white/40">No finished videos yet</p>
                  <p className="mt-1.5 text-[11px] text-white/25 max-w-[200px] leading-relaxed">
                    Finish a video in one of the tools (like Clay Rescue) and it'll show up here ready to post.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-4 rounded-xl bg-white px-5 py-2 text-[13px] font-bold text-[#090A0A] hover:bg-white/90 transition"
                  >
                    Open Your Videos
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {videosProp.map(v => (
                    <VideoThumb
                      key={v.id}
                      video={v}
                      selected={selectedVideo?.id === v.id}
                      onClick={() => pickVideo(v)}
                      postStatus={videoPostStatus[v.id] ?? null}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Post details ─────────────────────────────────────────── */}
        {step === 2 && selectedVideo && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {scheduleMode ? (
              /* ── Calendar view ──────────────────────────────────────────── */
              <>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-0.5">Schedule post</p>
                  <p className="text-[13px] font-bold text-white">Pick a date &amp; time</p>
                </div>

                <ScheduleCalendar
                  scheduledJobs={scheduledJobs}
                  videos={videosProp}
                  selectedDate={scheduleDate}
                  onSelectDate={setScheduleDate}
                />

                <div>
                  <p className="text-[10px] text-white/35 mb-1.5 font-semibold uppercase tracking-wide">Time</p>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#1a1d24] px-3 py-2 text-sm text-white outline-none focus:border-[#7A3BFF]/50 transition [color-scheme:dark]"
                  />
                </div>

                {sameDayBookings.length > 0 && (
                  <div>
                    <p className="text-[10px] text-white/35 mb-1.5 font-semibold uppercase tracking-wide">
                      Already scheduled this day
                    </p>
                    <div className="space-y-2">
                      {sameDayBookings.map(job => (
                        <div key={job.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                          <div className="h-11 w-6 shrink-0 overflow-hidden rounded-md bg-white/5">
                            {job.video?.result_url && (
                              <video
                                src={job.video.result_url}
                                className="h-full w-full object-cover"
                                muted preload="metadata"
                                onLoadedMetadata={e => { e.currentTarget.currentTime = 0.1; }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-white/70 truncate leading-snug">{job.caption || "No caption"}</p>
                          </div>
                          <span className="shrink-0 rounded-full border border-[#7A3BFF]/25 bg-[#7A3BFF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C084FC]">
                            {job.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {publishError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <p className="text-sm text-red-300">{publishError}</p>
                  </div>
                )}
              </>
            ) : (
              /* ── Normal details view ────────────────────────────────────── */
              <>
                {/* Video preview strip */}
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <div className="h-[56px] w-[32px] shrink-0 overflow-hidden rounded-lg bg-white/5">
                    <video src={selectedVideo.result_url} className="h-full w-full object-cover" muted preload="metadata" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate leading-snug">
                      {selectedVideo.prompt?.slice(0, 70) || (selectedVideo.isCustom ? "Custom video" : "Video")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/30">
                      {new Date(selectedVideo.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <button onClick={() => { setStep(1); setIgCaption(""); setYtDescription(""); setTtCaption(""); }} className="text-[11px] text-[#9F5CFF] hover:text-[#C084FC] font-semibold transition shrink-0">Change</button>
                </div>

                {/* Publish to */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">Publish to</p>
                  {allAccounts.length === 0 ? (
                    <button onClick={onConnectInstagram} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/[0.08] px-4 py-3 text-left hover:border-white/15 transition">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white/70">No accounts connected</p>
                        <p className="text-[11px] text-white/35">Connect Instagram, YouTube, or TikTok to publish</p>
                      </div>
                      <span className="text-xs text-[#9F5CFF] font-semibold">Connect →</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {allAccounts.map(acc => (
                        <PlatformPill
                          key={acc.id}
                          account={acc}
                          selected={selectedAccounts.includes(acc.id)}
                          onToggle={() => toggleAccount(acc.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Per-platform details — collapsible when 2+ platforms are selected,
                    so it's unambiguous which text goes where. */}
                {hasYtSelected && (
                  <CaptionCard
                    platform="youtube"
                    collapsible={selectedPlatformCount > 1}
                    open={ytCardOpen}
                    onToggle={() => setYtCardOpen(o => !o)}
                    ready={!!ytTitle.trim()}
                  >
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Title</p>
                        <span className={`text-[10px] ${ytTitle.length > MAX_YT_TITLE * 0.9 ? "text-amber-400" : "text-white/25"}`}>
                          {ytTitle.length} / {MAX_YT_TITLE}
                        </span>
                      </div>
                      <textarea
                        ref={ytTitleRef}
                        value={ytTitle}
                        onChange={e => { setYtTitle(e.target.value.slice(0, MAX_YT_TITLE)); autoGrow(e.target); }}
                        onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
                        placeholder="Enter a title for your YouTube video…"
                        rows={1}
                        className="w-full resize-none overflow-hidden rounded-xl border border-white/[0.08] bg-[#1a1d24] px-4 py-3 text-sm text-white/85 placeholder:text-white/30 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition leading-snug"
                      />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Description</p>
                        <span className={`text-[10px] ${ytDescription.length > MAX_CAPTION * 0.9 ? "text-amber-400" : "text-white/25"}`}>
                          {ytDescription.length} / {MAX_CAPTION}
                        </span>
                      </div>
                      <div className="relative">
                        <textarea
                          ref={ytDescRef}
                          value={ytDescription}
                          onChange={e => setYtDescription(e.target.value.slice(0, MAX_CAPTION))}
                          rows={4}
                          placeholder={generatingYtDescription ? "Writing viral description…" : "Add a description for YouTube…"}
                          disabled={generatingYtDescription}
                          className={`w-full resize-none rounded-xl border border-white/[0.08] bg-[#1a1d24] px-4 py-3 pb-16 text-sm text-white/85 placeholder:text-white/30 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition ${generatingYtDescription ? "opacity-60" : ""}`}
                        />
                        {generatingYtDescription && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none">
                            <div className="flex items-center gap-2 rounded-lg bg-[#1a1d24]/90 px-3 py-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-red-300" />
                              <span className="text-[11px] text-red-300 font-semibold">Writing viral description…</span>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={generateYtDescription}
                          disabled={generatingYtDescription || !selectedVideo?.prompt}
                          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {generatingYtDescription ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {generatingYtDescription ? "Writing…" : "Write with AI"}
                        </button>
                      </div>
                    </div>
                  </CaptionCard>
                )}

                {(hasIgSelected || (!hasYtSelected && !hasIgSelected && !hasTtSelected)) && (
                  <CaptionCard
                    platform="instagram"
                    collapsible={selectedPlatformCount > 1}
                    open={igCardOpen}
                    onToggle={() => setIgCardOpen(o => !o)}
                    ready={!!igCaption.trim()}
                  >
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Caption & hashtags</p>
                        <span className={`text-[10px] ${igCaption.length > MAX_CAPTION * 0.9 ? "text-amber-400" : "text-white/25"}`}>
                          {igCaption.length} / {MAX_CAPTION}
                        </span>
                      </div>
                      <div className="relative">
                        <textarea
                          ref={textareaRef}
                          value={igCaption}
                          onChange={e => setIgCaption(e.target.value.slice(0, MAX_CAPTION))}
                          rows={5}
                          placeholder={generatingIgCaption ? "Writing viral caption…" : "Write a caption… (emojis and hashtags welcome)"}
                          disabled={generatingIgCaption}
                          className={`w-full resize-none rounded-xl border border-white/[0.08] bg-[#1a1d24] px-4 py-3 pb-16 text-sm text-white/85 placeholder:text-white/30 outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/20 transition ${generatingIgCaption ? "opacity-60" : ""}`}
                        />
                        {generatingIgCaption && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none">
                            <div className="flex items-center gap-2 rounded-lg bg-[#1a1d24]/90 px-3 py-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C084FC]" />
                              <span className="text-[11px] text-[#C084FC] font-semibold">Writing viral caption…</span>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => generateCaption()}
                          disabled={generatingIgCaption || !selectedVideo?.prompt}
                          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-[#7A3BFF]/30 bg-[#7A3BFF]/15 px-3 py-1.5 text-[11px] font-semibold text-[#C084FC] hover:bg-[#7A3BFF]/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {generatingIgCaption ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {generatingIgCaption ? "Writing…" : "Write with AI"}
                        </button>
                      </div>
                    </div>
                  </CaptionCard>
                )}

                {hasTtSelected && (
                  <CaptionCard
                    platform="tiktok"
                    collapsible={selectedPlatformCount > 1}
                    open={ttCardOpen}
                    onToggle={() => setTtCardOpen(o => !o)}
                    ready={!!ttCaption.trim()}
                  >
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Caption</p>
                        <span className={`text-[10px] ${ttCaption.length > MAX_CAPTION * 0.9 ? "text-amber-400" : "text-white/25"}`}>
                          {ttCaption.length} / {MAX_CAPTION}
                        </span>
                      </div>
                      <textarea
                        value={ttCaption}
                        onChange={e => setTtCaption(e.target.value.slice(0, MAX_CAPTION))}
                        rows={4}
                        placeholder="Write a caption… (hashtags welcome)"
                        className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#1a1d24] px-4 py-3 text-sm text-white/85 placeholder:text-white/30 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10 transition"
                      />
                    </div>

                    {loadingTtOptions ? (
                      <div className="flex items-center gap-2 text-[11px] text-white/35">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading TikTok posting options…
                      </div>
                    ) : ttOptionsError ? (
                      <div className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2 text-[11px] text-red-300">
                        {ttOptionsError}
                      </div>
                    ) : ttOptions && (
                      <>
                        {!ttOptions.direct_post_enabled && (
                          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[11px] text-white/45 leading-snug">
                            TikTok direct posting is pending approval. You can send the video to TikTok drafts and finish posting in TikTok.
                          </div>
                        )}

                        {ttOptions.direct_post_enabled && (
                          <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
                            {["draft", "direct"].map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setTtPublishMode(m)}
                                className={`flex-1 rounded-md py-1.5 text-[11px] font-bold transition ${
                                  ttPublishMode === m ? "bg-white/[0.10] text-white" : "text-white/35 hover:text-white/60"
                                }`}
                              >
                                {m === "draft" ? "Send to Drafts" : "Post Directly"}
                              </button>
                            ))}
                          </div>
                        )}

                        {ttPublishMode === "direct" && (
                          <>
                            <div>
                              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Who can view this</p>
                              <div className="space-y-1.5">
                                {(ttOptions.privacy_level_options || []).map(level => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => setTtPrivacyLevel(level)}
                                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition ${
                                      ttPrivacyLevel === level
                                        ? "border-white/25 bg-white/[0.08] text-white"
                                        : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/15"
                                    }`}
                                  >
                                    <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${ttPrivacyLevel === level ? "border-white bg-white/30" : "border-white/25"}`} />
                                    {TT_PRIVACY_LABELS[level] || level}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              {[
                                { key: "comment", label: "Turn off comments", value: ttDisableComment, set: setTtDisableComment, forced: ttOptions.comment_disabled },
                                { key: "duet",    label: "Turn off Duet",     value: ttDisableDuet,    set: setTtDisableDuet,    forced: ttOptions.duet_disabled },
                                { key: "stitch",  label: "Turn off Stitch",   value: ttDisableStitch,  set: setTtDisableStitch,  forced: ttOptions.stitch_disabled },
                              ].map(t => (
                                <label key={t.key} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] text-white/60">
                                  <span>
                                    {t.label}
                                    {t.forced && <span className="ml-1.5 text-[9px] text-white/25">(off for this account)</span>}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={t.value || !!t.forced}
                                    disabled={!!t.forced}
                                    onChange={e => t.set(e.target.checked)}
                                    className="h-4 w-4 accent-white/70"
                                  />
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </CaptionCard>
                )}

                {/* Timing note */}
                {(hasIgSelected || (!hasYtSelected && !hasIgSelected && !hasTtSelected)) && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-white/25" />
                    <p className="text-[11px] text-white/35 leading-snug">Instagram may take a few minutes to process your Reel.</p>
                  </div>
                )}
                {hasYtSelected && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-white/25" />
                    <p className="text-[11px] text-white/35 leading-snug">YouTube uploads run in the background — you'll see it in your channel shortly.</p>
                  </div>
                )}
                {hasTtSelected && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-white/25" />
                    <p className="text-[11px] text-white/35 leading-snug">
                      {ttPublishMode === "direct"
                        ? "TikTok posts run in the background — you'll see it on your profile shortly."
                        : "TikTok drafts run in the background — finish posting from your TikTok inbox."}
                    </p>
                  </div>
                )}

                {/* Error */}
                {publishError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <p className="text-sm text-red-300">{publishError}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3 pb-4 space-y-2">
            {!scheduleMode && (
              <div>
                <button
                  onClick={() => setScheduleMode(true)}
                  disabled={publishing || selectedAccounts.length === 0 || !selectedVideo || allAccounts.length === 0 || hasYtSelected || hasTtSelected}
                  title={(hasYtSelected || hasTtSelected) ? "Scheduling is available for Instagram only right now" : undefined}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.09] hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition"
                >
                  <CalendarClock className="h-4 w-4" />
                  Schedule Post
                </button>
                {(hasYtSelected || hasTtSelected) && (
                  <p className="mt-1.5 text-center text-[10px] text-white/25">
                    Scheduling is available for Instagram only right now
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { if (scheduleMode) { setScheduleMode(false); setScheduleDate(""); } else onClose(); }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/50 hover:bg-white/[0.07] hover:text-white/80 transition"
              >
                {scheduleMode ? "Back" : "Cancel"}
              </button>

              {scheduleMode ? (
                <button
                  onClick={handleScheduleSubmit}
                  disabled={publishing || !scheduleDate || selectedAccounts.length === 0 || allAccounts.length === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#7A3BFF] py-2.5 text-sm font-bold text-white hover:bg-[#8B4DFF] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[.99] transition"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                  {publishing ? "Scheduling…" : "Confirm Schedule"}
                </button>
              ) : (
                <button
                  onClick={handlePublishNow}
                  disabled={publishing || selectedAccounts.length === 0 || !selectedVideo || allAccounts.length === 0 || (hasYtSelected && !ytTitle.trim())}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] py-2.5 text-sm font-bold text-white hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[.99] transition shadow-lg shadow-[#7A3BFF]/20"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {publishing ? "Publishing…" : "Post Now"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
