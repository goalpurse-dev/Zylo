// READ-ONLY launch audit (no writes anywhere): what users made, credit
// correctness, stuck/failed work, money, checkouts and live prices since
// 2026-09-30 22:00 UTC (= 2026-10-01 01:00 Finland). Internal test accounts
// (@zyvo-internal.test) are excluded; the owner account is reported separately.
//   node scripts/fruit-story/launchAudit.mjs <out.json>
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { admin, ROOT } from "./lib.mjs";

const require = createRequire(path.join(ROOT, "package.json"));
for (const f of [".env", ".env.local"]) require("dotenv").config({ path: path.join(ROOT, f), quiet: true, override: f === ".env.local" });
const [out] = process.argv.slice(2);
const SINCE = "2026-09-30T22:00:00Z";
const NOW = new Date().toISOString();
const OWNER = "a8ad2f35-6ad4-4071-bdae-4555afd13f51";
const a = admin();
const STRIPE = process.env.STRIPE_SECRET_KEY;

async function all(table, select, filter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(a.from(table).select(select)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
const stripe = async (p) => (await fetch(`https://api.stripe.com/v1/${p}`, { headers: { Authorization: `Bearer ${STRIPE}` } })).json();
const minsAgo = (iso) => (Date.now() - Date.parse(iso)) / 60000;

/* ─── who is internal / owner ─── */
const profiles = new Map();
async function profile(id) {
  if (!profiles.has(id)) {
    const { data } = await a.from("profiles").select("id,email,created_at,plan_code").eq("id", id).maybeSingle();
    profiles.set(id, data ?? { id, email: null, created_at: null, plan_code: null });
  }
  return profiles.get(id);
}
const isInternal = (p) => String(p?.email ?? "").endsWith("@zyvo-internal.test");
const bucketOf = (p) => (p.id === OWNER ? "owner" : isInternal(p) ? "internal" : "users");

/* ─── prices ─── */
const prices = Object.fromEntries((await all("tool_prices", "tool_key,flat_credits,credits_per_second,min_plan,updated_at")).map((r) => [r.tool_key, r]));
const v4Changed = prices["longform:v4"].updated_at;

/* ─── 1+2+3: AI Fruit v2 ─── */
const stories = await all("fruit_stories", "id,user_id,source,quality,length_sec,status,series_id,episode_number,final_status,final_error,error_code,error,created_at,updated_at,title", (q) => q.gte("created_at", SINCE));
const fruit = [];
for (const s of stories) {
  const p = await profile(s.user_id);
  const jobs = await all("fruit_jobs", "id,kind,tool_key,status,credits,cost_usd,attempt,error_code,error,result,request,refunded_at,created_at,updated_at,submitted_at,provider_done_at,finished_at", (q) => q.eq("story_id", s.id));
  const ledger = await all("fruit_credit_ledger", "id,job_id,operation,credits,reason,created_at", (q) => q.eq("story_id", s.id));
  const calls = await all("fruit_ai_calls", "purpose,cost_usd,ok,response,created_at", (q) => q.eq("story_id", s.id));
  const scenes = await all("fruit_story_scenes", "idx,image_check,image_check_notes,free_regen_used,duration_sec,clip_status,image_status", (q) => q.eq("story_id", s.id));
  const charged = ledger.filter((l) => l.operation === "charge").reduce((x, l) => x + Math.abs(l.credits), 0);
  const refunded = ledger.filter((l) => l.operation === "refund").reduce((x, l) => x + Math.abs(l.credits), 0);
  // Expected price of each job from tool_prices (pictures flat; clips ceil(rate × seconds)).
  const mism = [];
  for (const j of jobs) {
    let expected = null;
    const row = prices[j.tool_key];
    const sec = Number(j.request?.duration ?? j.request?.inputs?.duration ?? 0);
    if (j.kind === "image") expected = row?.flat_credits ?? null;
    else if (j.kind === "clip" && row?.credits_per_second && sec) expected = Math.ceil(row.credits_per_second * sec - 1e-9);
    const chargeRows = ledger.filter((l) => l.job_id === j.id && l.operation === "charge");
    const refundRows = ledger.filter((l) => l.job_id === j.id && l.operation === "refund");
    const jobCharged = chargeRows.reduce((x, l) => x + Math.abs(l.credits), 0);
    const failed = ["failed", "refunded", "cancelled"].includes(j.status);
    if (expected != null && j.credits != null && j.credits !== expected && j.credits !== 0) mism.push({ job: j.id, kind: j.kind, issue: `job credits ${j.credits} ≠ expected ${expected} (${j.tool_key}${sec ? `, ${sec}s` : ""})` });
    if (failed && j.credits > 0 && refundRows.length !== 1) mism.push({ job: j.id, kind: j.kind, issue: `failed job refunded ${refundRows.length}× (expected exactly 1)` });
    if (!failed && refundRows.length) mism.push({ job: j.id, kind: j.kind, issue: `job ${j.status} but refunded` });
    if (refundRows.length === 1 && Math.abs(refundRows[0].credits) !== (j.credits ?? jobCharged)) mism.push({ job: j.id, kind: j.kind, issue: `refund ${Math.abs(refundRows[0].credits)} ≠ charge ${j.credits ?? jobCharged}` });
  }
  const chargedNotGot = jobs.filter((j) => ["failed", "refunded", "cancelled"].includes(j.status) && !j.refunded_at && (j.credits ?? 0) > 0).map((j) => j.id);
  const stuck = jobs.filter((j) => !["succeeded", "failed", "refunded", "cancelled"].includes(j.status) && minsAgo(j.created_at) > 15).map((j) => ({ id: j.id, kind: j.kind, status: j.status, mins: Math.round(minsAgo(j.created_at)) }));
  const jobCost = jobs.reduce((x, j) => x + Number(j.cost_usd || 0), 0);
  const callCost = calls.filter((c) => !["image", "clip"].includes(c.purpose)).reduce((x, c) => x + Number(c.cost_usd || 0), 0);
  const checks = calls.filter((c) => c.purpose === "picture_check");
  fruit.push({
    id: s.id, bucket: bucketOf(p), email: p.email, userId: s.user_id, newUser: p.created_at >= SINCE, title: s.title, kind: s.series_id ? `series ep ${s.episode_number}` : "single",
    quality: s.quality, lengthSec: s.length_sec, status: s.status, finalStatus: s.final_status, errorCode: s.error_code, error: s.error, finalError: s.final_error, created: s.created_at, updated: s.updated_at,
    scenes: scenes.length, jobs: jobs.map((j) => ({ kind: j.kind, status: j.status, credits: j.credits, cost: Number(j.cost_usd || 0), attempt: j.attempt, err: j.error_code, errMsg: j.error, via: j.result?._via ?? null, refunded: Boolean(j.refunded_at), submitToDoneSec: j.submitted_at && j.provider_done_at ? Math.round((Date.parse(j.provider_done_at) - Date.parse(j.submitted_at)) / 1000) : null })),
    charged, refunded, net: charged - refunded, mismatches: mism, chargedNotGot, stuck,
    costUsd: jobCost + callCost, checks: { total: checks.length, failed: checks.filter((c) => c.response?.verdict?.ok === false).length, cost: checks.reduce((x, c) => x + Number(c.cost_usd || 0), 0) },
    redraws: jobs.filter((j) => String(j.error ?? "").startsWith("picture check, redrawn")).length,
    freeRegens: ledger.filter((l) => l.reason === "free_regenerate").length,
  });
}

/* ─── 1+2+3: Long Form ─── */
const projects = await all("long_form_projects", "id,user_id,status,status_reason,scene_generation_tier,resolved_length_minutes,custom_length_minutes,current_scene_generation_status,final_video_path,final_duration_ms,created_at,updated_at,topic,deleted_at", (q) => q.gte("created_at", SINCE));
const lf = [];
for (const pr of projects) {
  const p = await profile(pr.user_id);
  const res = await all("long_form_project_reservations", "status,reserved_credits,committed_credits,released_credits,breakdown,created_at,settled_at", (q) => q.eq("project_id", pr.id));
  const costs = await all("long_form_cost_ledger", "stage,usd", (q) => q.eq("project_id", pr.id));
  const epCharges = await all("long_form_episode_generation_charges", "tier,credits_charged,status,credits_refunded,refunded_at", (q) => q.eq("project_id", pr.id));
  const sceneOps = await all("long_form_scene_operation_charges", "operation,tier,credits,status,refunded_at", (q) => q.eq("project_id", pr.id));
  const r = res[0];
  const label = r?.breakdown?.[0]?.label ?? "";
  const m = label.match(/^([\d.]+)-min video \((V\d)\)/i);
  const minutes = m ? Number(m[1]) : null;
  const tier = m ? m[2].toLowerCase() : pr.scene_generation_tier;
  const perMin = tier === "v4" && r && r.created_at < v4Changed ? 90 : prices[`longform:${tier}`]?.flat_credits;
  const expected = minutes && perMin ? Math.ceil(perMin * minutes) : null;
  lf.push({
    id: pr.id, bucket: bucketOf(p), email: p.email, newUser: p.created_at >= SINCE, topic: pr.topic, tier, minutes, status: pr.status, statusReason: pr.status_reason, sceneStatus: pr.current_scene_generation_status,
    finished: Boolean(pr.final_video_path), finalMin: pr.final_duration_ms ? pr.final_duration_ms / 60000 : null, created: pr.created_at, updated: pr.updated_at, deleted: Boolean(pr.deleted_at),
    reservation: r ? { status: r.status, reserved: r.reserved_credits, committed: r.committed_credits, released: r.released_credits, created: r.created_at } : null,
    expected, perMin, reservationOk: r ? r.reserved_credits === expected : null,
    episodeCharges: epCharges, sceneOps, costUsd: costs.reduce((x, c) => x + Number(c.usd || 0), 0),
    stuckMins: !pr.final_video_path && !["failed", "draft", "complete", "cancelled"].includes(pr.status) ? Math.round(minsAgo(pr.updated_at)) : null,
  });
}

/* ─── 1+2+3: other tools (shared job queue) ─── */
const jobs = await all("jobs", "id,user_id,tool_key,status,charge_credits,charged,credits_charged_at,credits_refunded_at,error_code,error,created_at,updated_at,settings,project_id,attempts", (q) => q.gte("created_at", SINCE));
const otherJobs = [];
for (const j of jobs) {
  if (j.settings?.long_form_internal || j.project_id) continue;
  const p = await profile(j.user_id);
  otherJobs.push({ ...j, bucket: bucketOf(p), email: p.email, newUser: p.created_at >= SINCE, settings: undefined });
}
const lfInternalJobs = jobs.filter((j) => j.settings?.long_form_internal || j.project_id).length;

/* ─── 3: alerts, gate refusals, system errors ─── */
const alerts = await all("fruit_provider_alerts", "*", (q) => q.gte("last_seen_at", SINCE)).catch(() => []);
const sysLogs = await all("system_logs", "source,event,level,created_at,details", (q) => q.gte("created_at", SINCE)).catch((e) => [{ error: e.message }]);

/* ─── 5: checkouts (Stripe, read-only) ─── */
const sinceUnix = Math.floor(Date.parse(SINCE) / 1000);
const sessions = (await stripe(`checkout/sessions?limit=100&created[gte]=${sinceUnix}`)).data ?? [];
const subs = (await stripe(`subscriptions?status=all&limit=100&created[gte]=${sinceUnix}`)).data ?? [];
const invoices = (await stripe(`invoices?limit=100&created[gte]=${sinceUnix}`)).data ?? [];
const grants = await all("credit_grants", "user_id,reason,amount,external_id,created_at", (q) => q.gte("created_at", SINCE));
const checkout = {
  sessions: sessions.map((x) => ({ id: x.id, mode: x.mode, status: x.status, payment: x.payment_status, amount: x.amount_total / 100, currency: x.currency, created: new Date(x.created * 1000).toISOString(), automaticTax: x.automatic_tax?.enabled ?? null, taxStatus: x.automatic_tax?.status ?? null, tax: (x.total_details?.amount_tax ?? 0) / 100, askedAddress: x.billing_address_collection === "required" || x.automatic_tax?.status === "requires_location_inputs", hasAddress: Boolean(x.customer_details?.address?.country), email: x.customer_details?.email ?? x.customer_email ?? null, plan: x.metadata?.plan ?? null })),
  subscriptions: subs.map((x) => ({ id: x.id, status: x.status, created: new Date(x.created * 1000).toISOString(), start: x.start_date, price: x.items?.data?.[0]?.price?.id, amount: (x.items?.data?.[0]?.price?.unit_amount ?? 0) / 100, interval: x.items?.data?.[0]?.price?.recurring?.interval })),
  invoices: invoices.map((x) => ({ id: x.id, status: x.status, reason: x.billing_reason, total: x.total / 100, tax: (x.total_taxes ?? x.total_tax_amounts ?? []).reduce((s, t) => s + (t.amount || 0), 0) / 100, created: new Date(x.created * 1000).toISOString(), sub: x.subscription ?? x.parent?.subscription_details?.subscription ?? null, price: x.lines?.data?.[0]?.price?.id ?? x.lines?.data?.[0]?.pricing?.price_details?.price ?? null })),
  grants: grants.map((g) => ({ ...g, email: null })),
};
for (const g of checkout.grants) g.email = (await profile(g.user_id)).email;

/* ─── 6: live prices ─── */
const live = { v4: prices["longform:v4"], v3: prices["longform:v3"], v2: prices["longform:v2"], v4ChangedAt: v4Changed };

/* ─── 1: users ─── */
const activeIds = new Set([...fruit, ...lf, ...otherJobs].filter((x) => x.bucket === "users").map((x) => x.userId ?? x.user_id ?? null).filter(Boolean));
for (const x of lf) if (x.bucket === "users") activeIds.add(projects.find((p) => p.id === x.id).user_id);
const newSignups = await all("profiles", "id,email,created_at,plan_code", (q) => q.gte("created_at", SINCE));
const firstTime = [];
for (const id of activeIds) {
  const before = await Promise.all([
    a.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", id).lt("created_at", SINCE),
    a.from("fruit_stories").select("id", { count: "exact", head: true }).eq("user_id", id).lt("created_at", SINCE),
    a.from("long_form_projects").select("id", { count: "exact", head: true }).eq("user_id", id).lt("created_at", SINCE),
  ]);
  if (before.every((r) => !r.count)) firstTime.push(id);
}

const result = {
  window: { since: SINCE, until: NOW }, owner: OWNER,
  users: { active: activeIds.size, firstTimeCreators: firstTime.length, newSignups: newSignups.filter((p) => !isInternal(p)).length, newSignupsPaid: newSignups.filter((p) => !isInternal(p) && p.plan_code && p.plan_code !== "free").length },
  fruit, lf, otherJobs, lfInternalJobs, alerts, sysLogs, checkout, live,
};
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ users: result.users, fruit: fruit.length, lf: lf.length, otherJobs: otherJobs.length, lfInternalJobs, sessions: sessions.length, subs: subs.length, invoices: invoices.length, grants: grants.length, alerts: alerts.length, sysLogs: Array.isArray(sysLogs) ? sysLogs.length : sysLogs }, null, 1));
