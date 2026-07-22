// supabase/functions/youtube-analytics-sync/index.ts
// Orchestrates a full analytics refresh for a YouTube account.
// Guards against hammering the API with a 5-minute cooldown per account.
// Calls overview + videos functions internally (shares the same token).
// Frontend calls this on initial load and on manual refresh.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { getYTAccount, getAccessToken, hasAnalyticsScope, adminClient } from "../shared/youtube-token.ts";

const COOLDOWN_SECONDS = 5 * 60; // 5 minutes

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

const YT_ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";
const YT_DATA      = "https://www.googleapis.com/youtube/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST")   return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (authError || !user) return err(req, "Unauthorized", 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const { account_id, date_range = "28d", force = false } = body ?? {};
  if (!account_id) return err(req, "account_id required", 400);

  const { account, error: acctErr } = await getYTAccount(user.id, account_id);
  if (acctErr || !account) return err(req, acctErr ?? "Account not found", 404);

  if (!hasAnalyticsScope(account)) {
    return ok(req, { needs_reconnect: true, reason: "analytics_scope_missing" });
  }

  // Cooldown check
  if (!force && account.last_analytics_sync_at) {
    const lastSync = new Date(account.last_analytics_sync_at).getTime();
    const elapsed  = (Date.now() - lastSync) / 1000;
    if (elapsed < COOLDOWN_SECONDS) {
      return ok(req, {
        skipped:       true,
        reason:        "cooldown",
        next_sync_in:  Math.ceil(COOLDOWN_SECONDS - elapsed),
        last_synced_at: account.last_analytics_sync_at,
      });
    }
  }

  const { accessToken, error: tokenErr } = await getAccessToken(account);
  if (tokenErr || !accessToken) return err(req, tokenErr ?? "Token error", 401);

  const days      = dateRangeDays(date_range);
  const endDate   = daysAgo(1);
  const startDate = daysAgo(days);
  const prevEnd   = daysAgo(days + 1);
  const prevStart = daysAgo(days * 2);

  const OVERVIEW_METRICS =
    "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";
  const VIDEO_METRICS =
    "views,estimatedMinutesWatched,averageViewDuration,likes,comments,subscribersGained";

  // Fire all requests in parallel
  const [overviewRes, prevRes, channelRes, videosRes] = await Promise.all([
    fetch(
      `${YT_ANALYTICS}?ids=channel==MINE` +
      `&startDate=${startDate}&endDate=${endDate}` +
      `&metrics=${OVERVIEW_METRICS}&dimensions=day&sort=day`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
    fetch(
      `${YT_ANALYTICS}?ids=channel==MINE` +
      `&startDate=${prevStart}&endDate=${prevEnd}` +
      `&metrics=${OVERVIEW_METRICS}&dimensions=day&sort=day`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
    fetch(`${YT_DATA}/channels?part=statistics,snippet&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(
      `${YT_ANALYTICS}?ids=channel==MINE` +
      `&startDate=${startDate}&endDate=${endDate}` +
      `&metrics=${VIDEO_METRICS}&dimensions=video&sort=-views&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
  ]);

  // Check for analytics scope error
  if (overviewRes.status === 403) {
    const rb = await overviewRes.json().catch(() => ({}));
    const reason = rb?.error?.errors?.[0]?.reason ?? "";
    if (reason === "forbidden" || reason === "insufficientPermissions") {
      return ok(req, { needs_reconnect: true, reason: "analytics_scope_missing" });
    }
    return err(req, "YouTube analytics is temporarily unavailable. Try again later.", 429);
  }

  // ── Parse overview data ────────────────────────────────────────────────────
  const overviewData = overviewRes.ok ? await overviewRes.json() : { columnHeaders: [], rows: [] };
  const prevData     = prevRes.ok     ? await prevRes.json()     : { columnHeaders: [], rows: [] };
  const channelData  = channelRes.ok  ? await channelRes.json()  : { items: [] };

  const headers: string[] = (overviewData.columnHeaders ?? []).map((h: any) => h.name);
  const dayIdx  = headers.indexOf("day");
  const viewIdx = headers.indexOf("views");
  const wtIdx   = headers.indexOf("estimatedMinutesWatched");
  const avdIdx  = headers.indexOf("averageViewDuration");
  const sgIdx   = headers.indexOf("subscribersGained");
  const slIdx   = headers.indexOf("subscribersLost");

  const dailyRows = ((overviewData.rows ?? []) as any[][]).map((r) => ({
    date:                          String(r[dayIdx]),
    views:                         Number(r[viewIdx] ?? 0),
    watch_time_minutes:            Number(r[wtIdx]   ?? 0),
    average_view_duration_seconds: Number(r[avdIdx]  ?? 0),
    subscribers_gained:            Number(r[sgIdx]   ?? 0),
    subscribers_lost:              Number(r[slIdx]   ?? 0),
  }));

  const sum = (rows: any[][], i: number) =>
    rows.reduce((s: number, r: any[]) => s + Number(r[i] ?? 0), 0);

  const curRows  = overviewData.rows ?? [];
  const prevRows = prevData.rows     ?? [];

  const views       = sum(curRows, viewIdx);
  const watchTime   = sum(curRows, wtIdx);
  const subGained   = sum(curRows, sgIdx);
  const subLost     = sum(curRows, slIdx);
  const pViews      = sum(prevRows, viewIdx);
  const pWatchTime  = sum(prevRows, wtIdx);
  const pSubGained  = sum(prevRows, sgIdx);

  const totalViewsForAvg = dailyRows.reduce((s, r) => s + r.views, 0);
  const avgViewDuration  = totalViewsForAvg > 0
    ? dailyRows.reduce((s, r) => s + r.average_view_duration_seconds * r.views, 0) / totalViewsForAvg
    : 0;

  function pct(a: number, b: number): number | null {
    return b === 0 ? null : Math.round(((a - b) / b) * 100);
  }

  const channelItem   = channelData.items?.[0] ?? {};
  const channelStats  = channelItem.statistics  ?? {};
  const channelSn     = channelItem.snippet      ?? {};

  // ── Parse videos data ──────────────────────────────────────────────────────
  const videosData   = videosRes.ok ? await videosRes.json() : { columnHeaders: [], rows: [] };
  const vh: string[] = (videosData.columnHeaders ?? []).map((h: any) => h.name);
  const vRows: any[][] = videosData.rows ?? [];

  const vidIdx  = vh.indexOf("video");
  const vvIdx   = vh.indexOf("views");
  const vwtIdx  = vh.indexOf("estimatedMinutesWatched");
  const vavdIdx = vh.indexOf("averageViewDuration");
  const vliIdx  = vh.indexOf("likes");
  const vcoIdx  = vh.indexOf("comments");
  const vsgIdx  = vh.indexOf("subscribersGained");

  let videos: any[] = [];
  if (vRows.length > 0) {
    const videoIds   = vRows.map((r) => String(r[vidIdx]));
    const metricsMap = new Map(vRows.map((r) => [String(r[vidIdx]), r]));

    const metaRes = await fetch(
      `${YT_DATA}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const metaItems = metaRes.ok ? ((await metaRes.json()).items ?? []) as any[] : [];
    const metaMap   = new Map(metaItems.map((v: any) => [v.id, v]));

    videos = videoIds.map((vid) => {
      const r    = metricsMap.get(vid)!;
      const meta = metaMap.get(vid);
      const sn   = meta?.snippet     ?? {};
      const st   = meta?.statistics  ?? {};
      return {
        video_id:            vid,
        title:               sn.title ?? "Untitled",
        thumbnail_url:       sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null,
        youtube_url:         `https://www.youtube.com/watch?v=${vid}`,
        published_at:        sn.publishedAt ?? null,
        duration_seconds:    parseDuration(meta?.contentDetails?.duration ?? ""),
        views:               Number(r[vvIdx]  ?? 0),
        watch_time_minutes:  Number(r[vwtIdx] ?? 0),
        avg_view_duration_seconds: Number(r[vavdIdx] ?? 0),
        likes:               Number(r[vliIdx] ?? 0),
        comments:            Number(r[vcoIdx] ?? 0),
        subscribers_gained:  Number(r[vsgIdx] ?? 0),
        total_views:         Number(st.viewCount    ?? 0),
        total_likes:         Number(st.likeCount    ?? 0),
        total_comments:      Number(st.commentCount ?? 0),
      };
    });

    // Persist videos to DB (background)
    EdgeRuntime.waitUntil((async () => {
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
            raw:  { total_views: v.total_views, total_likes: v.total_likes },
            snapshotted_at: now,
          });
        }
      }
    })());
  }

  // Persist daily rows + update last_analytics_sync_at (background)
  const now = new Date().toISOString();
  EdgeRuntime.waitUntil((async () => {
    const sb = adminClient();
    if (dailyRows.length > 0) {
      const { error: upsertErr } = await sb
        .from("youtube_channel_daily_analytics")
        .upsert(
          dailyRows.map((r) => ({
            user_id:           user.id,
            social_account_id: account_id,
            ...r,
            updated_at:        now,
          })),
          { onConflict: "social_account_id,date" },
        );
      if (upsertErr) console.error("[yt-sync] Daily upsert:", upsertErr.message);
    }
    await sb.from("social_accounts").update({ last_analytics_sync_at: now }).eq("id", account_id);
  })());

  return ok(req, {
    synced_at:  now,
    date_range,
    start_date: startDate,
    end_date:   endDate,
    channel: {
      id:          account.platform_user_id,
      name:        account.display_name ?? channelSn.title,
      avatar_url:  account.avatar_url   ?? channelSn.thumbnails?.default?.url ?? null,
      subscribers: Number(channelStats.subscriberCount ?? 0),
      total_views: Number(channelStats.viewCount       ?? 0),
      video_count: Number(channelStats.videoCount      ?? 0),
    },
    overview: {
      views,
      watch_time_minutes:        Math.round(watchTime),
      watch_time_hours:          Math.round(watchTime / 60),
      subscribers_gained:        subGained,
      subscribers_lost:          subLost,
      net_subscribers:           subGained - subLost,
      avg_view_duration_seconds: Math.round(avgViewDuration),
      vs_prev: {
        views:              pct(views,     pViews),
        watch_time_minutes: pct(watchTime, pWatchTime),
        subscribers_gained: pct(subGained, pSubGained),
      },
    },
    daily:  dailyRows,
    videos,
  });
});
