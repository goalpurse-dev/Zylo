// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =================== Phase 8: click/open attribution =================== */
// Optional and strictly additive — this function never gates or blocks the
// core recovery system (checkout_started/email_sent/converted events are
// already written directly by create-checkout-session, stripe-webhook, and
// the processor). If this endpoint isn't registered in Resend yet, or the
// signing secret isn't configured, click/open tracking just doesn't happen
// — nothing else breaks.

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

function tagValue(tags: any[] | undefined, name: string): string | null {
  return tags?.find((t) => t?.name === name)?.value ?? null;
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
  const tags = event?.data?.tags;
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
