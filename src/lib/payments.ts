import { supabase } from "./supabaseClient";

type CheckoutParams = {
  type: "subscription" | "topup";
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
};

export async function startCheckout(params: CheckoutParams) {
  const { data: { session } } = await supabase.auth.getSession();
  const token =
    session?.access_token || localStorage.getItem("sb-access-token") || "";

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: params.type,
        priceId: params.priceId,
        successUrl: params.successUrl || `${location.origin}/billing/success`,
        cancelUrl: params.cancelUrl || `${location.origin}/billing/cancel`,
      }),
    }
  );

  const raw = await res.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!res.ok) throw new Error(data?.error || raw || "Failed to create session");
  if (!data?.url) throw new Error("No checkout URL returned");
  location.href = data.url;
}

/** Opens Stripe Billing Portal.
 *  options.flow:
 *   - 'change_plan' => land directly in the plan picker
 *   - 'home'        => portal home (default)
 *  options.returnPath: path to send user back to (default: /settings/billing)
 */
export async function openBillingPortal(options?: {
  flow?: "change_plan" | "home";
  returnPath?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token =
    session?.access_token || localStorage.getItem("sb-access-token") || "";

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        flow: options?.flow || "home",
        returnPath: options?.returnPath,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error("Portal error:", data);
    alert(`Portal error: ${data?.error || "unknown"}`);
    return;
  }

  // Debug once to confirm config wiring
  console.log("PORTAL DEBUG:", data.debug);
  alert(`config=${data?.debug?.config}
deepLinked=${data?.debug?.deepLinked}
subProductId=${data?.debug?.subProductId}
subPriceId=${data?.debug?.subPriceId}
allowedProducts=${(data?.debug?.allowedProducts || []).join(", ")}
allowedPrices=${(data?.debug?.allowedPrices || []).join(", ")}`);

  location.href = data.url;
}
