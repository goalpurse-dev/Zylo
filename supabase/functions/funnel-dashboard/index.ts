// deno-lint-ignore-file no-explicit-any
// funnel-dashboard/index.ts — the numbers behind /admin/funnel. The owner only (ADMIN_EMAILS); anyone else gets NOT_FOUND
// and no data. Read-only. POST { from, to } (ISO): who signed up in that period, and how far they got (_shared/funnelStats.js).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { funnelStats, welcomeDaily } from "../_shared/funnelStats.js";
import { REMINDER_KINDS, reminderStats } from "../_shared/signupReminders.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const OWNERS = (Deno.env.get("ADMIN_EMAILS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const PAGE = 1000, MAX_ROWS = 40000, CHUNK = 200;

async function allRows(build: (from: number, to: number) => any) {
  const out: any[] = [];
  for (let i = 0; i < MAX_ROWS; i += PAGE) {
    const { data, error } = await build(i, i + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}
async function byUsers(ids: string[], read: (chunk: string[]) => any) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await read(ids.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: null } as any;
  if (!auth?.user?.email || !OWNERS.includes(auth.user.email.toLowerCase())) return err(req, "NOT_FOUND", 404);

  const body = await req.json().catch(() => ({}));
  const from = new Date(body?.from), to = new Date(body?.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) return err(req, "BAD_INPUT", 400);
  try {
    const fromIso = from.toISOString(), toIso = to.toISOString();
    const events = await allRows((a, b) => admin.from("funnel_events").select("user_id, event, props, created_at").gte("created_at", fromIso).order("created_at", { ascending: true }).range(a, b));
    const ids = [...new Set(events.filter((e) => e.event === "signed_up").map((e) => e.user_id))];
    // the per-day open rate always covers the last 14 days, whatever period is picked (opens of those days' emails come later)
    const dailySince = new Date(Date.now() - 15 * 86400000).toISOString();
    const [onboarding, profiles, sends, emailEvents, daily] = await Promise.all([
      byUsers(ids, (chunk) => admin.from("user_onboarding").select("user_id, goals, experience, heard_from, heard_creator, hope, survey_done_at, email_consent_at").in("user_id", chunk)),
      byUsers(ids, (chunk) => admin.from("profiles").select("id, email").in("id", chunk)),
      allRows((a, b) => admin.from("email_sends").select("id").eq("kind", "welcome").gte("sent_at", fromIso).lt("sent_at", toIso).range(a, b)),
      allRows((a, b) => admin.from("email_events").select("resend_id, type").eq("campaign", "welcome").gte("created_at", fromIso).lt("created_at", toIso).range(a, b)),
      allRows((a, b) => admin.from("email_events").select("resend_id, type, created_at").eq("campaign", "welcome").in("type", ["email.delivered", "email.opened"]).gte("created_at", dailySince).order("id").range(a, b)),
    ]);
    // the owner and test accounts don't count in the numbers
    const excluded = profiles.filter((p) => { const m = String(p.email ?? "").toLowerCase(); return OWNERS.includes(m) || /(\.test|\.invalid)$/.test(m); }).map((p) => p.id);
    const { data: settings } = await admin.from("onboarding_settings").select("*").eq("id", 1).maybeSingle();
    // the follow-up reminders sent in the period, and what those people did after their own email. null before the
    // migration 20261202100000 has run (no table yet): the rest of the page still works
    const reminders = await Promise.all([
      allRows((a, b) => admin.from("signup_reminders").select("user_id, kind, resend_id, sent_at").gte("sent_at", fromIso).lt("sent_at", toIso).range(a, b)),
      allRows((a, b) => admin.from("email_events").select("resend_id, type, created_at").in("campaign", REMINDER_KINDS.map((k) => `reminder_${k}`)).gte("created_at", fromIso).order("id").range(a, b)),
    ]).then(([sends, emailEvents]) => reminderStats({ sends, emailEvents, events, excluded }), (e) => { console.error("[funnel-dashboard] reminders:", String(e?.message ?? e)); return null; });
    return ok(req, { ...funnelStats({ events, onboarding, excluded, from: fromIso, to: toIso, emailEvents, sends }), welcomeOn: settings?.welcome_email_on === true, welcomeDaily: welcomeDaily(daily), reminders, remindersOn: settings?.reminders_on === true, from: fromIso, to: toIso });
  } catch (e) {
    console.error("[funnel-dashboard]", String((e as any)?.message ?? e));
    return err(req, "Could not read the numbers", 500);
  }
});
