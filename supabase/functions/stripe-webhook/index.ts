// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =================== CONFIG =================== */
/** Recurring plan map — includes both EUR (current) and legacy USD price IDs.
 *  Add any old USD price IDs here so pre-migration subscribers still get credits on renewal. */
const PRICE_MAP: Record<string, { plan: "starter" | "pro" | "generative"; credits: number; interval?: "yearly" }> = {
  // ── Monthly EUR prices (current) ──
  "price_1TGKT6Htn4q5rIncI47V5Ein": { plan: "starter",    credits: 600 },
  "price_1TGKSqHtn4q5rIncIf8RPa6e": { plan: "pro",        credits: 1200 },
  "price_1TGKSSHtn4q5rIncSTurqkCN": { plan: "generative", credits: 2500 },

  // ── Monthly USD prices (legacy — pre-EUR migration subscribers) ──
  "price_1T8gM3Htn4q5rInchn8CMEcO": { plan: "starter",    credits: 600 },
  "price_1T8gMVHtn4q5rIncWwcUi9mG": { plan: "pro",        credits: 1200 },
  "price_1T8gMsHtn4q5rIncW0vy8d57": { plan: "generative", credits: 2500 },

  // ── Annual prices — credits = first month's allocation; cron tops up monthly ──
  "price_1TYWNYHtn4q5rIncWMa3mmvI": { plan: "starter",    credits: 600,  interval: "yearly" },
  "price_1TYWOWHtn4q5rIncTmN3GXdy": { plan: "pro",        credits: 1200, interval: "yearly" },
  "price_1TYWP8Htn4q5rIncbugChVhS": { plan: "generative", credits: 2500, interval: "yearly" },
};

/** One-time top-up map (fallback if Price.metadata.credits is not set) */
const TOPUP_PRICE_MAP: Record<string, number> = {
  "price_1TGKjDHtn4q5rInczlym0Dcz": 300,
  "price_1SpZczHtn4q5rInctZoF9rJV": 500,
  "price_1TGKjxHtn4q5rIncQzzCGyrR": 900,
};
/* ============================================== */

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET  = Deno.env.get("STRIPE_SECRET_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

/* ---------- CORS / responses ---------- */
function cors(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ||
      "authorization, x-client-info, apikey, content-type, stripe-signature",
    "content-type": "application/json",
    vary: "Origin",
  };
}
const respond = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

/* ---------- Deno-safe Stripe signature verification ---------- */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2) throw new Error("invalid hex length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  return out;
}
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function verifyStripeSignature(raw: string, sigHeader: string | null, secret: string): Promise<boolean> {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => {
    const [k, v] = p.split("="); return [k, v];
  }));
  const ts = parts["t"]; const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const toSign = enc.encode(`${ts}.${raw}`);
  const computedBuf = await crypto.subtle.sign("HMAC", key, toSign);
  const computed = new Uint8Array(computedBuf);
  const provided = hexToBytes(v1);
  return timingSafeEqualBytes(computed, provided);
}

/* ---------- helpers ---------- */
const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

async function userIdByCustomerId(customerId: string): Promise<string | null> {
  if (!customerId || customerId === "undefined") return null;
  const { data } = await sb.from("profiles").select("id").eq("stripe_customer_id", customerId).single();
  return data?.id ?? null;
}
async function currentCredits(userId: string) {
  const { data } = await sb.from("profiles").select("credit_balance").eq("id", userId).single();
  return data?.credit_balance ?? 0;
}
async function atomicAddCredits(userId: string, delta: number) {
  const rpc = await sb.rpc("increment_credit_balance", { p_user_id: userId, p_delta: delta });
  if ((rpc as any).error) {
    const curr = await currentCredits(userId);
    await sb.from("profiles").update({ credit_balance: curr + delta }).eq("id", userId);
  }
}
async function setPlan(userId: string, plan: "free" | "starter" | "pro" | "generative") {
  await sb.from("profiles").update({ plan_code: plan }).eq("id", userId);
}

/**
 * Idempotency guard — inserts a row keyed by Stripe event ID.
 * Returns true  → event already handled, skip processing.
 * Returns false → event is new, proceed.
 * Never throws  → on DB error we fail-open (grantCreditsOnce is the real guard).
 */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  try {
    const { error } = await sb
      .from("billing_events_processed")
      .insert({ event_id: eventId })
      .select()
      .single();
    if (error?.code === "23505") return true; // duplicate key → already handled
    if (error) console.warn("[stripe-webhook] billing_events_processed insert:", error.message);
    return false;
  } catch (e) {
    console.error("[stripe-webhook] alreadyProcessed threw:", e);
    return false; // fail-open: grantCreditsOnce provides the real idempotency
  }
}

/** grant credits once using a ledger row keyed by external_id */
async function grantCreditsOnce(userId: string, amount: number, reason: string, externalId: string) {
  if (amount <= 0) return;
  const ins = await sb.from("credit_grants").insert({ user_id: userId, reason, amount, external_id: externalId });
  // @ts-ignore duplicate key -> already granted
  if (ins.error && ins.error.code === "23505") return;
  await atomicAddCredits(userId, amount);
}

