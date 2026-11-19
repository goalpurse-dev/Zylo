// deno-lint-ignore-file no-explicit-any
// checkout-reminders/index.ts — the unfinished-checkout emails (_shared/checkoutReminders.js has the rules and texts).
// The old abandoned-checkout-processor and its table of old checkouts are NOT used: nothing here reads them.
//
// Called with the x-ops-secret header (vault ops_health_secret) by the cron job checkout-reminders every 10 minutes,
// and only while checkout_reminder_settings.on is true (the database doesn't even call it otherwise):
//   { action: "tick" }   reads the last 8 days of Stripe checkouts, starts a sequence for each new one opened after
//                        the switch went on, stops the ones who paid, sends what is due (small numbers: per tick and a day)
// The owner (ADMIN_EMAILS, signed in) from /admin/checkout-reminders:
//   { action: "stats" }  the numbers per email, the switch, the latest sequences
//   { action: "dry" }    what a tick would do right now: sends nothing, whatever the switch says
//   { action: "test" }   one proof copy of each email to the owner's own address (a test claim: no customer gets it)
//   { action: "switch", on }   turns the emails on or off; the first "on" sets starts_at = now (only later checkouts count)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkEmailAddress, REPLY_TO, WELCOME_SENDER } from "../_shared/emailRules.js";
import { claimEmail, FINAL_REASONS, sendClaimedEmailWithId } from "../_shared/userEmail.ts";
import { nextAction, planOfPrice, reminderEmail, reminderStats, STOP_LABELS, STEP_LABELS } from "../_shared/checkoutReminders.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const STRIPE = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const DAY = 86400000;
const LOOKBACK_DAYS = 8;
const PAID_REASONS = ["plan_renewal", "plan_upgrade", "subscription_create", "topup"];
const json = (body: unknown, status = 200, req?: Request) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...(req ? cors(req) : {}) } });
const emails = (name: string) => (Deno.env.get(name) ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const OWNERS = new Set([...emails("ADMIN_EMAILS"), ...emails("CUTAWAY_TEST_USERS")]);

function cors(req: Request) {
  return {
    "access-control-allow-origin": req.headers.get("Origin") || "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
}

async function rows(q: any): Promise<any[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
async function byIds(ids: string[], q: (chunk: string[]) => any): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(...(await rows(q(ids.slice(i, i + 100)))));
  return out;
}

async function settings() {
  const { data, error } = await admin.from("checkout_reminder_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`settings: ${error.message}`);
  return data ?? { on: false, starts_at: null, daily_cap: 40, per_tick: 5, skip_emails: [] };
}

/** Every live checkout session of the last 8 days (newest first). */
async function stripeSessions(sinceMs: number): Promise<any[]> {
  if (!STRIPE) throw new Error("STRIPE_SECRET_KEY missing");
  const out: any[] = [];
  let after = "";
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ limit: "100", "created[gte]": String(Math.floor(sinceMs / 1000)) });
    if (after) q.set("starting_after", after);
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${q}`, { headers: { Authorization: `Bearer ${STRIPE}` } });
    const j: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`stripe: ${j?.error?.message ?? res.status}`);
    out.push(...(j.data ?? []));
    if (!j.has_more || !j.data?.length) break;
    after = j.data[j.data.length - 1].id;
  }
  return out.filter((s) => s.livemode);
}

/** The checkout's plan: the session's line item price, read with one call per session we don't know yet. */
async function sessionPrice(id: string): Promise<{ priceId: string | null; amount: number; currency: string }> {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}/line_items?limit=1`, { headers: { Authorization: `Bearer ${STRIPE}` } });
  const j: any = await res.json().catch(() => null);
  const li = j?.data?.[0];
  return { priceId: li?.price?.id ?? null, amount: Number(li?.price?.unit_amount ?? li?.amount_subtotal ?? 0), currency: li?.price?.currency ?? "eur" };
}

