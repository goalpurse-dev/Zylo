// supabase/functions/tiktok-publish-video/index.ts
// Two-phase endpoint for TikTok's Content Posting API:
//
//   Phase 1 — { social_account_id, mode: "options" }
//     Queries TikTok's creator_info endpoint and returns the creator's
//     ACTUAL allowed posting options (privacy levels, duet/stitch/comment
//     toggles, max duration). The frontend must render these — never
//     hardcode privacy options.
//
//   Phase 2 — { social_account_id, creation_id | video_url, title, privacy_level, ... }
//     Re-validates the requested options against a fresh creator_info call
//     (never trusts the frontend's copy), then initializes either:
//       - Direct Post  (/v2/post/publish/video/init/)       — feature-flagged,
//         only used when TIKTOK_DIRECT_POST_ENABLED is set AND publish_mode
//         is "direct". Unaudited apps are restricted by TikTok to private-only
//         visibility regardless.
//       - Draft/Inbox  (/v2/post/publish/inbox/video/init/)  — default. Sends
//         the video to the creator's TikTok inbox; they finish posting in the
//         TikTok app itself.
//     Uses PULL_FROM_URL (the video must already be a public HTTPS Supabase
//     Storage URL — same SSRF guard used by instagram-publish-reel /
//     youtube-publish-video). FILE_UPLOAD is not implemented.
//
// Never exposes access tokens or raw TikTok error payloads to the caller.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { getTTAccount, getAccessToken } from "../shared/tiktok-token.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Direct Post is restricted for unaudited apps and requires TikTok's app
// review before it's safe to expose broadly. Default OFF — draft/inbox mode
// always works regardless of this flag.
const DIRECT_POST_ENABLED = ["1", "true", "yes"].includes(
  (Deno.env.get("TIKTOK_DIRECT_POST_ENABLED") ?? "").trim().toLowerCase(),
);

/* ── TIKTOK API ──────────────────────────────────────────────────────────── */

const TT_CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const TT_DIRECT_INIT_URL  = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const TT_INBOX_INIT_URL   = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const TT_STATUS_URL       = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const MAX_TITLE = 2200;

const PRIVACY_LEVELS = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
];

// TikTok's documented error codes for /video/init and /inbox/video/init,
// mapped to safe, actionable messages — the raw TikTok error is only logged.
const ERROR_MESSAGES: Record<string, string> = {
  spam_risk_too_many_posts:            "TikTok is rate-limiting this account right now. Try again later.",
  spam_risk_user_banned_from_posting:  "This TikTok account is currently restricted from posting by TikTok.",
  reached_active_user_cap:             "TikTok's app-wide posting limit was reached. Try again later.",
  unaudited_client_can_only_post_to_private_accounts:
    "This app hasn't completed TikTok's review yet, so posts can only be sent as private/draft.",
  url_ownership_unverified:            "Zyvo's video domain isn't verified with TikTok yet. Please try Draft mode instead.",
  privacy_level_option_mismatch:       "That privacy option isn't available for this TikTok account.",
  access_token_invalid:                "TikTok connection has expired. Please reconnect your account.",
  scope_not_authorized:                "TikTok didn't grant posting permission for this account. Please reconnect.",
  rate_limit_exceeded:                 "Too many requests to TikTok right now. Try again in a minute.",
  invalid_param:                       "TikTok rejected this post's settings. Please try again.",
};

