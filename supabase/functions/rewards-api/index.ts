// rewards-api — the Rewards program's API (/rewards, the ?invite link, /admin/rewards).
// All logic: ../_shared/rewards/api.js; all numbers: ../_shared/rewards/config.js.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../shared/cors.ts";
import { adminEmailList } from "../_shared/contentMachine/adminGuard.js";
import { createRewardsHandler } from "../_shared/rewards/api.js";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE, { auth: { persistSession: false } });

Deno.serve(createRewardsHandler({
  sb,
  getUser: (token: string) => sb.auth.getUser(token),
  adminEmails: adminEmailList(Deno.env.get("ADMIN_EMAILS")),
  // the same IP hash as affiliate-api, so the 7-day same-IP rule matches across both programs
  salt: Deno.env.get("AFFILIATE_IP_SALT") || `svc:${SERVICE.slice(-24)}`,
  cors,
}));
