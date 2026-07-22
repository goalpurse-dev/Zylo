// supabase/functions/youtube-analytics-video-detail/index.ts
// Per-video analytics: daily views time-series + lifetime stats for a single video.
// Called when the user clicks a video row on the Stats page.

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

function dateRangeDays(range: string): number {
  return range === "7d" ? 7 : range === "90d" ? 90 : range === "365d" ? 365 : 28;
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST")   return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (authError || !user) return err(req, "Unauthorized", 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const { account_id, video_id, date_range = "28d" } = body ?? {};
  if (!account_id) return err(req, "account_id required", 400);
  if (!video_id)   return err(req, "video_id required", 400);

  const { account, error: acctErr } = await getYTAccount(user.id, account_id);
  if (acctErr || !account) return err(req, acctErr ?? "Account not found", 404);

  if (!hasAnalyticsScope(account)) {
    return ok(req, { needs_reconnect: true });
  }

  const { accessToken, error: tokenErr } = await getAccessToken(account);
  if (tokenErr || !accessToken) return err(req, tokenErr ?? "Token error", 401);

  const days      = dateRangeDays(date_range);
  const endDate   = daysAgo(1);
  const startDate = daysAgo(days);

  const analyticsParams = new URLSearchParams({
    ids:        "channel==MINE",
    startDate,
    endDate,
    metrics:    "views,estimatedMinutesWatched,averageViewDuration,likes,comments,subscribersGained",
    dimensions: "day",
    sort:       "day",
    filters:    `video==${video_id}`,
  });

  const [analyticsRes, metaRes] = await Promise.all([
    fetch(`${YT_ANALYTICS}?${analyticsParams}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`${YT_DATA}/videos?part=snippet,statistics,contentDetails&id=${video_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const videoJson = metaRes.ok ? await metaRes.json() : { items: [] };
  const videoItem = videoJson.items?.[0];
  if (!videoItem) return err(req, "Video not found", 404);

  const sn = videoItem.snippet     ?? {};
  const st = videoItem.statistics  ?? {};

  const video = {
    video_id,
    title:            sn.title ?? "Untitled",
    thumbnail_url:    sn.thumbnails?.maxres?.url ?? sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? null,
    youtube_url:      `https://www.youtube.com/watch?v=${video_id}`,
    published_at:     sn.publishedAt ?? null,
    duration_seconds: parseDuration(videoItem.contentDetails?.duration ?? ""),
    total_views:      Number(st.viewCount    ?? 0),
    total_likes:      Number(st.likeCount    ?? 0),
    total_comments:   Number(st.commentCount ?? 0),
    is_short:         parseDuration(videoItem.contentDetails?.duration ?? "") <= 60,
  };

  let daily: any[] = [];
  let totals = {
    views: 0, watch_time_minutes: 0, avg_view_duration_seconds: 0,
    likes: 0, comments: 0, subscribers_gained: 0,
  };

  if (analyticsRes.ok) {
    const data    = await analyticsRes.json();
    const headers: string[] = (data.columnHeaders ?? []).map((h: any) => h.name);
    const rows: any[][]     = data.rows ?? [];

    const idx = (name: string) => headers.indexOf(name);

    daily = rows.map((r) => ({
      date:                      String(r[idx("day")]),
      views:                     Number(r[idx("views")]                   ?? 0),
      watch_time_minutes:        Number(r[idx("estimatedMinutesWatched")] ?? 0),
      avg_view_duration_seconds: Number(r[idx("averageViewDuration")]     ?? 0),
      likes:                     Number(r[idx("likes")]                   ?? 0),
      comments:                  Number(r[idx("comments")]                ?? 0),
      subscribers_gained:        Number(r[idx("subscribersGained")]       ?? 0),
    }));

    const totalViews = daily.reduce((s, r) => s + r.views, 0);
    totals = {
      views:                    totalViews,
      watch_time_minutes:       daily.reduce((s, r) => s + r.watch_time_minutes, 0),
      avg_view_duration_seconds: totalViews > 0
        ? daily.reduce((s, r) => s + r.avg_view_duration_seconds * r.views, 0) / totalViews
        : 0,
      likes:              daily.reduce((s, r) => s + r.likes,              0),
      comments:           daily.reduce((s, r) => s + r.comments,           0),
      subscribers_gained: daily.reduce((s, r) => s + r.subscribers_gained, 0),
    };
  }

  return ok(req, { video, date_range, start_date: startDate, end_date: endDate, totals, daily });
});