function safeTtMessage(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return ERROR_MESSAGES[code] ?? fallback;
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Queries TikTok's creator_info endpoint. Never throws raw TikTok errors —
 *  callers get a safe message string on failure. */
async function fetchCreatorInfo(accessToken: string): Promise<{ info: any; error: string | null }> {
  try {
    const res = await fetch(TT_CREATOR_INFO_URL, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || (json?.error?.code && json.error.code !== "ok")) {
      console.error("[tt-publish] creator_info failed:", res.status, json?.error?.code, json?.error?.message);
      return { info: null, error: safeTtMessage(json?.error?.code, "Could not load your TikTok posting options.") };
    }
    return { info: json?.data ?? {}, error: null };
  } catch (e) {
    console.error("[tt-publish] creator_info exception:", (e as Error).message);
    return { info: null, error: "Could not reach TikTok. Please try again." };
  }
}

async function markJob(sb: any, jobId: string, patch: Record<string, unknown>): Promise<void> {
  await sb.from("tiktok_publish_jobs").update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
}

/** Bounded background poll — mirrors the Instagram publish-reel pattern.
 *  Anything still non-terminal after this falls back to tiktok-publish-status
 *  being re-checked live by the frontend. */
async function pollUntilDone(
  sb: any,
  jobId: string,
  accessToken: string,
  publishId: string,
  isDraftMode: boolean,
): Promise<void> {
  const MAX_ATTEMPTS = 20;
  const DELAY_MS     = 6000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, DELAY_MS));

    try {
      const res = await fetch(TT_STATUS_URL, {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ publish_id: publishId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn("[tt-publish] status poll non-ok:", res.status);
        continue;
      }

      const status = String(json?.data?.status ?? "").toUpperCase();
      const failReason = json?.data?.fail_reason ?? null;

      if (status.includes("FAIL")) {
        await markJob(sb, jobId, {
          status:        "failed",
          error_code:    "TIKTOK_PROCESSING_FAILED",
          error_message: "TikTok couldn't process this video. Please try again.",
        });
        if (failReason) console.error("[tt-publish] TikTok fail_reason:", failReason);
        return;
      }

      if (status.includes("COMPLETE") || status.includes("SUCCESS")) {
        const postId = json?.data?.publicaly_available_post_id?.[0] ?? json?.data?.publish_id ?? null;
        await markJob(sb, jobId, {
          status:           isDraftMode ? "draft_created" : "published",
          tiktok_post_id:   postId,
          published_at:     new Date().toISOString(),
        });
        return;
      }

      // Still in flight — reflect coarse progress without over-specifying
      // TikTok's exact (and not fully documented) intermediate status names.
      await markJob(sb, jobId, { status: "processing" });
    } catch (e) {
      console.warn("[tt-publish] status poll exception:", (e as Error).message);
    }
  }
  // Timed out client-side — leave as "processing"; tiktok-publish-status
  // will re-check live the next time the frontend polls.
}

async function runPublish(
  sb: any,
  jobId: string,
  accessToken: string,
  videoUrl: string,
  useDirect: boolean,
  postInfo: Record<string, unknown>,
): Promise<void> {
  await markJob(sb, jobId, { status: "preparing" });

  const initUrl = useDirect ? TT_DIRECT_INIT_URL : TT_INBOX_INIT_URL;
  const requestBody = useDirect
    ? { post_info: postInfo, source_info: { source: "PULL_FROM_URL", video_url: videoUrl } }
    : { source_info: { source: "PULL_FROM_URL", video_url: videoUrl } };

  let publishId: string;
  try {
    const res = await fetch(initUrl, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(requestBody),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || (json?.error?.code && json.error.code !== "ok")) {
      console.error("[tt-publish] init failed:", res.status, json?.error?.code, json?.error?.message);
      await markJob(sb, jobId, {
        status:        "failed",
        error_code:    json?.error?.code ?? "INIT_FAILED",
        error_message: safeTtMessage(json?.error?.code, "TikTok rejected this upload. Please try again."),
      });
      return;
    }

    publishId = json?.data?.publish_id;
    if (!publishId) {
      await markJob(sb, jobId, {
        status:        "failed",
        error_code:    "NO_PUBLISH_ID",
        error_message: "TikTok didn't return a publish ID. Please try again.",
      });
      return;
    }
  } catch (e) {
    console.error("[tt-publish] init exception:", (e as Error).message);
    await markJob(sb, jobId, {
      status:        "failed",
      error_code:    "INIT_EXCEPTION",
      error_message: "Could not reach TikTok. Please try again.",
    });
    return;
  }

  await markJob(sb, jobId, { status: "uploading", tiktok_publish_id: publishId });
  await pollUntilDone(sb, jobId, accessToken, publishId, !useDirect);
}

