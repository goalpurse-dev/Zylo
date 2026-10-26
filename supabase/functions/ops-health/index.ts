// deno-lint-ignore-file no-explicit-any
// ops-health/index.ts — the owner's health check of every outside service (2026-10-26).
//
// Called every 10 minutes by the cron job ops-health (x-ops-secret; verify_jwt = false):
//   - reads each service: does it answer, its balance, how fast we use it, real users failing
//     (the owner's own accounts — ADMIN_EMAILS, CUTAWAY_TEST_USERS — never count)
//   - keeps a reading of the Runware and ElevenLabs balances every 30 minutes (provider_balance_history),
//     so "days left" comes from what was really used
//   - instant alert when a real problem is found (grouped by adminAlert.ts: once per 6 hours per kind)
//   - the daily email on the first tick from 9:00 Finnish time
//   POST { action: "tick" }                      the cron call
//   POST { action: "report", send?: true }       the report now (JSON; send: also email it, as a preview)
// Reads only: it never pauses, stops or retries anything.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alertAdmin } from "../_shared/adminAlert.ts";
import { readRunwareBalance } from "../_shared/runwareBalance.ts";
import { SERVICES, dailyReport, helsinkiClock, instantAlerts, judge, ownerEmails, ratePerDay, REPORT_HOUR_HELSINKI } from "../_shared/opsHealth.js";

const SECRET = Deno.env.get("OPS_HEALTH_SECRET") ?? "";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const sum = (rows: any[] | null, k: string) => (rows ?? []).reduce((a, r) => a + Number(r?.[k] ?? 0), 0);

async function ping(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any; error?: string }> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    const body = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, body, error: r.ok ? undefined : `${r.status} ${String(body?.error?.message ?? body?.detail?.message ?? body?.message ?? "").slice(0, 120)}`.trim() };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: String((e as any)?.message ?? e).slice(0, 120) };
  }
}

// The owner's own Long Form projects and user ids (their tests never count as real users failing).
async function ownerIds(): Promise<{ users: Set<string>; projects: Set<string> }> {
  const emails = ownerEmails(env("ADMIN_EMAILS"), env("CUTAWAY_TEST_USERS"));
  if (!emails.length) return { users: new Set(), projects: new Set() };
  const { data: profs } = await sb.from("profiles").select("id").in("email", emails);
  const users = new Set((profs ?? []).map((p: any) => p.id));
  const { data: projects } = users.size ? await sb.from("long_form_projects").select("id").in("user_id", [...users]) : { data: [] };
  return { users, projects: new Set((projects ?? []).map((p: any) => p.id)) };
}

async function history(provider: string, value: number | null, unit: string) {
  if (value == null) return [] as { balance: number; at: string }[];
  const { data: last } = await sb.from("provider_balance_history").select("at").eq("provider", provider).order("at", { ascending: false }).limit(1);
  if (!last?.[0] || Date.parse(last[0].at) < Date.now() - 30 * 60_000) await sb.from("provider_balance_history").insert({ provider, balance: value, unit });
  const { data } = await sb.from("provider_balance_history").select("balance, at").eq("provider", provider).gte("at", hoursAgo(72)).order("at");
  return (data ?? []).map((r: any) => ({ balance: Number(r.balance), at: r.at }));
}

// Our own cost records, per day over the last 7 days (until enough balance readings exist).
async function ledgerPerDay(provider: string): Promise<number> {
  const since = hoursAgo(7 * 24);
  // Summed 1,000 rows at a time (PostgREST returns at most 1,000 per call).
  const q = async (table: string, col: string, prov = true) => {
    let total = 0;
    for (let from = 0; from < 200_000; from += 1000) {
      let b = sb.from(table).select(col).gte("created_at", since);
      if (prov) b = b.eq("provider", provider);
      const { data, error } = await b.order("id").range(from, from + 999);
      if (error || !data) break;
      total += sum(data as any, col);
      if (data.length < 1000) break;
    }
    return total;
  };
  let usd = (await q("long_form_cost_ledger", "usd")) + (await q("fruit_ai_calls", "cost_usd")) + (await q("blocky_ai_calls", "cost_usd")) + (await q("cutaway_cost_ledger", "usd"));
  if (provider === "runware") usd += (await q("fruit_jobs", "cost_usd", false)) + (await q("blocky_jobs", "cost_usd", false));
  return usd / 7;
}

