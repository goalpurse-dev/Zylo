// deno-lint-ignore-file no-explicit-any
// signup-reminders/index.ts — the follow-up reminders after sign-up (_shared/signupReminders.js has the rules and texts).
// Called by the cron job signup-reminders every 10 minutes, with the x-ops-secret header (vault ops_health_secret).
//   { action: "tick" }  sends what is due, only while onboarding_settings.reminders_on is true (at most 25 a tick)
//   { action: "dry" }   who would get what right now, as counts: sends nothing, whatever the switch says
//   { action: "test" }  one proof copy of each reminder to the owner (the first of ADMIN_EMAILS), whatever the switch says
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEvent } from "../_shared/systemLog.ts";
import { checkEmailAddress, REPLY_TO, WELCOME_SENDER } from "../_shared/emailRules.js";
import { claimEmail, sendClaimedEmailWithId } from "../_shared/userEmail.ts";
import { REMINDER_KINDS, WINDOWS, QUIET_MIN, reminderEmail, reminderFor } from "../_shared/signupReminders.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const PER_TICK = 25;
const HOUR = 3600000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const emails = (name: string) => (Deno.env.get(name) ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const OWNERS = new Set([...emails("ADMIN_EMAILS"), ...emails("CUTAWAY_TEST_USERS")]);

async function rows(q: any): Promise<any[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
// .in() with a few hundred ids at a time would make a very long address: 100 a request
async function byIds(ids: string[], q: (chunk: string[]) => any): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(...(await rows(q(ids.slice(i, i + 100)))));
  return out;
}

/** Everyone inside one of the windows, with what reminderFor needs. */
async function people(now: number) {
  const ranges = [[6, 2], [WINDOWS.bonus_day2[1], WINDOWS.bonus_day2[0]]].map(([from, to]) => [new Date(now - from * HOUR).toISOString(), new Date(now - to * HOUR).toISOString()]);
  const profiles = (await Promise.all(ranges.map(([a, b]) => rows(admin.from("profiles").select("id, email, created_at, plan_code, email_updates").gte("created_at", a).lt("created_at", b).limit(1000))))).flat();
  if (!profiles.length) return [];
  const ids = profiles.map((p) => p.id);
  const [onboarding, previews, bonuses, sent, recent, upgraded, unsub] = await Promise.all([
    byIds(ids, (c) => admin.from("user_onboarding").select("user_id, enrolled, email_consent_at").in("user_id", c)),
    byIds(ids, (c) => admin.from("cutaway_free_previews").select("user_id, status").in("user_id", c)),
    byIds(ids, (c) => admin.from("signup_bonuses").select("user_id, expires_at").in("user_id", c)),
    byIds(ids, (c) => admin.from("signup_reminders").select("user_id, kind, sent_at").in("user_id", c)),
    byIds(ids, (c) => admin.from("funnel_events").select("user_id, created_at").in("user_id", c).gte("created_at", new Date(now - QUIET_MIN * 60000).toISOString())),
    byIds(ids, (c) => admin.from("funnel_events").select("user_id").in("user_id", c).eq("event", "upgraded")),
    byIds(ids, (c) => admin.from("system_logs").select("user_id, event, created_at").in("user_id", c).eq("source", "email-unsubscribe").order("created_at", { ascending: true })),
  ]);
  const by = (list: any[]) => new Map(list.map((r) => [r.user_id, r]));
  const ob = by(onboarding), pv = by(previews), bn = by(bonuses), lastUnsub = by(unsub); // ascending: the last one wins
  const lastActive = new Map<string, string>();
  for (const e of recent) if (!lastActive.has(e.user_id) || e.created_at > lastActive.get(e.user_id)!) lastActive.set(e.user_id, e.created_at);
  const paid = new Set(upgraded.map((e) => e.user_id));
  return profiles.map((p) => {
    const o = ob.get(p.id);
    const address = checkEmailAddress(p.email ?? "");
    return {
      id: p.id, email: address.ok ? address.email : null,
      enrolled: o?.enrolled === true,
      owner: OWNERS.has(String(p.email ?? "").toLowerCase()) || !address.ok,
      paid: String(p.plan_code ?? "free").toLowerCase() !== "free" || paid.has(p.id),
      unsubscribed: lastUnsub.get(p.id)?.event === "email_unsubscribed",
      optedIn: Boolean(o?.email_consent_at) && p.email_updates === true,
      preview: pv.get(p.id) ?? null,
      bonusEndsAt: bn.get(p.id)?.expires_at ?? null,
      lastActiveAt: lastActive.get(p.id) ?? null,
      signedUpAt: p.created_at,
      sent: sent.filter((s) => s.user_id === p.id).map((s) => ({ kind: s.kind, sentAt: s.sent_at })),
    };
  });
}

async function sendOne(p: any, kind: string): Promise<string> {
  // the row first: the primary key (user, kind) makes this the one send of it
  const { data: claimed, error } = await admin.from("signup_reminders").insert({ user_id: p.id, kind }).select("user_id");
  if (error || !claimed?.length) return error?.code === "23505" ? "already_sent" : `row_failed`;
  const drop = () => admin.from("signup_reminders").delete().eq("user_id", p.id).eq("kind", kind);
  const mail = reminderEmail(kind, { bonusEndsAt: p.bonusEndsAt, hasPreview: p.preview?.status === "ready" });
  const claim = await claimEmail(admin, p.email, `reminder_${kind}`, mail.category);
  if (!claim.ok) { await drop(); return claim.reason; }
  const id = await sendClaimedEmailWithId(admin, {
    claimId: claim.id, to: p.email, userId: p.id, from: WELCOME_SENDER, replyTo: REPLY_TO.founder,
    subject: mail.subject, why: mail.why, render: mail.render, plain: true,
    tags: [{ name: "kind", value: `reminder_${kind}` }, { name: "campaign", value: `reminder_${kind}` }],
  });
  if (id === null) { await drop(); return "send_failed"; }
  await admin.from("signup_reminders").update({ resend_id: id || null }).eq("user_id", p.id).eq("kind", kind);
  return "sent";
}

async function tick(dry: boolean) {
  const now = Date.now();
  const list = await people(now);
  const due: Record<string, number> = {}, why: Record<string, number> = {}, results: Record<string, number> = {};
  let sends = 0;
  for (const p of list) {
    const d = reminderFor(p, now);
    if (!d.kind || !p.email) { why[d.why ?? "bad address"] = (why[d.why ?? "bad address"] ?? 0) + 1; continue; }
    due[d.kind] = (due[d.kind] ?? 0) + 1;
    if (dry || sends >= PER_TICK) continue;
    const r = await sendOne(p, d.kind);
    results[`${d.kind}:${r}`] = (results[`${d.kind}:${r}`] ?? 0) + 1;
    if (r === "sent") sends++;
  }
  if (!dry && Object.keys(results).length) await logEvent("signup-reminders", "info", "reminders_tick", { results });
  return { checked: list.length, due, notDue: why, ...(dry ? { dry: true } : { results }) };
}

// One proof copy of each for the owner (a test-category claim: 20 a day). The bonus copy shows an end time 24 hours on.
async function ownerTest() {
  const to = checkEmailAddress([...emails("ADMIN_EMAILS")][0] ?? "");
  if (!to.ok) return json({ error: "No owner address" }, 500);
  const { data: profile } = await admin.from("profiles").select("id").eq("email", to.email).limit(1).maybeSingle();
  if (!profile?.id) return json({ error: "No owner profile" }, 500);
  const out: Record<string, string> = {};
  for (const kind of REMINDER_KINDS) {
    const mail = reminderEmail(kind, { bonusEndsAt: new Date(Date.now() + 24 * HOUR).toISOString(), hasPreview: true });
    const claim = await claimEmail(admin, to.email, `reminder_test_${kind}_${Date.now()}`, "test");
    if (!claim.ok) { out[kind] = claim.reason; continue; }
    const id = await sendClaimedEmailWithId(admin, {
      claimId: claim.id, to: to.email, userId: profile.id, from: WELCOME_SENDER, replyTo: REPLY_TO.founder,
      subject: mail.subject, why: mail.why, render: mail.render, plain: true,
      tags: [{ name: "kind", value: "reminder_test" }, { name: "campaign", value: "reminder_test" }],
    });
    out[kind] = id === null ? "send_failed" : "sent";
  }
  return json({ test: true, results: out });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("OPS_HEALTH_SECRET") ?? "";
  if (!secret || req.headers.get("x-ops-secret") !== secret) return json({ error: "Not allowed" }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === "test") return await ownerTest();
    if (body?.action === "dry") return json(await tick(true));
    const { data: settings } = await admin.from("onboarding_settings").select("reminders_on").eq("id", 1).maybeSingle();
    if (settings?.reminders_on !== true) return json({ skipped: "off" });
    return json(await tick(false));
  } catch (e) {
    console.error("[signup-reminders]", String((e as any)?.message ?? e));
    return json({ error: "failed" }, 500);
  }
});
