import { toast } from "sonner";
import { supabase } from "./supabaseClient";
// One source for price ids: the map the webhook and create-checkout-session read.
// @ts-ignore plain JS module shared with the edge functions
import { PLAN_PRICE_IDS } from "../../supabase/functions/_shared/stripePlanPrices.js";

export const SUPPORT_EMAIL = "support@tryzyvo.com";

type PlanId = "starter" | "pro" | "generative";
type Billing = "monthly" | "yearly";

/**
 * What to buy: a plan (planId + billing, or one of today's price ids) or a
 * one-time credit pack. successUrl / cancelUrl: where Stripe sends the customer
 * afterwards (our own site only; default /billing/success and /billing/cancel).
 */
export type CheckoutParams = {
  type: "subscription" | "topup";
  planId?: PlanId;
  billing?: Billing;
  priceId?: string;
  pack?: string;
  successUrl?: string;
  cancelUrl?: string;
  [extra: string]: unknown; // older callers pass userId / email / metadata: ignored, the server knows the user
};
type Checked = { type: "subscription"; planId: PlanId; billing: Billing; successUrl?: string; cancelUrl?: string }
  | { type: "topup"; pack: string; successUrl?: string; cancelUrl?: string };

/** A payment step that failed. `code` picks the message the user sees (paymentErrorMessage). */
export class PaymentError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

/** What to tell the user when a checkout or portal call fails. Never a raw server error. */
export function paymentErrorMessage(e: unknown): string {
  const code = e instanceof PaymentError ? e.code : "";
  if (code === "ALREADY_SUBSCRIBED") return "You already have an active plan. You can change it in billing.";
  if (code === "INVALID_PLAN") return "That plan isn't available right now. Please refresh the page and try again.";
  if (code === "NETWORK") return "We couldn't reach the payment service. Check your connection and try again.";
  if (code === "PORTAL") return `We couldn't open billing. Please try again, or write to ${SUPPORT_EMAIL} if it keeps happening.`;
  return `We couldn't start the checkout, and you have not been charged. Please try again, or write to ${SUPPORT_EMAIL} if it keeps happening.`;
}

/* ---------- a plan picked before signing up ---------- */
// A logged-out visitor's choice, kept in this browser across sign-up (Google,
// or the link in the confirmation email) and picked up once by ResumeCheckout.
const INTENT_KEY = "zyvo:checkout-intent";
const INTENT_MAX_AGE_MS = 60 * 60 * 1000;

function validParams(p: any): Checked | null {
  const urls = {
    ...(typeof p?.successUrl === "string" ? { successUrl: p.successUrl } : {}),
    ...(typeof p?.cancelUrl === "string" ? { cancelUrl: p.cancelUrl } : {}),
  };
  if (p?.type === "topup" && typeof p.pack === "string") return { type: "topup", pack: p.pack, ...urls };
  if (p?.type !== "subscription") return null;
  if (PLAN_PRICE_IDS[p.planId]) {
    return { type: "subscription", planId: p.planId, billing: p.billing === "yearly" ? "yearly" : "monthly", ...urls };
  }
  // A price id: one of today's plan prices → its plan and billing.
  for (const [planId, ids] of Object.entries(PLAN_PRICE_IDS as Record<string, { monthly: string; yearly: string }>)) {
    if (p.priceId === ids.monthly) return { type: "subscription", planId: planId as PlanId, billing: "monthly", ...urls };
    if (p.priceId === ids.yearly) return { type: "subscription", planId: planId as PlanId, billing: "yearly", ...urls };
  }
  return null;
}

export function saveCheckoutIntent(params: CheckoutParams) {
  try { localStorage.setItem(INTENT_KEY, JSON.stringify({ ...params, at: Date.now() })); } catch { /* no storage: they pick the plan again */ }
}

/** The saved choice, once: reading it removes it. Null when there is none or it is over an hour old. */
export function takeCheckoutIntent(): CheckoutParams | null {
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    localStorage.removeItem(INTENT_KEY);
    const saved = JSON.parse(raw);
    return Date.now() - Number(saved?.at) < INTENT_MAX_AGE_MS ? validParams(saved) : null;
  } catch { return null; }
}