/**
 * 1. new sequences for checkouts opened after starts_at (one per person, ever)  2. payments: stop the sequence
 * 3. what to send now. Returns everything the tick or the dry run needs.
 */
async function plan(s: any, now: number) {
  const startsAt = s.starts_at ? Date.parse(s.starts_at) : NaN;
  const sessions = await stripeSessions(Math.max(now - LOOKBACK_DAYS * DAY, Number.isFinite(startsAt) ? startsAt - DAY : 0));
  const skip = new Set([...OWNERS, ...(s.skip_emails ?? []).map((e: string) => String(e).toLowerCase())]);

  // per person: their first and last unpaid subscription checkout since starts_at, and their payments
  const people = new Map<string, { first: any; last: any }>();
  const paidAt = new Map<string, number>();
  for (const x of sessions) {
    const uid = x.metadata?.user_id || x.client_reference_id;
    if (!uid) continue; // no account behind it (the owner's unpaid checks): never emailed
    const at = x.created * 1000;
    if (x.status === "complete") { if (!paidAt.has(uid) || at < paidAt.get(uid)!) paidAt.set(uid, at); continue; }
    if (x.mode !== "subscription" || !Number.isFinite(startsAt) || at < startsAt) continue;
    const p = people.get(uid) ?? { first: x, last: x };
    if (at < p.first.created * 1000) p.first = x;
    if (at > p.last.created * 1000) p.last = x;
    people.set(uid, p);
  }

  const existing = await rows(admin.from("checkout_reminders").select("*").or(`stopped_at.is.null,paid_at.is.null`).gte("opened_at", new Date(now - 30 * DAY).toISOString()));
  const known = new Set((await byIds([...people.keys()], (c) => admin.from("checkout_reminders").select("user_id").in("user_id", c))).map((r) => r.user_id));
  const fresh = [...people.entries()].filter(([uid]) => !known.has(uid));

  // profiles of everyone we may write about or to
  const ids = [...new Set([...fresh.map(([uid]) => uid), ...existing.map((r) => r.user_id)])];
  const profiles = new Map((await byIds(ids, (c) => admin.from("profiles").select("id, email, plan_code, email_updates").in("id", c))).map((p) => [p.id, p]));
  const grants = await byIds(ids, (c) => admin.from("credit_grants").select("user_id, created_at").in("user_id", c).in("reason", PAID_REASONS).gte("created_at", new Date(now - 30 * DAY).toISOString()));
  for (const g of grants) { const t = Date.parse(g.created_at); if (!paidAt.has(g.user_id) || t < paidAt.get(g.user_id)!) paidAt.set(g.user_id, t); }

  const creates: any[] = [];
  for (const [uid, p] of fresh) {
    const prof = profiles.get(uid);
    const price = await sessionPrice(p.last.id);
    const sold = price.priceId ? planOfPrice(price.priceId) : null;
    if (!sold) continue; // a legacy price: not one we sell now
    const address = checkEmailAddress(prof?.email ?? p.last.customer_details?.email ?? "");
    const openedAt = p.first.created * 1000;
    const stop = !address.ok ? "no_email" : skip.has(address.email) || address.email.endsWith("@tryzyvo.com") ? "owner"
      : (paidAt.get(uid) ?? 0) >= openedAt || String(prof?.plan_code ?? "free").toLowerCase() !== "free" ? "paid"
      : prof?.email_updates === false ? "declined" : null;
    creates.push({
      user_id: uid, email: address.email || "-", first_session_id: p.first.id, last_session_id: p.last.id,
      plan_id: sold.plan, billing: sold.billing, price_id: price.priceId, amount: price.amount, currency: price.currency,
      deal: Boolean(p.last.metadata?.deal), source: /welcome\/first-video/.test(p.last.cancel_url ?? "") ? "onboarding" : /long-form/.test(p.last.cancel_url ?? "") ? "long_form" : "pricing_or_paywall",
      opened_at: new Date(openedAt).toISOString(), last_opened_at: new Date(p.last.created * 1000).toISOString(),
      ...(stop ? { stopped_at: new Date(now).toISOString(), stop_reason: stop, ...(stop === "paid" ? { paid_at: new Date(paidAt.get(uid) ?? now).toISOString() } : {}) } : {}),
    });
  }

  // the running ones: a newer visit to checkout moves "left"; payment, "no", plan → stop
  const updates: any[] = [];
  for (const r of existing) {
    const prof = profiles.get(r.user_id);
    const p = people.get(r.user_id);
    const patch: any = {};
    if (p && p.last.created * 1000 > Date.parse(r.last_opened_at)) { patch.last_opened_at = new Date(p.last.created * 1000).toISOString(); patch.last_session_id = p.last.id; }
    const paid = paidAt.get(r.user_id);
    if (!r.paid_at && ((paid && paid >= Date.parse(r.opened_at)) || String(prof?.plan_code ?? "free").toLowerCase() !== "free")) {
      patch.paid_at = new Date(paid ?? now).toISOString();
      if (!r.stopped_at) { patch.stopped_at = new Date(now).toISOString(); patch.stop_reason = "paid"; }
    } else if (!r.stopped_at && prof?.email_updates === false) { patch.stopped_at = new Date(now).toISOString(); patch.stop_reason = "declined"; }
    if (Object.keys(patch).length) updates.push({ id: r.id, patch });
  }
  return { creates, updates, existing };
}

