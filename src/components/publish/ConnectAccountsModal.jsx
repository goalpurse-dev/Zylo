import { createPortal } from "react-dom";
import { X, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

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
    glow:     "shadow-[0_4px_24px_rgba(193,53,132,0.35)]",
  },
  {
    id:       "tiktok",
    label:    "TikTok",
    Icon:     TtIcon,
    note:     "Coming soon",
    gradient: "from-[#010101] to-[#2d2d2d]",
    btnBg:    "bg-[#111111]",
    glow:     "shadow-[0_4px_24px_rgba(0,0,0,0.4)]",
    disabled: true,
  },
  {
    id:       "youtube",
    label:    "YouTube",
    Icon:     YtIcon,
    note:     "Coming soon",
    gradient: "from-[#FF0000] to-[#CC0000]",
    btnBg:    "bg-[#FF0000]",
    glow:     "shadow-[0_4px_24px_rgba(255,0,0,0.30)]",
    disabled: true,
  },
];

/* ── Main modal ──────────────────────────────────────────────────────────── */

export default function ConnectAccountsModal({
  connectedAccounts = [],   // [{id, platform, username, ...}]
  onConnectInstagram,       // () => void — starts IG OAuth
  connectingIG = false,     // bool — shows spinner on IG button
  onClose,
}) {
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
            const connected = connectedAccounts.some(a => a.platform === p.id);
            const isIG      = p.id === "instagram";
            const loading   = isIG && connectingIG;

            return (
              <div
                key={p.id}
                className={`relative overflow-hidden rounded-xl border transition ${
                  p.disabled && !connected
                    ? "border-white/[0.05] bg-white/[0.02] opacity-50"
                    : connected
                    ? "border-emerald-500/25 bg-emerald-500/[0.06]"
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
                      <p className="mt-1 text-[11px] text-emerald-400 leading-none">
                        @{connectedAccounts.find(a => a.platform === p.id)?.username || "connected"}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-white/35 leading-none">{p.note}</p>
                    )}
                  </div>

                  {/* Action */}
                  {connected ? (
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-[11px] font-semibold text-emerald-400">Connected</span>
                    </div>
                  ) : p.disabled ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/30 font-medium">
                      Soon
                    </span>
                  ) : (
                    <button
                      onClick={onConnectInstagram}
                      disabled={loading}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition active:scale-[.97] disabled:opacity-70 ${p.btnBg} ${p.glow}`}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      {loading ? "Redirecting…" : `Add ${p.label}`}
                    </button>
                  )}
                </div>
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
