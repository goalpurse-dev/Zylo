// Phase 6a — wake the Stickman autopilot right after a stage finishes, so the
// next step starts within seconds instead of on the next 1-minute cron tick.
// Fire-and-forget (kept alive with EdgeRuntime.waitUntil); the cron sweep is
// the safety net if this request is ever lost.
export function nudgeAutopilot(projectId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/advance-long-form-autopilot`;
  const secret = Deno.env.get("LONG_FORM_AUTOPILOT_SECRET") ?? "";
  if (!secret) return;
  const p = fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-autopilot-secret": secret }, body: JSON.stringify({ projectId }) })
    .then((r) => r.body?.cancel())
    .catch((e) => console.error("[autopilot] nudge failed", projectId, String(e)));
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
}
