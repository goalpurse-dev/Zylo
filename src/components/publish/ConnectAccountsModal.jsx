import { createPortal } from "react-dom";
import { X, CheckCircle2, ArrowRight, Loader2, UserPlus, LogOut } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

/* ── Platform SVG icons ──────────────────────────────────────────────────── */

function IgIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

function TtIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.79a8.18 8.18 0 004.78 1.52V6.85a4.85 4.85 0 01-1.01-.16z"/>
    </svg>
  );
}

function YtIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
  );
}

/* ── Platform config ─────────────────────────────────────────────────────── */

const PLATFORMS = [
  {
    id:       "instagram",
    label:    "Instagram",
    Icon:     IgIcon,
    note:     "Business or Creator account required",
    gradient: "from-[#833AB4] via-[#C13584] to-[#F77737]",
    btnBg:    "bg-gradient-to-r from-[#833AB4] via-[#C13584] to-[#F77737]",
    glow:     "",
  },
  {
    id:       "tiktok",
    label:    "TikTok",
    Icon:     TtIcon,
    note:     "Post videos or send to your drafts",
    gradient: "from-[#010101] to-[#2d2d2d]",
    btnBg:    "bg-[#111111]",
    glow:     "shadow-[0_4px_24px_rgba(0,0,0,0.4)]",
  },
  {
    id:       "youtube",
    label:    "YouTube",
    Icon:     YtIcon,
    note:     "Upload videos to your channel",
    gradient: "from-[#FF0000] to-[#CC0000]",
    btnBg:    "bg-[#FF0000] hover:bg-[#DD0000]",
    glow:     "",
  },
];

/* ── Main modal ──────────────────────────────────────────────────────────── */

