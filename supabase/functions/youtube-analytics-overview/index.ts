// supabase/functions/youtube-analytics-overview/index.ts
// Returns channel-level analytics for the requested date range:
//   - overview cards (views, watch time, subscribers, total videos)
//   - daily time-series for the line chart
//   - comparison vs previous equal-length period
//   - current channel statistics
// Saves daily rows to youtube_channel_daily_analytics for caching.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { getYTAccount, getAccessToken, hasAnalyticsScope, adminClient } from "../shared/youtube-token.ts";

const YT_ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";
const YT_DATA      = "https://www.googleapis.com/youtube/v3";

/* ── Date helpers ─────────────────────────────────────────────────────────── */

function daysAgo(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function dateRangeDays(range: string): number {
  return range === "7d" ? 7 : range === "90d" ? 90 : range === "365d" ? 365 : 28;
}

/* ── Analytics API ────────────────────────────────────────────────────────── */

async function queryAnalytics(
  accessToken: string,
  startDate: string,
  endDate: string,
  metrics: string,
  dimensions = "day",
  extraParams: Record<string, string> = {},
): Promise<{ rows: any[][]; headers: string[]; error: string | null }> {
  const params = new URLSearchParams({
    ids:        "channel==MINE",
    startDate,
    endDate,
    metrics,
    dimensions,
    sort:       dimensions === "day" ? "day" : `-${metrics.split(",")[0]}`,
    ...extraParams,
  });

  const res = await fetch(`${YT_ANALYTICS}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg  = body?.error?.message ?? `status ${res.status}`;
    console.error("[yt-overview] Analytics API error:", res.status, msg);

    if (res.status === 403) {
      const reason = body?.error?.errors?.[0]?.reason ?? "";
      if (reason === "forbidden" || reason === "insufficientPermissions") {
        return { rows: [], headers: [], error: "analytics_scope_missing" };
      }
      return { rows: [], headers: [], error: "quota_exceeded" };
    }
    return { rows: [], headers: [], error: "analytics_unavailable" };
  }

  const data    = await res.json();
  const headers = (data.columnHeaders ?? []).map((h: any) => h.name as string);
  const rows    = data.rows ?? [];
  return { rows, headers, error: null };
}

/* ── HANDLER ──────────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST")   return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (authError || !user) return err(req, "Unauthorized", 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const { account_id, date_range = "28d" } = body ?? {};
  if (!account_id) return err(req, "account_id required", 400);

  const { account, error: acctErr } = await getYTAccount(user.id, account_id);
  if (acctErr || !account) return err(req, acctErr ?? "Account not found", 404);

  if (!hasAnalyticsScope(account)) {
    return ok(req, { needs_reconnect: true, reason: "analytics_scope_missing" });
  }

  const { accessToken, error: tokenErr } = await getAccessToken(account);
  if (tokenErr || !accessToken) return err(req, tokenErr ?? "Token error", 401);

  const days      = dateRangeDays(date_range);
  const endDate   = daysAgo(1);   // yesterday (Analytics has ~1-2 day lag)
  const startDate = daysAgo(days);
  const prevEnd   = daysAgo(days + 1);
  const prevStart = daysAgo(days * 2);

  const METRICS = "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";

  // Fetch current period + previous period in parallel
  const [current, previous, channelRes] = await Promise.all([
    queryAnalytics(accessToken, startDate, endDate, METRICS),
    queryAnalytics(accessToken, prevStart, prevEnd, METRICS),
    fetch(`${YT_DATA}/channels?part=statistics,snippet&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  if (current.error === "analytics_scope_missing") {
    return ok(req, { needs_reconnect: true, reason: "analytics_scope_missing" });
  }
  if (current.error === "quota_exceeded") {
    return err(req, "YouTube analytics is temporarily unavailable. Try again later.", 429);
  }
  if (current.error) {
    return err(req, "YouTube analytics is temporarily unavailable. Try again later.", 503);
  }

  // Parse channel statistics
  let channelStats: any = {};
  let channelSnippet: any = {};
  if (channelRes.ok) {
    const cd = await channelRes.json();
    channelStats   = cd.items?.[0]?.statistics  ?? {};
    channelSnippet = cd.items?.[0]?.snippet     ?? {};
  }

  // Build daily rows
  const hi = current.headers;
  const dayIdx  = hi.indexOf("day");
  const viewIdx = hi.indexOf("views");
  const wtIdx   = hi.indexOf("estimatedMinutesWatched");
  const avdIdx  = hi.indexOf("averageViewDuration");
  const sgIdx   = hi.indexOf("subscribersGained");
  const slIdx   = hi.indexOf("subscribersLost");

  const dailyRows = current.rows.map((r) => ({
    date:              String(r[dayIdx]),
    views:             Number(r[viewIdx] ?? 0),
    watch_time_minutes: Number(r[wtIdx]  ?? 0),
    average_view_duration_seconds: Number(r[avdIdx] ?? 0),
    subscribers_gained: Number(r[sgIdx]  ?? 0),
    subscribers_lost:   Number(r[slIdx]  ?? 0),
  }));

  // Aggregate totals
  const sumRow = (rows: any[][]): number[] => {
    if (!rows.length) return [0, 0, 0, 0, 0];
    return [viewIdx, wtIdx, avdIdx, sgIdx, slIdx].map((i) =>
      rows.reduce((s, r) => s + Number(r[i] ?? 0), 0)
    );
  };

  const [views, watchTime, , subGained, subLost] = sumRow(current.rows);
  const [pViews, pWatchTime, , pSubGained]         = sumRow(previous.rows);

  // Avg view duration for period (mean of daily avgs weighted by views)
  const totalViews = dailyRows.reduce((s, r) => s + r.views, 0);
  const avgViewDuration = totalViews > 0
    ? dailyRows.reduce((s, r) => s + r.average_view_duration_seconds * r.views, 0) / totalViews
    : 0;

  function pct(a: number, b: number): number | null {
    if (b === 0) return null;
    return Math.round(((a - b) / b) * 100);
  }

  // Save daily rows to DB (upsert, best-effort)
  if (dailyRows.length > 0) {
    const sb = adminClient();
    const upsertRows = dailyRows.map((r) => ({
      user_id:           user.id,
      social_account_id: account_id,
      date:              r.date,
      views:             r.views,
      watch_time_minutes: r.watch_time_minutes,
      average_view_duration_seconds: r.average_view_duration_seconds,
      subscribers_gained: r.subscribers_gained,
      subscribers_lost:   r.subscribers_lost,
      updated_at:        new Date().toISOString(),
    }));
    sb.from("youtube_channel_daily_analytics")
      .upsert(upsertRows, { onConflict: "social_account_id,date" })
      .then(({ error }) => {
        if (error) console.error("[yt-overview] Daily upsert error:", error.message);
      });
  }

  return ok(req, {
    date_range,
    start_date: startDate,
    end_date:   endDate,
    channel: {
      id:           account.platform_user_id,
      name:         account.display_name ?? channelSnippet.title,
      avatar_url:   account.avatar_url   ?? channelSnippet.thumbnails?.default?.url ?? null,
      subscribers:  Number(channelStats.subscriberCount ?? 0),
      total_views:  Number(channelStats.viewCount       ?? 0),
      video_count:  Number(channelStats.videoCount      ?? 0),
    },
    overview: {
      views,
      watch_time_minutes: Math.round(watchTime),
      watch_time_hours:   Math.round(watchTime / 60),
      subscribers_gained: subGained,
      subscribers_lost:   subLost,
      net_subscribers:    subGained - subLost,
      avg_view_duration_seconds: Math.round(avgViewDuration),
      vs_prev: {
        views:              pct(views,     pViews),
        watch_time_minutes: pct(watchTime, pWatchTime),
        subscribers_gained: pct(subGained, pSubGained),
      },
    },
    daily: dailyRows,
  });
});
