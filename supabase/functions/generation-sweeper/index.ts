// deno-lint-ignore-file no-explicit-any
// generation-sweeper/index.ts — internal (the autopilot secret or the service key), 2026-10-07.
//
// Called every minute by the Long Form autopilot's sweep (no cron of its own).
// It is the one place on the server that comes back to work that stopped moving,
// for every tool outside Long Form's own pipeline (_shared/stuckJobs.ts):
//   1. the shared `jobs` pipeline (image and video generators, Seedance and the
//      template tools): lost queued jobs are dispatched again, a job running for
//      15 minutes is checked with the provider, one still unfinished after 30
//      minutes is failed and refunded; a cancelled job that was charged is refunded;
//   2. 2AM reservations nobody settled (the browser was closed, the planner died);
//   3. Long Form thumbnails whose draw never finished;
//   4. the failure rate of the last 10 minutes: above 20 % the owner is emailed.
// Nothing here calls a paid provider endpoint: a re-check is a status read.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { getProviderLink } from "../../../src/lib/providers.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { alertOnce } from "../_shared/adminAlert.ts";
import { checkRunwareGuard } from "../_shared/runwareBalance.ts";
import { decideStuckJob, failureRate, FAILURE_WINDOW_S, STUCK_COPY, STUCK_ERROR_CODE, SWEEP_CREATED_AFTER_DEFAULT } from "../_shared/stuckJobs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("LONG_FORM_AUTOPILOT_SECRET") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const RUNWARE_FNS = new Set(["/functions/v1/runware-image", "/functions/v1/runware-video"]);
const MAX_REDISPATCH = 10, MAX_RECHECK = 20;
const envCutoff = Deno.env.get("SWEEPER_CREATED_AFTER") ?? "";
const CREATED_AFTER = Number.isFinite(Date.parse(envCutoff)) ? new Date(envCutoff).toISOString() : SWEEP_CREATED_AFTER_DEFAULT;
const serviceHeaders = { "content-type": "application/json", authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "x-job-worker-key": SERVICE_KEY };
const post = (fn: string, body: unknown, headers: Record<string, string> = serviceHeaders) =>
  fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000) }).then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) })).catch((e) => ({ ok: false, status: 0, body: { error: String(e) } }));

async function sweepJobs(nowMs: number, paused: boolean) {
  const out = { held: 0, redispatched: 0, rechecked: 0, refunded: [] as any[], cancelledRefunded: 0 };
  const { data: jobs } = await admin.from("jobs").select("id, user_id, type, tool_key, status, provider_task_id, created_at, claimed_at, retry_after, charged, charge_credits")
    .in("status", ["queued", "running", "processing"]).gte("created_at", CREATED_AFTER).lt("created_at", new Date(nowMs - 110_000).toISOString()).order("created_at").limit(200);
  const hold: string[] = [];
  const refund = async (j: any, why: string) => {
    const { data: done, error } = await admin.rpc("fail_and_refund_generation_job", { p_job_id: j.id, p_error_code: STUCK_ERROR_CODE, p_error: STUCK_COPY, p_provider_task_id: null });
    if (error || done !== true) { console.error("[generation-sweeper] refund", j.id, error?.message ?? "not applied"); return; }
    const credits = j.charged ? Number(j.charge_credits ?? 0) : 0;
    out.refunded.push({ jobId: j.id, toolKey: j.tool_key, credits, status: j.status, why });
    await logEvent("generation-sweeper", "error", "stuck_job_refunded", { jobId: j.id, userId: j.user_id, toolKey: j.tool_key, wasStatus: j.status, creditsRefunded: credits, why });
  };
  for (const j of jobs ?? []) {
    const fn = j.tool_key ? getProviderLink(j.tool_key)?.edgeFn ?? null : null;
    const canRecheck = fn === "/functions/v1/runware-video" && !!j.provider_task_id;
    const action = decideStuckJob(j, nowMs, { paused: paused && RUNWARE_FNS.has(String(fn)), canRecheck });
    if (action === "none") continue;
    if (action === "hold") { hold.push(j.id); continue; }
    if (action === "redispatch") {
      if (out.redispatched >= MAX_REDISPATCH) continue;
      out.redispatched++;
      const r = await post("job-worker", { jobId: j.id });
      await logEvent("generation-sweeper", "warn", "queued_job_redispatched", { jobId: j.id, toolKey: j.tool_key, status: r.status });
      continue;
    }
    if (action === "refund") { await refund(j, "not finished after 30 minutes"); continue; }
    // recheck / recheck_then_refund: ask the provider once (a status read; it completes or fails-and-refunds by itself).
    if (out.rechecked >= MAX_RECHECK) continue;
    out.rechecked++;
    const r = await post("runware-video", { jobId: j.id, action: "reconcile", workerId: `sweeper-${crypto.randomUUID()}` });
    await logEvent("generation-sweeper", "info", "stuck_job_rechecked", { jobId: j.id, toolKey: j.tool_key, result: r.body?.status ?? r.status });
    if (action === "recheck_then_refund") {
      const { data: after } = await admin.from("jobs").select("status").eq("id", j.id).maybeSingle();
      if (after && ["queued", "running", "processing"].includes(after.status)) await refund(j, "the provider had not finished it after 30 minutes");
    }
  }
  // Paused: the queued jobs wait, and their clock starts again when the pause is over.
  if (hold.length) { await admin.from("jobs").update({ retry_after: new Date(nowMs).toISOString() }).in("id", hold).eq("status", "queued"); out.held = hold.length; }
  // A job cancelled after it was charged keeps nobody's credits.
  const { data: cancelled } = await admin.from("jobs").select("id, user_id, tool_key, charge_credits").eq("status", "canceled").eq("charged", true).is("credits_refunded_at", null).gte("created_at", CREATED_AFTER).limit(50);
  for (const j of cancelled ?? []) {
    const { data: done } = await admin.rpc("refund_job_credits", { p_job_id: j.id });
    if (done === true) { out.cancelledRefunded++; await logEvent("generation-sweeper", "warn", "cancelled_job_refunded", { jobId: j.id, userId: j.user_id, toolKey: j.tool_key, creditsRefunded: Number(j.charge_credits ?? 0) }); }
  }
  return out;
}

