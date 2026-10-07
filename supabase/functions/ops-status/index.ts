// deno-lint-ignore-file no-explicit-any
// ops-status/index.ts — the admin page's data (2026-10-07). Read-only.
//
// Who may read it: a signed-in user whose email is the owner's alert address
// (ALERT_EMAIL, else CONTACT_TO_EMAIL) or is listed in ADMIN_EMAILS (comma
// separated). Everyone else gets 403. It never returns a user's email, a
// prompt or a key: ids, tool names, counts, credits and dollars only.
//
//   provider   the Runware balance, what work in flight still needs, the guard's threshold and state
//   failures   per hour for the last 24 hours, per pipeline
//   stuck      everything not moving right now (and the old backlog the sweeper leaves alone)
//   today      what the providers cost us vs the credits we charged (UTC day)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { inFlightReserveUsd } from "../_shared/runwareBalance.ts";
import { RECHECK_AFTER_S, SWEEP_CREATED_AFTER_DEFAULT } from "../_shared/stuckJobs.ts";
import { CHEAPEST_CREDIT_USD } from "../_shared/longFormReservations.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const envCutoff = Deno.env.get("SWEEPER_CREATED_AFTER") ?? "";
const CREATED_AFTER = Number.isFinite(Date.parse(envCutoff)) ? new Date(envCutoff).toISOString() : SWEEP_CREATED_AFTER_DEFAULT;

export function adminEmails(): string[] {
  return [Deno.env.get("ALERT_EMAIL"), Deno.env.get("CONTACT_TO_EMAIL"), ...(Deno.env.get("ADMIN_EMAILS") ?? "").split(",")]
    .map((e) => String(e ?? "").trim().toLowerCase()).filter(Boolean);
}

// Every row of a query, a page at a time (the API returns 1,000 rows at most).
async function all(build: () => any, max = 20_000): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error || !data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
const sum = (rows: any[], k: string) => rows.reduce((a, r) => a + Number(r?.[k] ?? 0), 0);
const usd = (n: number) => Number(n.toFixed(2));
const minutesSince = (iso: string | null, nowMs: number) => (iso ? Math.round((nowMs - Date.parse(iso)) / 60000) : null);

