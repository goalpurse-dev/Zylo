// stickman/sceneLadder.ts — what a scene does when a draw fails (2026-10-07). Pure: tested offline.
//
// A scene never fails on its first error, and it never holds the video up:
//   the normal prompt -> up to 3 retries with growing waits (5 s, 20 s, 60 s, each
//   plus jitter) -> the simplified safe prompt -> the safe prompt on a BACKUP
//   model (V2 <-> V3) -> COVERED: the scene is marked failed and the picture
//   before it stays on screen over its time (src/lib/stickmanEdit.js), so the
//   video, the editor and Publish never wait for it. The scene card keeps
//   "Try again (free)".
// The step is kept on the scene row (qa.ladder), so a wait that does not fit in
// one worker's time is deferred: the row keeps its lease until the wait is over
// and the watchdog hands it to the next worker, which carries on from that step.
import { OUT_OF_BALANCE } from "../runwareBalance.ts";
import type { Tier } from "./renderTiers.ts";

export type RungKind = "normal" | "safe" | "backup";
export const SCENE_LADDER: { kind: RungKind; waitS: number }[] = [
  { kind: "normal", waitS: 0 },
  { kind: "normal", waitS: 5 },
  { kind: "normal", waitS: 20 },
  { kind: "normal", waitS: 60 },
  { kind: "safe", waitS: 0 },
  { kind: "backup", waitS: 0 },
];
export const SAFE_STEP = SCENE_LADDER.findIndex((r) => r.kind === "safe");
// The other model family: FLUX (V2) <-> Nano Banana Lite (V3/V4).
export const BACKUP_TIER: Record<Tier, Tier> = { V2: "V3", V3: "V2", V4: "V2" };

// One call to the image provider. The proxy itself waits up to 170 s, longer
// than a scene's lease: a call that hangs must become a retry, not a dead worker.
export const PROVIDER_TIMEOUT_MS = 75_000;
// Work one worker does before it hands the scene on (the lease is renewed per step).
export const IN_PROCESS_BUDGET_S = 110;
export const STEP_RESERVE_S = 35;
// A scene the watchdog cannot hand on (a split scene's own picture) does everything in one worker, up to this.
export const HARD_BUDGET_S = 300;

export type FailureKind = "balance" | "prompt" | "safety" | "check" | "provider";
const SAFETY = /safety|moderat|nsfw|content[ _-]?polic|prohibited|inappropriate|sensitive|blocked|invalid\w*prompt|unsafe/i;
export function classifyFailure(message: string): FailureKind {
  const m = String(message ?? "");
  if (OUT_OF_BALANCE.test(m)) return "balance";        // our account can't pay: the scene waits, drawing pauses
  if (/prompt check:/i.test(m)) return "prompt";        // our own prompt rule: the same prompt fails the same way
  if (SAFETY.test(m)) return "safety";                  // the provider refused the picture
  if (/^image_failed$/.test(m)) return "check";         // our own image checks
  return "provider";                                    // 504, timeout, internalError, a dropped connection...
}

export type LadderState = { step: number; failures: string[]; checks: number };
export const ladderOf = (qa: any): LadderState => ({
  step: Math.min(Math.max(0, Number(qa?.ladder?.step ?? 0) || 0), SCENE_LADDER.length - 1),
  failures: Array.isArray(qa?.ladder?.failures) ? qa.ladder.failures.slice(-12) : [],
  checks: Number(qa?.ladder?.checks ?? 0) || 0,
});

// After a failed step: the next one and how long to wait first, or "covered".
// A temporary provider error waits (the provider needs the time); a refusal of
// the prompt goes straight to the safe prompt (waiting changes nothing), and so
// does a picture that failed our own checks twice.
export function nextRung(step: number, kind: Exclude<FailureKind, "balance">, checks: number, rand: () => number = Math.random): { covered: true } | { covered: false; step: number; waitS: number } {
  let next = step + 1;
  if ((kind === "prompt" || kind === "safety" || (kind === "check" && checks >= 2)) && next < SAFE_STEP) next = SAFE_STEP;
  if (next >= SCENE_LADDER.length) return { covered: true };
  const base = kind === "provider" ? SCENE_LADDER[next].waitS : 0;
  return { covered: false, step: next, waitS: base ? Math.round(base * (1 + 0.25 * rand())) : 0 };
}

