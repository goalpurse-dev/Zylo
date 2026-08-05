import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEvent } from "../_shared/systemLog.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLEANUP_SECRET = Deno.env.get("CLEANUP_CRON_SECRET") ?? "";
const BUCKET = "generation-references";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const suppliedSecret = req.headers.get("x-cleanup-secret") ?? "";
  if (!CLEANUP_SECRET || suppliedSecret !== CLEANUP_SECRET) {
    await logEvent("cleanup-generation-references", "warn", "cleanup_auth_rejected", {});
    return new Response("Unauthorized", { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("list_expired_generation_references", {
    p_retention: "7 days",
  });
  if (error) {
    await logEvent("cleanup-generation-references", "error", "cleanup_list_failed", { message: error.message });
    return Response.json({ ok: false, error: "Cleanup failed" }, { status: 500 });
  }

  const paths = (data ?? []).map((row: { object_name: string }) => row.object_name).filter(Boolean);
  let removed = 0;
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    const { error: removeError } = await sb.storage.from(BUCKET).remove(batch);
    if (removeError) {
      await logEvent("cleanup-generation-references", "error", "cleanup_remove_failed", {
        batchSize: batch.length, message: removeError.message,
      });
      continue;
    }
    removed += batch.length;
  }
  await logEvent("cleanup-generation-references", "info", "cleanup_completed", { candidates: paths.length, removed });
  return Response.json({ ok: true, candidates: paths.length, removed });
});
