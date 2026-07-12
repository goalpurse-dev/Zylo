// supabase/functions/youtube-disconnect/index.ts
// Disconnects a YouTube account:
//   1. Verifies the calling Zyvo user owns the account.
//   2. Attempts to revoke the Google token (best-effort).
//   3. Cancels any pending YouTube publish jobs.
//   4. Soft-deletes the row (sets revoked_at, clears encrypted tokens).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { decryptToken } from "../shared/social-token.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_HEX  = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY")!;

const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

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

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const { account_id } = body ?? {};
  if (!account_id || typeof account_id !== "string") {
    return err(req, "account_id required", 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── 1. Fetch account — ownership enforced by user_id ─────────────────────
  const { data: account, error: fetchErr } = await sb
    .from("social_accounts")
    .select("id, user_id, access_token_encrypted, refresh_token_encrypted, revoked_at")
    .eq("id", account_id)
    .eq("user_id", user.id)
    .eq("platform", "youtube")
    .maybeSingle();

  if (fetchErr || !account) {
    return err(req, "Account not found", 404);
  }

  if (account.revoked_at !== null) {
    return ok(req, { disconnected: true });
  }

  // ── 2. Best-effort token revocation at Google ─────────────────────────────
  // Prefer to revoke the refresh_token; fall back to access_token.
  const tokenToRevoke = account.refresh_token_encrypted || account.access_token_encrypted;
  if (tokenToRevoke) {
    try {
      const token = await decryptToken(tokenToRevoke, ENC_KEY_HEX);
      const revokeRes = await fetch(
        `${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      if (!revokeRes.ok) {
        console.warn("[yt-disconnect] Token revocation non-ok:", revokeRes.status);
      }
    } catch (e) {
      console.warn("[yt-disconnect] Token revocation exception:", (e as Error).message);
    }
  }

  // ── 3. Cancel pending publish jobs ───────────────────────────────────────
  await sb
    .from("youtube_publish_jobs")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("social_account_id", account.id)
    .in("status", ["queued", "uploading", "processing"]);

  // ── 4. Soft-delete ────────────────────────────────────────────────────────
  const { error: revokeErr } = await sb
    .from("social_accounts")
    .update({
      revoked_at:              new Date().toISOString(),
      updated_at:              new Date().toISOString(),
      access_token_encrypted:  "",
      refresh_token_encrypted: "",
    })
    .eq("id", account.id)
    .eq("user_id", user.id);

  if (revokeErr) {
    console.error("[yt-disconnect] Revoke update failed:", revokeErr.message);
    return err(req, "Failed to disconnect account. Please try again.", 500);
  }

  return ok(req, { disconnected: true });
});