// One worker's climb. `draw` makes one picture on a step (it throws on a provider
// error and returns failed:true when our own checks reject the picture). The
// outcome says what the worker must write on the row; `state` is updated in place.
export type LadderOutcome<T> =
  | { kind: "drawn"; result: T; rung: RungKind }
  | { kind: "balance"; result: T | null; message: string }
  | { kind: "deferred"; result: T | null; waitS: number }
  | { kind: "covered"; result: T | null };
export async function climbLadder<T extends { failed: boolean }>(o: {
  state: LadderState; canDefer: boolean;
  draw: (rung: RungKind) => Promise<T>;
  sleep: (ms: number) => Promise<unknown>; renewLease: () => Promise<void>; elapsedS: () => number; rand?: () => number;
}): Promise<LadderOutcome<T>> {
  const s = o.state;
  let result: T | null = null;
  for (;;) {
    const rung = SCENE_LADDER[s.step].kind;
    let failure: string;
    try {
      result = await o.draw(rung);
      if (!result.failed) return { kind: "drawn", result, rung };
      failure = "image_failed";
    } catch (e) {
      result = null;
      failure = String(e).slice(0, 200);
    }
    s.failures.push(rung === "normal" ? failure : `${rung}: ${failure}`);
    const kind = classifyFailure(failure);
    if (kind === "balance") return { kind: "balance", result, message: failure };
    if (kind === "check") s.checks++;
    const next = nextRung(s.step, kind, s.checks, o.rand);
    if (next.covered) return { kind: "covered", result };
    s.step = next.step;
    const fit = fitsInProcess(o.elapsedS(), next.waitS, o.canDefer);
    if (fit === "stop") return { kind: "covered", result };
    if (fit === "defer") return { kind: "deferred", result, waitS: next.waitS };
    if (next.waitS) await o.sleep(next.waitS * 1000);
    await o.renewLease();
  }
}

// The ladder ended with nothing drawn. One bad scene is COVERED. But when every failure was the
// provider's and no scene anywhere finished lately, the provider is down: covering would turn an
// outage into a video of still pictures at full price. Then the scene goes back to the queue and
// drawing pauses (runwareBalance.markProviderDown), a few times at most and for OUTAGE_MAX_S at most.
export const OUTAGE_WINDOW_S = 300;
export const OUTAGE_MAX_REQUEUES = 6;
export const OUTAGE_MAX_S = 6 * 3600;
export type OutageState = { count: number; since: string } | null | undefined;
export const providerOnly = (failures: string[]) => failures.length > 0 && failures.every((f) => classifyFailure(f.replace(/^(?:safe|backup): /, "")) === "provider");
export function outageDecision(a: { failures: string[]; readyLately: number; outage: OutageState; nowMs: number }): { kind: "cover" } | { kind: "wait"; outage: { count: number; since: string } } {
  if (!providerOnly(a.failures) || a.readyLately > 0) return { kind: "cover" };
  const since = a.outage?.since ?? new Date(a.nowMs).toISOString();
  const count = Number(a.outage?.count ?? 0);
  if (count >= OUTAGE_MAX_REQUEUES || a.nowMs - Date.parse(since) > OUTAGE_MAX_S * 1000) return { kind: "cover" };
  return { kind: "wait", outage: { count: count + 1, since } };
}

// Does the wait + the next step still fit in this worker? If not it is deferred.
export function fitsInProcess(elapsedS: number, waitS: number, canDefer: boolean): "run" | "defer" | "stop" {
  const need = elapsedS + waitS + STEP_RESERVE_S;
  if (need <= IN_PROCESS_BUDGET_S) return "run";
  if (canDefer) return "defer";
  return need <= HARD_BUDGET_S ? "run" : "stop";
}
