// supabase/functions/analytics-sync/index.ts
// Orchestrator: triggers all platform syncs for a user, then kicks off AI insights.
//
// Auth modes:
//   1. Authenticated user JWT → syncs the calling user (manual "Refresh" from frontend).
//   2. POST with { user_id, secret } → for pg_cron / external scheduler.
//
// Flow:
//   1. Resolve user ID
//   2. Instagram media + metrics sync
//   3. (YouTube sync — placeholder, not implemented yet)
//   4. AI insights job (only if sync produced posts)
//   5. Return combined results
//
// Calls sibling Edge Functions via internal fetch using the service role key,
// so no tokens ever flow through the frontend.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET   = Deno.env.get("ANALYTICS_CRON_SECRET") ?? "";

async function callFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${SERVICE_KEY}`,
      apikey:         SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const body = await req.json().catch(() => ({}));

  let userId: string;
  let calledByCron = false;

  if (body?.secret && body?.user_id) {
    if (!CRON_SECRET || body.secret !== CRON_SECRET) return err(req, "Forbidden", 403);
    userId      = body.user_id;
    calledByCron = true;
  } else {
    const { user, authError } = await requireUser(req);
    if (authError || !user) return err(req, "Unauthorized", 401);
    userId = user.id;
  }

  const results: Record<string, any> = {};

  // ── Instagram ─────────────────────────────────────────────────────────────
  const igSyncPayload = calledByCron
    ? { user_id: userId, secret: CRON_SECRET }
    : { _user_id_override: userId, _internal: true }; // for user-triggered calls

  // For user-triggered calls, pass a flag that the function reads from the
  // request body after requireUser() confirms identity.
  const igResult = await callFunction("instagram-media-sync", {
    user_id: userId,
    secret:  CRON_SECRET || "__user_triggered__",
    _source: calledByCron ? "cron" : "user",
  });
  results.instagram = igResult.data;

  // ── YouTube (placeholder) ─────────────────────────────────────────────────
  // results.youtube = await callFunction("youtube-media-sync", { user_id: userId, secret: CRON_SECRET });

  // ── TikTok (placeholder) ──────────────────────────────────────────────────
  // results.tiktok = await callFunction("tiktok-media-sync", { user_id: userId, secret: CRON_SECRET });

  // ── AI Insights ───────────────────────────────────────────────────────────
  const hasPosts = (igResult.data?.posts ?? 0) > 0 || igResult.data?.synced > 0;
  if (hasPosts || body?.force_insights) {
    const insightsResult = await callFunction("ai-insights-job", {
      user_id:  userId,
      secret:   CRON_SECRET,
      platform: "instagram",
    });
    results.insights = insightsResult.data;
  }

  return ok(req, { success: true, results });
});
