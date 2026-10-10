// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEvent } from "../_shared/systemLog.ts";
import { stopReason } from "../_shared/emailRules.js";

// What Resend tells us about emails we sent (webhook registered at Resend for
// email.delivered, email.delivery_delayed, email.bounced, email.complained and
// email.suppressed; signed with RESEND_WEBHOOK_SECRET):
//   1. bounces and spam complaints switch that address OFF (below, stopReason)
//   2. events of scheduled campaigns are kept in email_events (stop rules, report)
//   3. clicks/opens of checkout reminders are recorded (Phase 8)

/* =================== Phase 8: click/open attribution =================== */
// Optional and strictly additive — this function never gates or blocks the
// core recovery system (checkout_started/email_sent/converted events are
// already written directly by create-checkout-session, stripe-webhook, and
// the processor). If the signing secret isn't configured, every request is
// refused (401) and nothing else breaks.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Resend signs webhooks via Svix. Find this in Resend Dashboard → Webhooks
// → [endpoint] → Signing Secret (starts with "whsec_").
const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

async function verifySvixSignature(
  body: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string,
): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignature || !secret) return false;

  const secretBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const toSign = new TextEncoder().encode(`${svixId}.${svixTimestamp}.${body}`);
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, toSign);
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  // svix-signature can contain multiple space-separated "v1,<base64sig>" entries
  return svixSignature.split(" ").some((entry) => entry.split(",")[1] === expected);
}

// Resend sends tags as [{name, value}] on some events and as {name: value} on others.
function tagValue(tags: any, name: string): string | null {
  if (Array.isArray(tags)) return tags.find((t) => t?.name === name)?.value ?? null;
  return tags?.[name] ?? null;
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const raw = await req.text();
  const valid = await verifySvixSignature(
    raw,
    req.headers.get("svix-id"),
    req.headers.get("svix-timestamp"),
    req.headers.get("svix-signature"),
    RESEND_WEBHOOK_SECRET,
  );
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const type: string = event?.type ?? "";

  // A hard bounce or a spam complaint: stop writing to that address. It goes on
  // email_suppressions (the email gate then refuses it for good) and its profile
  // is switched OFF (email_updates = false). A soft bounce (full inbox, server
  // busy) changes nothing: Resend retries those itself.
  const stop = stopReason(type, event?.data);
  if (stop) {
    const recipients: string[] = [event?.data?.to ?? []].flat().filter((a: unknown) => typeof a === "string");
    for (const address of recipients) {
      const { data: switchedOff, error } = await sb.rpc("suppress_email", { p_email: address, p_reason: stop, p_source: "resend-webhook" });
      if (error) {
        // 500: Resend delivers the event again later, so a bounce is never lost.
        console.error("[resend-webhook] suppress_email failed:", error.message);
        return new Response(JSON.stringify({ error: "could not record the event" }), { status: 500 });
      }
      await logEvent("resend-webhook", "warn", stop === "complained" ? "email_complaint_switched_off" : "email_bounce_switched_off", {
        domain: String(address).split("@")[1] ?? null, profilesSwitchedOff: switchedOff ?? 0, resendEmailId: event?.data?.email_id ?? null,
      });
    }
  }

  const tags = event?.data?.tags;

  // An email of a scheduled campaign (its "campaign" tag, or its Resend id on the
  // campaign's queue): keep the event. The campaign-sender function counts these
  // for the stop rules (a complaint, bounces over 2%) and for the report.
  const resendId: string | null = event?.data?.email_id ?? null;
  if (resendId && type.startsWith("email.")) {
    let campaign = tagValue(tags, "campaign");
    if (!campaign) {
      const { data: queued } = await sb.from("email_campaign_queue").select("campaign").eq("resend_id", resendId).limit(1).maybeSingle();
      campaign = queued?.campaign ?? null;
    }
    if (campaign) {
      const bounce = event?.data?.bounce;
      const { error } = await sb.from("email_events").upsert({
        resend_id: resendId, type, campaign,
        email: String([event?.data?.to ?? []].flat()[0] ?? "").trim().toLowerCase() || null,
        detail: bounce ? `${bounce.type ?? "?"}/${bounce.subType ?? "?"}` : null,
      }, { onConflict: "resend_id,type", ignoreDuplicates: true });
      if (error) {
        console.error("[resend-webhook] email_events failed:", error.message);
        return new Response(JSON.stringify({ error: "could not record the event" }), { status: 500 });
      }
    }
  }

  const checkoutId = tagValue(tags, "checkout_id");
  const stage = tagValue(tags, "stage");

  // Only care about our own tagged recovery emails, and only click/open.
  if (checkoutId && (type === "email.clicked" || type === "email.opened")) {
    try {
      const { data: acRow } = await sb
        .from("abandoned_checkouts")
        .select("id")
        .eq("id", checkoutId)
        .maybeSingle();

      if (acRow) {
        const eventType = type === "email.clicked"
          ? `email_${stage ?? "?"}_clicked`
          : `email_${stage ?? "?"}_opened`;
        await sb.from("abandoned_checkout_events").insert({
          checkout_id: acRow.id,
          event_type: eventType,
          stage: stage ? Number(stage) : null,
          metadata: { resend_event_id: event?.data?.email_id ?? null },
        });
      }
    } catch (e) {
      console.error("[resend-webhook] failed to record event (non-fatal):", e);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

export default { fetch: handleRequest };
