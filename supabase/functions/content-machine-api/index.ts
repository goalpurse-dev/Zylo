// content-machine-api — the Content Machine's admin API (/admin/content-machine). Admin-only: see
// _shared/contentMachine/adminGuard.js; anyone else gets a plain 404. verify_jwt is off in config.toml so
// that even a call without a token gets this function's 404 rather than the gateway's 401.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../shared/cors.ts";
import { adminEmailList } from "../_shared/contentMachine/adminGuard.js";
import { createBudgetGuard } from "../_shared/contentMachine/budgetGuard.js";
import { createStore } from "../_shared/contentMachine/store.js";
import { createHandler } from "../_shared/contentMachine/api.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const store = createStore(admin);

Deno.serve(createHandler({
  getUser: (token: string) => admin.auth.getUser(token),
  emails: adminEmailList(Deno.env.get("ADMIN_EMAILS")),
  store,
  guard: createBudgetGuard({ store, envDryRun: Deno.env.get("DRY_RUN") }),
  cors,
  env: { CM_MODEL_MAIN: Deno.env.get("CM_MODEL_MAIN") ?? "", CM_MODEL_FAST: Deno.env.get("CM_MODEL_FAST") ?? "" },
}));