/* ---------- what the account looked like before paying ---------- */
// Read by the success page to tell when the plan / credits have arrived.
const PENDING_KEY = "zyvo:checkout-pending";
const PENDING_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type PendingCheckout = { kind: "subscription" | "topup"; planId?: string; credits: number | null; at: number };

export function readPendingCheckout(): PendingCheckout | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    return saved && Date.now() - Number(saved.at) < PENDING_MAX_AGE_MS ? saved : null;
  } catch { return null; }
}
export function clearPendingCheckout() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* nothing to clear */ }
}

async function callFunction(name: string, token: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PaymentError("NETWORK");
  }
  let data: any = {};
  try { data = await res.json(); } catch { /* not JSON: handled by the status */ }
  return { res, data };
}

/**
 * Sends the user to Stripe Checkout. Resolves true when the browser is leaving
 * the page (to Stripe, to sign-up, to the billing portal), false when nothing
 * happens next. Throws PaymentError: show paymentErrorMessage(e).
 * options.resumed: the automatic continuation after sign-up (ResumeCheckout).
 */
export async function startCheckout(params: CheckoutParams, options?: { resumed?: boolean }): Promise<boolean> {
  const checked = validParams(params);
  if (!checked) throw new PaymentError("INVALID_PLAN");

  const { data: { session } } = await supabase.auth.getSession();

  // Not signed in: remember the choice, sign up, then continue to checkout.
  if (!session?.user) {
    saveCheckoutIntent(checked);
    window.location.href = "/signup";
    return true;
  }

  const body = checked.type === "topup"
    ? { type: "topup", pack: checked.pack }
    : { type: "subscription", priceId: PLAN_PRICE_IDS[checked.planId][checked.billing] };

  const [{ res, data }, before] = await Promise.all([
    callFunction("create-checkout-session", session.access_token, {
      ...body,
      successUrl: checked.successUrl || `${location.origin}/billing/success`,
      cancelUrl: checked.cancelUrl || `${location.origin}/billing/cancel`,
    }),
    // The balance before paying, for the success page. Never blocks checkout.
    supabase.from("profiles").select("credit_balance").eq("id", session.user.id).maybeSingle().then(
      ({ data: row }) => (typeof row?.credit_balance === "number" ? row.credit_balance : null),
      () => null,
    ),
  ]);

  if (res.status === 401) {
    saveCheckoutIntent(checked);
    window.location.href = "/login";
    return true;
  }

  // One subscription per account: an existing subscriber changes plan in billing.
  if (res.status === 409 || data?.code === "ALREADY_SUBSCRIBED") {
    if (options?.resumed) {
      toast.info("You already have an active plan, so we didn't start a new checkout.");
      return false;
    }
    toast.info("You already have an active plan. Opening billing so you can change it…");
    return openBillingPortal({ flow: "change_plan", returnPath: "/pricing" });
  }

  if (!res.ok || !data?.url) {
    console.error("create-checkout-session failed:", res.status, data?.error);
    throw new PaymentError(data?.code === "INVALID_PLAN" ? "INVALID_PLAN" : "CHECKOUT");
  }

  try {
    const pending: PendingCheckout = {
      kind: checked.type,
      planId: checked.type === "subscription" ? checked.planId : undefined,
      credits: before,
      at: Date.now(),
    };
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch { /* no storage: the success page shows the general message */ }

  location.href = data.url;
  return true;
}

/**
 * Opens the Stripe billing portal. Resolves true when the browser is leaving
 * the page. Throws PaymentError: show paymentErrorMessage(e).
 *  options.flow:
 *   - 'change_plan'    => the plan picker (needs a live subscription)
 *   - 'payment_method' => update the card
 *   - 'home'           => portal home: plan, cards, invoices (default)
 *  options.returnPath: where the portal's back link leads: "/settings"
 *   (default), "/pricing" or "/", with any query string.
 */
export async function openBillingPortal(options?: {
  flow?: "change_plan" | "payment_method" | "home";
  returnPath?: string;
}): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = "/login";
    return true;
  }

  const { res, data } = await callFunction("create-portal-session", session.access_token, {
    flow: options?.flow || "home",
    returnPath: options?.returnPath,
  });

  if (!res.ok || !data?.url) {
    console.error("create-portal-session failed:", res.status, data?.error);
    throw new PaymentError("PORTAL");
  }

  location.href = data.url;
  return true;
}
