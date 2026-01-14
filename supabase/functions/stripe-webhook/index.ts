// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =================== CONFIG =================== */
/** Recurring plan map (MUST match your live price IDs) */
const PRICE_MAP: Record<string, { plan: "starter" | "pro" | "generative"; credits: number }> = {
  "price_1SpZXeHtn4q5rIncDyM2BSTX": { plan: "starter",    credits: 1200 },
  "price_1SpZZhHtn4q5rInc6cL8gkj3": { plan: "pro",        credits: 2500 },
 "price_1SpZb3Htn4q5rIncf5sFROHv": { plan: "generative", credits: 5000 },
};

/** One-time top-up map (fallback if Price.metadata.credits is not set) */
const TOPUP_PRICE_MAP: Record<string, number> = {
  "price_1SpZcRHtn4q5rIncaayoetIS": 300,
  "price_1SpZczHtn4q5rInctZoF9rJV": 520,
  "price_1SpZdTHtn4q5rIncFRt80VaD": 900,
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
  if (hex.length % 2) throw new Error("invalid hex");
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
async function verifyStripeSignature(raw: string, sigHeader: string | null, secret: string) {
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

/** idempotency for events */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  const ins = await sb.from("billing_events_processed").insert({ event_id: eventId }).select().single();
  // @ts-ignore
  if (ins.error && ins.error.code === "23505") return true;
  return false;
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

    const sig = req.headers.get("stripe-signature");
    const raw = await req.text();
    const valid = await verifyStripeSignature(raw, sig, WEBHOOK_SECRET);
    if (!valid) return respond(req, { error: "Invalid signature" }, 400);

    const event = JSON.parse(raw);
    const type = event.type as string;

    // Deduplicate Stripe retries
    if (await alreadyProcessed(event.id)) {
      return respond(req, { ok: true, deduped: true });
    }

    try {
      /* ---------- Checkout completed ---------- */
      if (type === "checkout.session.completed") {
        const s = event.data.object as any;

        // Resolve user
        let userId: string | null = (s.metadata?.user_id as string) || (s.client_reference_id as string) || null;
        if (!userId && s.customer) userId = await userIdByCustomerId(String(s.customer));
        if (!userId) return respond(req, { ok: true, reason: "no-user" });

        // One-time top-ups
        if (s.mode === "payment" && s.payment_status === "paid") {
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

        // Initial subscription checkout: store ids (credits come on invoice.payment_succeeded)
        if (s.mode === "subscription" && s.status === "complete") {
          const patch: any = {};
          if (s.subscription) patch.stripe_subscription_id = s.subscription;
          if (s.customer)     patch.stripe_customer_id     = s.customer;
          if (Object.keys(patch).length) await sb.from("profiles").update(patch).eq("id", userId);
          return respond(req, { ok: true });
        }
      }

      /* ---------- Invoice paid (renewal & initial cycle credits) ---------- */
      if (type === "invoice.payment_succeeded") {
        const inv = event.data.object as any;
        const customerId = String(inv.customer);
        const userId = await userIdByCustomerId(customerId);
        if (!userId) return respond(req, { ok: true, reason: "no-user" });

        // Grant plan credits for NON-proration recurring lines only
        let planCredits = 0;
        const lines: any[] = inv.lines?.data ?? [];
        for (const ln of lines) {
          const priceId: string | undefined = ln.price?.id;
          const isRecurring = ln.plan || ln.price?.recurring;
          const isProration = Boolean(ln.proration);
          if (!priceId || !isRecurring || isProration) continue;
          const map = PRICE_MAP[priceId];
          if (map) {
            planCredits += map.credits;
            await setPlan(userId, map.plan);
          }
        }

        if (planCredits > 0) {
          await grantCreditsOnce(userId, planCredits, "plan_renewal", inv.id);
        }

        // Sync subscription-ish fields using invoice periods
        const firstLine = inv.lines?.data?.[0];
        const periodEndIso = firstLine?.period?.end ? new Date(firstLine.period.end * 1000).toISOString() : null;
        await sb.from("profiles").update({
          stripe_subscription_status: inv.status ?? "paid",
          cancel_at_period_end: Boolean(inv.subscription_details?.cancel_at_period_end),
          current_period_end: periodEndIso,
          plan_renews_at: periodEndIso,
        }).eq("id", userId);

        return respond(req, { ok: true, plan_credits: planCredits });
      }

      /* ---------- Invoice failed (insufficient funds / dunning) ---------- */
      if (type === "invoice.payment_failed") {
        const inv = event.data.object as any;
        const userId = await userIdByCustomerId(String(inv.customer));
        if (!userId) return respond(req, { ok: true, reason: "no-user" });

        // Mark past_due (or open) — no credits added
        await sb.from("profiles").update({
          stripe_subscription_status: "past_due",
          // keep current_period_end unchanged; user may still be in paid period
        }).eq("id", userId);

        // Optional: record a zero-credit ledger entry so you can show “payment failed” in UI
        await sb.from("credit_grants").insert({
          user_id: userId,
          reason: "invoice_failed",
          amount: 0,
          external_id: inv.id,
        }).select().single().catch(() => {});

        return respond(req, { ok: true, failed_invoice: inv.id });
      }

      /* ---------- Subscription updated (status, cancel flags, price switches) ---------- */
      if (type === "customer.subscription.updated") {
        const sub = event.data.object as any;
        const userId = await userIdByCustomerId(String(sub.customer));
        if (!userId) return respond(req, { ok: true });

        const priceId: string | undefined = sub?.items?.data?.[0]?.price?.id;
        const mapping = priceId ? PRICE_MAP[priceId] : undefined;

        const patch: any = {
          stripe_subscription_status: sub.status ?? null,
          cancel_at_period_end: Boolean(sub.cancel_at_period_end),
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        };

        if (mapping) {
          patch.plan_code = mapping.plan;
          patch.plan_renews_at = patch.current_period_end;
        }

        await sb.from("profiles").update(patch).eq("id", userId);
        return respond(req, { received: true });
      }

      /* ---------- Subscription canceled ---------- */
      if (type === "customer.subscription.deleted") {
        const sub = event.data.object as any;
        const userId = await userIdByCustomerId(String(sub.customer));
        if (userId) {
          await sb.from("profiles").update({
            plan_code: "free",
            stripe_subscription_status: "canceled",
            cancel_at_period_end: false,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            stripe_subscription_id: null,
          }).eq("id", userId);
        }
        return respond(req, { received: true });
      }

      return respond(req, { ignored: type }, 200);
    } catch (e) {
      console.error("webhook handler error", e);
      return respond(req, { error: e instanceof Error ? e.message : String(e) }, 500);
    }
  },
};
