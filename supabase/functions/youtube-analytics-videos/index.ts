// supabase/functions/youtube-analytics-videos/index.ts
// Returns the user's top YouTube videos with analytics metrics for the
// requested date range. Joins YouTube Analytics API (per-video metrics)
// with YouTube Data API (metadata: title, thumbnail, duration, publish date).
// Saves results to social_posts + social_post_metrics_snapshots.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { getYTAccount, getAccessToken, hasAnalyticsScope, adminClient } from "../shared/youtube-token.ts";

const YT_ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";
const YT_DATA      = "https://www.googleapis.com/youtube/v3";

function dateRangeDays(range: string): number {
  return range === "7d" ? 7 : range === "90d" ? 90 : range === "365d" ? 365 : 28;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
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

  const { account_id, date_range = "28d", limit = 20 } = body ?? {};
  if (!account_id) return err(req, "account_id required", 400);

  const { account, error: acctErr } = await getYTAccount(user.id, account_id);
  if (acctErr || !account) return err(req, acctErr ?? "Account not found", 404);

  if (!hasAnalyticsScope(account)) {
    return ok(req, { needs_reconnect: true, reason: "analytics_scope_missing" });
  }

  const { accessToken, error: tokenErr } = await getAccessToken(account);
  if (tokenErr || !accessToken) return err(req, tokenErr ?? "Token error", 401);

  const days      = dateRangeDays(date_range);
  const endDate   = daysAgo(1);
  const startDate = daysAgo(days);

  // ── 1. Top videos by views from Analytics API ─────────────────────────────
  const analyticsParams = new URLSearchParams({
    ids:       "channel==MINE",
    startDate,
    endDate,
    metrics:   "views,estimatedMinutesWatched,averageViewDuration,likes,comments,subscribersGained",
    dimensions: "video",
    sort:      "-views",
    maxResults: String(Math.min(limit, 50)),
  });

  const analyticsRes = await fetch(`${YT_ANALYTICS}?${analyticsParams}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!analyticsRes.ok) {
    const body = await analyticsRes.json().catch(() => ({}));
    console.error("[yt-videos] Analytics API:", analyticsRes.status, body?.error?.message);
    if (analyticsRes.status === 403) {
      const reason = body?.error?.errors?.[0]?.reason ?? "";
      if (reason === "forbidden" || reason === "insufficientPermissions") {
        return ok(req, { needs_reconnect: true, reason: "analytics_scope_missing" });
      }
      return err(req, "YouTube analytics is temporarily unavailable. Try again later.", 429);
    }
    return err(req, "YouTube analytics is temporarily unavailable. Try again later.", 503);
  }

  const analyticsData = await analyticsRes.json();
  const headers: string[] = (analyticsData.columnHeaders ?? []).map((h: any) => h.name);
  const rows: any[][]     = analyticsData.rows ?? [];

  if (rows.length === 0) {
    return ok(req, { date_range, videos: [] });
  }

  const vidIdx  = headers.indexOf("video");
  const vIdx    = headers.indexOf("views");
  const wtIdx   = headers.indexOf("estimatedMinutesWatched");
  const avdIdx  = headers.indexOf("averageViewDuration");
  const liIdx   = headers.indexOf("likes");
  const coIdx   = headers.indexOf("comments");
  const sgIdx   = headers.indexOf("subscribersGained");

  const videoIds   = rows.map((r) => String(r[vidIdx]));
  const metricsMap = new Map(rows.map((r) => [String(r[vidIdx]), r]));

  // ── 2. Video metadata from Data API ──────────────────────────────────────
  const metaRes = await fetch(
    `${YT_DATA}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&maxResults=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const metaData  = metaRes.ok ? await metaRes.json() : { items: [] };
  const metaItems = (metaData.items ?? []) as any[];
  const metaMap   = new Map(metaItems.map((v) => [v.id, v]));

  // ── 3. Join and build result ──────────────────────────────────────────────
  const videos = videoIds.map((videoId) => {
    const r    = metricsMap.get(videoId)!;
    const meta = metaMap.get(videoId);
    const sn   = meta?.snippet ?? {};
    const st   = meta?.statistics ?? {};

    return {
      video_id:            videoId,
      title:               sn.title ?? "Untitled",
      thumbnail_url:       sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null,
      youtube_url:         `https://www.youtube.com/watch?v=${videoId}`,
      published_at:        sn.publishedAt ?? null,
      duration_seconds:    parseDuration(meta?.contentDetails?.duration ?? ""),
      // Analytics metrics (for this date range)
      views:               Number(r[vIdx]  ?? 0),
      watch_time_minutes:  Number(r[wtIdx] ?? 0),
      avg_view_duration_seconds: Number(r[avdIdx] ?? 0),
      likes:               Number(r[liIdx] ?? 0),
      comments:            Number(r[coIdx] ?? 0),
      subscribers_gained:  Number(r[sgIdx] ?? 0),
      // Lifetime stats from Data API
      total_views:         Number(st.viewCount    ?? 0),
      total_likes:         Number(st.likeCount    ?? 0),
      total_comments:      Number(st.commentCount ?? 0),
    };
  });

  // ── 4. Persist to social_posts + metrics snapshots (best-effort) ──────────
  const sb  = adminClient();
  const now = new Date().toISOString();

  for (const v of videos) {
    const { data: postRow } = await sb
      .from("social_posts")
      .upsert({
        user_id:           user.id,
        social_account_id: account_id,
        platform:          "youtube",
        platform_post_id:  v.video_id,
        title:             v.title,
        thumbnail_url:     v.thumbnail_url,
        permalink:         v.youtube_url,
        duration_seconds:  v.duration_seconds,
        posted_at:         v.published_at,
        synced_at:         now,
      }, { onConflict: "social_account_id,platform_post_id" })
      .select("id")
      .maybeSingle();

    if (postRow?.id) {
      await sb.from("social_post_metrics_snapshots").insert({
        social_post_id:                postRow.id,
        user_id:                       user.id,
        platform:                      "youtube",
        views:                         v.views,
        likes:                         v.likes,
        comments:                      v.comments,
        watch_time_minutes:            v.watch_time_minutes,
        average_view_duration_seconds: v.avg_view_duration_seconds,
        subscribers_gained:            v.subscribers_gained,
        raw:                           { total_views: v.total_views, total_likes: v.total_likes },
        snapshotted_at:                now,
      });
    }
  }

  return ok(req, { date_range, start_date: startDate, end_date: endDate, videos });
});
