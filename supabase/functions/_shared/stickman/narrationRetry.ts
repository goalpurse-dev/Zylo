// stickman/narrationRetry.ts — what the voice step does when the provider fails (2026-10-07). Pure: tested offline.
//
// A failed voice call used to fail the row at once, give the whole hold back
// and stop the video ("the voiceover failed"). Now the project never fails for
// a provider that is down:
//   - one quick retry in the same worker (5 s);
//   - then the row is PAUSED: it stays "generating", its lease runs until the
//     next try (30 s, 1 min, 2 min, 5 min, then every 10 min), and the watchdog
//     that already resumes stalled voice rows picks it up. Nothing is charged,
//     nothing is refunded, the video goes on by itself when the provider is back;
//   - our own account (no credits left, a bad key): paused the same way and the
//     owner is emailed at once; a provider that stays down is reported after the
//     third pause;
//   - only after NARRATION_PAUSE_MAX_S, or for a request the provider will never
//     accept, does the voice fail — and then the whole hold goes back by itself.
export const NARRATION_QUICK_RETRY_WAIT_S = 5;
// A quick retry only when the first call failed fast (a slow failure already used the worker's time).
export const NARRATION_QUICK_RETRY_WITHIN_S = 30;
export const NARRATION_PAUSE_WAITS_S = [30, 60, 120, 300, 600];
export const NARRATION_PAUSE_MAX_S = 6 * 3600;
export const NARRATION_INPUT_TRIES = 2;
export const NARRATION_ALERT_AFTER_PAUSES = 3;
export const NARRATION_PAUSED_COPY = "Paused for a moment, continues automatically.";

export type NarrationFailureKind = "transient" | "account" | "input";
export function classifyNarrationFailure(message: string): NarrationFailureKind {
  const m = String(message ?? "");
  const status = Number(/NARRATION_TTS_PROVIDER_FAILED: (\d{3})/.exec(m)?.[1] ?? 0);
  // Our ElevenLabs account: out of credits, a bad or missing key, a blocked account.
  if (status === 401 || status === 402 || status === 403 || /quota_exceeded|insufficient|payment|invalid_api_key|unusual_activity|missing_permissions/i.test(m)) return "account";
  if (status === 429 || status >= 500) return "transient";
  // The provider read the request and refused it (a voice that is gone, text it won't take).
  if (status >= 400) return "input";
  return "transient"; // a timeout, a dropped connection, no audio in the answer, a failed upload
}

export type NarrationPauseState = { since: string; tries: number } | null | undefined;
export type NarrationFailureDecision =
  | { kind: "pause"; waitS: number; tries: number; since: string; alert: "account" | "down" | null }
  | { kind: "fail"; why: "input" | "paused_too_long" };

export function decideNarrationFailure(a: { message: string; paused: NarrationPauseState; nowMs: number }): NarrationFailureDecision {
  const kind = classifyNarrationFailure(a.message);
  const tries = Number(a.paused?.tries ?? 0);
  const since = a.paused?.since ?? new Date(a.nowMs).toISOString();
  if (kind === "input" && tries >= NARRATION_INPUT_TRIES) return { kind: "fail", why: "input" };
  if (a.nowMs - Date.parse(since) > NARRATION_PAUSE_MAX_S * 1000) return { kind: "fail", why: "paused_too_long" };
  const waitS = NARRATION_PAUSE_WAITS_S[Math.min(tries, NARRATION_PAUSE_WAITS_S.length - 1)];
  const alert = kind === "account" && tries === 0 ? "account" : kind !== "account" && tries + 1 === NARRATION_ALERT_AFTER_PAUSES ? "down" : null;
  return { kind: "pause", waitS, tries: tries + 1, since, alert };
}

export function narrationAlert(kind: "account" | "down" | "failed", a: { projectId: string; rowId: string; message: string; tries: number }): { subject: string; text: string } {
  const head = kind === "account" ? "Zyvo: the voice provider refused us (account) — voice paused"
    : kind === "down" ? "Zyvo: the voice provider keeps failing — voice paused"
    : "Zyvo: a voiceover failed for good — hold released";
  return {
    subject: head,
    text: [
      kind === "failed" ? "A Long Form voiceover could not be made and the project's credits were given back." : "A Long Form voiceover is paused. It is tried again automatically (30 s, 1 min, 2 min, 5 min, then every 10 min, for up to 6 hours).",
      "",
      `Project: ${a.projectId}`,
      `Voice row: ${a.rowId}`,
      `Tries so far: ${a.tries}`,
      `Provider said: ${a.message.slice(0, 300)}`,
      "",
      kind === "account" ? "This looks like OUR ElevenLabs account (credits, key or access). Every new video will pause at the voice until it is fixed." : kind === "down" ? "Nothing to do if ElevenLabs is having an outage: paused videos continue by themselves." : "The user read that every credit is back in their account.",
      kind === "failed" ? "" : `The user sees: "${NARRATION_PAUSED_COPY}"`,
    ].join("\n").trim(),
  };
}
