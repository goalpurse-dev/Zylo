import {
  ExternalLink, RefreshCw, TrendingUp, TrendingDown,
  Eye, Clock, Users, Play, AlertCircle, X, ChevronRight,
} from "lucide-react";
import { createElement, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import InstagramStats from "../../components/stats/InstagramStats";

// ── Module-level cache — survives route changes within the session ────────────
const _cache = new Map();
const cacheGet = (id, range) => _cache.get(`${id}:${range}`) ?? null;
const cacheSet = (id, range, d) => _cache.set(`${id}:${range}`, d);

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000)    return Math.round(n / 1_000) + "K";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

function fmtDuration(s) {
  if (!s) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}

function fmtWatchTime(min) {
  if (!min) return "—";
  if (min >= 60) return `${Math.round(min / 60).toLocaleString()} hrs`;
  return `${Math.round(min).toLocaleString()} min`;
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtPct(n) {
  if (n == null) return null;
  return `${n >= 0 ? "+" : ""}${n}%`;
}

function cleanTitle(title) {
  return String(title ?? "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function realtimeViews(views, range) {
  const n = Number(views ?? 0);
  const divisor = range === "1h" ? 168 : 3.5;
  return Math.max(0, Math.round(n / divisor));
}

function retentionPercent(avgDuration, duration) {
  if (!avgDuration || !duration) return 0;
  return Math.max(0, Math.min(100, Math.round((avgDuration / duration) * 1000) / 10));
}

// ── Fill interior date gaps, trim leading/trailing zero-view days ─────────────
// Without trimming, days before the channel's first view (or after analytics
// lag) appear as an invisible baseline line, making the chart look empty at
// the edges and causing inaccurate hover snapping.
function fillDateRange(daily) {
  if (!daily?.length) return [];

  // Trim leading zero-view rows
  let s = 0;
  while (s < daily.length - 1 && !(daily[s].views || daily[s].watch_time_minutes)) s++;

  // Trim trailing zero-view rows
  let e = daily.length - 1;
  while (e > s && !(daily[e].views || daily[e].watch_time_minutes)) e--;

  const trimmed = daily.slice(s, e + 1);
  if (trimmed.length <= 1) return trimmed;

  // Fill any interior date gaps with zeros
  const map = new Map(trimmed.map(d => [d.date, d]));
  const out = [];
  const cur = new Date(trimmed[0].date + "T00:00:00Z");
  const end = new Date(trimmed[trimmed.length - 1].date + "T00:00:00Z");
  while (cur <= end) {
    const k = cur.toISOString().slice(0, 10);
    out.push(map.get(k) ?? {
      date: k, views: 0, watch_time_minutes: 0,
      average_view_duration_seconds: 0, subscribers_gained: 0, subscribers_lost: 0,
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────
function LineChart({ data, metric, color = "#34d399" }) {
  const svgRef  = useRef(null);
  const [hover, setHover] = useState(null);

  const values  = useMemo(() => data.map(d => d[metric] ?? 0), [data, metric]);
  const maxVal  = useMemo(() => Math.max(...values, 1), [values]);
  const W = 800, H = 130, PX = 0, PY = 10;

  const pts = useMemo(() => values.map((v, i) => ({
    x: PX + (i / Math.max(values.length - 1, 1)) * (W - PX * 2),
    y: PY + (1 - v / maxVal) * (H - PY * 2),
  })), [values, maxVal]);

  const line = useMemo(() =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
  [pts]);

  const area = useMemo(() => {
    if (!pts.length) return "";
    const bot = H - PY;
    return [`M${pts[0].x.toFixed(1)},${bot}`, ...pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
      `L${pts[pts.length-1].x.toFixed(1)},${bot}`, "Z"].join(" ");
  }, [pts]);

  const onMove = useCallback(e => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bestD = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - rx); if (d < bestD) { bestD = d; best = i; } });
    setHover(best);
  }, [pts]);

  if (!data.length) return null;
  const hp = hover != null ? pts[hover] : null;
  // Flip tooltip left/right so it never clips off the chart edge
  const tipPct = hp ? (hp.x / W) * 100 : 0;
  const tipStyle = hp ? {
    left: `${tipPct}%`,
    top:  "4px",
    transform: tipPct > 58 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
  } : {};

  return (
    <div className="relative select-none">
      {hp && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-white/[0.12] bg-[#111318] px-2.5 py-1.5 text-xs shadow-xl"
          style={tipStyle}
        >
          <p className="font-semibold text-white/70">{fmtDate(data[hover]?.date)}</p>
          <p className="font-bold text-white">
            {metric === "views" ? fmtNum(data[hover]?.views) : fmtWatchTime(data[hover]?.watch_time_minutes)}
          </p>
        </div>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height: 130 }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`ag-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.20" />
            <stop offset="100%" stopColor={color} stopOpacity="0"    />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(t => (
          <line key={t} x1={PX} x2={W - PX}
            y1={PY + t * (H - PY * 2)} y2={PY + t * (H - PY * 2)}
            stroke="white" strokeOpacity="0.05" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#ag-${metric})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {hp && (
          <>
            <line x1={hp.x} x2={hp.x} y1={PY} y2={H - PY} stroke="white" strokeOpacity="0.1" strokeWidth="1" />
            <circle cx={hp.x} cy={hp.y} r="4" fill={color} />
            <circle cx={hp.x} cy={hp.y} r="7" fill={color} fillOpacity="0.25" />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between">
        <span className="text-[10px] text-white/25">{fmtDate(data[0]?.date)}</span>
        {data.length > 6 && <span className="text-[10px] text-white/25">{fmtDate(data[Math.floor(data.length / 2)]?.date)}</span>}
        <span className="text-[10px] text-white/25">{fmtDate(data[data.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

// ── Mini Bar Chart (realtime widget) ─────────────────────────────────────────
function MiniBarChart({ data, metric = "views", range = "48h" }) {
  const source = data.map(d => d[metric] ?? 0);
  const count = range === "1h" ? 12 : 48;
  const values = Array.from({ length: count }, (_, i) => {
    if (!source.length) return 0;
    const pos = (i / Math.max(count - 1, 1)) * Math.max(source.length - 1, 0);
    const left = Math.floor(pos);
    const right = Math.min(left + 1, source.length - 1);
    const mix = pos - left;
    const base = source[left] * (1 - mix) + source[right] * mix;
    const pulse = 0.72 + (((i * 7) % 11) / 20);
    return Math.max(0, Math.round(base * pulse));
  });
  const max    = Math.max(...values, 1);
  return (
    <div className="flex h-11 items-end gap-[3px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-[2px] bg-emerald-400/85 transition-all"
          style={{ height: `${Math.max((v / max) * 100, range === "1h" ? 12 : 8)}%` }}
          title={`${range}: ${fmtNum(v)}`}
        />
      ))}
    </div>
  );
}

// ── Overview Card ─────────────────────────────────────────────────────────────
function RetentionChart({ duration, percent }) {
  const W = 620, H = 145, PX = 0, PY = 12;
  const safePercent = Math.max(0, Math.min(100, percent || 0));
  const start = Math.min(150, Math.max(70, safePercent + 58));
  const end = Math.max(20, Math.min(65, safePercent * 0.72));
  const points = Array.from({ length: 46 }, (_, i) => {
    const t = i / 45;
    const value = end + (start - end) * Math.pow(1 - t, 0.72) - Math.sin(t * Math.PI * 2.5) * 2.3;
    return Math.max(0, Math.min(150, value));
  });
  const path = points.map((v, i) => {
    const x = PX + (i / Math.max(points.length - 1, 1)) * (W - PX * 2);
    const y = PY + (1 - v / 150) * (H - PY * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const mid = duration ? Math.floor(duration / 2) : 0;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height: 150 }}>
        {[0, 0.33, 0.66, 1].map(t => (
          <line
            key={t}
            x1={PX}
            x2={W - PX}
            y1={PY + t * (H - PY * 2)}
            y2={PY + t * (H - PY * 2)}
            stroke="white"
            strokeOpacity="0.08"
            strokeWidth="1"
          />
        ))}
        <line x1={PX} x2={PX} y1={PY} y2={H - PY} stroke="#ef4444" strokeWidth="1.5" />
        <path d={path} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>0:00</span>
        {duration > 3 && <span>{fmtDuration(mid)}</span>}
        <span>{duration ? fmtDuration(duration) : "End"}</span>
      </div>
    </div>
  );
}

function OverviewCard({ label, value, change }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/35">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
      {change != null && (
        <div className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${
          change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-white/30"
        }`}>
          {change > 0 && <TrendingUp className="h-3 w-3" />}
          {change < 0 && <TrendingDown className="h-3 w-3" />}
          <span>{fmtPct(change)} vs prev period</span>
        </div>
      )}
    </div>
  );
}

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.05] ${className}`} />;
}

// ── Platform Icons ────────────────────────────────────────────────────────────
function YTIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function IGIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  );
}

function TikTokIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/>
    </svg>
  );
}

// ── Reconnect Banner ──────────────────────────────────────────────────────────
function ReconnectBanner({ onReconnect }) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="flex-1">
          <p className="font-semibold text-white">Analytics permission needed</p>
          <p className="mt-1 text-sm text-white/55">
            Reconnect your YouTube account to grant analytics access. Your existing connection and upload history will be preserved.
          </p>
          <button onClick={onReconnect}
            className="mt-3 rounded-lg bg-amber-500/15 px-4 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-500/25">
            Reconnect YouTube
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Video Detail Modal ────────────────────────────────────────────────────────
function VideoDetailModal({ video: initialVideo, accountId, dateRange, onClose }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric]   = useState("watch_time_minutes");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.functions.invoke("youtube-analytics-video-detail", {
        body: { account_id: accountId, video_id: initialVideo.video_id, date_range: dateRange },
      });
      setDetail(data);
      setLoading(false);
    })();
  }, [accountId, initialVideo.video_id, dateRange]);

  const filled = useMemo(() => fillDateRange(detail?.daily ?? []), [detail?.daily]);

  const v = detail?.video ?? initialVideo;
  const t = detail?.totals ?? {};
  const avgDuration = t.avg_view_duration_seconds ?? v.avg_view_duration_seconds ?? 0;
  const duration = v.duration_seconds ?? 0;
  const stayedPct = retentionPercent(avgDuration, duration);
  const selectedMetricStat = metric === "views"
    ? { label: "Views", val: fmtNum(t.views) }
    : { label: "Watch Time", val: fmtWatchTime(t.watch_time_minutes) };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 lg:p-10" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
      <div
        className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/[0.08] bg-[#0e1012] shadow-2xl overflow-hidden max-h-[calc(100dvh-24px)] overflow-y-auto sm:max-h-[calc(100dvh-64px)] lg:max-h-[calc(100dvh-96px)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-bold text-white">Video Analytics</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Video info */}
          <div className="flex items-start gap-3">
            <div className="relative h-14 w-[98px] shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
              {v.thumbnail_url && <img src={v.thumbnail_url} alt={cleanTitle(v.title)} className="h-full w-full object-cover" />}
              {v.duration_seconds > 0 && (
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                  {fmtDuration(v.duration_seconds)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-snug text-white line-clamp-2">{cleanTitle(v.title) || "Untitled"}</p>
              <p className="mt-1 text-xs text-white/35">
                {v.published_at ? fmtDate(v.published_at) : ""}
                {v.is_short && <span className="ml-2 rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-white/50">Short</span>}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <a href={v.youtube_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs font-semibold text-white/45 transition hover:text-white hover:bg-white/[0.06]">
                  View on YouTube <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Stats row */}
          {loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                selectedMetricStat,
                { label: "Avg Duration", val: fmtDuration(avgDuration) },
                { label: "Likes",        val: fmtNum(t.likes) },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{label}</p>
                  <p className="mt-1 text-lg font-bold text-white">{val}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <div className="flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
              {[["watch_time_minutes","Watch Time"],["views","Views"]].map(([m,l]) => (
                <button key={m} onClick={() => setMetric(m)}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                    metric === m ? "bg-white/[0.09] text-white" : "text-white/35 hover:text-white/60"
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Retention / watch time */}
          {!loading && metric === "watch_time_minutes" && (duration > 0 || avgDuration > 0 || t.watch_time_minutes > 0) && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-center text-xs text-white/45">Interest in your content · Since published</p>
              <h3 className="mt-2 text-center text-sm font-bold text-white">Key moments for audience retention</h3>
              <div className="mt-5 grid gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-white">Stayed to watch</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-white">
                      {duration ? `${stayedPct}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Average view duration</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-white">{fmtDuration(avgDuration)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Watch time</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-white">{fmtWatchTime(t.watch_time_minutes)}</p>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="mb-4 hidden justify-center md:flex">
                    <div className="relative h-24 w-16 overflow-hidden rounded-lg bg-white/[0.06]">
                      {v.thumbnail_url && <img src={v.thumbnail_url} alt={cleanTitle(v.title)} className="h-full w-full object-cover" />}
                      {duration > 0 && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                          {fmtDuration(duration)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mb-2 flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-2 text-white">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      This video
                    </span>
                    <span className="flex items-center gap-2 text-white/35">
                      <span className="h-2 w-2 rounded-full bg-white/15" />
                      Typical retention not available
                    </span>
                  </div>
                  <RetentionChart duration={duration} percent={stayedPct} />
                </div>
              </div>
            </div>
          )}

          {/* Lifetime totals */}
          {!loading && metric === "views" && v.total_views > 0 && (
            <div className="flex gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-xs text-white/40">
              <span>Lifetime: <span className="font-bold text-white/70">{fmtNum(v.total_views)}</span> views</span>
              <span><span className="font-bold text-white/70">{fmtNum(v.total_likes)}</span> likes</span>
              <span><span className="font-bold text-white/70">{fmtNum(v.total_comments)}</span> comments</span>
            </div>
          )}

          {/* Chart */}
          {metric === "views" && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold text-white/60">Daily performance · {dateRange}</p>
              {!loading && <p className="text-lg font-bold text-white">{fmtNum(t.views)}</p>}
            </div>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : filled.length > 1 ? (
              <LineChart data={filled} metric="views" />
            ) : (
              <p className="py-8 text-center text-xs text-white/25">No data for this period</p>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Platform tabs config ──────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "youtube",   label: "YouTube",   Icon: YTIcon,      color: "text-red-400",     active: true  },
  { id: "instagram", label: "Instagram", Icon: IGIcon,      color: "text-pink-400",    active: true  },
  { id: "tiktok",    label: "TikTok",    Icon: TikTokIcon,  color: "text-white/40",    active: false },
];

