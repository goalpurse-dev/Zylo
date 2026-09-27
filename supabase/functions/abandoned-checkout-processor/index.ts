// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =================== CONFIG =================== */
// Independently verified trigger path (Phase 6) — this secret is checked
// here in application code, NOT via Supabase JWT verification (this
// function has verify_jwt = false in config.toml, same pattern as
// cleanup-generation-references). pg_cron/pg_net sends it as the
// `x-cron-secret` header. A manual test invocation uses the same header.
const CRON_SECRET = Deno.env.get("ABANDONED_CHECKOUT_CRON_SECRET") ?? "";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// Optional. If unset, the "discount" A/B arm is skipped and every claimed
// send falls back to the "credits" arm instead — this system never sends a
// broken/unresolvable discount. Create in Stripe Dashboard → Product
// catalog → Coupons, then a Promotion Code against it, and set its
// `promo_xxx` ID here as a Supabase secret.
const RECOVERY_PROMO_CODE_ID = Deno.env.get("STRIPE_RECOVERY_PROMO_CODE_ID") ?? "";

const GLOBAL_COOLDOWN_MINUTES = 60;
const CLAIM_BATCH_SIZE = 25;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

// Emails can legitimately contain `%` and `_`, which are ILIKE wildcards --
// escape them so a cooldown lookup can't accidentally match other addresses.
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/* =================== Stripe helpers =================== */
async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
  });
  return { ok: res.ok, status: res.status, json: await res.json() };
}
async function stripePost(path: string, body: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body,
  });
  return { ok: res.ok, status: res.status, json: await res.json() };
}

/** Mints a brand-new Checkout Session from a stored row's own price/customer
 *  data. Used when (a) the original session is dead and no Stripe recovery
 *  URL exists yet, or (b) we're offering a discount, which can only be
 *  attached to a freshly created session. This never creates a new
 *  abandoned_checkouts row or restarts the recovery timer — it's purely a
 *  fresh link for the row that already owns the sequence. */
async function mintFreshSession(row: any, opts: { promotionCodeId?: string } = {}) {
  const body = new URLSearchParams({
    mode: row.purchase_type === "topup" ? "payment" : "subscription",
    "line_items[0][price]": row.price_id,
    "line_items[0][quantity]": "1",
    allow_promotion_codes: "true",
    success_url: "https://tryzyvo.com/billing/success",
    cancel_url: "https://tryzyvo.com/billing/cancel",
    "metadata[user_id]": row.user_id ?? "",
    "metadata[email]": row.email ?? "",
    "metadata[kind]": row.purchase_type ?? "",
    "metadata[recovery_of]": row.stripe_session_id ?? "",
  });
  if (row.stripe_customer_id) body.set("customer", row.stripe_customer_id);
  if (opts.promotionCodeId) body.set("discounts[0][promotion_code]", opts.promotionCodeId);

  const { ok, json } = await stripePost("/v1/checkout/sessions", body);
  if (!ok) {
    console.error("[abandoned-checkout-processor] mintFreshSession failed:", json?.error?.message);
    return null;
  }
  return json;
}

/* =================== Incentive A/B (Phase 5/8) =================== */
type Incentive =
  | { id: "discount_18"; type: "discount"; percent: number }
  | { id: "bonus_credits_300"; type: "credits"; amount: number };

