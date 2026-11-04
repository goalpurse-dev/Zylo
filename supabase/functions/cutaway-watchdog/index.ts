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
import { CONFIG, startGiftFinish, watch } from "../_shared/cutaway/runtime.ts";
import { alertOnce } from "../_shared/adminAlert.ts";
import { CATEGORIES, kitCheck, openCategories } from "../_shared/cutaway/topics.js";

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

/**
 * Each open topic category closes itself (phase 0 of the any-topic plan, the owner's go of 2026-11-04): over 30% of its
 * last 10 finished custom videos failed (any reason: every failure cost us money), with at least 3 finished, and it is
 * refused again up front, with an email. The owner reopens it after a fix and a new proof.
 */
async function categoryGates() {
  const { data: s } = await admin.from("cutaway_settings").select("categories").eq("id", 1).maybeSingle();
  const open = openCategories(s?.categories);
  if (!open.length) return null;
  const { data } = await admin.from("cutaway_runs").select("topic, status, error_code").eq("kind", "custom").eq("env", "prod").in("status", ["done", "failed"]).order("finished_at", { ascending: false }).limit(300);
  const all = CATEGORIES.map((c: any) => c.key), out: Record<string, unknown> = {};
  for (const key of open) {
    const runs = (data ?? []).filter((r: any) => kitCheck(r.topic, { open: all }).category === key).slice(0, 10);
    const failed = runs.filter((r: any) => r.status === "failed"), rate = runs.length ? failed.length / runs.length : 0;
    out[key] = { runs: runs.length, rate: +rate.toFixed(2) };
    if (runs.length >= 3 && rate > 0.3) {
      const next = { ...(s?.categories ?? {}), [key]: "refused" };
      const { error } = await admin.from("cutaway_settings").update({ categories: next }).eq("id", 1);
      await alertOnce(admin, `cutaway-category-closed:${key}`, 6 * 3600, `Cutaway: "${key}" topics closed again`,
        `${failed.length} of the last ${runs.length} ${key} custom videos failed (${failed.map((r: any) => r.error_code).join(", ")}), so these topics are refused up front again${error ? " (the switch could not be written: " + error.message + ")" : ""}. Reopen them after a fix and a new proof.`);
      out[key] = { ...(out[key] as object), closed: !error };
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (!SECRET || !sameToken(req.headers.get("x-cutaway-cron") ?? "", SECRET)) return json({ error: "refused" }, 403);
  const { data: running } = await admin.from("cutaway_runs").select("*").not("status", "in", "(done,failed)").order("created_at").limit(50);
  let looked = 0;
  for (const run of running ?? []) {
    try { await watch(admin, run); looked++; } catch (e: any) { console.error("[cutaway-watchdog]", run.id, e?.message ?? e); }
  }
  // paid, but the page never came back (a closed tab): the free preview's video is still finished as promised
  const { data: toFinish } = await admin.from("cutaway_free_previews").select("user_id").not("paid_at", "is", null).is("finish_run_id", null).eq("status", "ready").limit(20);
  for (const row of toFinish ?? []) {
    try { await startGiftFinish(admin, row.user_id); } catch (e: any) { console.error("[cutaway-watchdog] gift finish", e?.message ?? e); }
  }
  // the slower checks once an hour (minute 0-1 of the hour)
  const hourly = new Date().getUTCMinutes() < 2 ? { balance: await balances(), failures: await failureRate(), categories: await categoryGates().catch((e: any) => ({ error: String(e?.message ?? e) })) } : null;
  return json({ ok: true, looked, hourly });
});
