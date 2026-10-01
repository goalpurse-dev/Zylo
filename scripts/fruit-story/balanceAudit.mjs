// READ-ONLY per-user balance check since launch (2026-09-30 22:00 UTC).
// Every credit movement since launch, per user, from each tool's own records:
//   + credit_grants (plan renewals, packs, bonuses)
//   − fruit_credit_ledger charges, + its refunds
//   − generation_credit_ledger charges (shared job queue), + its refunds
//   − Long Form reservations made, + released credits
// The database keeps no balance history, so "balance at launch" is
// implied = current − net change. For users who signed up after launch it
// must be 0 — an independent check. Flags: double refunds, charges without a
// job, finished jobs without a charge, unsettled reservations, and
// disagreement between a job's own charged/refunded flags and its ledger.
//   node scripts/fruit-story/balanceAudit.mjs <out.json>
import fs from "fs";
import { admin } from "./lib.mjs";

const [out] = process.argv.slice(2);
const SINCE = "2026-09-30T22:00:00Z";
const a = admin();
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

const grants = await all("credit_grants", "user_id,reason,amount,external_id,created_at", (q) => q.gte("created_at", SINCE));
const fruitLedger = await all("fruit_credit_ledger", "id,user_id,story_id,job_id,operation,credits,reason,created_at", (q) => q.gte("created_at", SINCE));
const genLedger = await all("generation_credit_ledger", "id,job_id,user_id,operation,amount,created_at", (q) => q.gte("created_at", SINCE));
const reservations = await all("long_form_project_reservations", "id,project_id,user_id,status,reserved_credits,committed_credits,released_credits,created_at,settled_at", (q) => q.or(`created_at.gte.${SINCE},settled_at.gte.${SINCE}`));
const jobsWin = await all("jobs", "id,user_id,tool_key,status,charge_credits,charged,credits_charged_at,credits_refunded_at,created_at,settings,project_id", (q) => q.or(`created_at.gte.${SINCE},credits_charged_at.gte.${SINCE},credits_refunded_at.gte.${SINCE}`));
const fruitJobs = await all("fruit_jobs", "id,user_id,story_id,kind,status,credits,refunded_at,created_at", (q) => q.gte("created_at", SINCE));

const users = new Set([...grants, ...fruitLedger, ...genLedger, ...reservations].map((r) => r.user_id));
for (const j of jobsWin) if (j.charged || j.credits_refunded_at) users.add(j.user_id);
const rows = [];
for (const id of users) {
  const { data: p } = await a.from("profiles").select("email,created_at,credit_balance,plan_code").eq("id", id).maybeSingle();
  if (!p || String(p.email).endsWith("@zyvo-internal.test")) continue;
  const g = grants.filter((x) => x.user_id === id);
  const fl = fruitLedger.filter((x) => x.user_id === id);
  const gl = genLedger.filter((x) => x.user_id === id);
  const rs = reservations.filter((x) => x.user_id === id);
  const received = g.reduce((s, x) => s + x.amount, 0);
  const fruitSpent = fl.filter((x) => x.operation === "charge").reduce((s, x) => s + Math.abs(x.credits), 0);
  const fruitRefund = fl.filter((x) => x.operation === "refund").reduce((s, x) => s + Math.abs(x.credits), 0);
  const jobSpent = gl.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0);
  const jobRefund = gl.filter((x) => x.amount < 0).reduce((s, x) => s - x.amount, 0);
  const reservedNew = rs.filter((x) => x.created_at >= SINCE).reduce((s, x) => s + x.reserved_credits, 0);
  const released = rs.filter((x) => x.settled_at && x.settled_at >= SINCE).reduce((s, x) => s + (x.released_credits || 0), 0);
  const stillReserved = rs.filter((x) => x.status === "reserved").reduce((s, x) => s + x.reserved_credits, 0);
  const net = received - fruitSpent - jobSpent + fruitRefund + jobRefund - reservedNew + released;
  const newUser = p.created_at >= SINCE;
  const implied = p.credit_balance - net;
  rows.push({
    id, email: p.email, plan: p.plan_code, newUser, current: p.credit_balance,
    received, spent: fruitSpent + jobSpent + reservedNew - 0, fruitSpent, jobSpent, reservedNew, refunds: fruitRefund + jobRefund, fruitRefund, jobRefund, released, stillReserved,
    net, impliedLaunch: implied, expectedNow: newUser ? net : null, diff: newUser ? p.credit_balance - net : null,
    grants: g.map((x) => `${x.created_at.slice(5, 16)} ${x.reason} +${x.amount}`),
  });
}

