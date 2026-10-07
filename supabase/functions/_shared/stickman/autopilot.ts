// deno-lint-ignore-file no-explicit-any
// stickman/autopilot.ts — the Stickman "Generate video" pipeline (Phase 6a).
//
// One continuous, server-side chain with NO user clicks in between:
//   story plan -> research-lite -> script (write -> verify -> fix -> critic)
// Research-lite is a HELPER, never a gate: a thin result still goes straight
// to the script, and the legacy repair research never runs for Stickman.
//
// Pure: decideAutopilot() reads the project's rows and the autopilot record
// and returns the next action. advance-long-form-autopilot performs it (cron
// every minute + direct dispatch). The same function drives the progress
// screen (stage, honest ETA range, never-backwards progress) and the
// WATCHDOG: a stage with no server heartbeat for (expected + 90 s) is
// re-dispatched from its last checkpoint, up to MAX_RESUMES times.
//
// 2026-10-07 (a user must never be left stuck):
//   - a script that FAILED is written again up to SCRIPT_MAX_RETRIES times on
//     the default model, then once more on the backup model;
//   - when even that fails there is no script, so no video can be made: the
//     run stops and the whole credit hold is released at once (the caller does
//     it), with no Retry for the user to find and press.

export type UiStage = "plan" | "research" | "write" | "verify" | "polish";
export const UI_STAGES: { key: UiStage; label: string }[] = [
  { key: "plan", label: "Planning the story" },
  { key: "research", label: "Finding facts" },
  { key: "write", label: "Writing" },
  { key: "verify", label: "Fact-checking" },
  { key: "polish", label: "Polishing" },
];

// Measured on real Stickman runs (2026-09, n=60 plans, 19 research-lite, 16
// scripts): [typical, slow] seconds per UI stage.
export const STAGE_SECONDS: Record<UiStage, [number, number]> = {
  plan: [78, 117],        // story plan: median 78 s, p90 117 s
  research: [140, 185],   // research-lite: 125-185 s
  write: [110, 200],      // script draft (+ its one bounded repair)
  verify: [60, 110],      // claim_verify + claim_fix
  polish: [60, 190],      // critic (+ fixing) + finalizing
};
export const WATCHDOG_GRACE_S = 90;
export const MAX_RESUMES = 3;
export const SCRIPT_MAX_RETRIES = 3;

// Worker stage -> UI stage.
const RESEARCH_UI: Record<string, UiStage> = {};
const SCRIPT_UI: Record<string, UiStage> = { draft: "write", claim_verify: "verify", claim_fix: "verify", critic: "polish", fixing: "polish", finalizing: "polish" };
export function uiStageOf(kind: "plan" | "research" | "script", workerStage?: string | null): UiStage {
  if (kind === "plan") return "plan";
  if (kind === "research") return RESEARCH_UI[String(workerStage)] ?? "research";
  return SCRIPT_UI[String(workerStage)] ?? "write";
}

// Expected seconds for ONE worker stage (the watchdog's budget before grace).
const WORKER_STAGE_S: Record<string, number> = {
  plan: 117,
  lite_claim_plan: 100, lite_verify: 100, lite_gap_verify: 100, finalizing: 60,
  draft: 240, claim_verify: 120, claim_fix: 150, critic: 120, fixing: 200,
};
export const expectedStageSeconds = (workerStage: string) => WORKER_STAGE_S[workerStage] ?? 150;

export type AutopilotRecord = {
  status: "running" | "done" | "failed";
  startedAt: string;
  resumes: number;
  // Last dispatch per step (an idempotent re-run can see what is in flight).
  dispatched?: { plan?: string; research?: string; script?: string };
  resumeLog?: { at: string; stage: string; reason: string }[];
  progressMax?: number;
  // The furthest UI stage shown so far: the step list never goes backwards (a critic pass
  // can send the script worker back to a draft/verify stage — 3f65a0c7 jumped from Polishing back).
  stageMax?: UiStage;
  failedReason?: string | null;
  // Failed scripts written again in this run (the default model, then the backup model).
  scriptRetries?: number;
  // Set when the run ended with no video possible and the whole hold was given back.
  holdReleasedAt?: string | null;
  doneAt?: string | null;
  scriptVersionId?: string | null;
  // Phase 6b: "narration" once the script is finished (lock -> voice).
  phase?: "narration" | null;
  narration?: { lockedAt?: string | null; kicks?: number; status?: "ready" | "failed" | null } | null;
};

export type AutopilotInput = {
  now: string;
  autopilot: AutopilotRecord;
  plan: { id: string; created_at: string } | null;
  research: { id: string; status: string; stage: string | null; stage_started_at: string | null; worker_lock_until: string | null; created_at: string } | null;
  script: { id: string; status: string; stage: string | null; stage_started_at: string | null; worker_lock_until: string | null; created_at: string; has_document: boolean } | null;
};

