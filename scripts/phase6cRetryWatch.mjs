// Phase 6c — watch the user's hand-clicked "Retry (free)" on project 7850557d
// (read-only, except the spend guard). Prints one line per milestone; stops
// the run (autopilot + scenes failed, queued scenes failed — no further
// spend) if this retry's spend passes the cap. Ends with the report JSON.
//   node --env-file=.env.local scripts/phase6cRetryWatch.mjs
import { createClient } from "@supabase/supabase-js";

const PROJECT = "7850557d-bff5-4a35-b7dc-f01f93510502";
const CAP_USD = 0.65;
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const say = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const med = (a) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const baseRetries = (await admin.from("long_form_projects").select("autopilot").eq("id", PROJECT).single()).data.autopilot?.scenes?.retries ?? 0;
say(`watching ${PROJECT} (retries so far ${baseRetries}); cap $${CAP_USD}`);

let retriedAt = null, last = "", stopped = null, lastDrawn = -1;
const deadline = Date.now() + 3 * 3600_000;
while (Date.now() < deadline) {
  const { data: p } = await admin.from("long_form_projects").select("autopilot").eq("id", PROJECT).single();
  const sc = p.autopilot?.scenes ?? {};
  if (!retriedAt) {
    if ((sc.retries ?? 0) > baseRetries && sc.retriedAt) { retriedAt = sc.retriedAt; say(`Retry clicked at ${retriedAt}`); }
    else { await new Promise((r) => setTimeout(r, 10_000)); continue; }
  }
  const { data: ledger } = await admin.from("long_form_cost_ledger").select("stage, provider, usd").eq("project_id", PROJECT).gte("created_at", retriedAt);
  const spend = (ledger ?? []).filter((r) => r.provider !== "elevenlabs").reduce((a, r) => a + Number(r.usd), 0);
  const { data: plan } = await admin.from("long_form_beat_plan_versions").select("id, status, created_at, completed_at, error_code").eq("project_id", PROJECT).gte("created_at", retriedAt).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: imgs } = plan ? await admin.from("long_form_scene_images").select("status").eq("project_id", PROJECT).eq("beat_plan_version_id", plan.id).eq("is_current", true) : { data: [] };
  const c = (s) => (imgs ?? []).filter((i) => i.status === s).length;
  const line = `stage=${sc.stage} status=${sc.status} plan=${plan?.status ?? "-"}${plan?.error_code ? `(${plan.error_code})` : ""} scenes ${c("ready")}/${imgs?.length ?? 0} failed=${c("failed")} spend=$${spend.toFixed(3)}`;
  const drawn = c("ready");
  if (line.replace(/ spend=.*/, "") !== last.replace(/ spend=.*/, "") && (drawn - lastDrawn >= 10 || drawn === 0 || sc.status !== "running" || !last.includes(`plan=${plan?.status}`))) { say(line); last = line; lastDrawn = drawn; }
  if (spend > CAP_USD && !stopped) {
    stopped = `spend $${spend.toFixed(3)} > cap $${CAP_USD}`;
    say("STOP:", stopped);
    await admin.from("long_form_projects").update({ autopilot: { ...p.autopilot, status: "failed", failedReason: "retry spend cap", scenes: { ...sc, status: "failed", failedReason: "retry spend cap" } } }).eq("id", PROJECT);
    if (plan) await admin.from("long_form_scene_images").update({ status: "failed", error: "retry spend cap" }).eq("project_id", PROJECT).eq("status", "queued");
  }
  if (sc.status === "done" || sc.status === "failed") {
    // Final report.
    const { data: all } = plan ? await admin.from("long_form_scene_images").select("status, started_at, ready_at, cost_usd, credits_charged, attempts, qa").eq("project_id", PROJECT).eq("beat_plan_version_id", plan.id).eq("is_current", true) : { data: [] };
    const ready = (all ?? []).filter((i) => i.status === "ready");
    const firstStart = (all ?? []).map((i) => i.started_at).filter(Boolean).sort()[0];
    const lastReady = ready.map((i) => i.ready_at).sort().slice(-1)[0];
    const sec = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 1000) : null);
    const by = {};
    for (const r of ledger ?? []) { const k = `${r.provider}:${r.stage}`; by[k] = Number(((by[k] ?? 0) + Number(r.usd)).toFixed(4)); }
    const { data: res } = await admin.from("long_form_project_reservations").select("status, reserved_credits, committed_credits").eq("project_id", PROJECT).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const keys = ["renderMs", "fetchOriginalMs", "codeCheckMs", "upscaleMs", "fetchMasterMs", "overlayMs", "uploadMs"];
    console.log("REPORT " + JSON.stringify({
      status: sc.status, failedReason: sc.failedReason ?? null, stopped,
      timesS: { retryToPlanReady: sec(retriedAt, plan?.completed_at), planBuild: sec(plan?.created_at, plan?.completed_at), drawing: sec(firstStart, lastReady), retryToDone: sec(retriedAt, sc.doneAt ?? new Date().toISOString()) },
      scenes: { total: all?.length, ready: ready.length, failed: (all ?? []).filter((i) => i.status === "failed").length, requeued: (all ?? []).filter((i) => i.attempts > 1).length, medianWorkerS: med(ready.map((i) => i.qa?.wallMs / 1000)), medianStepMs: Object.fromEntries(keys.map((k) => [k, med(ready.map((i) => i.qa?.timings?.[k]))])) },
      spendUsd: { total: Number(spend.toFixed(4)), by }, creditsDrawn: (all ?? []).reduce((a, i) => a + (i.credits_charged ?? 0), 0), reservation: res,
    }));
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 15_000));
}
say("watch timed out after 3 h");
