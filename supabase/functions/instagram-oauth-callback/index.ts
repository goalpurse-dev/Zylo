// supabase/functions/instagram-oauth-callback/index.ts
// Handles the OAuth redirect from Meta after the user grants access.
// JWT verification is disabled (config.toml: verify_jwt = false) because
// Meta issues a browser redirect with no Authorization header.
// The user identity is recovered via the validated OAuth state row.
//
// Flow:
//   1. Read code + state from query params.
//   2. Hash the state and look up the matching row (validates user, expiry, one-use).
//   3. Atomically mark the state as used.
//   4. Exchange the code for a short-lived token (server-to-server POST to Meta).
//   5. Exchange for a long-lived token (60-day).
//   6. Fetch the Instagram profile (id, username, name, profile_picture_url).
//   7. Encrypt the long-lived token with AES-256-GCM.
//   8. Upsert the social_accounts row.
//   9. Redirect the browser to the frontend with ?ig_connect=success/error.
//
// The access token never appears in any redirect URL, log line, or response body.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../shared/social-token.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_ID        = Deno.env.get("INSTAGRAM_APP_ID")!;
const APP_SECRET    = Deno.env.get("INSTAGRAM_APP_SECRET")!;
const REDIRECT_URI  = Deno.env.get("INSTAGRAM_REDIRECT_URI")!;
const ENC_KEY_HEX   = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY")!;
const APP_ORIGIN    = Deno.env.get("APP_ORIGIN")!; // e.g. https://zyvo.ai

/* ── INSTAGRAM API ENDPOINTS ─────────────────────────────────────────────── */

const IG_TOKEN_URL     = "https://api.instagram.com/oauth/access_token";
const IG_LONGLIVED_URL = "https://graph.instagram.com/access_token";
const IG_GRAPH_BASE    = "https://graph.instagram.com";

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Redirect back to the frontend social accounts page. Only allows paths
 *  under APP_ORIGIN — no open redirect possible. */
function frontendRedirect(path: string): Response {
  // Validate APP_ORIGIN is set and path starts with /
  const safePath = path.startsWith("/") ? path : "/" + path;
  return Response.redirect(`${APP_ORIGIN}${safePath}`, 302);
}

function errorRedirect(reason: string): Response {
  return frontendRedirect(`/workspace/publish?ig_connect=error&reason=${encodeURIComponent(reason)}`);
}