async function runwareAccount() {
  const key = Deno.env.get("RUNWARE_API_KEY") ?? "";
  if (!key) return null;
  try {
    const r = await fetch(`${(Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "")}/v1`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ taskType: "accountManagement", taskUUID: crypto.randomUUID(), operation: "getDetails" }]), signal: AbortSignal.timeout(8000),
    });
    const d: any = (await r.json().catch(() => null))?.data?.[0];
    const balance = Number(d?.balance?.amount ?? d?.balance);
    const today = d?.usage?.today ?? null;
    return { balance: Number.isFinite(balance) ? balance : null, usageToday: today ? { credits: Number(today.credits ?? 0), requests: Number(today.requests ?? 0) } : null };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  if (!adminEmails().includes(String(user.email ?? "").toLowerCase())) return err(req, "Not allowed", 403);

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const dayStart = `${now.slice(0, 10)}T00:00:00.000Z`;
  const since24 = new Date(nowMs - 24 * 3600_000).toISOString();
  const stuckBefore = new Date(nowMs - RECHECK_AFTER_S * 1000).toISOString();

  // ---------- provider ----------
  const [{ data: guard }, account, reserve] = await Promise.all([
    admin.from("provider_balance_guard").select("*").eq("provider", "runware").maybeSingle(),
    runwareAccount(),
    inFlightReserveUsd(admin as any, now),
  ]);
  const balance = account?.balance ?? (guard?.balance_usd != null ? Number(guard.balance_usd) : null);
  const provider = {
    name: "Runware", balanceUsd: balance, balanceIsLive: account?.balance != null, inFlightUsd: reserve.usd, inFlight: { jobs: reserve.jobs, fruit: reserve.fruit, scenes: reserve.scenes },
    freeUsd: balance != null ? usd(balance - reserve.usd) : null, thresholdUsd: guard ? Number(guard.threshold_usd) : null,
    paused: !!guard?.paused, pausedSince: guard?.paused_since ?? null, lastError: guard?.paused ? String(guard?.last_error ?? "").slice(0, 200) || null : null, checkedAt: guard?.checked_at ?? null,
    providerUsageToday: account?.usageToday ?? null,
  };

  // ---------- failures per hour, last 24 h ----------
  const [jobFails, sceneFails, fruitFails, renderFails, voiceFails, jobOk, sceneOk, fruitOk] = await Promise.all([
    all(() => admin.from("jobs").select("failed_at, tool_key").eq("status", "failed").gte("failed_at", since24).order("failed_at")),
    all(() => admin.from("long_form_scene_images").select("started_at").eq("status", "failed").gte("started_at", since24).order("started_at")),
    all(() => admin.from("fruit_jobs").select("finished_at").eq("status", "failed").gte("finished_at", since24).order("finished_at")),
    all(() => admin.from("long_form_render_jobs").select("finished_at").eq("status", "failed").is("parent_job_id", null).gte("finished_at", since24).order("finished_at")),
    all(() => admin.from("long_form_narration_audio_versions").select("last_error_at").eq("status", "failed").gte("last_error_at", since24).order("last_error_at")),
    admin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "succeeded").gte("completed_at", since24),
    admin.from("long_form_scene_images").select("id", { count: "exact", head: true }).eq("status", "ready").gte("ready_at", since24),
    admin.from("fruit_jobs").select("id", { count: "exact", head: true }).eq("status", "succeeded").gte("finished_at", since24),
  ]);
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: new Date(Math.floor(nowMs / 3600_000) * 3600_000 - (23 - i) * 3600_000).toISOString(), tools: 0, scenes: 0, fruit: 0, renders: 0, voice: 0 }));
  const bucket = (rows: any[], k: string, field: "tools" | "scenes" | "fruit" | "renders" | "voice") => { for (const r of rows) { const h = hours.find((x) => x.hour === new Date(Math.floor(Date.parse(r[k]) / 3600_000) * 3600_000).toISOString()); if (h) h[field]++; } };
  bucket(jobFails, "failed_at", "tools"); bucket(sceneFails, "started_at", "scenes"); bucket(fruitFails, "finished_at", "fruit"); bucket(renderFails, "finished_at", "renders"); bucket(voiceFails, "last_error_at", "voice");
  const byTool: Record<string, number> = {};
  for (const j of jobFails) byTool[j.tool_key ?? "?"] = (byTool[j.tool_key ?? "?"] ?? 0) + 1;
  const failures = {
    hours,
    last24h: {
      tools: { failed: jobFails.length, ok: jobOk.count ?? 0 }, scenes: { failed: sceneFails.length, ok: sceneOk.count ?? 0 }, fruit: { failed: fruitFails.length, ok: fruitOk.count ?? 0 },
      renders: { failed: renderFails.length }, voice: { failed: voiceFails.length },
    },
    topFailingTools: Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tool, failed]) => ({ tool, failed })),
  };

  // ---------- stuck right now ----------
  const [stuckJobs, oldJobs, lateScenes, liveRenders, voiceRows, fruitOpen, twoAm] = await Promise.all([
    admin.from("jobs").select("id, tool_key, status, created_at, claimed_at, charged, charge_credits").in("status", ["queued", "running", "processing"]).gte("created_at", CREATED_AFTER).lt("created_at", stuckBefore).order("created_at").limit(50),
    all(() => admin.from("jobs").select("charged, charge_credits").in("status", ["queued", "running", "processing"]).lt("created_at", CREATED_AFTER), 5000),
    admin.from("long_form_scene_images").select("id, project_id, beat_sequence, status, started_at, lease_until").eq("status", "rendering").lt("lease_until", new Date(nowMs - 5 * 60_000).toISOString()).limit(50),
    admin.from("long_form_render_jobs").select("id, project_id, status, attempt, max_attempts, created_at, heartbeat_at, error_code").in("status", ["queued", "rendering", "waiting"]).is("parent_job_id", null).lt("created_at", new Date(nowMs - 30 * 60_000).toISOString()).limit(30),
    admin.from("long_form_narration_audio_versions").select("id, project_id, created_at, lease_until, provider_metadata").eq("status", "generating").lt("created_at", stuckBefore).limit(30),
    admin.from("fruit_jobs").select("id, kind, status, created_at, credits").in("status", ["queued", "submitting", "submitted", "provider_done"]).lt("created_at", stuckBefore).limit(50),
    admin.from("two_am_generations").select("id, created_at, reserved_credits, status").eq("reservation_status", "reserved").lt("created_at", new Date(nowMs - 30 * 60_000).toISOString()).limit(30),
  ]);
  const stuck = {
    jobs: (stuckJobs.data ?? []).map((j: any) => ({ id: j.id, tool: j.tool_key, status: j.status, minutes: minutesSince(j.claimed_at ?? j.created_at, nowMs), credits: j.charged ? Number(j.charge_credits ?? 0) : 0 })),
    scenes: (lateScenes.data ?? []).map((s: any) => ({ id: s.id, project: s.project_id, scene: s.beat_sequence, minutes: minutesSince(s.started_at, nowMs) })),
    renders: (liveRenders.data ?? []).map((r: any) => ({ id: r.id, project: r.project_id, status: r.status, attempt: `${r.attempt}/${r.max_attempts}`, minutes: minutesSince(r.created_at, nowMs), lastHeartbeatMinutes: minutesSince(r.heartbeat_at, nowMs) })),
    voice: (voiceRows.data ?? []).map((v: any) => ({ id: v.id, project: v.project_id, minutes: minutesSince(v.created_at, nowMs), paused: v.provider_metadata?.phase === "paused", tries: v.provider_metadata?.paused?.tries ?? 0 })),
    fruit: (fruitOpen.data ?? []).map((f: any) => ({ id: f.id, kind: f.kind, status: f.status, minutes: minutesSince(f.created_at, nowMs), credits: f.credits })),
    twoAm: (twoAm.data ?? []).map((g: any) => ({ id: g.id, status: g.status, minutes: minutesSince(g.created_at, nowMs), credits: g.reserved_credits })),
    // Work from before the sweeper's start date: it is never touched automatically.
    oldBacklog: { since: CREATED_AFTER, jobs: oldJobs.length, chargedJobs: oldJobs.filter((j) => j.charged).length, chargedCredits: sum(oldJobs.filter((j) => j.charged), "charge_credits") },
  };

  // ---------- today: what it cost vs what was charged ----------
  const [lfCost, fruitCost, genLedger, fruitLedger, lfSettled, lfHeld] = await Promise.all([
    all(() => admin.from("long_form_cost_ledger").select("usd, provider").gte("created_at", dayStart)),
    all(() => admin.from("fruit_jobs").select("cost_usd").gte("updated_at", dayStart).gt("cost_usd", 0)),
    all(() => admin.from("generation_credit_ledger").select("operation, amount").gte("created_at", dayStart)),
    all(() => admin.from("fruit_credit_ledger").select("operation, credits").gte("created_at", dayStart)),
    all(() => admin.from("long_form_project_reservations").select("committed_credits").eq("status", "settled").gte("settled_at", dayStart)),
    all(() => admin.from("long_form_project_reservations").select("reserved_credits, released_credits, status").gte("created_at", dayStart)),
  ]);
  const byProvider: Record<string, number> = {};
  for (const r of lfCost) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + Number(r.usd ?? 0);
  const net = (rows: any[], k: string) => sum(rows.filter((r) => r.operation === "charge"), k) - sum(rows.filter((r) => r.operation === "refund"), k);
  const credits = { tools: net(genLedger, "amount"), fruit: net(fruitLedger, "credits"), longFormSettled: sum(lfSettled, "committed_credits") };
  const totalCredits = credits.tools + credits.fruit + credits.longFormSettled;
  const spend = { longFormUsd: usd(sum(lfCost, "usd")), longFormByProvider: Object.fromEntries(Object.entries(byProvider).map(([k, v]) => [k, usd(v)])), fruitUsd: usd(sum(fruitCost, "cost_usd")) };
  const today = {
    day: now.slice(0, 10),
    spend: { ...spend, knownUsd: usd(spend.longFormUsd + spend.fruitUsd), note: "The image and video tools' provider cost is not recorded per job: for those, read Runware's own number for today above." },
    credits: { ...credits, total: totalCredits, valueUsd: usd(totalCredits * CHEAPEST_CREDIT_USD), usdPerCredit: CHEAPEST_CREDIT_USD,
      refundedToday: sum(genLedger.filter((r) => r.operation === "refund"), "amount") + sum(fruitLedger.filter((r) => r.operation === "refund"), "credits"),
      longFormHeldToday: sum(lfHeld.filter((r) => r.status === "reserved"), "reserved_credits"), longFormReleasedToday: sum(lfHeld, "released_credits") },
  };

  return ok(req, { ok: true, at: now, provider, failures, stuck, today });
});
