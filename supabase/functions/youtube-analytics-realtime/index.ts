// supabase/functions/youtube-analytics-realtime/index.ts
// Returns "recent activity" data for the YouTube channel.
// YouTube Analytics API has ~1-2 day data latency so we fetch
// the last 7 days from Analytics + current subscriber count from Data API.
// Labelled as "Recent (last 7 days)" in the UI.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { getYTAccount, getAccessToken, hasAnalyticsScope } from "../shared/youtube-token.ts";

const YT_ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";
const YT_DATA      = "https://www.googleapis.com/youtube/v3";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST")   return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (authError || !user) return err(req, "Unauthorized", 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const { account_id } = body ?? {};
  if (!account_id) return err(req, "account_id required", 400);

  const { account, error: acctErr } = await getYTAccount(user.id, account_id);
  if (acctErr || !account) return err(req, acctErr ?? "Account not found", 404);

  if (!hasAnalyticsScope(account)) {
    return ok(req, { needs_reconnect: true, reason: "analytics_scope_missing" });
  }

  const { accessToken, error: tokenErr } = await getAccessToken(account);
  if (tokenErr || !accessToken) return err(req, tokenErr ?? "Token error", 401);

  const endDate   = daysAgo(1);
  const startDate = daysAgo(7);

  // Fetch last 7 days daily breakdown + current channel stats in parallel
  const [analyticsRes, channelRes] = await Promise.all([
    fetch(
      `${YT_ANALYTICS}?ids=channel==MINE` +
      `&startDate=${startDate}&endDate=${endDate}` +
      `&metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost` +
      `&dimensions=day&sort=day`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
    fetch(`${YT_DATA}/channels?part=statistics&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  // Current subscriber count (real-time from Data API)
  let subscriberCount = 0;
  let totalViews      = 0;
  if (channelRes.ok) {
    const cd    = await channelRes.json();
    const stats = cd.items?.[0]?.statistics ?? {};
    subscriberCount = Number(stats.subscriberCount ?? 0);
    totalViews      = Number(stats.viewCount       ?? 0);
  }

  // Daily breakdown
  let daily: any[] = [];
  let recentViews  = 0;
  let recentSubs   = 0;
  let recentWatchTime = 0;

  if (analyticsRes.ok) {
    const data    = await analyticsRes.json();
    const headers = (data.columnHeaders ?? []).map((h: any) => h.name as string);
    const rows    = (data.rows ?? []) as any[][];

    const dayIdx = headers.indexOf("day");
    const vIdx   = headers.indexOf("views");
    const wtIdx  = headers.indexOf("estimatedMinutesWatched");
    const sgIdx  = headers.indexOf("subscribersGained");
    const slIdx  = headers.indexOf("subscribersLost");

    daily = rows.map((r) => ({
      date:               String(r[dayIdx]),
      views:              Number(r[vIdx]  ?? 0),
      watch_time_minutes: Number(r[wtIdx] ?? 0),
      subscribers_gained: Number(r[sgIdx] ?? 0),
      subscribers_lost:   Number(r[slIdx] ?? 0),
    }));

    recentViews     = daily.reduce((s, r) => s + r.views, 0);
    recentSubs      = daily.reduce((s, r) => s + r.subscribers_gained - r.subscribers_lost, 0);
    recentWatchTime = Math.round(daily.reduce((s, r) => s + r.watch_time_minutes, 0));
  } else {
    console.warn("[yt-realtime] Analytics API:", analyticsRes.status);
  }

  return ok(req, {
    note:            "Data reflects approximately the last 7 days. YouTube Analytics has a 1–2 day processing delay.",
    subscriber_count: subscriberCount,
    total_views:      totalViews,
    recent_7d: {
      views:              recentViews,
      watch_time_minutes: recentWatchTime,
      net_subscribers:    recentSubs,
    },
    daily,
  });
});
