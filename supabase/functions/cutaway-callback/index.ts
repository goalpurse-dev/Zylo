// deno-lint-ignore-file no-explicit-any
// cutaway-callback: where the Cutaway worker reports (m3/videoJob.mjs: progress, heartbeat, planned, chunk, done, failed)
// and where RunPod's webhook lands when a job ends (?src=runpod&run=<id>&token=<token>). Each request carries the run's
// token (HMAC of the run id with CUTAWAY_CALLBACK_SECRET); anything else is refused. What happens next is decided in
// _shared/cutaway/orchestrate.js and carried out in runtime.ts (retry, the Fly fallback, done, refund).
// Deployed with --no-verify-jwt: the worker has no user session; the token is the check.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sameToken, tokenFor } from "../_shared/cutaway/jobs.js";
import { advance, CONFIG } from "../_shared/cutaway/runtime.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!CONFIG.callbackSecret) return json({ error: "not configured" }, 503);
  const url = new URL(req.url), body = await req.json().catch(() => ({}));
  const fromRunPod = url.searchParams.get("src") === "runpod";
  const runId = String(fromRunPod ? url.searchParams.get("run") : body?.runId ?? "");
  const token = String(fromRunPod ? url.searchParams.get("token") : body?.token ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(runId) || !sameToken(token, await tokenFor(CONFIG.callbackSecret, runId))) return json({ error: "refused" }, 403);
  const { data: run } = await admin.from("cutaway_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) return json({ error: "no such run" }, 404);
  try {
    const ev = fromRunPod
      ? { event: "runpod", jobId: body?.id, status: body?.status, output: body?.output ?? null }
      : { ...body, token: undefined };
    await advance(admin, run, ev);
    return json({ ok: true });
  } catch (e: any) {
    console.error("[cutaway-callback]", runId, e?.message ?? e);
    return json({ error: "failed" }, 500); // the worker retries its event
  }
});
