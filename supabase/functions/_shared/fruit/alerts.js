// Out-of-credit guard for AI Fruit Story v2: spots "our provider account is
// out of balance" errors, records one alert per provider, and emails the admin
// when an alert opens. See migration 20260930170440_fruit_provider_alerts.

/** Words providers use when OUR account can't pay (Runware, Anthropic, OpenAI). */
export const OUT_OF_BALANCE = /insufficient|not enough (?:credit|balance|fund)|low balance|\bbalance\b|out of credit|payment.?required|billing|quota|credit balance/i;

/** An LLM error (llm.js LlmError details) that means the account is out of balance. */
export function llmOutOfBalance(details) {
  if (!details) return false;
  const body = JSON.stringify(details.response ?? "").slice(0, 2000);
  return details.httpStatus === 402 || OUT_OF_BALANCE.test(body);
}

/** Paid steps are refused before charging while an alert is this fresh. */
export const ALERT_HOLD_MIN = 10;

/** True when new paid work on this provider should wait (an alert in the last ALERT_HOLD_MIN minutes). */
export async function providerOnHold(admin, provider) {
  const since = new Date(Date.now() - ALERT_HOLD_MIN * 60_000).toISOString();
  const { data } = await admin.from("fruit_provider_alerts").select("provider").eq("provider", provider).gte("last_seen_at", since).maybeSingle();
  return Boolean(data);
}

/**
 * Records a refusal and, when it opens a new alert, emails the admin.
 * Never throws: alerting must not break the user's refund.
 */
export async function raiseProviderAlert(admin, env, { provider, code, message, context = {} }) {
  try {
    const { data: notify, error } = await admin.rpc("fruit_raise_provider_alert", { p_provider: provider, p_code: String(code ?? ""), p_message: String(message ?? ""), p_context: context });
    if (error) { console.error("[fruit] alert:", error.message); return; }
    console.error(`[fruit] ALERT ${provider} out of balance: ${code} ${message}`);
    if (!notify || !env?.RESEND_API_KEY || !env?.ALERT_EMAIL) return;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Zyvo Alerts <niko@tryzyvo.com>",
        to: env.ALERT_EMAIL,
        subject: `AI Fruit Story: ${provider} is out of balance`,
        text: `${provider} refused AI Fruit Story work because the account is out of balance.\n\n${code}: ${message}\n\nUsers were refunded and see "temporarily unavailable". New paid steps are paused for ${ALERT_HOLD_MIN} minutes after each refusal and resume on their own. Top up ${provider}, then nothing else is needed.\n\nDetails: ${JSON.stringify(context).slice(0, 1500)}`,
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch((e) => console.error("[fruit] alert email failed:", e?.message ?? e));
  } catch (e) {
    console.error("[fruit] alert failed:", e?.message ?? e);
  }
}