function pickIncentive(checkoutId: string): Incentive {
  // Deterministic bucketing on the row id, so a retried/resent stage-3
  // email always lands the same variant instead of re-rolling.
  let hash = 0;
  for (const ch of checkoutId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const variants: Incentive[] = [
    { id: "discount_18", type: "discount", percent: 18 },
    { id: "bonus_credits_300", type: "credits", amount: 300 },
  ];
  return variants[hash % variants.length];
}

/* =================== Email templates =================== */
function wrap(inner: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f0f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f2;padding:40px 16px;">
  <tr><td align="center"><table role="presentation" width="100%" style="max-width:520px;">
  <tr><td style="background:#0a0a0a;padding:20px 32px;border-radius:12px 12px 0 0;">
    <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#fff;">Zyvo</span>
  </td></tr>
  <tr><td style="background:#ffffff;padding:32px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;border-radius:0 0 12px 12px;">
  ${inner}
  </td></tr>
  </table></td></tr></table></body></html>`;
}
function ctaButton(url: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="border-radius:9px;background:#7A3BFF;">
      <a href="${url}" style="display:inline-block;padding:14px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">${label}</a>
    </td></tr></table>`;
}

function emailOne(name: string, ctaUrl: string) {
  return {
    subject: "did you mean to leave this open?",
    html: wrap(`
      <p>Hi ${name},</p>
      <p>You started setting up Zyvo a few minutes ago and it looks like the checkout didn't finish.</p>
      <p>No pressure — just picking up right where you left off:</p>
      ${ctaButton(ctaUrl, "Continue checkout →")}
      <p style="margin-top:20px;font-size:13px;color:#888;">If something broke on our end, just reply to this email.</p>
    `),
  };
}
function emailTwo(name: string, ctaUrl: string) {
  return {
    subject: "what Zyvo actually does for you",
    html: wrap(`
      <p>Hey ${name},</p>
      <p>Still thinking it over? Fair — here's what people usually ask before finishing setup:</p>
      <p style="margin:0 0 6px;"><b>"Is it worth it?"</b> — most people replace 2-3 separate tools with Zyvo and post more often because there's no more back-and-forth between apps.</p>
      <p style="margin:0 0 6px;"><b>"Can I cancel anytime?"</b> — yes, one click, no retention flow.</p>
      <p>Your checkout is still saved:</p>
      ${ctaButton(ctaUrl, "Finish setting up →")}
    `),
  };
}
function emailThree(name: string, ctaUrl: string, incentive: Incentive) {
  const offerLine =
    incentive.type === "discount"
      ? `<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:28px;font-weight:800;color:#1a1a1a;">${incentive.percent}% off your first payment</p>`
      : `<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:28px;font-weight:800;color:#1a1a1a;">+${incentive.amount} bonus credits</p>`;
  return {
    subject: incentive.type === "discount" ? "a discount to finish setting up" : "some bonus credits, on us",
    html: wrap(`
      <p>Hi ${name},</p>
      <p>Last note on this from me — here's something to make finishing worthwhile:</p>
      <div style="padding:20px 24px;background:#f6f2ff;border-radius:12px;border:1px solid rgba(122,59,255,0.2);text-align:center;margin:16px 0;">
        ${offerLine}
      </div>
      ${ctaButton(ctaUrl, "Claim & continue →")}
      <p style="margin-top:20px;font-size:12px;color:#888;">This is the last email in this sequence.</p>
    `),
  };
}

async function sendEmail(
  to: string,
  checkoutId: string,
  stage: number,
  subject: string,
  html: string,
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Niko from Zyvo <niko@tryzyvo.com>",
      to,
      subject,
      html,
      reply_to: "niko@tryzyvo.com",
      // Consumed by the Resend webhook (Phase 8) to attribute clicks/opens
      // back to this checkout + stage. Resend tag values must be
      // alphanumeric/underscore/dash only.
      tags: [
        { name: "checkout_id", value: checkoutId },
        { name: "stage", value: String(stage) },
      ],
    }),
  });
  if (!res.ok) {
    console.error("[abandoned-checkout-processor] Resend send failed:", await res.text());
    return false;
  }
  return true;
}

/* =================== CTA resolution (Phase 5 step 6) =================== */
async function resolveCtaUrl(row: any, liveSession: any, incentive: Incentive | null) {
  // Discount offers can only be attached to a freshly minted session.
  if (incentive?.type === "discount" && RECOVERY_PROMO_CODE_ID) {
    const fresh = await mintFreshSession(row, { promotionCodeId: RECOVERY_PROMO_CODE_ID });
    if (fresh?.url) return { url: fresh.url as string, mintedSessionId: fresh.id as string, mintedSession: fresh };
  }

  if (liveSession?.status === "open" && liveSession?.url) {
    return { url: liveSession.url as string, mintedSessionId: null, mintedSession: null };
  }

  const recoveryUrl: string | null =
    row.recovery_checkout_url ?? liveSession?.after_expiration?.recovery?.url ?? null;
  if (recoveryUrl) return { url: recoveryUrl, mintedSessionId: null, mintedSession: null };

  const fresh = await mintFreshSession(row);
  if (fresh?.url) return { url: fresh.url as string, mintedSessionId: fresh.id as string, mintedSession: fresh };

  return { url: null, mintedSessionId: null, mintedSession: null };
}

