import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Send, CheckCircle2, XCircle, ChevronRight, ExternalLink, RefreshCw, Play, Pause } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import PostModal from "../../components/publish/PostModal";
import ConnectAccountsModal from "../../components/publish/ConnectAccountsModal";
import { FULL_VIDEO_TOOL_KEY } from "../../lib/jobs";

const PUBLISH_ROUTE = "/workspace/publishv";

/* ── Platform icons ─────────────────────────────────────────────────────── */

function IgIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

function TtIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.79a8.18 8.18 0 004.78 1.52V6.85a4.85 4.85 0 01-1.01-.16z"/>
    </svg>
  );
}

function YtIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function getUpcomingDays(count = 7) {
  const days = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function dayLabel(date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function dateSuffix(date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

// YYYY-MM-DD — matches the key format PostModal's schedule calendar uses
function dateKey(date) {
  return date.toLocaleDateString("sv");
}


/* ── Connected account pill ──────────────────────────────────────────────── */

const CONNECTED_PLATFORM_UI = {
  youtube: {
    label: "YouTube",
    group: "border-red-500/20 bg-red-500/[0.035]",
    icon: "bg-[#FF0000] text-white shadow-[0_0_20px_rgba(255,0,0,0.18)]",
    count: "border-red-500/20 bg-red-500/10 text-red-300",
    dot: "bg-red-400",
  },
  instagram: {
    label: "Instagram",
    group: "border-fuchsia-500/20 bg-fuchsia-500/[0.035]",
    icon: "bg-gradient-to-br from-[#833AB4] via-[#C13584] to-[#FD1D1D] text-white shadow-[0_0_20px_rgba(193,53,132,0.18)]",
    count: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300",
    dot: "bg-fuchsia-400",
  },
  tiktok: {
    label: "TikTok",
    group: "border-cyan-400/15 bg-cyan-400/[0.025]",
    icon: "border border-white/10 bg-[#17191d] text-white shadow-[3px_2px_0_rgba(238,29,82,0.3),-3px_-2px_0_rgba(37,244,238,0.22)]",
    count: "border-cyan-400/15 bg-cyan-400/[0.07] text-cyan-200",
    dot: "bg-cyan-300",
  },
};

function connectedAccountLabel(account) {
  if (account.platform === "youtube") {
    return account.display_name || account.username || account.platform_user_id;
  }
  const username = account.username || account.display_name || account.platform_user_id;
  return username?.startsWith("@") ? username : `@${username}`;
}

function ConnectedAccount({ account, onDisconnect }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const platformUi = CONNECTED_PLATFORM_UI[account.platform] || CONNECTED_PLATFORM_UI.instagram;

  async function handleDisconnect() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fnName = account.platform === "youtube" ? "youtube-disconnect"
        : account.platform === "tiktok" ? "tiktok-disconnect"
        : "instagram-disconnect";
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ account_id: account.id }),
        }
      );
      if (res.ok) onDisconnect(account.id);
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 sm:flex-nowrap">
      <span className={`h-2 w-2 shrink-0 rounded-full ${platformUi.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-[13px] font-semibold text-white/75">{connectedAccountLabel(account)}</p>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Connected
        </span>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/20 transition"
            >
              {loading ? "…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/40 hover:text-white hover:border-white/20 transition"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Queue slot (a real scheduled/in-flight job) ──────────────────────────── */

function ConnectedAccountGroup({ platform, accounts, onDisconnect }) {
  const ui = CONNECTED_PLATFORM_UI[platform] || CONNECTED_PLATFORM_UI.instagram;

  return (
    <section className={`overflow-hidden rounded-2xl border ${ui.group}`}>
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-3.5 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ui.icon}`}>
          {platform === "youtube" ? (
            <YtIcon className="h-4 w-4" />
          ) : platform === "tiktok" ? (
            <TtIcon className="h-4 w-4" />
          ) : (
            <IgIcon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-white">{ui.label}</p>
          <p className="text-[10px] text-white/35">
            {accounts.length} connected {platform === "youtube"
              ? (accounts.length === 1 ? "channel" : "channels")
              : (accounts.length === 1 ? "account" : "accounts")}
          </p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ui.count}`}>
          {accounts.length}
        </span>
      </div>
      <div className="divide-y divide-white/[0.055]">
        {accounts.map(account => (
          <ConnectedAccount
            key={account.id}
            account={account}
            onDisconnect={onDisconnect}
          />
        ))}
      </div>
    </section>
  );
}

function QueueSlot({ time = "—", job }) {
  const displayTime = job.scheduled_for
    ? new Date(job.scheduled_for).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : time;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <span className="shrink-0 text-sm text-white/50 w-[72px]">{displayTime}</span>
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="h-10 w-[22px] shrink-0 rounded-md overflow-hidden bg-white/5">
          {job.video_url && (
            <video
              src={job.video_url}
              className="w-full h-full object-cover"
              muted preload="metadata"
              onLoadedMetadata={e => { e.currentTarget.currentTime = 0.1; }}
            />
          )}
        </div>
        <p className="text-sm text-white/70 truncate flex-1">{job.caption || "No caption"}</p>
      </div>
      <StatusBadge status={job.status} scheduledFor={job.scheduled_for} />
    </div>
  );
}

/* ── Add Video button (per queue day) ─────────────────────────────────────── */

function AddVideoButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white/40 transition hover:border-[#7A3BFF]/40 hover:bg-[#7A3BFF]/[0.06] hover:text-[#C084FC]"
    >
      <Plus className="h-4 w-4" />
      Add Video
    </button>
  );
}

/* ── Status badge ────────────────────────────────────────────────────────── */

function StatusBadge({ status, scheduledFor = null }) {
  if (status === "queued" && scheduledFor) {
    const d = new Date(scheduledFor);
    const label = "Scheduled · " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return (
      <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-[#C084FC] bg-[#7A3BFF]/10 border-[#7A3BFF]/25">
        {label}
      </span>
    );
  }
  const map = {
    queued:             { label: "Queued",                  cls: "text-white/50  bg-white/5       border-white/10" },
    creating_container: { label: "Preparing Reel",          cls: "text-blue-400  bg-blue-500/10   border-blue-500/25" },
    preparing:          { label: "Preparing",               cls: "text-blue-400  bg-blue-500/10   border-blue-500/25" },
    uploading:          { label: "Uploading",               cls: "text-blue-400  bg-blue-500/10   border-blue-500/25" },
    processing:         { label: "Processing",              cls: "text-amber-400 bg-amber-500/10  border-amber-500/25" },
    publishing:         { label: "Publishing",              cls: "text-amber-400 bg-amber-500/10  border-amber-500/25" },
    published:          { label: "Published",               cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
    draft_created:      { label: "Sent to TikTok Drafts",   cls: "text-sky-400   bg-sky-500/10     border-sky-500/25" },
    failed:             { label: "Failed",                  cls: "text-red-400   bg-red-500/10    border-red-500/25" },
    canceled:           { label: "Canceled",                cls: "text-white/30  bg-white/5       border-white/5" },
  };
  const s = map[status] || map.queued;
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

/* ── Past publication card ───────────────────────────────────────────────── */

function PastCard({ job, account }) {
  const vidRef    = useRef(null);
  const [playing, setPlaying]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const platformUi = CONNECTED_PLATFORM_UI[job.platform] || CONNECTED_PLATFORM_UI.instagram;
  const accountName = account ? connectedAccountLabel(account) : "Previously connected account";

  function togglePlay() {
    const v = vidRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else         { v.play().catch(() => {}); setPlaying(true); }
  }

  const caption     = job.caption || "";
  const hashIdx     = caption.search(/#\w/);
  const captionText = hashIdx > 0 ? caption.slice(0, hashIdx).trimEnd() : caption;
  const captionTags = hashIdx > 0 ? caption.slice(hashIdx) : "";
  const fullLen     = caption.length;
  const isLong      = fullLen > 350;
  const showFull    = expanded || !isLong;

  const dateStr = job.published_at
    ? new Date(job.published_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : new Date(job.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="flex">
        {/* Video — 9:16, clickable to play */}
        <div
          className="relative shrink-0 w-[100px] bg-black cursor-pointer"
          style={{ aspectRatio: "9/16" }}
          onClick={togglePlay}
        >
          {job.video_url ? (
            <>
              <video
                ref={vidRef}
                src={job.video_url}
                className="absolute inset-0 h-full w-full object-cover"
                muted preload="metadata"
                onLoadedMetadata={() => { if (vidRef.current) vidRef.current.currentTime = 0.1; }}
                onEnded={() => setPlaying(false)}
              />
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing ? "opacity-0 hover:opacity-100" : "opacity-100"}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm border border-white/20">
                  {playing
                    ? <Pause className="h-4 w-4 text-white" />
                    : <Play  className="h-4 w-4 text-white ml-0.5" />}
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 bg-white/[0.04]" />
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 p-3.5 flex flex-col justify-between">
          <div>
            {/* Platform + status row */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${platformUi.icon}`}>
                {job.platform === "youtube" ? (
                  <YtIcon className="h-3 w-3" />
                ) : job.platform === "tiktok" ? (
                  <TtIcon className="h-3 w-3" />
                ) : (
                  <IgIcon className="h-3 w-3" />
                )}
              </div>
              <span className="max-w-[220px] truncate text-[11px] font-medium text-white/50">
                {platformUi.label} · <span className="text-white/70">{accountName}</span>
              </span>
              <StatusBadge status={job.status} scheduledFor={job.scheduled_for} />
              {job.permalink && (
                <a
                  href={job.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Caption */}
            {caption ? (
              <>
                <p className="text-[13px] text-white/70 leading-snug">
                  {showFull ? captionText : caption.slice(0, 350) + "…"}
                </p>
                {captionTags && showFull && (
                  <p className="mt-2 text-[13px] text-[#9F5CFF]/80 leading-snug">{captionTags}</p>
                )}
                {isLong && (
                  <button
                    onClick={() => setExpanded(v => !v)}
                    className="mt-1 text-[11px] text-[#9F5CFF] hover:text-[#C084FC] transition"
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                )}
              </>
            ) : (
              <p className="text-[13px] text-white/25 italic">No caption</p>
            )}

            {job.error_message && (
              <p className="mt-1.5 text-[11px] text-red-400/80 leading-snug">{job.error_message}</p>
            )}
          </div>

          <p className="mt-2 text-[11px] text-white/25">{dateStr}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Toast ───────────────────────────────────────────────────────────────── */

function Toast({ type, message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const isSuccess = type === "success";
  return (
    <div className={`fixed bottom-24 left-1/2 z-[9999] -translate-x-1/2 flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${
      isSuccess
        ? "border-emerald-500/30 bg-[#0a1a12]/90 text-emerald-300"
        : "border-red-500/30 bg-[#1a0a0a]/90 text-red-300"
    }`}>
      {isSuccess ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

function InstagramRequirementModal({ loading, onCancel, onContinue }) {
  const [showSwitchHelp, setShowSwitchHelp] = useState(false);

  return (
    <div className="fixed inset-0 z-[9200] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e1012] shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#7A3BFF]/60 to-transparent" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[18px] font-bold leading-tight text-white">
              Instagram requires a Creator or Business account
            </h2>
            <button
              onClick={onCancel}
              disabled={loading}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-[15px] font-semibold leading-none text-white/45 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-50"
              aria-label="Close"
            >
              x
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            To publish directly from Zyvo, Instagram requires your account to be set as a Creator or Business account. Switching is free and takes about 30 seconds. Personal accounts can still download videos and post manually.
          </p>
          <button
            onClick={() => setShowSwitchHelp((value) => !value)}
            className="mt-4 text-sm font-semibold text-[#C084FC] transition hover:text-white"
          >
            How do I switch my account?
          </button>

          {showSwitchHelp && (
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-white">Switch in Instagram</p>
              <ol className="mt-3 space-y-2 text-sm leading-relaxed text-white/55">
                <li>1. Open Instagram and go to your profile.</li>
                <li>2. Tap the menu, then Settings and privacy.</li>
                <li>3. Open Account type and tools.</li>
                <li>4. Choose Switch to professional account.</li>
                <li>5. Pick Creator or Business, then come back to Zyvo and continue.</li>
              </ol>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              disabled={loading}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#090A0A] transition hover:bg-white/90 disabled:opacity-70"
            >
              {loading ? "Redirecting..." : "Continue to Instagram"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublishPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [tab, setTab]                   = useState("scheduled");
  const [accounts, setAccounts]         = useState([]);
  const [showConnectedAccounts, setShowConnectedAccounts] = useState(() => {
    if (typeof window === "undefined" || !user?.id) return false;
    return window.localStorage.getItem(`zyvo:publish:show-connected-accounts:${user.id}`) === "true";
  });
  const [pastJobs, setPastJobs]         = useState([]);
  const [activeJobs, setActiveJobs]     = useState([]);

  // Map of creation_id → 'scheduled' | 'published' for PostModal thumbnail badges
  // creation_id → array of platforms ("instagram" | "youtube") it's already been
  // posted/scheduled to. Shown as small badges on the video, not a hard lock —
  // the video can still be reused for another platform or another day.
  const videoPostStatus = useMemo(() => {
    const map = {};
    for (const job of [...activeJobs, ...pastJobs]) {
      if (!job.creation_id || job.status === "failed" || job.status === "canceled") continue;
      if (!map[job.creation_id]) map[job.creation_id] = [];
      if (!map[job.creation_id].includes(job.platform)) map[job.creation_id].push(job.platform);
    }
    return map;
  }, [activeJobs, pastJobs]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingJobs, setLoadingJobs]   = useState(false);
  const [postModalOpen, setPostModalOpen]       = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [instagramConfirmOpen, setInstagramConfirmOpen] = useState(false);
  // Set when "Add Video" is clicked for a specific queue day — tells
  // PostModal to open straight into the Schedule section for that date.
  const [scheduleForDate, setScheduleForDate]   = useState(null);
  const [toast, setToast]               = useState(null);
  const [connectingIG, setConnectingIG] = useState(false);

  // Pre-fetch videos on mount so PostModal opens instantly with content
  const [videos, setVideos]               = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const showToast = useCallback((type, message) => setToast({ type, message }), []);

  useEffect(() => {
    if (!user?.id) {
      setShowConnectedAccounts(false);
      return;
    }
    setShowConnectedAccounts(
      window.localStorage.getItem(`zyvo:publish:show-connected-accounts:${user.id}`) === "true",
    );
  }, [user?.id]);

  function toggleConnectedAccounts() {
    setShowConnectedAccounts(current => {
      const next = !current;
      if (user?.id) {
        window.localStorage.setItem(
          `zyvo:publish:show-connected-accounts:${user.id}`,
          String(next),
        );
      }
      return next;
    });
  }

  /* ── Handle OAuth callback params ──────────────────────────────────────── */
  useEffect(() => {
    const p = new URLSearchParams(location.search);

    const igConnect = p.get("ig_connect");
    if (igConnect === "success") {
      showToast("success", "Instagram connected successfully!");
      navigate(PUBLISH_ROUTE, { replace: true });
      fetchAccounts();
      return;
    } else if (igConnect === "error") {
      const reason = p.get("reason") || "unknown";
      const msgs = {
        access_denied:         "Connection cancelled.",
        token_exchange_failed: "Could not complete connection. Please try again.",
        profile_fetch_failed:  "Could not read your Instagram profile. Please try again.",
        professional_account_required: "Instagram needs your account to be switched to Creator or Business before Zyvo can publish directly. You can switch for free in Instagram settings, then try connecting again.",
        expired_state:         "Connection link expired. Please try again.",
        state_already_used:    "Connection link already used. Please try again.",
        oauth_not_configured:  "Instagram connection is not configured yet.",
        internal_error:        "Something went wrong. Please try again.",
      };
      showToast("error", msgs[reason] || "Connection failed. Please try again.");
      navigate(PUBLISH_ROUTE, { replace: true });
      return;
    }

    const ytConnect = p.get("yt_connect");
    if (ytConnect === "success") {
      showToast("success", "YouTube connected successfully!");
      navigate(PUBLISH_ROUTE, { replace: true });
      fetchAccounts();
    } else if (ytConnect === "error") {
      const reason = p.get("reason") || "unknown";
      const msgs = {
        access_denied:        "Connection cancelled.",
        token_exchange_failed:"Could not complete YouTube connection. Please try again.",
        profile_fetch_failed: "Could not read your YouTube channel. Please try again.",
        no_channel_found:     "No YouTube channel found on this account. Please create a channel first.",
        expired_state:        "Connection link expired. Please try again.",
        state_already_used:   "Connection link already used. Please try again.",
        oauth_not_configured: "YouTube connection is not configured yet.",
        internal_error:       "Something went wrong. Please try again.",
      };
      showToast("error", msgs[reason] || "YouTube connection failed. Please try again.");
      navigate(PUBLISH_ROUTE, { replace: true });
      return;
    }

    const ttConnect = p.get("tt_connect");
    if (ttConnect === "success") {
      showToast("success", "TikTok connected successfully!");
      navigate(PUBLISH_ROUTE, { replace: true });
      fetchAccounts();
    } else if (ttConnect === "error") {
      const reason = p.get("reason") || "unknown";
      const msgs = {
        access_denied:         "Connection cancelled.",
        token_exchange_failed: "Could not complete TikTok connection. Please try again.",
        profile_fetch_failed:  "Could not read your TikTok profile. Please try again.",
        expired_state:         "Connection link expired. Please try again.",
        state_already_used:    "Connection link already used. Please try again.",
        oauth_not_configured:  "TikTok connection is not configured yet.",
        internal_error:        "Something went wrong. Please try again.",
      };
      showToast("error", msgs[reason] || "TikTok connection failed. Please try again.");
      navigate(PUBLISH_ROUTE, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Fetch connected accounts ──────────────────────────────────────────── */
  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase.rpc("get_my_social_accounts");
      if (!error) setAccounts(data || []);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  /* ── Disconnect account ────────────────────────────────────────────────── */
  const disconnectAccount = useCallback(async (accountId) => {
    const account  = accounts.find(a => a.id === accountId);
    const platform = account?.platform ?? "instagram";
    const fnName   = platform === "youtube" ? "youtube-disconnect" : "instagram-disconnect";

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ account_id: accountId }),
      }
    );
    if (res.ok) setAccounts(prev => prev.filter(a => a.id !== accountId));
  }, [accounts]);

  /* ── Fetch publish jobs (Instagram + YouTube, merged) ───────────────────── */
  const fetchJobs = useCallback(async ({ silent = false } = {}) => {
    if (!user) return;
    if (!silent) setLoadingJobs(true);
    try {
      const [{ data: igData }, { data: ytData }, { data: ttData }] = await Promise.all([
        supabase
          .from("instagram_publish_jobs")
          .select("id, status, caption, video_url, permalink, media_id, error_message, created_at, published_at, creation_id, scheduled_for, social_account_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("youtube_publish_jobs")
          .select("id, status, description, video_url, youtube_url, error_message, created_at, published_at, creation_id, social_account_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("tiktok_publish_jobs")
          .select("id, status, publish_mode, title, video_url, tiktok_share_url, error_message, created_at, published_at, creation_id, social_account_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const igJobs = (igData || []).map(j => ({ ...j, platform: "instagram" }));
      const ytJobs = (ytData || []).map(j => ({
        ...j,
        platform:      "youtube",
        caption:       j.description,
        permalink:     j.youtube_url,
        scheduled_for: null, // YouTube doesn't support scheduling yet — always immediate
      }));
      const ttJobs = (ttData || []).map(j => ({
        ...j,
        platform:      "tiktok",
        caption:       j.title,
        permalink:     j.tiktok_share_url,
        scheduled_for: null, // TikTok doesn't support scheduling yet — always immediate
      }));
      const jobs = [...igJobs, ...ytJobs, ...ttJobs].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      // terminal + historical: published, failed, canceled (+ TikTok's draft_created)
      setPastJobs(jobs.filter(j => ["published", "draft_created", "failed", "canceled"].includes(j.status)));
      // still in flight
      setActiveJobs(jobs.filter(j => ["queued", "creating_container", "processing", "publishing", "uploading", "preparing"].includes(j.status)));
    } finally {
      if (!silent) setLoadingJobs(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Pre-fetch ready videos so PostModal has content the moment it opens
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, result_url, prompt, created_at, type, tool_key")
        .eq("user_id", user.id)
        .eq("type", "video")
        .eq("status", "succeeded")
        .eq("tool_key", FULL_VIDEO_TOOL_KEY)
        .not("result_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);
      if (active) {
        setVideos(data || []);
        setLoadingVideos(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  // Load jobs on mount so activeJobs shows up on the Scheduled tab immediately
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Refresh when switching to Past Publications
  useEffect(() => {
    if (tab === "past") fetchJobs();
  }, [tab, fetchJobs]);

  // Poll every 6 s while jobs are in flight; also ping instagram-publish-status
  // to advance any job the background poller left in "processing" (recovery path).
  useEffect(() => {
    if (activeJobs.length === 0) return;

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY;

    async function tick() {
      await fetchJobs({ silent: true });

      // For processing/publishing jobs, trigger a live Meta check server-side
      const stale = activeJobs.filter(j =>
        j.status === "processing" || j.status === "publishing"
      );
      if (stale.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          stale.forEach(job => {
            fetch(`${SUPABASE_URL}/functions/v1/instagram-publish-status`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey:        ANON_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ job_id: job.id }),
            }).catch(() => {});
          });
        }
      }
    }

    const id = setInterval(tick, 6000);
    return () => clearInterval(id);
  }, [activeJobs.length, fetchJobs]);

  /* ── Connect Instagram ─────────────────────────────────────────────────── */
  async function connectInstagram() {
    setConnectingIG(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showToast("error", "Please sign in before connecting Instagram.");
        setConnectingIG(false);
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth-start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ returnTo: PUBLISH_ROUTE }),
        }
      );
      const json = await res.json().catch(() => ({}));
      const authorizationUrl = json.authorizationUrl || json.url;
      if (authorizationUrl) {
        window.location.assign(authorizationUrl);
      } else {
        showToast("error", json.error || "Could not initiate connection. Please try again.");
        setConnectingIG(false);
      }
    } catch {
      showToast("error", "Network error. Please try again.");
      setConnectingIG(false);
    }
  }

  function requestInstagramConnect() {
    setInstagramConfirmOpen(true);
  }

  function cancelInstagramConnect() {
    if (connectingIG) return;
    setInstagramConfirmOpen(false);
  }

  const upcomingDays = getUpcomingDays(7);
  const hasConnectedAccounts = accounts.length > 0;
  const connectedAccountGroups = useMemo(
    () => ["youtube", "instagram", "tiktok"]
      .map(platform => ({
        platform,
        accounts: accounts.filter(account => account.platform === platform),
      }))
      .filter(group => group.accounts.length > 0),
    [accounts],
  );

  function openPostModal() {
    if (!hasConnectedAccounts) {
      setConnectModalOpen(true);
      return;
    }
    setScheduleForDate(null);
    setPostModalOpen(true);
  }

  function openScheduleForDay(day) {
    if (!hasConnectedAccounts) {
      setConnectModalOpen(true);
      return;
    }
    setScheduleForDate(dateKey(day));
    setPostModalOpen(true);
  }

  return (
    <div className="min-h-screen pb-28 lg:pb-12">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-5 lg:px-8 pt-6 pb-5">
        <h1 className="text-[22px] font-bold text-white tracking-tight">Your Posting Queue</h1>
        <p className="mt-0.5 text-sm text-white/40">Your content published while you sleep</p>
        <button
          onClick={openPostModal}
          className="mt-4 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#090A0A] hover:bg-white/90 active:scale-[.98] transition shadow-md"
        >
          <Plus className="h-4 w-4" />
          Publish New Content
        </button>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="px-5 lg:px-8 mb-5">
        <div className="grid grid-cols-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 max-w-md">
          {["scheduled", "past"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                tab === t
                  ? "bg-white/[0.10] text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t === "scheduled" ? "Scheduled" : "Past Publications"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 lg:px-8 space-y-6">

        {/* ── Connect banner / connected accounts ────────────────────── */}
        {tab === "scheduled" && (loadingAccounts ? (
          <div className="h-14 rounded-2xl border border-white/[0.05] bg-white/[0.02] animate-pulse" />
        ) : hasConnectedAccounts ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={toggleConnectedAccounts}
              aria-expanded={showConnectedAccounts}
              className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-left transition hover:border-white/15 hover:bg-white/[0.045]"
            >
              <div className="flex -space-x-1.5">
                {connectedAccountGroups.map(group => (
                  <span
                    key={group.platform}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ring-2 ring-[#0c0d0f] ${
                      CONNECTED_PLATFORM_UI[group.platform]?.icon || CONNECTED_PLATFORM_UI.instagram.icon
                    }`}
                  >
                    {group.platform === "youtube" ? (
                      <YtIcon className="h-3 w-3" />
                    ) : group.platform === "tiktok" ? (
                      <TtIcon className="h-3 w-3" />
                    ) : (
                      <IgIcon className="h-3 w-3" />
                    )}
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-white/70">
                  {showConnectedAccounts ? "Hide connected accounts" : "Show connected accounts"}
                </p>
                <p className="mt-0.5 text-[10px] text-white/30">
                  {accounts.length} connected {accounts.length === 1 ? "account" : "accounts"}
                </p>
              </div>
              <ChevronRight
                className={`h-4 w-4 text-white/25 transition-transform duration-200 group-hover:text-white/50 ${
                  showConnectedAccounts ? "rotate-90" : ""
                }`}
              />
            </button>

            {showConnectedAccounts && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 gap-3">
                  {connectedAccountGroups.map(group => (
                    <ConnectedAccountGroup
                      key={group.platform}
                      platform={group.platform}
                      accounts={group.accounts}
                      onDisconnect={(id) => setAccounts(prev => prev.filter(account => account.id !== id))}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setConnectModalOpen(true)}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-transparent px-4 py-2.5 text-sm text-white/30 transition hover:border-white/15 hover:text-white/60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Connect another account
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            {/*
              SVG beam overlay — sits on top of the button, pointer-events
              disabled so clicks pass through to the button below.
              overflow:visible lets the blur filter bleed outside the rect.
              pathLength="1000" normalises the path so dasharray units are
              always fractions of the full perimeter regardless of button size.
            */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: "visible", zIndex: 1 }}
            >
              <defs>
                <filter id="cb-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Static faint base border */}
              <rect x="0" y="0" width="100%" height="100%" rx="16" ry="16"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1"
              />

              {/* Glow halo — soft, barely-there shimmer */}
              <rect x="0" y="0" width="100%" height="100%" rx="16" ry="16"
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="3"
                pathLength="1000"
                strokeDasharray="60 940"
                strokeDashoffset="0"
                filter="url(#cb-glow)"
                style={{ animation: "cb-beam-glow 6s linear infinite" }}
              />

              {/* Sharp lighter-gray core */}
              <rect x="0" y="0" width="100%" height="100%" rx="16" ry="16"
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1"
                pathLength="1000"
                strokeDasharray="25 975"
                strokeDashoffset="0"
                style={{ animation: "cb-beam-core 6s linear infinite" }}
              />
            </svg>

            {/* Button */}
            <button
              onClick={() => setConnectModalOpen(true)}
              className="group relative flex w-full items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#0c0d0f] px-5 py-4 text-left hover:bg-[#101214] active:scale-[.995] transition-colors"
            >
              {/* Platform icon stack */}
              <div className="flex items-center -space-x-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#833AB4] via-[#C13584] to-[#F77737] text-white ring-2 ring-[#0c0d0f] z-30">
                  <IgIcon className="w-4 h-4" />
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111] text-white border border-white/10 ring-2 ring-[#0c0d0f] z-20">
                  <TtIcon className="w-4 h-4" />
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF0000] text-white ring-2 ring-[#0c0d0f] z-10">
                  <YtIcon className="w-4 h-4" />
                </span>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white leading-none">
                  Connect Social Accounts
                </p>
                <p className="mt-1 text-[11px] text-white/35 leading-none">
                  Instagram · TikTok · YouTube
                </p>
              </div>

              {/* CTA chip */}
              <span className="shrink-0 flex items-center gap-1.5 rounded-lg border border-[#7A3BFF]/40 bg-[#7A3BFF]/15 px-3 py-1.5 text-[12px] font-semibold text-[#C084FC] group-hover:bg-[#7A3BFF]/25 transition">
                Connect
                <ChevronRight className="h-3 w-3" />
              </span>
            </button>
          </div>
        ))}

        {/* ── Scheduled tab ──────────────────────────────────────────── */}
        {tab === "scheduled" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white/40">
              Add a video to a day below to schedule it — nothing posts until you add one.
            </div>

            {/* Active / pending jobs (publishing right now, not scheduled for later) */}
            {activeJobs.filter(j => !j.scheduled_for).length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">In progress</p>
                {activeJobs.filter(j => !j.scheduled_for).map(job => (
                  <QueueSlot key={job.id} job={job} />
                ))}
              </div>
            )}

            {/* Day-by-day queue */}
            {upcomingDays.map((day) => {
              const dayJobs = activeJobs.filter(
                j => j.scheduled_for && dateKey(new Date(j.scheduled_for)) === dateKey(day)
              );
              return (
                <div key={day.toDateString()}>
                  <h3 className="mb-2 text-[15px] font-semibold text-white">
                    {dayLabel(day)}{" "}
                    <span className="text-white/40">| {dateSuffix(day)}</span>
                  </h3>
                  <div className="space-y-2">
                    {dayJobs.map(job => (
                      <QueueSlot key={job.id} job={job} />
                    ))}
                    <AddVideoButton onClick={() => openScheduleForDay(day)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Past Publications tab ───────────────────────────────────── */}
        {tab === "past" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
                {pastJobs.length} publication{pastJobs.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={fetchJobs}
                disabled={loadingJobs}
                className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/60 transition"
              >
                <RefreshCw className={`h-3 w-3 ${loadingJobs ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {loadingJobs ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 rounded-xl border border-white/[0.05] bg-white/[0.02] animate-pulse" />
                ))}
              </div>
            ) : pastJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.07] py-16 text-center">
                <Send className="mb-3 h-8 w-8 text-white/15" />
                <p className="text-sm font-semibold text-white/30">No published posts yet</p>
                <p className="mt-1 text-[12px] text-white/20">
                  Posts you publish will appear here
                </p>
                <button
                  onClick={openPostModal}
                  className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/[0.08] transition"
                >
                  Publish your first post
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {pastJobs.map(job => (
                  <PastCard
                    key={job.id}
                    job={job}
                    account={accounts.find(account => account.id === job.social_account_id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Connect accounts modal ──────────────────────────────────────── */}
      {connectModalOpen && (
        <ConnectAccountsModal
          connectedAccounts={accounts}
          onConnectInstagram={requestInstagramConnect}
          connectingIG={connectingIG}
          onDisconnect={disconnectAccount}
          onClose={() => setConnectModalOpen(false)}
          onShowToast={showToast}
        />
      )}

      {instagramConfirmOpen && (
        <InstagramRequirementModal
          loading={connectingIG}
          onCancel={cancelInstagramConnect}
          onContinue={connectInstagram}
        />
      )}

      {/* ── Post modal ─────────────────────────────────────────────────── */}
      {postModalOpen && (
        <PostModal
          igAccounts={accounts.filter(a => a.platform === "instagram")}
          ytAccounts={accounts.filter(a => a.platform === "youtube")}
          ttAccounts={accounts.filter(a => a.platform === "tiktok")}
          videos={videos}
          loadingVideos={loadingVideos}
          onConnectInstagram={requestInstagramConnect}
          onClose={() => { setPostModalOpen(false); setScheduleForDate(null); }}
          videoPostStatus={videoPostStatus}
          scheduledJobs={activeJobs.filter(j => j.scheduled_for)}
          initialScheduleDate={scheduleForDate}
          onPublished={() => {
            setPostModalOpen(false);
            setScheduleForDate(null);
            showToast("success", "Publishing…");
            fetchJobs();
          }}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
