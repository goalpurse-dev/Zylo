// supabase/functions/youtube-account-status/index.ts
// Returns safe metadata for the calling user's connected YouTube accounts.
// Tokens are never returned — all reads go through get_my_social_accounts() RPC.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser, supabaseForUser } from "../shared/auth.ts";

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

  const userSb = supabaseForUser(req);
  const { data, error } = await userSb.rpc("get_my_social_accounts");

  if (error) {
    console.error("[yt-account-status] RPC error:", error.message);
    return err(req, "Failed to retrieve account status", 500);
  }

  // deno-lint-ignore no-explicit-any
  const ytAccounts = (data ?? []).filter((a: any) => a.platform === "youtube");
  const connected  = ytAccounts.length > 0;

  return ok(req, { connected, accounts: ytAccounts });
});