export type AutopilotAction =
  | { kind: "generate_plan"; resume: boolean }
  | { kind: "start_research"; resume: boolean }
  | { kind: "start_script"; resume: boolean; afterFailure?: boolean; backupModel?: boolean }
  | { kind: "resume_research" }
  | { kind: "resume_script" }
  | { kind: "wait" }
  | { kind: "done"; scriptVersionId: string }
  | { kind: "fail"; reason: string };

export type AutopilotDecision = {
  action: AutopilotAction;
  uiStage: UiStage;
  workerStage: string;
  heartbeatAt: string | null;
  stale: boolean;
  etaSeconds: [number, number];
  progress: number;
};

const ms = (s: string | null | undefined) => (s ? Date.parse(s) : NaN);
const SCRIPT_DONE = new Set(["ready", "needs_attention", "needs_research"]);
const RESEARCH_TERMINAL = new Set(["ready", "needs_attention", "failed"]);

// Progress: finished UI stages count fully, the current one by elapsed time
// against its typical duration (capped at 90% of the stage); remaining ETA
// is the rest of the current stage plus every later stage, as [typical, slow].
function progressAndEta(stage: UiStage, stageStartMs: number, nowMs: number, prevMax = 0) {
  const order = UI_STAGES.map((s) => s.key);
  const i = order.indexOf(stage);
  const weights = order.map((k) => STAGE_SECONDS[k][0]);
  const total = weights.reduce((a, b) => a + b, 0);
  const elapsed = Number.isFinite(stageStartMs) ? Math.max(0, (nowMs - stageStartMs) / 1000) : 0;
  const inStage = Math.min(0.9, elapsed / STAGE_SECONDS[stage][0]);
  const done = weights.slice(0, i).reduce((a, b) => a + b, 0) + weights[i] * inStage;
  const later = order.slice(i + 1);
  const lo = Math.max(10, STAGE_SECONDS[stage][0] - elapsed) + later.reduce((a, k) => a + STAGE_SECONDS[k][0], 0);
  const hi = Math.max(20, STAGE_SECONDS[stage][1] - elapsed) + later.reduce((a, k) => a + STAGE_SECONDS[k][1], 0);
  return { progress: Math.max(prevMax, Number((done / total).toFixed(3))), eta: [Math.round(lo), Math.round(hi)] as [number, number] };
}