export default function ConnectAccountsModal({
  connectedAccounts = [],   // [{id, platform, username, ...}]
  onConnectInstagram,       // opens the Instagram requirement confirmation
  connectingIG = false,     // bool — shows spinner on IG button
  onDisconnect,             // (accountId) => void
  onClose,
  onShowToast,              // (type, message) => void — optional
}) {
  const [disconnecting,    setDisconnecting]    = useState(null);
  const [ytConfirmOpen,    setYtConfirmOpen]    = useState(false);
  const [connectingYT,     setConnectingYT]     = useState(false);
  const [ttConfirmOpen,    setTtConfirmOpen]    = useState(false);
  const [connectingTT,     setConnectingTT]     = useState(false);

  async function handleDisconnect(account) {
    if (!onDisconnect) return;
    setDisconnecting(account.id);
    await onDisconnect(account.id);
    setDisconnecting(null);
  }

  async function connectYouTube() {
    setConnectingYT(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        onShowToast?.("error", "Please sign in before connecting YouTube.");
        setConnectingYT(false);
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-oauth-start`,
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${session.access_token}`,
            apikey:         import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        },
      );
      const json = await res.json().catch(() => ({}));
      const authorizationUrl = json.authorizationUrl || json.url;
      if (authorizationUrl) {
        window.location.assign(authorizationUrl);
      } else {
        onShowToast?.("error", json.error || "Could not connect YouTube. Please try again.");
        setConnectingYT(false);
        setYtConfirmOpen(false);
      }
    } catch {
      onShowToast?.("error", "Network error. Please try again.");
      setConnectingYT(false);
    }
  }
  async function connectTikTok() {
    setConnectingTT(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        onShowToast?.("error", "Please sign in before connecting TikTok.");
        setConnectingTT(false);
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiktok-oauth-start`,
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${session.access_token}`,
            apikey:         import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        },
      );
      const json = await res.json().catch(() => ({}));
      const authorizationUrl = json.authorizationUrl || json.url;
      if (authorizationUrl) {
        window.location.assign(authorizationUrl);
      } else {
        onShowToast?.("error", json.error || "Could not connect TikTok. Please try again.");
        setConnectingTT(false);
        setTtConfirmOpen(false);
      }
    } catch {
      onShowToast?.("error", "Network error. Please try again.");
      setConnectingTT(false);
    }
  }

  /* ── TikTok confirm sub-modal ───────────────────────────────────────── */
  if (ttConfirmOpen) {
    return createPortal(
      <div className="fixed inset-0 z-[9200] flex items-center justify-center px-4" onClick={() => { if (!connectingTT) setTtConfirmOpen(false); }}>
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-[380px] rounded-2xl border border-white/[0.08] bg-[#0e1012] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="px-6 pt-5 pb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111111] text-white mb-4">
              <TtIcon size={20} />
            </div>
            <h2 className="text-[17px] font-bold text-white leading-tight mb-2">Connect TikTok</h2>
            <p className="text-[13px] text-white/50 leading-relaxed mb-6">
              Zyvo will ask permission to send videos to your TikTok account when you choose to publish. You stay in control of the caption, visibility, and posting options.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setTtConfirmOpen(false)}
                disabled={connectingTT}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-white/50 hover:bg-white/[0.07] hover:text-white/80 transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={connectTikTok}
                disabled={connectingTT}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#111111] hover:bg-[#1a1a1a] py-2.5 text-sm font-bold text-white transition disabled:opacity-70 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
              >
                {connectingTT ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {connectingTT ? "Redirecting…" : "Continue to TikTok"}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  /* ── YouTube confirm sub-modal ─────────────────────────────────────── */
  if (ytConfirmOpen) {
    return createPortal(
      <div className="fixed inset-0 z-[9200] flex items-center justify-center px-4" onClick={() => { if (!connectingYT) setYtConfirmOpen(false); }}>
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-[380px] rounded-2xl border border-white/[0.08] bg-[#0e1012] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#FF0000]/50 to-transparent" />
          <div className="px-6 pt-5 pb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF0000] to-[#CC0000] text-white mb-4">
              <YtIcon size={20} />
            </div>
            <h2 className="text-[17px] font-bold text-white leading-tight mb-2">Connect YouTube</h2>
            <p className="text-[13px] text-white/50 leading-relaxed mb-6">
              Zyvo will ask permission to upload videos to your YouTube channel when you choose to publish. We only use this to show your connected channel and upload videos you explicitly publish from Zyvo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setYtConfirmOpen(false)}
                disabled={connectingYT}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-white/50 hover:bg-white/[0.07] hover:text-white/80 transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={connectYouTube}
                disabled={connectingYT}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF0000] hover:bg-[#DD0000] py-2.5 text-sm font-bold text-white transition disabled:opacity-70 shadow-[0_4px_24px_rgba(255,0,0,0.30)]"
              >
                {connectingYT ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {connectingYT ? "Redirecting…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9100] flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#0e1012] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top gradient line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#7A3BFF]/60 to-transparent" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-[17px] font-bold text-white leading-tight">Connect Social Accounts</h2>
            <p className="mt-1 text-[13px] text-white/40 leading-snug">
              Link your accounts to publish directly from Zyvo
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Platform cards */}
        <div className="px-4 pb-5 space-y-3">
          {PLATFORMS.map((p) => {
            const connected    = connectedAccounts.some(a => a.platform === p.id);
            const isIG         = p.id === "instagram";
            const isYT         = p.id === "youtube";
            const isTT         = p.id === "tiktok";
            const loading      = (isIG && connectingIG) || (isYT && connectingYT) || (isTT && connectingTT);
            const onConnect    = isYT ? () => setYtConfirmOpen(true)
                                : isTT ? () => setTtConfirmOpen(true)
                                : onConnectInstagram;

            return (
              <div
                key={p.id}
                className={`relative overflow-hidden rounded-xl border transition ${
                  p.disabled && !connected
                    ? "border-white/[0.05] bg-white/[0.02] opacity-50"
                    : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Icon bubble */}
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${p.gradient} text-white`}>
                    <p.Icon size={20} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-none">{p.label}</p>
                    {connected ? (
                      <p className="mt-1 text-[11px] text-emerald-300 leading-none font-medium">
                        {isYT
                          ? (connectedAccounts.find(a => a.platform === p.id)?.display_name
                             || connectedAccounts.find(a => a.platform === p.id)?.username
                             || "Connected")
                          : `@${connectedAccounts.find(a => a.platform === p.id)?.username || "connected"}`}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-white/35 leading-none">{p.note}</p>
                    )}
                  </div>

                  {/* Action */}
                  {connected ? (
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                      <span className="text-[11px] font-bold text-emerald-300">Connected</span>
                    </div>
                  ) : p.disabled ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/30 font-medium">
                      Soon
                    </span>
                  ) : (
                    <button
                      onClick={onConnect}
                      disabled={loading}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition active:scale-[.97] disabled:opacity-70 ${p.btnBg} ${p.glow}`}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      {loading ? "Redirecting..." : `Add ${p.label}`}
                    </button>
                  )}
                </div>

                {/* Connected actions row */}
                {connected && (
                  <div className="flex gap-2 border-t border-white/[0.06] px-4 pb-3 pt-2.5">
                    <button
                      onClick={onConnect}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[12px] font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white active:scale-[.97]"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Add another account
                    </button>
                    <button
                      onClick={() => handleDisconnect(connectedAccounts.find(a => a.platform === p.id))}
                      disabled={disconnecting === connectedAccounts.find(a => a.platform === p.id)?.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/[0.06] py-2 text-[12px] font-semibold text-red-400 transition hover:bg-red-500/[0.12] hover:text-red-300 active:scale-[.97] disabled:opacity-50"
                    >
                      {disconnecting === connectedAccounts.find(a => a.platform === p.id)?.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5" />
                      )}
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="border-t border-white/[0.05] px-6 py-3.5">
          <p className="text-[11px] text-white/25 text-center leading-relaxed">
            We only request publish permissions. We never read your DMs or followers.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
