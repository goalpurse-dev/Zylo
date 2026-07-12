// supabase/functions/youtube-publish-video/index.ts
// Uploads a Zyvo creation to YouTube using the Data API v3.
//
// Flow:
//   1. Authenticate caller; verify they own the creation and the YT account.
//   2. Decrypt + refresh access token if expired.
//   3. Write a youtube_publish_jobs row (idempotency prevents double-upload).
//   4. Fetch video bytes from Supabase storage.
//   5. Upload via YouTube resumable upload API.
//   6. On success: save youtube_video_id + URL, mark published.
//   7. On failure: mark failed with sanitized error.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { decryptToken, encryptToken } from "../shared/social-token.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_HEX   = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY")!;
const CLIENT_ID     = (Deno.env.get("YOUTUBE_CLIENT_ID") ?? "").trim();
const CLIENT_SECRET = (Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "").trim();

/* ── CONSTANTS ────────────────────────────────────────────────────────────── */

const YT_UPLOAD_URL   = "https://www.googleapis.com/upload/youtube/v3/videos";
const YT_TOKEN_URL    = "https://oauth2.googleapis.com/token";
const MAX_TITLE       = 100;    // YouTube hard limit
const MAX_DESCRIPTION = 5000;

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string }> {
  const body = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type:    "refresh_token",
  });

  const res = await fetch(YT_TOKEN_URL, {
    method:  "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token in refresh response");

  const expiresAt = new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString();
  return { accessToken: data.access_token, expiresAt };
}

async function markFailed(sb: any, jobId: string, code: string, message: string): Promise<void> {
  await sb.from("youtube_publish_jobs").update({
    status:        "failed",
    error_code:    code,
    error_message: message,
    updated_at:    new Date().toISOString(),
  }).eq("id", jobId);
}

/* ── UPLOAD ──────────────────────────────────────────────────────────────── */

