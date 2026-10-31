// deno-lint-ignore-file no-explicit-any
// cutaway-watchdog: the Cutaway stuck-job watchdog and the provider balance check (pg_cron every 2 minutes,
// private.trigger_cutaway_watchdog; header x-cutaway-cron = the vault secret, also the function secret
// CUTAWAY_CRON_SECRET). For every run being made: RunPod's view of its job, a stale heartbeat, the 45-minute limit
// (orchestrate.js onWatch: retry, the Fly fallback, or fail and refund). Once an hour: the ElevenLabs balance (an alert
// below 20% of the plan), and the failure rate of the last 10 videos (an alert above 20%, or two failures in a row).
// Deployed with --no-verify-jwt: pg_cron has no user session; the secret header is the check.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sameToken } from "../_shared/cutaway/jobs.js";
import { CONFIG, watch } from "../_shared/cutaway/runtime.ts";
import { alertOnce } from "../_shared/adminAlert.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SECRET = (Deno.env.get("CUTAWAY_CRON_SECRET") ?? "").trim();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** the ElevenLabs balance: an alert under 20% of the plan's characters (Anthropic has no balance API: its 402 is the signal) */
async function balances() {
  if (!CONFIG.elevenlabs) return null;
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": CONFIG.elevenlabs }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const s = await r.json(), left = Number(s.character_limit) - Number(s.character_count), share = left / Math.max(1, Number(s.character_limit));
    if (share < 0.2) await alertOnce(admin, "cutaway-elevenlabs-low", 6 * 3600, "Cutaway: the ElevenLabs balance is low", `${left} of ${s.character_limit} characters left (${Math.round(share * 100)}%). Top it up before the voice step starts failing.`);
    return { left, share: +share.toFixed(3) };
  } catch { return null; }
}

/** failures on our side: above 20% of the last 10 videos, or the last two in a row */
async function failureRate() {
  const { data } = await admin.from("cutaway_runs").select("status, error_code").in("status", ["done", "failed"]).eq("env", "prod").order("finished_at", { ascending: false }).limit(10);
  const runs = data ?? [], ours = (r: any) => r.status === "failed" && !["GATE_FAILED", "PLAN_FAILED"].includes(r.error_code);
  const rate = runs.length ? runs.filter(ours).length / runs.length : 0, twoInARow = runs.length >= 2 && ours(runs[0]) && ours(runs[1]);
  // (two in a row alert from the very first videos: launch day has fewer than five)
  if ((runs.length >= 5 && rate > 0.2) || twoInARow) await alertOnce(admin, "cutaway-failure-rate", 3 * 3600, "Cutaway: videos are failing", `${Math.round(rate * 100)}% of the last ${runs.length} videos failed on our side${twoInARow ? ", the last two in a row" : ""}. Codes: ${runs.filter(ours).map((r: any) => r.error_code).join(", ")}.`);
  return { rate: +rate.toFixed(2), twoInARow };
}

Deno.serve(async (req) => {
  if (!SECRET || !sameToken(req.headers.get("x-cutaway-cron") ?? "", SECRET)) return json({ error: "refused" }, 403);
  const { data: running } = await admin.from("cutaway_runs").select("*").not("status", "in", "(done,failed)").order("created_at").limit(50);
  let looked = 0;
  for (const run of running ?? []) {
    try { await watch(admin, run); looked++; } catch (e: any) { console.error("[cutaway-watchdog]", run.id, e?.message ?? e); }
  }
  // the slower checks once an hour (minute 0-1 of the hour)
  const hourly = new Date().getUTCMinutes() < 2 ? { balance: await balances(), failures: await failureRate() } : null;
  return json({ ok: true, looked, hourly });
});
