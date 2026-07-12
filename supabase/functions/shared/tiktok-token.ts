// supabase/functions/shared/tiktok-token.ts
// Shared helper: load a TikTok social_account, decrypt + refresh the access
// token if it's expiring, and persist the new token back to the DB.
//
// Unlike YouTube, TikTok rotates the refresh_token on every refresh call —
// the new refresh_token MUST be persisted every time or the old one becomes
// invalid and the account gets locked out.
//
// NEVER log tokens, refresh tokens, client secret, or encryption key.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken, encryptToken } from "./social-token.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_HEX   = (Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY") ?? "").trim();
const CLIENT_KEY    = (Deno.env.get("TIKTOK_CLIENT_KEY") ?? "").trim();
const CLIENT_SECRET = (Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "").trim();

export const TT_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

export interface TTAccount {
  id:                      string;
  user_id:                 string;
  platform_user_id:        string;
  display_name:            string | null;
  avatar_url:              string | null;
  scopes:                  string[] | null;
  access_token_encrypted:  string;
  refresh_token_encrypted: string | null;
  token_expires_at:        string | null;
}

export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function getTTAccount(
  userId: string,
  accountId: string,
): Promise<{ account: TTAccount | null; error: string | null }> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("social_accounts")
    .select(
      "id, user_id, platform_user_id, display_name, avatar_url, scopes, " +
      "access_token_encrypted, refresh_token_encrypted, token_expires_at",
    )
    .eq("id", accountId)
    .eq("user_id", userId)
    .eq("platform", "tiktok")
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) {
    return { account: null, error: "TikTok account not found or not connected" };
  }
  return { account: data as TTAccount, error: null };
}

/** Refreshes a TikTok access token. TikTok always returns a NEW refresh_token
 *  that must replace the old one — the caller is responsible for persisting
 *  both values (this helper only talks to TikTok, it doesn't write to the DB
 *  by itself so callers can decide what to persist alongside it). */
export async function refreshTikTokToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string; refreshExpiresAt: string }> {
  const res = await fetch(TT_TOKEN_URL, {
    method:  "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "cache-control": "no-cache" },
    body:    new URLSearchParams({
      client_key:    CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[tt-token] Refresh failed:", res.status, text.slice(0, 200));
    throw new Error("TikTok session expired. Please reconnect.");
  }

  const data = await res.json();
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Token refresh returned an unexpected response.");
  }

  return {
    accessToken:      data.access_token,
    refreshToken:     data.refresh_token,
    expiresAt:        new Date(Date.now() + Number(data.expires_in ?? 86400) * 1000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + Number(data.refresh_expires_in ?? 31536000) * 1000).toISOString(),
  };
}

/** Decrypts the account's access token, refreshing (and persisting the
 *  rotated refresh token) if it's expiring within 90 seconds. */
export async function getAccessToken(
  account: TTAccount,
): Promise<{ accessToken: string; error: string | null }> {
  if (!account.access_token_encrypted) {
    return { accessToken: "", error: "No access token stored. Please reconnect TikTok." };
  }

  let accessToken: string;
  try {
    accessToken = await decryptToken(account.access_token_encrypted, ENC_KEY_HEX);
  } catch {
    return { accessToken: "", error: "Failed to read credentials. Please reconnect TikTok." };
  }

  const expiresAt  = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  const willExpire = expiresAt > 0 && expiresAt < Date.now() + 90_000;

  if (willExpire) {
    if (!account.refresh_token_encrypted) {
      return { accessToken: "", error: "TikTok session expired. Please reconnect." };
    }
    try {
      const refreshToken = await decryptToken(account.refresh_token_encrypted, ENC_KEY_HEX);
      const refreshed    = await refreshTikTokToken(refreshToken);
      accessToken         = refreshed.accessToken;

      const newAccessEnc  = await encryptToken(refreshed.accessToken, ENC_KEY_HEX);
      const newRefreshEnc = await encryptToken(refreshed.refreshToken, ENC_KEY_HEX);

      const sb = adminClient();
      await sb.from("social_accounts").update({
        access_token_encrypted:  newAccessEnc,
        refresh_token_encrypted: newRefreshEnc,
        token_expires_at:        refreshed.expiresAt,
        refresh_token_expires_at: refreshed.refreshExpiresAt,
        updated_at:              new Date().toISOString(),
      }).eq("id", account.id);
    } catch (e) {
      console.error("[tt-token] Refresh/persist failed:", (e as Error).message);
      return { accessToken: "", error: "TikTok session expired. Please reconnect." };
    }
  }

  return { accessToken, error: null };
}
