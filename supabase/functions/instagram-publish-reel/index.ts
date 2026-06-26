// supabase/functions/instagram-publish-reel/index.ts
// Publishes a Zyvo creation as an Instagram Reel.
//
// Flow (mirrors runware-video pattern):
//   1. Authenticate caller; verify they own both the creation and the IG account.
//   2. Validate caption length and video URL origin.
//   3. Write an instagram_publish_jobs row (idempotency key prevents double-publish).
//   4. POST to Meta to create a Reel media container.
//   5. Return 202 immediately with the job_id.
//   6. Poll container status in EdgeRuntime.waitUntil (background, up to ~4 min).
//   7. When Meta reports FINISHED, call the publish endpoint.
//   8. Update the job row with the final media_id, permalink, and published status.
//
// If the background poller times out before Meta finishes, the job row stays
// in "processing". The frontend can then poll instagram-publish-status, which
// re-checks Meta directly and advances the job.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { decryptToken } from "../shared/social-token.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_HEX  = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY")!;

/* ── CONSTANTS ────────────────────────────────────────────────────────────── */

const IG_GRAPH_BASE  = "https://graph.instagram.com";
const IG_GRAPH_VER   = "v21.0";
const MAX_CAPTION    = 2200;                // Instagram hard limit
const MAX_POLL_MS    = 4 * 60 * 1000;      // 4-minute background window
const POLL_INTERVAL  = 8_000;              // check every 8 s

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function markFailed(
  sb: any,
  jobId: string,
  code: string,
  message: string,
): Promise<void> {
  await sb
    .from("instagram_publish_jobs")
    .update({
      status:        "failed",
      error_code:    code,
      error_message: message,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", jobId);
}

/* ── BACKGROUND POLLING ───────────────────────────────────────────────────── */

async function pollAndPublish(
  sb:          any,
  jobId:       string,
  igUserId:    string,
  containerId: string,
  token:       string,
): Promise<void> {
  const deadline = Date.now() + MAX_POLL_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL);

    // Check Meta container status
    let statusCode: string;
    try {
      const res = await fetch(
        `${IG_GRAPH_BASE}/${IG_GRAPH_VER}/${containerId}` +
        `?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
      );
      if (!res.ok) {
        console.warn(`[ig-publish] Status check non-ok (${res.status}); retrying`);
        continue;
      }
      const data = await res.json();
      statusCode = String(data.status_code ?? "");
    } catch (e) {
      console.warn("[ig-publish] Status check exception:", (e as Error).message);
      continue;
    }

    if (statusCode === "FINISHED") {
      // ── Publish the container ────────────────────────────────────────────
      await sb
        .from("instagram_publish_jobs")
        .update({ status: "publishing", updated_at: new Date().toISOString() })
        .eq("id", jobId);

      const publishBody = new URLSearchParams({
        creation_id:  containerId,
        access_token: token,
      });

      const publishRes = await fetch(
        `${IG_GRAPH_BASE}/${IG_GRAPH_VER}/${igUserId}/media_publish`,
        {
          method:  "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body:    publishBody.toString(),
        },
      );

      if (!publishRes.ok) {
        const text = await publishRes.text().catch(() => "");
        console.error("[ig-publish] Publish endpoint failed:", publishRes.status, text.slice(0, 200));
        await markFailed(sb, jobId, "PUBLISH_FAILED", "Failed to publish Reel to Instagram.");
        return;
      }

      const publishData = await publishRes.json();
      const mediaId     = String(publishData.id ?? "");

      if (!mediaId) {
        await markFailed(sb, jobId, "NO_MEDIA_ID", "Instagram returned an unexpected response.");
        return;
      }

      // Fetch permalink (best-effort)
      let permalink: string | null = null;
      try {
        const plRes = await fetch(
          `${IG_GRAPH_BASE}/${IG_GRAPH_VER}/${mediaId}` +
          `?fields=id,permalink&access_token=${encodeURIComponent(token)}`,
        );
        if (plRes.ok) {
          const plData = await plRes.json();
          permalink = plData.permalink ?? null;
        }
      } catch { /* permalink is optional */ }

      await sb
        .from("instagram_publish_jobs")
        .update({
          status:       "published",
          media_id:     mediaId,
          permalink,
          published_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        })
        .eq("id", jobId);

      return;

    } else if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      await markFailed(
        sb, jobId, statusCode,
        "Instagram could not process this video. Please check the format and try again.",
      );
      return;
    }
    // IN_PROGRESS or unknown — keep polling
  }

  // Background window exhausted — job remains "processing"
  // instagram-publish-status will re-check Meta when the frontend polls.
  console.warn(`[ig-publish] Poll window exhausted for job ${jobId}; leaving in processing`);
}

/* ── MAIN HANDLER ─────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return err(req, "Method not allowed", 405);
  }

  const { user, authError } = await requireUser(req);
  if (authError || !user) {
    return err(req, "Unauthorized", 401);
  }

  let body: any = {};
  try { body = await req.json(); } catch {
    return err(req, "Invalid JSON", 400);
  }

  const {
    social_account_id,
    creation_id    = null,    // jobs table row — for Zyvo-generated videos
    video_url: directUrl = null, // direct storage URL — for custom uploads
    caption = "",
  } = body ?? {};

  if (!social_account_id || typeof social_account_id !== "string") {
    return err(req, "social_account_id required", 400);
  }
  if (!creation_id && !directUrl) {
    return err(req, "creation_id or video_url required", 400);
  }
  if (typeof caption !== "string" || caption.length > MAX_CAPTION) {
    return err(req, `Caption must be ${MAX_CAPTION} characters or fewer`, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Verify ownership: Instagram account ───────────────────────────────────
  const { data: account } = await sb
    .from("social_accounts")
    .select("id, user_id, platform_user_id, access_token_encrypted, token_expires_at, revoked_at")
    .eq("id", social_account_id)
    .eq("user_id", user.id)
    .eq("platform", "instagram")
    .is("revoked_at", null)
    .maybeSingle();

  if (!account) {
    return err(req, "Instagram account not connected. Please reconnect and try again.", 400);
  }
  if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    return err(req, "Instagram connection has expired. Please reconnect your account.", 400);
  }
  if (!account.access_token_encrypted) {
    return err(req, "Instagram account credentials are invalid. Please reconnect.", 400);
  }

  // ── Resolve video URL ─────────────────────────────────────────────────────
  let videoUrl: string;

  if (creation_id) {
    // Zyvo-generated video: validate ownership via the jobs table
    const { data: job } = await sb
      .from("jobs")
      .select("id, user_id, result_url")
      .eq("id", creation_id)
      .eq("user_id", user.id)
      .eq("status", "succeeded")
      .maybeSingle();

    if (!job)             return err(req, "Video not found", 404);
    if (!job.result_url)  return err(req, "This video is not ready to publish yet", 400);
    videoUrl = job.result_url as string;
  } else {
    // Custom upload: caller provides a direct storage URL — validate it belongs
    // to this project's storage bucket so we can't be used as an SSRF proxy.
    videoUrl = String(directUrl).trim();
  }

  // ── Validate video URL belongs to Zyvo storage (prevent SSRF) ────────────
  if (!videoUrl.startsWith(SUPABASE_URL + "/storage/v1/object/")) {
    return err(req, "Invalid video source", 400);
  }

  // ── Idempotency ───────────────────────────────────────────────────────────
  const minuteBucket = Math.floor(Date.now() / 1000 / 60);
  const idemKey      = await sha256Hex(
    `${user.id}:${creation_id ?? videoUrl}:${social_account_id}:${minuteBucket}`,
  );

  const { data: existing } = await sb
    .from("instagram_publish_jobs")
    .select("id, status")
    .eq("idempotency_key", idemKey)
    .maybeSingle();

  if (existing) {
    return ok(req, { job_id: existing.id, status: existing.status, duplicate: true }, 202);
  }

  // ── Decrypt token ─────────────────────────────────────────────────────────
  let token: string;
  try {
    token = await decryptToken(account.access_token_encrypted, ENC_KEY_HEX);
  } catch (e) {
    console.error("[ig-publish] Token decryption failed:", (e as Error).message);
    return err(req, "Failed to read credentials. Please reconnect your Instagram account.", 500);
  }

  const igUserId = account.platform_user_id;

  // ── Create Reel media container at Meta ───────────────────────────────────
  const containerBody = new URLSearchParams({
    media_type:   "REELS",
    video_url:    videoUrl,
    caption:      caption.trim(),
    access_token: token,
  });

  const containerRes = await fetch(
    `${IG_GRAPH_BASE}/${IG_GRAPH_VER}/${igUserId}/media`,
    {
      method:  "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body:    containerBody.toString(),
    },
  );

  if (!containerRes.ok) {
    const text = await containerRes.text().catch(() => "");
    console.error("[ig-publish] Container creation failed:", containerRes.status, text.slice(0, 300));
    return err(req, "Instagram could not accept this video. Please check the format and try again.", 502);
  }

  const containerData = await containerRes.json();
  const containerId   = String(containerData.id ?? "");

  if (!containerId) {
    console.error("[ig-publish] No container ID in Meta response:", JSON.stringify(containerData));
    return err(req, "Unexpected response from Instagram. Please try again.", 502);
  }

  // ── Write instagram_publish_jobs row ──────────────────────────────────────
  const { data: job, error: jobErr } = await sb
    .from("instagram_publish_jobs")
    .insert({
      user_id:           user.id,
      social_account_id: account.id,
      creation_id:       creation_id ?? null,
      video_url:         videoUrl,
      caption:           caption.trim(),
      status:            "processing",
      idempotency_key:   idemKey,
      container_id:      containerId,
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    console.error("[ig-publish] Job insert failed:", jobErr?.message);
    return err(req, "Failed to record publish job", 500);
  }

  // ── Poll + publish in background ──────────────────────────────────────────
  EdgeRuntime.waitUntil(
    pollAndPublish(sb, job.id, igUserId, containerId, token),
  );

  return ok(req, { job_id: job.id, status: "processing" }, 202);
});
