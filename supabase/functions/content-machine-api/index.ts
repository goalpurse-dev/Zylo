// content-machine-api — the Content Machine's admin API (/admin/content-machine). Admin-only: see
// _shared/contentMachine/adminGuard.js; anyone else gets a plain 404. verify_jwt is off in config.toml so
// that even a call without a token gets this function's 404 rather than the gateway's 401.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../shared/cors.ts";
import { adminEmailList } from "../_shared/contentMachine/adminGuard.js";
import { createBudgetGuard } from "../_shared/contentMachine/budgetGuard.js";
import { createStore } from "../_shared/contentMachine/store.js";
import { createFiles, createPipelineDb } from "../_shared/contentMachine/pipelineDb.js";
import { createHandler } from "../_shared/contentMachine/api.js";
import { createMessage } from "../_shared/contentMachine/providers/anthropic.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const store = createStore(admin);
const WORKER_SECRET = Deno.env.get("CM_WORKER_SECRET") ?? "";

// "Make slideshows" starts the worker at once instead of waiting for the next minute's tick.
async function kick() {
  if (!WORKER_SECRET) return;
  await fetch(`${SUPABASE_URL}/functions/v1/content-machine-worker`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-cm-worker-secret": WORKER_SECRET },
    body: JSON.stringify({ action: "tick" }), signal: AbortSignal.timeout(5_000),
  }).catch(() => {});
}

Deno.serve(createHandler({
  getUser: (token: string) => admin.auth.getUser(token),
  emails: adminEmailList(Deno.env.get("ADMIN_EMAILS")),
  store,
  guard: createBudgetGuard({ store, envDryRun: Deno.env.get("DRY_RUN") }),
  cors,
  // ANTHROPIC_API_KEY stays on the server: only the stats screenshot reader (Posted tab) uses it here.
  env: { CM_MODEL_MAIN: Deno.env.get("CM_MODEL_MAIN") ?? "", CM_MODEL_FAST: Deno.env.get("CM_MODEL_FAST") ?? "", ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") ?? "" },
  ai: { createMessage },
  cm: createPipelineDb(admin),
  files: createFiles(admin),
  kick,
}));
