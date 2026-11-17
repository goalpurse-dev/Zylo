// affiliate-api — the affiliate program's API (/affiliate, the survey's creator code, /admin/affiliates).
// All logic: ../_shared/affiliate/api.js; all business numbers: ../_shared/affiliate/config.js.
// IPs are hashed with AFFILIATE_IP_SALT (or, if unset, a hash of the service key: also secret) and never stored raw.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../shared/cors.ts";
import { adminEmailList } from "../_shared/contentMachine/adminGuard.js";
import { createAffiliateHandler } from "../_shared/affiliate/api.js";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE, { auth: { persistSession: false } });

Deno.serve(createAffiliateHandler({
  sb,
  getUser: (token: string) => sb.auth.getUser(token),
  adminEmails: adminEmailList(Deno.env.get("ADMIN_EMAILS")),
  salt: Deno.env.get("AFFILIATE_IP_SALT") || `svc:${SERVICE.slice(-24)}`,
  cors,
}));