/* ---------- Stripe read helpers ---------- */
async function fetchCheckoutLineItems(sessionId: string): Promise<any[]> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items?limit=10`,
    { headers: { Authorization: `Bearer ${STRIPE_SECRET}` } },
  );
  const li = await res.json();
  return Array.isArray(li?.data) ? li.data : [];
}
async function fetchPriceCreditsFromMetadata(priceId: string): Promise<number | null> {
  const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
  });
  const price = await res.json();
  const raw = price?.metadata?.credits;
  if (!raw) return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ---------- main ---------- */
export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "POST")   return respond(req, { error: "Method not allowed" }, 405);

    // ── 1. Read body ─────────────────────────────────────────────────────────
    let raw: string;
    try {
      raw = await req.text();
    } catch (e) {
      console.error("[stripe-webhook] failed to read body:", e);
      return respond(req, { error: "Failed to read request body" }, 400);
    }

    // ── 2. Verify Stripe signature ────────────────────────────────────────────
    //    Wrapped separately so a malformed sig header (odd-length hex, etc.)
    //    returns 400 instead of an unhandled 500.
    const sig = req.headers.get("stripe-signature");
    let valid: boolean;
    try {
      valid = await verifyStripeSignature(raw, sig, WEBHOOK_SECRET);
    } catch (e) {
      console.error("[stripe-webhook] signature verification threw:", e);
      return respond(req, { error: "Signature verification error" }, 400);
    }
    if (!valid) return respond(req, { error: "Invalid signature" }, 400);

    // ── 3. Parse event ────────────────────────────────────────────────────────
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      return respond(req, { error: "Invalid JSON payload" }, 400);
    }

    const type: string = event?.type ?? "unknown";
    // Null-safe object accessor — avoids "Cannot read property of null" on
    // any access inside the handlers below.
    const obj: any = event?.data?.object ?? {};

    console.log(`[stripe-webhook] received ${type} id=${event?.id}`);

    // ── 4. Deduplication ──────────────────────────────────────────────────────
    //    alreadyProcessed is inside try/catch and never throws, so a DB hiccup
    //    here cannot produce a 500.  grantCreditsOnce provides the real guard.
    if (await alreadyProcessed(event.id)) {
      console.log(`[stripe-webhook] deduped ${type} id=${event.id}`);
      return respond(req, { ok: true, deduped: true });
    }

    // ── 5. Handle known events ────────────────────────────────────────────────
    //    All unknown/unsupported event types fall through to the final
    //    `return respond(req, { ignored: true, type }, 200)` — they NEVER
    //    cause a 500.  Only genuine DB/logic errors inside a known handler
    //    surface as 500 (which tells Stripe to retry, which is correct for
    //    transient failures).
    try {

      /* ── checkout.session.completed ───────────────────────────────────── */
      if (type === "checkout.session.completed") {
        const s = obj;

        // Only act on sessions that actually have a paid/completing status.
        // failed/canceled/requires_action sessions must be ignored here.
        // (Async payment methods may complete with payment_status = "unpaid";
        //  credits are granted on the matching async_payment_succeeded event.)

        // Resolve user
        let userId: string | null =
          (s?.metadata?.user_id as string) ||
          (s?.client_reference_id as string) ||
          null;
        if (!userId && s?.customer) userId = await userIdByCustomerId(String(s.customer));
        if (!userId) return respond(req, { ok: true, reason: "no-user" });

        // One-time top-ups — only when payment_status is confirmed "paid"
        if (s?.mode === "payment" && s?.payment_status === "paid") {
          const items = await fetchCheckoutLineItems(s.id);
          let totalCredits = 0;
          for (const it of items) {
            const priceId: string | undefined = it?.price?.id;
            const qty: number = it?.quantity ?? 1;
            if (!priceId) continue;
            let per = await fetchPriceCreditsFromMetadata(priceId);
            if (per == null) per = TOPUP_PRICE_MAP[priceId] ?? 0;
            totalCredits += (per || 0) * qty;
          }
          if (totalCredits > 0) {
            await grantCreditsOnce(userId, totalCredits, "topup", s.id);
          }
          return respond(req, { ok: true, topup_credits: totalCredits });
        }

        // Initial subscription checkout — store IDs; credits come on invoice.payment_succeeded
        if (s?.mode === "subscription" && s?.status === "complete") {
          const patch: any = {};
          if (s.subscription) patch.stripe_subscription_id = s.subscription;
          if (s.customer)     patch.stripe_customer_id     = s.customer;
          if (Object.keys(patch).length) await sb.from("profiles").update(patch).eq("id", userId);
          return respond(req, { ok: true });
        }

        // Any other checkout state (unpaid async, abandoned, etc.) — ignore
        return respond(req, { ok: true, reason: "checkout-no-action" });
      }

      /* ── invoice.payment_succeeded ────────────────────────────────────── */
      if (type === "invoice.payment_succeeded") {
        const inv = obj;
        const customerId = String(inv?.customer ?? "");
        let userId = await userIdByCustomerId(customerId);

        if (!userId) {
          userId = inv?.metadata?.user_id ?? inv?.subscription_details?.metadata?.user_id ?? null;
        }
        if (!userId) return respond(req, { ok: true, reason: "no-user" });

        // Grant plan credits for non-proration recurring lines only
        let planCredits = 0;
        let detectedInterval: "yearly" | undefined;
        const lines: any[] = inv?.lines?.data ?? [];
        for (const ln of lines) {
          const priceId: string | undefined = ln?.price?.id;
          const isRecurring = ln?.plan || ln?.price?.recurring;
          const isProration = Boolean(ln?.proration);
          if (!priceId || !isRecurring || isProration) continue;
          const map = PRICE_MAP[priceId];
          if (map) {
            planCredits += map.credits;
            await setPlan(userId, map.plan);
            if (map.interval === "yearly") detectedInterval = "yearly";
          }
        }

        if (planCredits > 0) {
          await grantCreditsOnce(userId, planCredits, "plan_renewal", inv.id);
        }

        if (detectedInterval === "yearly") {
          await sb.from("profiles").update({
            billing_interval:          "yearly",
            annual_credits_per_month:  planCredits,
            annual_credits_last_topup: new Date().toISOString(),
          }).eq("id", userId);
        } else if (planCredits > 0) {
          await sb.from("profiles").update({
            billing_interval:          "monthly",
            annual_credits_per_month:  0,
            annual_credits_last_topup: null,
          }).eq("id", userId);
        }

        const firstLine = inv?.lines?.data?.[0];
        const periodEndIso = firstLine?.period?.end
          ? new Date(firstLine.period.end * 1000).toISOString()
          : null;
        await sb.from("profiles").update({
          stripe_subscription_status: inv?.status ?? "paid",
          cancel_at_period_end:       Boolean(inv?.subscription_details?.cancel_at_period_end),
          current_period_end:         periodEndIso,
          plan_renews_at:             periodEndIso,
        }).eq("id", userId);

        return respond(req, { ok: true, plan_credits: planCredits });
      }

      /* ── invoice.payment_failed ───────────────────────────────────────── */
      //   Covers: insufficient funds, dunning, 3D Secure failures on
      //   subscription invoices.  No credits are ever added.
      if (type === "invoice.payment_failed") {
        const inv = obj;
        const userId = await userIdByCustomerId(String(inv?.customer ?? ""));
        if (!userId) return respond(req, { ok: true, reason: "no-user" });

        await sb.from("profiles").update({
          stripe_subscription_status: "past_due",
        }).eq("id", userId);

        // Optional audit row — swallow errors to avoid masking the real issue
        await sb.from("credit_grants").insert({
          user_id:     userId,
          reason:      "invoice_failed",
          amount:      0,
          external_id: inv?.id,
        }).select().single().catch(() => {});

        return respond(req, { ok: true, failed_invoice: inv?.id });
      }

      /* ── customer.subscription.updated ───────────────────────────────── */
      if (type === "customer.subscription.updated") {
        const sub = obj;
        const userId = await userIdByCustomerId(String(sub?.customer ?? ""));
        if (!userId) return respond(req, { ok: true });

        const priceId: string | undefined = sub?.items?.data?.[0]?.price?.id;
        const mapping = priceId ? PRICE_MAP[priceId] : undefined;

        const patch: any = {
          stripe_subscription_status: sub?.status ?? null,
          cancel_at_period_end:       Boolean(sub?.cancel_at_period_end),
          current_period_end:         sub?.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        };

        if (mapping) {
          patch.plan_code     = mapping.plan;
          patch.plan_renews_at = patch.current_period_end;
        }

        await sb.from("profiles").update(patch).eq("id", userId);
        return respond(req, { received: true });
      }

      /* ── customer.subscription.deleted ───────────────────────────────── */
      if (type === "customer.subscription.deleted") {
        const sub = obj;
        const userId = await userIdByCustomerId(String(sub?.customer ?? ""));
        if (userId) {
          await sb.from("profiles").update({
            plan_code:                  "free",
            stripe_subscription_status: "canceled",
            cancel_at_period_end:       false,
            current_period_end:         sub?.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            stripe_subscription_id:     null,
            billing_interval:           "monthly",
            annual_credits_per_month:   0,
            annual_credits_last_topup:  null,
          }).eq("id", userId);
        }
        return respond(req, { received: true });
      }

      // ── All other events (payment_intent.*, charge.*, 3DS events, etc.) ──
      // Return 200 immediately. Do NOT throw, do NOT try to process.
      // This is the correct response so Stripe stops retrying unhandled events.
      console.log(`[stripe-webhook] ignored unsupported event: ${type}`);
      return respond(req, { ignored: true, type }, 200);

    } catch (e) {
      // Only reached for genuine errors inside the known-event handlers above.
      // Returning 500 tells Stripe to retry — correct for transient DB failures.
      console.error(`[stripe-webhook] error handling ${type} id=${event?.id}:`,
        e instanceof Error ? e.message : String(e));
      return respond(req, { error: "internal error" }, 500);
    }
  },
};
