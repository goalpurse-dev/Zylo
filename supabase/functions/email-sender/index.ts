// email-sender — sends what is due in email_outbox through Resend.
//
// Called every minute by pg_cron (private.trigger_email_sender, which only
// calls when something is due) with the x-email-sender-secret header; there is
// no user JWT (verify_jwt = false in config.toml), the secret is the gate.
// The logic lives in _shared/emails/outbox.js; this file only connects it to
// Supabase and Resend. See migrations/20261004212405_email_outbox.sql.
//
// POST {} (or { "limit": n }) → { ok, claimed, sent, retry, failed, skipped, canceled }
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processOutbox, unsubscribeLinks } from "../_shared/emails/outbox.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SENDER_SECRET = Deno.env.get("EMAIL_SENDER_SECRET") ?? "";
const UNSUBSCRIBE_SECRET = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The data of a Supabase call; an error throws (the row is then retried later). */
function must<T>(res: { data: T; error: any }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message ?? JSON.stringify(res.error)}`);
  return res.data;
}

const deps = {
  claim: async (limit: number) => must(await sb.rpc("claim_emails", { p_limit: limit }), "claim_emails") ?? [],
  finish: async (id: number, result: string, providerId: string | null, error: string | null) =>
    must(await sb.rpc("finish_email", { p_id: id, p_result: result, p_provider_id: providerId, p_error: error }), `finish_email ${id}`),
  profileOf: async (userId: string) =>
    must(await sb.from("profiles").select("id, email, email_updates, welcome_email_sent, credit_balance, plan_code").eq("id", userId).maybeSingle(), `profile ${userId}`),
  markWelcomeSent: async (userId: string) => {
    must(await sb.from("profiles").update({ welcome_email_sent: true }).eq("id", userId), `welcome flag ${userId}`);
  },
  unsubscribeLinks: (userId: string) => unsubscribeLinks(userId, { secret: UNSUBSCRIBE_SECRET, supabaseUrl: SUPABASE_URL }),
  // One email to Resend. status 0 = no answer (network error or timeout).
  send: async (message: Record<string, unknown>, idempotencyKey: string) => {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(15_000),
      });
      const body: any = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, id: body?.id ?? null, error: res.ok ? null : (body?.message ?? body?.name ?? "error") };
    } catch (e) {
      return { ok: false, status: 0, id: null, error: e instanceof Error ? e.message : String(e) };
    }
  },
  pause: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  // Only the cron job (or someone holding the secret) may make this send.
  if (!SENDER_SECRET || req.headers.get("x-email-sender-secret") !== SENDER_SECRET) return json({ error: "Unauthorized" }, 401);
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY is not set" }, 500);

  try {
    const body: any = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 25);
    const summary = await processOutbox(deps, { limit });
    if (summary.claimed) console.log("[email-sender]", JSON.stringify(summary));
    return json({ ok: true, ...summary });
  } catch (e) {
    console.error("[email-sender] run failed:", e instanceof Error ? e.message : String(e));
    return json({ error: "internal error" }, 500);
  }
});