/* ── HANDLER ──────────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (authError || !user) return err(req, "Unauthorized", 401);

  let body: any = {};
  try { body = await req.json(); } catch { return err(req, "Invalid JSON", 400); }

  const { social_account_id, mode } = body ?? {};
  if (!social_account_id || typeof social_account_id !== "string") {
    return err(req, "social_account_id required", 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Ownership + token ──────────────────────────────────────────────────────
  const { account, error: acctErr } = await getTTAccount(user.id, social_account_id);
  if (acctErr || !account) {
    return err(req, "TikTok account not connected. Please reconnect and try again.", 400);
  }

  const { accessToken, error: tokenErr } = await getAccessToken(account);
  if (tokenErr || !accessToken) {
    return err(req, tokenErr ?? "Failed to read TikTok credentials. Please reconnect.", 401);
  }

  // ── Phase 1: options-only query (render creator_info in the UI) ──────────
  if (mode === "options") {
    const { info, error: infoErr } = await fetchCreatorInfo(accessToken);
    if (infoErr) return err(req, infoErr, 502);

    return ok(req, {
      creator: {
        username:      info?.creator_username ?? account.username ?? null,
        nickname:      info?.creator_nickname ?? account.display_name ?? null,
        avatar_url:    info?.creator_avatar_url ?? account.avatar_url ?? null,
      },
      privacy_level_options:      info?.privacy_level_options ?? [],
      comment_disabled:           !!info?.comment_disabled,
      duet_disabled:              !!info?.duet_disabled,
      stitch_disabled:            !!info?.stitch_disabled,
      max_video_post_duration_sec: info?.max_video_post_duration_sec ?? null,
      direct_post_enabled:        DIRECT_POST_ENABLED,
    });
  }

  // ── Phase 2: actually publish ─────────────────────────────────────────────
  const {
    creation_id    = null,
    video_url:     directUrl = null,
    title:         rawTitle  = "",
    privacy_level: rawPrivacy = "SELF_ONLY",
    disable_comment  = false,
    disable_duet     = false,
    disable_stitch   = false,
    is_branded_content = false,
    is_organic_branded = false,
    publish_mode: requestedMode = "draft",
  } = body ?? {};

  if (!creation_id && !directUrl) {
    return err(req, "creation_id or video_url required", 400);
  }

  const useDirect = requestedMode === "direct" && DIRECT_POST_ENABLED;

  // Re-validate options against a FRESH creator_info call — never trust the
  // client's copy of privacy_level_options/disabled flags.
  const { info: creatorInfo, error: infoErr } = await fetchCreatorInfo(accessToken);
  if (infoErr) return err(req, infoErr, 502);

  const allowedPrivacyLevels: string[] = creatorInfo?.privacy_level_options ?? [];

  if (useDirect) {
    if (!allowedPrivacyLevels.length) {
      return err(req, "TikTok didn't return any allowed privacy options for this account.", 502);
    }
    if (!PRIVACY_LEVELS.includes(rawPrivacy) || !allowedPrivacyLevels.includes(rawPrivacy)) {
      return err(req, "Invalid or unavailable privacy_level for this TikTok account.", 400);
    }
  }

  const title = String(rawTitle ?? "").trim().slice(0, MAX_TITLE);

  // ── Resolve + validate video URL (same SSRF guard as IG/YT) ───────────────
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

  if (!videoUrl.startsWith(SUPABASE_URL + "/storage/v1/object/")) {
    return err(req, "Invalid video source", 400);
  }

  // ── Idempotency ────────────────────────────────────────────────────────────
  const minuteBucket = Math.floor(Date.now() / 1000 / 60);
  const idemKey = await sha256Hex(
    `tt:${user.id}:${creation_id ?? videoUrl}:${social_account_id}:${minuteBucket}`,
  );

  const { data: existing } = await sb
    .from("tiktok_publish_jobs")
    .select("id, status")
    .eq("idempotency_key", idemKey)
    .maybeSingle();

  if (existing) {
    return ok(req, { job_id: existing.id, status: existing.status, duplicate: true }, 202);
  }

  // Force-disable duet/stitch/comment if the creator's account already has
  // them disabled — TikTok would reject the mismatch otherwise.
  const finalDisableComment = disable_comment || !!creatorInfo?.comment_disabled;
  const finalDisableDuet    = disable_duet    || !!creatorInfo?.duet_disabled;
  const finalDisableStitch  = disable_stitch  || !!creatorInfo?.stitch_disabled;

  const { data: jobRow, error: jobErr } = await sb
    .from("tiktok_publish_jobs")
    .insert({
      user_id:            user.id,
      social_account_id:  account.id,
      creation_id:        creation_id ?? null,
      video_url:          videoUrl,
      publish_mode:       useDirect ? "direct" : "draft",
      title,
      privacy_level:      useDirect ? rawPrivacy : null,
      disable_comment:    finalDisableComment,
      disable_duet:       finalDisableDuet,
      disable_stitch:     finalDisableStitch,
      is_commercial:      !!is_branded_content || !!is_organic_branded,
      is_branded_content: !!is_branded_content,
      status:             "queued",
      idempotency_key:    idemKey,
    })
    .select("id")
    .single();

  if (jobErr || !jobRow) {
    console.error("[tt-publish] Job insert failed:", jobErr?.message);
    return err(req, "Failed to record publish job", 500);
  }

  const postInfo = {
    title,
    privacy_level:   rawPrivacy,
    disable_comment: finalDisableComment,
    disable_duet:    finalDisableDuet,
    disable_stitch:  finalDisableStitch,
    brand_content_toggle: !!is_branded_content,
    brand_organic_toggle: !!is_organic_branded,
  };

  EdgeRuntime.waitUntil(runPublish(sb, jobRow.id, accessToken, videoUrl, useDirect, postInfo));

  return ok(req, {
    job_id:       jobRow.id,
    status:       "queued",
    publish_mode: useDirect ? "direct" : "draft",
  }, 202);
});