// 2AM: a reservation nobody settled (migration 20261027100000 adds the rule; before it is applied this is a no-op).
async function sweepTwoAm() {
  const { data, error } = await admin.rpc("release_stale_two_am_reservations", { p_created_after: CREATED_AFTER });
  if (error) return { skipped: /does not exist|PGRST202|schema cache/i.test(`${error.code} ${error.message}`) ? "rule not applied yet" : error.message };
  const rows = Array.isArray(data) ? data : [];
  for (const r of rows) await logEvent("generation-sweeper", "warn", "two_am_reservation_released", { userId: r.user_id, generationId: r.id, refunded: r.refunded_credits, status: r.status });
  return { released: rows.length };
}

// The share of work that failed in the last 10 minutes, per pipeline.
async function failureRates(nowMs: number) {
  const since = new Date(nowMs - FAILURE_WINDOW_S * 1000).toISOString();
  const n = async (q: any) => (await q).count ?? 0;
  const head = (table: string) => admin.from(table).select("id", { count: "exact", head: true });
  const [jobsOk, jobsFailed, scenesOk, scenesFailed, fruitOk, fruitFailed] = await Promise.all([
    n(head("jobs").eq("status", "succeeded").gte("completed_at", since)),
    n(head("jobs").eq("status", "failed").gte("failed_at", since)),
    n(head("long_form_scene_images").eq("status", "ready").gte("ready_at", since)),
    n(head("long_form_scene_images").eq("status", "failed").gte("started_at", since)),
    n(head("fruit_jobs").eq("status", "succeeded").gte("finished_at", since)),
    n(head("fruit_jobs").eq("status", "failed").gte("finished_at", since)),
  ]);
  return {
    "image and video tools": failureRate({ ok: jobsOk, failed: jobsFailed }),
    "Long Form scenes": failureRate({ ok: scenesOk, failed: scenesFailed }),
    "Fruit Story": failureRate({ ok: fruitOk, failed: fruitFailed }),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const trusted = (!!SECRET && req.headers.get("x-autopilot-secret") === SECRET) || req.headers.get("authorization") === `Bearer ${SERVICE_KEY}`;
  if (!trusted) return err(req, "Unauthorized", 401);
  const nowMs = Date.now();
  const guard = await checkRunwareGuard(admin);
  const safe = async <T>(name: string, f: () => Promise<T>): Promise<T | { error: string }> => { try { return await f(); } catch (e) { console.error(`[generation-sweeper] ${name}`, String(e)); return { error: String(e).slice(0, 200) }; } };

  const jobs: any = await safe("jobs", () => sweepJobs(nowMs, guard.paused));
  const twoAm = await safe("two-am", sweepTwoAm);
  const thumbs = await safe("thumbnails", async () => (await post("long-form-thumbnails", { action: "sweep_all", createdAfter: CREATED_AFTER }, { ...serviceHeaders, "x-autopilot-secret": SECRET })).body);
  const rates: any = await safe("rates", () => failureRates(nowMs));

  // The owner hears about it: any job that had to be refunded as stuck, and a failure rate above 20 %.
  if (jobs?.refunded?.length) {
    const lines = jobs.refunded.map((r: any) => `- ${r.toolKey ?? "?"} · job ${r.jobId} · was ${r.status} · ${r.credits} credits back · ${r.why}`);
    await alertOnce(admin, "stuck_jobs", 900, `Zyvo: ${jobs.refunded.length} stuck job${jobs.refunded.length === 1 ? "" : "s"} refunded automatically`, `These jobs did not finish within 30 minutes. Each was marked failed and its credits went back to the user, who can try again.\n\n${lines.join("\n")}\n\nIf the provider delivers one of them later, the result is dropped (the user was not charged; we still pay the provider).`);
  }
  for (const [name, r] of Object.entries(rates ?? {}) as [string, any][]) {
    if (!r?.alert) continue;
    await logEvent("generation-sweeper", "error", "failure_rate_high", { pipeline: name, share: Number(r.share.toFixed(3)), total: r.total });
    await alertOnce(admin, `failure_rate:${name}`, 1800, `Zyvo: ${Math.round(r.share * 100)} % of ${name} failed in the last 10 minutes`, `${Math.round(r.share * r.total)} of ${r.total} finished ${name} jobs failed in the last 10 minutes (alert above 20 %).\n\nFailed work is retried, worked around or refunded by itself; this email is so you know first. Check the provider's status page and the admin page (/admin/ops).`);
  }
  return ok(req, { ok: true, createdAfter: CREATED_AFTER, paused: guard.paused, jobs, twoAm, thumbs, rates });
});
