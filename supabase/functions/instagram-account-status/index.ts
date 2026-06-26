// supabase/functions/instagram-account-status/index.ts
// Returns safe metadata for the calling user's connected Instagram accounts.
// The access token is never returned — all reads go through the
// get_my_social_accounts() SECURITY DEFINER RPC which omits that column.

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

  // Call the SECURITY DEFINER RPC using the user's own JWT so auth.uid()
  // resolves correctly inside the function. The RPC strips access_token_encrypted.
  const userSb = supabaseForUser(req);
  const { data, error } = await userSb.rpc("get_my_social_accounts");

  if (error) {
    console.error("[ig-account-status] RPC error:", error.message);
    return err(req, "Failed to retrieve account status", 500);
  }

  // deno-lint-ignore no-explicit-any
  const igAccounts = (data ?? []).filter((a: any) => a.platform === "instagram");
  const connected  = igAccounts.length > 0;

  return ok(req, {
    connected,
    accounts: igAccounts,
  });
});
