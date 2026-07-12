import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Instagram, Music2, Youtube, UserPlus, LogOut, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const PLATFORM_CONFIG = [
  {
    id:       "instagram",
    label:    "Instagram",
    Icon:     Instagram,
    gradient: "from-[#833AB4] via-[#C13584] to-[#F77737]",
    disabled: false,
  },
  {
    id:       "youtube",
    label:    "YouTube",
    Icon:     Youtube,
    gradient: "from-[#FF0000] to-[#991B1B]",
    disabled: false,
  },
  {
    id:       "tiktok",
    label:    "TikTok",
    Icon:     Music2,
    gradient: "from-[#111111] via-[#1f2937] to-[#06B6D4]",
    disabled: false,
  },
];

/* ── Confirm disconnect popup ────────────────────────────────────────────── */
function DisconnectConfirmModal({ account, onCancel, onConfirm, loading }) {
  const label = account?.display_name || account?.username || account?.platform_user_id || "this account";
  return (
    <div className="fixed inset-0 z-[9300] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e1012] shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <h2 className="text-[16px] font-bold leading-tight text-white">Disconnect account?</h2>
          </div>
          <p className="text-sm leading-relaxed text-white/50">
            Are you sure you want to disconnect{" "}
            <span className="font-semibold text-white">{label}</span> from Zyvo?
            You can reconnect at any time.
          </p>
          <div className="mt-5 flex gap-2.5">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/90 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Instagram requirement modal ─────────────────────────────────────────── */
function InstagramRequirementModal({ loading, onCancel, onContinue }) {
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
            >
              ×
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            To publish directly from Zyvo, Instagram requires your account to be set as a Creator or Business account. Switching is free and takes about 30 seconds.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button onClick={onCancel} disabled={loading} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50">
              Cancel
            </button>
            <button onClick={onContinue} disabled={loading} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#090A0A] transition hover:bg-white/90 disabled:opacity-70">
              {loading ? "Redirecting..." : "Continue to Instagram"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── YouTube confirm modal ───────────────────────────────────────────────── */
function YouTubeConfirmModal({ loading, onCancel, onContinue }) {
  return (
    <div className="fixed inset-0 z-[9200] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e1012] shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#FF0000]/50 to-transparent" />
        <div className="p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF0000] to-[#CC0000] text-white mb-4">
            <Youtube className="h-5 w-5" />
          </div>
          <h2 className="text-[17px] font-bold text-white leading-tight mb-2">Connect YouTube</h2>
          <p className="text-[13px] text-white/50 leading-relaxed mb-6">
            Zyvo will ask permission to upload videos to your YouTube channel. We only use this to show your connected channel and upload videos you explicitly publish from Zyvo.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-white/50 hover:bg-white/[0.07] hover:text-white/80 transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF0000] hover:bg-[#DD0000] py-2.5 text-sm font-bold text-white transition disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? "Redirecting…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── TikTok confirm modal ────────────────────────────────────────────────── */
function TikTokConfirmModal({ loading, onCancel, onContinue }) {
  return (
    <div className="fixed inset-0 z-[9200] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e1012] shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111111] text-white mb-4">
            <Music2 className="h-5 w-5" />
          </div>
          <h2 className="text-[17px] font-bold text-white leading-tight mb-2">Connect TikTok</h2>
          <p className="text-[13px] text-white/50 leading-relaxed mb-6">
            Zyvo will ask permission to send videos to your TikTok account when you choose to publish. You stay in control of the caption, visibility, and posting options.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-white/50 hover:bg-white/[0.07] hover:text-white/80 transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#111111] hover:bg-[#1a1a1a] py-2.5 text-sm font-bold text-white transition disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? "Redirecting…" : "Continue to TikTok"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Single connected account row ────────────────────────────────────────── */
function AccountRow({ account, platform, onDisconnect }) {
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const Icon     = platform.Icon;
  const isYT     = platform.id === "youtube";
  const display  = isYT
    ? (account.display_name || account.username || account.platform_user_id || "Connected")
    : `@${account.username || account.platform_user_id || "connected"}`;

  async function handleConfirmDisconnect() {
    setDisconnecting(true);
    await onDisconnect(account.id, platform.id);
    setDisconnecting(false);
    setConfirmOpen(false);
  }

  return (
    <>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${platform.gradient} text-white`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
            {display}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.2)]">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </span>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/[0.06] py-1.5 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/[0.14] hover:text-red-300 active:scale-95"
        >
          <LogOut className="h-3 w-3" />
          Disconnect
        </button>
      </div>

      {confirmOpen && (
        <DisconnectConfirmModal
          account={account}
          loading={disconnecting}
          onCancel={() => !disconnecting && setConfirmOpen(false)}
          onConfirm={handleConfirmDisconnect}
        />
      )}
    </>
  );
}

/* ── Platform card ───────────────────────────────────────────────────────── */
function PlatformCard({ platform, accounts, loading, onConnect, connectingIG, connectingYT, connectingTT, onDisconnect }) {
  const Icon        = platform.Icon;
  const isIG        = platform.id === "instagram";
  const isYT        = platform.id === "youtube";
  const isTT        = platform.id === "tiktok";
  const connecting  = (isIG && connectingIG) || (isYT && connectingYT) || (isTT && connectingTT);
  const hasAccounts = accounts.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
      <div className="flex items-center gap-4 p-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${platform.gradient} text-white`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{platform.label}</p>
          <p className="mt-0.5 text-xs text-white/35">
            {hasAccounts ? `${accounts.length} account${accounts.length > 1 ? "s" : ""} connected` : "Not connected"}
          </p>
        </div>

        {!hasAccounts && (
          platform.disabled ? (
            <button disabled className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white/30">
              <Circle className="h-3.5 w-3.5" />
              Coming soon
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={loading || connecting}
              className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#090A0A] transition hover:bg-white/90 disabled:opacity-60"
            >
              {connecting ? "Redirecting…" : "Connect"}
            </button>
          )
        )}
      </div>

      {hasAccounts && (
        <div className="border-t border-white/[0.06] px-4 pb-3 pt-2 space-y-2">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              platform={platform}
              onDisconnect={onDisconnect}
            />
          ))}

          {!platform.disabled && (
            <button
              onClick={onConnect}
              disabled={connecting}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[12px] font-semibold text-white/55 transition hover:bg-white/[0.08] hover:text-white active:scale-[.97] disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add another account
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function ConnectionsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [accounts,         setAccounts]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [igConfirmOpen,    setIgConfirmOpen]    = useState(false);
  const [ytConfirmOpen,    setYtConfirmOpen]    = useState(false);
  const [ttConfirmOpen,    setTtConfirmOpen]    = useState(false);
  const [connectingIG,     setConnectingIG]     = useState(false);
  const [connectingYT,     setConnectingYT]     = useState(false);
  const [connectingTT,     setConnectingTT]     = useState(false);
  const [errorMessage,     setErrorMessage]     = useState("");

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_my_social_accounts");
      if (!error) setAccounts(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // Handle OAuth callbacks
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const igConnect = params.get("ig_connect");
    if (igConnect) {
      if (igConnect === "success") {
        fetchAccounts();
      } else if (igConnect === "error") {
        const reason = params.get("reason");
        setErrorMessage(
          reason === "professional_account_required"
            ? "Instagram needs your account to be switched to Creator or Business before Zyvo can publish directly."
            : "Instagram connection failed. Please try again."
        );
      }
      navigate("/workspace/connections", { replace: true });
      return;
    }

    const ytConnect = params.get("yt_connect");
    if (ytConnect) {
      if (ytConnect === "success") {
        fetchAccounts();
      } else if (ytConnect === "error") {
        const reason = params.get("reason");
        const msgs = {
          access_denied:        "YouTube connection cancelled.",
          token_exchange_failed:"Could not complete YouTube connection. Please try again.",
          profile_fetch_failed: "Could not read your YouTube channel. Please try again.",
          no_channel_found:     "No YouTube channel found on this Google account. Please create one first.",
          expired_state:        "Connection link expired. Please try again.",
          internal_error:       "Something went wrong. Please try again.",
        };
        setErrorMessage(msgs[reason] || "YouTube connection failed. Please try again.");
      }
      navigate("/workspace/connections", { replace: true });
      return;
    }

    const ttConnect = params.get("tt_connect");
    if (ttConnect) {
      if (ttConnect === "success") {
        fetchAccounts();
      } else if (ttConnect === "error") {
        const reason = params.get("reason");
        const msgs = {
          access_denied:         "TikTok connection cancelled.",
          token_exchange_failed: "Could not complete TikTok connection. Please try again.",
          profile_fetch_failed:  "Could not read your TikTok profile. Please try again.",
          expired_state:         "Connection link expired. Please try again.",
          state_already_used:    "Connection link already used. Please try again.",
          oauth_not_configured:  "TikTok connection is not configured yet.",
          internal_error:        "Something went wrong. Please try again.",
        };
        setErrorMessage(msgs[reason] || "TikTok connection failed. Please try again.");
      }
      navigate("/workspace/connections", { replace: true });
    }
  }, [fetchAccounts, location.search, navigate]);

  const accountsByPlatform = useMemo(() => {
    return accounts.reduce((map, account) => {
      if (!map[account.platform]) map[account.platform] = [];
      map[account.platform].push(account);
      return map;
    }, {});
  }, [accounts]);

  async function disconnectAccount(accountId, platformId) {
    setErrorMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fnName = platformId === "youtube" ? "youtube-disconnect"
                   : platformId === "tiktok"  ? "tiktok-disconnect"
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
          body: JSON.stringify({ account_id: accountId }),
        }
      );
      if (res.ok) setAccounts(prev => prev.filter(a => a.id !== accountId));
      else setErrorMessage("Failed to disconnect. Please try again.");
    } catch {
      setErrorMessage("Failed to disconnect. Please try again.");
    }
  }

  async function connectInstagram() {
    setConnectingIG(true);
    setErrorMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErrorMessage("Please sign in first.");
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
          body: JSON.stringify({ returnTo: "/workspace/connections" }),
        }
      );
      const json = await res.json().catch(() => ({}));
      const url  = json.authorizationUrl || json.url;
      if (url) {
        window.location.assign(url);
      } else {
        setErrorMessage(json.error || "Could not initiate connection. Please try again.");
        setConnectingIG(false);
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setConnectingIG(false);
    }
  }

  async function connectYouTube() {
    setConnectingYT(true);
    setErrorMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErrorMessage("Please sign in first.");
        setConnectingYT(false);
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-oauth-start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      const json = await res.json().catch(() => ({}));
      const url  = json.authorizationUrl || json.url;
      if (url) {
        window.location.assign(url);
      } else {
        setErrorMessage(json.error || "Could not connect YouTube. Please try again.");
        setConnectingYT(false);
        setYtConfirmOpen(false);
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setConnectingYT(false);
    }
  }

  async function connectTikTok() {
    setConnectingTT(true);
    setErrorMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErrorMessage("Please sign in first.");
        setConnectingTT(false);
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiktok-oauth-start`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ returnTo: "/workspace/connections" }),
        }
      );
      const json = await res.json().catch(() => ({}));
      const url  = json.authorizationUrl || json.url;
      if (url) {
        window.location.assign(url);
      } else {
        setErrorMessage(json.error || "Could not connect TikTok. Please try again.");
        setConnectingTT(false);
        setTtConfirmOpen(false);
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setConnectingTT(false);
    }
  }

  function onConnectPlatform(platformId) {
    setErrorMessage("");
    if (platformId === "instagram") setIgConfirmOpen(true);
    else if (platformId === "youtube") setYtConfirmOpen(true);
    else if (platformId === "tiktok") setTtConfirmOpen(true);
  }

  return (
    <div className="min-h-screen px-5 pb-28 pt-6 lg:px-8 lg:pb-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-white">Connections</h1>
            <p className="mt-1 text-sm text-white/35">Connected publishing accounts</p>
          </div>
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Refresh"}
          </button>
        </div>

        <div className="grid gap-3">
          {PLATFORM_CONFIG.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              accounts={accountsByPlatform[platform.id] || []}
              loading={loading}
              connectingIG={connectingIG}
              connectingYT={connectingYT}
              connectingTT={connectingTT}
              onConnect={() => onConnectPlatform(platform.id)}
              onDisconnect={disconnectAccount}
            />
          ))}
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            {errorMessage}
          </div>
        )}
      </div>

      {igConfirmOpen && (
        <InstagramRequirementModal
          loading={connectingIG}
          onCancel={() => { if (!connectingIG) setIgConfirmOpen(false); }}
          onContinue={connectInstagram}
        />
      )}

      {ytConfirmOpen && (
        <YouTubeConfirmModal
          loading={connectingYT}
          onCancel={() => { if (!connectingYT) setYtConfirmOpen(false); }}
          onContinue={connectYouTube}
        />
      )}

      {ttConfirmOpen && (
        <TikTokConfirmModal
          loading={connectingTT}
          onCancel={() => { if (!connectingTT) setTtConfirmOpen(false); }}
          onContinue={connectTikTok}
        />
      )}
    </div>
  );
}