async function tick(dry: boolean) {
  const s = await settings();
  const now = Date.now();
  if (!dry && !s.on) return { skipped: "switched off" };
  if (!dry && !s.starts_at) return { skipped: "never switched on: no starting time yet" };
  // a dry run before the first "on": as if it had been switched on 3 days ago (nothing is written or sent)
  const { creates, updates, existing } = await plan(s.starts_at ? s : { ...s, starts_at: new Date(now - 3 * DAY).toISOString() }, now);
  const newByReason: Record<string, number> = {};
  for (const c of creates) newByReason[c.stop_reason ?? "will_get_emails"] = (newByReason[c.stop_reason ?? "will_get_emails"] ?? 0) + 1;
  const result: any = { created: creates.length, newByReason, stopped: updates.filter((u) => u.patch.stop_reason).length, due: [], sent: 0, skipped: 0, waiting: 0, errors: [] as string[] };
  if (!dry) {
    if (creates.length) await rows(admin.from("checkout_reminders").upsert(creates, { onConflict: "user_id", ignoreDuplicates: true }).select("id"));
    for (const u of updates) await rows(admin.from("checkout_reminders").update({ ...u.patch, updated_at: new Date().toISOString() }).eq("id", u.id).select("id"));
  }

  // what is due: running sequences, oldest first, within the per-tick and the 24-hour caps
  const running = dry
    ? [...existing.map((r) => ({ ...r, ...(updates.find((u) => u.id === r.id)?.patch ?? {}) })), ...creates.map((c, i) => ({ ...c, id: `new-${i}` }))].filter((r) => !r.stopped_at)
    : await rows(admin.from("checkout_reminders").select("*").is("stopped_at", null).order("opened_at", { ascending: true }).limit(200));
  const sends = await byIds(running.map((r) => r.id).filter((id) => !String(id).startsWith("new-")), (c) => admin.from("checkout_reminder_sends").select("*").in("reminder_id", c));
  const { count: last24 } = await admin.from("checkout_reminder_sends").select("reminder_id", { count: "exact", head: true }).not("resend_id", "is", null).gte("sent_at", new Date(now - DAY).toISOString());
  let room = Math.max(0, Math.min(Number(s.per_tick) || 5, (Number(s.daily_cap) || 40) - (last24 ?? 0)));

  for (const r of running) {
    const mine = sends.filter((x) => x.reminder_id === r.id).map((x) => ({ step: x.step, sentAt: x.sent_at, skipped: Boolean(x.skipped) }));
    const next = nextAction({ openedAt: r.opened_at, lastOpenedAt: r.last_opened_at, stopped: Boolean(r.stopped_at) }, mine, now);
    if (next.wait) { result.waiting++; continue; }
    if (next.done) { if (!dry) await admin.from("checkout_reminders").update({ stopped_at: new Date().toISOString(), stop_reason: "done", updated_at: new Date().toISOString() }).eq("id", r.id); continue; }
    if (next.skip) { result.skipped++; if (!dry) await admin.from("checkout_reminder_sends").insert({ reminder_id: r.id, step: next.skip, skipped: next.why }); continue; }
    result.due.push({ step: next.send, plan: r.plan_id, source: r.source });
    if (dry || room <= 0) continue;
    const outcome = await sendStep(r, next.send!);
    if (outcome === "sent") { result.sent++; room--; } else if (outcome !== "later") result.errors.push(outcome);
  }
  return result;
}

