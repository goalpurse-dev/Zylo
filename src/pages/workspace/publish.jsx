import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Send, CheckCircle2, XCircle, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import PostModal from "../../components/publish/PostModal";
import ConnectAccountsModal from "../../components/publish/ConnectAccountsModal";

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

function formatDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

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


/* ── Connected account pill ──────────────────────────────────────────────── */

function ConnectedAccount({ account, onDisconnect }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-disconnect`,
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
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045] shrink-0">
        <IgIcon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-none">Instagram</p>
        <p className="mt-0.5 text-[11px] text-white/40 truncate">
          @{account.username || account.platform_user_id}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
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

/* ── Queue slot ──────────────────────────────────────────────────────────── */

function QueueSlot({ time = "09:00 am", job = null, onAdd }) {
  if (job) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <span className="shrink-0 text-sm text-white/50 w-[72px]">{time}</span>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="h-10 w-[22px] shrink-0 rounded-md overflow-hidden bg-white/5">
            {job.video_url && (
              <video src={job.video_url} className="w-full h-full object-cover" muted preload="none" />
            )}
          </div>
          <p className="text-sm text-white/70 truncate flex-1">{job.caption || "No caption"}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
    );
  }

  return (
    <button
      onClick={onAdd}
      className="group flex items-center gap-3 rounded-xl border border-white/[0.05] bg-transparent px-4 py-3 w-full text-left hover:border-white/10 hover:bg-white/[0.02] transition"
    >
      <span className="shrink-0 text-sm text-white/30 w-[72px]">{time}</span>
      <span className="text-sm text-white/20 italic group-hover:text-white/35 transition">
        Press "Add to queue" to place your next video here
      </span>
    </button>
  );
}

/* ── Status badge ────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const map = {
    queued:             { label: "Queued",                  cls: "text-white/50  bg-white/5       border-white/10" },
    creating_container: { label: "Preparing Reel",          cls: "text-blue-400  bg-blue-500/10   border-blue-500/25" },
    processing:         { label: "Processing on Instagram", cls: "text-amber-400 bg-amber-500/10  border-amber-500/25" },
    publishing:         { label: "Publishing",              cls: "text-amber-400 bg-amber-500/10  border-amber-500/25" },
    published:          { label: "Published",               cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
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

function PastCard({ job }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="h-[72px] w-[40px] shrink-0 overflow-hidden rounded-lg bg-white/5">
        {job.video_url && (
          <video src={job.video_url} className="h-full w-full object-cover" muted preload="none" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-4 w-4 items-center justify-center rounded bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045]">
            <IgIcon className="w-2.5 h-2.5 text-white" />
          </div>
          <StatusBadge status={job.status} />
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
        <p className="text-sm text-white/70 line-clamp-2 leading-snug">{job.caption || "—"}</p>
        {job.error_message && (
          <p className="mt-1 text-[11px] text-red-400/80">{job.error_message}</p>
        )}
        <p className="mt-1.5 text-[11px] text-white/25">
          {job.published_at
            ? new Date(job.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
            : new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
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

export default function PublishPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [tab, setTab]                   = useState("scheduled");
  const [accounts, setAccounts]         = useState([]);
  const [pastJobs, setPastJobs]         = useState([]);
  const [activeJobs, setActiveJobs]     = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingJobs, setLoadingJobs]   = useState(false);
  const [postModalOpen, setPostModalOpen]       = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [toast, setToast]               = useState(null);
  const [connectingIG, setConnectingIG] = useState(false);

  // Pre-fetch videos on mount so PostModal opens instantly with content
  const [videos, setVideos]               = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const showToast = useCallback((type, message) => setToast({ type, message }), []);

  /* ── Handle OAuth callback params ──────────────────────────────────────── */
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const igConnect = p.get("ig_connect");
    if (igConnect === "success") {
      showToast("success", "Instagram connected successfully!");
      navigate("/workspace/publish", { replace: true });
      fetchAccounts();
    } else if (igConnect === "error") {
      const reason = p.get("reason") || "unknown";
      const msgs = {
        access_denied:         "Connection cancelled.",
        token_exchange_failed: "Could not complete connection. Please try again.",
        profile_fetch_failed:  "Could not read your Instagram profile. Please try again.",
        expired_state:         "Connection link expired. Please try again.",
        state_already_used:    "Connection link already used. Please try again.",
        internal_error:        "Something went wrong. Please try again.",
      };
      showToast("error", msgs[reason] || "Connection failed. Please try again.");
      navigate("/workspace/publish", { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Fetch connected accounts ──────────────────────────────────────────── */
  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase.rpc("get_my_social_accounts");
      if (!error) setAccounts((data || []).filter(a => a.platform === "instagram"));
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  /* ── Fetch publish jobs ────────────────────────────────────────────────── */
  const fetchJobs = useCallback(async ({ silent = false } = {}) => {
    if (!user) return;
    if (!silent) setLoadingJobs(true);
    try {
      const { data } = await supabase
        .from("instagram_publish_jobs")
        .select("id, status, caption, video_url, permalink, media_id, error_message, created_at, published_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const jobs = data || [];
      // terminal + historical: published, failed, canceled
      setPastJobs(jobs.filter(j => ["published", "failed", "canceled"].includes(j.status)));
      // still in flight
      setActiveJobs(jobs.filter(j => ["queued", "creating_container", "processing", "publishing"].includes(j.status)));
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
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth-start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        showToast("error", json.error || "Could not initiate connection. Please try again.");
        setConnectingIG(false);
      }
    } catch {
      showToast("error", "Network error. Please try again.");
      setConnectingIG(false);
    }
  }

  const upcomingDays = getUpcomingDays(7);
  const hasConnectedAccounts = accounts.length > 0;

  function openPostModal() {
    if (!hasConnectedAccounts) {
      setConnectModalOpen(true);
      return;
    }
    setPostModalOpen(true);
  }

  return (
    <div className="min-h-screen pb-28 lg:pb-12">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-5 lg:px-8 pt-6 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Your Posting Queue</h1>
            <p className="mt-0.5 text-sm text-white/40">Your content published while you sleep</p>
          </div>
          <button
            onClick={openPostModal}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#090A0A] hover:bg-white/90 active:scale-[.98] transition shadow-md"
          >
            <Plus className="h-4 w-4" />
            Publish New Content
          </button>
        </div>
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
                  ? "bg-white text-[#090A0A] shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t === "scheduled" ? "Scheduled" : "Past Publications"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 lg:px-8 space-y-6">

        {/* ── Connect banner / connected accounts ────────────────────── */}
        {loadingAccounts ? (
          <div className="h-14 rounded-2xl border border-white/[0.05] bg-white/[0.02] animate-pulse" />
        ) : hasConnectedAccounts ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Connected accounts</p>
            {accounts.map(acc => (
              <ConnectedAccount
                key={acc.id}
                account={acc}
                onDisconnect={(id) => setAccounts(prev => prev.filter(a => a.id !== id))}
              />
            ))}
            <button
              onClick={connectInstagram}
              disabled={connectingIG}
              className="flex items-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-transparent px-4 py-2.5 text-sm text-white/30 hover:border-white/15 hover:text-white/60 transition w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              {connectingIG ? "Redirecting…" : "Connect another account"}
            </button>
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
        )}

        {/* ── Scheduled tab ──────────────────────────────────────────── */}
        {tab === "scheduled" && (
          <div className="space-y-6">
            {/* Active / pending jobs at top */}
            {activeJobs.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">In progress</p>
                {activeJobs.map(job => (
                  <QueueSlot key={job.id} time="—" job={job} />
                ))}
              </div>
            )}

            {/* Day slots */}
            {upcomingDays.map((day) => (
              <div key={day.toDateString()}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-white">
                    {dayLabel(day)}{" "}
                    <span className="text-white/40">| {dateSuffix(day)}</span>
                  </h3>
                  <button className="rounded-lg border border-white/[0.06] bg-transparent px-3 py-1 text-xs text-white/35 hover:border-white/15 hover:text-white/60 transition">
                    Edit Queue
                  </button>
                </div>
                <QueueSlot time="09:00 am" onAdd={openPostModal} />
              </div>
            ))}
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
                  <PastCard key={job.id} job={job} />
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
          onConnectInstagram={connectInstagram}
          connectingIG={connectingIG}
          onClose={() => setConnectModalOpen(false)}
        />
      )}

      {/* ── Post modal ─────────────────────────────────────────────────── */}
      {postModalOpen && (
        <PostModal
          connectedAccounts={accounts}
          videos={videos}
          loadingVideos={loadingVideos}
          onConnectInstagram={connectInstagram}
          onClose={() => setPostModalOpen(false)}
          onPublished={() => {
            setPostModalOpen(false);
            showToast("success", "Publishing to Instagram…");
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
