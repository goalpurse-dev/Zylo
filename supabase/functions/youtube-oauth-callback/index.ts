// supabase/functions/youtube-oauth-callback/index.ts
// Handles the OAuth redirect from Google after the user grants YouTube access.
// JWT verification is disabled — deploy with: supabase functions deploy youtube-oauth-callback --no-verify-jwt
//
// Flow:
//   1. Read code + state from query params.
//   2. Hash state and validate against social_oauth_states (one-time, expiry, platform).
//   3. Atomically mark state as used; read return_to_origin for the redirect.
//   4. Exchange code for Google tokens (access_token + refresh_token).
//   5. Fetch the user's YouTube channel info with detailed debug logging.
//   6. Encrypt both tokens with AES-256-GCM.
//   7. Upsert social_accounts row.
//   8. Redirect to {origin}/workspace/publish?yt_connect=success or error.
//
// Tokens never appear in any URL, log line, or response body.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../shared/social-token.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID     = (Deno.env.get("YOUTUBE_CLIENT_ID") ?? "").trim();
const CLIENT_SECRET = (Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "").trim();
const REDIRECT_URI  = (Deno.env.get("YOUTUBE_REDIRECT_URI") ?? "").trim();
const ENC_KEY_HEX   = (Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY") ?? "").trim();
const APP_ORIGIN    = (Deno.env.get("APP_ORIGIN") ?? "https://www.tryzyvo.com").trim();

/* ── CONSTANTS ────────────────────────────────────────────────────────────── */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YT_CHANNELS_URL  = "https://www.googleapis.com/youtube/v3/channels";

const ALLOWED_ORIGINS = new Set([
  "https://www.tryzyvo.com",
  "http://localhost:5173",
]);

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeOrigin(stored: string | null): string {
  if (stored && ALLOWED_ORIGINS.has(stored)) return stored;
  return APP_ORIGIN;
}

function redirect(origin: string, path: string): Response {
  const safePath = path.startsWith("/") ? path : "/" + path;
  return Response.redirect(`${origin}${safePath}`, 302);
}

function errorRedirect(origin: string, reason: string): Response {
  return redirect(origin, `/workspace/publish?yt_connect=error&reason=${reason}`);
}

/* ── HANDLER ──────────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !ENC_KEY_HEX) {
    console.error("[yt-callback] Missing YouTube OAuth secrets");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const url         = new URL(req.url);
  const code        = url.searchParams.get("code");
  const rawState    = url.searchParams.get("state");
  const providerErr = url.searchParams.get("error");

  // Use APP_ORIGIN as fallback until we can read state row
  let returnOrigin = APP_ORIGIN;

  if (providerErr) {
    const reason = providerErr === "access_denied" ? "access_denied" : "provider_error";
    return errorRedirect(returnOrigin, reason);
  }

  if (!code || !rawState) {
    return errorRedirect(returnOrigin, "invalid_callback");
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── 1. Validate state ─────────────────────────────────────────────────────
  const stateHash = await sha256Hex(rawState);

  const { data: stateRow, error: stateErr } = await sb
    .from("social_oauth_states")
    .select("id, user_id, expires_at, used_at, return_to_origin")
    .eq("state_hash", stateHash)
    .eq("platform", "youtube")
    .maybeSingle();

  if (stateErr || !stateRow) {
    console.error("[yt-callback] State lookup failed:", stateErr?.message ?? "not found");
    return errorRedirect(returnOrigin, "invalid_state");
  }

  // Use stored origin from now on
  returnOrigin = safeOrigin(stateRow.return_to_origin);

  if (new Date(stateRow.expires_at) < new Date()) {
    return errorRedirect(returnOrigin, "expired_state");
  }
  if (stateRow.used_at !== null) {
    return errorRedirect(returnOrigin, "state_already_used");
  }

  // ── 2. Atomically mark state as used ─────────────────────────────────────
  const { data: consumed } = await sb
    .from("social_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("id", stateRow.id)
    .is("used_at", null)
    .select("id");

  if (!consumed?.length) {
    return errorRedirect(returnOrigin, "state_already_used");
  }

  const userId = stateRow.user_id;

  // ── 3. Exchange code for Google tokens ───────────────────────────────────
  // deno-lint-ignore no-explicit-any
  let tokenData:    any;
  let accessToken:  string;
  let refreshToken: string | null = null;
  let expiresAt:    string | null = null;

  try {
    const body = new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    "authorization_code",
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method:  "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[yt-callback] Token exchange failed — status:", res.status, "body:", text.slice(0, 300));
      return errorRedirect(returnOrigin, "token_exchange_failed");
    }

    tokenData    = await res.json();
    accessToken  = tokenData.access_token;
    refreshToken = tokenData.refresh_token ?? null;

    if (!accessToken) {
      console.error("[yt-callback] Token exchange: no access_token in response");
      return errorRedirect(returnOrigin, "token_exchange_failed");
    }

    // Log granted scopes (safe — no secrets)
    console.log("[yt-callback] Token exchange OK — granted scopes:", tokenData.scope ?? "(none returned)");
    console.log("[yt-callback] Has refresh_token:", !!refreshToken);
    console.log("[yt-callback] Has yt-analytics scope:", String(tokenData.scope ?? "").includes("yt-analytics"));

    if (tokenData.expires_in) {
      expiresAt = new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString();
    }
  } catch (e) {
    console.error("[yt-callback] Token exchange exception:", (e as Error).message);
    return errorRedirect(returnOrigin, "token_exchange_failed");
  }

  // ── 4. Fetch YouTube channel info ─────────────────────────────────────────
  let channelId:    string;
  let channelTitle: string | null = null;
  let avatarUrl:    string | null = null;
  // deno-lint-ignore no-explicit-any
  let channelSnippet: any = {};

  try {
    const res = await fetch(
      `${YT_CHANNELS_URL}?part=snippet&mine=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    console.log("[yt-callback] Channel fetch status:", res.status);

    if (!res.ok) {
      // deno-lint-ignore no-explicit-any
      let errBody: any = {};
      try { errBody = await res.json(); } catch { /* ignore */ }

      const apiErr = errBody?.error;
      console.error(
        "[yt-callback] Channel fetch failed —",
        "status:", res.status,
        "code:", apiErr?.code,
        "message:", apiErr?.message,
        "errors:", JSON.stringify(apiErr?.errors ?? []),
      );

      if (res.status === 401) {
        console.error(
          "[yt-callback] 401 hint: check that both scopes were granted,",
          "and that the YouTube Data API v3 is enabled in the same Google Cloud project.",
        );
        return errorRedirect(returnOrigin, "token_exchange_failed");
      }

      if (res.status === 403) {
        console.error(
          "[yt-callback] 403 hint: YouTube Data API v3 may not be enabled,",
          "or the OAuth client may not have the youtube.readonly scope.",
          "Enable it at: https://console.developers.google.com/apis/api/youtube.googleapis.com",
        );
      }

      return errorRedirect(returnOrigin, "profile_fetch_failed");
    }

    const data  = await res.json();
    const items = data.items ?? [];

    console.log("[yt-callback] Channel items count:", items.length);

    if (items.length === 0) {
      console.error(
        "[yt-callback] Google account has no YouTube channel.",
        "The user needs to create a channel at youtube.com before connecting.",
      );
      return errorRedirect(returnOrigin, "no_channel_found");
    }

    const channel = items[0];
    channelId      = channel.id;
    channelSnippet = channel.snippet ?? {};
    channelTitle   = channelSnippet.title ?? null;
    avatarUrl      =
      channelSnippet.thumbnails?.high?.url ??
      channelSnippet.thumbnails?.default?.url ??
      null;

    console.log("[yt-callback] Channel found — id:", channelId, "title:", channelTitle);
  } catch (e) {
    console.error("[yt-callback] Channel fetch exception:", (e as Error).message);
    return errorRedirect(returnOrigin, "profile_fetch_failed");
  }

  // ── 5. Encrypt tokens ─────────────────────────────────────────────────────
  let encryptedAccess:  string;
  let encryptedRefresh: string;

  try {
    encryptedAccess  = await encryptToken(accessToken, ENC_KEY_HEX);
    encryptedRefresh = refreshToken
      ? await encryptToken(refreshToken, ENC_KEY_HEX)
      : "";
  } catch (e) {
    console.error("[yt-callback] Token encryption failed:", (e as Error).message);
    return errorRedirect(returnOrigin, "internal_error");
  }

  // ── 6. Upsert social_accounts ─────────────────────────────────────────────
  // Google only returns a refresh_token on the first authorization or after
  // explicit revoke + reconnect. If we don't get one, preserve whatever is
  // already stored rather than overwriting it with null/empty.
  const now = new Date().toISOString();

  // Parse scopes Google actually granted — never use a hardcoded list.
  const grantedScopes = String(tokenData.scope ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  console.log("[yt-callback] Storing scopes:", grantedScopes);

  // Check for an existing row so we can preserve its refresh token if needed.
  const { data: existingAccount } = await sb
    .from("social_accounts")
    .select("id, refresh_token_encrypted")
    .eq("user_id", userId)
    .eq("platform", "youtube")
    .eq("platform_user_id", channelId)
    .maybeSingle();

  const refreshTokenToStore = encryptedRefresh || existingAccount?.refresh_token_encrypted || null;

  const upsertPayload: Record<string, unknown> = {
    user_id:                userId,
    platform:               "youtube",
    platform_user_id:       channelId,
    username:               channelTitle,
    display_name:           channelTitle,
    avatar_url:             avatarUrl,
    access_token_encrypted: encryptedAccess,
    token_expires_at:       expiresAt,
    scopes:                 grantedScopes,
    metadata: {
      channel_id:    channelId,
      channel_title: channelTitle,
      country:       channelSnippet.country ?? null,
    },
    revoked_at:   null,
    connected_at: existingAccount ? undefined : now,
    updated_at:   now,
  };

  // Only write refresh_token_encrypted if we have something to write
  if (refreshTokenToStore !== null) {
    upsertPayload.refresh_token_encrypted = refreshTokenToStore;
  }

  // Remove undefined keys (connected_at on reconnect)
  for (const k of Object.keys(upsertPayload)) {
    if (upsertPayload[k] === undefined) delete upsertPayload[k];
  }

  console.log("[yt-callback] Upserting account — has refresh_token:", !!refreshTokenToStore);

  const { error: upsertErr } = await sb
    .from("social_accounts")
    .upsert(upsertPayload, { onConflict: "user_id,platform,platform_user_id" });

  if (upsertErr) {
    console.error("[yt-callback] Account upsert failed:", upsertErr.message);
    return errorRedirect(returnOrigin, "internal_error");
  }

  console.log("[yt-callback] YouTube account connected for user:", userId);
  return redirect(returnOrigin, "/workspace/publish?yt_connect=success");
});