/* ─── flags ─── */
const flags = { doubleRefunds: [], chargeWithoutJob: [], finishedWithoutCharge: [], unsettledReservations: [], ledgerVsJobFlags: [] };
// Fruit: per job, refunds > 1; charge rows with no job; succeeded jobs with credits but no charge row.
const fruitJobIds = new Set(fruitJobs.map((j) => j.id));
const byJob = new Map();
for (const l of fruitLedger) if (l.job_id) (byJob.get(l.job_id) ?? byJob.set(l.job_id, []).get(l.job_id)).push(l);
for (const [job, ls] of byJob) {
  if (ls.filter((l) => l.operation === "refund").length > 1) flags.doubleRefunds.push({ ledger: "fruit", job, rows: ls.length });
  if (!fruitJobIds.has(job)) {
    const { data } = await a.from("fruit_jobs").select("id").eq("id", job).maybeSingle();
    if (!data) flags.chargeWithoutJob.push({ ledger: "fruit", job });
  }
}
for (const l of fruitLedger.filter((x) => !x.job_id)) flags.chargeWithoutJob.push({ ledger: "fruit", note: "no job id (story-level step)", reason: l.reason, credits: l.credits, story: l.story_id });
for (const j of fruitJobs.filter((j) => j.status === "succeeded" && (j.credits ?? 0) > 0)) {
  if (!(byJob.get(j.id) ?? []).some((l) => l.operation === "charge")) flags.finishedWithoutCharge.push({ ledger: "fruit", job: j.id, kind: j.kind, credits: j.credits });
}
// Shared queue: generation ledger vs the job rows.
const genByJob = new Map();
for (const l of genLedger) (genByJob.get(l.job_id) ?? genByJob.set(l.job_id, []).get(l.job_id)).push(l);
for (const [job, ls] of genByJob) {
  if (ls.filter((l) => l.amount < 0).length > 1) flags.doubleRefunds.push({ ledger: "jobs", job, rows: ls.length });
  const jr = jobsWin.find((x) => x.id === job) ?? (await a.from("jobs").select("id,charged,credits_refunded_at,charge_credits,status").eq("id", job).maybeSingle()).data;
  if (!jr) { flags.chargeWithoutJob.push({ ledger: "jobs", job }); continue; }
  const charged = ls.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0), refunded = ls.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0);
  if (Boolean(jr.charged) !== (charged > 0) || Boolean(jr.credits_refunded_at) !== (refunded > 0)) flags.ledgerVsJobFlags.push({ job, status: jr.status, jobCharged: jr.charged, jobRefunded: Boolean(jr.credits_refunded_at), ledgerCharged: charged, ledgerRefunded: refunded });
}
for (const j of jobsWin.filter((x) => x.status === "succeeded" && (x.charge_credits ?? 0) > 0 && !x.charged && !x.settings?.long_form_internal && !String(x.settings?.test ?? "").includes("fix check") && !String(x.settings?.test ?? "").includes("negativePrompt"))) {
  flags.finishedWithoutCharge.push({ ledger: "jobs", job: j.id, tool: j.tool_key, credits: j.charge_credits, created: j.created_at });
}
for (const r of reservations.filter((x) => x.status === "reserved")) flags.unsettledReservations.push({ reservation: r.id, project: r.project_id, user: r.user_id, reserved: r.reserved_credits, since: r.created_at });

fs.writeFileSync(out, JSON.stringify({ since: SINCE, rows, flags }, null, 1));
rows.sort((x, y) => Math.abs(y.diff ?? 0) - Math.abs(x.diff ?? 0));
for (const r of rows) console.log(`${(r.email ?? "").slice(0, 28).padEnd(28)} ${r.newUser ? "NEW" : "   "} now ${String(r.current).padStart(6)} | +grants ${r.received} −fruit ${r.fruitSpent} −jobs ${r.jobSpent} −reserved ${r.reservedNew} +refunds ${r.refunds} +released ${r.released} | net ${r.net} | ${r.newUser ? `expected ${r.expectedNow} diff ${r.diff}` : `implied launch balance ${r.impliedLaunch}`}`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, v.length]))));