/** One email of one sequence: the gate (an account email about their own checkout), Resend, the bookkeeping. */
async function sendStep(r: any, step: number): Promise<string> {
  const claim: any = await claimEmail(admin, r.email, `checkout_reminder_${r.id}_${step}`, "account");
  if (!claim.ok) {
    if (FINAL_REASONS.has(claim.reason)) {
      if (claim.reason === "already_sent") await admin.from("checkout_reminder_sends").insert({ reminder_id: r.id, step, skipped: "already_sent" });
      else await admin.from("checkout_reminders").update({ stopped_at: new Date().toISOString(), stop_reason: "gate", gate_reason: claim.reason, updated_at: new Date().toISOString() }).eq("id", r.id);
      return `gate:${claim.reason}`;
    }
    return "later"; // daily limit or the gate is down: a later tick tries again
  }
  const mail = reminderEmail(step, { id: r.id, plan: r.plan_id, billing: r.billing, amount: r.amount, currency: r.currency });
  const resendId = await sendClaimedEmailWithId(admin, {
    claimId: claim.id, to: r.email, userId: r.user_id, from: WELCOME_SENDER, replyTo: REPLY_TO.founder,
    subject: mail.subject, why: mail.why, render: mail.render, plain: true,
    tags: [{ name: "kind", value: `checkout_reminder_${step}` }, { name: "campaign", value: `checkout_reminder_${step}` }],
  });
  if (resendId === null) return "send failed"; // the claim was released: a later tick tries again
  const { error } = await admin.from("checkout_reminder_sends").insert({ reminder_id: r.id, step, resend_id: resendId || "sent" });
  if (error) console.error("[checkout-reminders] bookkeeping failed after a send:", r.id, step, error.message); // the gate's claim still stops a second copy
  return "sent";
}

async function ownerOf(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  const email = String(data?.user?.email ?? "").toLowerCase();
  return email && emails("ADMIN_EMAILS").includes(email) ? data.user : null;
}

