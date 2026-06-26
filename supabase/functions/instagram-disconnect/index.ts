// supabase/functions/instagram-disconnect/index.ts
// Disconnects an Instagram account:
//   1. Verifies the calling Zyvo user owns the account.
//   2. Attempts to revoke the token at Meta (best-effort; does not block disconnect).
//   3. Cancels any pending publish jobs for that account.
//   4. Soft-deletes the row (sets revoked_at, clears the encrypted token).
//
// A soft-delete is used instead of hard-delete to preserve instagram_publish_jobs
// FK integrity for historical records.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { decryptToken } from "../shared/social-token.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_HEX  = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY")!;

const IG_GRAPH_BASE = "https://graph.instagram.com";

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

  // ── 1. Fetch account — ownership enforced by user_id filter ───────────────
  const { data: account, error: fetchErr } = await sb
    .from("social_accounts")
    .select("id, user_id, platform_user_id, access_token_encrypted, revoked_at")
    .eq("id", account_id)
    .eq("user_id", user.id)          // strict ownership check
    .eq("platform", "instagram")
    .maybeSingle();

  if (fetchErr || !account) {
    return err(req, "Account not found", 404);
  }

  // Already revoked — idempotent success
  if (account.revoked_at !== null) {
    return ok(req, { disconnected: true });
  }

  // ── 2. Best-effort token revocation at Meta ────────────────────────────────
  if (account.access_token_encrypted) {
    try {
      const token = await decryptToken(account.access_token_encrypted, ENC_KEY_HEX);
      // DELETE /{ig-user-id}/permissions revokes all permissions for this app
      const revokeRes = await fetch(
        `${IG_GRAPH_BASE}/${account.platform_user_id}/permissions` +
        `?access_token=${encodeURIComponent(token)}`,
        { method: "DELETE" },
      );
      if (!revokeRes.ok) {
        const text = await revokeRes.text().catch(() => "");
        console.warn(
          "[ig-disconnect] Token revocation non-ok:",
          revokeRes.status,
          text.slice(0, 150),
        );
      }
    } catch (e) {
      // Never block disconnect due to revocation failure (token may already be expired)
      console.warn("[ig-disconnect] Token revocation exception:", (e as Error).message);
    }
  }

  // ── 3. Cancel pending publish jobs ────────────────────────────────────────
  const { error: cancelErr } = await sb
    .from("instagram_publish_jobs")
    .update({
      status:     "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("social_account_id", account.id)
    .in("status", ["queued", "creating_container", "processing"]);

  if (cancelErr) {
    console.warn("[ig-disconnect] Job cancellation error:", cancelErr.message);
    // Non-fatal: proceed with disconnect
  }

  // ── 4. Soft-delete: set revoked_at, clear encrypted token ─────────────────
  const { error: revokeErr } = await sb
    .from("social_accounts")
    .update({
      revoked_at:             new Date().toISOString(),
      updated_at:             new Date().toISOString(),
      access_token_encrypted: "",   // clear; empty string cannot be decrypted
    })
    .eq("id", account.id)
    .eq("user_id", user.id);        // ownership check at write too

  if (revokeErr) {
    console.error("[ig-disconnect] Revoke update failed:", revokeErr.message);
    return err(req, "Failed to disconnect account. Please try again.", 500);
  }

  return ok(req, { disconnected: true });
});
