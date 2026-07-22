// supabase/functions/instagram-schedule-worker/index.ts
// Picks up instagram_publish_jobs where scheduled_for <= now() and status = 'queued',
// creates the Meta media container, then polls + publishes.
//
// Called by pg_cron every 5 minutes via the analytics cron migration,
// OR invoked manually via POST with { secret }.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../shared/cors.ts";
import { decryptToken } from "../shared/social-token.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_HEX   = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY")!;
const CRON_SECRET   = Deno.env.get("ANALYTICS_CRON_SECRET") ?? "";

const IG_GRAPH_BASE = "https://graph.instagram.com/v21.0";
const MAX_POLL_MS   = 4 * 60 * 1000;
const POLL_INTERVAL = 8_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function markFailed(sb: any, jobId: string, code: string, message: string) {
  await sb.from("instagram_publish_jobs").update({
    status: "failed", error_code: code, error_message: message,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
}

async function pollAndPublish(sb: any, jobId: string, igUserId: string, containerId: string, token: string) {
  const deadline = Date.now() + MAX_POLL_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL);
    try {
      const res = await fetch(`${IG_GRAPH_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
      if (!res.ok) continue;
      const { status_code } = await res.json();
      if (status_code === "FINISHED") {
        await sb.from("instagram_publish_jobs").update({ status: "publishing", updated_at: new Date().toISOString() }).eq("id", jobId);
        const publishRes = await fetch(`${IG_GRAPH_BASE}/${igUserId}/media_publish`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ creation_id: containerId, access_token: token }).toString(),
        });
        if (!publishRes.ok) { await markFailed(sb, jobId, "PUBLISH_FAILED", "Failed to publish Reel to Instagram."); return; }
        const { id: mediaId } = await publishRes.json();
        if (!mediaId) { await markFailed(sb, jobId, "NO_MEDIA_ID", "Unexpected response from Instagram."); return; }
        let permalink: string | null = null;
        try {
          const plRes = await fetch(`${IG_GRAPH_BASE}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`);
          if (plRes.ok) ({ permalink } = await plRes.json());
        } catch { /* optional */ }
        await sb.from("instagram_publish_jobs").update({ status: "published", media_id: mediaId, permalink, published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", jobId);
        return;
      } else if (status_code === "ERROR" || status_code === "EXPIRED") {
        await markFailed(sb, jobId, status_code, "Instagram could not process this video."); return;
      }
    } catch (e) { console.warn("[schedule-worker] poll exception:", (e as Error).message); }
  }
  console.warn(`[schedule-worker] poll timeout for job ${jobId}`);
}

async function processJob(sb: any, job: any) {
  // Mark as creating_container so we don't double-pick
  const { data: claimed } = await sb.from("instagram_publish_jobs")
    .update({ status: "creating_container", updated_at: new Date().toISOString() })
    .eq("id", job.id).eq("status", "queued").select("id");
  if (!claimed?.length) return; // another worker grabbed it

  const { data: account } = await sb.from("social_accounts")
    .select("platform_user_id, access_token_encrypted, token_expires_at, revoked_at")
    .eq("id", job.social_account_id).maybeSingle();

  if (!account || account.revoked_at || (account.token_expires_at && new Date(account.token_expires_at) < new Date())) {
    await markFailed(sb, job.id, "ACCOUNT_INVALID", "Instagram account is no longer connected. Please reconnect."); return;
  }

  let token: string;
  try { token = await decryptToken(account.access_token_encrypted, ENC_KEY_HEX); }
  catch (e) { await markFailed(sb, job.id, "TOKEN_ERROR", "Credentials error."); return; }

  const containerRes = await fetch(`${IG_GRAPH_BASE}/${account.platform_user_id}/media`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ media_type: "REELS", video_url: job.video_url, caption: job.caption ?? "", access_token: token }).toString(),
  });

  if (!containerRes.ok) {
    const txt = await containerRes.text().catch(() => "");
    console.error("[schedule-worker] container failed:", containerRes.status, txt.slice(0, 200));
    await markFailed(sb, job.id, "CONTAINER_FAILED", "Instagram could not accept this video."); return;
  }

  const { id: containerId } = await containerRes.json();
  if (!containerId) { await markFailed(sb, job.id, "NO_CONTAINER", "No container ID from Instagram."); return; }

  await sb.from("instagram_publish_jobs").update({ status: "processing", container_id: containerId, updated_at: new Date().toISOString() }).eq("id", job.id);
  await pollAndPublish(sb, job.id, account.platform_user_id, containerId, token);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  const body = await req.json().catch(() => ({}));
  if (!CRON_SECRET || body?.secret !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: dueJobs } = await sb
    .from("instagram_publish_jobs")
    .select("id, social_account_id, video_url, caption")
    .eq("status", "queued")
    .not("scheduled_for", "is", null)
    .lte("scheduled_for", new Date().toISOString())
    .limit(10);

  if (!dueJobs?.length) return new Response(JSON.stringify({ processed: 0 }), { status: 200 });

  EdgeRuntime.waitUntil(Promise.all(dueJobs.map((job: any) => processJob(sb, job))));

  return new Response(JSON.stringify({ processing: dueJobs.length }), { status: 202 });
});
