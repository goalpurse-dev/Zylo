// supabase/functions/ai-insights-job/index.ts
// Generates AI-powered social media insights for a user using GPT-4o-mini.
//
// Reads recent posts + metrics snapshots, compares each post to the user's
// own account averages, and generates two insight records:
//   - weekly_summary: what worked, what failed, top post, key takeaways
//   - recommendations: next topics, hooks, formats, things to avoid
//
// Auth modes:
//   1. Authenticated user JWT → generates insights for the calling user.
//   2. POST with { user_id, secret } → for scheduled jobs.
//
// Rate-limited: will not regenerate if a summary was produced in the last 12h.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY")!;
const CRON_SECRET  = Deno.env.get("ANALYTICS_CRON_SECRET") ?? "";

const COOLDOWN_HOURS = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

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

  const platform = String(body?.platform ?? "instagram");

  // Rate limit: skip if a summary was generated recently
  const cooldownSince = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from("ai_social_insights")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("insight_type", "weekly_summary")
    .gte("generated_at", cooldownSince)
    .limit(1);

  if (recent?.length) {
    return ok(req, { skipped: true, reason: "Generated recently" });
  }

  // Fetch the user's posts with latest metrics
  const { data: posts } = await sb.rpc("get_my_social_posts_for_insights", {
    p_user_id:  userId,
    p_platform: platform,
  }).catch(() => ({ data: null }));

  // Fall back to direct query since RPC might not exist yet
  const { data: rawPosts } = await sb
    .from("social_posts")
    .select(`
      id, platform_post_id, media_type, caption, permalink, posted_at,
      social_post_metrics_snapshots (
        views, likes, comments, shares, saves, reach, engagement_rate,
        snapshotted_at
      )
    `)
    .eq("user_id", userId)
    .eq("platform", platform)
    .order("posted_at", { ascending: false })
    .limit(30);

  const postsData: any[] = posts ?? rawPosts ?? [];
  if (!postsData.length) {
    return ok(req, { skipped: true, reason: "No posts to analyse" });
  }

  // Fetch latest account snapshot for averages
  const { data: accountSnap } = await sb
    .from("social_account_metrics_snapshots")
    .select("followers, avg_views, avg_likes, avg_comments, avg_engagement")
    .eq("user_id", userId)
    .eq("platform", platform)
    .order("snapshotted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Build compact data for the prompt (strip nulls, shorten captions)
  const postSummaries = postsData.slice(0, 20).map((p: any) => {
    const metrics = Array.isArray(p.social_post_metrics_snapshots)
      ? p.social_post_metrics_snapshots[0]
      : p.social_post_metrics_snapshots;
    return {
      id:       p.platform_post_id,
      type:     p.media_type,
      caption:  String(p.caption ?? "").slice(0, 120),
      posted:   p.posted_at ? p.posted_at.slice(0, 10) : null,
      views:    metrics?.views    ?? null,
      likes:    metrics?.likes    ?? null,
      comments: metrics?.comments ?? null,
      shares:   metrics?.shares   ?? null,
      saves:    metrics?.saves    ?? null,
      er:       metrics?.engagement_rate != null
                  ? Number(metrics.engagement_rate.toFixed(2))
                  : null,
    };
  });

  const avgContext = accountSnap ? {
    followers:      accountSnap.followers,
    avg_views:      accountSnap.avg_views    != null ? Number(accountSnap.avg_views.toFixed(1))    : null,
    avg_likes:      accountSnap.avg_likes    != null ? Number(accountSnap.avg_likes.toFixed(1))    : null,
    avg_comments:   accountSnap.avg_comments != null ? Number(accountSnap.avg_comments.toFixed(1)) : null,
    avg_engagement: accountSnap.avg_engagement != null ? Number(accountSnap.avg_engagement.toFixed(2)) : null,
  } : null;

  const periodEnd   = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

  const systemPrompt = `You are a sharp social media growth analyst. Analyse the provided Instagram performance data and return ONLY a valid JSON object — no markdown, no explanation, no extra text. Be specific, direct, and honest. Avoid generic advice.`;

  const userPrompt = `Platform: ${platform}
Account averages (last 20 posts): ${JSON.stringify(avgContext)}
Recent posts (newest first): ${JSON.stringify(postSummaries)}

Return this exact JSON shape:
{
  "summary": "2-3 sentence overall performance summary for the last 30 days",
  "best_post_id": "platform_post_id of the top-performing post or null",
  "worst_post_id": "platform_post_id of the lowest-performing post or null",
  "key_wins": ["what worked — specific observation 1", "specific observation 2"],
  "key_fails": ["what flopped — specific observation 1", "specific observation 2"],
  "next_topics": ["topic idea 1 based on what resonated", "topic idea 2", "topic idea 3"],
  "best_hooks": ["hook style that performed best", "another hook pattern"],
  "best_formats": ["REEL or IMAGE or CAROUSEL — which performed best and why"],
  "avoid": ["specific thing to stop doing based on data"],
  "recommendation": "single most impactful thing to do next"
}`;

  let content: Record<string, unknown> = {};
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:       "gpt-4o-mini",
        messages:    [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
        max_tokens:  800,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[ai-insights] OpenAI error:", res.status, txt.slice(0, 200));
      return err(req, "Insight generation failed", 502);
    }

    const data = await res.json();
    const raw  = String(data.choices?.[0]?.message?.content ?? "").trim();
    content = JSON.parse(raw);
  } catch (e) {
    console.error("[ai-insights] generation exception:", (e as Error).message);
    return err(req, "Insight generation failed", 500);
  }

  // Get the social_account_id for this user+platform
  const { data: acct } = await sb
    .from("social_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", platform)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();

  // Store weekly_summary
  await sb.from("ai_social_insights").insert({
    user_id:           userId,
    social_account_id: acct?.id ?? null,
    platform,
    insight_type:      "weekly_summary",
    period_start:      periodStart.toISOString().slice(0, 10),
    period_end:        periodEnd.toISOString().slice(0, 10),
    content,
  });

  // Store recommendations as a separate record for easy querying
  const recommendations = {
    next_topics:  content.next_topics,
    best_hooks:   content.best_hooks,
    best_formats: content.best_formats,
    avoid:        content.avoid,
    recommendation: content.recommendation,
  };

  await sb.from("ai_social_insights").insert({
    user_id:           userId,
    social_account_id: acct?.id ?? null,
    platform,
    insight_type:      "recommendations",
    period_start:      periodStart.toISOString().slice(0, 10),
    period_end:        periodEnd.toISOString().slice(0, 10),
    content:           recommendations,
  });

  return ok(req, { generated: true, platform });
});
