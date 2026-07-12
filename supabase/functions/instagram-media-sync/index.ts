// supabase/functions/instagram-media-sync/index.ts
// Syncs recent Instagram media for a user's connected IG accounts into social_posts
// and records a basic metrics snapshot (likes, comments) from the media fields.
//
// Full insights (reach, impressions, plays, saves, shares) require the
// instagram_business_manage_insights scope — this function attempts them and
// silently falls back if the scope is not yet granted.
//
// Auth modes:
//   1. Authenticated user JWT → syncs the calling user's accounts.
//   2. POST with { user_id, secret } → syncs a specific user (scheduled job).
//
// Never exposes access tokens or raw provider errors to callers.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { decryptToken } from "../shared/social-token.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_HEX   = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY")!;
const CRON_SECRET   = Deno.env.get("ANALYTICS_CRON_SECRET") ?? "";

const IG_GRAPH_BASE = "https://graph.instagram.com/v21.0";
const MEDIA_LIMIT   = 50; // posts per account per sync

const MEDIA_FIELDS = [
  "id", "caption", "media_type", "permalink", "timestamp",
  "thumbnail_url", "media_url", "like_count", "comments_count",
  "is_shared_to_feed",
].join(",");

const INSIGHTS_METRICS_REEL  = "reach,saved,shares,plays,comments,likes";
const INSIGHTS_METRICS_IMAGE = "reach,saved,shares,impressions,likes,comments";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Resolve the user ID — either from JWT or from cron call
  let userId: string;
  const body = await req.json().catch(() => ({}));

  if (body?.secret && body?.user_id) {
    if (!CRON_SECRET || body.secret !== CRON_SECRET) return err(req, "Forbidden", 403);
    userId = body.user_id;
  } else {
    const { user, authError } = await requireUser(req);
    if (authError || !user) return err(req, "Unauthorized", 401);
    userId = user.id;
  }

  // Fetch active IG social accounts for this user (service role bypasses RLS)
  const { data: accounts, error: acctErr } = await sb
    .from("social_accounts")
    .select("id, platform_user_id, username, access_token_encrypted, scopes")
    .eq("user_id", userId)
    .eq("platform", "instagram")
    .is("revoked_at", null);

  if (acctErr) {
    console.error("[ig-media-sync] accounts fetch error:", acctErr.message);
    return err(req, "Sync failed", 500);
  }
  if (!accounts?.length) return ok(req, { synced: 0, posts: 0 });

  let totalPosts = 0;

  for (const account of accounts) {
    let token: string;
    try {
      token = await decryptToken(account.access_token_encrypted, ENC_KEY_HEX);
    } catch (e) {
      console.error("[ig-media-sync] token decrypt failed:", (e as Error).message);
      continue;
    }

    // 1. Fetch recent media
    const mediaParams = new URLSearchParams({
      fields:       MEDIA_FIELDS,
      limit:        String(MEDIA_LIMIT),
      access_token: token,
    });

    let mediaItems: any[] = [];
    try {
      const res = await fetch(`${IG_GRAPH_BASE}/me/media?${mediaParams}`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("[ig-media-sync] media fetch failed:", res.status, txt.slice(0, 200));
        continue;
      }
      const json = await res.json();
      mediaItems = json?.data ?? [];
    } catch (e) {
      console.error("[ig-media-sync] media fetch exception:", (e as Error).message);
      continue;
    }

    // 2. Upsert each media item into social_posts and insert a metrics snapshot
    for (const item of mediaItems) {
      const postId = String(item.id ?? "");
      if (!postId) continue;

      const mediaType    = String(item.media_type ?? "").toUpperCase();
      const isVideo      = ["REEL", "VIDEO"].includes(mediaType);
      const thumbnailUrl = item.thumbnail_url ?? (isVideo ? null : item.media_url) ?? null;
      const mediaUrl     = item.media_url ?? null;
      const postedAt     = item.timestamp ? new Date(item.timestamp).toISOString() : null;

      // Upsert post record
      const { data: postRow, error: upsertErr } = await sb
        .from("social_posts")
        .upsert({
          user_id:           userId,
          social_account_id: account.id,
          platform:          "instagram",
          platform_post_id:  postId,
          media_type:        mediaType || null,
          caption:           item.caption ?? null,
          permalink:         item.permalink ?? null,
          thumbnail_url:     thumbnailUrl,
          media_url:         mediaUrl,
          posted_at:         postedAt,
          synced_at:         new Date().toISOString(),
        }, { onConflict: "social_account_id,platform_post_id" })
        .select("id")
        .single();

      if (upsertErr || !postRow) {
        console.error("[ig-media-sync] post upsert failed:", upsertErr?.message);
        continue;
      }

      // 3. Try to fetch insights (requires instagram_business_manage_insights)
      let insightsRaw: Record<string, number> = {};
      const hasInsightsScope = account.scopes?.includes("instagram_business_manage_insights");

      if (hasInsightsScope) {
        const insightMetrics = isVideo ? INSIGHTS_METRICS_REEL : INSIGHTS_METRICS_IMAGE;
        const insightParams = new URLSearchParams({
          metric:       insightMetrics,
          access_token: token,
        });
        try {
          const res = await fetch(`${IG_GRAPH_BASE}/${postId}/insights?${insightParams}`);
          if (res.ok) {
            const json = await res.json();
            for (const m of (json?.data ?? [])) {
              insightsRaw[m.name] = Number(m.values?.[0]?.value ?? m.value ?? 0);
            }
          }
        } catch (e) {
          console.warn("[ig-media-sync] insights fetch exception:", (e as Error).message);
        }
      }

      // Build metrics snapshot — prioritise insights, fall back to media fields
      const likes    = insightsRaw.likes    ?? Number(item.like_count    ?? 0);
      const comments = insightsRaw.comments ?? Number(item.comments_count ?? 0);
      const views    = insightsRaw.plays    ?? null;
      const reach    = insightsRaw.reach    ?? null;
      const impressions = insightsRaw.impressions ?? null;
      const shares   = insightsRaw.shares   ?? null;
      const saves    = insightsRaw.saved    ?? null;

      const engagementBase = (likes + comments + (shares ?? 0) + (saves ?? 0));
      const engagementRate = reach && reach > 0 ? (engagementBase / reach) * 100 : null;

      await sb.from("social_post_metrics_snapshots").insert({
        social_post_id:  postRow.id,
        user_id:         userId,
        platform:        "instagram",
        views,
        likes,
        comments,
        shares,
        saves,
        reach,
        impressions,
        engagement_rate: engagementRate,
        raw:             insightsRaw,
      });

      totalPosts++;
    }

    // 4. Fetch account-level profile metrics and snapshot them
    const profileParams = new URLSearchParams({
      fields:       "followers_count,follows_count,media_count",
      access_token: token,
    });
    try {
      const res = await fetch(`${IG_GRAPH_BASE}/me?${profileParams}`);
      if (res.ok) {
        const profile = await res.json();

        // Compute averages from recent snapshots
        const { data: recent } = await sb
          .from("social_post_metrics_snapshots")
          .select("views, likes, comments, engagement_rate")
          .eq("user_id", userId)
          .order("snapshotted_at", { ascending: false })
          .limit(20);

        const avg = (arr: (number | null)[]) => {
          const vals = arr.filter((v) => v != null) as number[];
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        };

        await sb.from("social_account_metrics_snapshots").insert({
          social_account_id: account.id,
          user_id:           userId,
          platform:          "instagram",
          followers:         profile.followers_count ?? null,
          following:         profile.follows_count   ?? null,
          media_count:       profile.media_count     ?? null,
          avg_views:         avg(recent?.map((r: any) => r.views) ?? []),
          avg_likes:         avg(recent?.map((r: any) => r.likes) ?? []),
          avg_comments:      avg(recent?.map((r: any) => r.comments) ?? []),
          avg_engagement:    avg(recent?.map((r: any) => r.engagement_rate) ?? []),
          raw:               profile,
        });
      }
    } catch (e) {
      console.warn("[ig-media-sync] profile snapshot exception:", (e as Error).message);
    }
  }

  return ok(req, { synced: accounts.length, posts: totalPosts });
});