/* ── HANDLER ──────────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  // Instagram sends a GET redirect — not a browser fetch/XHR
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!APP_ORIGIN) {
    console.error("[ig-callback] APP_ORIGIN secret is not set");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const url          = new URL(req.url);
  const code         = url.searchParams.get("code");
  const rawState     = url.searchParams.get("state");
  const providerErr  = url.searchParams.get("error");
  const errReason    = url.searchParams.get("error_reason");

  // Meta returned an error (e.g. user clicked "Cancel")
  if (providerErr) {
    const reason = errReason === "user_denied" ? "access_denied" : "provider_error";
    return errorRedirect(reason);
  }

  if (!code || !rawState) {
    return errorRedirect("invalid_callback");
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── 1. Validate state ─────────────────────────────────────────────────────
  const stateHash = await sha256Hex(rawState);

  const { data: stateRow, error: stateErr } = await sb
    .from("social_oauth_states")
    .select("id, user_id, expires_at, used_at")
    .eq("state_hash", stateHash)
    .eq("platform", "instagram")
    .maybeSingle();

  if (stateErr || !stateRow) {
    console.error("[ig-callback] State lookup failed:", stateErr?.message ?? "not found");
    return errorRedirect("invalid_state");
  }

  if (new Date(stateRow.expires_at) < new Date()) {
    return errorRedirect("expired_state");
  }

  if (stateRow.used_at !== null) {
    return errorRedirect("state_already_used");
  }

  // ── 2. Atomically mark state as used ─────────────────────────────────────
  // The WHERE used_at IS NULL ensures exactly-once semantics even under
  // concurrent duplicate callbacks.
  const { data: consumed } = await sb
    .from("social_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("id", stateRow.id)
    .is("used_at", null)
    .select("id");

  if (!consumed?.length) {
    // Another request already consumed this state
    return errorRedirect("state_already_used");
  }

  const userId = stateRow.user_id;

  // ── 3. Exchange code for short-lived access token ─────────────────────────
  let shortToken: string;
  try {
    const body = new URLSearchParams({
      client_id:     APP_ID,
      client_secret: APP_SECRET,
      grant_type:    "authorization_code",
      redirect_uri:  REDIRECT_URI,
      code,
    });

    const res = await fetch(IG_TOKEN_URL, {
      method:  "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[ig-callback] Token exchange failed:", res.status, text.slice(0, 200));
      return errorRedirect("token_exchange_failed");
    }

    const data = await res.json();
    shortToken = data.access_token;
    if (!shortToken) throw new Error("No access_token in token response");
  } catch (e) {
    console.error("[ig-callback] Token exchange exception:", (e as Error).message);
    return errorRedirect("token_exchange_failed");
  }

  // ── 4. Exchange for long-lived token (60 days) ────────────────────────────
  let longToken  = shortToken;
  let expiresAt: string | null = null;

  try {
    const params = new URLSearchParams({
      grant_type:    "ig_exchange_token",
      client_secret: APP_SECRET,
      access_token:  shortToken,
    });

    const res = await fetch(`${IG_LONGLIVED_URL}?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        longToken = data.access_token;
        if (data.expires_in) {
          expiresAt = new Date(Date.now() + Number(data.expires_in) * 1000).toISOString();
        }
      }
    } else {
      // Non-fatal: fall through with the short-lived token
      console.warn("[ig-callback] Long-lived token exchange non-ok:", res.status);
    }
  } catch (e) {
    console.warn("[ig-callback] Long-lived exchange exception (using short token):", (e as Error).message);
  }

  // ── 5. Fetch Instagram profile ────────────────────────────────────────────
  let igUserId:     string;
  let username:     string | null = null;
  let displayName:  string | null = null;
  let avatarUrl:    string | null = null;

  try {
    const params = new URLSearchParams({
      fields:       "id,username,name,profile_picture_url",
      access_token: longToken,
    });

    const res = await fetch(`${IG_GRAPH_BASE}/me?${params.toString()}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[ig-callback] Profile fetch failed:", res.status, text.slice(0, 200));
      return errorRedirect("profile_fetch_failed");
    }

    const profile = await res.json();
    igUserId    = String(profile.id ?? "");
    username    = profile.username             ?? null;
    displayName = profile.name                 ?? null;
    avatarUrl   = profile.profile_picture_url  ?? null;

    if (!igUserId) throw new Error("Profile response missing id");
  } catch (e) {
    console.error("[ig-callback] Profile fetch exception:", (e as Error).message);
    return errorRedirect("profile_fetch_failed");
  }

  // ── 6. Encrypt token (AES-256-GCM, random IV) ────────────────────────────
  let encryptedToken: string;
  try {
    encryptedToken = await encryptToken(longToken, ENC_KEY_HEX);
  } catch (e) {
    console.error("[ig-callback] Token encryption failed:", (e as Error).message);
    return errorRedirect("internal_error");
  }

  // ── 7. Upsert social_accounts row ─────────────────────────────────────────
  const { error: upsertErr } = await sb
    .from("social_accounts")
    .upsert(
      {
        user_id:                userId,
        platform:               "instagram",
        platform_user_id:       igUserId,
        username,
        display_name:           displayName,
        avatar_url:             avatarUrl,
        access_token_encrypted: encryptedToken,
        token_expires_at:       expiresAt,
        scopes:                 ["instagram_business_basic", "instagram_business_content_publish"],
        metadata:               {},
        revoked_at:             null,
        connected_at:           new Date().toISOString(),
        updated_at:             new Date().toISOString(),
      },
      { onConflict: "user_id,platform,platform_user_id" },
    );

  if (upsertErr) {
    console.error("[ig-callback] Account upsert failed:", upsertErr.message);
    return errorRedirect("internal_error");
  }

  return frontendRedirect("/workspace/publish?ig_connect=success");
});