async function uploadToYouTube(
  sb:           any,
  jobId:        string,
  videoUrl:     string,
  title:        string,
  description:  string,
  privacyStatus: string,
  accessToken:  string,
): Promise<void> {
  // Mark uploading
  await sb.from("youtube_publish_jobs").update({
    status:     "uploading",
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);

  // ── Fetch video from storage ───────────────────────────────────────────────
  let videoBytes: ArrayBuffer;
  let contentType = "video/mp4";

  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Video fetch failed: ${videoRes.status}`);
    videoBytes  = await videoRes.arrayBuffer();
    contentType = videoRes.headers.get("content-type") || "video/mp4";
  } catch (e) {
    await markFailed(sb, jobId, "VIDEO_FETCH_FAILED", "Could not read your video. Please try again.");
    console.error("[yt-publish] Video fetch failed:", (e as Error).message);
    return;
  }

  // ── Step 1: Initiate resumable upload session ─────────────────────────────
  const metadata = {
    snippet: {
      title:       title.slice(0, MAX_TITLE),
      description: description.slice(0, MAX_DESCRIPTION),
      categoryId:  "22",   // People & Blogs
    },
    status: {
      privacyStatus,
      madeForKids: false,
    },
  };

  const initRes = await fetch(
    `${YT_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    {
      method:  "POST",
      headers: {
        Authorization:            `Bearer ${accessToken}`,
        "Content-Type":           "application/json",
        "X-Upload-Content-Type":  contentType,
        "X-Upload-Content-Length": String(videoBytes.byteLength),
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    console.error("[yt-publish] Upload init failed:", initRes.status, text.slice(0, 300));
    const msg = initRes.status === 401
      ? "YouTube connection has expired. Please reconnect."
      : "YouTube rejected this upload. Please try again.";
    await markFailed(sb, jobId, "UPLOAD_INIT_FAILED", msg);
    return;
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    await markFailed(sb, jobId, "NO_UPLOAD_URL", "YouTube did not return an upload URL. Please try again.");
    return;
  }

  // ── Step 2: Upload the video bytes ────────────────────────────────────────
  const uploadRes = await fetch(uploadUrl, {
    method:  "PUT",
    headers: {
      "Content-Type":   contentType,
      "Content-Length": String(videoBytes.byteLength),
    },
    body: videoBytes,
  });

  if (!uploadRes.ok && uploadRes.status !== 308) {
    const text = await uploadRes.text().catch(() => "");
    console.error("[yt-publish] Upload PUT failed:", uploadRes.status, text.slice(0, 300));
    await markFailed(sb, jobId, "UPLOAD_FAILED", "Video upload to YouTube failed. Please try again.");
    return;
  }

  const uploadData = await uploadRes.json().catch(() => ({}));
  const videoId    = String(uploadData.id ?? "");

  if (!videoId) {
    await markFailed(sb, jobId, "NO_VIDEO_ID", "YouTube returned an unexpected response. Please try again.");
    return;
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // ── Mark published ────────────────────────────────────────────────────────
  await sb.from("youtube_publish_jobs").update({
    status:          "published",
    youtube_video_id: videoId,
    youtube_url:      youtubeUrl,
    published_at:    new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  }).eq("id", jobId);
}

/* ── HANDLER ──────────────────────────────────────────────────────────────── */

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
    creation_id   = null,
    video_url:    directUrl = null,
    title:        rawTitle  = "",
    description:  rawDesc   = "",
    privacy_status = "public",
  } = body ?? {};

  if (!social_account_id || typeof social_account_id !== "string") {
    return err(req, "social_account_id required", 400);
  }
  if (!creation_id && !directUrl) {
    return err(req, "creation_id or video_url required", 400);
  }
  if (!rawTitle || typeof rawTitle !== "string" || !rawTitle.trim()) {
    return err(req, "title is required for YouTube uploads", 400);
  }
  if (!["public", "unlisted", "private"].includes(privacy_status)) {
    return err(req, "Invalid privacy_status. Must be public, unlisted, or private.", 400);
  }

  const title       = rawTitle.trim().slice(0, MAX_TITLE);
  const description = String(rawDesc ?? "").trim().slice(0, MAX_DESCRIPTION);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Verify ownership: YouTube account ────────────────────────────────────
  const { data: account } = await sb
    .from("social_accounts")
    .select("id, user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, revoked_at")
    .eq("id", social_account_id)
    .eq("user_id", user.id)
    .eq("platform", "youtube")
    .is("revoked_at", null)
    .maybeSingle();

  if (!account) {
    return err(req, "YouTube account not connected. Please reconnect and try again.", 400);
  }
  if (!account.access_token_encrypted) {
    return err(req, "YouTube account credentials are invalid. Please reconnect.", 400);
  }

  // ── Resolve video URL ─────────────────────────────────────────────────────
  let videoUrl: string;

  if (creation_id) {
    const { data: job } = await sb
      .from("jobs")
      .select("id, user_id, result_url")
      .eq("id", creation_id)
      .eq("user_id", user.id)
      .eq("status", "succeeded")
      .maybeSingle();

    if (!job)            return err(req, "Video not found", 404);
    if (!job.result_url) return err(req, "This video is not ready to publish yet", 400);
    videoUrl = job.result_url as string;
  } else {
    videoUrl = String(directUrl).trim();
  }

  // Validate video URL belongs to Zyvo storage
  if (!videoUrl.startsWith(SUPABASE_URL + "/storage/v1/object/")) {
    return err(req, "Invalid video source", 400);
  }

  // ── Idempotency ───────────────────────────────────────────────────────────
  const minuteBucket = Math.floor(Date.now() / 1000 / 60);
  const idemKey      = await sha256Hex(
    `yt:${user.id}:${creation_id ?? videoUrl}:${social_account_id}:${minuteBucket}`,
  );

  const { data: existing } = await sb
    .from("youtube_publish_jobs")
    .select("id, status")
    .eq("idempotency_key", idemKey)
    .maybeSingle();

  if (existing) {
    return ok(req, { job_id: existing.id, status: existing.status, duplicate: true }, 202);
  }

  // ── Decrypt + refresh token if needed ────────────────────────────────────
  let accessToken: string;

  try {
    accessToken = await decryptToken(account.access_token_encrypted, ENC_KEY_HEX);
  } catch (e) {
    console.error("[yt-publish] Token decryption failed:", (e as Error).message);
    return err(req, "Failed to read credentials. Please reconnect your YouTube account.", 500);
  }

  // Refresh if expired or expiring within 60 seconds
  const isExpired = account.token_expires_at &&
    new Date(account.token_expires_at).getTime() < Date.now() + 60_000;

  if (isExpired && account.refresh_token_encrypted) {
    try {
      const refreshToken = await decryptToken(account.refresh_token_encrypted, ENC_KEY_HEX);
      const refreshed    = await refreshAccessToken(refreshToken);
      accessToken        = refreshed.accessToken;

      // Persist the new access token
      const newEncrypted = await encryptToken(refreshed.accessToken, ENC_KEY_HEX);
      await sb.from("social_accounts").update({
        access_token_encrypted: newEncrypted,
        token_expires_at:       refreshed.expiresAt,
        updated_at:             new Date().toISOString(),
      }).eq("id", account.id);
    } catch (e) {
      console.error("[yt-publish] Token refresh failed:", (e as Error).message);
      return err(req, "YouTube connection has expired. Please reconnect your account.", 401);
    }
  }

  // ── Write youtube_publish_jobs row ────────────────────────────────────────
  const { data: jobRow, error: jobErr } = await sb
    .from("youtube_publish_jobs")
    .insert({
      user_id:           user.id,
      social_account_id: account.id,
      creation_id:       creation_id ?? null,
      video_url:         videoUrl,
      title,
      description,
      privacy_status,
      status:            "queued",
      idempotency_key:   idemKey,
    })
    .select("id")
    .single();

  if (jobErr || !jobRow) {
    console.error("[yt-publish] Job insert failed:", jobErr?.message);
    return err(req, "Failed to record publish job", 500);
  }

  // ── Upload in background ──────────────────────────────────────────────────
  EdgeRuntime.waitUntil(
    uploadToYouTube(sb, jobRow.id, videoUrl, title, description, privacy_status, accessToken),
  );

  return ok(req, { job_id: jobRow.id, status: "uploading" }, 202);
});
