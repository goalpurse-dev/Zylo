// supabase/functions/shared/youtube-token.ts
// Shared helper: load a YouTube social_account, decrypt + refresh the access
// token if it's expiring, and persist the new token back to the DB.
//
// NEVER log tokens, refresh tokens, client secret, or encryption key.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken, encryptToken } from "./social-token.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_HEX   = (Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY") ?? "").trim();
const CLIENT_ID     = (Deno.env.get("YOUTUBE_CLIENT_ID") ?? "").trim();
const CLIENT_SECRET = (Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "").trim();

const YT_TOKEN_URL = "https://oauth2.googleapis.com/token";

const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly";

export interface YTAccount {
  id:                        string;
  user_id:                   string;
  platform_user_id:          string;
  display_name:              string | null;
  avatar_url:                string | null;
  scopes:                    string[] | null;
  access_token_encrypted:    string;
  refresh_token_encrypted:   string | null;
  token_expires_at:          string | null;
  last_analytics_sync_at:    string | null;
}

export function hasAnalyticsScope(account: YTAccount): boolean {
  return (account.scopes ?? []).includes(ANALYTICS_SCOPE);
}

export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function getYTAccount(
  userId: string,
  accountId: string,
): Promise<{ account: YTAccount | null; error: string | null }> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("social_accounts")
    .select(
      "id, user_id, platform_user_id, display_name, avatar_url, scopes, " +
      "access_token_encrypted, refresh_token_encrypted, token_expires_at, last_analytics_sync_at",
    )
    .eq("id", accountId)
    .eq("user_id", userId)
    .eq("platform", "youtube")
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) {
    return { account: null, error: "YouTube account not found or not connected" };
  }
  return { account: data as YTAccount, error: null };
}

export async function getAccessToken(
  account: YTAccount,
): Promise<{ accessToken: string; error: string | null }> {
  if (!account.access_token_encrypted) {
    return { accessToken: "", error: "No access token stored. Please reconnect YouTube." };
  }

  let accessToken: string;
  try {
    accessToken = await decryptToken(account.access_token_encrypted, ENC_KEY_HEX);
  } catch {
    return { accessToken: "", error: "Failed to read credentials. Please reconnect YouTube." };
  }

  // Refresh if expiring within 90 seconds
  const expiresAt  = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  const willExpire = expiresAt > 0 && expiresAt < Date.now() + 90_000;

  if (willExpire && account.refresh_token_encrypted) {
    let refreshToken: string;
    try {
      refreshToken = await decryptToken(account.refresh_token_encrypted, ENC_KEY_HEX);
    } catch {
      return { accessToken: "", error: "Failed to read refresh credentials. Please reconnect YouTube." };
    }

    const res = await fetch(YT_TOKEN_URL, {
      method:  "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[yt-token] Refresh failed:", res.status, text.slice(0, 200));
      return { accessToken: "", error: "YouTube session expired. Please reconnect." };
    }

    const data = await res.json();
    if (!data.access_token) {
      return { accessToken: "", error: "Token refresh returned no access_token." };
    }

    accessToken = data.access_token;
    const newExpiry = new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString();

    // Persist refreshed token
    try {
      const newEnc = await encryptToken(accessToken, ENC_KEY_HEX);
      const sb = adminClient();
      await sb.from("social_accounts").update({
        access_token_encrypted: newEnc,
        token_expires_at:       newExpiry,
        updated_at:             new Date().toISOString(),
      }).eq("id", account.id);
    } catch {
      // Non-fatal — token still works for this request
      console.warn("[yt-token] Failed to persist refreshed access token");
    }
  }

  return { accessToken, error: null };
}
