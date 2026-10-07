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

// The same alert at most once per `everyS` (a long outage is one email, not one a minute).
// The memory is the system log itself (source "ops-alert", event = key): no table of its own.
export async function alertOnce(admin: any, key: string, everyS: number, subject: string, text: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - everyS * 1000).toISOString();
    const { data: seen } = await admin.from("system_logs").select("id").eq("source", "ops-alert").eq("event", key).gte("created_at", since).limit(1);
    if (seen?.length) return false;
    await admin.from("system_logs").insert({ source: "ops-alert", level: "warn", event: key, message: subject.slice(0, 300), details: {} });
    return await alertAdmin(subject, text, key);
  } catch (e) {
    console.error(`[ops-alert] ${key}:`, String(e));
    return false;
  }
}
