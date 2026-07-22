// supabase/functions/tiktok-oauth-callback/index.ts
// Handles the OAuth redirect from TikTok after the user grants access.
// JWT verification is disabled (config.toml: verify_jwt = false) because
// TikTok issues a browser redirect with no Authorization header.
// The user identity is recovered via the validated OAuth state row.
//
// Flow:
//   1. Read code + state from query params.
//   2. Hash the state and look up the matching row (validates user, expiry, one-use).
//   3. Atomically mark the state as used; decode the return path from the state.
//   4. Exchange the code for access_token + refresh_token (server-to-server POST).
//   5. Fetch the TikTok profile (open_id, username, display_name, avatar_url).
//   6. Encrypt both tokens with AES-256-GCM.
//   7. Upsert the social_accounts row.
//   8. Redirect the browser to the frontend with ?tt_connect=success/error.
//
// Tokens never appear in any redirect URL, log line, or response body.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../shared/social-token.ts";
import { TT_TOKEN_URL } from "../shared/tiktok-token.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_KEY    = (Deno.env.get("TIKTOK_CLIENT_KEY") ?? "").trim();
const CLIENT_SECRET = (Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "").trim();
const REDIRECT_URI  = (Deno.env.get("TIKTOK_REDIRECT_URI") ?? "").trim();
const ENC_KEY_HEX   = (Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY") ?? "").trim();
const APP_ORIGIN    = (Deno.env.get("APP_ORIGIN") ?? "").trim(); // e.g. https://www.tryzyvo.com

/* ── TIKTOK API ENDPOINTS ─────────────────────────────────────────────────── */

const TT_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function frontendRedirect(path: string): Response {
  const safePath = path.startsWith("/") ? path : "/" + path;
  return Response.redirect(`${APP_ORIGIN}${safePath}`, 302);
}

function withTtParams(path: string, status: "success" | "error", reason?: string): string {
  const safeBase = path === "/workspace/connections" ? path : "/workspace/publish";
  const params = new URLSearchParams({ tt_connect: status });
  if (reason) params.set("reason", reason);
  return `${safeBase}?${params.toString()}`;
}

function errorRedirect(reason: string, path = "/workspace/publish"): Response {
  return frontendRedirect(withTtParams(path, "error", reason));
}

function decodeReturnPath(rawState: string | null): string {
  const encoded = String(rawState ?? "").split(".")[1];
  if (!encoded) return "/workspace/publish";
  try {
    const padded = encoded.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const decoded = atob(padded);
    return decoded === "/workspace/connections" ? decoded : "/workspace/publish";
  } catch {
    return "/workspace/publish";
  }
}

/* ── HANDLER ──────────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  // TikTok sends a GET redirect — not a browser fetch/XHR
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url         = new URL(req.url);
  const code        = url.searchParams.get("code");
  const rawState    = url.searchParams.get("state");
  const returnPath  = decodeReturnPath(rawState);
  const providerErr = url.searchParams.get("error");

  if (!APP_ORIGIN) {
    console.error("[tt-callback] APP_ORIGIN secret is not set");
    return new Response("Server misconfiguration", { status: 500 });
  }
  if (!CLIENT_KEY || !CLIENT_SECRET || !REDIRECT_URI || !ENC_KEY_HEX) {
    console.error("[tt-callback] Missing TikTok OAuth/token secrets");
    return errorRedirect("oauth_not_configured", returnPath);
  }

  // TikTok returned an error (e.g. user tapped "Cancel")
  if (providerErr) {
    const reason = providerErr === "access_denied" ? "access_denied" : "provider_error";
    return errorRedirect(reason, returnPath);
  }

  if (!code || !rawState) {
    return errorRedirect("invalid_callback", returnPath);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── 1. Validate state ─────────────────────────────────────────────────────
  const stateHash = await sha256Hex(rawState);

  const { data: stateRow, error: stateErr } = await sb
    .from("social_oauth_states")
    .select("id, user_id, expires_at, used_at")
    .eq("state_hash", stateHash)
    .eq("platform", "tiktok")
    .maybeSingle();

  if (stateErr || !stateRow) {
    console.error("[tt-callback] State lookup failed:", stateErr?.message ?? "not found");
    return errorRedirect("invalid_state", returnPath);
  }

  if (new Date(stateRow.expires_at) < new Date()) {
    return errorRedirect("expired_state", returnPath);
  }
  if (stateRow.used_at !== null) {
    return errorRedirect("state_already_used", returnPath);
  }

  // ── 2. Atomically mark state as used ─────────────────────────────────────
  const { data: consumed } = await sb
    .from("social_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("id", stateRow.id)
    .is("used_at", null)
    .select("id");

  if (!consumed?.length) {
    return errorRedirect("state_already_used", returnPath);
  }

  const userId = stateRow.user_id;

  // ── 3. Exchange code for TikTok tokens ────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  let tokenData: any;
  let accessToken:  string;
  let refreshToken: string | null = null;
  let expiresAt:        string | null = null;
  let refreshExpiresAt: string | null = null;

  try {
    const body = new URLSearchParams({
      client_key:    CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type:    "authorization_code",
      redirect_uri:  REDIRECT_URI,
    });

    const res = await fetch(TT_TOKEN_URL, {
      method:  "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "cache-control": "no-cache" },
      body:    body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[tt-callback] Token exchange failed:", res.status, text.slice(0, 300));
      return errorRedirect("token_exchange_failed", returnPath);
    }

    tokenData    = await res.json();
    accessToken  = tokenData.access_token;
    refreshToken = tokenData.refresh_token ?? null;

    if (!accessToken || !refreshToken) {
      console.error("[tt-callback] Token exchange: missing access_token/refresh_token in response");
      return errorRedirect("token_exchange_failed", returnPath);
    }

    console.log("[tt-callback] Token exchange OK — granted scope:", tokenData.scope ?? "(none returned)");

    if (tokenData.expires_in) {
      expiresAt = new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString();
    }
    if (tokenData.refresh_expires_in) {
      refreshExpiresAt = new Date(Date.now() + Number(tokenData.refresh_expires_in) * 1000).toISOString();
    }
  } catch (e) {
    console.error("[tt-callback] Token exchange exception:", (e as Error).message);
    return errorRedirect("token_exchange_failed", returnPath);
  }

  // ── 4. Fetch TikTok profile ────────────────────────────────────────────────
  let openId:      string;
  let username:    string | null = null;
  let displayName: string | null = null;
  let avatarUrl:   string | null = null;

  try {
    const params = new URLSearchParams({
      fields: "open_id,union_id,avatar_url,display_name,username",
    });

    const res = await fetch(`${TT_USER_INFO_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[tt-callback] Profile fetch failed:", res.status, text.slice(0, 200));
      return errorRedirect("profile_fetch_failed", returnPath);
    }

    const json    = await res.json();
    const profile = json?.data?.user ?? {};
    openId      = String(profile.open_id ?? "");
    username    = profile.username     ?? null;
    displayName = profile.display_name ?? null;
    avatarUrl   = profile.avatar_url   ?? null;

    if (!openId) throw new Error("Profile response missing open_id");
  } catch (e) {
    console.error("[tt-callback] Profile fetch exception:", (e as Error).message);
    return errorRedirect("profile_fetch_failed", returnPath);
  }

  // ── 5. Encrypt tokens (AES-256-GCM, random IV) ────────────────────────────
  let encryptedAccess:  string;
  let encryptedRefresh: string;

  try {
    encryptedAccess  = await encryptToken(accessToken, ENC_KEY_HEX);
    encryptedRefresh = await encryptToken(refreshToken, ENC_KEY_HEX);
  } catch (e) {
    console.error("[tt-callback] Token encryption failed:", (e as Error).message);
    return errorRedirect("internal_error", returnPath);
  }

  // Parse scopes TikTok actually granted — never use a hardcoded list.
  const grantedScopes = String(tokenData.scope ?? "")
    .split(/[\s,]+/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  // ── 6. Upsert social_accounts row ─────────────────────────────────────────
  const { error: upsertErr } = await sb
    .from("social_accounts")
    .upsert(
      {
        user_id:                  userId,
        platform:                 "tiktok",
        platform_user_id:         openId,
        username,
        display_name:             displayName ?? username,
        avatar_url:               avatarUrl,
        access_token_encrypted:   encryptedAccess,
        refresh_token_encrypted:  encryptedRefresh,
        token_expires_at:         expiresAt,
        refresh_token_expires_at: refreshExpiresAt,
        scopes:                   grantedScopes,
        metadata:                 {},
        revoked_at:               null,
        connected_at:             new Date().toISOString(),
        updated_at:               new Date().toISOString(),
      },
      { onConflict: "user_id,platform,platform_user_id" },
    );

  if (upsertErr) {
    console.error("[tt-callback] Account upsert failed:", upsertErr.message);
    return errorRedirect("internal_error", returnPath);
  }

  console.log("[tt-callback] TikTok account connected for user:", userId);
  return frontendRedirect(withTtParams(returnPath, "success"));
});
