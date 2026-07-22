// supabase/functions/get-analytics/index.ts
// Frontend-facing read endpoint for analytics data.
// Returns posts with their latest metrics, account summary, and latest AI insight.
// No tokens, no raw platform errors, no other users' data.
//
// Query params (all optional):
//   platform  = instagram | youtube | tiktok   (default: instagram)
//   limit     = 1-100                           (default: 50)
//   offset    = 0+                              (default: 0)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser, supabaseForUser } from "../shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (authError || !user) return err(req, "Unauthorized", 401);

  const body     = await req.json().catch(() => ({}));
  const platform = ["instagram", "youtube", "tiktok"].includes(body?.platform)
    ? String(body.platform)
    : "instagram";
  const limit    = Math.min(Math.max(parseInt(body?.limit ?? "50") || 50, 1), 100);
  const offset   = Math.max(parseInt(body?.offset ?? "0") || 0, 0);
  const accountId = typeof body?.account_id === "string" ? body.account_id : null;

  // Use service role for the definer RPCs — they enforce auth.uid() internally
  const userSb = supabaseForUser(req);

  // Posts with latest metrics via SECURITY DEFINER RPC
  const { data: posts, error: postsErr } = await userSb.rpc("get_my_social_posts", {
    p_platform: platform,
    p_limit:    limit,
    p_offset:   offset,
  });

  if (postsErr) {
    console.error("[get-analytics] posts error:", postsErr.message);
    return err(req, "Failed to load posts", 500);
  }

  // Dashboard summary (account snapshot + top posts + latest AI insight)
  const { data: summary, error: summaryErr } = await userSb.rpc("get_my_analytics_summary", {
    p_platform: platform,
  });

  if (summaryErr) {
    console.warn("[get-analytics] summary error (non-fatal):", summaryErr.message);
  }

  // Latest recommendations insight
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: recommendations } = await sb
    .from("ai_social_insights")
    .select("content, generated_at, period_start, period_end")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .eq("insight_type", "recommendations")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let filteredPosts = posts ?? [];
  let accountSummary = summary?.account ?? null;

  if (accountId) {
    const { data: ownedAccount } = await sb
      .from("social_accounts")
      .select("id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .eq("platform", platform)
      .is("revoked_at", null)
      .maybeSingle();
    if (!ownedAccount) return err(req, "Analytics account not found", 404);

    filteredPosts = filteredPosts.filter((post: { social_account_id?: string }) =>
      post.social_account_id === accountId
    );

    const { data: snapshot } = await sb
      .from("social_account_metrics_snapshots")
      .select("followers, following, media_count, avg_views, avg_likes, avg_comments, avg_engagement, snapshotted_at")
      .eq("user_id", user.id)
      .eq("social_account_id", accountId)
      .eq("platform", platform)
      .order("snapshotted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    accountSummary = snapshot ?? null;
  }

  const topPosts = [...filteredPosts]
    .sort((a, b) => Number(b.views ?? b.reach ?? b.likes ?? 0) - Number(a.views ?? a.reach ?? a.likes ?? 0))
    .slice(0, 10);

  return ok(req, {
    platform,
    posts:           filteredPosts,
    summary:         summary ? { ...summary, account: accountSummary, top_posts: topPosts } : {
      account: accountSummary,
      top_posts: topPosts,
      latest_insight: null,
    },
    recommendations: recommendations ?? null,
    meta: {
      limit,
      offset,
      count: (posts ?? []).length,
    },
  });
});
