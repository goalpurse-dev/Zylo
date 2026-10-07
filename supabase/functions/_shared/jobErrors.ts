// _shared/jobErrors.ts — what a user reads when a generation job fails (2026-10-07). Pure.
// jobs.error is shown as it is in the app (the generations dock, the job page,
// several tools). It used to carry whatever the provider call threw ("Runware
// launch failed (504)"). A message that reads like a machine's is replaced by
// plain words; the raw text goes to the system log, never to the user.
export const GENERIC_FAILURE = "Something went wrong on our side, so nothing was charged. Please try again.";
export const OUT_OF_CREDITS = "You don't have enough credits for this. Add credits and try again.";
const RAW = /\(\d{3}\)|\b[45]\d{2}\b|runware|atlas|launch failed|poll failed|internalError|provider_|timeout|timed out|exception|undefined|null|\{|\}|https?:\/\/|rpc|sql|stack|taskUUID/i;

export function plainJobError(code: unknown, raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (String(code ?? "") === "INSUFFICIENT_CREDITS" || s === "INSUFFICIENT_CREDITS") return OUT_OF_CREDITS;
  if (!s || s.length > 220 || /^[A-Z0-9_:. -]+$/.test(s) || RAW.test(s)) return GENERIC_FAILURE;
  return s;
}