export function decideAutopilot(input: AutopilotInput): AutopilotDecision {
  const now = ms(input.now);
  const ap = input.autopilot;
  const order = UI_STAGES.map((s) => s.key);
  const base = (action: AutopilotAction, workerUi: UiStage, workerStage: string, heartbeatAt: string | null, stale = false): AutopilotDecision => {
    const uiStage = ap.stageMax && order.indexOf(ap.stageMax) > order.indexOf(workerUi) ? ap.stageMax : workerUi;
    const pe = progressAndEta(uiStage, ms(heartbeatAt), now, ap.progressMax ?? 0);
    return { action, uiStage, workerStage, heartbeatAt, stale, etaSeconds: pe.eta, progress: action.kind === "done" ? 1 : pe.progress };
  };
  if (ap.status === "done" && ap.scriptVersionId) return base({ kind: "done", scriptVersionId: ap.scriptVersionId }, "polish", "done", ap.doneAt ?? null);
  if (ap.status === "failed") return base({ kind: "fail", reason: ap.failedReason ?? "stopped" }, "plan", "failed", null);

  // A stale step is resumed (its counter shared across the run); past the cap it stops.
  const resumeOr = (action: AutopilotAction, stage: UiStage, workerStage: string, beat: string | null, reason: string): AutopilotDecision =>
    ap.resumes >= MAX_RESUMES
      ? base({ kind: "fail", reason: `${reason} after ${MAX_RESUMES} resumes` }, stage, workerStage, beat, true)
      : base(action, stage, workerStage, beat, true);
  const isStale = (beat: string | null, workerStage: string, lockUntil?: string | null) => {
    if (!beat) return true;
    if (lockUntil && ms(lockUntil) > now) return false; // a worker holds the stage right now
    return now - ms(beat) > (expectedStageSeconds(workerStage) + WATCHDOG_GRACE_S) * 1000;
  };

  // 1. Story plan.
  if (!input.plan) {
    const beat = ap.dispatched?.plan ?? null;
    if (!beat) return base({ kind: "generate_plan", resume: false }, "plan", "plan", ap.startedAt);
    if (isStale(beat, "plan")) return resumeOr({ kind: "generate_plan", resume: true }, "plan", "plan", beat, "the story plan stalled");
    return base({ kind: "wait" }, "plan", "plan", beat);
  }

  // 2. Research-lite (a helper — any terminal status moves on, failed is retried).
  const r = input.research;
  if (!r) {
    const beat = ap.dispatched?.research ?? null;
    if (!beat) return base({ kind: "start_research", resume: false }, "research", "start", input.plan.created_at);
    if (isStale(beat, "lite_claim_plan")) return resumeOr({ kind: "start_research", resume: true }, "research", "start", beat, "fact-finding didn't start");
    return base({ kind: "wait" }, "research", "start", beat);
  }
  if (r.status === "failed" && !input.script) return resumeOr({ kind: "start_research", resume: true }, "research", "failed", r.stage_started_at ?? r.created_at, "fact-finding failed");
  if (!RESEARCH_TERMINAL.has(r.status)) {
    const beat = r.stage_started_at ?? r.created_at;
    const ws = r.stage ?? "lite_claim_plan";
    if (isStale(beat, ws, r.worker_lock_until)) return resumeOr({ kind: "resume_research" }, "research", ws, beat, "fact-finding stalled");
    return base({ kind: "wait" }, "research", ws, beat);
  }

  // 3. Script (research is terminal: ready | needs_attention both go on).
  const s = input.script;
  if (!s) {
    const beat = ap.dispatched?.script ?? r.stage_started_at ?? r.created_at;
    if (!ap.dispatched?.script) return base({ kind: "start_script", resume: false }, "write", "start", beat);
    if (isStale(beat, "draft")) return resumeOr({ kind: "start_script", resume: true }, "write", "start", beat, "writing didn't start");
    return base({ kind: "wait" }, "write", "start", beat);
  }
  if (SCRIPT_DONE.has(s.status) && s.has_document) return base({ kind: "done", scriptVersionId: s.id }, "polish", "done", s.stage_started_at);
  if (s.status === "failed") {
    // Written again: three more tries on the default model, then one on the backup model.
    const tries = ap.scriptRetries ?? 0;
    const beat = s.stage_started_at ?? s.created_at;
    if (tries < SCRIPT_MAX_RETRIES) return base({ kind: "start_script", resume: true, afterFailure: true }, "write", "failed", beat, true);
    if (tries === SCRIPT_MAX_RETRIES) return base({ kind: "start_script", resume: true, afterFailure: true, backupModel: true }, "write", "failed", beat, true);
    return base({ kind: "fail", reason: `writing failed after ${SCRIPT_MAX_RETRIES} retries and the backup model` }, "write", "failed", beat, true);
  }
  const ws = s.stage ?? "draft";
  const beat = s.stage_started_at ?? s.created_at;
  const ui = uiStageOf("script", ws);
  if (isStale(beat, ws, s.worker_lock_until)) return resumeOr({ kind: "resume_script" }, ui, ws, beat, "the script stalled");
  return base({ kind: "wait" }, ui, ws, beat);
}

// Phase 6b: after the script, the chain goes on to narration with the voice
// chosen in Step 1 (lock -> TTS). Pure, like decideAutopilot. A stalled
// narration (lease expired) is handed to the generator, which resumes it once
// and then marks a clear failure (Retry free on the Voice screen).
export type NarrationRowLite = { id: string; status: string; lease_until: string | null; created_at: string } | null;
export type NarrationAction =
  | { kind: "lock" }
  | { kind: "wait" }
  | { kind: "resume"; rowId: string }
  | { kind: "done"; narrationStatus: "ready" | "failed" };
export const NARRATION_KICK_AFTER_S = 120;
export const NARRATION_MAX_KICKS = 3;
export function decideNarration(input: { now: string; narration?: { lockedAt?: string | null; kicks?: number } | null; row: NarrationRowLite }): NarrationAction {
  const now = ms(input.now);
  const n = input.narration ?? {};
  const row = input.row;
  if (row && (row.status === "ready" || row.status === "alignment_failed")) return { kind: "done", narrationStatus: "ready" };
  if (row?.status === "failed") return { kind: "done", narrationStatus: "failed" };
  if (row?.status === "generating") return row.lease_until && ms(row.lease_until) < now ? { kind: "resume", rowId: row.id } : { kind: "wait" };
  // No row yet: lock (which kicks TTS), re-kick if nothing appeared, then stop.
  if (!n.lockedAt) return { kind: "lock" };
  if (now - ms(n.lockedAt) < NARRATION_KICK_AFTER_S * 1000) return { kind: "wait" };
  return (n.kicks ?? 1) >= NARRATION_MAX_KICKS ? { kind: "done", narrationStatus: "failed" } : { kind: "lock" };
}

// The user-facing failure copy (never internal stage names).
export const FAILED_COPY = "Something went wrong while writing your script. Retry — it's free.";
// When the run could not make a video at all and the hold was released.
export const REFUNDED_COPY = "We couldn't make this video, so every credit for it is back in your account. Start it again whenever you like.";