async function stats() {
  const s = await settings();
  const reminders = await rows(admin.from("checkout_reminders").select("id, email, plan_id, billing, source, deal, opened_at, last_opened_at, stopped_at, stop_reason, paid_at").order("opened_at", { ascending: false }).limit(1000));
  const sends = await byIds(reminders.map((r) => r.id), (c) => admin.from("checkout_reminder_sends").select("reminder_id, step, resend_id, sent_at, skipped, clicked_at").in("reminder_id", c));
  const resendIds = sends.map((x) => x.resend_id).filter((x) => x && x !== "sent");
  const emailEvents = await byIds(resendIds, (c) => admin.from("email_events").select("resend_id, type, created_at").in("resend_id", c));
  const stops: Record<string, number> = {};
  for (const r of reminders) if (r.stop_reason) stops[r.stop_reason] = (stops[r.stop_reason] ?? 0) + 1;
  const mask = (e: string) => e.replace(/^(.).*?(.)?@/, (_m, a, b) => `${a}…${b ?? ""}@`);
  return {
    settings: { on: s.on, startsAt: s.starts_at, dailyCap: s.daily_cap, perTick: s.per_tick, skipEmails: (s.skip_emails ?? []).length },
    steps: reminderStats({ sends, reminders, emailEvents }),
    sequences: { total: reminders.length, running: reminders.filter((r) => !r.stopped_at).length, paid: reminders.filter((r) => r.paid_at).length, stops: Object.entries(stops).map(([k, n]) => ({ reason: k, label: STOP_LABELS[k as keyof typeof STOP_LABELS] ?? k, n })) },
    latest: reminders.slice(0, 25).map((r) => ({
      email: mask(r.email), plan: r.plan_id, source: r.source, deal: r.deal, openedAt: r.opened_at, stop: r.stop_reason, paidAt: r.paid_at,
      steps: sends.filter((x) => x.reminder_id === r.id).sort((a, b) => a.step - b.step).map((x) => ({ step: x.step, label: STEP_LABELS[x.step as 1 | 2 | 3], sentAt: x.resend_id ? x.sent_at : null, skipped: x.skipped, clicked: Boolean(x.clicked_at) })),
    })),
  };
}

/** One proof copy of each email to the owner's own address (test claims, 20 a day; no customer, no bookkeeping). */
async function ownerTest(user: any) {
  const to = checkEmailAddress(user.email ?? "");
  if (!to.ok) return { error: "No owner address" };
  const sample = { id: "00000000-0000-0000-0000-000000000000", plan: "starter", billing: "monthly", amount: 1800, currency: "eur" };
  const sent: any[] = [];
  for (const step of [1, 2, 3]) {
    const claim: any = await claimEmail(admin, to.email, `checkout_reminder_test_${step}_${Date.now()}`, "test");
    if (!claim.ok) { sent.push({ step, error: claim.reason }); continue; }
    const mail = reminderEmail(step, sample);
    const id = await sendClaimedEmailWithId(admin, {
      claimId: claim.id, to: to.email, userId: user.id, from: WELCOME_SENDER, replyTo: REPLY_TO.founder,
      subject: `[TEST] ${mail.subject}`, why: mail.why, render: mail.render, plain: true,
      tags: [{ name: "kind", value: "checkout_reminder_test" }],
    });
    sent.push({ step, ok: id !== null });
  }
  return { to: to.email, sent };
}

async function setSwitch(on: boolean) {
  const s = await settings();
  const patch: any = { id: 1, on, updated_at: new Date().toISOString() };
  if (on && !s.starts_at) patch.starts_at = new Date().toISOString(); // only checkouts from now on: never the backlog
  await rows(admin.from("checkout_reminder_settings").upsert(patch, { onConflict: "id" }).select("id"));
  return { on, startsAt: patch.starts_at ?? s.starts_at };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, req);
  const body = await req.json().catch(() => ({}));
  try {
    const secret = Deno.env.get("OPS_HEALTH_SECRET") ?? "";
    if (secret && req.headers.get("x-ops-secret") === secret) {
      if (body?.action === "dry") return json(await tick(true));
      if (body?.action === "tick") return json(await tick(false));
      return json({ error: "Unknown action" }, 400);
    }
    const owner = await ownerOf(req);
    if (!owner) return json({ error: "Not found" }, 404, req);
    if (body?.action === "stats") return json(await stats(), 200, req);
    if (body?.action === "dry") return json(await tick(true), 200, req);
    if (body?.action === "test") return json(await ownerTest(owner), 200, req);
    if (body?.action === "switch") return json(await setSwitch(body?.on === true), 200, req);
    return json({ error: "Unknown action" }, 400, req);
  } catch (e) {
    console.error("[checkout-reminders] failed:", e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, req);
  }
});