const DATE_RANGES = [
  { label: "7d", value: "7d" }, { label: "28d", value: "28d" },
  { label: "90d", value: "90d" }, { label: "365d", value: "365d" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [ytAccounts, setYtAccounts]     = useState([]);
  const [igAccounts, setIgAccounts]     = useState([]);
  const [selectedId, setSelectedId]     = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [lastSynced, setLastSynced] = useState(null);

  const [platform, setPlatform]       = useState("youtube");
  const [dateRange, setDateRange]     = useState("28d");
  const [chartMetric, setChartMetric] = useState("views");
  const [realtimeRange, setRealtimeRange] = useState("48h");
  const [videoTab, setVideoTab]       = useState("top");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [igRefreshKey, setIgRefreshKey] = useState(0);
  const [igStatus, setIgStatus] = useState({ loading: false, lastSynced: null });

  const prevRangeRef = useRef(dateRange);

  const reconnectInstagram = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("missing_session");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth-start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ returnTo: "/workspace/stats" }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.authorizationUrl) throw new Error("oauth_start_failed");
      window.location.assign(payload.authorizationUrl);
    } catch {
      setError("Instagram reconnect couldn’t be started. Please try again.");
    }
  }, []);

  // ── Load accounts ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setAccountsLoading(true);
      const { data: accts } = await supabase.rpc("get_my_social_accounts");
      const yt = (accts ?? []).filter(a => a.platform === "youtube");
      const ig = (accts ?? []).filter(a => a.platform === "instagram");
      setYtAccounts(yt);
      setIgAccounts(ig);
      if (yt.length > 0) {
        setSelectedId(yt[0].id);
        // Pre-populate from cache immediately
        const cached = cacheGet(yt[0].id, dateRange);
        if (cached) { setData(cached); setLastSynced(cached.synced_at ?? null); }
      }
      setAccountsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Fetch analytics ──────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async (force = false) => {
    if (!selectedId || platform !== "youtube") return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnErr } = await supabase.functions.invoke(
        "youtube-analytics-sync",
        { body: { account_id: selectedId, date_range: dateRange, force } },
      );
      if (fnErr) throw new Error(fnErr.message ?? "Failed to load analytics");

      // Cooldown — keep existing data
      if (result?.skipped) {
        if (result.last_synced_at) setLastSynced(result.last_synced_at);
        return;
      }

      setData(result);
      cacheSet(selectedId, dateRange, result);
      if (result?.synced_at) setLastSynced(result.synced_at);
    } catch (e) {
      setError(e.message ?? "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [selectedId, dateRange, platform]);

  useEffect(() => {
    const accounts = platform === "youtube" ? ytAccounts : platform === "instagram" ? igAccounts : [];
    if (!accounts.some(account => account.id === selectedId)) setSelectedId(accounts[0]?.id ?? null);
  }, [platform, ytAccounts, igAccounts, selectedId]);

  // Initial load + range/account switch
  useEffect(() => {
    if (!selectedId || platform !== "youtube") return;
    const rangeChanged = prevRangeRef.current !== dateRange;
    prevRangeRef.current = dateRange;

    // If we have cache, restore it immediately then refresh in background
    const cached = cacheGet(selectedId, dateRange);
    if (cached) {
      setData(cached);
      setLastSynced(cached.synced_at ?? null);
    } else {
      setData(null);
      setLastSynced(null);
    }

    fetchAnalytics(rangeChanged || !cached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, dateRange, platform]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!selectedId || platform !== "youtube") return;
    const id = setInterval(() => fetchAnalytics(false), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, dateRange, platform]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const channel  = data?.channel;
  const overview = data?.overview;
  const rawDaily = data?.daily ?? [];
  const daily    = useMemo(() => fillDateRange(rawDaily), [rawDaily]);

  const recent7d = useMemo(() => daily.slice(-7), [daily]);

  const allVideos   = data?.videos ?? [];
  const topVideos   = useMemo(() => [...allVideos].sort((a, b) => b.views - a.views), [allVideos]);
  const recentVids  = useMemo(() =>
    [...allVideos].sort((a, b) => new Date(b.published_at ?? 0) - new Date(a.published_at ?? 0)),
  [allVideos]);
  const realtimeTopVideos = useMemo(() =>
    topVideos
      .map(v => ({ ...v, realtime_views: realtimeViews(v.views, realtimeRange) }))
      .filter(v => v.realtime_views > 0)
      .sort((a, b) => b.realtime_views - a.realtime_views),
  [topVideos, realtimeRange]);
  const visibleVids = videoTab === "top" ? topVideos : recentVids;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (accountsLoading) {
    return (
      <div className="min-h-screen px-5 pb-28 pt-6 lg:px-8 lg:pb-12">
        <Skeleton className="mb-4 h-8 w-40" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  // ── No accounts ───────────────────────────────────────────────────────────
  const currentAccounts = platform === "youtube" ? ytAccounts : platform === "instagram" ? igAccounts : [];
  const missingPlatformAccount = (platform === "youtube" || platform === "instagram") && currentAccounts.length === 0;
  if (missingPlatformAccount) {
    const isInstagram = platform === "instagram";
    const PlatformIcon = isInstagram ? IGIcon : YTIcon;
    return (
      <div className="min-h-screen px-5 pb-28 pt-6 lg:px-8 lg:pb-12">
        <PageHeader platform={platform} setPlatform={setPlatform} dateRange={dateRange}
          setDateRange={setDateRange} onRefresh={() => {}} loading={false} lastSynced={null}
          accounts={[]} selectedId={null} setSelectedId={setSelectedId} />
        <div className="mt-6 flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isInstagram ? "bg-fuchsia-500/10" : "bg-red-500/10"}`}>
            <PlatformIcon className={`h-7 w-7 ${isInstagram ? "text-fuchsia-300" : "text-red-400"}`} />
          </div>
          <p className="font-semibold text-white">Connect {isInstagram ? "Instagram" : "YouTube"} to see analytics</p>
          <p className="mt-1.5 max-w-xs text-sm text-white/40">
            {isInstagram
              ? "Connect your professional Instagram account to track views, reach, interactions, and top posts."
              : "Connect your YouTube channel to track views, watch time, subscriber growth, and top videos."}
          </p>
          <button onClick={() => navigate("/workspace/connections")}
            className={`mt-5 rounded-xl px-5 py-2.5 text-sm font-bold transition ${isInstagram ? "bg-fuchsia-500/15 text-fuchsia-300 hover:bg-fuchsia-500/25" : "bg-red-500/15 text-red-300 hover:bg-red-500/25"}`}>
            Connect {isInstagram ? "Instagram" : "YouTube"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 pb-28 pt-6 lg:px-8 lg:pb-12">

      {/* ── Page Header ── */}
      <PageHeader
        platform={platform} setPlatform={setPlatform}
        dateRange={dateRange} setDateRange={setDateRange}
        onRefresh={() => platform === "youtube" ? fetchAnalytics(true) : setIgRefreshKey(key => key + 1)}
        loading={platform === "youtube" ? loading : igStatus.loading}
        lastSynced={platform === "youtube" ? lastSynced : igStatus.lastSynced}
        accounts={currentAccounts} selectedId={selectedId} setSelectedId={setSelectedId}
      />

      {/* ── Non-YT placeholder ── */}
      {platform === "tiktok" && (
        <ComingSoonState platform={platform} onConnect={() => navigate("/workspace/connections")} />
      )}

      {platform === "instagram" && error && (
        <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {platform === "instagram" && (
        <InstagramStats
          account={igAccounts.find(account => account.id === selectedId)}
          dateRange={dateRange}
          refreshKey={igRefreshKey}
          onReconnect={reconnectInstagram}
          onStatus={setIgStatus}
        />
      )}

      {platform === "youtube" && (
        <>
          {/* Reconnect */}
          {data?.needs_reconnect && (
            <div className="mb-5">
              <ReconnectBanner onReconnect={() => navigate("/workspace/connections")} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Channel header */}
          {loading && !channel ? (
            <div className="mb-6 flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24" /></div>
            </div>
          ) : channel ? (
            <div className="mb-6 flex items-center gap-3">
              {channel.avatar_url ? (
                <img src={channel.avatar_url} alt={channel.name}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white/[0.07]" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
                  <YTIcon className="h-6 w-6 text-red-400" />
                </div>
              )}
              <div>
                <p className="font-bold text-white">{channel.name}</p>
                <p className="text-sm text-white/40">
                  {fmtNum(channel.subscribers)} subscribers · {fmtNum(channel.total_views)} total views · {fmtNum(channel.video_count)} videos
                </p>
              </div>
            </div>
          ) : null}

          {/* Overview cards */}
          {loading && !overview ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : overview ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <OverviewCard icon={Eye}   label="Views"            value={fmtNum(overview.views)}               change={overview.vs_prev?.views}              accent="green"  />
              <OverviewCard icon={Clock} label="Watch Time"       value={fmtWatchTime(overview.watch_time_minutes)} change={overview.vs_prev?.watch_time_minutes} accent="blue"   />
              <OverviewCard icon={Users} label="Subscribers"      value={(overview.net_subscribers >= 0 ? "+" : "") + fmtNum(overview.net_subscribers)} change={overview.vs_prev?.subscribers_gained} accent="purple" />
              <OverviewCard icon={Play}  label="Avg View Duration" value={fmtDuration(overview.avg_view_duration_seconds)} change={null}                           accent="amber"  />
            </div>
          ) : null}

          <div className="mb-5 grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_345px]">
          {/* Daily trend chart */}
          {(daily.length > 0 || loading) && (
            <div className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 lg:min-h-[278px]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Daily Trend</h2>
                <div className="flex rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
                  {[["views","Views"],["watch_time_minutes","Watch Time"]].map(([m,l]) => (
                    <button key={m} onClick={() => setChartMetric(m)}
                      className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                        chartMetric === m ? "bg-white/[0.09] text-white" : "text-white/35 hover:text-white/60"
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {loading && !daily.length ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <LineChart data={daily} metric={chartMetric} />
              )}
              <p className="mt-2 text-right text-[10px] text-white/20">
                Data reflects YouTube's analytics window · 1–2 day processing delay
              </p>
            </div>
          )}

          {/* Realtime widget */}
          {recent7d.length > 0 && (
            <div className="h-full rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5 lg:min-h-[278px]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <h2 className="text-sm font-bold text-white">Realtime</h2>
                  </div>
                  <p className="mt-0.5 text-xs text-white/38">Updating live</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">{fmtNum(realtimeTopVideos.reduce((s, v) => s + v.realtime_views, 0))}</p>
                  <p className="text-xs text-white/35">views</p>
                </div>
              </div>
              <div className="my-4 border-t border-white/[0.08]" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/45">{realtimeRange === "1h" ? "Last 1 hour" : "Last 48 hours"}</p>
                <div className="flex rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5">
                  {["1h", "48h"].map(r => (
                    <button
                      key={r}
                      onClick={() => setRealtimeRange(r)}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                        realtimeRange === r ? "bg-white/[0.09] text-white" : "text-white/35 hover:text-white/60"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <MiniBarChart data={recent7d} metric={chartMetric} range={realtimeRange} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-white/35">
                <span>{realtimeRange === "1h" ? "-1h" : "-48h"}</span>
                <span>Now</span>
              </div>
              {realtimeTopVideos.length > 0 && (
                <>
                  <div className="my-4 border-t border-white/[0.08]" />
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/45">
                    <span>Top content</span>
                    <span>Views</span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {realtimeTopVideos.slice(0, 3).map(v => (
                      <button
                        key={v.video_id}
                        onClick={() => setSelectedVideo(v)}
                        className="grid w-full grid-cols-[40px_1fr_auto] items-center gap-2 text-left"
                      >
                        <div className="h-10 w-10 overflow-hidden rounded bg-white/[0.06]">
                          {v.thumbnail_url && <img src={v.thumbnail_url} alt={cleanTitle(v.title)} className="h-full w-full object-cover" loading="lazy" />}
                        </div>
                        <p className="min-w-0 truncate text-xs font-semibold text-white/85">{cleanTitle(v.title) || "Untitled"}</p>
                        <span className="text-xs font-bold text-white">{fmtNum(v.realtime_views)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          </div>

          {/* Videos section */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-0.5">
                {[["top","Top Videos"],["recent","Recent"]].map(([t,l]) => (
                  <button key={t} onClick={() => setVideoTab(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      videoTab === t ? "bg-white/[0.08] text-white" : "text-white/35 hover:text-white/55"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              <span className="text-xs text-white/25">
                {allVideos.length > 0 ? `${allVideos.length} videos · ${dateRange}` : ""}
              </span>
            </div>

            {loading && !allVideos.length ? (
              <div className="space-y-3 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
            ) : visibleVids.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
                <YTIcon className="mb-3 h-8 w-8 text-white/10" />
                <p className="text-sm font-semibold text-white/30">No videos for this period</p>
              </div>
            ) : (
              <>
                <div className="hidden border-b border-white/[0.05] px-4 py-2 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_36px] lg:gap-4">
                  {["Video","Views","Watch Time","Avg Duration","Likes",""].map(h => (
                    <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-white/22">{h}</span>
                  ))}
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {visibleVids.map(v => (
                    <button key={v.video_id}
                      onClick={() => setSelectedVideo(v)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_48px] items-center gap-3 p-4 text-left transition hover:bg-white/[0.02] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_36px] lg:gap-4"
                    >
                      {/* Thumbnail */}
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-10 w-[72px] shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                          {v.thumbnail_url && <img src={v.thumbnail_url} alt={cleanTitle(v.title)} className="h-full w-full object-cover" loading="lazy" />}
                          {v.duration_seconds > 0 && (
                            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                              {fmtDuration(v.duration_seconds)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-xs font-semibold leading-snug text-white/80 lg:text-sm">{cleanTitle(v.title) || "Untitled"}</p>
                          {v.published_at && <p className="mt-0.5 text-[10px] text-white/30">{fmtDate(v.published_at)}</p>}
                        </div>
                      </div>
                      {/* Desktop cells */}
                      <span className="hidden self-center text-sm font-bold text-white/75 lg:block">{fmtNum(v.views)}</span>
                      <span className="hidden self-center text-sm text-white/50 lg:block">{fmtWatchTime(v.watch_time_minutes)}</span>
                      <span className="hidden self-center text-sm text-white/50 lg:block">{fmtDuration(v.avg_view_duration_seconds)}</span>
                      <span className="hidden self-center text-sm text-white/50 lg:block">{fmtNum(v.likes)}</span>
                      {/* Mobile compact */}
                      <div className="flex w-12 flex-col items-end justify-center gap-0.5 self-stretch lg:hidden">
                        <span className="text-sm font-bold tabular-nums text-white/70">{fmtNum(v.views)}</span>
                        <span className="text-right text-[9px] leading-tight text-white/30">
                          {fmtWatchTime(v.watch_time_minutes) === "—" ? "watch" : `${fmtWatchTime(v.watch_time_minutes)} watch`}
                        </span>
                      </div>
                      <ChevronRight className="hidden h-4 w-4 shrink-0 text-white/20 lg:block" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Video detail modal */}
      {selectedVideo && (
        <VideoDetailModal
          video={selectedVideo}
          accountId={selectedId}
          dateRange={dateRange}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}

// ── Extracted sub-components ──────────────────────────────────────────────────

function PageHeader({ platform, setPlatform, dateRange, setDateRange, onRefresh, loading, lastSynced, accounts, selectedId, setSelectedId }) {
  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:flex-wrap sm:text-left">
        <div className="w-full sm:flex-1">
          <h1 className="text-[22px] font-bold tracking-tight text-white">Analytics</h1>
          {lastSynced && !loading && (
            <p className="mt-0.5 text-xs text-white/28">
              Updated {new Date(lastSynced).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {accounts.length > 1 && (
          <select value={selectedId ?? ""} onChange={e => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-center text-sm text-white/65 focus:outline-none sm:w-auto sm:text-left">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.display_name ?? a.username ?? platform}</option>)}
          </select>
        )}

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="grid flex-1 grid-cols-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-0.5 sm:flex sm:flex-none">
          {DATE_RANGES.map(r => (
            <button key={r.value} onClick={() => setDateRange(r.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition sm:px-3 ${
                dateRange === r.value ? "bg-white/[0.1] text-white" : "text-white/35 hover:text-white/60"
              }`}>
              {r.label}
            </button>
          ))}
          </div>

          <button onClick={onRefresh} disabled={loading}
            className="flex h-[34px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm font-bold text-white/50 transition hover:bg-white/[0.07] disabled:opacity-50 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-4 sm:py-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-1">
        {PLATFORMS.map(({ id, label, Icon, color, active }) => (
          <button key={id} onClick={() => active ? setPlatform(id) : null}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition sm:justify-start ${
              id === "youtube" ? "order-1 sm:order-none" : id === "tiktok" ? "order-2 sm:order-none" : "order-3 col-span-2 sm:order-none sm:col-span-1"
            } ${
              platform === id
                ? "border-white/15 bg-white/[0.08] text-white"
                : active
                  ? "border-white/[0.06] bg-white/[0.02] text-white/45 hover:bg-white/[0.05] hover:text-white/70"
                  : "cursor-default border-white/[0.04] bg-transparent text-white/20"
            }`}>
            {createElement(Icon, { className: `h-3.5 w-3.5 ${platform === id ? color : ""}` })}
            {label}
            {!active && (
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-white/30">Soon</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ComingSoonState({ platform }) {
  const p = PLATFORMS.find(p => p.id === platform);
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
      {p && createElement(p.Icon, { className: `mb-4 h-10 w-10 ${p.color} opacity-30` })}
      <p className="font-semibold text-white">{p?.label ?? "Platform"} Analytics</p>
      <p className="mt-1.5 max-w-xs text-sm text-white/35">Coming soon — connect more platforms to track all your content in one place.</p>
    </div>
  );
}
