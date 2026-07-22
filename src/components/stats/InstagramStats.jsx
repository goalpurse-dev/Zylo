import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Heart, MessageCircle, Users } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const INSIGHTS_SCOPE = "instagram_business_manage_insights";

function fmtNum(value) {
  if (value == null) return "—";
  const number = Number(value);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return number.toLocaleString();
}

function fmtDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function interactions(post) {
  return [post.likes, post.comments, post.shares, post.saves]
    .reduce((total, value) => total + Number(value ?? 0), 0);
}

function InstagramIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function MetricCard({ label, value, note, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/40">{label}</p>
        {createElement(Icon, { className: "h-4 w-4 text-fuchsia-300/60" })}
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{fmtNum(value)}</p>
      <p className="mt-1 text-[10px] text-white/25">{note}</p>
    </div>
  );
}

export default function InstagramStats({ account, dateRange, refreshKey, onReconnect, onStatus }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [postTab, setPostTab] = useState("top");
  const hasInsights = account?.scopes?.includes(INSIGHTS_SCOPE);

  const load = useCallback(async () => {
    if (!account?.id) return;
    setLoading(true);
    setError(null);
    onStatus?.({ loading: true });
    try {
      if (hasInsights) {
        await supabase.functions.invoke("instagram-media-sync", { body: { account_id: account.id } });
      }
      const { data: analytics, error: analyticsError } = await supabase.functions.invoke("get-analytics", {
        body: { platform: "instagram", account_id: account.id, limit: 100 },
      });
      if (analyticsError) throw new Error("analytics_unavailable");
      setData(analytics);
      const syncedAt = analytics?.posts?.reduce((latest, post) =>
        !latest || new Date(post.synced_at) > new Date(latest) ? post.synced_at : latest, null);
      onStatus?.({ loading: false, lastSynced: syncedAt });
    } catch {
      setError("Instagram stats couldn’t be refreshed right now. Please try again shortly.");
      onStatus?.({ loading: false });
    } finally {
      setLoading(false);
    }
  }, [account?.id, hasInsights, onStatus]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const days = Number.parseInt(dateRange, 10) || 28;
  const cutoff = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }, [days]);
  const posts = useMemo(() => (data?.posts ?? []).filter(post =>
    !post.posted_at || new Date(post.posted_at) >= cutoff
  ), [data?.posts, cutoff]);
  const totals = useMemo(() => ({
    views: posts.reduce((sum, post) => sum + Number(post.views ?? 0), 0),
    hasViews: posts.some(post => post.views != null),
    reach: posts.reduce((sum, post) => sum + Number(post.reach ?? 0), 0),
    hasReach: posts.some(post => post.reach != null),
    interactions: posts.reduce((sum, post) => sum + interactions(post), 0),
  }), [posts]);
  const sortedPosts = useMemo(() => [...posts].sort((a, b) => {
    if (postTab === "recent") return new Date(b.posted_at ?? 0) - new Date(a.posted_at ?? 0);
    return Number(b.views ?? b.reach ?? interactions(b)) - Number(a.views ?? a.reach ?? interactions(a));
  }), [posts, postTab]);
  const accountSummary = data?.summary?.account;

  return (
    <div className="space-y-5">
      {!hasInsights && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="font-semibold text-white">Reconnect Instagram to enable stats.</p>
              <p className="mt-1 text-sm text-white/55">Your publishing connection and existing post history will be preserved.</p>
              <button onClick={onReconnect} className="mt-3 rounded-lg bg-amber-500/15 px-4 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-500/25">
                Reconnect Instagram
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/25 to-orange-400/20">
          <InstagramIcon className="h-6 w-6 text-fuchsia-300" />
        </div>
        <div>
          <p className="font-bold text-white">{account?.display_name || account?.username || "Instagram"}</p>
          {account?.username && <p className="text-xs text-white/35">@{account.username}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Views" value={totals.hasViews ? totals.views : null} note={`Recent media · ${dateRange}`} icon={InstagramIcon} />
        <MetricCard label="Reach" value={totals.hasReach ? totals.reach : null} note={`Accounts reached · ${dateRange}`} icon={Users} />
        <MetricCard label="Interactions" value={posts.length ? totals.interactions : null} note="Likes, comments, saves and shares" icon={Heart} />
        <MetricCard label="Followers" value={accountSummary?.followers} note="Latest available account total" icon={Users} />
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-0.5">
            {[["top", "Top Posts"], ["recent", "Recent Posts"]].map(([id, label]) => (
              <button key={id} onClick={() => setPostTab(id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${postTab === id ? "bg-white/[0.08] text-white" : "text-white/35 hover:text-white/55"}`}>
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-white/25">{posts.length ? `${posts.length} posts · ${dateRange}` : ""}</span>
        </div>

        {loading && !data ? (
          <div className="space-y-3 p-4">{[1, 2, 3].map(id => <div key={id} className="h-16 animate-pulse rounded-xl bg-white/[0.05]" />)}</div>
        ) : sortedPosts.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
            <InstagramIcon className="mb-3 h-8 w-8 text-white/10" />
            <p className="text-sm font-semibold text-white/30">No Instagram posts for this period</p>
          </div>
        ) : (
          <>
            <div className="hidden border-b border-white/[0.05] px-4 py-2 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_36px] lg:gap-4">
              {["Post", "Views", "Reach", "Interactions", ""].map(label => <span key={label} className="text-[10px] font-semibold uppercase tracking-wider text-white/22">{label}</span>)}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {sortedPosts.map(post => (
                <a key={post.id} href={post.permalink || undefined} target={post.permalink ? "_blank" : undefined} rel="noreferrer" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 transition hover:bg-white/[0.02] lg:grid-cols-[2fr_1fr_1fr_1fr_36px] lg:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                      {post.thumbnail_url && <img src={post.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs font-semibold leading-snug text-white/80 lg:text-sm">{post.caption || `${post.media_type || "Instagram"} post`}</p>
                      <p className="mt-0.5 text-[10px] text-white/30">{fmtDate(post.posted_at)}</p>
                    </div>
                  </div>
                  <span className="hidden text-sm font-bold text-white/75 lg:block">{fmtNum(post.views)}</span>
                  <span className="hidden text-sm text-white/50 lg:block">{fmtNum(post.reach)}</span>
                  <span className="hidden text-sm text-white/50 lg:block">{fmtNum(interactions(post))}</span>
                  <div className="flex items-center gap-2 lg:hidden">
                    <span className="flex items-center gap-1 text-xs text-white/50"><Heart className="h-3 w-3" />{fmtNum(post.likes)}</span>
                    <span className="flex items-center gap-1 text-xs text-white/50"><MessageCircle className="h-3 w-3" />{fmtNum(post.comments)}</span>
                  </div>
                  {post.permalink && <ExternalLink className="hidden h-4 w-4 text-white/20 lg:block" />}
                </a>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="text-right text-[10px] text-white/20">Unavailable metrics are shown as — because Instagram support varies by media type.</p>
    </div>
  );
}