async function collect() {
  const own = await ownerIds();
  const real = (projectId: unknown, userId?: unknown) => !(projectId && own.projects.has(String(projectId))) && !(userId && own.users.has(String(userId)));
  const out: Record<string, any> = {};

  // Runware: balance, rate, real users' failures in the last hour (Long Form scenes covered, failed tool jobs).
  {
    const balance = env("RUNWARE_API_KEY") ? await readRunwareBalance(env("RUNWARE_API_KEY")) : null;
    const points = await history("runware", balance, "usd");
    const measured = ratePerDay(points);
    const perDay = measured ?? await ledgerPerDay("runware");
    const { data: covered } = await sb.from("system_logs").select("details").eq("source", "render-long-form-scene").eq("event", "scene_covered").gte("created_at", hoursAgo(1)).limit(500);
    const { data: jobsFailed } = await sb.from("jobs").select("user_id").eq("provider", "runware").eq("status", "failed").gte("created_at", hoursAgo(1)).limit(500);
    const lf = (covered ?? []).filter((l: any) => real(l.details?.projectId));
    const jf = (jobsFailed ?? []).filter((j: any) => real(null, j.user_id));
    const { data: guard } = await sb.from("provider_balance_guard").select("paused, last_error").eq("provider", "runware").maybeSingle();
    // One failed balance read is not an outage (it happened on the first tick, 2026-10-26): unknown, not red.
    // Real trouble shows as real users' failures or a paused guard.
    out.runware = { reachable: balance != null ? true : undefined, balance, unit: "usd", perDay, perDaySource: measured != null ? "measured" : "estimate",
      failures: lf.length + jf.length, failingUsers: new Set([...lf.map((l: any) => l.details?.projectId), ...jf.map((j: any) => j.user_id)]).size,
      note: guard?.paused ? `drawing paused (${String(guard.last_error ?? "").slice(0, 60)})` : undefined };
  }

  // ElevenLabs: the plan's characters left, when the quota resets, the rate, real users' voice failures.
  {
    const r = await ping("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": env("ELEVENLABS_KEY") } });
    const left = r.ok ? Math.max(0, Number(r.body?.character_limit ?? 0) - Number(r.body?.character_count ?? 0)) : null;
    const used = r.ok ? Number(r.body?.character_count ?? 0) : null;
    const points = used != null ? (await history("elevenlabs_used", used, "characters")).map((p) => ({ balance: -p.balance, at: p.at })) : [];
    const measured = ratePerDay(points);
    let perDay = measured;
    if (perDay == null) {
      const { data: v } = await sb.from("long_form_narration_audio_versions").select("provider_metadata").gte("created_at", hoursAgo(7 * 24)).limit(2000);
      perDay = (v ?? []).reduce((a: number, x: any) => a + Number(x.provider_metadata?.characterCount ?? 0), 0) / 7;
    }
    const resetUnix = Number(r.body?.next_character_count_reset_unix ?? 0);
    const { data: vl } = await sb.from("system_logs").select("event, details").eq("source", "generate-long-form-narration-audio").in("event", ["narration_failed", "narration_paused"]).gte("created_at", hoursAgo(1)).limit(500);
    const bad = (vl ?? []).filter((l: any) => real(l.details?.projectId) && (l.event === "narration_failed" || /\b40[123]\b|quota_exceeded|insufficient|payment|invalid_api_key/i.test(String(l.details?.error ?? "")) || Number(l.details?.tries ?? 0) >= 3));
    // A key without the user_read permission can't read the plan: then "working" comes from a
    // voiceover that finished lately, and the balance is unknown (the report says how to fix it).
    const noPermission = r.status === 401 && /user_read|permission/i.test(String(r.error ?? ""));
    let reachable: boolean | undefined = r.ok;
    if (noPermission) {
      const { count } = await sb.from("long_form_narration_audio_versions").select("id", { count: "exact", head: true }).eq("status", "ready").gte("updated_at", hoursAgo(12));
      reachable = (count ?? 0) > 0 ? true : undefined;
    }
    out.elevenlabs = { reachable, error: noPermission ? undefined : r.error, balance: left, unit: "characters", perDay, perDaySource: measured != null ? "measured" : "estimate",
      resetsInDays: resetUnix ? Math.max(0, (resetUnix * 1000 - Date.now()) / 864e5) : undefined, failures: bad.length, failingUsers: new Set(bad.map((l: any) => l.details?.projectId)).size,
      note: r.ok ? `plan ${r.body?.tier ?? "?"}` : noPermission ? "credits left can't be read: give our ElevenLabs API key the \"User: read\" permission (or make a new key with it)" : undefined };
  }

  // OpenAI / Anthropic: no balance can be read with an API key; do they answer, what we spend.
  {
    const r = await ping("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}` } });
    out.openai = { reachable: r.ok, error: r.error, perDay: await ledgerPerDay("openai"), perDaySource: "estimate", unit: "usd", note: "balance can't be read by API: keep auto recharge on" };
  }
  {
    // The token count endpoint is free and needs the same permission as real requests (the models
    // list answered "invalid x-api-key" for a key that writes fine, 2026-10-26).
    const r = await ping("https://api.anthropic.com/v1/messages/count_tokens", { method: "POST", headers: { "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", messages: [{ role: "user", content: "ping" }] }) });
    out.anthropic = { reachable: r.ok, error: r.error, perDay: await ledgerPerDay("anthropic"), perDaySource: "estimate", unit: "usd", note: "balance can't be read by API: keep auto-reload on" };
  }
  // Fly.io: the renderer app answers.
  {
    const app = env("FLY_RENDER_APP");
    const r = app ? await ping(`https://api.machines.dev/v1/apps/${app}/machines`, { headers: { Authorization: `Bearer ${env("FLY_API_TOKEN")}` } }) : { ok: false, error: "FLY_RENDER_APP not set" } as any;
    out.fly = { reachable: r.ok, error: r.error, perDay: await ledgerPerDay("fly"), perDaySource: "estimate", unit: "usd" };
  }
  // RunPod (Cutaway, owner tests only): balance and spend per hour.
  {
    const key = env("CUTAWAY_RUNPOD_API_KEY");
    const r = key ? await ping("https://api.runpod.io/graphql", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: "query { myself { clientBalance currentSpendPerHr } }" }) }) : { ok: false, error: "no key" } as any;
    const me = r.body?.data?.myself;
    out.runpod = { reachable: r.ok && !!me, error: r.ok && !me ? "no balance in the answer" : r.error, balance: me ? Number(me.clientBalance) : null, unit: "usd",
      perDay: me ? Math.max(Number(me.currentSpendPerHr ?? 0) * 24, await ledgerPerDay("runpod")) : null, perDaySource: "estimate" };
  }
  // Resend: emails are going out (delivered events in the last 2 days).
  {
    const { count } = await sb.from("email_events").select("id", { count: "exact", head: true }).eq("type", "email.delivered").gte("created_at", hoursAgo(48));
    const { count: sends } = await sb.from("email_sends").select("id", { count: "exact", head: true }).gte("sent_at", hoursAgo(48));
    out.resend = { reachable: (count ?? 0) > 0 || (sends ?? 0) > 0 ? true : undefined, note: `${sends ?? 0} emails to users in 2 days` };
  }
  // Stripe: answers.
  {
    const r = await ping("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` } });
    out.stripe = { reachable: r.ok, error: r.error };
  }
  out.supabase = { reachable: true, note: "this check runs on it" };
  {
    const r = await fetch("https://www.tryzyvo.com/", { signal: AbortSignal.timeout(10_000) }).then((x) => ({ ok: x.ok, status: x.status })).catch((e) => ({ ok: false, status: 0, e: String(e) }));
    out.vercel = { reachable: r.ok, error: r.ok ? undefined : `tryzyvo.com answered ${r.status}` };
  }
  return SERVICES.filter((s) => s.checked).map((service) => {
    const state = out[service.id] ?? {};
    return { service, state, judged: judge(service, state) };
  });
}