/* =================== Main =================== */
async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const summary = { claimed: 0, sent: 0, converted_before_send: 0, skipped_cooldown: 0, skipped_superseded: 0, errors: 0 };

  const { data: claimed, error: claimErr } = await sb.rpc("claim_due_abandoned_checkouts", {
    p_limit: CLAIM_BATCH_SIZE,
  });
  if (claimErr) {
    console.error("[abandoned-checkout-processor] claim RPC failed:", claimErr.message);
    return new Response(JSON.stringify({ error: claimErr.message }), { status: 500 });
  }

  summary.claimed = claimed?.length ?? 0;

  for (const claimedRow of claimed ?? []) {
    try {
      // Step 1: re-read fresh (the claim itself is already a fresh read,
      // but re-reading defends against anything that changed in the moment
      // between claim and this iteration for an earlier row in the batch).
      const { data: row } = await sb
        .from("abandoned_checkouts")
        .select("*")
        .eq("id", claimedRow.id)
        .single();

      if (!row) continue;

      // Step 2: guard
      if (row.paid || row.status === "converted" || row.status === "superseded") {
        await sb.rpc("release_abandoned_checkout_claim", { p_id: row.id });
        continue;
      }

      // Step 3: confirm still the newest eligible checkout for this user/email
      const identityFilter = row.user_id
        ? { column: "user_id", value: row.user_id }
        : { column: "email", value: row.email };
      const { data: newer } = await sb
        .from("abandoned_checkouts")
        .select("id")
        .eq(identityFilter.column, identityFilter.value)
        .eq("recovery_system_version", "v2")
        .eq("paid", false)
        .in("status", ["pending", "in_sequence", "expired"])
        .neq("id", row.id)
        .gt("created_at", row.created_at)
        .limit(1);

      if (newer && newer.length > 0) {
        await sb.from("abandoned_checkouts")
          .update({ status: "superseded", processing_started_at: null, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        summary.skipped_superseded++;
        continue;
      }

      // Global cooldown — across ALL of this email's rows, not just this one
      const { data: recent } = await sb
        .from("abandoned_checkouts")
        .select("last_email_sent_at")
        .ilike("email", escapeIlike(row.email))
        .eq("recovery_system_version", "v2")
        .not("last_email_sent_at", "is", null)
        .order("last_email_sent_at", { ascending: false })
        .limit(1);

      const lastSent = recent?.[0]?.last_email_sent_at ? new Date(recent[0].last_email_sent_at).getTime() : 0;
      if (lastSent && Date.now() - lastSent < GLOBAL_COOLDOWN_MINUTES * 60 * 1000) {
        await sb.rpc("release_abandoned_checkout_claim", { p_id: row.id });
        summary.skipped_cooldown++;
        continue;
      }

      // Step 4: live Stripe check
      const { ok: sOk, json: liveSession } = row.stripe_session_id
        ? await stripeGet(`/v1/checkout/sessions/${row.stripe_session_id}`)
        : { ok: false, json: null };

      // Step 5: Stripe says paid — trust it over our own state, convert, don't send
      if (sOk && (liveSession?.payment_status === "paid" || liveSession?.status === "complete")) {
        const wasEmailed = (row.recovery_stage ?? 0) > 0;
        await sb.from("abandoned_checkouts").update({
          paid: true,
          status: "converted",
          converted_at: new Date().toISOString(),
          recovered: wasEmailed,
          processing_started_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id).eq("paid", false);

        await sb.from("abandoned_checkout_events").insert({
          checkout_id: row.id,
          event_type: wasEmailed ? "recovered_purchase" : "checkout_converted_without_email",
          stage: row.recovery_stage ?? 0,
          amount: row.amount,
          currency: row.currency,
          metadata: { detected_by: "processor_guard" },
        });
        summary.converted_before_send++;
        continue;
      }

      // Consent check — preserves existing behavior: only an explicit
      // `false` blocks sending; null/never-set defaults to allowed.
      let consent: boolean | null = null;
      if (row.user_id) {
        const { data: prof } = await sb.from("profiles").select("email_updates").eq("id", row.user_id).maybeSingle();
        consent = prof?.email_updates ?? null;
      } else {
        const { data: prof } = await sb.from("profiles").select("email_updates").ilike("email", escapeIlike(row.email)).maybeSingle();
        consent = prof?.email_updates ?? null;
      }
      if (consent === false) {
        await sb.from("abandoned_checkouts").update({
          status: "finished", processing_started_at: null, updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        continue;
      }

      const nextStage = (row.recovery_stage ?? 0) + 1; // 1, 2, or 3
      const name = (row.email || "").split("@")[0].replace(/[._-]/g, " ").trim() || "there";
      const incentive = nextStage === 3 ? pickIncentive(row.id) : null;

      // Step 6: resolve CTA at send time
      const { url: ctaUrl, mintedSessionId, mintedSession } = await resolveCtaUrl(row, sOk ? liveSession : null, incentive);
      if (!ctaUrl) {
        console.error("[abandoned-checkout-processor] could not resolve a CTA url for row", row.id);
        await sb.rpc("release_abandoned_checkout_claim", { p_id: row.id });
        summary.errors++;
        continue;
      }

      // A minted session has a different id than what this row currently
      // tracks. Re-point the row at it so the webhook's exact
      // stripe_session_id match (Phase 4) can still find and convert this
      // row if the customer completes payment through this fresh link --
      // otherwise a recovered purchase through a re-minted/discounted link
      // would silently fail to attribute back to this row.
      if (mintedSessionId && mintedSession) {
        const previousSessionId = row.stripe_session_id;
        await sb.from("abandoned_checkouts").update({
          stripe_session_id: mintedSessionId,
          checkout_url: mintedSession.url ?? ctaUrl,
          expires_at: mintedSession.expires_at ? new Date(mintedSession.expires_at * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        await sb.from("abandoned_checkout_events").insert({
          checkout_id: row.id,
          event_type: "session_reissued",
          stage: nextStage,
          metadata: { previous_session_id: previousSessionId, new_session_id: mintedSessionId },
        });
      }

      const tpl =
        nextStage === 1 ? emailOne(name, ctaUrl) :
        nextStage === 2 ? emailTwo(name, ctaUrl) :
        emailThree(name, ctaUrl, incentive!);

      const sent = await sendEmail(row.email, row.id, nextStage, tpl.subject, tpl.html);
      if (!sent) {
        await sb.rpc("release_abandoned_checkout_claim", { p_id: row.id });
        summary.errors++;
        continue;
      }

      const nowIso = new Date().toISOString();
      await sb.from("abandoned_checkouts").update({
        recovery_stage: nextStage,
        last_email_sent_at: nowIso,
        status: nextStage >= 3 ? "finished" : "in_sequence",
        processing_started_at: null,
        updated_at: nowIso,
      }).eq("id", row.id).eq("paid", false); // no-ops harmlessly if webhook converted it mid-send

      await sb.from("abandoned_checkout_events").insert({
        checkout_id: row.id,
        event_type: `email_${nextStage}_sent`,
        stage: nextStage,
        metadata: incentive ? { incentive: incentive.id, minted_session_id: mintedSessionId } : { minted_session_id: mintedSessionId },
      });

      summary.sent++;
    } catch (rowErr) {
      console.error("[abandoned-checkout-processor] row processing threw:", rowErr);
      await sb.rpc("release_abandoned_checkout_claim", { p_id: claimedRow.id }).catch(() => {});
      summary.errors++;
    }
  }

  console.log("[abandoned-checkout-processor] run summary:", JSON.stringify(summary));
  return new Response(JSON.stringify({ ok: true, summary }), { status: 200 });
}

export default { fetch: handleRequest };
