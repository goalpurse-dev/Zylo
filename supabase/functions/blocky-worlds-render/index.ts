// deno-lint-ignore-file no-explicit-any
// blocky-worlds-render: the Blocky Worlds production pipeline's server side (docs/blocky-worlds-pipeline.md).
//   POST { runId, jobId, token, event, ... }              a worker's event (progress, voiced, planned, built, done, failed)
//                                                         (built: a new shared-library asset -> blocky_worlds_assets)
//   POST ?src=runpod&run=<id>&job=<id>&token=<token>      RunPod's webhook when a job ends
//   POST with header x-blocky-cron                        the sweeper (pg_cron every minute: stuck jobs, lost webhooks)
// Each run's token is HMAC(BLOCKY_WORLDS_CALLBACK_SECRET, run id); the sweeper's header is BLOCKY_WORLDS_CRON_SECRET.
// Anything else is refused. What happens next is decided in _shared/blockyWorlds/render.js (reconcile) and carried out
// in renderRuntime.js: the next job, retries, done, or failed and refunded once.
// Deployed with --no-verify-jwt: workers, RunPod and pg_cron have no user session; the token / secret is the check.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sameToken } from "../_shared/blockyWorlds/render.js";
import { RENDER_CONFIG, logCapabilityGaps, renderRuntime } from "../_shared/blockyWorlds/renderSupabase.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!RENDER_CONFIG.callbackSecret) return json({ error: "not configured" }, 503);
  const runtime = renderRuntime(admin);
  const cron = req.headers.get("x-blocky-cron");
  if (cron != null) {
    if (!RENDER_CONFIG.cronSecret || !sameToken(cron, RENDER_CONFIG.cronSecret)) return json({ error: "refused" }, 403);
    try { return json({ ok: true, ...(await runtime.sweep()) }); } catch (e: any) { console.error("[blocky-worlds-render] sweep", e?.message ?? e); return json({ error: "failed" }, 500); }
  }
  const url = new URL(req.url), body = await req.json().catch(() => ({}));
  const query = Object.fromEntries(url.searchParams.entries());
  try {
    const r = await runtime.handleCallback({ query, body });
    // the story director's capability gaps ride on the accepted "planned" event (guarded: never breaks a run)
    if (r.status === 200 && body?.event === "planned" && Array.isArray(body?.gaps) && body.gaps.length) await logCapabilityGaps(admin, String(body.runId ?? ""), body);
    return json(r.body, r.status);
  } catch (e: any) {
    console.error("[blocky-worlds-render]", query.run ?? body?.runId, e?.message ?? e);
    return json({ error: "failed" }, 500); // the worker retries its event; the sweeper catches up on the rest
  }
});