async function tick() {
  const results = await collect();
  const alerts = instantAlerts(results);
  for (const a of alerts) await alertAdmin(a.subject, a.text, "ops-health"); // grouped: once per 6 h per kind
  const now = new Date().toISOString();
  const clock = helsinkiClock(now);
  let reportSent = false;
  if (clock.hour === REPORT_HOUR_HELSINKI) {
    const { data: done } = await sb.from("system_logs").select("id").eq("source", "ops-health").eq("event", "daily_report").eq("message", clock.date).limit(1);
    if (!done?.length) {
      await sb.from("system_logs").insert({ source: "ops-health", level: "info", event: "daily_report", message: clock.date, details: { red: results.filter((r) => r.judged.red.length).map((r) => r.service.id) } });
      const rep = dailyReport(results, now);
      reportSent = await alertAdmin(`${rep.subject} — ${clock.date}`, rep.text, "ops-health");
    }
  }
  return { alerts: alerts.map((a) => a.subject), reportSent, red: results.filter((r) => r.judged.red.length).map((r) => r.service.id) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SECRET || req.headers.get("x-ops-secret") !== SECRET) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === "report") {
      const results = await collect();
      const rep = dailyReport(results, new Date().toISOString());
      const sent = body?.send === true ? await alertAdmin(`[preview] ${rep.subject}`, rep.text, "ops-health") : false;
      return json({ sent, subject: rep.subject, text: rep.text, results: results.map((r) => ({ id: r.service.id, red: r.judged.red, left: r.judged.left, state: r.state })) });
    }
    return json({ ok: true, ...(await tick()) });
  } catch (e) {
    console.error("[ops-health] failed:", String((e as any)?.message ?? e));
    return json({ error: "failed" }, 500);
  }
});
