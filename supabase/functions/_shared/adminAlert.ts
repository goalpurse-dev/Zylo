// _shared/adminAlert.ts — one email to the owner when something needs them.
// Sent straight through Resend (never the outbox), to ALERT_EMAIL (else
// CONTACT_TO_EMAIL). Never throws: an alert that can't be sent is logged and
// the work it describes goes on.
export async function alertAdmin(subject: string, text: string, tag = "alert"): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("ALERT_EMAIL") ?? Deno.env.get("CONTACT_TO_EMAIL");
  if (!key || !to) { console.error(`[${tag}] ${subject} (no ALERT_EMAIL to send to)`); return false; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Zyvo Alerts <hello@tryzyvo.com>", to, subject, text }), signal: AbortSignal.timeout(10_000),
    });
    await r.body?.cancel();
    if (!r.ok) console.error(`[${tag}] alert email refused: ${r.status}`);
    return r.ok;
  } catch (e) {
    console.error(`[${tag}] alert email failed:`, String(e));
    return false;
  }
}
