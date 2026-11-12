// _shared/adminAlert.ts — one email to the owner when something needs them.
// Sent straight through Resend (never the outbox), to ALERT_EMAIL (else
// CONTACT_TO_EMAIL). Never throws: an alert that can't be sent is logged and
// the work it describes goes on.
//
// Grouped (owner, 2026-10-26: "Group them so I don't get 17 of the same alert"):
// the same alert — the subject with its numbers blanked — goes out at most once
// per ALERT_GROUP_S. The ones held back are counted in the system log (source
// "ops-alert-group") and the next email of that kind says how many there were.
export const ALERT_GROUP_S = 6 * 3600;
export const alertGroupKey = (subject: string) => subject.replace(/\$?\d[\d.,:%]*/g, "#").replace(/\s+/g, " ").trim().slice(0, 200);

async function groupGate(subject: string): Promise<{ send: boolean; heldBack: number }> {
  const url = Deno.env.get("SUPABASE_URL"), sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !sk) return { send: true, heldBack: 0 }; // no database: send, never lose an alert
  const h = { apikey: sk, Authorization: `Bearer ${sk}`, "Content-Type": "application/json" };
  const key = alertGroupKey(subject);
  try {
    const since = new Date(Date.now() - ALERT_GROUP_S * 1000).toISOString();
    const q = `${url}/rest/v1/system_logs?source=eq.ops-alert-group&event=eq.${encodeURIComponent(key.slice(0, 120))}&created_at=gte.${since}&select=level&order=created_at.desc&limit=500`;
    const rows: { level: string }[] = await (await fetch(q, { headers: h, signal: AbortSignal.timeout(5000) })).json();
    const sentInWindow = Array.isArray(rows) && rows.some((r) => r.level === "info");
    await fetch(`${url}/rest/v1/system_logs`, { method: "POST", headers: h, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ source: "ops-alert-group", level: sentInWindow ? "debug" : "info", event: key.slice(0, 120), message: subject.slice(0, 300), details: {} }) });
    if (sentInWindow) return { send: false, heldBack: 0 };
    // How many of this kind were held back since the last one that went out (in the window before it).
    const before = new Date(Date.now() - 2 * ALERT_GROUP_S * 1000).toISOString();
    const older: { level: string }[] = await (await fetch(`${url}/rest/v1/system_logs?source=eq.ops-alert-group&event=eq.${encodeURIComponent(key.slice(0, 120))}&created_at=gte.${before}&created_at=lt.${since}&select=level&limit=1000`, { headers: h, signal: AbortSignal.timeout(5000) })).json();
    return { send: true, heldBack: Array.isArray(older) ? older.filter((r) => r.level === "debug").length : 0 };
  } catch {
    return { send: true, heldBack: 0 };
  }
}

export async function alertAdmin(subject: string, text: string, tag = "alert"): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("ALERT_EMAIL") ?? Deno.env.get("CONTACT_TO_EMAIL");
  if (!key || !to) { console.error(`[${tag}] ${subject} (no ALERT_EMAIL to send to)`); return false; }
  const gate = await groupGate(subject);
  if (!gate.send) { console.warn(`[${tag}] held back (same alert in the last ${ALERT_GROUP_S / 3600} h): ${subject}`); return false; }
  if (gate.heldBack > 0) text = `${text}\n\n(${gate.heldBack} more alert${gate.heldBack === 1 ? "" : "s"} like this were held back in the ${ALERT_GROUP_S / 3600} hours before this one.)`;
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
